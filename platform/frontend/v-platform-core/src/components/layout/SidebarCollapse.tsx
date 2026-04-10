/**
 * SidebarCollapse 컴포넌트
 *
 * Sidebar 접기/펼치기 버튼
 * - Wide Desktop에서만 동작
 * - Compact/Mobile에서는 숨김
 */

import { Tooltip } from "../ui/Tooltip";

interface SidebarCollapseProps {
  expanded: boolean;
  onToggle: () => void;
  breakpoint: "wide" | "compact" | "tablet" | "mobile";
}

export function SidebarCollapse({
  expanded,
  onToggle,
  breakpoint,
}: SidebarCollapseProps) {
  // Compact/Mobile에서는 버튼 숨김
  if (breakpoint !== "wide") {
    return null;
  }

  const content = (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 w-full px-3 py-2 rounded-button
        text-content-secondary hover:bg-surface-raised hover:text-content-primary
        transition-colors duration-normal
        ${!expanded && "justify-center"}
      `}
    >
      {expanded ? (
        <>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
          <span className="text-body-sm">접기</span>
        </>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 5l7 7-7 7M5 5l7 7-7 7"
          />
        </svg>
      )}
    </button>
  );

  if (!expanded) {
    return (
      <Tooltip content="펼치기" side="right">
        {content}
      </Tooltip>
    );
  }

  return content;
}
