import { create } from "zustand";
import { useData } from "@/lib/store";
import type { SessionKind } from "@/lib/types";
import { localDateOf, uid } from "@/lib/utils";

type TimerStatus = "idle" | "running" | "paused";

interface TimerState {
  status: TimerStatus;
  kind: SessionKind;
  plannedSeconds: number;
  startedAt: number | null;
  pausedTotalMs: number;
  pausedAt: number | null;
  sessionId: string | null;
  taskId: string | null;
  showFinish: boolean;
  lastKind: SessionKind | null;
  /** 每完成一次番茄 +1，用于触发圆环闪一下 */
  flash: number;
  /** 刚完成的 session id（结束面板写心情用） */
  lastSessionId: string | null;
  /** 专注模式（放大界面，只留计时） */
  focusMode: boolean;
  openFocusMode: () => void;
  closeFocusMode: () => void;
  /** 本次专注时长覆盖（null = 跟随设置） */
  workMinutesOverride: number | null;
  setWorkMinutes: (minutes: number | null) => void;
  startWork: (taskId?: string | null) => void;
  startBreak: (kind: "short" | "long") => void;
  /** 超长专注的开始前确认 */
  pendingConfirm: { taskId: string | null; minutes: number } | null;
  confirmStart: () => void;
  cancelStart: () => void;
  start: (kind: SessionKind, seconds: number, taskId?: string | null) => void;
  pause: () => void;
  resume: () => void;
  abort: () => void;
  skip: () => void;
  extend: (seconds: number) => void;
  tick: (now: number) => void;
  closeFinish: () => void;
}

function beep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
    osc.onended = () => void ctx.close();
  } catch {
    /* 静默失败 */
  }
}

type RemainingInput = Pick<TimerState, "status" | "plannedSeconds" | "startedAt" | "pausedTotalMs" | "pausedAt">;

/** 防抖写入"上次选择的时长"，避免滚轮连续调整时频繁写 localStorage */
let draftTimer: number | null = null;
function persistDraft(minutes: number | null) {
  if (typeof window === "undefined") return;
  if (draftTimer !== null) window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(() => {
    draftTimer = null;
    useData.getState().updateSettings({ workMinutesDraft: minutes });
  }, 200);
}

/** 剩余毫秒：永远由时间戳推导，不做累加 */
export function remainingMs(state: RemainingInput, now: number): number {
  if (state.status === "idle" || state.startedAt === null) return state.plannedSeconds * 1000;
  const reference = state.status === "paused" && state.pausedAt !== null ? state.pausedAt : now;
  const elapsed = reference - state.startedAt - state.pausedTotalMs;
  return Math.max(0, state.plannedSeconds * 1000 - elapsed);
}

