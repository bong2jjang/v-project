/**
 * ContentHeader 컴포넌트
 *
 * 카드와 동일한 너비/둥글기로 페이지 상단 헤더 표시
 * 라이트: 브랜드 색상 배경
 * 다크: 카드 스타일 (surface-card)
 */

import type { ReactNode } from "react";

interface ContentHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function ContentHeader({
  title,
  description,
  actions,
}: ContentHeaderProps) {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="bg-brand-600 dark:bg-surface-card rounded-card border border-brand-700 dark:border-line shadow-card px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading-xl text-white dark:text-content-primary truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-body-base text-brand-200 dark:text-content-secondary line-clamp-1">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
