import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { useData } from "@/lib/store";
import { cn, localDateOf } from "@/lib/utils";

export default function SettingsPage() {
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const exportJSON = useData((s) => s.exportJSON);
  const importJSON = useData((s) => s.importJSON);
  const resetAll = useData((s) => s.resetAll);
  const sessions = useData((s) => s.sessions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2400);
  };

  const download = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tool-time-${localDateOf()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("已导出 JSON 备份");
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    flash(importJSON(text) ? "导入成功" : "导入失败：文件格式不对");
  };

  return (
    <div className="animate-in max-w-[880px]">
      <header>
        <div className="text-[12px] uppercase tracking-[0.14em] text-muted">Settings</div>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-strong">偏好与数据</h1>
      </header>

      <div className="mt-7 space-y-4">
        <Section title="计时" hint="改完立即生效，正在进行的番茄不受影响">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="专注" value={settings.workMinutes} min={5} max={90} onChange={(v) => updateSettings({ workMinutes: v })} />
            <NumberField
              label="短休息"
              value={settings.shortBreakMinutes}
              min={1}
              max={30}
              onChange={(v) => updateSettings({ shortBreakMinutes: v })}
            />
            <NumberField
              label="长休息"
              value={settings.longBreakMinutes}
              min={5}
              max={60}
              onChange={(v) => updateSettings({ longBreakMinutes: v })}
            />
          </div>
          <NumberField
            label="长休息间隔"
            value={settings.longBreakEvery}
            min={2}
            max={8}
            suffix="个番茄"
            onChange={(v) => updateSettings({ longBreakEvery: v })}
          />
          <Toggle
            label="专注结束后自动开始休息"
            hint="默认关闭，避免离开电脑时产生无意义记录"
            checked={settings.autoStartBreak}
            onChange={(v) => updateSettings({ autoStartBreak: v })}
          />
          <NumberField
            label="每日专注目标"
            value={settings.dailyGoalMinutes}
            min={30}
            max={720}
            step={30}
            onChange={(v) => updateSettings({ dailyGoalMinutes: v })}
          />
        </Section>

        <Section title="提醒与外观">
          <Toggle label="结束时播放提示音" checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
          <Divider />
          <Toggle
            label="开始专注时进入专注模式"
            hint="放大界面，只留计时和必要按钮；Esc 可随时退出"
            checked={settings.autoFocusMode}
            onChange={(v) => updateSettings({ autoFocusMode: v })}
          />
          <Divider />
          <ChoiceRow
            label="主题"
            hint="深色更适合长时间专注"
            options={[
              { value: "dark", label: "深色" },
              { value: "light", label: "浅色" },
            ]}
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v as "dark" | "light" })}
          />
          <Divider />
          <ChoiceRow
            label="一周从哪天开始"
            hint="影响日历排列与周统计"
            options={[
              { value: "1", label: "周一" },
              { value: "0", label: "周日" },
            ]}
            value={String(settings.weekStartsOn)}
            onChange={(v) => updateSettings({ weekStartsOn: Number(v) as 0 | 1 })}
          />
          <Divider />
          <ChoiceRow
            label="心情显示方式"
            hint="色环更克制，emoji 更直白"
            options={[
              { value: "color", label: "色环" },
              { value: "emoji", label: "表情" },
            ]}
            value={settings.moodStyle}
            onChange={(v) => updateSettings({ moodStyle: v as "color" | "emoji" })}
          />
          <Divider />
          <Toggle
            label="日记正文用衬线字体"
            hint="更像纸面书写，长文读起来更松"
            checked={settings.journalSerif}
            onChange={(v) => updateSettings({ journalSerif: v })}
          />
        </Section>

        <Section title="数据" hint={`本地共 ${sessions.length} 条专注记录，全部存在这台电脑上`}>
          <div className="flex flex-wrap gap-2">
            <button className="btn-soft" onClick={download}>
              <Download size={14} strokeWidth={1.75} /> 导出 JSON
            </button>
            <button className="btn-soft" onClick={() => fileRef.current?.click()}>
              <Upload size={14} strokeWidth={1.75} /> 导入 JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
            <button
              className="btn-soft"
              onClick={() => {
                if (window.confirm("清空全部数据？此操作不可撤销，建议先导出备份。")) {
                  resetAll();
                  flash("已清空");
                }
              }}
            >
              <RotateCcw size={14} strokeWidth={1.75} /> 清空数据
            </button>
          </div>
          {msg && <div className="text-[12px] text-accent-text">{msg}</div>}
          <p className="text-[11.5px] leading-relaxed text-muted">
            当前版本用本地存储持久化；接线 Tauri 后迁移到 SQLite，导出格式不变。
          </p>
        </Section>
      </div>

      <div className="py-10 text-center text-[11px] text-muted">番茄日历 v{__APP_VERSION__} · 数据不出本机</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card px-6 py-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-strong">{title}</h2>
        {hint && <p className="mt-1 text-[11.5px] text-muted">{hint}</p>}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px w-full" style={{ background: "color-mix(in srgb, var(--c-line) 55%, transparent)" }} />;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "分钟",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] text-muted">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          className="input numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))));
          }}
        />
        <span className="shrink-0 text-[11.5px] text-muted">{suffix}</span>
      </div>
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-1">
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[11.5px] text-muted">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-[var(--c-accent)]" : "bg-[var(--c-raised)]",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] h-4 w-4 rounded-full bg-white transition-transform duration-200",
            checked ? "translate-x-[19px]" : "translate-x-[3px]",
          )}
        />
      </button>
    </div>
  );
}

function ChoiceRow({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-1">
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[11.5px] text-muted">{hint}</div>}
      </div>
      <div className="flex gap-0.5 rounded-[9px] bg-[var(--c-elevated)] p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[7px] px-3 py-1 text-[12px] transition-colors",
              value === o.value ? "bg-[var(--c-raised)] text-strong" : "text-sub hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
