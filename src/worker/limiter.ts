import { DurableObject } from 'cloudflare:workers';

// Free-tier budget: Workers AI allows 10,000 neurons a day (resets 00:00 UTC). The gate stops at 7,000 so the
// estimates can be off and the real visitors still never hit Cloudflare's own hard stop.
export const LIMITS = {
  globalNeurons: 7000,
  ipPerDay: 20,
  ipPerMinute: 3,
  // One visitor may use about a quarter of the budget.
  ipNeurons: 2000,
};

export type Verdict = { ok: true } | { ok: false; reason: 'global' | 'ip_day' | 'ip_minute' | 'ip_budget' };

interface Row {
  n: number;
  neurons: number;
  window_start: number;
  window_n: number;
}

// One instance per UTC day (named by date), so the counters reset together with the Workers AI allowance.
// Every method is synchronous SQL with no await, so a check and its write cannot interleave with another request.
export class Limiter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS usage (
        k TEXT PRIMARY KEY,
        n INTEGER NOT NULL DEFAULT 0,
        neurons REAL NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL DEFAULT 0,
        window_n INTEGER NOT NULL DEFAULT 0
      )`,
    );
  }

  private row(key: string): Row {
    const found = this.ctx.storage.sql.exec<Record<string, number>>('SELECT n, neurons, window_start, window_n FROM usage WHERE k = ?', key).toArray()[0];
    return { n: found?.n ?? 0, neurons: found?.neurons ?? 0, window_start: found?.window_start ?? 0, window_n: found?.window_n ?? 0 };
  }

  private save(key: string, row: Row) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO usage (k, n, neurons, window_start, window_n) VALUES (?, ?, ?, ?, ?)',
      key,
      row.n,
      row.neurons,
      row.window_start,
      row.window_n,
    );
  }

  // Counts the request and holds back the estimated neurons, or says why it is refused. `ip` is a salted hash.
  reserve(ip: string, estimate: number): Verdict {
    const now = Date.now();
    const all = this.row('*');
    const one = this.row(ip);
    if (all.neurons + estimate > LIMITS.globalNeurons) return { ok: false, reason: 'global' };
    if (one.n >= LIMITS.ipPerDay) return { ok: false, reason: 'ip_day' };
    if (now - one.window_start > 60_000) {
      one.window_start = now;
      one.window_n = 0;
    }
    if (one.window_n >= LIMITS.ipPerMinute) return { ok: false, reason: 'ip_minute' };
    if (one.neurons + estimate > LIMITS.ipNeurons) return { ok: false, reason: 'ip_budget' };

    all.n += 1;
    all.neurons += estimate;
    one.n += 1;
    one.window_n += 1;
    one.neurons += estimate;
    this.save('*', all);
    this.save(ip, one);
    return { ok: true };
  }

  // Swaps the estimate for the real cost once it is known (0 when the request failed).
  settle(ip: string, estimate: number, actual: number) {
    const delta = actual - estimate;
    this.ctx.storage.sql.exec("UPDATE usage SET neurons = MAX(0, neurons + ?) WHERE k IN ('*', ?)", delta, ip);
  }

  // Cloudflare said the daily allowance is gone, so refuse everything else today without calling it again.
  exhaust() {
    const all = this.row('*');
    all.neurons = Math.max(all.neurons, LIMITS.globalNeurons);
    this.save('*', all);
  }

  // The totals so far today.
  stats() {
    return this.row('*');
  }
}
