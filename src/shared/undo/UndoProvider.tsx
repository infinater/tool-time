import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Undo2 } from "lucide-react";
import "./undo.css";

export interface UndoItem {
  /** 撤销条上的文案，例如「已删除 3 篇日记」 */
  message: string;
  /** 只有点了「撤销」才会执行 */
  restore: () => void;
  /** 自动消失时间，默认 6000ms */
  ttlMs?: number;
  /**
   * 可选：这条操作「确认生效」时执行（超时自动消失 / 被新的一条顶掉时触发）。
   * 调用方如果采用「先本地移除、超时后才持久化删除」的策略，把真正的删除放在这里。
   * 注意：被新条目顶掉时同样按已确认处理，避免延迟删除永远不落地。
   */
  onExpire?: () => void;
}

export interface UndoApi {
  push: (item: UndoItem) => void;
}

const DEFAULT_TTL_MS = 6000;

const UndoContext = createContext<UndoApi | null>(null);

/** 没有 Provider 时的降级：不显示 UI、不会崩，仍按 ttl 结算 onExpire */
const fallbackApi: UndoApi = {
  push: (item) => {
    if (import.meta.env.DEV) {
      console.warn("[undo] 未找到 UndoProvider，撤销条不可用；该操作将按 ttl 直接结算。");
    }
    window.setTimeout(() => item.onExpire?.(), item.ttlMs ?? DEFAULT_TTL_MS);
  },
};

/**
 * 全局撤销条：底部居中滑入，只显示最新一条，默认 6 秒后自动消失。
 * 数据本身由调用方在 push 之前就本地移除并保留副本，所以这里只负责「撤销」这个动作。
 */
export function UndoProvider({ children }: { children: ReactNode }): ReactElement {
  const [item, setItem] = useState<(UndoItem & { id: number }) | null>(null);
  const itemRef = useRef<(UndoItem & { id: number }) | null>(null);
  const timerRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 生命周期：到点自动消失（清理函数只停表，不做结算，避免 StrictMode 下重复执行）
  useEffect(() => {
    itemRef.current = item;
    if (!item) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      itemRef.current = null;
      setItem((cur) => (cur && cur.id === item.id ? null : cur));
      item.onExpire?.();
    }, item.ttlMs ?? DEFAULT_TTL_MS);
    return stopTimer;
  }, [item, stopTimer]);

  const push = useCallback(
    (next: UndoItem) => {
      stopTimer();
      const prev = itemRef.current;
      if (prev) {
        // 多条时只保留最新一条：旧条直接作废（按已确认结算，避免调用方的延迟删除丢失）
        itemRef.current = null;
        prev.onExpire?.();
      }
      seqRef.current += 1;
      setItem({ ...next, id: seqRef.current });
    },
    [stopTimer],
  );

  const handleUndo = useCallback(() => {
    const cur = itemRef.current;
    stopTimer();
    itemRef.current = null;
    setItem(null);
    cur?.restore(); // 只有点「撤销」才恢复，超时什么都不做
  }, [stopTimer]);

  const api = useMemo<UndoApi>(() => ({ push }), [push]);
  const ttl = item?.ttlMs ?? DEFAULT_TTL_MS;

  return (
    <UndoContext.Provider value={api}>
      {children}
      {item && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-6 pb-6">
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className="undo-bar pointer-events-auto relative flex items-center gap-4 overflow-hidden rounded-[12px] py-2.5 pl-4 pr-2.5"
            style={{
              background: "var(--c-elevated)",
              border: "1px solid var(--c-line)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            <span className="text-[12.5px] text-ink">{item.message}</span>
            <button
              className="btn-ghost px-2.5 py-1 text-[12.5px] font-medium"
              style={{ color: "var(--c-accent-text)" }}
              onClick={handleUndo}
            >
              <Undo2 size={13} strokeWidth={1.75} /> 撤销
            </button>
            <span className="undo-progress" style={{ animationDuration: `${ttl}ms` }} aria-hidden />
          </div>
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoApi {
  return useContext(UndoContext) ?? fallbackApi;
}
