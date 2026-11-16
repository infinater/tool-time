import { useState } from "react";
import { Pause, Play, Plus, RotateCcw, SkipForward, Square } from "lucide-react";
import { useData } from "@/lib/store";
import { pomodorosOn } from "@/lib/selectors";
import { cn, localDateOf } from "@/lib/utils";
import { useTimer } from "./timerStore";
import TimerDial from "./TimerDial";

const PRESETS = [15, 25, 45];

export default function RingTimer({ taskId = null }: { taskId?: string | null }) {
  const status = useTimer((s) => s.status);
  const kind = useTimer((s) => s.kind);
  const flash = useTimer((s) => s.flash);
  const override = useTimer((s) => s.workMinutesOverride);
  const setWorkMinutes = useTimer((s) => s.setWorkMinutes);
  const startWork = useTimer((s) => s.startWork);
  const startBreak = useTimer((s) => s.startBreak);
  const pause = useTimer((s) => s.pause);
  const resume = useTimer((s) => s.resume);
  const extend = useTimer((s) => s.extend);
  const abort = useTimer((s) => s.abort);
  const skip = useTimer((s) => s.skip);

  const settings = useData((s) => s.settings);
  const sessions = useData((s) => s.sessions);

  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState(30);

  const isBreak = status !== "idle" && kind !== "work";
  const running = status === "running";
  const accent = isBreak ? "#5aa9a0" : "var(--c-accent)";
  const current = override ?? settings.workMinutes;
  const doneToday = pomodorosOn({ sessions }, localDateOf());
  const longBreakDue = doneToday > 0 && doneToday % settings.longBreakEvery === 0;

  const applyCustom = () => {
    const v = Math.round(custom);
    if (!Number.isFinite(v)) return;
    setWorkMinutes(Math.min(180, Math.max(1, v)));
    setCustomOpen(false);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div key={flash} className={cn("relative", flash > 0 && status === "idle" && "ring-flash")}>
        {running && (
          <div
            className="ring-breath pointer-events-none absolute inset-2 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 68%)`, opacity: 0.18 }}
          />
        )}
        <TimerDial px={260} wheelAdjustable />
      </div>

      {status === "idle" && (
        <div className="flex items-center gap-1">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => {
                setWorkMinutes(m);
                setCustomOpen(false);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] transition-colors",
                current === m ? "bg-[var(--c-raised)] text-strong" : "text-sub hover:bg-elevated hover:text-ink",
              )}
            >
              {m} 分
            </button>
          ))}

          {customOpen ? (
            <span className="ml-1 flex items-center gap-1">
              <input
                type="number"
                autoFocus
                min={1}
                max={180}
                value={custom}
                onChange={(e) => setCustom(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCustom();
                  if (e.key === "Escape") setCustomOpen(false);
                }}
                className="input h-7 w-[62px] px-2 py-0 text-center text-[12px] numeric"
              />
              <button className="rounded-full px-2 py-1 text-[12px] text-sub hover:bg-elevated" onClick={applyCustom}>
                确定
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setCustom(custom || current);
                setCustomOpen(true);
              }}
              className={cn(
                "ml-1 rounded-full px-3 py-1 text-[12px] transition-colors",
                !PRESETS.includes(current) ? "bg-[var(--c-raised)] text-strong" : "text-sub hover:bg-elevated hover:text-ink",
              )}
            >
              {!PRESETS.includes(current) ? `${current} 分 · 自定义` : "自定义"}
            </button>
          )}

          {override !== null && (
            <button
              onClick={() => setWorkMinutes(null)}
              className="ml-1 rounded-full px-2 py-1 text-[11.5px] text-muted hover:text-ink"
              title="恢复为设置里的默认时长"
            >
              恢复默认
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {status === "idle" && (
          <>
            <button className="btn-primary px-6 py-2.5" onClick={() => startWork(taskId)}>
              <Play size={15} /> 开始专注
            </button>
            {longBreakDue ? (
              <button className="btn-soft" onClick={() => startBreak("long")}>
                长休息 {settings.longBreakMinutes} 分
              </button>
            ) : (
              <button className="btn-soft" onClick={() => startBreak("short")}>
                休息 {settings.shortBreakMinutes} 分
              </button>
            )}
          </>
        )}

        {status === "running" && (
          <>
            <button className="btn-soft px-5 py-2.5" onClick={pause}>
              <Pause size={15} /> 暂停
            </button>
            <button className="btn-ghost" onClick={() => extend(300)} title="延长 5 分钟">
              <Plus size={14} /> 5 分
            </button>
            <button className="btn-ghost" onClick={skip} title="跳过本段">
              <SkipForward size={15} /> 跳过
            </button>
            <button className="btn-ghost hover:text-accent" onClick={abort} title="放弃本次">
              <Square size={13} /> 放弃
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button className="btn-primary px-5 py-2.5" onClick={resume}>
              <Play size={15} /> 继续
            </button>
            <button className="btn-ghost" onClick={() => extend(300)} title="延长 5 分钟">
              <Plus size={14} /> 5 分
            </button>
            <button className="btn-ghost hover:text-accent" onClick={abort}>
              <RotateCcw size={13} /> 放弃
            </button>
          </>
        )}
      </div>
    </div>
  );
}
