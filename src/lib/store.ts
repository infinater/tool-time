import { create } from "zustand";
import { isTauri, loadSnapshot, saveSnapshot } from "./db";
import type {
  DBShape,
  DayEntry,
  FocusSession,
  JournalStatus,
  Mood,
  Reflection,
  Settings,
  Task,
} from "./types";
import { localDateOf, uid } from "./utils";

const STORAGE_KEY = "tool-time.db.v1";
/** 数据结构版本（与 SQLite 迁移版本对齐：v2 = 心情 + 日记归档） */
const SCHEMA_VERSION = 2;

export const defaultSettings: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreak: false,
  sound: true,
  theme: "dark",
  weekStartsOn: 1,
  dailyGoalMinutes: 120,
  moodStyle: "color",
  journalSerif: false,
  autoFocusMode: true,
  workMinutesDraft: null,
};

export function emptyDB(): DBShape {
  return {
    version: SCHEMA_VERSION,
    tasks: [],
    sessions: [],
    dayEntries: [],
    reflections: [],
    settings: { ...defaultSettings },
  };
}


function readDB(): DBShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as Partial<DBShape>;
    return {
      ...emptyDB(),
      ...parsed,
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return emptyDB();
  }
}

function writeDB(db: DBShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* 忽略配额错误 */
  }
}

/**
 * 统一持久化入口：
 * - 非 Tauri（浏览器 dev）继续写 localStorage；
 * - Tauri 下额外把整快照交给 SQLite（fire-and-forget，db.ts 内部串行化）。
 */
function persist(db: DBShape) {
  writeDB(db);
  if (isTauri()) void saveSnapshot(db);
}

/** 把任意来源的快照补齐成完整 DBShape（settings 与默认值合并） */
function normalizeDB(raw: Partial<DBShape>): DBShape {
  return {
    ...emptyDB(),
    ...raw,
    settings: { ...defaultSettings, ...(raw.settings ?? {}) },
  };
}

function core(state: DBShape): DBShape {
  return {
    version: state.version,
    tasks: state.tasks,
    sessions: state.sessions,
    dayEntries: state.dayEntries,
    reflections: state.reflections,
    settings: state.settings,
  };
}

interface DataActions {
  /** Tauri 下从 SQLite 载入快照；无数据则把当前内存数据写入数据库完成初始化 */
  hydrate: () => Promise<void>;
  addSession: (session: FocusSession) => void;
  updateSession: (id: string, patch: Partial<FocusSession>) => void;
  ensureDay: (date: string) => DayEntry;
  setMood: (date: string, mood: Mood | undefined) => void;
  /** 给某次专注写心情（结束面板用） */
  setSessionMood: (id: string, mood: Mood) => void;
  removeSession: (id: string) => void;
  putBackSession: (session: FocusSession) => void;
  archiveJournal: (date: string) => void;
  reopenJournal: (date: string) => void;
  setJournalStatus: (date: string, status: JournalStatus) => void;
  removeDayEntry: (date: string) => void;
  putBackDayEntry: (entry: DayEntry) => void;
  /** 清空区间内的专注 / 日记 / 感想（端点包含） */
  clearRange: (fromDate: string, toDate: string) => void;
  updateJournal: (date: string, patch: Partial<Pick<DayEntry, "journalMd" | "journalTitle" | "tags">>) => void;
  addReflection: (input: { date: string; type: Reflection["type"]; contentMd: string; sessionId?: string }) => void;
  addTask: (title: string, estPomodoros?: number) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
  resetAll: () => void;
}

export type DataStore = DBShape & DataActions;

