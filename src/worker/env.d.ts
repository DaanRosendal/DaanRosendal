import type { Limiter } from './limiter';

declare global {
  interface Env {
    AI: Ai;
    LIMITER: DurableObjectNamespace<Limiter>;
    ASSETS: Fetcher;
    /** The saved chats (D1, schema in migrations/). */
    DB?: D1Database;
    /** Turnstile secret key: `wrangler secret put TURNSTILE_SECRET` in production, .dev.vars locally. */
    TURNSTILE_SECRET: string;
    /** Set to "0" in wrangler.jsonc to switch the chat off. */
    CHAT_ENABLED?: string;
    /** Local testing only (.dev.vars): answer with a canned stream and spend no neurons. */
    DRY_RUN?: string;
  }
}

export {};
