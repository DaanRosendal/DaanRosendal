// The daily probe (the 03:17 UTC cron): asks every model in the list for one word, through the same AI binding and the same
// streaming path the chat uses. It says nothing when all is well. A model that fails, or a whole list that fails, becomes a
// Telegram alert (see notify.ts), so a retired or no longer free model is noticed the next morning and not by a visitor.
import { pingTelegram } from './notify';

interface Model {
  id: string;
  extra: object;
}

type Read = (stream: ReadableStream<Uint8Array>, since: number) => Promise<{ answer: string }>;

export interface Result {
  id: string;
  ok: boolean;
  ms: number;
  /** Why it failed: the error code when there is one, else the start of the message. */
  problem?: string;
}

const TIMEOUT_MS = 30_000;

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const name = (id: string) => id.split('/').pop() ?? id;

// Workers AI errors carry a four digit code (5028 deprecated, 3036 allowance used up, 3040 out of capacity).
function describeProblem(error: unknown) {
  const text = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 120);
  const code = text.match(/\b[35]\d{3}\b/);
  return code ? text : `${text} (no error code)`;
}

async function probeOne(env: Env, model: Model, read: Read): Promise<Result> {
  const began = Date.now();
  try {
    const run = env.AI.run(
      model.id as keyof AiModels,
      {
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        stream: true,
        max_completion_tokens: 16,
        temperature: 0,
        ...model.extra,
      } as never,
    );
    // The binding takes no abort signal, so a hung model is given up on after the timeout.
    const result = await Promise.race([
      run,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out after 30 s')), TIMEOUT_MS)),
    ]);
    if (!(result instanceof ReadableStream)) throw new Error('no stream came back');
    const seen = await Promise.race([
      read(result, began),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('the answer timed out after 30 s')), TIMEOUT_MS)),
    ]);
    if (!seen.answer.trim()) throw new Error('an empty answer');
    return { id: model.id, ok: true, ms: Date.now() - began };
  } catch (error) {
    return { id: model.id, ok: false, ms: Date.now() - began, problem: describeProblem(error) };
  }
}

/** The alert text (Telegram HTML), or null when every model answered. */
export function describeProbe(results: Result[]) {
  const failed = results.filter((result) => !result.ok);
  if (!failed.length) return null;
  const lines = failed.map((result) => `• <b>${esc(name(result.id))}</b>: ${esc(result.problem ?? 'failed')}`);
  if (failed.length === results.length) {
    return [`<b>\u{1F6A8} Junior is down</b>`, `No model answered the daily probe, so the chat gives visitors an error.`, ...lines].join('\n');
  }
  const working = results.filter((result) => result.ok).map((result) => name(result.id));
  return [`<b>⚠️ Junior is degraded</b>`, `The chat still works, on ${esc(working.join(', '))}.`, ...lines].join('\n');
}

export async function runProbe(env: Env, models: readonly Model[], read: Read) {
  try {
    // Locally with DRY_RUN there is no model to ask.
    if (env.DRY_RUN === '1' || !env.AI) return;
    // One after the other, so the probe never takes more than a sliver of the daily allowance at once.
    const results: Result[] = [];
    for (const model of models) results.push(await probeOne(env, model, read));
    console.log(JSON.stringify({ outcome: 'probe', results: results.map(({ id, ok, ms, problem }) => ({ id, ok, ms, problem })) }));
    const alert = describeProbe(results);
    if (alert) {
      // Workers Issues records console.error, so a failed probe also shows up there.
      console.error(JSON.stringify({ outcome: 'probe_failed', failed: results.filter((result) => !result.ok).map((result) => result.id) }));
      await pingTelegram(env, alert);
    }
  } catch (error) {
    console.error(JSON.stringify({ outcome: 'probe_error', error: error instanceof Error ? error.name : 'unknown' }));
    await pingTelegram(env, `<b>⚠️ Junior's daily probe crashed</b>\nThe probe itself failed (${esc(error instanceof Error ? error.name : 'unknown')}), so the models were not checked. See the Worker logs.`);
  }
}
