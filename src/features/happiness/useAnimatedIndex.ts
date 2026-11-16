import { useEffect, useRef, useState } from "react";

/** 监听系统「减少动效」偏好。首帧同步读取，避免先播动画再跳变 */
export function usePrefersReducedMotion(): boolean {
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

export interface AnimatedIndexOptions {
  /** 动画时长 ms，默认 800 */
  duration?: number;
  /** 是否播放，默认 true（false 时直接显示终值） */
  animate?: boolean;
}

/**
 * 开心度数字滚动：首次 0 → 目标值，之后从当前值 → 新值。
 * 曲线固定 easeOutCubic，命中「减少动效」时直接跳到终值。
 * 返回动画中的小数，显示层自行取整。
 */
export function useAnimatedIndex(
  target: number | null,
  options: AnimatedIndexOptions = {},
): number | null {
  const { duration = 800, animate = true } = options;
  const reduced = usePrefersReducedMotion();
  const motion = animate && !reduced;
  // 非有限数视为「无数据」，避免 NaN 进入 SVG / 文本
  const goal = typeof target === "number" && Number.isFinite(target) ? target : null;

  const [display, setDisplay] = useState<number | null>(() => {
    if (goal === null) return null;
    return motion ? 0 : goal;
  });
  /** 记录当前显示值，作为下一次动画的起点 */
  const shownRef = useRef<number>(display ?? 0);

  useEffect(() => {
    if (goal === null) {
      shownRef.current = 0;
      setDisplay(null);
      return;
    }

    const span = Math.max(0, duration);
    if (!motion || span === 0) {
      shownRef.current = goal;
      setDisplay(goal);
      return;
    }

    const from = shownRef.current;
    const delta = goal - from;
    if (Math.abs(delta) < 0.01) {
      shownRef.current = goal;
      setDisplay(goal);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const next = from + delta * eased;
      shownRef.current = next;
      setDisplay(next);

      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        shownRef.current = goal;
        setDisplay(goal);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [goal, duration, motion]);

  return display;
}
