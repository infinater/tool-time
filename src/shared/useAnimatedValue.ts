import { useEffect, useRef, useState } from "react";

/** 数字过渡：默认 easeOutCubic，520ms；尊重 prefers-reduced-motion */
export function useAnimatedValue(value: number, duration = 520): number {
  const [display, setDisplay] = useState(value);
  const currentRef = useRef(value);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const from = currentRef.current;
    const delta = value - from;
    if (Math.abs(delta) < 0.001) return;

    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + delta * eased;
      currentRef.current = next;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(step);
      else currentRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}
