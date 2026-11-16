import { BarChart3, CalendarRange, HeartPulse, Tags } from "lucide-react";
import AnimatedNumber from "@/shared/AnimatedNumber";
import HappinessGauge from "@/features/happiness/HappinessGauge";
import HappinessTrend from "@/features/happiness/HappinessTrend";
import { useData } from "@/lib/store";
import {
  focusSecondsOn,
  happinessAverage,
  happinessLastDays,
  monthSummary,
  pomodorosOn,
} from "@/lib/selectors";
import { addDays, formatDuration, localDateOf } from "@/lib/utils";

export default function StatsPage() {
  const sessions = useData((s) => s.sessions);
  const dayEntries = useData((s) => s.dayEntries);
  const today = localDateOf();
  const month = monthSummary({ sessions, dayEntries }, new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const values = days.map((d) => focusSecondsOn({ sessions }, d));
  const max = Math.max(60, ...values);
  const happinessPoints = happinessLastDays({ sessions, dayEntries }, 14);
  const happinessAvg = happinessAverage({ sessions, dayEntries }, addDays(today, -13), today);
  const happinessSamples = happinessPoints.reduce((acc, p) => acc + p.samples, 0);

  return (
    <div className="animate-in">
      <header>
        <div className="text-[12px] uppercase tracking-[0.14em] text-muted">Stats</div>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">这段时间怎么样</h1>
      </header>

      <div className="mt-7 grid grid-cols-3 gap-4">
        <div className="card px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-muted">本月专注</div>
          <div className="mt-2 numeric text-[26px] font-semibold tracking-[-0.02em] text-strong">
            <AnimatedNumber value={month.focusSeconds} format={formatDuration} />
          </div>
        </div>
        <div className="card px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-muted">本月番茄</div>
          <div className="mt-2 numeric text-[26px] font-semibold tracking-[-0.02em] text-strong">
            <AnimatedNumber value={month.pomodoros} />
          </div>
        </div>
        <div className="card px-6 py-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-muted">记录天数</div>
          <div className="mt-2 numeric text-[26px] font-semibold tracking-[-0.02em] text-strong">
            <AnimatedNumber value={month.recordedDays} />
            <span className="ml-1 text-[13px] font-normal text-sub">天</span>
          </div>
        </div>
      </div>

      <section className="card mt-4 px-6 py-5">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-strong">开心度</h2>
          <span className="text-[11px] text-muted">按每次专注的实际时长加权</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <HappinessGauge index={happinessAvg} samples={happinessSamples} size={150} />
          <div className="min-w-[240px] flex-1">
            <HappinessTrend points={happinessPoints} height={120} />
            <div className="mt-2 text-[11px] text-muted">最近 14 天 · 空白处表示当天没有心情记录</div>
          </div>
        </div>
      </section>

      <section className="card mt-4 px-6 py-5">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-strong">最近 14 天专注时长</h2>
          <span className="text-[11px] text-muted">单位：分钟</span>
        </div>

        <div className="relative h-[168px]">
          {/* 网格线：0 / 25 / 50 / 75 / 100% */}
          {[0, 25, 50, 75, 100].map((p) => (
            <div
              key={p}
              className="absolute inset-x-0 border-t"
              style={{
                bottom: `${p}%`,
                borderColor: p === 0 ? "var(--c-line)" : "color-mix(in srgb, var(--c-line) 45%, transparent)",
              }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-1.5">
            {days.map((d, i) => {
              const h = Math.round((values[i] / max) * 100);
              return (
                <div key={d} className="group relative flex h-full flex-1 items-end justify-center">
                  <div
                    className="bar-grow w-full max-w-[14px] rounded-[3px]"
                    style={{
                      height: `${Math.max(2, (h / 100) * 168)}px`,
                      background: "color-mix(in srgb, var(--c-accent) 62%, transparent)",
                    }}
                    title={`${d} · ${formatDuration(values[i])} · ${pomodorosOn({ sessions }, d)} 个番茄`}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 rounded-[4px] bg-[var(--c-raised)] opacity-0 transition-opacity group-hover:opacity-40" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex gap-1.5">
          {days.map((d) => (
            <div key={d} className="flex-1 text-center text-[10.5px] text-muted numeric">
              {Number(d.slice(8, 10))}
            </div>
          ))}
        </div>
      </section>

      <section className="card mt-4 px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={15} strokeWidth={1.75} className="text-accent" />
          <h2 className="text-[15px] font-semibold text-strong">更完整的报表（M4 上线）</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Planned icon={<HeartPulse size={14} strokeWidth={1.75} />} title="心情趋势与相关性" desc="7 日曲线、月度分布、专注与心情的相关性" />
          <Planned icon={<Tags size={14} strokeWidth={1.75} />} title="按任务/标签分布" desc="时间花在哪些事情上，哪类任务最容易中断" />
          <Planned icon={<CalendarRange size={14} strokeWidth={1.75} />} title="周报 / 年报" desc="一周回顾自动生成，可导出 Markdown" />
          <Planned icon={<BarChart3 size={14} strokeWidth={1.75} />} title="连续记录与目标" desc="streak 历史、目标达成率" />
        </div>
        <p className="mt-4 text-[12px] text-muted">这些先占位，等数据跑起来再做，避免过早优化统计口径。</p>
      </section>
    </div>
  );
}

function Planned({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[9px] bg-elevated px-4 py-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div>
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-muted">{desc}</div>
      </div>
    </div>
  );
}
