/**
 * DescriptionText — description_text ui tool 의 component 렌더러.
 * 마크다운 본문을 렌더링. max_lines 지정 시 CSS line-clamp 로 접힘.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface DescriptionTextProps {
  markdown: string;
  max_lines: number | null;
}

export function DescriptionText({ markdown, max_lines }: DescriptionTextProps) {
  const clampStyle: React.CSSProperties = max_lines
    ? {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: max_lines,
        overflow: "hidden",
      }
    : {};

  return (
    <div
      className="text-[12.5px] leading-relaxed text-content-primary [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic [&_a]:text-content-link [&_a]:underline"
      style={clampStyle}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
