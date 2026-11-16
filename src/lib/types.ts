export type SessionKind = "work" | "short_break" | "long_break";
export type SessionStatus = "running" | "completed" | "aborted" | "skipped";
export type Mood = 1 | 2 | 3 | 4 | 5;

export interface FocusSession {
  id: string;
  taskId?: string;
  kind: SessionKind;
  status: SessionStatus;
  plannedSeconds: number;
  actualSeconds: number;
  startedAt: number;
  endedAt?: number;
  pausedTotalMs: number;
  interruptions: number;
  /** YYYY-MM-DD，按本机时区归算，用于日历与统计 */
  localDate: string;
  note?: string;
}

export interface DayEntry {
  id: string;
  localDate: string;
  mood?: Mood;
  tags: string[];
  journalTitle?: string;
  journalMd: string;
  isBackfilled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  status: "todo" | "done";
  estPomodoros: number;
  createdAt: number;
}

export interface Reflection {
  id: string;
  sessionId?: string;
  localDate: string;
  type: "quick" | "daily";
  contentMd: string;
  createdAt: number;
}

export interface Settings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoStartBreak: boolean;
  sound: boolean;
  theme: "dark" | "light";
  weekStartsOn: 0 | 1;
  dailyGoalMinutes: number;
  /** 心情用色环还是 emoji */
  moodStyle: "color" | "emoji";
  /** 日记正文用衬线（纸感） */
  journalSerif: boolean;
  /** 开始专注时自动进入专注模式（放大，只留计时） */
  autoFocusMode: boolean;
  /** 上次选择的专注时长（null = 跟随 workMinutes） */
  workMinutesDraft: number | null;
}

export interface DBShape {
  version: number;
  tasks: Task[];
  sessions: FocusSession[];
  dayEntries: DayEntry[];
  reflections: Reflection[];
  settings: Settings;
}

export const MOODS: { value: Mood; emoji: string; label: string; color: string }[] = [
  { value: 1, emoji: "😞", label: "很糟", color: "#8b8f9a" },
  { value: 2, emoji: "😕", label: "低落", color: "#7f8fa6" },
  { value: 3, emoji: "😐", label: "一般", color: "#c9a227" },
  { value: 4, emoji: "🙂", label: "不错", color: "#6fae7c" },
  { value: 5, emoji: "🤩", label: "很好", color: "#e2674f" },
];

export function moodOf(value?: Mood) {
  return MOODS.find((m) => m.value === value);
}
