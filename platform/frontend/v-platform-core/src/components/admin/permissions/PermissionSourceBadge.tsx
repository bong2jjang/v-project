/**
 * PermissionSourceBadge — 권한 출처 표시 배지
 *
 * personal = 개인 설정 (파란색)
 * group    = 그룹 상속 (초록색)
 * mixed    = 개인 + 그룹 (보라색)
 */

import { Tooltip } from "../../ui/Tooltip";

interface PermissionSourceBadgeProps {
  source: "personal" | "group" | "mixed";
  groupNames?: string[];
}

const SOURCE_CONFIG = {
  personal: {
    dot: "bg-blue-500",
    label: "개인",
    bg: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  },
  group: {
    dot: "bg-green-500",
    label: "그룹",
    bg: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  },
  mixed: {
    dot: "bg-purple-500",
    label: "혼합",
    bg: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  },
};

export function PermissionSourceBadge({
  source,
  groupNames,
}: PermissionSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.personal;
  const tooltip =
    source === "group" && groupNames?.length
      ? `그룹: ${groupNames.join(", ")}`
      : source === "mixed"
        ? `개인 + 그룹${groupNames?.length ? ` (${groupNames.join(", ")})` : ""}`
        : "개인 설정";

  return (
    <Tooltip content={tooltip}>
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    </Tooltip>
  );
}
