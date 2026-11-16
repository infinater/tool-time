import type { DBShape, DayEntry, Mood } from "@/lib/types";
import { moodOf } from "@/lib/types";
import { focusSecondsOn, pomodorosOn } from "@/lib/selectors";
import { formatDateLabel, parseLocalDate } from "@/lib/utils";

/** 日记状态：从数据层推导，缺字段（老数据）一律按草稿处理 */
export type JournalStatus = DayEntry["status"];

export function journalStatus(entry?: DayEntry): JournalStatus {
  return entry?.status === "archived" ? "archived" : "draft";
}

/** 字数：去掉空白后的字符数（中英混排都说得通） */
export function charCount(md: string): number {
  return md.replace(/\s+/g, "").length;
}

/** 这一天的专注摘要（只统计已完成的工作番茄） */
export function dayFocus(db: Pick<DBShape, "sessions">, date: string): { seconds: number; pomodoros: number } {
  return { seconds: focusSecondsOn(db, date), pomodoros: pomodorosOn(db, date) };
}

/** 中文口语化的专注时长 */
export function formatFocusCn(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins <= 0) return "无专注记录";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
  return `${m} 分钟`;
}

/** 卡片里更短的专注时长 */
export function formatFocusShort(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins <= 0) return "—";
  if (mins < 60) return `${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

/** HH:mm */
export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 归档时间：同年省略年份，跨年补上 */
export function formatArchivedAt(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const ymd = `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${formatClockTime(ts)}`;
  return d.getFullYear() === new Date().getFullYear() ? ymd : `${d.getFullYear()} 年 ${ymd}`;
}

/** 这个 day_entry 值不值得出现在日记库 / 档案页 */
export function entryIsListable(entry: DayEntry): boolean {
  return (
    journalStatus(entry) === "archived" ||
    !!entry.mood ||
    !!entry.journalTitle?.trim() ||
    !!entry.journalMd.trim()
  );
}

/** 去掉 Markdown 记号，得到便于列表展示的纯文本 */
function stripMarkup(line: string): string {
  return line
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.)\s*/, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

/** 标题：手写标题 > 正文首个非空行 > 「无题」 */
export function entryTitleOf(entry: DayEntry): string {
  const manual = entry.journalTitle?.trim();
  if (manual) return manual;
  for (const line of entry.journalMd.split("\n")) {
    const text = stripMarkup(line);
    if (text) return text;
  }
  return "无题";
}

/** 摘要：正文里除了标题那一行之外剩下的文字；没有就返回空串（卡片不再重复标题） */
export function entryPreviewOf(entry: DayEntry, limit = 90): string {
  const lines = entry.journalMd.split("\n").map(stripMarkup).filter(Boolean);
  const title = entryTitleOf(entry);
  const rest = lines.filter((l) => l !== title).join(" ").trim();
  if (!rest) return "";
  return rest.length > limit ? `${rest.slice(0, limit)}…` : rest;
}

/** 心情的展示信息（色点需要颜色，标签需要中文） */
export function moodMeta(value?: Mood) {
  return moodOf(value);
}

/** 导出用文件名 */
export function journalFileName(date: string): string {
  return `日记-${date}.md`;
}

/** 拼一篇可导出的 Markdown：头信息 + 正文 + 标签 */
export function buildJournalMarkdown(input: {
  date: string;
  title?: string;
  md: string;
  mood?: Mood;
  tags?: string[];
  focusSeconds: number;
  pomodoros: number;
  archivedAt?: number;
}): string {
  const { date, title, md, mood, tags, focusSeconds, pomodoros, archivedAt } = input;
  const d = parseLocalDate(date);
  const meta: string[] = [date, `星期${"日一二三四五六"[d.getDay()]}`];
  if (mood) meta.push(`心情：${moodOf(mood)?.label ?? ""}`);
  if (focusSeconds > 0) meta.push(`专注：${formatFocusCn(focusSeconds)}`);
  if (pomodoros > 0) meta.push(`${pomodoros} 个番茄`);

  const head = [`# ${title?.trim() || formatDateLabel(date)}`, "", `> ${meta.join(" · ")}`];
  if (archivedAt) head[head.length - 1] = `${head[head.length - 1]}\n> 归档于 ${formatArchivedAt(archivedAt)}`;
  if (tags?.length) head.push(">", `> 标签：${tags.join("、")}`);

  return `${head.join("\n")}\n\n${md.trim()}\n`;
}

/** 把文本作为文件下载（不引入任何依赖，浏览器 / WebView 通用） */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
