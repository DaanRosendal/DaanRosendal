import context from './context.generated.txt';
import { Limiter } from './limiter';
import { SYSTEM_PROMPT } from './prompt';

export { Limiter };

const CONTACT = 'contact@daanrosendal.com';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_CHARS = 20000;
const MAX_HISTORY = 6;
// A visitor's question stays short, but the assistant's earlier answers (resent as history) are far longer.
const MAX_CHARS = { user: 800, assistant: 4000 };
const MAX_ANSWER_TOKENS = 700;

// Models change often, so the choice lives here. Neuron prices are per million tokens (input, output).
// The second model is only tried when the first one is gone (deprecated) or no longer free.
const MODELS = [
  { id: '@cf/google/gemma-4-26b-a4b-it', input: 9091, output: 27273, extra: { chat_template_kwargs: { enable_thinking: false } } },
  { id: '@cf/zai-org/glm-4.7-flash', input: 5500, output: 36400, extra: {} },
] as const;

// The gate holds back this many neurons per request: prompt tokens (3 characters each, on the high side) at the
// dearer input price, plus a full answer at the dearer output price. The real cost replaces it afterwards.
const ESTIMATE_INPUT_PRICE = 9091;
const ESTIMATE_OUTPUT_PRICE = 36400;

const PROMPT = SYSTEM_PROMPT + context;

// The page the visitor is on, so "this page" and "here" make sense. The client sends it, so it is checked and kept short.
function readPage(value: unknown) {
  const { path, title } = (value ?? {}) as { path?: unknown; title?: unknown };
  if (typeof path !== 'string' || typeof title !== 'string') return null;
  if (!/^\/[a-z0-9\-_/]{0,100}$/.test(path)) return null;
  const clean = title.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 100);
  return clean ? { path, title: clean } : null;
}

const HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const MESSAGES = {
  bad_request: 'That message could not be read. Please try again.',
  forbidden: 'This request was not allowed.',
  turnstile: 'Could not verify that you are human. Please reload the page and try again.',
  ip_day: `You have used today's 20 messages. Please come back tomorrow, or email ${CONTACT}.`,
  ip_minute: 'Please slow down a little and try again in a minute.',
  ip_budget: `You have used your share of today's chat budget. Please come back tomorrow, or email ${CONTACT}.`,
  global: `The chat has used up its free daily budget and rests until 00:00 UTC. Please try again later, or email ${CONTACT}.`,
  off: `The chat is switched off for now. Please email ${CONTACT} instead.`,
  unavailable: `The chat is unavailable right now. Please email ${CONTACT} instead.`,
} as const;

type Reason = keyof typeof MESSAGES;

const reply = (status: number, reason: Reason, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: reason, message: MESSAGES[reason] }), {
    status,
    headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8', ...extra },
  });

const log = (fields: Record<string, unknown>) => console.log(JSON.stringify(fields));

const isLocal = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

// IPv4 as is, IPv6 cut to its /64, then hashed with a salt so no address is stored anywhere.
async function visitorKey(ip: string, salt: string) {
  const bucket = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${bucket}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function humanVerified(token: string, ip: string, request: Request, env: Env) {
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip });
  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    const out = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
    if (!out.success) return false;
    // Cloudflare's test keys answer with fixed values, so the hostname and action are only checked for real.
    if (isLocal(new URL(request.url).hostname)) return true;
    return out.hostname === 'daanrosendal.com' && out.action === 'chat';
  } catch {
    return false;
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function readMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HISTORY) return null;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    const { role, content } = (item ?? {}) as Partial<ChatMessage>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const text = content.trim();
    if (!text || text.length > MAX_CHARS[role]) return null;
    messages.push({ role, content: text });
  }
  return messages.at(-1)?.role === 'user' ? messages : null;
}

// The last chunk of a Workers AI stream carries the token counts (and the neuron cost), when the model reports them.
async function readUsage(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let tail = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tail = (tail + decoder.decode(value, { stream: true })).slice(-4000);
    }
  } catch {
    return null;
  }
  for (const line of tail.split('\n').reverse()) {
    if (!line.startsWith('data:') || !line.includes('"usage"')) continue;
    try {
      const usage = JSON.parse(line.slice(5)).usage;
      if (typeof usage?.prompt_tokens === 'number' && typeof usage?.completion_tokens === 'number') {
        return {
          prompt: usage.prompt_tokens as number,
          completion: usage.completion_tokens as number,
          // Workers AI reports the exact cost of the request, when it does.
          neurons: typeof usage.neurons === 'number' ? (usage.neurons as number) : undefined,
        };
      }
    } catch {
      // Not the line we wanted.
    }
  }
  return null;
}

