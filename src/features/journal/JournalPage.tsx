import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ChevronLeft, ChevronRight, Download, Eye, LibraryBig, Pencil, PenLine, X } from "lucide-react";
import MarkdownView from "@/shared/MarkdownView";
import MoodPicker from "@/features/mood/MoodPicker";
import { useData } from "@/lib/store";
import { moodOf, type Mood } from "@/lib/types";
import { addDays, cn, formatDateLabel, isFuture, isToday, localDateOf } from "@/lib/utils";
import JournalLibrary from "./JournalLibrary";
import StatusBadge from "./StatusBadge";
import {
  buildJournalMarkdown,
  charCount,
  dayFocus,
  downloadText,
  formatArchivedAt,
  formatClockTime,
  formatFocusCn,
  journalFileName,
  journalStatus,
} from "./journalUtils";
import "./journal.css";

const TEMPLATES: { label: string; text: string }[] = [
  { label: "一句话", text: "今天最想记住的一件事：\n\n" },
  { label: "三问复盘", text: "### 今天最有价值的一件事\n\n\n### 卡在哪里\n\n\n### 明天第一步\n\n" },
  { label: "自由书写", text: "" },
];

/**
 * 路由 `/journal` 与 `/journal/:date`。
 * 日期变化时用 key 重挂载工作区，避免把上一天的草稿状态带过来。
 */
export default function JournalPage() {
  const params = useParams<{ date?: string }>();
  const date = params.date ?? localDateOf();

  // 「日记库」兜底：万一 /journal/library 路由还没挂上，也能进入
  if (params.date === "library") return <JournalLibrary />;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <div className="card p-8 text-sm text-sub">日期格式不对。</div>;
  }

  return <JournalWorkspace key={date} date={date} />;
}

