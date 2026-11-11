// The saved chats (D1, schema in migrations/). One row per conversation and one per question and answer.
// Never stored: the IP address, the user-agent string, coordinates, the postal code, and the network name.

export type Outcome = 'answered' | 'truncated' | 'ip_day' | 'ip_minute' | 'ip_budget' | 'global' | 'ai_error';

export interface ClientInfo {
  conversation: string;
  source: 'pill' | 'full' | 'dock' | null;
  referrer: string | null;
  viewport: 'phone' | 'tablet' | 'desktop' | null;
  scheme: 'light' | 'dark' | null;
}

export interface Visit {
  visitor: string;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  device: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  language: string | null;
}

export interface TurnRecord {
  startedAt: string;
  entryPath: string | null;
  question: string;
  outcome: Outcome;
  answer?: string;
  finishReason?: string;
  model?: string;
  promptVersion?: string;
  promptTokens?: number;
  completionTokens?: number;
  neurons?: number;
  ttftMs?: number;
  ms?: number;
}

// Visitor, city, region, and timezone are cleared after this many days.
export const CLEAR_AFTER_DAYS = 90;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOST = /^[a-z0-9.-]{1,100}$/;

const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | null =>
  typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : null;

// The browser sends this, so every field is checked. A conversation id that is missing or malformed gets a fresh one.
export function readClient(value: unknown): ClientInfo {
  const { conversation, source, referrer, viewport, scheme } = (value ?? {}) as Record<string, unknown>;
  const id = typeof conversation === 'string' ? conversation.toLowerCase() : '';
  const host = typeof referrer === 'string' ? referrer.toLowerCase() : '';
  return {
    conversation: UUID.test(id) ? id : crypto.randomUUID(),
    source: oneOf(source, ['pill', 'full', 'dock'] as const),
    referrer: HOST.test(host) ? host : null,
    viewport: oneOf(viewport, ['phone', 'tablet', 'desktop'] as const),
    scheme: oneOf(scheme, ['light', 'dark'] as const),
  };
}

const short = (value: unknown, max = 100) => (typeof value === 'string' && value ? value.slice(0, max) : null);

// Families only, never the full string: enough to tell a phone from a laptop, too coarse to single someone out.
function describeAgent(agent: string) {
  const device: Visit['device'] = /iPad|Tablet|Android(?!.*Mobile)/i.test(agent) ? 'tablet' : /Mobi|iPhone|iPod/i.test(agent) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\/|Opera/.test(agent)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(agent)
        ? 'Firefox'
        : /Chrome\/|CriOS/.test(agent)
          ? 'Chrome'
          : /Safari\//.test(agent)
            ? 'Safari'
            : 'Other';
  const os = /iPhone|iPad|iPod/.test(agent)
    ? 'iOS'
    : /Android/.test(agent)
      ? 'Android'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Mac OS X/.test(agent)
          ? 'macOS'
          : /CrOS/.test(agent)
            ? 'ChromeOS'
            : /Linux/.test(agent)
              ? 'Linux'
              : 'Other';
  return { device, browser, os };
}

export function describeVisit(request: Request, visitor: string): Visit {
  const cf = (request.cf ?? {}) as Record<string, unknown>;
  const language = request.headers.get('accept-language')?.match(/^\s*([a-zA-Z]{2,3})/)?.[1].toLowerCase() ?? null;
  return {
    visitor,
    country: short(cf.country, 2),
    city: short(cf.city),
    region: short(cf.region),
    timezone: short(cf.timezone),
    ...describeAgent(request.headers.get('user-agent') ?? ''),
    language,
  };
}

// A short fingerprint of a text, to tell which version of the prompt produced an answer.
export async function fingerprint(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest).slice(0, 3)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const nul = <T>(value: T | undefined): T | null => value ?? null;

// The conversation row is created by its first turn and only counted up by the next ones. One batch is one transaction.
export async function saveTurn(db: D1Database | undefined, client: ClientInfo, visit: Visit, turn: TurnRecord) {
  if (!db) return;
  await db.batch([
    db
      .prepare(
        `INSERT INTO conversations (id, started_at, last_at, turn_count, country, device, browser, os, language, viewport, color_scheme, entry_path, referrer_host, visitor, city, region, timezone)
         VALUES (?1, ?2, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT (id) DO UPDATE SET last_at = excluded.last_at, turn_count = turn_count + 1`,
      )
      .bind(
        client.conversation,
        turn.startedAt,
        visit.country,
        visit.device,
        visit.browser,
        visit.os,
        visit.language,
        client.viewport,
        client.scheme,
        turn.entryPath,
        client.referrer,
        visit.visitor,
        visit.city,
        visit.region,
        visit.timezone,
      ),
    db
      .prepare(
        `INSERT INTO turns (conversation_id, turn_number, created_at, page_path, source, question, answer, outcome, finish_reason, model, prompt_version, prompt_tokens, completion_tokens, neurons, ttft_ms, ms)
         VALUES (?1, (SELECT COALESCE(MAX(turn_number), 0) + 1 FROM turns WHERE conversation_id = ?1), ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
      )
      .bind(
        client.conversation,
        turn.startedAt,
        turn.entryPath,
        client.source,
        turn.question,
        nul(turn.answer),
        turn.outcome,
        nul(turn.finishReason),
        nul(turn.model),
        nul(turn.promptVersion),
        nul(turn.promptTokens),
        nul(turn.completionTokens),
        nul(turn.neurons),
        nul(turn.ttftMs),
        nul(turn.ms),
      ),
  ]);
}

// The daily cron: conversations older than CLEAR_AFTER_DAYS lose the columns that point to a person. The text and the rest stay.
// Done in chunks, because one big update would run out of time.
export async function clearOld(db: D1Database | undefined, now = Date.now()) {
  if (!db) return 0;
  const cutoff = new Date(now - CLEAR_AFTER_DAYS * 86_400_000).toISOString();
  const CHUNK = 1000;
  let cleared = 0;
  // Free plan: at most 50 subrequests per run, so a few dozen chunks is plenty.
  for (let round = 0; round < 30; round++) {
    const result = await db
      .prepare(
        `UPDATE conversations SET visitor = NULL, city = NULL, region = NULL, timezone = NULL
         WHERE id IN (
           SELECT id FROM conversations
           WHERE started_at < ?1 AND (visitor IS NOT NULL OR city IS NOT NULL OR region IS NOT NULL OR timezone IS NOT NULL)
           LIMIT ${CHUNK}
         )`,
      )
      .bind(cutoff)
      .run();
    const changed = result.meta.changes ?? 0;
    cleared += changed;
    if (changed < CHUNK) break;
  }
  return cleared;
}
