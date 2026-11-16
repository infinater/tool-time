import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAnimatedIndex, usePrefersReducedMotion } from "./useAnimatedIndex";

/** 契约见 docs/改进计划-v2.md 7.2 */
export interface HappinessGaugeProps {
  /** 开心度 0–100，null 表示还没有足够记录 */
  index: number | null;
  /** 参与计算的心情样本数 */
  samples?: number;
  /** 直径 px，默认 180 */
  size?: number;
  /** 是否播放动效，默认 true（仍受系统「减少动效」约束） */
  animate?: boolean;
}

type Rgb = readonly [number, number, number];

/**
 * 语义色锚点：低分冷灰蓝 → 中分金 → 高分绿 → 最高番茄红。
 * 在 sRGB 内按 index 线性插值，保证颜色连续、不整段跳色。
 */
const TONE_STOPS: ReadonlyArray<{ at: number; rgb: Rgb }> = [
  { at: 0, rgb: [127, 143, 166] }, // #7f8fa6 冷灰蓝
  { at: 50, rgb: [201, 162, 39] }, // #c9a227 金
  { at: 72, rgb: [111, 174, 124] }, // #6fae7c 绿
  { at: 88, rgb: [226, 103, 76] }, // #e2674c 番茄红
  { at: 100, rgb: [235, 96, 66] }, // 最高区间略微更亮
];

