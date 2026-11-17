import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "@/lib/store";
import {
  dayEntryOn,
  focusSecondsOn,
  happinessAverage,
  heatLevel,
  heatWidth,
  monthGrid,
  monthOf,
  monthSummary,
  pomodorosOn,
  weekdays,
} from "@/lib/selectors";
import AnimatedNumber from "@/shared/AnimatedNumber";
import { useViewTransition } from "@/shared/viewTransition";
import { useTimer } from "@/features/timer/timerStore";
import { formatDuration, localDateOf } from "@/lib/utils";
import DayCell from "./DayCell";
import DayDetail from "./DayDetail";
import { isValidDateString, journalStateOf } from "./calendarUtils";

const MONTH_NAMES = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];

export default function CalendarPage() {
  const sessions = useData((s) => s.sessions);
  const dayEntries = useData((s) => s.dayEntries);
  const weekStartsOn = useData((s) => s.settings.weekStartsOn);
  const timerStatus = useTimer((s) => s.status);
  const [searchParams, setSearchParams] = useSearchParams();

  // 进入日历时优先读取 ?date=YYYY-MM-DD（从日记页「回日历」时保持同一天）
  const [selected, setSelected] = useState<string>(() => {
    const fromUrl = searchParams.get("date");
    return isValidDateString(fromUrl) ? fromUrl : localDateOf();
  });
  // 月份跟着初始选中日期走，避免 URL 指向别的月份时看不到高亮
  const [month, setMonth] = useState<Date>(() => monthOf(selected));

  const cells = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const summary = useMemo(() => monthSummary({ sessions, dayEntries }, month), [sessions, dayEntries, month]);
  const monthHappiness = useMemo(() => {
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return happinessAverage({ sessions, dayEntries }, localDateOf(month), localDateOf(last));
  }, [sessions, dayEntries, month]);
  const monthIndex = month.getMonth();
  const { start } = useViewTransition();

  // URL 从外部变化（含浏览器前进/后退）时跟随选中；非法日期忽略
  useEffect(() => {
    const fromUrl = searchParams.get("date");
    if (!isValidDateString(fromUrl) || fromUrl === selected) return;
    setSelected(fromUrl);
    setMonth(monthOf(fromUrl));
  }, [searchParams, selected]);

  // 用户主动点选时把 date 写回 URL：replace，点格子不堆历史；外部改 URL 时不反向覆盖
  const writeDateToUrl = (date: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("date", date);
        return next;
      },
      { replace: true },
    );
  };

  const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const selectDate = (date: string) => {
    if (date === selected) return;
    start(() => flushSync(() => setSelected(date)), { types: ["day"] });
    writeDateToUrl(date);
  };

  const goToday = () => {
    const now = new Date();
    const todayDate = localDateOf();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(todayDate);
    writeDateToUrl(todayDate);
  };

  const today = localDateOf();

  return (
    <div className="animate-in">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted">Calendar</div>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">
            {month.getFullYear()} 年 {MONTH_NAMES[monthIndex]}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-1.5 py-1.5" onClick={() => shift(-1)} aria-label="上个月">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button className="btn-soft px-3 py-1 text-[12px]" onClick={goToday}>
            今天
          </button>
          <button className="btn-ghost px-1.5 py-1.5" onClick={() => shift(1)} aria-label="下个月">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <p className="mt-3 text-[13px] text-sub numeric">
        本月专注{" "}
        <span className="font-medium text-ink">
          <AnimatedNumber value={summary.focusSeconds} format={formatDuration} />
        </span>
        <span className="mx-2 text-muted">·</span>
        <span className="font-medium text-ink">
          <AnimatedNumber value={summary.pomodoros} />
        </span>{" "}
        个番茄
        <span className="mx-2 text-muted">·</span>记录{" "}
        <span className="font-medium text-ink">
          <AnimatedNumber value={summary.recordedDays} />
        </span>{" "}
        天
        {summary.avgMood && (
          <>
            <span className="mx-2 text-muted">·</span>平均心情{" "}
            <span className="font-medium text-ink">{summary.avgMood.toFixed(1)}</span>
          </>
        )}
        {monthHappiness !== null && (
          <>
            <span className="mx-2 text-muted">·</span>开心度{" "}
            <span className="font-medium text-ink">{monthHappiness}</span>
          </>
        )}
      </p>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_318px]">
        <section className="card p-5">
          <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted">
            {weekdays(weekStartsOn).map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date) => {
              const inMonth = Number(date.slice(5, 7)) === monthIndex + 1;
              const isToday = date === today;
              const entry = dayEntryOn({ dayEntries }, date);
              const secs = focusSecondsOn({ sessions }, date);
              // 只有「今天 + 当月 + 计时器在跑/暂停」才显示呼吸点
              const focusState = isToday && inMonth && timerStatus !== "idle" ? timerStatus : null;

              return (
                <DayCell
                  key={date}
                  date={date}
                  inMonth={inMonth}
                  selected={date === selected}
                  today={isToday}
                  focusState={focusState}
                  focusSeconds={secs}
                  pomodoros={pomodorosOn({ sessions }, date)}
                  heatLevel={heatLevel(secs)}
                  heatPct={heatWidth(secs)}
                  mood={entry?.mood}
                  journal={journalStateOf(entry)}
                  onSelect={selectDate}
                />
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-4 rounded-full" style={{ background: "var(--c-heat-1)" }} />0–30m
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-4 rounded-full" style={{ background: "var(--c-heat-2)" }} />30–90m
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-4 rounded-full" style={{ background: "var(--c-heat-3)" }} />90m+
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-1.5 w-1.5 rounded-full bg-[var(--c-accent)]" />正在专注
            </span>
            <span className="ml-auto">右上圆点 = 心情 · 右下圆点 = 日记（空心草稿 / 实心已归档）</span>
          </div>
        </section>

        <DayDetail date={selected} />
      </div>
    </div>
  );
}
