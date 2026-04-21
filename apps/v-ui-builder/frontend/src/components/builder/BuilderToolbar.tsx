/**
 * BuilderToolbar — Builder / GenUIBuilder 공통 상단 툴바.
 *
 * 좌/중/우 슬롯을 받아 h-9 고정 높이 바 형태로 배치한다.
 * 플로팅 버튼 대체용이며, 캔버스 위 z-index 충돌을 방지한다.
 */

import type { ReactNode } from "react";

interface BuilderToolbarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function BuilderToolbar({ left, center, right }: BuilderToolbarProps) {
  return (
    <div className="h-9 shrink-0 border-b border-[var(--color-surface-chrome-border)] bg-surface-chrome flex items-center gap-1 px-1.5">
      <div className="flex items-center gap-0.5 min-w-0">{left}</div>
      <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0">
        {center}
      </div>
      <div className="flex items-center gap-0.5 min-w-0">{right}</div>
    </div>
  );
}
