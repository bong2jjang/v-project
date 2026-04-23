/**
 * MobileSidebarGroupItem 컴포넌트
 *
 * 모바일 사이드바용 메뉴 그룹 (아코디언 방식)
 * - 클릭 시 하위 메뉴 인라인 펼침/접힘
 * - 자식 메뉴 중 active 항목이 있으면 자동 펼침
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { NavItem } from "../../lib/navigation";

interface MobileSidebarGroupItemProps {
  item: NavItem;
  variant?: "default" | "admin";
}

export function MobileSidebarGroupItem({
  item,
  variant = "default",
}: MobileSidebarGroupItemProps) {
  const location = useLocation();
  const children = item.children || [];

  const isAnyChildActive = children.some(
    (child) =>
      location.pathname === child.path ||
      (child.path !== "/" && location.pathname.startsWith(child.path + "/")),
  );

  const [isExpanded, setIsExpanded] = useState(isAnyChildActive);

  // 활성 자식이 생기면 자동 펼침
  useEffect(() => {
    if (isAnyChildActive) setIsExpanded(true);
  }, [isAnyChildActive]);

  const Icon = item.icon;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div>
      {/* Group header — 클릭 시 펼침/접힘 */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        data-active={isAnyChildActive || isExpanded ? "true" : undefined}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-button
          transition-all duration-normal
          ${
            isAnyChildActive || isExpanded
              ? variant === "admin"
                ? "bg-surface-raised text-status-warning border-l-2 border-status-warning-border"
                : "bg-surface-raised text-brand-600 border-l-2 border-brand-600"
              : variant === "admin"
                ? "text-content-secondary hover:bg-surface-raised hover:text-status-warning"
                : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
          }
        `}
      >
        <Icon active={isAnyChildActive} />
        <span className="text-body-base font-medium flex-1 text-left">
          {item.label}
        </span>
        <Chevron className="w-4 h-4 flex-shrink-0 text-content-tertiary opacity-80" />
      </button>

      {/* Children — 아코디언 펼침 */}
      {isExpanded && children.length > 0 && (
        <div className="ml-4 pl-3 border-l border-line space-y-0.5 py-1">
          {children.map((child) => {
            const isActive =
              location.pathname === child.path ||
              (child.path !== "/" &&
                location.pathname.startsWith(child.path + "/"));
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.path}
                to={child.path}
                className={`
                  flex items-center gap-2.5 px-3 py-1.5 rounded-button text-sm
                  transition-all duration-normal
                  ${
                    isActive
                      ? variant === "admin"
                        ? "bg-status-warning-light text-status-warning"
                        : "bg-brand-600/10 text-brand-600"
                      : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
                  }
                `}
              >
                <ChildIcon active={isActive} />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
