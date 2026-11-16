import { memo, useEffect, useRef } from "react";
import { useData } from "@/lib/store";
import { useTimer } from "./timerStore";
import { useRemaining } from "./useRemaining";
import { cn, formatClock } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  work: "Focus",
  short_break: "Short break",
  long_break: "Long break",
};

const TICKS = Array.from({ length: 60 }, (_, i) => i);

/** 刻度单独 memo：只有"已走过多少格"变化时才重建 DOM */
const TickRing = memo(function TickRing({ done, color }: { done: number; color: string }) {
  return (
    <>
      {TICKS.map((i) => {
        const angle = (i / 60) * Math.PI * 2;
        const x1 = 130 + Math.cos(angle) * 116;
        const y1 = 130 + Math.sin(angle) * 116;
        const x2 = 130 + Math.cos(angle) * 120;
        const y2 = 130 + Math.sin(angle) * 120;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i < done ? color : "var(--c-line)"}
            strokeWidth={i % 5 === 0 ? 1.6 : 1}
            strokeLinecap="round"
            opacity={i < done ? 0.9 : 0.45}
          />
        );
      })}
    </>
  );
});

interface Props {
  /** 直径（px），内部按 260 的比例缩放 */
  px?: number;
  className?: string;
  /** 空闲时允许滚轮调整时长（±5 分钟） */
  wheelAdjustable?: boolean;
}

export default function TimerDial({ px = 260, className, wheelAdjustable = false }: Props) {
  const status = useTimer((s) => s.status);
  const kind = useTimer((s) => s.kind);
  const plannedSeconds = useTimer((s) => s.plannedSeconds);
  const override = useTimer((s) => s.workMinutesOverride);
  const settings = useData((s) => s.settings);
  const left = useRemaining(100);
  const wrapRef = useRef<HTMLDivElement>(null);

  const idleMinutes = override ?? settings.workMinutes;

  // 滚轮调时长：必须用非 passive 的原生监听，React 的 onWheel 不能 preventDefault
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !wheelAdjustable) return;

    const onWheel = (e: WheelEvent) => {
      const timer = useTimer.getState();
      if (timer.status !== "idle") return;
      e.preventDefault();
      const current = timer.workMinutesOverride ?? useData.getState().settings.workMinutes;
      const next = Math.min(180, Math.max(1, current + (e.deltaY < 0 ? 5 : -5)));
      timer.setWorkMinutes(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelAdjustable]);

  const total = plannedSeconds * 1000;
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 0;
  const isBreak = status !== "idle" && kind !== "work";
  const accent = isBreak ? "#5aa9a0" : "var(--c-accent)";
  const doneTicks = Math.round(progress * 60);

  const R_TRACK = 112;
  const R_PROGRESS = 104;
  const C = 2 * Math.PI * R_PROGRESS;

  return (
    <div
      ref={wrapRef}
      className={cn("relative shrink-0", status === "idle" && wheelAdjustable && "cursor-ns-resize", className)}
      style={{ width: px, height: px }}
      title={status === "idle" && wheelAdjustable ? "滚轮调整时长（±5 分钟）" : undefined}
    >
      <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90">
        <circle cx="130" cy="130" r="124" fill="none" stroke="var(--c-line)" strokeWidth="1" opacity="0.7" />
        <TickRing done={doneTicks} color={accent} />
        <circle cx="130" cy="130" r={R_TRACK} fill="none" stroke="var(--c-raised)" strokeWidth="12" />
        <circle
          cx="130"
          cy="130"
          r={R_PROGRESS}
          fill="none"
          stroke={accent}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          opacity={status === "paused" ? 0.4 : 1}
          style={{ transition: "stroke-dashoffset 140ms linear, opacity 180ms ease-out" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.4em]">
        <span className="uppercase tracking-[0.16em] text-muted" style={{ fontSize: Math.max(10, px * 0.04) }}>
          {status === "idle" ? "Ready" : KIND_LABEL[kind]}
        </span>
        <span
          className={cn(
            "numeric font-mono font-medium leading-none tabular-nums tracking-[-0.03em]",
            status === "paused" ? "text-sub" : "text-strong",
          )}
          style={{ fontSize: px * 0.177 }}
        >
          {formatClock(left)}
        </span>
        <span className="text-muted" style={{ fontSize: Math.max(11, px * 0.044) }}>
          {status === "paused" ? "已暂停" : status === "idle" ? `${idleMinutes} 分钟` : `${Math.round(plannedSeconds / 60)} 分钟`}
        </span>
      </div>
    </div>
  );
}
