import { useEffect, useState } from "react";
import { remainingMs, useTimer } from "./timerStore";

/**
 * 只在计时器子树内部推导剩余时间：
 * - 只有运行中才启动 interval，空闲/暂停时不再触发任何渲染
 * - 不写回 store，避免整页重渲染
 */
export function useRemaining(intervalMs = 100): number {
  const status = useTimer((s) => s.status);
  const plannedSeconds = useTimer((s) => s.plannedSeconds);
  const startedAt = useTimer((s) => s.startedAt);
  const pausedTotalMs = useTimer((s) => s.pausedTotalMs);
  const pausedAt = useTimer((s) => s.pausedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [status, intervalMs]);

  return remainingMs({ status, plannedSeconds, startedAt, pausedTotalMs, pausedAt }, now);
}