// A canned stream for local testing (DRY_RUN in .dev.vars), so the limits and the page can be tried for free.
function dryRunStream() {
  const encoder = new TextEncoder();
  const answer = `Meow, a **canned** answer from the test mode, so no neurons were spent.

## What I can do
- Read a [research page](/research/federated-learning-paper/) or the [projects](/projects/)
- Show \`inline code\` and a snippet:

\`\`\`ts
const greet = (name: string) => \`hello \${name}\`;
console.log(greet('Junior'));
\`\`\`

| Where | When |
|:--|--:|
| CERN | 2023 |
| Lakera | now |

> Cats do not need a markdown renderer, but it helps. Write to contact@daanrosendal.com.
`;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let i = 0; i < answer.length; i += 6) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: answer.slice(i, i + 6) } }] })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

async function chat(request: Request, env: Env, ctx: ExecutionContext) {
  const started = Date.now();
  const url = new URL(request.url);

  if (request.method !== 'POST') return reply(405, 'bad_request', { allow: 'POST' });
  if (env.CHAT_ENABLED === '0') return reply(503, 'off');

  // Cheap checks first. A browser always sends these, so they only turn away casual outside use of the endpoint.
  const site = request.headers.get('sec-fetch-site');
  if (request.headers.get('origin') !== url.origin || (site && site !== 'same-origin')) return reply(403, 'forbidden');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply(400, 'bad_request');
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_CHARS) return reply(413, 'bad_request');

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return reply(413, 'bad_request');
  let body: { messages?: unknown; turnstile?: unknown; page?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, 'bad_request');
  }
  const history = readMessages(body.messages);
  const token = typeof body.turnstile === 'string' ? body.turnstile : '';
  if (!history || !token || token.length > 2048) return reply(400, 'bad_request');

  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  if (!(await humanVerified(token, ip, request, env))) {
    log({ outcome: 'turnstile_failed' });
    return reply(403, 'turnstile');
  }

  const page = readPage(body.page);
  const system = page ? `${PROMPT}\nThe visitor is currently viewing the page "${page.title}" (${page.path}).\n` : PROMPT;
  const messages = [{ role: 'system', content: system }, ...history];
  const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  const estimate =
    (Math.ceil(promptChars / 3) * ESTIMATE_INPUT_PRICE + MAX_ANSWER_TOKENS * ESTIMATE_OUTPUT_PRICE) / 1_000_000;

  const key = await visitorKey(ip, env.TURNSTILE_SECRET);
  const day = new Date().toISOString().slice(0, 10);
  const limiter = env.LIMITER.get(env.LIMITER.idFromName(`d:${day}`));

  let verdict;
  try {
    verdict = await limiter.reserve(key, estimate);
  } catch (error) {
    // The counter is unreachable, so refuse: better a resting chat than an unmetered one.
    log({ outcome: 'limiter_error', error: String(error) });
    return reply(503, 'unavailable');
  }
  if (!verdict.ok) {
    log({ outcome: verdict.reason, visitor: key.slice(0, 6) });
    return reply(429, verdict.reason);
  }

  const headers = { ...HEADERS, 'content-type': 'text/event-stream; charset=utf-8', 'x-accel-buffering': 'no' };

  if (env.DRY_RUN === '1') {
    ctx.waitUntil(limiter.settle(key, estimate, 0));
    return new Response(dryRunStream(), { headers });
  }

  for (const model of MODELS) {
    try {
      const result = await env.AI.run(
        model.id as keyof AiModels,
        { messages, stream: true, max_completion_tokens: MAX_ANSWER_TOKENS, temperature: 0.3, ...model.extra } as never,
      );
      if (!(result instanceof ReadableStream)) throw new Error('Workers AI did not return a stream');

      const [toVisitor, toMeter] = result.tee();
      ctx.waitUntil(
        (async () => {
          const usage = await readUsage(toMeter);
          const actual = usage ? (usage.neurons ?? (usage.prompt * model.input + usage.completion * model.output) / 1_000_000) : estimate;
          await limiter.settle(key, estimate, actual);
          log({ outcome: 'answered', model: model.id, visitor: key.slice(0, 6), estimate: Math.round(estimate), actual: Math.round(actual), usage: !!usage, ms: Date.now() - started });
        })(),
      );
      return new Response(toVisitor, { headers });
    } catch (error) {
      const message = String(error);
      log({ outcome: 'ai_error', model: model.id, error: message.slice(0, 300) });
      // Daily free allowance used up (error 3036): stop calling until the counters reset at 00:00 UTC.
      // Error 3040 (out of capacity) is momentary, so it only fails this one request.
      if (/3036|daily free allocation/i.test(message)) {
        ctx.waitUntil(Promise.all([limiter.exhaust(), limiter.settle(key, estimate, 0)]));
        return reply(429, 'global');
      }
      // Model deprecated (5028) or not free anymore (5035): try the next one.
      if (/5028|5035|deprecated|workers paid/i.test(message)) continue;
      break;
    }
  }
  ctx.waitUntil(limiter.settle(key, estimate, 0));
  return reply(502, 'unavailable');
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/chat') return chat(request, env, ctx);
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8' },
    });
  },
} satisfies ExportedHandler<Env>;
