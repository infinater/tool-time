import Database from "@tauri-apps/plugin-sql";
import type {
  DBShape,
  DayEntry,
  FocusSession,
  Mood,
  Reflection,
  SessionKind,
  SessionStatus,
  Settings,
  Task,
} from "./types";

/**
 * SQLite 持久化层（Tauri 环境）。
 *
 * - 表名/列名在 `src-tauri/migrations/001_init.sql` 中定义（snake_case），
 *   这里负责 camelCase ↔ snake_case 映射。
 * - 数组/对象字段（tags、settings）以 JSON 字符串存储；布尔以 0/1 存储。
 * - 所有错误都被 catch + console.error，持久化失败绝不向上抛，避免拖垮 UI。
 */

// Rust 侧启动时注入真实数据库 URL（可写目录），浏览器/旧版本回退到插件默认相对路径
const DB_URL =
  (typeof window !== "undefined"
    ? (window as unknown as { __TOOLTIME_DB_URL__?: string }).__TOOLTIME_DB_URL__
    : undefined) ?? "sqlite:tooltime.db";
const SETTINGS_KEY = "app";
const SCHEMA_VERSION = 1;

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/* ------------------------------------------------------------------ */
/* 连接：模块级缓存，失败后清空以便下次重试                                */
/* ------------------------------------------------------------------ */

let dbPromise: Promise<Database> | null = null;

const LOAD_TIMEOUT_MS = 4000;

/**
 * 受限环境（沙箱/无 AppData 写权限）里 sql 插件会在 Rust 侧 panic，
 * IPC 既不 resolve 也不 reject。一次超时后直接停用 SQLite，退回 localStorage，
 * 避免每次写入都触发一次 panic。
 */
let disabled = false;

/** 某些受限环境里 IPC 可能既不 resolve 也不 reject，加超时兜底，避免 hydrate 永远卡住 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`[db] ${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

function getDB(): Promise<Database> {
  if (disabled) return Promise.reject(new Error("[db] sqlite disabled"));
  if (!dbPromise) {
    const pending = withTimeout(Database.load(DB_URL), LOAD_TIMEOUT_MS, "Database.load");
    dbPromise = pending;
    pending.catch((error: unknown) => {
      if (dbPromise === pending) dbPromise = null;
      if (String(error).includes("timeout")) disabled = true;
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------ */
/* 串行化写入：整快照写入按调用顺序排队，避免并发互相覆盖                 */
/* ------------------------------------------------------------------ */

let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  // 前一次失败也继续执行后续写入
  const run = writeQueue.then(task, () => task());
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ------------------------------------------------------------------ */
/* 行类型与映射                                                        */
/* ------------------------------------------------------------------ */

interface TaskRow {
  id: string;
  title: string;
  status: string;
  est_pomodoros: number;
  created_at: number;
}

interface SessionRow {
  id: string;
  task_id: string | null;
  kind: string;
  status: string;
  planned_seconds: number;
  actual_seconds: number;
  started_at: number;
  ended_at: number | null;
  paused_total_ms: number;
  interruptions: number;
  local_date: string;
  note: string | null;
}

interface DayEntryRow {
  id: string;
  local_date: string;
  mood: number | null;
  tags: string | null;
  journal_title: string | null;
  journal_md: string | null;
  is_backfilled: number;
  created_at: number;
  updated_at: number;
}

interface ReflectionRow {
  id: string;
  session_id: string | null;
  local_date: string;
  type: string;
  content_md: string;
  created_at: number;
}

interface SettingRow {
  key: string;
  value_json: string;
}

const SESSION_KINDS: readonly SessionKind[] = ["work", "short_break", "long_break"];
const SESSION_STATUSES: readonly SessionStatus[] = ["running", "completed", "aborted", "skipped"];
const REFLECTION_TYPES: readonly Reflection["type"][] = ["quick", "daily"];

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optNum(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = num(value, Number.NaN);
  return Number.isFinite(n) ? n : undefined;
}

function optStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : value === null || value === undefined ? undefined : String(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function toMood(value: unknown): Mood | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Mood) : undefined;
}

function parseTags(value: unknown): string[] {
  if (typeof value !== "string" || value === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    status: row.status === "done" ? "done" : "todo",
    estPomodoros: num(row.est_pomodoros, 1),
    createdAt: num(row.created_at),
  };
}

