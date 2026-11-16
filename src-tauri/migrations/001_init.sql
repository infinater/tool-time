-- 初始 schema（与 docs/番茄钟-产品设计文档-v0.2.md §7.2 对齐）
-- 注意：所有时间戳为 UTC 毫秒；local_date 为本地日期冗余列，用于日历与统计。

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  est_pomodoros INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  planned_seconds INTEGER NOT NULL,
  actual_seconds INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  paused_total_ms INTEGER NOT NULL DEFAULT 0,
  interruptions INTEGER NOT NULL DEFAULT 0,
  local_date TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS day_entries (
  id TEXT PRIMARY KEY,
  local_date TEXT NOT NULL UNIQUE,
  mood INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  journal_title TEXT,
  journal_md TEXT NOT NULL DEFAULT '',
  is_backfilled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  local_date TEXT NOT NULL,
  type TEXT NOT NULL,
  content_md TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON focus_sessions(local_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON focus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON focus_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reflections_date ON reflections(local_date);
CREATE INDEX IF NOT EXISTS idx_reflections_created ON reflections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
