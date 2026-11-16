import { MOODS, type Mood } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value?: Mood;
  onChange: (mood: Mood) => void;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  /** 强制指定显示样式，不传则跟随设置（由使用方决定） */
  style?: "color" | "emoji";
}

const SIZES = { sm: 26, md: 30, lg: 34 } as const;

export default function MoodPicker({ value, onChange, size = "md", showLabels = false, style = "color" }: Props) {
  const px = SIZES[size];

  return (
    <div className={cn("flex items-end", showLabels ? "gap-5" : "gap-2")}>
      {MOODS.map((m) => {
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            title={m.label}
            aria-label={m.label}
            aria-pressed={active}
            onClick={() => onChange(m.value)}
            className="group flex select-none flex-col items-center gap-2"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full text-[15px] transition-all duration-200",
                !active && "opacity-70 group-hover:opacity-100",
              )}
              style={{
                width: px,
                height: px,
                background: style === "emoji" ? "var(--c-elevated)" : m.color,
                transform: active ? "translateY(-2px)" : undefined,
                boxShadow: active
                  ? `0 0 0 2px var(--c-bg), 0 0 0 4px color-mix(in srgb, ${m.color} 55%, transparent)`
                  : undefined,
              }}
            >
              {style === "emoji" ? m.emoji : ""}
            </span>
            {showLabels && (
              <span className={cn("text-[11.5px] transition-colors", active ? "text-ink" : "text-muted")}>{m.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
