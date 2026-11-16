-- 迁移 v2：心情权重 + 日记归档（对应 docs/改进计划-v2.md §2.3）
-- 纯增量：只加列与索引；新列均可空或有默认值，保证 v1 旧库平滑升级。

-- 每次专注结束后的心情（1-5），NULL 表示未记录
ALTER TABLE focus_sessions ADD COLUMN mood_after INTEGER;

-- 专注开始前的心情（本轮不做 UI，只留字段）
ALTER TABLE focus_sessions ADD COLUMN mood_before INTEGER;

-- 日记状态：'draft' 草稿 / 'archived' 已归档；默认 draft，旧数据自动视为草稿
ALTER TABLE day_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';

-- 归档时间戳（UTC 毫秒）；NULL 表示从未归档
ALTER TABLE day_entries ADD COLUMN archived_at INTEGER;

-- 按日期取当日心情样本（开心度计算用）
CREATE INDEX IF NOT EXISTS idx_sessions_mood ON focus_sessions(local_date, mood_after);
