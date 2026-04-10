/**
 * Tooltip 컴포넌트
 *
 * Hover 시 작은 설명을 표시하는 컴포넌트
 * Sidebar의 Compact 모드에서 아이콘 설명을 표시하는 데 사용
 */

import { useState, useRef, useEffect, ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  side = "right",
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // disabled 전환 시 visible 상태 리셋 (메뉴 그룹 flyout 열림/닫힘 시 잔류 방지)
  useEffect(() => {
    if (disabled) setVisible(false);
  }, [disabled]);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current || disabled)
      return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (side) {
      case "top":
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "right":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
      case "bottom":
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
    }

    setPosition({ top, left });
  }, [visible, side, disabled]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </div>

      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-tooltip pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-sm px-3 py-2 rounded shadow-lg whitespace-nowrap font-medium">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