export const useTimer = create<TimerState>((set, get) => ({
  status: "idle",
  kind: "work",
  plannedSeconds: 25 * 60,
  startedAt: null,
  pausedTotalMs: 0,
  pausedAt: null,
  sessionId: null,
  taskId: null,
  showFinish: false,
  lastKind: null,
  flash: 0,
  lastSessionId: null,
  focusMode: false,
  workMinutesOverride: null,
  pendingConfirm: null,

  start: (kind, seconds, taskId = null) => {
    const id = uid();
    const startedAt = Date.now();
    useData.getState().addSession({
      id,
      kind,
      status: "running",
      plannedSeconds: seconds,
      actualSeconds: 0,
      startedAt,
      pausedTotalMs: 0,
      interruptions: 0,
      localDate: localDateOf(startedAt),
      taskId: taskId ?? undefined,
    });
    set({
      status: "running",
      kind,
      plannedSeconds: seconds,
      startedAt,
      pausedTotalMs: 0,
      pausedAt: null,
      sessionId: id,
      taskId,
      showFinish: false,
      focusMode: kind === "work" ? useData.getState().settings.autoFocusMode : false,
    });
  },

  pause: () => {
    const { status, sessionId } = get();
    if (status !== "running") return;
    set({ status: "paused", pausedAt: Date.now() });
    if (sessionId) {
      const session = useData.getState().sessions.find((s) => s.id === sessionId);
      useData.getState().updateSession(sessionId, { interruptions: (session?.interruptions ?? 0) + 1 });
    }
  },

  resume: () => {
    const { status, pausedAt, pausedTotalMs } = get();
    if (status !== "paused" || pausedAt === null) return;
    set({ status: "running", pausedTotalMs: pausedTotalMs + (Date.now() - pausedAt), pausedAt: null });
  },

  abort: () => {
    const { sessionId, startedAt, pausedTotalMs } = get();
    if (sessionId && startedAt) {
      useData.getState().updateSession(sessionId, {
        status: "aborted",
        endedAt: Date.now(),
        actualSeconds: Math.max(0, Math.round((Date.now() - startedAt - pausedTotalMs) / 1000)),
      });
    }
    set({ status: "idle", startedAt: null, pausedAt: null, pausedTotalMs: 0, sessionId: null, showFinish: false, focusMode: false });
  },

  skip: () => {
    const { sessionId, startedAt, pausedTotalMs, kind } = get();
    if (sessionId && startedAt) {
      useData.getState().updateSession(sessionId, {
        status: "skipped",
        endedAt: Date.now(),
        actualSeconds: Math.max(0, Math.round((Date.now() - startedAt - pausedTotalMs) / 1000)),
      });
    }
    set({ status: "idle", startedAt: null, pausedAt: null, pausedTotalMs: 0, sessionId: null, lastKind: kind, focusMode: false });
  },

  extend: (seconds) => {
    const { plannedSeconds, sessionId } = get();
    const next = Math.max(60, plannedSeconds + seconds);
    set({ plannedSeconds: next });
    if (sessionId) useData.getState().updateSession(sessionId, { plannedSeconds: next });
  },

  /** 只负责结算，不写渲染状态；渲染由 useRemaining 自己按 rAF/interval 推导 */
  tick: (now) => {
    const state = get();
    if (state.status !== "running") return;
    if (remainingMs(state, now) > 0) return;

    const { sessionId, startedAt, pausedTotalMs, plannedSeconds, kind } = state;
    if (sessionId && startedAt) {
      useData.getState().updateSession(sessionId, {
        status: "completed",
        endedAt: startedAt + pausedTotalMs + plannedSeconds * 1000,
        actualSeconds: plannedSeconds,
      });
    }
    if (useData.getState().settings.sound) beep();
    set({
      status: "idle",
      startedAt: null,
      pausedAt: null,
      pausedTotalMs: 0,
      showFinish: kind === "work",
      lastKind: kind,
      sessionId: null,
      lastSessionId: sessionId,
      flash: kind === "work" ? state.flash + 1 : state.flash,
      focusMode: false,
    });
  },

  closeFinish: () => set({ showFinish: false }),
  openFocusMode: () => set({ focusMode: true }),
  closeFocusMode: () => set({ focusMode: false }),

  setWorkMinutes: (minutes) => {
    set({ workMinutesOverride: minutes });
    persistDraft(minutes);
  },

  startWork: (taskId = null) => {
    const settings = useData.getState().settings;
    const minutes = get().workMinutesOverride ?? settings.workMinutes;
    // 超过 90 分钟先确认：记录里仍然只算 1 个番茄
    if (minutes > 90) {
      set({ pendingConfirm: { taskId, minutes } });
      return;
    }
    get().start("work", Math.max(1, Math.round(minutes)) * 60, taskId);
  },

  confirmStart: () => {
    const pending = get().pendingConfirm;
    if (!pending) return;
    set({ pendingConfirm: null });
    get().start("work", Math.max(1, Math.round(pending.minutes)) * 60, pending.taskId);
  },

  cancelStart: () => set({ pendingConfirm: null }),

  startBreak: (kind) => {
    const settings = useData.getState().settings;
    const minutes = kind === "long" ? settings.longBreakMinutes : settings.shortBreakMinutes;
    get().start(kind === "long" ? "long_break" : "short_break", Math.max(1, minutes) * 60);
  },
}));
