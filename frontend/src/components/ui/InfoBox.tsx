/**
 * InfoBox 컴포넌트
 *
 * 안내, 도움말 등 정보 표시 영역
 * Alert와 달리 닫기 버튼이 없고 항상 표시되는 정적 안내용
 */

import { ReactNode } from "react";

type InfoBoxVariant = "info" | "tip" | "warning";

interface InfoBoxProps {
  variant?: InfoBoxVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantConfig: Record<
  InfoBoxVariant,
  { bg: string; border: string; iconColor: string; icon: ReactNode }
> = {
  info: {
    bg: "bg-status-info-light",
    border: "border-status-info-border",
    iconColor: "text-status-info",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  tip: {
    bg: "bg-status-success-light",
    border: "border-status-success-border",
    iconColor: "text-status-success",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  warning: {
    bg: "bg-status-warning-light",
    border: "border-status-warning-border",
    iconColor: "text-status-warning",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

export function InfoBox({
  variant = "info",
  title,
  children,
  className = "",
}: InfoBoxProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={`rounded-card border p-4 ${config.bg} ${config.border} ${className}`}
    >
      <div className="flex gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>{config.icon}</div>
        <div className="flex-1">
          {title && <h3 className="text-heading-sm mb-1">{title}</h3>}
          <div className="text-body-base">{children}</div>
        </div>
      </div>
    </div>
  );
}
