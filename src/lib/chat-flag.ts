// Master switch for the chat on the website: the pill, the dock, and everything the pages load for them.
// It is off while the chat is unfinished (set on 2026-11-10). To bring the chat back, set this to true and rebuild.
// This does not touch the Worker at /api/chat, which has its own kill switch (CHAT_ENABLED in wrangler.jsonc).
export const CHAT_UI_ENABLED = false;
