import { useEffect, useState } from "react";
import { Maximize, Minimize, Pause, Play, Plus, SkipForward, Square, X } from "lucide-react";
import { useData } from "@/lib/store";
import { pomodorosOn } from "@/lib/selectors";
import { cn, formatDuration, localDateOf } from "@/lib/utils";
import QuoteRotator from "@/features/quotes/QuoteRotator";
import { useTimer } from "./timerStore";
import TimerDial from "./TimerDial";

/** 布局断点：窄于此宽或矮于此高时改为单列堆叠 */
const STACK_BREAKPOINT_W = 1100;
const STACK_BREAKPOINT_H = 700;

/** 表盘直径：宽高同时约束，避免竖屏或小窗时纵向溢出 */
function dialSizeFor(width: number, height: number): number {
  return Math.round(Math.min(860, Math.max(320, Math.min(width * 0.62, height * 0.78))));
}

function useDialSize(): number {
  const [size, setSize] = useState(() => dialSizeFor(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setSize(dialSizeFor(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

/** 窄屏 / 矮窗：单列堆叠，名言区挪到表盘下方并切 compact */
function useStackedLayout(): boolean {
  const compute = () => window.innerWidth < STACK_BREAKPOINT_W || window.innerHeight < STACK_BREAKPOINT_H;
  const [stacked, setStacked] = useState(compute);

  useEffect(() => {
    const onResize = () => setStacked(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return stacked;
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
  const stacked = useStackedLayout();
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

  const progressDots = Array.from({ length: settings.longBreakEvery }).map((_, i) => (
    <span
      key={i}
      className={cn(
        "h-2 w-2 rounded-[2px] transition-colors",
        i < done % settings.longBreakEvery ? "bg-[var(--c-accent)]" : "bg-[var(--c-raised)]",
      )}
    />
  ));

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

      {/* 宽屏：左表盘 + 右 360px 信息区；窄屏 / 矮窗：单列，名言区落到表盘下方 */}
      <main
        className={cn(
          "relative flex-1 px-8",
          stacked ? "flex flex-col items-center gap-7 overflow-y-auto pb-8" : "grid items-center gap-10 pb-6",
        )}
        style={stacked ? undefined : { gridTemplateColumns: "1fr 360px" }}
      >
        <section className={cn("flex flex-col items-center", stacked ? "gap-5" : "gap-3")}>
          <TimerDial px={dialSize} wheelAdjustable glow />

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
        </section>

        <aside
          className={cn(
            "flex flex-col",
            stacked ? "w-full max-w-[560px] items-center gap-6 pb-2" : "w-[360px] justify-center gap-8 self-stretch py-10",
          )}
        >
          {/* 顶部：今日进度点 + 番茄数 */}
          <div className={cn("flex flex-col gap-3", stacked && "items-center text-center")}>
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted">今日</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">{progressDots}</span>
              <span className="numeric text-[12.5px] text-sub">今天 {done} 个番茄</span>
            </div>
          </div>

          {/* 中部：名言轮播，窄屏用 compact */}
          <div className={cn("w-full", !stacked && "flex flex-1 items-center")}>
            <QuoteRotator compact={stacked} className="w-full" />
          </div>

          {/* 底部：今日累计时长 */}
          <div className="numeric text-[12px] text-muted">
            今天 {done} 个番茄 · {formatDuration(done * settings.workMinutes * 60)}
          </div>
        </aside>
      </main>
    </div>
  );
}