/** 单日工作区：草稿态（可写）与档案态（只读）共用同一份头部 */
function JournalWorkspace({ date }: { date: string }) {
  const navigate = useNavigate();
  const entry = useData((s) => s.dayEntries.find((e) => e.localDate === date));
  const sessions = useData((s) => s.sessions);
  const updateJournal = useData((s) => s.updateJournal);
  const setMood = useData((s) => s.setMood);
  const archiveJournal = useData((s) => s.archiveJournal);
  const reopenJournal = useData((s) => s.reopenJournal);
  const moodStyle = useData((s) => s.settings.moodStyle);
  const journalSerif = useData((s) => s.settings.journalSerif);

  const status = journalStatus(entry);
  const archived = status === "archived";
  const tags = entry?.tags ?? [];
  const focus = dayFocus({ sessions }, date);

  const [title, setTitle] = useState(entry?.journalTitle ?? "");
  const [md, setMd] = useState(entry?.journalMd ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(entry?.updatedAt ?? null);
  const [preview, setPreview] = useState<"split" | "edit">("split");
  const [tagDraft, setTagDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = !archived && (title !== (entry?.journalTitle ?? "") || md !== (entry?.journalMd ?? ""));

  // 自动保存：沿用 800ms 防抖；归档态不写盘
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => {
      updateJournal(date, { journalTitle: title, journalMd: md });
      setSavedAt(Date.now());
    }, 800);
    return () => window.clearTimeout(id);
  }, [title, md, date, dirty, updateJournal]);

  /** 把编辑器里的内容立刻落盘（归档前 / 离开页面前调用） */
  const flush = () => {
    if (title === (entry?.journalTitle ?? "") && md === (entry?.journalMd ?? "")) return;
    updateJournal(date, { journalTitle: title, journalMd: md });
    setSavedAt(Date.now());
  };

  // 离开页面时兜底保存，避免防抖窗口内的最后一次输入丢失
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  const onArchive = () => {
    flush(); // 先保存，再切状态，保证档案里是最新内容
    archiveJournal(date);
    setSavedAt(Date.now());
  };

  const canArchive = !!(title.trim() || md.trim() || entry?.mood);

  const onExport = () => {
    const content = buildJournalMarkdown({
      date,
      title: archived ? entry?.journalTitle : title,
      md: archived ? (entry?.journalMd ?? "") : md,
      mood: entry?.mood,
      tags,
      focusSeconds: focus.seconds,
      pomodoros: focus.pomodoros,
      archivedAt: entry?.archivedAt,
    });
    downloadText(journalFileName(date), content);
  };

  const applyTemplate = (text: string) => {
    setMd((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
    textareaRef.current?.focus();
  };

  const wrapSelection = (before: string, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next = md.slice(0, s) + before + md.slice(s, e) + after + md.slice(e);
    setMd(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  };

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, "").slice(0, 12);
    if (!t) return;
    if (!tags.includes(t)) updateJournal(date, { tags: [...tags, t] });
    setTagDraft("");
  };

  const removeTag = (tag: string) => updateJournal(date, { tags: tags.filter((t) => t !== tag) });

  const goDate = (d: string) => navigate(`/journal/${d}`);

  return (
    <div className="animate-in pb-10">
      {/* 头部：日期 + 右上角唯一 primary（完成并归档 / 档案态换成继续编辑+导出） */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted">Journal</div>
          <h1 className="mt-2 flex items-center gap-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">
            {formatDateLabel(date)}
            {isToday(date) && <span className="chip">今天</span>}
            {isFuture(date) && <span className="chip">未来</span>}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {archived ? (
            <>
              <button className="btn-soft" onClick={() => reopenJournal(date)}>
                <PenLine size={14} strokeWidth={1.75} /> 继续编辑
              </button>
              <button className="btn-ghost" onClick={onExport}>
                <Download size={14} strokeWidth={1.75} /> 导出该篇
              </button>
            </>
          ) : (
            <button
              className="btn-primary"
              onClick={onArchive}
              disabled={!canArchive}
              title={canArchive ? "把这一天收好，之后只读回看" : "先写点什么再归档"}
            >
              <Archive size={14} strokeWidth={1.75} /> 完成并归档
            </button>
          )}
        </div>
      </header>

      {/* 次级信息条：心情 + 状态徽章 + 日期切换 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {archived ? (
            <MoodReadonly value={entry?.mood} />
          ) : (
            <>
              <span className="text-[11px] uppercase tracking-[0.1em] text-muted">Mood</span>
              <MoodPicker value={entry?.mood} onChange={(m) => setMood(date, m)} showLabels style={moodStyle} />
            </>
          )}
          <StatusBadge archived={archived} archivedAt={entry?.archivedAt} />
        </div>

        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2 py-1 text-[12px]" onClick={() => navigate("/journal/library")}>
            <LibraryBig size={14} strokeWidth={1.75} /> 日记库
          </button>
          <span className="mx-1 h-3.5 w-px bg-[var(--c-line)]" />
          <button className="btn-ghost px-1.5 py-1.5" onClick={() => goDate(addDays(date, -1))} aria-label="前一天">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button className="btn-soft px-3 py-1 text-[12px]" onClick={() => goDate(localDateOf())}>
            今天
          </button>
          <button className="btn-ghost px-1.5 py-1.5" onClick={() => goDate(addDays(date, 1))} aria-label="后一天">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* 草稿 ↔ 档案：320ms 上移 4px + 淡入（key 变化时重播） */}
      <div key={status} className="journal-swap mt-6">
        {archived ? (
          <article className="card px-9 py-8">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
              Archive{entry?.archivedAt ? ` · 归档于 ${formatArchivedAt(entry.archivedAt)}` : ""}
            </div>
            <h2 className="mt-2.5 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-strong">
              {entry?.journalTitle?.trim() || "无题"}
            </h2>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-sub">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: moodOf(entry?.mood)?.color ?? "var(--c-line)" }}
                />
                心情 · {moodOf(entry?.mood)?.label ?? "未记录"}
              </span>
              <span>专注 {formatFocusCn(focus.seconds)}</span>
              {focus.pomodoros > 0 && <span>{focus.pomodoros} 个番茄</span>}
              <span className="numeric">{charCount(entry?.journalMd ?? "")} 字</span>
            </div>

            <div className="my-7 h-px bg-[var(--c-line)]" />

            <div className="max-w-[68ch]">
              {entry?.journalMd.trim() ? (
                <MarkdownView serif={journalSerif}>{entry.journalMd}</MarkdownView>
              ) : (
                <p className="text-[13.5px] text-muted">这篇没有正文，只有确认过的这一天。</p>
              )}
            </div>

            {tags.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--c-line)] pt-5">
                <span className="text-[11px] uppercase tracking-[0.1em] text-muted">Tags</span>
                {tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </article>
        ) : (
          <>
            {/* 编辑工具条 */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-0.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    className="btn-ghost px-2 py-1 text-[11.5px]"
                    onClick={() => applyTemplate(t.text)}
                  >
                    {t.label}
                  </button>
                ))}
                <span className="mx-1.5 h-3.5 w-px bg-[var(--c-line)]" />
                <button className="btn-ghost px-2 py-1" title="粗体 Ctrl+B" onClick={() => wrapSelection("**")}>
                  <b className="text-[11px]">B</b>
                </button>
                <button className="btn-ghost px-2 py-1" title="行内代码" onClick={() => wrapSelection("`")}>
                  <span className="font-mono text-[10.5px]">{"</>"}</span>
                </button>
                <button
                  className={cn("btn-ghost px-2 py-1", preview === "split" && "text-strong")}
                  title={preview === "split" ? "只看编辑" : "分栏预览"}
                  onClick={() => setPreview(preview === "split" ? "edit" : "split")}
                >
                  {preview === "split" ? (
                    <Pencil size={14} strokeWidth={1.75} />
                  ) : (
                    <Eye size={14} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-7 pt-6">
                <input
                  className="w-full max-w-[68ch] bg-transparent text-[20px] font-semibold tracking-[-0.01em] text-strong outline-none placeholder:font-normal placeholder:text-muted"
                  placeholder="给今天起个标题（可选）"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                {/* 标签：回车添加，点 × 移除 */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                      <button
                        className="-mr-1 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                        onClick={() => removeTag(t)}
                        aria-label={`移除标签 ${t}`}
                      >
                        <X size={10} strokeWidth={2.25} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="w-[132px] bg-transparent text-[11.5px] text-ink outline-none placeholder:text-muted"
                    placeholder={tags.length ? "+ 标签" : "添加标签，回车确认"}
                    value={tagDraft}
                    maxLength={12}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "mt-4 grid",
                  preview === "split" ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1",
                )}
              >
                <div className={cn("px-7 pb-6", preview === "split" && "border-r border-[var(--c-line)]")}>
                  <textarea
                    ref={textareaRef}
                    className="min-h-[430px] w-full resize-none bg-transparent text-[14.5px] leading-[1.9] text-ink outline-none placeholder:text-muted"
                    style={{ caretColor: "var(--c-accent)" }}
                    placeholder={"写点什么，哪怕一句。\n\n支持 Markdown：# 标题、**粗体**、- 列表、> 引用"}
                    value={md}
                    onChange={(e) => setMd(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                        e.preventDefault();
                        wrapSelection("**");
                      }
                    }}
                  />
                </div>

                {preview === "split" && (
                  <div className="max-h-[560px] overflow-y-auto px-7 pb-6">
                    {md.trim() ? (
                      <MarkdownView serif={journalSerif}>{md}</MarkdownView>
                    ) : (
                      <p className="text-[13px] text-muted">预览会出现在这里。</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--c-line)] px-7 py-2.5 text-[11px] text-muted">
                <span className="numeric">{charCount(md)} 字</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      dirty ? "animate-pulse bg-[var(--c-accent)]" : "bg-[var(--c-muted)]",
                    )}
                  />
                  {dirty ? "正在保存" : savedAt ? `已保存 ${formatClockTime(savedAt)}` : "自动保存"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 档案态的心情：只读展示 */
function MoodReadonly({ value }: { value?: Mood }) {
  const meta = moodOf(value);
  return (
    <span className="flex items-center gap-2 text-[12.5px] text-sub">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta?.color ?? "var(--c-line)" }} />
      心情 · {meta?.label ?? "未记录"}
    </span>
  );
}
