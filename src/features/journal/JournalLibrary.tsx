import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, PenLine, Search, Square, SquareCheck, Trash, X } from "lucide-react";
import { useUndo } from "@/shared/undo";
import { useData } from "@/lib/store";
import type { DayEntry } from "@/lib/types";
import { moodOf } from "@/lib/types";
import { cn, isToday, localDateOf, parseLocalDate } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import {
  charCount,
  dayFocus,
  entryIsListable,
  entryPreviewOf,
  entryTitleOf,
  formatFocusShort,
  journalStatus,
  type JournalStatus,
} from "./journalUtils";
import "./journal.css";

const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type Filter = "all" | "archived" | "draft" | "mood";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "archived", label: "已归档" },
  { key: "draft", label: "草稿" },
  { key: "mood", label: "有心情" },
];

interface Row {
  entry: DayEntry;
  status: JournalStatus;
  title: string;
  preview: string;
  chars: number;
  focusSeconds: number;
  focusPomodoros: number;
}

/**
 * 日记库 `/journal/library`：倒序卡片列表 + 状态筛选 + 搜索 + 多选批量删除（可撤销）。
 * 删除先本地移除并保留副本，撤销条超时后才算真正结束（撤销则原样插回）。
 */
export default function JournalLibrary() {
  const navigate = useNavigate();
  const entries = useData((s) => s.dayEntries);
  const sessions = useData((s) => s.sessions);
  const removeDayEntry = useData((s) => s.removeDayEntry);
  const putBackDayEntry = useData((s) => s.putBackDayEntry);
  const { push } = useUndo();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // 换筛选 / 改搜索时清空勾选，避免删到看不见的条目
  useEffect(() => {
    setSelected([]);
  }, [filter, query]);

  const counts = useMemo(() => {
    const list = entries.filter(entryIsListable);
    return {
      all: list.length,
      archived: list.filter((e) => journalStatus(e) === "archived").length,
      draft: list.filter((e) => journalStatus(e) === "draft").length,
      mood: list.filter((e) => !!e.mood).length,
    } satisfies Record<Filter, number>;
  }, [entries]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter(entryIsListable)
      .filter((e) => {
        if (filter === "archived") return journalStatus(e) === "archived";
        if (filter === "draft") return journalStatus(e) === "draft";
        if (filter === "mood") return !!e.mood;
        return true;
      })
      .filter((e) => {
        if (!q) return true;
        const haystack = `${e.journalTitle ?? ""}\n${e.journalMd}`.toLowerCase();
        return haystack.includes(q);
      })
      .map((e) => {
        const focus = dayFocus({ sessions }, e.localDate);
        return {
          entry: e,
          status: journalStatus(e),
          title: entryTitleOf(e),
          preview: entryPreviewOf(e),
          chars: charCount(e.journalMd),
          focusSeconds: focus.seconds,
          focusPomodoros: focus.pomodoros,
        };
      })
      .sort((a, b) => (a.entry.localDate < b.entry.localDate ? 1 : -1));
  }, [entries, sessions, filter, query]);

  const totalChars = useMemo(() => rows.reduce((sum, r) => sum + r.chars, 0), [rows]);

  const toggleSelected = (date: string) =>
    setSelected((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected([]);
  };

  /** 删除若干篇：先落盘移除，再挂撤销条（撤销时原样插回，id 不变） */
  const deleteEntries = (victims: DayEntry[]) => {
    if (!victims.length) return;
    for (const v of victims) removeDayEntry(v.localDate);
    push({
      message: `已删除 ${victims.length} 篇日记`,
      ttlMs: 6000,
      restore: () => victims.forEach((v) => putBackDayEntry(v)),
    });
  };

  const deleteSelected = () => {
    const victims = rows.filter((r) => selected.includes(r.entry.localDate)).map((r) => r.entry);
    deleteEntries(victims);
    exitSelectMode();
  };

  const deleteOne = (entry: DayEntry) => {
    deleteEntries([entry]);
    setSelected((prev) => prev.filter((d) => d !== entry.localDate));
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.entry.localDate));

  const toggleSelectAll = () => setSelected(allSelected ? [] : rows.map((r) => r.entry.localDate));

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
  };

  const openDay = (date: string) => navigate(`/journal/${date}`);

  return (
    <div className="animate-in pb-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted">Journal · Library</div>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">日记库</h1>
          <p className="mt-2 text-[12.5px] text-sub">
            <span className="numeric">{rows.length}</span> 篇 · 共 <span className="numeric">{totalChars}</span> 字
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-soft" onClick={() => openDay(localDateOf())}>
            <PenLine size={14} strokeWidth={1.75} /> 写今天
          </button>
          <button
            className={cn("btn-ghost", selectMode && "text-strong")}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            {selectMode ? <X size={14} strokeWidth={1.75} /> : <ListChecks size={14} strokeWidth={1.75} />}
            {selectMode ? "退出整理" : "整理"}
          </button>
        </div>
      </header>

      {/* 筛选 + 搜索 */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-[10px] p-1" style={{ background: "var(--c-elevated)" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-[7px] px-3 py-1.5 text-[12px] transition-colors",
                filter === f.key ? "text-strong" : "text-sub hover:text-ink",
              )}
              style={filter === f.key ? { background: "var(--c-surface)" } : undefined}
              aria-pressed={filter === f.key}
            >
              {f.label}
              <span className="numeric ml-1.5 text-[10.5px] text-muted">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-[280px]">
          <Search size={13} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-8"
            placeholder="搜索标题和正文"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索日记"
          />
        </div>
      </div>

      {selectMode && rows.length > 0 && (
        <div className="mt-4 flex items-center gap-3 text-[11.5px] text-muted">
          <button className="btn-ghost px-2 py-1 text-[11.5px]" onClick={toggleSelectAll}>
            {allSelected ? "取消全选" : "全选"}
          </button>
          <span>点击卡片勾选要整理的日记</span>
        </div>
      )}

      {rows.length === 0 ? (
        <JournalEmpty
          searching={counts.all > 0}
          onWrite={() => openDay(localDateOf())}
          onReset={clearFilters}
        />
      ) : (
        <div className="mt-5 space-y-2">
          {rows.map((row, i) => (
            <JournalCard
              key={row.entry.localDate}
              row={row}
              index={i}
              selectMode={selectMode}
              selected={selected.includes(row.entry.localDate)}
              onOpen={() => openDay(row.entry.localDate)}
              onToggle={() => toggleSelected(row.entry.localDate)}
              onDelete={() => deleteOne(row.entry)}
            />
          ))}
        </div>
      )}

      {/* 多选底部操作条：sticky 在内容底部，不与全局撤销条抢同一个 fixed 位 */}
      {selectMode && (
        <div
          className="journal-badge-in sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-[12px] px-4 py-3"
          style={{ background: "var(--c-elevated)", boxShadow: "var(--shadow-pop)", border: "1px solid var(--c-line)" }}
        >
          <span className="text-[12.5px] text-sub">
            已选 <span className="numeric text-strong">{selected.length}</span> 篇
          </span>
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-2 py-1 text-[12px]" onClick={exitSelectMode}>
              取消
            </button>
            <button className="btn-primary" disabled={selected.length === 0} onClick={deleteSelected}>
              <Trash size={14} strokeWidth={1.75} /> 删除 {selected.length} 篇
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function JournalCard({
  row,
  index,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onDelete,
}: {
  row: Row;
  index: number;
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const d = parseLocalDate(row.entry.localDate);
  const mood = moodOf(row.entry.mood);
  const activate = () => (selectMode ? onToggle() : onOpen());

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? selected : undefined}
      aria-label={`${row.entry.localDate} ${row.title}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      className={cn(
        "card journal-card-in group relative cursor-pointer px-6 py-5 pr-12 transition-colors hover:bg-elevated",
      )}
      style={{
        animationDelay: `${Math.min(index, 5) * 40}ms`,
        boxShadow: selected ? "inset 0 0 0 1px var(--c-accent)" : undefined,
      }}
    >
      <div className="flex items-start gap-5">
        {selectMode && (
          <span className="mt-0.5 shrink-0" style={{ color: selected ? "var(--c-accent)" : "var(--c-muted)" }}>
            {selected ? <SquareCheck size={17} strokeWidth={1.75} /> : <Square size={17} strokeWidth={1.75} />}
          </span>
        )}

        <div className="w-[88px] shrink-0">
          <div className="numeric text-[14px] font-medium text-strong">
            {d.getMonth() + 1} 月 {d.getDate()} 日
          </div>
          <div className="mt-1 text-[11.5px] text-muted">{WEEKDAY[d.getDay()]}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: mood?.color ?? "var(--c-line)" }}
              title={mood ? `心情：${mood.label}` : "未记录心情"}
            />
            <h3 className="truncate text-[15px] font-medium text-strong">{row.title}</h3>
            {isToday(row.entry.localDate) && <span className="chip shrink-0">今天</span>}
          </div>

          {row.preview ? (
            <p className="mt-1.5 truncate text-[12.5px] text-muted">{row.preview}</p>
          ) : (
            row.chars === 0 && <p className="mt-1.5 truncate text-[12.5px] text-muted">（空白正文）</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
            <span className="numeric">{row.chars} 字</span>
            <span className="h-2.5 w-px bg-[var(--c-line)]" />
            <span>专注 {formatFocusShort(row.focusSeconds)}</span>
            {row.focusPomodoros > 0 && (
              <>
                <span className="h-2.5 w-px bg-[var(--c-line)]" />
                <span className="numeric">{row.focusPomodoros} 个番茄</span>
              </>
            )}
            <StatusBadge archived={row.status === "archived"} archivedAt={row.entry.archivedAt} compact />
          </div>
        </div>
      </div>

      {!selectMode && (
        <button
          className="btn-ghost absolute right-3 top-3 px-1.5 py-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          title="删除这篇日记（可撤销）"
          aria-label={`删除 ${row.entry.localDate} 的日记`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash size={13} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

/** 空状态：几何构成（几个圆 + 一条线），不引入插画依赖 */
function JournalEmpty({
  searching,
  onWrite,
  onReset,
}: {
  searching: boolean;
  onWrite: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-14 flex flex-col items-center text-center">
      <svg viewBox="0 0 200 120" className="h-[120px] w-[200px]" aria-hidden>
        <circle cx="52" cy="42" r="21" fill="none" stroke="var(--c-line)" strokeWidth="1.2" />
        <circle cx="98" cy="70" r="31" fill="none" stroke="var(--c-line)" strokeWidth="1.2" />
        <circle cx="144" cy="36" r="9" fill="var(--c-accent)" opacity="0.5" />
        <line x1="22" y1="100" x2="178" y2="100" stroke="var(--c-line)" strokeWidth="1.2" strokeLinecap="round" />
        <line
          x1="120"
          y1="84"
          x2="168"
          y2="56"
          stroke="var(--c-accent)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
      <p className="mt-6 text-[14px] text-ink">{searching ? "没有符合条件的日记" : "还没有日记，今天写一篇？"}</p>
      <p className="mt-1.5 text-[12.5px] text-muted">
        {searching ? "换个关键词，或者回到全部看看。" : "写下一点，之后就有一整条时间线可以回看。"}
      </p>
      <div className="mt-5 flex items-center gap-2">
        {searching && (
          <button className="btn-ghost" onClick={onReset}>
            清除筛选
          </button>
        )}
        <button className="btn-primary" onClick={onWrite}>
          <PenLine size={14} strokeWidth={1.75} /> 写今天
        </button>
      </div>
    </div>
  );
}
