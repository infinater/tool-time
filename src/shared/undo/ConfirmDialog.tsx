import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import "./undo.css";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  /** 需要输入的确认词（如「删除」）；不传则不校验，直接确认 */
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 通用确认对话框：支持二次确认词、Esc / 点遮罩取消、打开时自动聚焦。
 * 不引入任何依赖，样式复用现有 token 与 .dialog-in / .backdrop-in 动效。
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  danger = false,
  onConfirm,
  onCancel,
}: Props): ReactElement | null {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  const titleId = useId();

  // 打开时清空已输入的确认词
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  // 回调放 ref，避免父组件内联箭头函数导致监听反复重挂
  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      if (confirmText) inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 30);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, confirmText]);

  if (!open) return null;

  const ok = !confirmText || typed.trim() === confirmText;

  return (
    <div
      className="backdrop-in fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog-in w-full max-w-[420px] rounded-[18px] p-7"
        style={{ background: "var(--c-surface)", boxShadow: "var(--shadow-pop)" }}
      >
        <div className="flex items-start gap-2.5">
          {danger && <DangerMark />}
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16.5px] font-semibold tracking-[-0.01em] text-strong">
              {title}
            </h2>
            {description && <p className="mt-2 text-[12.5px] leading-[1.75] text-sub">{description}</p>}
          </div>
        </div>

        {confirmText && (
          <div className="mt-5">
            <label className="mb-2 block text-[11.5px] text-muted" htmlFor={`${titleId}-confirm`}>
              输入「{confirmText}」以确认
            </label>
            <input
              id={`${titleId}-confirm`}
              ref={inputRef}
              className="input"
              value={typed}
              placeholder={confirmText}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ok) {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </div>
        )}

        <div className="mt-7 flex items-center justify-end gap-2">
          <button className="btn-soft" onClick={onCancel}>
            取消
          </button>
          <button ref={confirmRef} className="btn-primary" disabled={!ok} onClick={onConfirm}>
            {confirmText ? `确认${confirmText}` : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 警示三角：现画，不依赖图标库命名（lucide 1.x 改过 alert 系列的名字） */
function DangerMark() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden>
      <path d="M12 4.2 21 19.4H3L12 4.2Z" fill="none" stroke="var(--c-accent)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 9.4v4.4" stroke="var(--c-accent)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.95" fill="var(--c-accent)" />
    </svg>
  );
}
