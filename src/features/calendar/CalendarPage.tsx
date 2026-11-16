import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useData } from "@/lib/store";
import {
  dayEntryOn,
  focusSecondsOn,
  happinessAverage,
  heatLevel,
  heatWidth,
  monthGrid,
  monthSummary,
  pomodorosOn,
  sessionsOn,
  weekdays,
} from "@/lib/selectors";
import MoodPicker from "@/features/mood/MoodPicker";
import MarkdownView from "@/shared/MarkdownView";
import AnimatedNumber from "@/shared/AnimatedNumber";
import { useUndo } from "@/shared/undo";
import { useViewTransition } from "@/shared/viewTransition";
import { cn, formatDateLabel, formatDuration, isFuture, localDateOf } from "@/lib/utils";

const MONTH_NAMES = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];

const MOOD_COLOR: Record<number, string> = {
  1: "#5b636f",
  2: "#7f8fa6",
  3: "#c9a227",
  4: "#6fae7c",
  5: "#e8674c",
};

export default function CalendarPage() {
  const sessions = useData((s) => s.sessions);
  const dayEntries = useData((s) => s.dayEntries);
  const reflections = useData((s) => s.reflections);
  const weekStartsOn = useData((s) => s.settings.weekStartsOn);
  const moodStyle = useData((s) => s.settings.moodStyle);
  const journalSerif = useData((s) => s.settings.journalSerif);
  const setMood = useData((s) => s.setMood);
  const removeSession = useData((s) => s.removeSession);
  const putBackSession = useData((s) => s.putBackSession);
  const { push } = useUndo();

  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(localDateOf());

  const cells = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const summary = useMemo(() => monthSummary({ sessions, dayEntries }, month), [sessions, dayEntries, month]);
  const monthHappiness = useMemo(() => {
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return happinessAverage({ sessions, dayEntries }, localDateOf(month), localDateOf(last));
  }, [sessions, dayEntries, month]);
  const selectedEntry = dayEntryOn({ dayEntries }, selected);
  const selectedSessions = sessionsOn({ sessions }, selected);
  const selectedReflections = reflections.filter((r) => r.localDate === selected);
  const monthIndex = month.getMonth();
  const { start } = useViewTransition();

  const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const selectDate = (date: string) => {
    if (date === selected) return;
    start(() => flushSync(() => setSelected(date)), { types: ["day"] });
  };

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
          <button
            className="btn-soft px-3 py-1 text-[12px]"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelected(localDateOf());
            }}
          >
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
              const entry = dayEntryOn({ dayEntries }, date);
              const secs = focusSecondsOn({ sessions }, date);
              const level = heatLevel(secs);
              const isSel = date === selected;
              const isToday = date === localDateOf();
              const hasJournal = !!entry?.journalMd.trim();

              return (
                <button
                  key={date}
                  onClick={() => selectDate(date)}
                  className={cn(
                    "relative flex h-[clamp(76px,6.2vw,108px)] flex-col justify-between rounded-[9px] p-2.5 text-left transition-colors duration-150",
                    isSel ? "bg-raised" : "bg-elevated hover:bg-raised",
                    !inMonth && "opacity-35",
                  )}
                  style={{
                    viewTransitionName: isSel ? undefined : `day-${date}`,
                    ...(isSel
                      ? { boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--c-accent) 45%, transparent)" }
                      : {}),
                  }}
                >
                  <span
                    className={cn(
                      "numeric text-[13px] font-medium",
                      isToday ? "text-accent-text" : "text-ink",
                    )}
                  >
                    {Number(date.slice(8, 10))}
                    {isToday && (
                      <span className="ml-1 inline-block h-1 w-1 rounded-full align-[3px] bg-[var(--c-accent)]" />
                    )}
                  </span>

                  {entry?.mood && (
                    <span
                      className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: MOOD_COLOR[entry.mood] }}
                      title="心情"
                    />
                  )}

                  <span className="block h-[3px] w-full overflow-hidden rounded-full bg-[var(--c-raised)]">
                    {secs > 0 && (
                      <i
                        className="block h-full rounded-full"
                        style={{ width: heatWidth(secs), backgroundColor: `var(--c-heat-${level})` }}
                      />
                    )}
                  </span>

                  {hasJournal && (
                    <span className="absolute bottom-2.5 right-2.5 h-2.5 w-[2px] rounded-full bg-[var(--c-muted)]" title="有日记" />
                  )}
                </button>
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
            <span className="ml-auto">右上圆点 = 心情 · 右下短线 = 有日记</span>
          </div>
        </section>

        <aside className="card flex flex-col p-6">
          <div className="flex items-start justify-between">
            <div>
              <div
                className="text-[15px] font-semibold text-strong"
                style={{ viewTransitionName: `day-${selected}` }}
              >
                {formatDateLabel(selected)}
              </div>
              <div className="mt-1 text-[12px] text-sub numeric">
                专注 {formatDuration(focusSecondsOn({ sessions }, selected))} · 番茄{" "}
                {pomodorosOn({ sessions }, selected)}
              </div>
            </div>
            <Link to={`/journal/${selected}`} className="btn-ghost p-1.5" title="写这天日记">
              <Pencil size={15} strokeWidth={1.75} />
            </Link>
          </div>

          <div className="mt-5">
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.1em] text-muted">Mood</div>
            <MoodPicker value={selectedEntry?.mood} onChange={(m) => setMood(selected, m)} style={moodStyle} />
            {isFuture(selected) && <p className="mt-2 text-[11.5px] text-muted">这天还没到。</p>}
          </div>

          <div className="mt-5 space-y-2">
            <div className="text-[11px] uppercase tracking-[0.1em] text-muted">Records</div>

            {selectedSessions.length === 0 && selectedReflections.length === 0 && !selectedEntry?.journalMd.trim() && (
              <div className="flex flex-col items-center gap-3 py-8">
                <EmptyMark />
                <p className="text-[12.5px] text-muted">这天什么都没有留下。</p>
              </div>
            )}

            {selectedSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-[9px] bg-elevated px-3 py-2">
                <span className="text-[12.5px] text-sub numeric">
                  {new Date(s.startedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  <span className="ml-2 text-muted">
                    {s.kind === "work" ? "专注" : "休息"} · {Math.round(s.actualSeconds / 60)} 分钟
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={cn("text-[11px]", s.status === "completed" ? "text-accent-text" : "text-muted")}>
                    {s.status === "completed" ? "完成" : s.status === "aborted" ? "放弃" : s.status === "skipped" ? "跳过" : "进行中"}
                  </span>
                  <button
                    className="btn-ghost px-1 py-0.5 text-muted hover:text-accent-text"
                    title="删除这条记录"
                    onClick={() => {
                      const snapshot = s;
                      removeSession(snapshot.id);
                      push({
                        message: "已删除 1 条专注记录",
                        restore: () => putBackSession(snapshot),
                      });
                    }}
                  >
                    <Trash2 size={12} strokeWidth={1.8} />
                  </button>
                </span>
              </div>
            ))}

            {selectedReflections.map((r) => (
              <div key={r.id} className="rounded-[9px] bg-elevated px-3 py-2.5">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.1em] text-muted">Note</div>
                <div className="text-[12.5px] leading-relaxed text-ink">{r.contentMd}</div>
              </div>
            ))}

            {selectedEntry?.journalMd.trim() && (
              <div className="rounded-[9px] bg-elevated px-3 py-2.5">
                <MarkdownView serif={journalSerif}>{selectedEntry.journalMd}</MarkdownView>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyMark() {
  return (
    <svg width="56" height="36" viewBox="0 0 56 36" aria-hidden>
      <circle cx="14" cy="22" r="7" fill="none" stroke="var(--c-line)" strokeWidth="1.5" />
      <circle cx="30" cy="16" r="5" fill="none" stroke="var(--c-line)" strokeWidth="1.5" />
      <circle cx="44" cy="24" r="3" fill="var(--c-accent)" opacity="0.35" />
    </svg>
  );
}
