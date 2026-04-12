/**
 * SimpleMarkdown — 경량 마크다운 렌더러
 *
 * 외부 라이브러리 없이 마크다운 문법 지원:
 *   # 제목1, ## 제목2, ### 제목3 (블록)
 *   **bold**, *italic*, ~~strikethrough~~, `inline code`, [link](url), ![image](url)
 *   - 리스트, > 인용, --- 구분선
 *   줄바꿈, 빈 줄 단락 분리
 */

import { Fragment } from "react";

interface SimpleMarkdownProps {
  content: string;
  className?: string;
}

/** 인라인 마크다운 토큰을 React 엘리먼트로 변환 */
function renderInline(text: string, keyPrefix = ""): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // 패턴 순서: image → link → bold → italic → inline code → strikethrough
  const re =
    /!\[([^\]]*)\]\(([^)]+)\)|(\[([^\]]+)\]\(([^)]+)\))|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(~~(.+?)~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${idx++}`;

    if (match[1] !== undefined && match[2]) {
      // ![alt](url) — 이미지
      tokens.push(
        <img
          key={key}
          src={match[2]}
          alt={match[1]}
          className="max-w-full rounded-lg my-2 border border-line"
          loading="lazy"
        />,
      );
    } else if (match[3] && match[4] && match[5]) {
      // [text](url) — 링크
      tokens.push(
        <a
          key={key}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          {match[4]}
        </a>,
      );
    } else if (match[6] && match[7]) {
      // **bold**
      tokens.push(
        <strong key={key} className="font-semibold">
          {match[7]}
        </strong>,
      );
    } else if (match[8] && match[9]) {
      // *italic*
      tokens.push(
        <em key={key} className="italic">
          {match[9]}
        </em>,
      );
    } else if (match[10] && match[11]) {
      // `code`
      tokens.push(
        <code
          key={key}
          className="px-1.5 py-0.5 text-[0.85em] bg-surface-raised rounded font-mono"
        >
          {match[11]}
        </code>,
      );
    } else if (match[12] && match[13]) {
      // ~~strikethrough~~
      tokens.push(
        <del key={key} className="line-through text-content-tertiary">
          {match[13]}
        </del>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

/** 단일 라인의 블록 레벨 타입 판별 및 렌더링 */
function renderBlock(
  line: string,
  key: string,
): { node: React.ReactNode; type: "heading" | "hr" | "quote" | "list" | "text" } {
  // # 제목
  const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = renderInline(headingMatch[2], key);
    if (level === 1)
      return {
        node: (
          <p key={key} className="text-lg font-bold text-content-primary mt-3 mb-1">
            {content}
          </p>
        ),
        type: "heading",
      };
    if (level === 2)
      return {
        node: (
          <p key={key} className="text-base font-semibold text-content-primary mt-2.5 mb-1">
            {content}
          </p>
        ),
        type: "heading",
      };
    return {
      node: (
        <p key={key} className="text-sm font-semibold text-content-primary mt-2 mb-0.5">
          {content}
        </p>
      ),
      type: "heading",
    };
  }

  // --- 구분선
  if (/^-{3,}$/.test(line.trim())) {
    return { node: <hr key={key} className="border-line my-3" />, type: "hr" };
  }

  // > 인용
  const quoteMatch = line.match(/^>\s*(.*)$/);
  if (quoteMatch) {
    return {
      node: (
        <blockquote
          key={key}
          className="border-l-2 border-brand-300 pl-3 my-1 text-content-secondary italic"
        >
          {renderInline(quoteMatch[1], key)}
        </blockquote>
      ),
      type: "quote",
    };
  }

  // - 리스트
  const listMatch = line.match(/^[-*]\s+(.+)$/);
  if (listMatch) {
    return {
      node: (
        <li key={key} className="ml-4 list-disc">
          {renderInline(listMatch[1], key)}
        </li>
      ),
      type: "list",
    };
  }

  return { node: null, type: "text" };
}

export function SimpleMarkdown({ content, className = "" }: SimpleMarkdownProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentParagraph: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let blockIndex = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      elements.push(
        <p key={`p-${blockIndex}`} className={elements.length > 0 ? "mt-2" : ""}>
          {currentParagraph}
        </p>,
      );
      blockIndex++;
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${blockIndex}`} className="my-1.5 space-y-0.5">
          {currentList}
        </ul>,
      );
      blockIndex++;
      currentList = [];
    }
  };

  lines.forEach((line, li) => {
    // 빈 줄 → 현재 단락/리스트 플러시
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      return;
    }

    const { node, type } = renderBlock(line, `b-${li}`);

    if (type === "list") {
      flushParagraph();
      currentList.push(node);
    } else if (type !== "text") {
      flushParagraph();
      flushList();
      elements.push(node);
    } else {
      flushList();
      if (currentParagraph.length > 0) {
        currentParagraph.push(<br key={`br-${li}`} />);
      }
      currentParagraph.push(
        <Fragment key={`il-${li}`}>{renderInline(line, `${blockIndex}-${li}`)}</Fragment>,
      );
    }
  });

  flushParagraph();
  flushList();

  return <div className={`simple-markdown ${className}`}>{elements}</div>;
}
