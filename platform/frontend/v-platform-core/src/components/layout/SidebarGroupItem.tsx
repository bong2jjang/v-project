/**
 * SidebarGroupItem 컴포넌트
 *
 * 메뉴 그룹을 사이드바에서 표시
 * - Collapsed 모드: 폴더 아이콘 + 클릭 시 flyout 팝오버로 자식 메뉴 표시
 * - 자식 메뉴 중 하나라도 active이면 그룹 아이콘도 active 표시
 * - Portal + position:fixed로 overflow 부모에 가려지지 않도록 처리
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { NavItem } from "../../lib/navigation";
import { Tooltip } from "../ui/Tooltip";

interface SidebarGroupItemProps {
  item: NavItem;
  variant?: "default" | "admin";
}

export function SidebarGroupItem({
  item,
  variant = "default",
}: SidebarGroupItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [flyoutStyle, setFlyoutStyle] = useState<React.CSSProperties>({});
  const location = useLocation();

  const children = item.children || [];
  const isAnyChildActive = children.some(
    (child) =>
      location.pathname === child.path ||
      (child.path !== "/" && location.pathname.startsWith(child.path + "/")),
  );

  const Icon = item.icon;

  // flyout 위치 계산
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setFlyoutStyle({
      position: "fixed",
      left: rect.right + 4,
      top: rect.top,
      zIndex: 9999,
    });
  }, []);

  // 열릴 때 위치 계산 + 스크롤/리사이즈 시 재계산
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        flyoutRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 페이지 이동 시 닫기
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <div>
      {/* Group icon button */}
      <Tooltip content={item.label} side="right" disabled={isOpen}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          data-active={isAnyChildActive || isOpen ? "true" : undefined}
          className={`
            relative w-full flex items-center justify-center p-2 rounded-button
            transition-all duration-normal
            ${
              isAnyChildActive || isOpen
                ? variant === "admin"
                  ? "bg-surface-raised text-status-warning border-l-2 border-status-warning-border"
                  : "bg-surface-raised text-brand-600 border-l-2 border-brand-600 dark:text-content-primary dark:border-content-tertiary"
                : variant === "admin"
                  ? "text-content-secondary hover:bg-surface-raised hover:text-status-warning"
                  : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
            }
          `}
        >
          <Icon active={isAnyChildActive || isOpen} />
          {/* 접힘/열림 인디케이터 — 기본/관리자 변형 공통으로 표시 */}
          <span className="absolute bottom-0.5 right-0.5 text-content-tertiary opacity-80">
            {isOpen ? (
              <ChevronDown className="w-2.5 h-2.5" />
            ) : (
              <ChevronRight className="w-2.5 h-2.5" />
            )}
          </span>
        </button>
      </Tooltip>

      {/* Flyout popover — Portal로 body에 렌더링하여 overflow 클리핑 방지 */}
      {isOpen &&
        children.length > 0 &&
        createPortal(
          <div
            ref={flyoutRef}
            style={flyoutStyle}
            className="min-w-[180px] bg-surface-card border border-line rounded-lg shadow-lg py-1"
          >
            {/* Group title */}
            <div className="px-3 py-1.5 text-xs font-medium text-content-tertiary uppercase tracking-wider border-b border-line">
              {item.label}
            </div>
            {/* Child items */}
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
                    flex items-center gap-2 px-3 py-2 text-sm transition-colors
                    ${
                      isActive
                        ? "bg-brand-600/10 text-brand-600 dark:bg-surface-raised dark:text-content-primary"
                        : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
                    }
                  `}
                >
                  <ChildIcon active={isActive} />
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
