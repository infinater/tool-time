import type { CSSProperties } from "react";
import { moodOf, type Mood } from "@/lib/types";
import { formatDateLabel, formatDuration } from "@/lib/utils";
import type { DayJournalState } from "./calendarUtils";
import "./calendar.css";

/** 预览卡片宽度 / 估算高度，DayCell 用它做视口翻转判断 */
export const TOOLTIP_WIDTH = 196;
export const TOOLTIP_HEIGHT = 124;
/** 悬停多久后浮出 */
export const HOVER_DELAY_MS = 180;

interface DayTooltipProps {
  date: string;
  focusSeconds: number;
  pomodoros: number;
  mood?: Mood;
  journal: DayJournalState;
  /** 贴着视口底部时向上展开 */
  up: boolean;
  /** 贴着视口右侧时改为右对齐 */
  alignRight: boolean;
}

/**
 * 悬停预览：绝对定位 + pointer-events-none，只展示已有数据行。
 * 翻转方向由父组件按格子视口坐标算好后传入。
 */
export default function DayTooltip({
  date,
  focusSeconds,
  pomodoros,
  mood,
  journal,
  up,
  alignRight,
}: DayTooltipProps) {
  const meta = moodOf(mood);
  const hasFocus = focusSeconds > 0 || pomodoros > 0;
  const horizontal = alignRight ? { right: 0 } : { left: 0 };
  const style: CSSProperties = up
    ? { bottom: "calc(100% + 6px)", ...horizontal }
    : { top: "calc(100% + 6px)", ...horizontal };

  return (
    <div
      role="tooltip"
      className="calendar-tooltip pointer-events-none absolute z-30 rounded-[10px] border border-[var(--c-line)] px-3 py-2.5"
      style={{
        ...style,
        width: TOOLTIP_WIDTH,
        background: "var(--c-surface)",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      <div className="whitespace-nowrap text-[12px] font-medium text-strong">{formatDateLabel(date)}</div>

      {hasFocus && (
        <div className="mt-1 whitespace-nowrap text-[11.5px] text-sub numeric">
          专注 {formatDuration(focusSeconds)} · {pomodoros} 个番茄
        </div>
      )}

      {meta && (
        <div className="mt-1 whitespace-nowrap text-[11.5px] text-sub">
          心情 {meta.emoji} {meta.label}
        </div>
      )}

      {journal !== "none" && (
        <div className="mt-1 whitespace-nowrap text-[11.5px] text-sub">
          日记 {journal === "archived" ? "已归档" : "草稿"}
        </div>
      )}
    </div>
  );
}
