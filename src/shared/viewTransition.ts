import { useCallback, useMemo } from "react";

/**
 * View Transitions API 的最小本地类型声明。
 * 不安装 @types/dom-view-transitions，也不依赖 lib.dom 是否已更新。
 */
interface ViewTransitionLike {
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  readonly finished: Promise<void>;
  skipTransition(): void;
}

interface ViewTransitionCapableDocument {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionLike;
}

interface ViewTransitionOptions {
  /** 会写到根元素的 data-vt 上，多个值用空格连接，供 CSS 的 [data-vt~="..."] 使用 */
  types?: string[];
  /** 本次不启用转场，直接同步执行 update */
  skip?: boolean;
}

const TYPES_ATTRIBUTE = "data-vt";

/** 同一时间只保留一个转场；结束（或中止）前再次触发只做同步更新 */
let transitionInFlight = false;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getStartViewTransition(): ((updateCallback: () => void) => ViewTransitionLike) | null {
  if (typeof document === "undefined" || !("startViewTransition" in document)) return null;

  const doc = document as unknown as ViewTransitionCapableDocument;
  const start = doc.startViewTransition;
  if (typeof start !== "function") return null;

  return start.bind(doc);
}

function normalizeTypes(types?: string[]): string {
  if (!types?.length) return "";

  const unique = new Set<string>();
  for (const raw of types) {
    for (const part of raw.trim().split(/\s+/)) {
      if (part) unique.add(part);
    }
  }
  return Array.from(unique).join(" ");
}

/** 浏览器是否支持 document.startViewTransition（降低动效时视为不支持） */
export function supportsViewTransition(): boolean {
  return !prefersReducedMotion() && getStartViewTransition() !== null;
}

/**
 * 支持则包一层 view transition，不支持或降低动效时直接同步执行 update()。
 * `types` 会临时写入根元素的 data-vt，转场 finished 之后（finally）移除/还原。
 */
export function startViewTransition(
  update: () => void,
  options: ViewTransitionOptions = {},
): void {
  const start = getStartViewTransition();

  // 不支持、降低动效、显式跳过，或上一个转场尚未结束：直接同步更新，不排队。
  if (!start || options.skip || prefersReducedMotion() || transitionInFlight) {
    update();
    return;
  }

  const root = document.documentElement;
  const types = normalizeTypes(options.types);
  const previousTypes = root.getAttribute(TYPES_ATTRIBUTE);
  let appliedTypes = false;

  if (types) {
    root.setAttribute(TYPES_ATTRIBUTE, types);
    appliedTypes = true;
  }

  transitionInFlight = true;

  const cleanup = () => {
    if (appliedTypes && root.getAttribute(TYPES_ATTRIBUTE) === types) {
      if (previousTypes === null) root.removeAttribute(TYPES_ATTRIBUTE);
      else root.setAttribute(TYPES_ATTRIBUTE, previousTypes);
    }
    transitionInFlight = false;
  };

  let transition: ViewTransitionLike | null = null;

  try {
    transition = start(() => {
      try {
        update();
      } catch (error) {
        // 更新失败时立刻中止转场，避免页面停在旧的快照上；原始错误继续向上抛。
        try {
          transition?.skipTransition();
        } catch {
          // skip 自身失败不应覆盖 update 的原始错误
        }
        throw error;
      }
    });
  } catch (error) {
    cleanup();
    throw error;
  }

  if (!transition) {
    cleanup();
    return;
  }

  // finished 在主动 skip 或 update 抛错时会 reject，这里只用于清理，不吞掉 update 的错误。
  void transition.finished.catch(() => {}).finally(cleanup);
}

/** React hook：返回 { supported, start }；无 document 的环境下 supported 为 false */
export function useViewTransition(): {
  supported: boolean;
  start: (update: () => void, options?: ViewTransitionOptions) => void;
} {
  const supported = useMemo(supportsViewTransition, []);
  const start = useCallback((update: () => void, options?: ViewTransitionOptions) => {
    startViewTransition(update, options);
  }, []);

  return useMemo(() => ({ supported, start }), [supported, start]);
}
