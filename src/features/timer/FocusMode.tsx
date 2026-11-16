import { useEffect, useState } from "react";
import { Maximize, Minimize, Pause, Play, Plus, SkipForward, Square, X } from "lucide-react";
import { useData } from "@/lib/store";
import { pomodorosOn } from "@/lib/selectors";
import { cn, formatDuration, localDateOf } from "@/lib/utils";
import { useTimer } from "./timerStore";
import TimerDial from "./TimerDial";

function useDialSize(): number {
  const compute = () => Math.round(Math.min(460, Math.max(300, window.innerHeight * 0.52)));
  const [size, setSize] = useState(compute);

  useEffect(() => {
    const onResize = () => setSize(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

export default function FocusMode() {
  const focusMode = useTimer((s) => s.focusMode);
  const status = useTimer((s) => s.status);
  const taskId = useTimer((s) => s.taskId);
  const pause = useTimer((s) => s.pause);
  const resume = useTimer((s) => s.resume);
  const skip = useTimer((s) => s.skip);
  const abort = useTimer((s) => s.abort);
  const closeFocusMode = useTimer((s) => s.closeFocusMode);
  const startWork = useTimer((s) => s.startWork);
  const extend = useTimer((s) => s.extend);
  const override = useTimer((s) => s.workMinutesOverride);
  const setWorkMinutes = useTimer((s) => s.setWorkMinutes);

  const tasks = useData((s) => s.tasks);
  const sessions = useData((s) => s.sessions);
  const settings = useData((s) => s.settings);

  const [fullscreen, setFullscreen] = useState(false);
  const dialSize = useDialSize();
  const today = localDateOf();
  const done = pomodorosOn({ sessions }, today);
  const task = tasks.find((t) => t.id === taskId);

  // 退出专注模式时同步退出系统全屏
  useEffect(() => {
    if (!focusMode && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFocusMode();
      } else if (e.code === "Space") {
        e.preventDefault();
        if (status === "running") pause();
        else if (status === "paused") resume();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, status, pause, resume, closeFocusMode]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch {
      /* 用户拒绝或环境不支持，忽略 */
    }
  };

  if (!focusMode) return null;

  return (
    <div className="focus-in fixed inset-0 z-40 flex flex-col" style={{ background: "var(--c-bg)" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--c-accent) 9%, transparent) 0%, transparent 58%)",
        }}
      />

      <header className="relative flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2.5">
          <span className="chip">{status === "idle" ? "专注模式" : task ? task.title : "自由专注"}</span>
          {task && <span className="text-[11.5px] text-muted">正在专注这个任务</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost px-2 py-1.5"
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? "退出全屏（F）" : "全屏（F）"}
          >
            {fullscreen ? <Minimize size={15} strokeWidth={1.75} /> : <Maximize size={15} strokeWidth={1.75} />}
          </button>
          <button className="btn-ghost px-2 py-1.5" onClick={closeFocusMode} title="退出专注模式（Esc）">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center gap-8 pb-10">
        <TimerDial px={dialSize} wheelAdjustable />

        {status === "idle" && (
          <div className="flex items-center gap-1">
            {[15, 25, 45].map((m) => (
              <button
                key={m}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setWorkMinutes(m);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] transition-colors",
                  (override ?? settings.workMinutes) === m
                    ? "bg-[var(--c-raised)] text-strong"
                    : "text-sub hover:bg-[var(--c-elevated)] hover:text-ink",
                )}
              >
                {m} 分
              </button>
            ))}
            <span className="ml-2 text-[11.5px] text-muted">滚轮微调 ±5 分</span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          {status === "idle" && (
            <button
              className="btn-primary px-7 py-3"
              onClick={(e) => {
                e.currentTarget.blur();
                startWork(taskId);
              }}
            >
              <Play size={16} /> 开始专注
            </button>
          )}

          {status === "running" && (
            <>
              <button
                className="btn-soft px-6 py-3"
                onClick={(e) => {
                  e.currentTarget.blur();
                  pause();
                }}
              >
                <Pause size={16} /> 暂停
              </button>
              <button
                className="btn-ghost"
                onClick={(e) => {
                  e.currentTarget.blur();
                  extend(300);
                }}
                title="延长 5 分钟"
              >
                <Plus size={15} /> 5 分
              </button>
              <button
                className="btn-ghost"
                onClick={(e) => {
                  e.currentTarget.blur();
                  skip();
                }}
              >
                <SkipForward size={15} /> 跳过
              </button>
              <button
                className="btn-ghost hover:text-accent"
                onClick={(e) => {
                  e.currentTarget.blur();
                  abort();
                }}
              >
                <Square size={13} /> 放弃
              </button>
            </>
          )}

          {status === "paused" && (
            <>
              <button
                className="btn-primary px-6 py-3"
                onClick={(e) => {
                  e.currentTarget.blur();
                  resume();
                }}
              >
                <Play size={16} /> 继续
              </button>
              <button
                className="btn-ghost hover:text-accent"
                onClick={(e) => {
                  e.currentTarget.blur();
                  abort();
                }}
              >
                <Square size={13} /> 放弃
              </button>
            </>
          )}
        </div>

        <div className="text-[12px] text-muted">
          <kbd className="font-mono">Esc</kbd> 退出 · <kbd className="font-mono">Space</kbd> 暂停/继续 ·{" "}
          <kbd className="font-mono">F</kbd> 全屏
        </div>
      </main>

      <footer className="relative flex items-center justify-center gap-5 px-8 pb-8 text-[11.5px] text-muted">
        <span className="numeric">
          今天 {done} 个番茄 · {formatDuration(done * settings.workMinutes * 60)}
        </span>
        <span className="flex items-center gap-1.5">
          {Array.from({ length: settings.longBreakEvery }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < done % settings.longBreakEvery ? "bg-[var(--c-accent)]" : "bg-[var(--c-raised)]",
              )}
            />
          ))}
        </span>
      </footer>
    </div>
  );
}
