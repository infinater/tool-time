/**
 * 系统事件桥：把 Rust 侧（全局快捷键 / 托盘）的事件接到计时器 store 上，
 * 并在番茄完成且窗口不在前台时发一条系统通知。
 *
 * 所有能力都只在 Tauri 里启用：浏览器（vite dev）环境下
 * `useSystemBridge` 不注册任何监听，`ensureNotificationPermission` /
 * `notifyFocusFinished` 直接返回，不会报错、也不会弹权限窗口。
 */
import { useEffect, useRef } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useTimer } from "@/features/timer/timerStore";
import { useData } from "@/lib/store";

/** 是否运行在 Tauri 容器里（v2 注入 __TAURI_INTERNALS__） */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 窗口是否在前台可见：document 可见且 Tauri 窗口未被隐藏/最小化 */
async function isWindowInForeground(): Promise<boolean> {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  try {
    const visible = await getCurrentWindow().isVisible();
    const focused = await getCurrentWindow().isFocused();
    return visible && focused;
  } catch {
    return true; // 查询失败就当作在前台，宁可不打扰
  }
}

/** 把主窗口显示出来并聚焦；前端兜底，Rust 侧通常已经做过 */
async function bringWindowToFront(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();
  } catch (err) {
    console.warn("[system] 显示窗口失败", err);
  }
}

/** 当前任务标题（拿不到就 undefined，通知里不显示任务名） */
function taskTitleOf(taskId: string | null): string | undefined {
  if (!taskId) return undefined;
  try {
    return useData.getState().tasks.find((t) => t.id === taskId)?.title;
  } catch {
    return undefined;
  }
}

/** 快捷键 / 托盘共用的计时器开关 */
function toggleTimer(): void {
  const timer = useTimer.getState();
  if (timer.status === "running") timer.pause();
  else if (timer.status === "paused") timer.resume();
  else timer.startWork(timer.taskId);
}

/** 番茄完成后的通知：只在窗口不前台时发 */
async function announceFinish(plannedSeconds: number, taskId: string | null): Promise<void> {
  try {
    if (!isTauri()) return;
    if (await isWindowInForeground()) return;
    const minutes = Math.max(1, Math.round(plannedSeconds / 60));
    await notifyFocusFinished(minutes, taskTitleOf(taskId));
  } catch (err) {
    console.warn("[system] 完成通知失败", err);
  }
}

/**
 * 挂载系统事件桥，App 里调用一次即可。
 * 用 ref 防止 StrictMode / 重复渲染造成重复注册，卸载时统一 unlisten。
 */
export function useSystemBridge(): void {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    if (!isTauri()) return; // 浏览器环境：完全不注册任何东西
    mountedRef.current = true;

    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const track = (pending: Promise<UnlistenFn>) => {
      pending
        .then((fn) => {
          if (disposed) fn();
          else unlisteners.push(fn);
        })
        .catch((err) => console.warn("[system] 事件监听失败", err));
    };

    void import("@tauri-apps/api/event").then(({ listen }) => {
      if (disposed) return;
      try {
        track(listen("shortcut:toggle-timer", toggleTimer));
        track(listen("tray:toggle-timer", toggleTimer));
        track(
          listen("tray:open-today", () => {
            void bringWindowToFront();
            window.location.hash = "#/"; // 回到"今天"页（HashRouter）
          }),
        );
        track(
          listen("shortcut:open-window", () => {
            void bringWindowToFront();
          }),
        );
      } catch (err) {
        console.warn("[system] 注册事件失败", err);
      }
    });

    // 番茄完成 → flash +1（只有 work 结束会 +1），据此发通知
    let lastFlash = useTimer.getState().flash;
    const unsubscribe = useTimer.subscribe((state) => {
      if (state.flash === lastFlash) return;
      lastFlash = state.flash;
      void announceFinish(state.plannedSeconds, state.taskId);
    });

    return () => {
      disposed = true;
      mountedRef.current = false;
      unsubscribe();
      for (const unlisten of unlisteners.splice(0)) {
        try {
          unlisten();
        } catch {
          /* 忽略重复 unlisten */
        }
      }
    };
  }, []);
}

/** 确保拿到了通知权限；未授予会尝试申请一次 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch (err) {
    console.warn("[system] 通知权限检查失败", err);
    return false;
  }
}

/** 番茄完成通知：标题固定，正文带时长（有任务名时用「任务 · 25 分钟」） */
export async function notifyFocusFinished(minutes: number, taskTitle?: string): Promise<void> {
  if (!isTauri()) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 25;
  const title = taskTitle?.trim();
  const body = title ? `${title} · ${safeMinutes} 分钟` : `${safeMinutes} 分钟专注结束，记一下感想？`;

  try {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({ title: "番茄完成了", body });
  } catch (err) {
    console.warn("[system] 发送通知失败", err);
  }
}
