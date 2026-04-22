/**
 * 모니터링 서비스 상태 배지 컴포넌트
 */

import type { ServiceStatus } from "../../types/monitoring";

interface StatusBadgeProps {
  status: ServiceStatus;
  className?: string;
}

interface StatusConfig {
  icon: string;
  label: string;
  colorClass: string;
}

const statusConfigs: Record<ServiceStatus, StatusConfig> = {
  healthy: {
    icon: "🟢",
    label: "정상",
    colorClass:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  warning: {
    icon: "🟡",
    label: "경고",
    colorClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  error: {
    icon: "🔴",
    label: "오류",
    colorClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  unknown: {
    icon: "⚪",
    label: "알 수 없음",
    colorClass: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfigs[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.colorClass} ${className}`}
    >
      <span className="text-sm">{config.icon}</span>
      {config.label}
    </span>
  );
}
