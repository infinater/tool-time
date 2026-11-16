import { useLayoutEffect, useRef } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * 列表 FLIP：元素需要带 data-flip-id。
 * 每次渲染后对比上一次的位置，位移过的元素用 transform 补一段动画（不影响布局）。
 */
export function useFlipList<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-flip-id]"));
    const next = new Map<string, number>();

    for (const el of nodes) {
      const id = el.dataset.flipId;
      if (!id) continue;
      const top = el.getBoundingClientRect().top;
      next.set(id, top);

      const before = positions.current.get(id);
      if (!reduced && before !== undefined && Math.abs(before - top) > 1) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
          duration: 260,
          easing: EASE,
        });
      }
    }

    positions.current = next;
  });

  return ref;
}
