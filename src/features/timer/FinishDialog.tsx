import { useState } from "react";
import { Coffee, X } from "lucide-react";
import MoodPicker from "@/features/mood/MoodPicker";
import { useData } from "@/lib/store";
import type { Mood } from "@/lib/types";
import { localDateOf } from "@/lib/utils";
import { useTimer } from "./timerStore";

export default function FinishDialog() {
  const show = useTimer((s) => s.showFinish);
  const close = useTimer((s) => s.closeFinish);
  const startBreak = useTimer((s) => s.startBreak);
  const plannedSeconds = useTimer((s) => s.plannedSeconds);
  const settings = useData((s) => s.settings);
  const setMood = useData((s) => s.setMood);
  const addReflection = useData((s) => s.addReflection);

  const [mood, setMoodState] = useState<Mood | undefined>(undefined);
  const [note, setNote] = useState("");

  if (!show) return null;

  const date = localDateOf();
  const minutes = Math.round(plannedSeconds / 60);

  const save = (breakAfter: boolean) => {
    if (mood) setMood(date, mood);
    if (note.trim()) addReflection({ date, type: "quick", contentMd: note.trim() });
    setMoodState(undefined);
    setNote("");
    close();
    if (breakAfter) startBreak("short");
  };

  return (
    <div className="backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]">
      <div
        className="dialog-in w-full max-w-[420px] rounded-[18px] p-7"
        style={{ background: "var(--c-surface)", boxShadow: "var(--shadow-pop)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <circle cx="12" cy="14" r="7.6" fill="var(--c-accent)" />
                <path d="M12 6.4c1.5 0 2.9.5 2.9.5S14 4.3 12 3.2 9.1 6.9 9.1 6.9s1.4-.5 2.9-.5z" fill="#7eae7c" />
              </svg>
              <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-strong">一个番茄完成了</h3>
            </div>
            <p className="mt-1.5 text-[12.5px] text-sub">这次专注了 {minutes} 分钟，顺手记一下？</p>
          </div>
          <button className="btn-ghost -mr-2 -mt-1.5 px-1.5 py-1" onClick={() => save(false)} aria-label="关闭">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.1em] text-muted">Mood</div>
            <MoodPicker value={mood} onChange={setMoodState} size="lg" showLabels style={settings.moodStyle} />
          </div>
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted">Note</div>
            <input
              className="input"
              placeholder="刚刚在做什么？卡在哪？"
              value={note}
              maxLength={280}
              autoFocus
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save(false);
              }}
            />
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between">
          <button className="btn-ghost px-2 py-1 text-[12.5px]" onClick={() => save(false)}>
            跳过
          </button>
          <div className="flex gap-2">
            <button className="btn-soft" onClick={() => save(true)}>
              <Coffee size={14} strokeWidth={1.75} /> 保存并休息
            </button>
            <button className="btn-primary" onClick={() => save(false)}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
