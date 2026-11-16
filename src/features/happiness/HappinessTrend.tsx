import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./useAnimatedIndex";

/** 与 selectors.happinessRange 的返回结构保持一致（samples 设为可选，容错更宽） */
export interface HappinessPoint {
  /** YYYY-MM-DD */
  date: string;
  /** 0–100，无数据为 null */
  index: number | null;
  /** 参与计算的心情样本数，仅用于悬浮说明 */
  samples?: number;
}

/** 契约见 docs/改进计划-v2.md 7.2 */
export interface HappinessTrendProps {
  points: HappinessPoint[];
  /** 高度 px，默认 120 */
  height?: number;
}

const PAD_X = 10;
const PAD_Y = 12;

interface Node {
  x: number;
  y: number;
}

function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** 只接受有限数值，其余一律视为「当天无记录」，保证任何情况下都不会出现 NaN */
function readIndex(point: HappinessPoint): number | null {
  return typeof point.index === "number" && Number.isFinite(point.index)
    ? clamp100(point.index)
    : null;
}

/** 把 YYYY-MM-DD 显示为「11 月 17 日」；格式异常时原样返回，不做 Date 解析 */
function formatDay(date: string): string {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!matched) return date;
  return `${Number(matched[2])} 月 ${Number(matched[3])} 日`;
}

/** 原生 title 文案：日期 + 分数 + 样本数 */
function hitTitle(point: HappinessPoint): string {
  const value = readIndex(point);
  const day = formatDay(point.date);
  if (value === null) return `${day} · 暂无记录`;

  const count =
    typeof point.samples === "number" && point.samples > 0
      ? ` · ${Math.round(point.samples)} 次记录`
      : "";
  return `${day} · 开心度 ${Math.round(value)} 分${count}`;
}

export interface TrendDot {
  x: number;
  y: number;
  /** 在 points 中的下标 */
  i: number;
  value: number;
}

export interface TrendSegmentShape {
  line: string;
  area: string;
}

export interface TrendLayout {
  n: number;
  xOf: (i: number) => number;
  yOf: (value: number) => number;
  shapes: TrendSegmentShape[];
  dots: TrendDot[];
  validCount: number;
  lastValidIndex: number;
}

/**
 * 纯几何计算：把 points 映射成像素坐标和路径字符串。
 * 连续非 null 的点连成一段，null 处断开；非法值按无记录处理，所有输出都不含 NaN。
 */
export function buildTrendLayout(
  points: HappinessPoint[],
  width: number,
  boxHeight: number,
  padY: number,
): TrendLayout {
  const n = points.length;
  const innerW = Math.max(1, width - PAD_X * 2);
  const innerH = Math.max(1, boxHeight - padY * 2);
  const xOf = (i: number) => (n <= 1 ? width / 2 : PAD_X + (i / (n - 1)) * innerW);
  const yOf = (value: number) => padY + (1 - clamp100(value) / 100) * innerH;

  const segments: Node[][] = [];
  let segment: Node[] = [];
  let validCount = 0;

  const flush = () => {
    if (segment.length > 0) {
      segments.push(segment);
      segment = [];
    }
  };

  points.forEach((point, i) => {
    const value = readIndex(point);
    if (value === null) {
      flush();
      return;
    }
    validCount += 1;
    segment.push({ x: xOf(i), y: yOf(value) });
  });
  flush();

  const bottom = boxHeight - padY;
  const shapes = segments.map((nodes) => {
    const line =
      nodes.length >= 2
        ? nodes
            .map((node, i) => `${i === 0 ? "M" : "L"}${node.x.toFixed(2)} ${node.y.toFixed(2)}`)
            .join(" ")
        : "";
    const area =
      nodes.length >= 2
        ? `${line} L${nodes[nodes.length - 1].x.toFixed(2)} ${bottom.toFixed(2)} L${nodes[0].x.toFixed(2)} ${bottom.toFixed(2)} Z`
        : "";
    return { line, area };
  });

  const dots: TrendDot[] = [];
  points.forEach((point, i) => {
    const value = readIndex(point);
    if (value === null) return;
    dots.push({ x: xOf(i), y: yOf(value), i, value });
  });

  return {
    n,
    xOf,
    yOf,
    shapes,
    dots,
    validCount,
    lastValidIndex: dots.length > 0 ? dots[dots.length - 1].i : -1,
  };
}

