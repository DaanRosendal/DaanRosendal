// A Telegram message to Daan when someone starts a chat with Junior. It runs after the response has gone out (waitUntil),
// never throws, and does nothing unless both secrets are set (`wrangler secret put TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`).
import type { Visit } from './log';

const QUESTION_CHARS = 300;

export function describePing(visit: Visit, path: string | null, question: string) {
  const place = [visit.city, visit.country].filter(Boolean).join(', ') || 'somewhere';
  const text = question.length > QUESTION_CHARS ? `${question.slice(0, QUESTION_CHARS)}...` : question;
  return [`Junior has a new chat`, `"${text}"`, `${place} - ${visit.device}, ${visit.browser} on ${visit.os}`, `Page: ${path ?? 'unknown'}`].join('\n');
}

export async function pingTelegram(env: Env, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    // The response body can name the request, never the token, but only the status is logged anyway.
    if (!response.ok) console.log(JSON.stringify({ outcome: 'telegram_error', status: response.status }));
  } catch (error) {
    // The error text could contain the request URL, which holds the token, so log only its kind.
    console.log(JSON.stringify({ outcome: 'telegram_error', error: error instanceof Error ? error.name : 'unknown' }));
  }
}
