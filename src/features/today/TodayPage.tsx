import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Maximize2, Play, Plus, Target, Trash2 } from "lucide-react";
import RingTimer from "@/features/timer/RingTimer";
import MoodPicker from "@/features/mood/MoodPicker";
import AnimatedNumber from "@/shared/AnimatedNumber";
import { useFlipList } from "@/shared/useFlipList";
import { useData } from "@/lib/store";
import { dayEntryOn, focusSecondsOn, pomodorosOn, streakDays } from "@/lib/selectors";
import type { Mood, Task } from "@/lib/types";
import { cn, formatDateLabel, formatDuration, greeting, localDateOf } from "@/lib/utils";
import { useTimer } from "@/features/timer/timerStore";

export default function TodayPage() {
  const sessions = useData((s) => s.sessions);
  const dayEntries = useData((s) => s.dayEntries);
  const tasks = useData((s) => s.tasks);
  const settings = useData((s) => s.settings);
  const setMood = useData((s) => s.setMood);
  const addTask = useData((s) => s.addTask);
  const toggleTask = useData((s) => s.toggleTask);
  const removeTask = useData((s) => s.removeTask);
  const timerStatus = useTimer((s) => s.status);
  const startWork = useTimer((s) => s.startWork);
  const openFocusMode = useTimer((s) => s.openFocusMode);

  const [draft, setDraft] = useState("");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const flipRef = useFlipList<HTMLDivElement>();

  const today = localDateOf();
  const entry = dayEntryOn({ dayEntries }, today);
  const focusSecs = focusSecondsOn({ sessions }, today);
  const pomodoros = pomodorosOn({ sessions }, today);
  const streak = streakDays({ sessions, dayEntries });
  const journal = entry?.journalMd?.trim() ?? "";
  const openTasks = tasks.filter((t) => t.status === "todo");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const goalPct = Math.min(100, Math.round((focusSecs / 60 / Math.max(1, settings.dailyGoalMinutes)) * 100));

  const submitTask = () => {
    if (!draft.trim()) return;
    addTask(draft.trim(), 2);
    setDraft("");
  };

  return (
    <div className="animate-in">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted">{formatDateLabel(today)}</div>
          <h1 className="mt-2 flex items-baseline gap-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">
            {greeting()}
            <span className="text-[15px] font-normal text-sub">今天想做点什么？</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip">
            <Flame size={12} strokeWidth={1.9} className="text-[var(--c-accent)]" /> 连续 {streak} 天
          </span>
          <span className="chip">
            <Target size={12} strokeWidth={1.9} /> 目标 {settings.dailyGoalMinutes / 60}h
          </span>
        </div>
      </header>

      <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <section className="card relative flex flex-col items-center justify-center px-6 py-8">
          <button
            className="btn-ghost absolute right-3 top-3 px-2 py-1.5"
            onClick={openFocusMode}
            title="专注模式：放大计时（F）"
          >
            <Maximize2 size={14} strokeWidth={1.75} />
          </button>
          <RingTimer taskId={selectedTask} />
          <div className="mt-6 text-center text-[11.5px] text-muted">
            {timerStatus === "idle" ? "滚轮可调时长 · 结束时自动记进今天的日历" : "窗口最小化也会继续计时"}
          </div>
          {selectedTask && (
            <div className="chip mt-3">
              绑定：{tasks.find((t) => t.id === selectedTask)?.title}
              <button className="ml-0.5 text-muted hover:text-ink" onClick={() => setSelectedTask(null)} aria-label="取消绑定">
                ×
              </button>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="card px-6 py-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-strong">今天</h2>
              <span className="text-[11px] text-muted numeric">目标完成 {goalPct}%</span>
            </div>
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-[var(--c-raised)]">
              <div
                className="h-full rounded-full bg-[var(--c-accent)] transition-[width] duration-500"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="专注" value={<AnimatedNumber value={focusSecs} format={formatDuration} />} />
              <Stat label="番茄" value={<AnimatedNumber value={pomodoros} />} />
              <Stat label="连续" value={<><AnimatedNumber value={streak} /> 天</>} />
            </div>
          </section>

          <section className="card px-6 py-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-strong">今天的心情</h2>
              <span className="text-[11px] text-muted">点一下就好</span>
            </div>
            <MoodPicker value={entry?.mood} onChange={(m: Mood) => setMood(today, m)} showLabels style={settings.moodStyle} />
            <div className="mt-3 text-[12px] text-sub">
              {entry?.mood ? "已记录，晚点可以回来改。" : "还没记录，现在选一个？"}
            </div>
          </section>

          <section className="card px-6 py-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-strong">今日日记</h2>
              <Link to={`/journal/${today}`} className="flex items-center gap-1 text-[11.5px] text-sub hover:text-accent-text">
                {journal ? "编辑" : "去写"} <ArrowRight size={11} strokeWidth={2} />
              </Link>
            </div>
            {journal ? (
              <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-[1.8] text-sub">{journal}</p>
            ) : (
              <p className="text-[13px] text-muted">还没写。哪怕一句「今天卡在哪」也值得记。</p>
            )}
          </section>
        </div>
      </div>

      <section className="card mt-4 px-6 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-strong">
            任务 <span className="ml-2 text-[11.5px] font-normal text-muted numeric">{openTasks.length} 个待办</span>
          </h2>
          <div className="flex w-[268px] items-center gap-2">
            <input
              className="input py-1.5"
              placeholder="加一件事，回车创建"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTask();
              }}
            />
            <button className="btn-soft px-2.5 py-1.5" onClick={submitTask} aria-label="添加任务">
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div ref={flipRef} className="space-y-0.5">
          {[...openTasks, ...doneTasks].map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              active={selectedTask === task.id}
              pomodoros={sessions.filter((s) => s.taskId === task.id && s.status === "completed" && s.kind === "work").length}
              onToggle={() => toggleTask(task.id)}
              onRemove={() => removeTask(task.id)}
              onSelect={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
              onStart={() => {
                setSelectedTask(task.id);
                if (timerStatus === "idle") startWork(task.id);
              }}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10">
              <EmptyMark />
              <p className="text-[12.5px] text-muted">还没有任务。先加一件今天必须做的事。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[9px] bg-[var(--c-elevated)] px-3 py-3.5">
      <div className="numeric text-[17px] font-semibold leading-none tracking-[-0.02em] text-strong">{value}</div>
      <div className="mt-1.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

function TaskRow({
  task,
  active,
  pomodoros,
  onToggle,
  onRemove,
  onSelect,
  onStart,
}: {
  task: Task;
  active: boolean;
  pomodoros: number;
  onToggle: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onStart: () => void;
}) {
  const done = task.status === "done";
  return (
    <div
      data-flip-id={task.id}
      className={cn(
        "group flex items-center gap-3 rounded-[9px] px-2.5 py-2 transition-colors",
        active ? "bg-[var(--c-elevated)]" : "hover:bg-[var(--c-elevated)]",
      )}
    >
      <button
        onClick={onToggle}
        aria-label={done ? "标记为待办" : "标记为完成"}
        className={cn(
          "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          done ? "border-transparent bg-[var(--c-accent)] text-white" : "border-[var(--c-line)] hover:border-[var(--c-accent)]",
        )}
      >
        {done && <span className="text-[9px] leading-none">✓</span>}
      </button>

      <button onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className={cn("truncate text-[13.5px]", done ? "text-muted line-through" : "text-ink")}>{task.title}</div>
        <div className="mt-0.5 text-[11px] text-muted numeric">
          {pomodoros}/{task.estPomodoros} 番茄
        </div>
      </button>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!done && (
          <button className="btn-ghost px-1.5 py-1" title="开始专注这个任务" onClick={onStart}>
            <Play size={13} strokeWidth={1.9} />
          </button>
        )}
        <button className="btn-ghost px-1.5 py-1 hover:text-accent-text" title="删除" onClick={onRemove}>
          <Trash2 size={13} strokeWidth={1.9} />
        </button>
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