export default function HappinessTrend({ points, height = 120 }: HappinessTrendProps) {
  const reduced = usePrefersReducedMotion();
  const motion = !reduced;

  const boxHeight = Number.isFinite(height) && height > 0 ? height : 120;
  // 上下留白随高度收缩，极矮的图也不会把折线挤没
  const padY = Math.min(PAD_Y, boxHeight * 0.18);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  // 宽度自适应：用 ResizeObserver 拿真实像素宽，避免 viewBox 拉伸把线宽和圆点压扁
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const next = el.clientWidth;
      setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 进入动画：线条描画 + 点淡入；reduced-motion 时直接呈现终态
  const [drawn, setDrawn] = useState(!motion);
  const [revealed, setRevealed] = useState(!motion);

  useEffect(() => {
    if (!motion) {
      setDrawn(true);
      setRevealed(true);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setDrawn(true);
        setRevealed(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [motion]);

  const gradientId = `hg-trend-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const layout = useMemo(
    () => buildTrendLayout(points, width, boxHeight, padY),
    [points, width, boxHeight, padY],
  );

  const hasData = layout.validCount > 0;

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={hasData ? `开心度趋势，共 ${layout.n} 天` : "还没有心情记录"}
      style={{ position: "relative", width: "100%", minWidth: 0, height: boxHeight }}
    >
      {width > 0.5 && (
        <svg
          width={width}
          height={boxHeight}
          viewBox={`0 0 ${width} ${boxHeight}`}
          aria-hidden="true"
          focusable="false"
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            {/* 面积渐变：accent 10% 透明 → 完全透明 */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-accent)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--c-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 有数据时给 50 分参考线，空状态只留底部基线，避免和提示文字重叠 */}
          {hasData && (
            <line
              x1={PAD_X}
              x2={Math.max(PAD_X, width - PAD_X)}
              y1={layout.yOf(50)}
              y2={layout.yOf(50)}
              stroke="var(--c-line)"
              strokeWidth={1}
              strokeDasharray="2 6"
              opacity={0.55}
            />
          )}
          <line
            x1={PAD_X}
            x2={Math.max(PAD_X, width - PAD_X)}
            y1={boxHeight - padY}
            y2={boxHeight - padY}
            stroke="var(--c-line)"
            strokeWidth={1}
            opacity={0.4}
          />

          {/* 面积 */}
          {layout.shapes.map((shape, i) =>
            shape.area ? (
              <path
                key={`area-${i}`}
                d={shape.area}
                fill={`url(#${gradientId})`}
                stroke="none"
                opacity={revealed ? 1 : 0}
                style={{ transition: motion ? "opacity 420ms ease-out" : "none" }}
              />
            ) : null,
          )}

          {/* 折线：pathLength=1 + dashoffset，进入时 600ms 描画 */}
          {layout.shapes.map((shape, i) =>
            shape.line ? (
              <path
                key={`line-${i}`}
                d={shape.line}
                fill="none"
                stroke="var(--c-accent)"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={drawn ? 0 : 1}
                style={{
                  transition: motion
                    ? "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)"
                    : "none",
                }}
              />
            ) : null,
          )}

          {/* 数据点：逐点淡入，最后一个有效点加重 */}
          {layout.dots.map((dot) => {
            const isLast = dot.i === layout.lastValidIndex;
            const delay = motion ? `${Math.min(dot.i * 16, 300)}ms` : undefined;
            return (
              <g key={`dot-${dot.i}`}>
                {isLast && (
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={6}
                    fill="none"
                    stroke="var(--c-accent)"
                    strokeWidth={1}
                    opacity={revealed ? 0.3 : 0}
                    style={{
                      transition: motion ? "opacity 320ms ease-out" : "none",
                      transitionDelay: delay,
                    }}
                  />
                )}
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={isLast ? 3.4 : 2.4}
                  fill="var(--c-accent)"
                  opacity={revealed ? (isLast ? 1 : 0.55) : 0}
                  style={{
                    transition: motion ? "opacity 320ms ease-out" : "none",
                    transitionDelay: delay,
                  }}
                />
              </g>
            );
          })}

          {/* 命中区：原生 title 显示当天日期与分数 */}
          {points.map((point, i) => {
            const left = i === 0 ? 0 : (layout.xOf(i - 1) + layout.xOf(i)) / 2;
            const right =
              i === points.length - 1 ? width : (layout.xOf(i) + layout.xOf(i + 1)) / 2;
            return (
              <rect
                key={`hit-${i}`}
                x={left}
                y={0}
                width={Math.max(0, right - left)}
                height={boxHeight}
                fill="transparent"
              >
                <title>{hitTitle(point)}</title>
              </rect>
            );
          })}

          {!hasData && (
            <text
              x={width / 2}
              y={boxHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--c-muted)"
              fontSize={12}
            >
              还没有心情记录
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
