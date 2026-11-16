import type { CSSProperties } from "react";
import type { DBShape, DayEntry, FocusSession } from "./types";
import { addDays, localDateOf, parseLocalDate } from "./utils";

export function sessionsOn(db: Pick<DBShape, "sessions">, date: string): FocusSession[] {
  return db.sessions.filter((s) => s.localDate === date).sort((a, b) => a.startedAt - b.startedAt);
}

export function workSessionsOn(db: Pick<DBShape, "sessions">, date: string): FocusSession[] {
  return sessionsOn(db, date).filter((s) => s.kind === "work" && s.status === "completed");
}

export function focusSecondsOn(db: Pick<DBShape, "sessions">, date: string): number {
  return workSessionsOn(db, date).reduce((sum, s) => sum + s.actualSeconds, 0);
}

export function pomodorosOn(db: Pick<DBShape, "sessions">, date: string): number {
  return workSessionsOn(db, date).length;
}

export function dayEntryOn(db: Pick<DBShape, "dayEntries">, date: string): DayEntry | undefined {
  return db.dayEntries.find((e) => e.localDate === date);
}

export type HeatLevel = 0 | 1 | 2 | 3;

export function heatLevel(seconds: number): HeatLevel {
  if (seconds <= 0) return 0;
  if (seconds < 30 * 60) return 1;
  if (seconds < 90 * 60) return 2;
  return 3;
}

export function heatStyle(level: HeatLevel): CSSProperties {
  if (level === 0) return {};
  return { backgroundColor: `var(--c-heat-${level})` };
}

/** 热力条宽度：以 2 小时为满格 */
export function heatWidth(seconds: number): string {
  const pct = Math.min(100, Math.round((seconds / (120 * 60)) * 100));
  return `${pct}%`;
}

/** 连续记录天数（有专注或心情或日记即算），从今天/昨天往前数 */
export function streakDays(db: Pick<DBShape, "sessions" | "dayEntries">): number {
  let streak = 0;
  let cursor = localDateOf();
  const hasRecord = (date: string) =>
    focusSecondsOn(db, date) > 0 ||
    !!dayEntryOn(db, date)?.mood ||
    !!dayEntryOn(db, date)?.journalMd.trim();

  if (!hasRecord(cursor)) cursor = addDays(cursor, -1);
  while (hasRecord(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface MonthSummary {
  focusSeconds: number;
  pomodoros: number;
  recordedDays: number;
  avgMood: number | null;
}

export function monthSummary(db: Pick<DBShape, "sessions" | "dayEntries">, monthDate: Date): MonthSummary {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let focusSeconds = 0;
  let pomodoros = 0;
  let recordedDays = 0;
  const moods: number[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = localDateOf(new Date(y, m, d));
    const secs = focusSecondsOn(db, date);
    focusSeconds += secs;
    pomodoros += pomodorosOn(db, date);
    const entry = dayEntryOn(db, date);
    if (secs > 0 || entry?.mood || entry?.journalMd.trim()) recordedDays++;
    if (entry?.mood) moods.push(entry.mood);
  }

  return {
    focusSeconds,
    pomodoros,
    recordedDays,
    avgMood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
  };
}

/** 生成月视图网格（含前后补齐），周一或周日起始 */
export function monthGrid(monthDate: Date, weekStartsOn: 0 | 1): string[] {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const cells: string[] = [];
  const start = new Date(y, m, 1 - offset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(localDateOf(d));
  }
  return cells;
}

export function weekdays(weekStartsOn: 0 | 1): string[] {
  const base = ["日", "一", "二", "三", "四", "五", "六"];
  const arr = weekStartsOn === 1 ? [...base.slice(1), base[0]] : base;
  return arr;
}

export function monthOf(date: string): Date {
  const d = parseLocalDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
