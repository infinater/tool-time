import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, CalendarDays, Command, Lock, Moon, NotebookPen, Settings as SettingsIcon, Sun, Timer } from "lucide-react";
import { useData } from "@/lib/store";
import { cn, localDateOf } from "@/lib/utils";
import { useSystemBridge } from "@/lib/system";
import { useViewTransition } from "@/shared/viewTransition";
import { UndoProvider } from "@/shared/undo";
import CommandPalette, { type PaletteCommand } from "@/features/palette/CommandPalette";
import { useCommandPaletteHotkey } from "@/features/palette/useCommandPalette";
import { useTimer } from "@/features/timer/timerStore";
import TodayPage from "@/features/today/TodayPage";
import CalendarPage from "@/features/calendar/CalendarPage";
import JournalPage from "@/features/journal/JournalPage";
import JournalLibrary from "@/features/journal/JournalLibrary";
import StatsPage from "@/features/stats/StatsPage";
import SettingsPage from "@/features/settings/SettingsPage";
import FinishDialog from "@/features/timer/FinishDialog";
import FocusMode from "@/features/timer/FocusMode";
import StartConfirmDialog from "@/features/timer/StartConfirmDialog";

const NAV = [
  { to: "/", label: "今天", icon: Timer, end: true },
  { to: "/calendar", label: "日历", icon: CalendarDays },
  { to: "/journal", label: "日记", icon: NotebookPen },
  { to: "/stats", label: "统计", icon: BarChart3 },
  { to: "/settings", label: "设置", icon: SettingsIcon },
];

function TomatoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" aria-hidden>
      <circle cx="12" cy="14" r="7.6" fill="var(--c-accent)" />
      <path d="M12 6.4c1.5 0 2.9.5 2.9.5S14 4.3 12 3.2 9.1 6.9 9.1 6.9s1.4-.5 2.9-.5z" fill="#7eae7c" />
      <path d="M12 6.6v1.6" stroke="#7eae7c" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const settings = useData((s) => s.settings);
  const tasks = useData((s) => s.tasks);
  const updateSettings = useData((s) => s.updateSettings);
  const theme = settings.theme;

  const navigate = useNavigate();
  const location = useLocation();
  const { start: vtStart } = useViewTransition();

  // 系统桥：托盘/全局快捷键事件、番茄完成通知
  useSystemBridge();

  // 从 SQLite 恢复数据（浏览器下是 no-op）
  useEffect(() => {
    void useData.getState().hydrate();
  }, []);

  const go = useCallback(
    (to: string) => {
      if (location.pathname === to) return;
      // flushSync 保证新快照在同一帧内生成，否则 React 批处理会让转场"看不出变化"
      vtStart(() => flushSync(() => navigate(to)), { types: ["page"] });
    },
    [location.pathname, navigate, vtStart],
  );

  const [paletteOpen, setPaletteOpen] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("palette"),
  );
  useCommandPaletteHotkey(paletteOpen, setPaletteOpen);

  // 全局时钟：只负责到点结算，不写渲染状态
  useEffect(() => {
    const id = window.setInterval(() => useTimer.getState().tick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // 启动时恢复"上次选择的时长"；调试参数 ?focus=1 / ?run=1 / ?len=40
  useEffect(() => {
    const draft = useData.getState().settings.workMinutesDraft;
    if (draft && draft > 0) useTimer.getState().setWorkMinutes(draft);

    const params = new URLSearchParams(window.location.search);
    const len = Number(params.get("len"));
    if (Number.isFinite(len) && len > 0) useTimer.getState().setWorkMinutes(len);
    if (params.has("run")) useTimer.getState().startWork();
    if (params.has("focus")) useTimer.getState().openFocusMode();
  }, []);

  const commands = useMemo<PaletteCommand[]>(() => {
    const timer = () => useTimer.getState();
    const list: PaletteCommand[] = [
      { id: "nav-today", title: "今天", subtitle: "回到今日概览", group: "导航", keywords: "today home 首页 今日", run: () => go("/") },
      { id: "nav-calendar", title: "日历", subtitle: "按月回看专注与心情", group: "导航", keywords: "calendar rl 月历", run: () => go("/calendar") },
      { id: "nav-stats", title: "统计", subtitle: "专注时长与趋势", group: "导航", keywords: "stats report 报表", run: () => go("/stats") },
      { id: "nav-settings", title: "设置", subtitle: "时长、外观与数据", group: "导航", keywords: "settings config 偏好", run: () => go("/settings") },
      { id: "nav-journal", title: "日记", subtitle: "写或回看今天的记录", group: "导航", keywords: "journal diary 日记 记录", run: () => go(`/journal/${localDateOf()}`) },
      { id: "nav-journal-library", title: "日记库", subtitle: "浏览、搜索、整理所有日记", group: "导航", keywords: "library archive 日记库 归档 整理", run: () => go("/journal/library") },
      {
        id: "act-start",
        title: "开始专注",
        subtitle: `${timer().workMinutesOverride ?? settings.workMinutes} 分钟`,
        group: "动作",
        keywords: "focus start tomato 番茄 开始",
        run: () => timer().startWork(timer().taskId),
      },
      { id: "act-pause", title: "暂停计时", subtitle: "保留当前进度", group: "动作", keywords: "pause 暂停", run: () => timer().pause() },
      { id: "act-resume", title: "继续计时", group: "动作", keywords: "resume 继续", run: () => timer().resume() },
      { id: "act-abort", title: "放弃本次专注", group: "动作", keywords: "abort stop 取消 放弃", run: () => timer().abort() },
      {
        id: "act-journal",
        title: "写今天的日记",
        subtitle: "打开 Markdown 编辑器",
        group: "动作",
        keywords: "journal diary 日记 记录",
        run: () => go(`/journal/${localDateOf()}`),
      },
      {
        id: "act-theme",
        title: theme === "dark" ? "切换到浅色主题" : "切换到深色主题",
        group: "动作",
        keywords: "theme dark light 主题 深色 浅色",
        run: () => updateSettings({ theme: theme === "dark" ? "light" : "dark" }),
      },
    ];

    for (const task of tasks.filter((t) => t.status === "todo").slice(0, 8)) {
      list.push({
        id: `task-${task.id}`,
        title: task.title,
        subtitle: "开始专注这个任务",
        group: "任务",
        keywords: "task todo 任务 待办",
        run: () => {
          timer().startWork(task.id);
          go("/");
        },
      });
    }

    const today = localDateOf();
    for (const [label, offset] of [["今天", 0], ["昨天", 1], ["前天", 2]] as const) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      const date = offset === 0 ? today : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      list.push({
        id: `date-${date}`,
        title: `${label}的日记`,
        subtitle: date,
        group: "日期",
        keywords: "date journal 日记",
        run: () => go(`/journal/${date}`),
      });
    }

    return list;
  }, [tasks, theme, settings.workMinutes, go, updateSettings]);

  return (
    <UndoProvider>
      <div className="flex h-full">
      <aside className="flex w-[224px] shrink-0 flex-col px-3 py-5" style={{ viewTransitionName: "sidebar" }}>
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <TomatoMark />
          <div>
            <div className="text-[13.5px] font-semibold leading-tight text-strong">番茄日历</div>
            <div className="mt-0.5 text-[11px] text-muted">专注 · 心情 · 日记</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={(e) => {
                e.preventDefault();
                go(to);
              }}
              className={({ isActive }) => cn("nav-item", isActive && "nav-item-active")}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mt-3 flex items-center justify-between rounded-[9px] px-3 py-2 text-[12px] text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <span className="flex items-center gap-2">
            <Command size={13} strokeWidth={1.75} /> 命令
          </span>
          <span className="font-mono text-[10.5px]">Ctrl K</span>
        </button>

        <div className="mt-auto space-y-3 px-2 pt-6">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Lock size={11} strokeWidth={1.75} />
            数据仅存本机
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">v{__APP_VERSION__}</span>
            <button
              className="btn-ghost px-1.5 py-1"
              title={theme === "dark" ? "切换到浅色" : "切换到深色"}
              onClick={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })}
            >
              {theme === "dark" ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ viewTransitionName: "page" }}>
        <div className="w-full px-8 py-8 xl:px-10">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/library" element={<JournalLibrary />} />
            <Route path="/journal/:date" element={<JournalPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      <FinishDialog />
      <FocusMode />
      <StartConfirmDialog />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      </div>
    </UndoProvider>
  );
}
