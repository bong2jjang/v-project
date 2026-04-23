/**
 * SidebarNavItem 컴포넌트
 *
 * Sidebar의 네비게이션 아이템
 * - 아이콘 + 텍스트 (expanded)
 * - 아이콘만 + Tooltip (collapsed)
 * - Active 상태 표시
 */

import { Link, useMatch } from "react-router-dom";
import { NavItem } from "../../lib/navigation";
import { Tooltip } from "../ui/Tooltip";
import { Badge } from "../ui/Badge";

interface SidebarNavItemProps extends NavItem {
  expanded: boolean;
  variant?: "default" | "admin";
}

export function SidebarNavItem({
  path,
  label,
  icon: Icon,
  badge,
  expanded,
  variant = "default",
}: SidebarNavItemProps) {
  const isActive = !!useMatch(path === "/" ? path : `${path}/*`);

  // data-tour 속성 생성 (예: /channels -> nav-channels)
  const dataTourId =
    path === "/" ? "nav-dashboard" : `nav${path.replace(/\//g, "-")}`;

  const content = (
    <Link
      to={path}
      data-tour={dataTourId}
      data-active={isActive ? "true" : undefined}
      className={`
        flex items-center gap-3 rounded-button
        transition-all duration-normal
        ${!expanded ? "justify-center p-2" : "px-3 py-2"}
        ${
          isActive
            ? variant === "admin"
              ? "bg-status-warning-light text-status-warning border-l-2 border-status-warning-border"
              : "bg-brand-600/10 text-brand-600 border-l-2 border-brand-600 dark:bg-surface-raised dark:text-content-primary dark:border-content-tertiary"
            : variant === "admin"
              ? "text-status-warning-dark hover:bg-status-warning-light/50 hover:text-status-warning"
              : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
        }
      `}
    >
      <Icon active={isActive} />
      {expanded && (
        <>
          <span className="text-body-base font-medium flex-1">{label}</span>
          {badge && (
            <Badge variant={variant === "admin" ? "warning" : "info"} size="sm">
              {badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  // Collapsed 모드: Tooltip 표시
  if (!expanded) {
    return (
      <Tooltip content={label} side="right">
        {content}
      </Tooltip>
    );
  }

  // Expanded 모드: Tooltip 없음
  return content;
}
