-- The saved chats: one row per conversation and one row per question and answer.
-- visitor, city, region, and timezone are cleared after 90 days by the daily cron (src/worker/log.ts). The rest is kept.

CREATE TABLE conversations (
  id            TEXT PRIMARY KEY,
  started_at    TEXT NOT NULL,
  last_at       TEXT NOT NULL,
  turn_count    INTEGER NOT NULL DEFAULT 1,
  country       TEXT,
  device        TEXT CHECK (device IN ('mobile', 'tablet', 'desktop')),
  browser       TEXT,
  os            TEXT,
  language      TEXT,
  viewport      TEXT CHECK (viewport IN ('phone', 'tablet', 'desktop')),
  color_scheme  TEXT CHECK (color_scheme IN ('light', 'dark')),
  entry_path    TEXT,
  referrer_host TEXT,
  visitor       TEXT,
  city          TEXT,
  region        TEXT,
  timezone      TEXT
);

CREATE INDEX idx_conversations_started_at ON conversations (started_at);

CREATE TABLE turns (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id   TEXT NOT NULL REFERENCES conversations (id),
  turn_number       INTEGER NOT NULL,
  created_at        TEXT NOT NULL,
  page_path         TEXT,
  source            TEXT CHECK (source IN ('pill', 'full', 'dock')),
  question          TEXT NOT NULL,
  answer            TEXT,
  outcome           TEXT NOT NULL CHECK (outcome IN ('answered', 'truncated', 'ip_day', 'ip_minute', 'ip_budget', 'global', 'ai_error')),
  finish_reason     TEXT,
  model             TEXT,
  prompt_version    TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  neurons           REAL,
  ttft_ms           INTEGER,
  ms                INTEGER
);

CREATE INDEX idx_turns_conversation ON turns (conversation_id, turn_number);
CREATE INDEX idx_turns_created_at ON turns (created_at);
