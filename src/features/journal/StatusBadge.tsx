import { cn } from "@/lib/utils";
import { formatArchivedAt } from "./journalUtils";

/**
 * 日记状态徽章：草稿 / 已归档（带时间）。
 * compact 用于日记库卡片，省掉时间避免挤。
 */
export default function StatusBadge({
  archived,
  archivedAt,
  compact = false,
  className,
}: {
  archived: boolean;
  archivedAt?: number;
  compact?: boolean;
  className?: string;
}) {
  if (!archived) {
    return (
      <span className={cn("chip", className)} title="草稿：还可以继续修改">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--c-muted)" }} />
        草稿
      </span>
    );
  }

  return (
    <span
      className={cn("chip journal-badge-in", className)}
      title="已归档：只读档案，可随时继续编辑"
      style={{
        background: "color-mix(in srgb, var(--c-accent) 14%, transparent)",
        color: "var(--c-accent-text)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--c-accent)" }} />
      已归档{!compact && archivedAt ? ` · ${formatArchivedAt(archivedAt)}` : ""}
    </span>
  );
}