export const useData = create<DataStore>((set, get) => {
  const initial = readDB();
  return {
    ...initial,

    hydrate: async () => {
      if (!isTauri()) return;
      // 首帧仍用 readDB() 的初始值（避免空白），这里再替换为 SQLite 里的真实数据
      const snapshot = await loadSnapshot();
      if (!snapshot) {
        // 空库：把当前内存数据写一次，完成数据库初始化
        await saveSnapshot(core(get()));
        return;
      }
      const next = normalizeDB(snapshot);
      writeDB(next); // 顺带镜像到 localStorage，浏览器 dev / 回退时可用
      set(next);
    },

    addSession: (session) =>
      set((state) => {
        const next = { ...core(state), sessions: [session, ...state.sessions] };
        persist(next);
        return next;
      }),

    updateSession: (id, patch) =>
      set((state) => {
        const next = {
          ...core(state),
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        };
        persist(next);
        return next;
      }),

    ensureDay: (date) => {
      const existing = get().dayEntries.find((e) => e.localDate === date);
      if (existing) return existing;
      const now = Date.now();
      const entry: DayEntry = {
        id: uid(),
        localDate: date,
        tags: [],
        journalMd: "",
        status: "draft",
        isBackfilled: date < localDateOf(),
        createdAt: now,
        updatedAt: now,
      };
      set((state) => {
        const next = { ...core(state), dayEntries: [...state.dayEntries, entry] };
        persist(next);
        return next;
      });
      return entry;
    },

    setMood: (date, mood) =>
      set((state) => {
        const now = Date.now();
        const exists = state.dayEntries.some((e) => e.localDate === date);
        const dayEntries = exists
          ? state.dayEntries.map((e) => (e.localDate === date ? { ...e, mood, updatedAt: now } : e))
          : [
              ...state.dayEntries,
              {
                id: uid(),
                localDate: date,
                mood,
                tags: [],
                journalMd: "",
                status: "draft" as JournalStatus,
                isBackfilled: date < localDateOf(),
                createdAt: now,
                updatedAt: now,
              },
            ];
        const next = { ...core(state), dayEntries };
        persist(next);
        return next;
      }),

    updateJournal: (date, patch) =>
      set((state) => {
        const now = Date.now();
        const exists = state.dayEntries.some((e) => e.localDate === date);
        const dayEntries = exists
          ? state.dayEntries.map((e) => (e.localDate === date ? { ...e, ...patch, updatedAt: now } : e))
          : [
              ...state.dayEntries,
              {
                id: uid(),
                localDate: date,
                tags: [],
                journalMd: "",
                status: "draft" as JournalStatus,
                isBackfilled: date < localDateOf(),
                createdAt: now,
                updatedAt: now,
                ...patch,
              },
            ];
        const next = { ...core(state), dayEntries };
        persist(next);
        return next;
      }),

    setSessionMood: (id, mood) =>
      set((state) => {
        const next = {
          ...core(state),
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, moodAfter: mood } : s)),
        };
        persist(next);
        return next;
      }),

    removeSession: (id) =>
      set((state) => {
        const next = { ...core(state), sessions: state.sessions.filter((s) => s.id !== id) };
        persist(next);
        return next;
      }),

    putBackSession: (session) =>
      set((state) => {
        if (state.sessions.some((s) => s.id === session.id)) return state;
        const next = { ...core(state), sessions: [session, ...state.sessions] };
        persist(next);
        return next;
      }),

    archiveJournal: (date) => {
      get().ensureDay(date);
      const now = Date.now();
      set((state) => {
        const next = {
          ...core(state),
          dayEntries: state.dayEntries.map((e) =>
            e.localDate === date ? { ...e, status: "archived" as JournalStatus, archivedAt: now, updatedAt: now } : e,
          ),
        };
        persist(next);
        return next;
      });
    },

    reopenJournal: (date) =>
      set((state) => {
        const now = Date.now();
        const next = {
          ...core(state),
          dayEntries: state.dayEntries.map((e) =>
            e.localDate === date ? { ...e, status: "draft" as JournalStatus, updatedAt: now } : e,
          ),
        };
        persist(next);
        return next;
      }),

    setJournalStatus: (date, status) => {
      if (status === "archived") {
        get().archiveJournal(date);
        return;
      }
      get().reopenJournal(date);
    },

    removeDayEntry: (date) =>
      set((state) => {
        const next = { ...core(state), dayEntries: state.dayEntries.filter((e) => e.localDate !== date) };
        persist(next);
        return next;
      }),

    putBackDayEntry: (entry) =>
      set((state) => {
        if (state.dayEntries.some((e) => e.localDate === entry.localDate)) return state;
        const next = { ...core(state), dayEntries: [...state.dayEntries, entry] };
        persist(next);
        return next;
      }),

    clearRange: (fromDate, toDate) =>
      set((state) => {
        const inRange = (date: string) => date >= fromDate && date <= toDate;
        const next = {
          ...core(state),
          sessions: state.sessions.filter((s) => !inRange(s.localDate)),
          dayEntries: state.dayEntries.filter((e) => !inRange(e.localDate)),
          reflections: state.reflections.filter((r) => !inRange(r.localDate)),
        };
        persist(next);
        return next;
      }),

    addReflection: ({ date, type, contentMd, sessionId }) =>
      set((state) => {
        const reflection: Reflection = {
          id: uid(),
          localDate: date,
          type,
          contentMd,
          sessionId,
          createdAt: Date.now(),
        };
        const next = { ...core(state), reflections: [reflection, ...state.reflections] };
        persist(next);
        return next;
      }),

    addTask: (title, estPomodoros = 1) =>
      set((state) => {
        const trimmed = title.trim();
        if (!trimmed) return state;
        const task: Task = { id: uid(), title: trimmed, status: "todo", estPomodoros, createdAt: Date.now() };
        const next = { ...core(state), tasks: [...state.tasks, task] };
        persist(next);
        return next;
      }),

    toggleTask: (id) =>
      set((state) => {
        const next = {
          ...core(state),
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: t.status === "todo" ? ("done" as const) : ("todo" as const) } : t,
          ),
        };
        persist(next);
        return next;
      }),

    removeTask: (id) =>
      set((state) => {
        const next = { ...core(state), tasks: state.tasks.filter((t) => t.id !== id) };
        persist(next);
        return next;
      }),

    updateSettings: (patch) =>
      set((state) => {
        const next = { ...core(state), settings: { ...state.settings, ...patch } };
        persist(next);
        return next;
      }),

    exportJSON: () => JSON.stringify(core(get()), null, 2),

    importJSON: (json) => {
      try {
        const parsed = JSON.parse(json) as Partial<DBShape>;
        if (!parsed || !Array.isArray(parsed.sessions)) return false;
        const next: DBShape = {
          ...emptyDB(),
          ...parsed,
          settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
        };
        persist(next);
        set(next);
        return true;
      } catch {
        return false;
      }
    },

    resetAll: () => {
      const next = emptyDB();
      localStorage.removeItem(STORAGE_KEY);
      writeDB(next);
      // Tauri：saveSnapshot 会 upsert 空/种子快照并删掉库里多余的旧行（等效清表）
      if (isTauri()) void saveSnapshot(next);
      set(next);
    },
  };
});