// Master switch for the chat on the website: the pill, the dock, and everything the pages load for them.
// It was switched off while the chat was unfinished (2026-11-10) and is on again since 2026-11-11. To switch the chat off
// on the website, set this to false and rebuild.
// This does not touch the Worker at /api/chat, which has its own kill switch (CHAT_ENABLED in wrangler.jsonc).
export const CHAT_UI_ENABLED = true;
