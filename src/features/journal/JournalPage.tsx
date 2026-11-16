import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import MarkdownView from "@/shared/MarkdownView";
import MoodPicker from "@/features/mood/MoodPicker";
import { useData } from "@/lib/store";
import { dayEntryOn } from "@/lib/selectors";
import { addDays, cn, formatDateLabel, isFuture, localDateOf } from "@/lib/utils";

const TEMPLATES: { label: string; text: string }[] = [
  { label: "一句话", text: "今天最想记住的一件事：\n\n" },
  { label: "三问复盘", text: "### 今天最有价值的一件事\n\n\n### 卡在哪里\n\n\n### 明天第一步\n\n" },
  { label: "自由书写", text: "" },
];

export default function JournalPage() {
  const params = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const dayEntries = useData((s) => s.dayEntries);
  const date = params.date ?? localDateOf();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <div className="card p-8 text-sm text-sub">日期格式不对。</div>;
  }

  const entry = dayEntryOn({ dayEntries }, date);
  const go = (d: string) => navigate(`/journal/${d}`);

  return (
    <div className="animate-in">
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-muted">Journal</div>
          <h1 className="mt-2 flex items-center gap-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">
            {formatDateLabel(date)}
            {date === localDateOf() && <span className="chip">今天</span>}
            {isFuture(date) && <span className="chip">未来</span>}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-1.5 py-1.5" onClick={() => go(addDays(date, -1))} aria-label="前一天">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button className="btn-soft px-3 py-1 text-[12px]" onClick={() => go(localDateOf())}>
            今天
          </button>
          <button className="btn-ghost px-1.5 py-1.5" onClick={() => go(addDays(date, 1))} aria-label="后一天">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="mt-7">
        <Editor key={date} date={date} initialTitle={entry?.journalTitle ?? ""} initialMd={entry?.journalMd ?? ""} />
      </div>
    </div>
  );
}

function Editor({ date, initialTitle, initialMd }: { date: string; initialTitle: string; initialMd: string }) {
  const updateJournal = useData((s) => s.updateJournal);
  const setMood = useData((s) => s.setMood);
  const moodStyle = useData((s) => s.settings.moodStyle);
  const journalSerif = useData((s) => s.settings.journalSerif);
  const entry = useData((s) => s.dayEntries.find((e) => e.localDate === date));

  const [title, setTitle] = useState(initialTitle);
  const [md, setMd] = useState(initialMd);
  const [savedAt, setSavedAt] = useState<number | null>(entry?.updatedAt ?? null);
  const [preview, setPreview] = useState<"split" | "edit">("split");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = title !== (entry?.journalTitle ?? "") || md !== (entry?.journalMd ?? "");

  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => {
      updateJournal(date, { journalTitle: title, journalMd: md });
      setSavedAt(Date.now());
    }, 800);
    return () => window.clearTimeout(id);
  }, [title, md, date, dirty, updateJournal]);

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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted">Mood</span>
          <MoodPicker value={entry?.mood} onChange={(m) => setMood(date, m)} showLabels style={moodStyle} />
        </div>
        <div className="flex items-center gap-0.5">
          {TEMPLATES.map((t) => (
            <button key={t.label} className="btn-ghost px-2 py-1 text-[11.5px]" onClick={() => applyTemplate(t.text)}>
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
            {preview === "split" ? <Pencil size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
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
        </div>

        <div className={cn("mt-4 grid", preview === "split" ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1")}>
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
          <span className="numeric">{md.length} 字</span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-[var(--c-accent)] animate-pulse" : "bg-[var(--c-muted)]")}
            />
            {dirty
              ? "正在保存"
              : savedAt
                ? `已保存 ${new Date(savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
                : "自动保存"}
          </span>
        </div>
      </div>
    </>
  );
}
