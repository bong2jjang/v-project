/**
 * SidebarSection 컴포넌트
 *
 * Sidebar의 메뉴 그룹을 구분하는 섹션
 * - 타이틀
 * - 배지 (Admin 등)
 * - Expanded 모드에서만 표시
 * - collapsible: 헤더 클릭으로 접기/펼치기 가능 (모바일 관리자 메뉴 등)
 */

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../ui/Badge";

interface SidebarSectionProps {
  title?: string;
  badge?: string;
  badgeVariant?: "default" | "info" | "success" | "warning" | "error";
  expanded: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function SidebarSection({
  title,
  badge,
  badgeVariant = "warning",
  expanded,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: SidebarSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const showToggle = collapsible && expanded && !!title;
  const hideItems = showToggle && collapsed;

  return (
    <div className="space-y-1">
      {/* Section Header - Expanded 모드에서만 표시 */}
      {title && expanded && (
        showToggle ? (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="w-full flex items-center gap-2 px-3 pt-4 pb-2 hover:bg-surface-raised rounded-button transition-colors"
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-content-tertiary" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-content-tertiary" />
            )}
            <h3 className="text-overline text-content-tertiary uppercase tracking-wider">
              {title}
            </h3>
            {badge && (
              <Badge variant={badgeVariant} size="sm">
                {badge}
              </Badge>
            )}
          </button>
        ) : (
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
        )
      )}

      {/* Nav Items */}
      {!hideItems && <nav className="space-y-0.5">{children}</nav>}
    </div>
  );
}
