import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { QUOTES } from "./quotes";
import "./quotes.css";

const DEFAULT_INTERVAL_MS = 12_000;
/** 切换动画时长，需与 quotes.css 中的 animation-duration 保持一致 */
const SWITCH_MS = 400;
/** 指示点数量：始终 5 个，代表最近 5 次停靠的位置 */
const DOT_COUNT = 5;

export interface QuoteRotatorProps {
  /** 紧凑模式：字号更小、内边距更小 */
  compact?: boolean;
  /** 轮播间隔，默认 12000ms */
  intervalMs?: number;
  className?: string;
}

/** Fisher–Yates 洗牌，原地打乱并返回同一个数组 */
function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * 从队列里取下一条：一轮之内不重复，一轮结束后重新洗牌。
 * 队列里恰好不含 current，因此跨轮也不会出现「连续两条相同」。
 */
function drawNextIndex(queue: number[], current: number): number {
  if (QUOTES.length <= 1) return current;

  if (queue.length === 0) {
    const pool: number[] = [];
    for (let i = 0; i < QUOTES.length; i += 1) {
      if (i !== current) pool.push(i);
    }
    queue.push(...shuffle(pool));
  }

  let next = queue.pop();
  if (next === undefined || next === current) {
    // 兜底：正常情况下走不到这里，避免任何边界情况下原地卡住
    next = (current + 1) % QUOTES.length;
    if (next === current) return current;
    const rest = queue.filter((i) => i !== next);
    queue.length = 0;
    queue.push(...rest);
  }
  return next;
}

function normalizeInterval(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_INTERVAL_MS;
  }
  // 过短的间隔会让两段 400ms 动画叠在一起，给个下限
  return Math.max(800, Math.round(value));
}

/** 监听系统「减少动效」偏好；首帧同步读取，避免先播动画再跳变 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    // 极老内核的兜底
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return reduced;
}

export default function QuoteRotator({
  compact = false,
  intervalMs,
  className,
}: QuoteRotatorProps): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const motion = !reduced;

  const [index, setIndex] = useState<number>(() =>
    QUOTES.length > 0 ? Math.floor(Math.random() * QUOTES.length) : -1,
  );
  /** 正在淡出的上一条；reduced-motion 下始终为 null */
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  /** 已经切换过的次数，用来驱动 5 个指示点 */
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  /** 供定时器读取最新下标，避免把 index 塞进 useCallback 依赖里反复重建 */
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  /** 本轮还没用过的下标池 */
  const queueRef = useRef<number[]>([]);

  const advance = useCallback(() => {
    const from = indexRef.current;
    if (from < 0) return;
    const next = drawNextIndex(queueRef.current, from);
    if (next === from) return;

    if (motion) setPreviousIndex(from);
    setIndex(next);
    setStep((value) => value + 1);
  }, [motion]);

  const safeInterval = normalizeInterval(intervalMs);

  // 轮播：暂停 / 间隔变化 / 换句之后都重新计时；卸载时清掉
  useEffect(() => {
    if (paused || QUOTES.length <= 1) return;
    const timer = window.setTimeout(advance, safeInterval);
    return () => window.clearTimeout(timer);
  }, [paused, safeInterval, advance, index]);

  // 淡出的旧句只保留 400ms，随后从 DOM 移除，避免节点越积越多
  useEffect(() => {
    if (previousIndex === null) return;
    const timer = window.setTimeout(() => setPreviousIndex(null), SWITCH_MS);
    return () => window.clearTimeout(timer);
  }, [previousIndex]);

  // 运行中切到「减少动效」时，立即取消残留的淡出层
  useEffect(() => {
    if (reduced) setPreviousIndex(null);
  }, [reduced]);

  const currentQuote = index >= 0 ? QUOTES[index] : undefined;
  const previousQuote = previousIndex !== null ? QUOTES[previousIndex] : undefined;

  const rootClass = [
    "quote-rotator",
    compact ? "quote-rotator--compact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  // 数据为空时保持同样的外框，不返回 null（契约是 JSX.Element）
  if (!currentQuote) {
    return <div className={rootClass} role="group" aria-label="专注名言" />;
  }

  // 指示点：5 个位置循环，当前句高亮，前面几步依次变暗，表示最近 5 条的位置
  const activeDot = step % DOT_COUNT;
  const travelled = Math.min(step, DOT_COUNT - 1);
  const dots = Array.from({ length: DOT_COUNT }, (_, position) => {
    if (position === activeDot) return "active" as const;
    const back = (activeDot - position + DOT_COUNT) % DOT_COUNT;
    return back > 0 && back <= travelled ? ("visited" as const) : ("idle" as const);
  });

  return (
    <div
      className={rootClass}
      role="group"
      aria-label="专注名言"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="quote-rotator__stage">
        {motion && previousQuote && previousIndex !== null ? (
          <blockquote
            key={`prev-${step - 1}`}
            className="quote-rotator__slide quote-rotator__slide--leaving"
            aria-hidden="true"
          >
            <p className="quote-rotator__text">{previousQuote.text}</p>
          </blockquote>
        ) : null}

        <blockquote
          key={`current-${step}`}
          className={
            motion
              ? "quote-rotator__slide quote-rotator__slide--entering"
              : "quote-rotator__slide"
          }
        >
          <p className="quote-rotator__text">{currentQuote.text}</p>
        </blockquote>
      </div>

      <p className="quote-rotator__author" title={currentQuote.source}>
        —— {currentQuote.author}
      </p>

      <div className="quote-rotator__dots" aria-hidden="true">
        {dots.map((state, position) => (
          <span
            key={position}
            className={`quote-rotator__dot quote-rotator__dot--${state}`}
          />
        ))}
      </div>
    </div>
  );
}
