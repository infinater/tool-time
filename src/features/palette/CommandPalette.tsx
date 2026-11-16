import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search, SearchX } from "lucide-react";
import {
  groupRanked,
  rankCommands,
  type PaletteCommand,
  type RankedCommand,
} from "./useCommandPalette";

export type { PaletteCommand } from "./useCommandPalette";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}

/* ------------------------------------------------------------------ *
 * 小零件
 * ------------------------------------------------------------------ */

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 font-mono text-[10.5px] leading-none"
      style={{ background: "var(--c-elevated)", color: "var(--c-sub)" }}
    >
      {children}
    </kbd>
  );
}

/** 把命中位置用 accent 色标出来；连续命中合并成一个 span */
function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>;

  const chars = Array.from(text);
  const hits = new Set(indices);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < chars.length) {
    if (!hits.has(cursor)) {
      nodes.push(chars[cursor]);
      cursor += 1;
      continue;
    }
    let end = cursor;
    while (end < chars.length && hits.has(end)) end += 1;
    nodes.push(
      <span key={cursor} style={{ color: "var(--c-accent-text)" }}>
        {chars.slice(cursor, end).join("")}
      </span>,
    );
    cursor = end;
  }

  return <>{nodes}</>;
}

function CommandRow({
  entry,
  id,
  index,
  active,
  onHover,
  onRun,
}: {
  entry: RankedCommand;
  id: string;
  index: number;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}) {
  const { command, titleIndices, subtitleIndices } = entry;

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseMove={onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRun}
      className="relative cursor-default select-none rounded-[9px] px-2.5 py-2 transition-colors duration-[90ms]"
      style={{
        background: active ? "var(--c-raised)" : "transparent",
        boxShadow: active ? "inset 2px 0 0 0 var(--c-accent)" : undefined,
      }}
    >
      <div className="min-w-0 pr-5">
        <div className="truncate text-[13.5px] font-medium leading-[1.35] text-strong">
          <Highlight text={command.title} indices={titleIndices} />
        </div>
        {command.subtitle ? (
          <div className="mt-0.5 truncate text-[12px] leading-[1.4] text-sub">
            <Highlight text={command.subtitle} indices={subtitleIndices} />
          </div>
        ) : null}
      </div>

      {active ? (
        <CornerDownLeft
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 命令面板
 * ------------------------------------------------------------------ */

export default function CommandPalette({
  open,
  onOpenChange,
  commands,
}: CommandPaletteProps): JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const groups = useMemo(() => {
    let index = 0;
    return groupRanked(rankCommands(commands, query)).map((group) => ({
      name: group.name,
      items: group.items.map((item) => ({ item, index: index++ })),
    }));
  }, [commands, query]);

  const flat = useMemo(() => groups.flatMap((group) => group.items.map((entry) => entry.item)), [groups]);
  const activeIndex = flat.length === 0 ? -1 : Math.min(selected, flat.length - 1);

  /* 打开：记录来源焦点、清空查询、聚焦输入框；关闭：把焦点还回去 */
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setSelected(0);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const target = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (target && target.isConnected) target.focus({ preventScroll: true });
    };
  }, [open]);

  /* Esc 由面板接管（焦点可能在滚动条、遮罩等位置，所以挂在 window 上） */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  /* 让键盘选中的条目始终留在可视区域 */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, query, flat.length]);

  const close = () => onOpenChange(false);

  const runCommand = (command: PaletteCommand) => {
    close();
    command.run();
  };

  const move = (delta: number) => {
    if (flat.length === 0) return;
    setSelected((current) => {
      const base = current >= flat.length ? 0 : current;
      return (base + delta + flat.length) % flat.length;
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // 中文输入法组合期间不抢 Enter / 方向键
    if (event.nativeEvent.isComposing) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter": {
        event.preventDefault();
        const target = flat[activeIndex];
        if (target) runCommand(target.command);
        break;
      }
      case "Tab":
        // 面板内只有输入框一个可聚焦元素，Tab 不应把焦点漏到背后页面
        event.preventDefault();
        inputRef.current?.focus();
        break;
      default:
        break;
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="backdrop-in fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-[2px] motion-reduce:animate-none"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        className="dialog-in w-[560px] max-w-full overflow-hidden rounded-[18px] motion-reduce:animate-none"
        style={{ background: "var(--c-surface)", boxShadow: "var(--shadow-pop)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ borderBottom: "1px solid var(--c-line)" }}
        >
          <Search size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="搜索命令…"
            aria-label="搜索命令"
            role="combobox"
            aria-expanded={open}
            aria-controls={flat.length > 0 ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-6 min-w-0 flex-1 bg-transparent text-[15px] text-strong outline-none placeholder:text-muted focus-visible:outline-none"
            style={{ caretColor: "var(--c-accent)" }}
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="px-1.5 py-1.5">
          {flat.length === 0 ? (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-[13px] text-muted"
            >
              <SearchX size={20} strokeWidth={1.5} aria-hidden />
              没有匹配的结果
            </div>
          ) : (
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="命令列表"
              className="max-h-[340px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {groups.map((group) => (
                <div key={group.name} className="mb-[6px] last:mb-0">
                  <div className="select-none px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                    {group.name}
                  </div>
                  {group.items.map(({ item, index }) => (
                    <CommandRow
                      key={item.command.id}
                      entry={item}
                      id={optionId(index)}
                      index={index}
                      active={index === activeIndex}
                      onHover={() => {
                        if (index !== activeIndex) setSelected(index);
                      }}
                      onRun={() => runCommand(item.command)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-4 py-2 text-[11px] text-muted"
          style={{ borderTop: "1px solid var(--c-line)" }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              选择
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd>
              执行
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>esc</Kbd>
              关闭
            </span>
          </div>
          <span className="numeric shrink-0">{flat.length} 项</span>
        </div>

        <div className="sr-only" aria-live="polite">
          {flat.length > 0 ? `${flat.length} 条结果` : "没有匹配的结果"}
        </div>
      </div>
    </div>,
    document.body,
  );
}
