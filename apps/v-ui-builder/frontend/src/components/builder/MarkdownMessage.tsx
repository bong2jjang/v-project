/**
 * MarkdownMessage — 어시스턴트 메시지를 Markdown + GFM 으로 렌더.
 *
 * - 리스트/테이블/인용/링크/헤딩/강조를 디자인 토큰에 맞춰 스타일링.
 * - 코드 블록(```lang ```)은 본문 안에 인라인으로 하이라이팅되어 표시되며,
 *   우상단 플로팅 복사 버튼으로 전체 코드를 클립보드에 복사할 수 있다.
 * - 스트리밍 중 닫히지 않은 마지막 펜스는 ●생성중 배지로 표시.
 */

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";

import { useTheme } from "../../hooks/useTheme";

interface MarkdownMessageProps {
  content: string;
  streaming?: boolean;
}

/**
 * 닫히지 않은 코드 펜스의 본문을 추출. 모두 닫혀 있으면 null.
 */
function detectOpenFenceBody(content: string): string | null {
  const fences: number[] = [];
  const fenceRegex = /```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(content)) !== null) fences.push(m.index);
  if (fences.length % 2 === 0) return null;

  const lastStart = fences[fences.length - 1];
  const after = content.slice(lastStart + 3);
  const nl = after.indexOf("\n");
  if (nl < 0) return "";
  return after.slice(nl + 1);
}

/**
 * ```lang:path 에서 lang/path 분리.
 */
function parseCodeInfo(className: string | undefined): {
  language: string;
  path?: string;
} {
  const match = /language-([^\s]+)/.exec(className ?? "");
  if (!match) return { language: "text" };
  const [lang, path] = match[1].split(":");
  return { language: (lang || "text").toLowerCase(), path: path || undefined };
}

/**
 * Prism 언어 식별자 매핑. 렌더러가 인식하지 못하는 lang 은 그대로 전달 → plain 처리.
 */
function mapLanguage(lang: string): string {
  switch (lang.toLowerCase()) {
    case "tsx":
    case "typescript":
    case "ts":
      return "tsx";
    case "jsx":
    case "javascript":
    case "js":
      return "jsx";
    case "html":
    case "xml":
      return "markup";
    case "shell":
    case "sh":
    case "zsh":
      return "bash";
    default:
      return lang || "text";
  }
}

interface InlineCodeBlockProps {
  language: string;
  path?: string;
  content: string;
  open?: boolean;
}

function InlineCodeBlock({ language, path, content, open }: InlineCodeBlockProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="group relative my-1.5 rounded-button bg-surface-page/60 overflow-hidden">
      {/* 상단 얇은 헤더 — 좌: 언어/경로, 우: 생성중 + 복사 버튼 */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-line/60 bg-surface-page/40">
        <div className="text-[9px] font-mono text-content-tertiary/80 select-none truncate">
          <span className="uppercase tracking-wider">{language || "text"}</span>
          {path && <span className="ml-1 normal-case">{path}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {open && (
            <span className="text-[10px] text-status-success animate-pulse font-mono px-1 rounded bg-surface-page/80">
              ●생성중
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            title="클립보드 복사"
            aria-label="코드 복사"
            className="inline-flex items-center justify-center w-6 h-6 rounded-button text-content-tertiary hover:text-content-primary bg-surface-page/80 hover:bg-surface-raised opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={mapLanguage(language)}
        style={isDark ? vscDarkPlus : vs}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "8px 10px",
          fontSize: "11.5px",
          lineHeight: 1.55,
          background: "transparent",
          maxHeight: "18rem",
          overflow: "auto",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "Menlo, Monaco, 'Courier New', 'D2Coding', Consolas, monospace",
            background: "transparent",
          },
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownMessage({ content, streaming }: MarkdownMessageProps) {
  const openBody = useMemo(
    () => (streaming ? detectOpenFenceBody(content) : null),
    [content, streaming],
  );

  const components: Components = useMemo(
    () => ({
      // 코드: className 에 language-* 가 있으면 블록, 없으면 인라인
      code({ className, children }) {
        const hasLang = Boolean(className && className.includes("language-"));
        if (!hasLang) {
          return (
            <code className="px-1 py-0.5 rounded bg-surface-raised text-[0.9em] font-mono text-content-primary break-words">
              {children}
            </code>
          );
        }
        const { language, path } = parseCodeInfo(className);
        const body = String(children ?? "").replace(/\n$/, "");
        const isOpen =
          openBody !== null && body.trimEnd() === openBody.trimEnd();
        return (
          <InlineCodeBlock
            language={language}
            path={path}
            content={body}
            open={isOpen}
          />
        );
      },
      // pre: InlineCodeBlock 이 자체 컨테이너를 제공하므로 unwrap
      pre({ children }) {
        return <>{children}</>;
      },
      p({ children }) {
        return <p className="my-1 leading-relaxed break-words">{children}</p>;
      },
      h1({ children }) {
        return (
          <h1 className="text-[15px] font-semibold my-2 text-content-primary">
            {children}
          </h1>
        );
      },
      h2({ children }) {
        return (
          <h2 className="text-[14px] font-semibold my-1.5 text-content-primary">
            {children}
          </h2>
        );
      },
      h3({ children }) {
        return (
          <h3 className="text-[13px] font-semibold my-1 text-content-primary">
            {children}
          </h3>
        );
      },
      ul({ children }) {
        return (
          <ul className="list-disc pl-5 my-1 space-y-0.5 marker:text-content-tertiary">
            {children}
          </ul>
        );
      },
      ol({ children }) {
        return (
          <ol className="list-decimal pl-5 my-1 space-y-0.5 marker:text-content-tertiary">
            {children}
          </ol>
        );
      },
      li({ children }) {
        return <li className="leading-relaxed">{children}</li>;
      },
      table({ children }) {
        return (
          <div className="my-2 overflow-x-auto rounded-button border border-line">
            <table className="w-full border-collapse text-[12px]">
              {children}
            </table>
          </div>
        );
      },
      thead({ children }) {
        return <thead className="bg-surface-raised">{children}</thead>;
      },
      tbody({ children }) {
        return <tbody>{children}</tbody>;
      },
      tr({ children }) {
        return (
          <tr className="border-b border-line last:border-b-0">{children}</tr>
        );
      },
      th({ children }) {
        return (
          <th className="px-2 py-1 text-left font-semibold text-content-primary border-r border-line last:border-r-0">
            {children}
          </th>
        );
      },
      td({ children }) {
        return (
          <td className="px-2 py-1 align-top text-content-primary border-r border-line last:border-r-0">
            {children}
          </td>
        );
      },
      a({ children, href }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-content-link underline hover:opacity-80"
          >
            {children}
          </a>
        );
      },
      strong({ children }) {
        return (
          <strong className="font-semibold text-content-primary">
            {children}
          </strong>
        );
      },
      em({ children }) {
        return <em className="italic">{children}</em>;
      },
      blockquote({ children }) {
        return (
          <blockquote className="border-l-2 border-line-heavy pl-2 my-1.5 text-content-secondary italic">
            {children}
          </blockquote>
        );
      },
      hr() {
        return <hr className="border-line my-2" />;
      },
    }),
    [openBody],
  );

  return (
    <div className="text-[12.5px] leading-relaxed text-content-primary">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