function toSession(row: SessionRow): FocusSession {
  const session: FocusSession = {
    id: String(row.id),
    kind: oneOf(row.kind, SESSION_KINDS, "work"),
    status: oneOf(row.status, SESSION_STATUSES, "completed"),
    plannedSeconds: num(row.planned_seconds),
    actualSeconds: num(row.actual_seconds),
    startedAt: num(row.started_at),
    pausedTotalMs: num(row.paused_total_ms),
    interruptions: num(row.interruptions),
    localDate: String(row.local_date ?? ""),
  };
  const taskId = optStr(row.task_id);
  if (taskId !== undefined) session.taskId = taskId;
  const endedAt = optNum(row.ended_at);
  if (endedAt !== undefined) session.endedAt = endedAt;
  const note = optStr(row.note);
  if (note !== undefined) session.note = note;
  return session;
}

function toDayEntry(row: DayEntryRow): DayEntry {
  const entry: DayEntry = {
    id: String(row.id),
    localDate: String(row.local_date ?? ""),
    tags: parseTags(row.tags),
    journalMd: String(row.journal_md ?? ""),
    isBackfilled: num(row.is_backfilled) !== 0,
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
  const mood = toMood(row.mood);
  if (mood !== undefined) entry.mood = mood;
  const title = optStr(row.journal_title);
  if (title !== undefined) entry.journalTitle = title;
  return entry;
}

function toReflection(row: ReflectionRow): Reflection {
  const reflection: Reflection = {
    id: String(row.id),
    localDate: String(row.local_date ?? ""),
    type: oneOf(row.type, REFLECTION_TYPES, "quick"),
    contentMd: String(row.content_md ?? ""),
    createdAt: num(row.created_at),
  };
  const sessionId = optStr(row.session_id);
  if (sessionId !== undefined) reflection.sessionId = sessionId;
  return reflection;
}

/** settings 表只存一行（key='app'），value_json 是整份 Settings 的 JSON */
function parseSettings(rows: SettingRow[]): Settings | null {
  const row = rows.find((r) => r.key === SETTINGS_KEY) ?? rows[0];
  if (!row || typeof row.value_json !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(row.value_json);
    return parsed && typeof parsed === "object" ? (parsed as Settings) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 读取                                                                */
/* ------------------------------------------------------------------ */

export async function loadSnapshot(): Promise<DBShape | null> {
  if (!isTauri() || disabled) return null;
  try {
    const db = await getDB();
    const [taskRows, sessionRows, dayRows, reflectionRows, settingRows] = await Promise.all([
      db.select<TaskRow[]>("SELECT * FROM tasks ORDER BY created_at ASC"),
      db.select<SessionRow[]>("SELECT * FROM focus_sessions ORDER BY started_at DESC"),
      db.select<DayEntryRow[]>("SELECT * FROM day_entries ORDER BY local_date ASC"),
      db.select<ReflectionRow[]>("SELECT * FROM reflections ORDER BY created_at DESC"),
      db.select<SettingRow[]>("SELECT key, value_json FROM settings"),
    ]);

    const settings = parseSettings(settingRows);
    const hasAnyData =
      taskRows.length > 0 ||
      sessionRows.length > 0 ||
      dayRows.length > 0 ||
      reflectionRows.length > 0 ||
      settings !== null;
    if (!hasAnyData) return null;

    return {
      version: SCHEMA_VERSION,
      tasks: taskRows.map(toTask),
      sessions: sessionRows.map(toSession),
      dayEntries: dayRows.map(toDayEntry),
      reflections: reflectionRows.map(toReflection),
      // 旧库可能没有 settings 行：返回空对象，由调用方与默认设置合并
      settings: settings ?? ({} as Settings),
    };
  } catch (error) {
    console.error("[db] loadSnapshot failed:", error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 写入                                                                */
/* ------------------------------------------------------------------ */

export function saveSnapshot(db: DBShape): Promise<void> {
  if (!isTauri() || disabled) return Promise.resolve();
  return enqueueWrite(async () => {
    try {
      const conn = await getDB();
      await writeSnapshot(conn, db);
    } catch (error) {
      console.error("[db] saveSnapshot failed:", error);
    }
  });
}

async function writeSnapshot(conn: Database, db: DBShape): Promise<void> {
  // 1) 先写（upsert）现有行
  await upsertRows(
    conn,
    "tasks",
    ["id", "title", "status", "est_pomodoros", "created_at"],
    ["title", "status", "est_pomodoros", "created_at"],
    db.tasks.map((t) => [t.id, t.title, t.status, t.estPomodoros, t.createdAt]),
  );

  await upsertRows(
    conn,
    "focus_sessions",
    [
      "id",
      "task_id",
      "kind",
      "status",
      "planned_seconds",
      "actual_seconds",
      "started_at",
      "ended_at",
      "paused_total_ms",
      "interruptions",
      "local_date",
      "note",
    ],
    [
      "task_id",
      "kind",
      "status",
      "planned_seconds",
      "actual_seconds",
      "started_at",
      "ended_at",
      "paused_total_ms",
      "interruptions",
      "local_date",
      "note",
    ],
    db.sessions.map((s) => [
      s.id,
      s.taskId ?? null,
      s.kind,
      s.status,
      s.plannedSeconds,
      s.actualSeconds,
      s.startedAt,
      s.endedAt ?? null,
      s.pausedTotalMs,
      s.interruptions,
      s.localDate,
      s.note ?? null,
    ]),
  );

  // day_entries.local_date 是 UNIQUE：用 INSERT OR REPLACE 同时化解 id / local_date 冲突
  await upsertRows(
    conn,
    "day_entries",
    [
      "id",
      "local_date",
      "mood",
      "tags",
      "journal_title",
      "journal_md",
      "is_backfilled",
      "created_at",
      "updated_at",
    ],
    [],
    db.dayEntries.map((e) => [
      e.id,
      e.localDate,
      e.mood ?? null,
      JSON.stringify(e.tags ?? []),
      e.journalTitle ?? null,
      e.journalMd,
      e.isBackfilled ? 1 : 0,
      e.createdAt,
      e.updatedAt,
    ]),
    "replace",
  );

  await upsertRows(
    conn,
    "reflections",
    ["id", "session_id", "local_date", "type", "content_md", "created_at"],
    ["session_id", "local_date", "type", "content_md", "created_at"],
    db.reflections.map((r) => [r.id, r.sessionId ?? null, r.localDate, r.type, r.contentMd, r.createdAt]),
  );

  await conn.execute(
    "INSERT INTO settings (key, value_json) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
    [SETTINGS_KEY, JSON.stringify(db.settings)],
  );

  // 2) 再删库里多余的行
  await deleteMissing(conn, "tasks", db.tasks.map((t) => t.id));
  await deleteMissing(conn, "focus_sessions", db.sessions.map((s) => s.id));
  await deleteMissing(conn, "day_entries", db.dayEntries.map((e) => e.id));
  await deleteMissing(conn, "reflections", db.reflections.map((r) => r.id));
}

async function upsertRows(
  conn: Database,
  table: string,
  columns: string[],
  updateColumns: string[],
  rows: unknown[][],
  mode: "upsert" | "replace" = "upsert",
): Promise<void> {
  if (rows.length === 0) return;
  // SQLite 默认最多 32766 个绑定参数，按列数限制每条语句的行数
  const perStatement = Math.max(1, Math.min(200, Math.floor(900 / columns.length)));
  for (let offset = 0; offset < rows.length; offset += perStatement) {
    const chunk = rows.slice(offset, offset + perStatement);
    const values: unknown[] = [];
    const tuples = chunk.map((row, rowIndex) => {
      const holders = row.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
      values.push(...row);
      return `(${holders.join(", ")})`;
    });
    const verb = mode === "replace" ? "INSERT OR REPLACE" : "INSERT";
    let sql = `${verb} INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")}`;
    if (mode === "upsert") {
      sql += ` ON CONFLICT(id) DO UPDATE SET ${updateColumns.map((c) => `${c} = excluded.${c}`).join(", ")}`;
    }
    await conn.execute(sql, values);
  }
}

/** 删除表里不在 id 集合中的行（先查出现有 id，再分批 DELETE） */
async function deleteMissing(conn: Database, table: string, ids: string[]): Promise<void> {
  const keep = new Set(ids);
  const existing = await conn.select<{ id: string }[]>(`SELECT id FROM ${table}`);
  const missing = existing.map((row) => row.id).filter((id) => !keep.has(id));
  const CHUNK = 200;
  for (let offset = 0; offset < missing.length; offset += CHUNK) {
    const chunk = missing.slice(offset, offset + CHUNK);
    const holders = chunk.map((_, index) => `$${index + 1}`).join(", ");
    await conn.execute(`DELETE FROM ${table} WHERE id IN (${holders})`, chunk);
  }
}
