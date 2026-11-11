// A Telegram message to Daan for every question and answer (not for visitors who hit their own limit). It runs after the response has gone out (waitUntil),
// never throws, and does nothing unless both secrets are set (`wrangler secret put TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`).
import type { ClientInfo, TurnRecord, Visit } from './log';

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}...` : value);

export interface Ping {
  turnNumber: number;
  visit: Visit;
  client: ClientInfo;
  turn: Pick<TurnRecord, 'question' | 'outcome'> & Partial<TurnRecord>;
}

// Telegram HTML, at most 4096 characters: the question and the answer in quotes, the details below. Long texts are cut until it fits.
export function describePing({ turnNumber, visit, client, turn }: Ping) {
  const place = [visit.city, visit.region, visit.country].filter(Boolean).join(', ') || 'unknown place';
  const line = (...parts: (string | number | null | undefined | false)[]) => parts.filter((part) => part !== null && part !== undefined && part !== false && part !== '').join(' · ');
  const seconds = (ms?: number) => (ms === undefined ? undefined : `${(ms / 1000).toFixed(1)}s`);
  const tokens = turn.promptTokens !== undefined || turn.completionTokens !== undefined ? `${turn.promptTokens ?? '?'} in / ${turn.completionTokens ?? '?'} out tokens` : undefined;
  const details = [
    `\u{1F4CD} ${esc(line(place, visit.timezone))}`,
    `\u{1F4F1} ${esc(line(visit.device, visit.browser, visit.os, visit.language, client.viewport && `${client.viewport} window`, client.scheme))}`,
    `\u{1F4C4} ${esc(line(turn.entryPath ?? 'unknown page', client.source && `via ${client.source}`, client.referrer && `from ${client.referrer}`))}`,
    `\u{1F916} ${esc(line(turn.model, turn.outcome, tokens, turn.neurons !== undefined && `${Math.round(turn.neurons)} neurons`, turn.ttftMs !== undefined && `first words ${seconds(turn.ttftMs)}`, seconds(turn.ms)))}`,
    `\u{1F194} <code>${client.conversation.slice(0, 8)}</code> · visitor <code>${visit.visitor.slice(0, 6)}</code>`,
  ].join('\n');
  for (let scale = 1; ; scale /= 2) {
    const text = [
      `<b>\u{1F431} Junior chat</b> · question ${turnNumber}`,
      `<b>Question</b>\n<blockquote>${esc(cut(turn.question, 1000 * scale))}</blockquote>`,
      `<b>Answer</b>\n<blockquote>${turn.answer ? esc(cut(turn.answer, 2000 * scale)) : '(none)'}</blockquote>`,
      details,
    ].join('\n\n');
    if (text.length <= 4000 || scale < 0.05) return text.slice(0, 4000);
  }
}

export async function pingTelegram(env: Env, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(5000),
    });
    // The response body can name the request, never the token, but only the status is logged anyway.
    if (!response.ok) console.log(JSON.stringify({ outcome: 'telegram_error', status: response.status }));
  } catch (error) {
    // The error text could contain the request URL, which holds the token, so log only its kind.
    console.log(JSON.stringify({ outcome: 'telegram_error', error: error instanceof Error ? error.name : 'unknown' }));
  }
}
