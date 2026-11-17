import type { DayEntry } from "@/lib/types";
import { localDateOf, parseLocalDate } from "@/lib/utils";

/** 格子 / 详情面板共用的日记标记状态 */
export type DayJournalState = "none" | "draft" | "archived";

/**
 * 严格校验 YYYY-MM-DD：
 * 既要格式对，也要是真实存在的日期（挡掉 2026-02-31 这类溢出值）。
 */
export function isValidDateString(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return localDateOf(parseLocalDate(value)) === value;
}

/**
 * 日记标记：已归档优先；草稿要有实际内容（正文或标题）才算「有日记」，
 * 只有心情的 day_entry 不算写过日记。
 */
export function journalStateOf(entry: DayEntry | undefined): DayJournalState {
  if (!entry) return "none";
  if (entry.status === "archived") return "archived";
  return entry.journalMd.trim() || entry.journalTitle?.trim() ? "draft" : "none";
}

/** 详情面板里「过去某天」的日记按钮文案：按 day_entry.status 切换 */
export function pastJournalAction(entry: DayEntry | undefined): { label: string; archived: boolean } {
  if (!entry) return { label: "写日记", archived: false };
  if (entry.status === "archived") return { label: "查看档案", archived: true };
  return { label: "继续编辑", archived: false };
}
