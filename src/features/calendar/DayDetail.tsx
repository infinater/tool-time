import { Link } from "react-router-dom";
import { Pencil, Play, Trash2 } from "lucide-react";
import { useData } from "@/lib/store";
import {
  dayEntryOn,
  focusSecondsOn,
  happinessOfDay,
  pomodorosOn,
  sessionsOn,
} from "@/lib/selectors";
import HappinessGauge from "@/features/happiness/HappinessGauge";
import MoodPicker from "@/features/mood/MoodPicker";
import { useTimer } from "@/features/timer/timerStore";
import MarkdownView from "@/shared/MarkdownView";
import { useUndo } from "@/shared/undo";
import { cn, formatDateLabel, formatDuration, localDateOf } from "@/lib/utils";
import { pastJournalAction } from "./calendarUtils";

/**
 * 右侧详情面板：开心度 mini 仪表 + 状态化操作行 + 原有心情 / 记录 / 日记摘要。
 * 操作行只负责「今天 / 过去 / 未来」三态，不直接改计时器状态之外的数据。
 */
export default function DayDetail({ date }: { date: string }) {
  const sessions = useData((s) => s.sessions);
  const dayEntries = useData((s) => s.dayEntries);
  const reflections = useData((s) => s.reflections);
  const moodStyle = useData((s) => s.settings.moodStyle);
  const journalSerif = useData((s) => s.settings.journalSerif);
  const setMood = useData((s) => s.setMood);
  const removeSession = useData((s) => s.removeSession);
  const putBackSession = useData((s) => s.putBackSession);
  const timerStatus = useTimer((s) => s.status);
  const { push } = useUndo();

  const entry = dayEntryOn({ dayEntries }, date);
  const daySessions = sessionsOn({ sessions }, date);
  const dayReflections = reflections.filter((r) => r.localDate === date);
  const happiness = happinessOfDay({ sessions, dayEntries }, date);

  const today = localDateOf();
  const isTodaySelected = date === today;
  const future = date > today;
  const archived = entry?.status === "archived";
  const pastAction = pastJournalAction(entry);

  // 计时器非空闲时不允许从日历再开一个番茄
  const timerBusy = timerStatus !== "idle";
  const timerHint =
    timerStatus === "running"
      ? "已有番茄在计时，先结束当前专注。"
      : timerStatus === "paused"
        ? "计时器已暂停，先继续或结束当前番茄。"
        : null;

  return (
    <aside className="card flex flex-col p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[15px] font-semibold text-strong" style={{ viewTransitionName: `day-${date}` }}>
            {formatDateLabel(date)}
          </div>
          <div className="mt-1 text-[12px] text-sub numeric">
            专注 {formatDuration(focusSecondsOn({ sessions }, date))} · 番茄{" "}
            {pomodorosOn({ sessions }, date)}
          </div>
        </div>
        <Link to={`/journal/${date}`} className="btn-ghost p-1.5" title="写这天日记">
          <Pencil size={15} strokeWidth={1.75} />
        </Link>
      </div>

      {/* 开心度 mini 仪表：静态度量，不播动效 */}
      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-[0.1em] text-muted">Happiness</div>
        <div className="mt-2 flex justify-center">
          <HappinessGauge index={happiness.index} samples={happiness.samples} size={96} animate={false} />
        </div>
      </div>

      {/* 操作行：今天 / 过去 有按钮，未来不显示操作（保留下方「这天还没到」） */}
      {!future && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            {isTodaySelected ? (
              <>
                <button
                  className="btn-primary"
                  disabled={timerBusy}
                  onClick={() => useTimer.getState().startWork()}
                  title={timerBusy ? "计时器进行中" : "开始一个番茄"}
                >
                  <Play size={14} strokeWidth={1.8} />
                  开始专注
                </button>
                <Link to={`/journal/${date}`} className="btn-soft">
                  查看日记
                </Link>
              </>
            ) : (
              <Link to={`/journal/${date}`} className={pastAction.archived ? "btn-soft" : "btn-primary"}>
                {pastAction.label}
              </Link>
            )}
          </div>
          {isTodaySelected && timerHint && <p className="mt-2 text-[11.5px] text-muted">{timerHint}</p>}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2.5 text-[11px] uppercase tracking-[0.1em] text-muted">Mood</div>
        <MoodPicker value={entry?.mood} onChange={(m) => setMood(date, m)} style={moodStyle} />
        {future && <p className="mt-2 text-[11.5px] text-muted">这天还没到。</p>}
      </div>

      <div className="mt-5 space-y-2">
        <div className="text-[11px] uppercase tracking-[0.1em] text-muted">Records</div>

        {daySessions.length === 0 && dayReflections.length === 0 && !entry?.journalMd.trim() && (
          <div className="flex flex-col items-center gap-3 py-8">
            <EmptyMark />
            <p className="text-[12.5px] text-muted">这天什么都没有留下。</p>
          </div>
        )}

        {daySessions.map((s) => (
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

        {dayReflections.map((r) => (
          <div key={r.id} className="rounded-[9px] bg-elevated px-3 py-2.5">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.1em] text-muted">Note</div>
            <div className="text-[12.5px] leading-relaxed text-ink">{r.contentMd}</div>
          </div>
        ))}

        {entry?.journalMd.trim() && (
          <div className="rounded-[9px] bg-elevated px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10.5px] uppercase tracking-[0.1em] text-muted">Journal</span>
              <span className={cn("text-[10.5px]", archived ? "text-accent-text" : "text-muted")}>
                {archived ? "已归档" : "草稿"}
              </span>
            </div>
            <MarkdownView serif={journalSerif}>{entry.journalMd}</MarkdownView>
          </div>
        )}
      </div>
    </aside>
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
