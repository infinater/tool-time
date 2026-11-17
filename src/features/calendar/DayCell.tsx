import { useEffect, useRef, useState } from "react";
import { moodOf, type Mood } from "@/lib/types";
import type { HeatLevel } from "@/lib/selectors";
import { cn, formatDateLabel } from "@/lib/utils";
import DayTooltip, { HOVER_DELAY_MS, TOOLTIP_HEIGHT, TOOLTIP_WIDTH } from "./DayTooltip";
import type { DayJournalState } from "./calendarUtils";
import "./calendar.css";

/** 心情点沿用日历原有配色（比 MoodPicker 色环更压暗，深色底上更稳） */
const MOOD_DOT_COLOR: Record<Mood, string> = {
  1: "#5b636f",
  2: "#7f8fa6",
  3: "#c9a227",
  4: "#6fae7c",
  5: "#e8674c",
};

interface DayCellProps {
  date: string;
  /** 是否属于当前展示的月份（前后补齐的格子会淡化） */
  inMonth: boolean;
  selected: boolean;
  today: boolean;
  /** 仅「当月 + 今天 + 计时器 running/paused」时才有值 */
  focusState: "running" | "paused" | null;
  focusSeconds: number;
  pomodoros: number;
  heatLevel: HeatLevel;
  heatPct: string;
  mood?: Mood;
  journal: DayJournalState;
  onSelect: (date: string) => void;
}

/**
 * 单个日期格子：热力条 / 心情点 / 日记点 / 今天标记 / 正在专注呼吸点 + 悬停预览。
 * 悬停延迟、视口翻转都在这里处理，tooltip 自身只负责展示。
 */
export default function DayCell({
  date,
  inMonth,
  selected,
  today,
  focusState,
  focusSeconds,
  pomodoros,
  heatLevel,
  heatPct,
  mood,
  journal,
  onSelect,
}: DayCellProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipUp, setTooltipUp] = useState(false);
  const [tooltipRight, setTooltipRight] = useState(false);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 卸载时清掉尚未触发的延时，避免定时器打到已卸载组件
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleOpen = () => {
    cancel();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const el = wrapRef.current;
      if (el) {
        // 用格子的视口坐标判断：下方放不下就向上翻，右侧放不下就右对齐
        const rect = el.getBoundingClientRect();
        setTooltipUp(rect.bottom + TOOLTIP_HEIGHT + 12 > window.innerHeight);
        setTooltipRight(rect.left + TOOLTIP_WIDTH + 12 > window.innerWidth);
      }
      setTooltipOpen(true);
    }, HOVER_DELAY_MS);
  };

  const close = () => {
    cancel();
    setTooltipOpen(false);
  };

  const meta = moodOf(mood);

  // 读屏兜底：把格子里的状态合进 aria-label
  const ariaParts = [formatDateLabel(date)];
  if (focusSeconds > 0) ariaParts.push(`专注 ${Math.round(focusSeconds / 60)} 分钟`);
  if (meta) ariaParts.push(`心情${meta.label}`);
  if (journal === "archived") ariaParts.push("日记已归档");
  else if (journal === "draft") ariaParts.push("有日记草稿");
  if (focusState) ariaParts.push(focusState === "paused" ? "专注已暂停" : "正在专注");

  return (
    <div ref={wrapRef} className="relative" onMouseEnter={scheduleOpen} onMouseLeave={close}>
      <button
        type="button"
        onClick={() => {
          close();
          onSelect(date);
        }}
        aria-label={ariaParts.join("，")}
        className={cn(
          "relative flex h-[clamp(76px,6.2vw,108px)] w-full flex-col justify-between rounded-[9px] p-2.5 text-left transition-colors duration-150",
          selected ? "bg-raised" : "bg-elevated hover:bg-raised",
          !inMonth && "opacity-35",
        )}
        style={{
          viewTransitionName: selected ? undefined : `day-${date}`,
          ...(selected
            ? { boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--c-accent) 45%, transparent)" }
            : {}),
        }}
      >
        <span className={cn("numeric text-[13px] font-medium", today ? "text-accent-text" : "text-ink")}>
          {Number(date.slice(8, 10))}
          {today && <span className="ml-1 inline-block h-1 w-1 rounded-full align-[3px] bg-[var(--c-accent)]" />}
        </span>

        {/* 正在专注：今天 + 当月 + 计时器在跑/暂停，左上角呼吸脉冲点 */}
        {focusState && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-[6px] top-[6px] h-[2.5px] w-[2.5px] rounded-full bg-[var(--c-accent)]",
              focusState === "running" ? "calendar-pulse" : "calendar-pulse-paused",
            )}
          />
        )}

        {/* 心情：右上角圆点，颜色跟随心情等级 */}
        {mood && (
          <span
            className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: MOOD_DOT_COLOR[mood] }}
          />
        )}

        {/* 热力条：底部 3px，宽度按专注时长比例 */}
        <span className="block h-[3px] w-full overflow-hidden rounded-full bg-[var(--c-raised)]">
          {focusSeconds > 0 && (
            <i
              className="block h-full rounded-full"
              style={{ width: heatPct, backgroundColor: `var(--c-heat-${heatLevel})` }}
            />
          )}
        </span>

        {/* 日记：右下角小圆点，草稿空心 / 已归档实心 */}
        {journal !== "none" && (
          <span
            className={cn(
              "absolute bottom-2.5 right-2.5 h-1.5 w-1.5 rounded-full",
              journal === "archived"
                ? "bg-[var(--c-muted)]"
                : "border-[1.5px] border-[var(--c-muted)] bg-transparent",
            )}
          />
        )}
      </button>

      {tooltipOpen && (
        <DayTooltip
          date={date}
          focusSeconds={focusSeconds}
          pomodoros={pomodoros}
          mood={mood}
          journal={journal}
          up={tooltipUp}
          alignRight={tooltipRight}
        />
      )}
    </div>
  );
}
