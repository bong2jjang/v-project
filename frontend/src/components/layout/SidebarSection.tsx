/**
 * SidebarSection 컴포넌트
 *
 * Sidebar의 메뉴 그룹을 구분하는 섹션
 * - 타이틀
 * - 배지 (Admin 등)
 * - Expanded 모드에서만 표시
 */

import { ReactNode } from "react";
import { Badge } from "../ui/Badge";

interface SidebarSectionProps {
  title?: string;
  badge?: string;
  badgeVariant?: "default" | "info" | "success" | "warning" | "error";
  expanded: boolean;
  children: ReactNode;
}

export function SidebarSection({
  title,
  badge,
  badgeVariant = "warning",
  expanded,
  children,
}: SidebarSectionProps) {
  return (
    <div className="space-y-1">
      {/* Section Header - Expanded 모드에서만 표시 */}
      {title && expanded && (
        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
          <h3 className="text-overline text-content-tertiary uppercase tracking-wider">
            {title}
          </h3>
          {badge && (
            <Badge variant={badgeVariant} size="sm">
              {badge}
            </Badge>
          )}
        </div>
      )}

      {/* Nav Items */}
      <nav className="space-y-0.5">{children}</nav>
    </div>
  );
}
