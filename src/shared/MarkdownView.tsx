import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Markdown 只读渲染：样式统一由 .prose 控制，serif 用于纸感模式 */
export default function MarkdownView({ children, serif = false }: { children: string; serif?: boolean }) {
  return (
    <div className={cn("prose", serif && "serif")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
