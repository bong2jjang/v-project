/**
 * InfoTooltip 컴포넌트
 *
 * ⓘ 아이콘 hover 시 제목 + 설명을 팝오버로 표시하는 컴포넌트
 * 통계 대시보드 등 각 항목의 의미 설명에 사용
 */

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  title: string;
  description: string;
  /** 추가 부연 설명 (선택) */
  hint?: string;
  /** 팝오버 방향 (기본: bottom) */
  side?: "top" | "bottom" | "left" | "right";
  /** 아이콘 크기 */
  size?: "sm" | "md";
}

export function InfoTooltip({
  title,
  description,
  hint,
  side = "bottom",
  size = "sm",
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !popoverRef.current) return;

    const tr = triggerRef.current.getBoundingClientRect();
    const pr = popoverRef.current.getBoundingClientRect();
    const GAP = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (side) {
      case "top":
        top = tr.top - pr.height - GAP;
        left = tr.left + tr.width / 2 - pr.width / 2;
        break;
      case "bottom":
        top = tr.bottom + GAP;
        left = tr.left + tr.width / 2 - pr.width / 2;
        break;
      case "left":
        top = tr.top + tr.height / 2 - pr.height / 2;
        left = tr.left - pr.width - GAP;
        break;
      case "right":
        top = tr.top + tr.height / 2 - pr.height / 2;
        left = tr.right + GAP;
        break;
    }

    // 뷰포트 경계 보정
    left = Math.max(8, Math.min(left, vw - pr.width - 8));
    top = Math.max(8, Math.min(top, vh - pr.height - 8));

    setPos({ top, left });
  }, [visible, side]);

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${title} 설명`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex items-center justify-center text-content-tertiary hover:text-brand-500 transition-colors focus:outline-none rounded-full"
      >
        <Info className={iconSize} />
      </button>

      {visible && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="fixed z-tooltip pointer-events-none w-64"
          style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
        >
          <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl border border-gray-700 p-3 space-y-1.5">
            <p className="text-sm font-semibold leading-snug">{title}</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              {description}
            </p>
            {hint && (
              <p className="text-xs text-brand-400 leading-relaxed border-t border-gray-700 pt-1.5 mt-1.5">
                💡 {hint}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