function clampIndex(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** 取 index 对应的插值颜色；v 已保证是 0–100 */
function toneAt(value: number): Rgb {
  const v = clampIndex(value);
  for (let i = 1; i < TONE_STOPS.length; i += 1) {
    const prev = TONE_STOPS[i - 1];
    const next = TONE_STOPS[i];
    if (v <= next.at) {
      const span = next.at - prev.at;
      const t = span > 0 ? (v - prev.at) / span : 0;
      return [
        Math.round(prev.rgb[0] + (next.rgb[0] - prev.rgb[0]) * t),
        Math.round(prev.rgb[1] + (next.rgb[1] - prev.rgb[1]) * t),
        Math.round(prev.rgb[2] + (next.rgb[2] - prev.rgb[2]) * t),
      ];
    }
  }
  return TONE_STOPS[TONE_STOPS.length - 1].rgb;
}

function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function rgbaCss(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** 区间文案：0–29 偏低 / 30–49 有点低 / 50–69 平稳 / 70–84 不错 / 85–100 很好 */
function bandLabel(value: number): string {
  if (value < 30) return "偏低";
  if (value < 50) return "有点低";
  if (value < 70) return "平稳";
  if (value < 85) return "不错";
  return "很好";
}

/** 主题 accent 转 rgba，供数值变化时的光晕使用（复用 --c-accent 的半透明 drop-shadow） */
function accentGlow(alpha = 0.72): string {
  if (typeof document === "undefined") return `rgba(232, 103, 76, ${alpha})`;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--c-accent").trim();
  const match = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!match) return `rgba(232, 103, 76, ${alpha})`;
  const n = Number.parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function HappinessGauge({ index, samples, size = 180, animate = true }: HappinessGaugeProps) {
  const reduced = usePrefersReducedMotion();
  const motion = animate && !reduced;

  // 尺寸兜底，防止 0 / NaN 导致除零
  const diameter = Number.isFinite(size) && size > 0 ? size : 180;
  // 统一取整，保证弧线、颜色、区间文案与中心数字一致
  const safeIndex =
    typeof index === "number" && Number.isFinite(index) ? clampIndex(Math.round(index)) : null;
  const hasValue = safeIndex !== null;

  // 数字滚动：首次 0 → 目标值，800ms easeOutCubic
  const animated = useAnimatedIndex(safeIndex, { duration: 800, animate });
  // 数据变为 null 的瞬间也要立刻显示「—」，不等动画状态收尾
  const shown =
    safeIndex === null || animated === null ? null : Math.round(clampIndex(animated));

  // 几何：整圆环，顶部起笔
  const strokeWidth = Math.max(6, Math.round(diameter * 0.072));
  const radius = Math.max(1, (diameter - strokeWidth) / 2 - diameter * 0.02);
  const circumference = 2 * Math.PI * radius;
  const center = diameter / 2;
  const progress = safeIndex === null ? 0 : safeIndex / 100;

  // 首次挂载：先画「空环」，下一帧再切到目标值，让 stroke-dashoffset 过渡生效
  const [drawn, setDrawn] = useState(!motion);
  useEffect(() => {
    if (!motion) {
      setDrawn(true);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [motion]);

  const arcRef = useRef<SVGCircleElement | null>(null);
  /** 只记录「目标值」，首次挂载与 null 不触发光晕 */
  const prevIndexRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const prev = prevIndexRef.current;
    prevIndexRef.current = safeIndex;

    if (prev === undefined || prev === null || safeIndex === null || prev === safeIndex) return;
    if (!motion) return;

    const el = arcRef.current;
    if (!el || typeof el.animate !== "function") return;

    // 弧线闪一次光晕：420ms，颜色取 --c-accent 的半透明投影
    const glow = accentGlow();
    const trail = el.animate(
      [
        { filter: "drop-shadow(0 0 0 rgba(0, 0, 0, 0))" },
        { filter: `drop-shadow(0 0 14px ${glow})`, offset: 0.4 },
        { filter: "drop-shadow(0 0 0 rgba(0, 0, 0, 0))" },
      ],
      { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    return () => trail.cancel();
  }, [safeIndex, motion]);

  const tone = safeIndex === null ? null : toneAt(safeIndex);
  const toneColor = tone === null ? "var(--c-muted)" : rgbCss(tone);
  const band = safeIndex === null ? null : bandLabel(safeIndex);
  const sampleCount =
    typeof samples === "number" && Number.isFinite(samples) && samples > 0 ? Math.round(samples) : 0;

  const dashLength = drawn ? circumference * (1 - progress) : circumference;
  const dotSize = Math.max(4, diameter * 0.03);

  const arcStyle: CSSProperties = {
    opacity: hasValue ? 1 : 0,
    transition: motion
      ? "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1), stroke 500ms ease-out, opacity 240ms ease-out"
      : "none",
    filter: tone === null ? undefined : `drop-shadow(0 0 6px ${rgbaCss(tone, 0.3)})`,
  };

  return (
    <div
      role="img"
      aria-label={
        safeIndex === null || band === null
          ? "还没有足够的心情记录"
          : `开心度 ${Math.round(safeIndex)} 分，${band}`
      }
      style={{
        position: "relative",
        width: diameter,
        height: diameter,
        flexShrink: 0,
        display: "inline-block",
      }}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* 轨道：有值时是浅色底环，无值时退化为虚线灰环 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={hasValue ? "var(--c-raised)" : "var(--c-line)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={hasValue ? undefined : `${strokeWidth * 0.45} ${strokeWidth * 1.15}`}
          opacity={hasValue ? 1 : 0.9}
        />

        {/* 进度弧：颜色随 index 连续插值，dashoffset 绘制 */}
        <circle
          ref={arcRef}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={toneColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashLength}
          transform={`rotate(-90 ${center} ${center})`}
          style={arcStyle}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: diameter * 0.025,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span
          className="numeric"
          style={{
            fontSize: diameter * 0.27,
            lineHeight: 1,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            color: hasValue ? "var(--c-strong)" : "var(--c-muted)",
          }}
        >
          {shown === null ? "—" : shown}
        </span>

        {hasValue && band !== null ? (
          <>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: Math.max(4, diameter * 0.028),
                fontSize: Math.max(11, diameter * 0.067),
                lineHeight: 1.2,
                color: "var(--c-sub)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: 999,
                  background: toneColor,
                  flexShrink: 0,
                }}
              />
              {band}
            </span>

            {sampleCount > 0 && (
              <span
                style={{
                  fontSize: Math.max(10, diameter * 0.056),
                  lineHeight: 1.2,
                  color: "var(--c-muted)",
                }}
              >
                基于 {sampleCount} 次记录
              </span>
            )}
          </>
        ) : (
          <span
            style={{
              maxWidth: diameter * 0.66,
              fontSize: Math.max(10, diameter * 0.058),
              lineHeight: 1.35,
              color: "var(--c-muted)",
            }}
          >
            还没有足够的心情记录
          </span>
        )}
      </div>
    </div>
  );
}
