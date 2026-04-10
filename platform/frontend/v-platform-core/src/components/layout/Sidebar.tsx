/**
 * Sidebar 컴포넌트
 *
 * VS Code 스타일의 왼쪽 사이드바
 * - 서버 권한 기반 메뉴 렌더링
 * - 메인 메뉴 / 관리자 메뉴 / 하단 설정 구분
 */

import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronsRight } from "lucide-react";
import {
  mainNavItems,
  adminNavItems,
  filterNavItemsByRole,
  categorizeMenus,
} from "../../lib/navigation";
import { useAuthStore } from "../../stores/auth";
import { usePermissionStore } from "../../stores/permission";
import { useSidebar } from "../../hooks/useSidebar";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarGroupItem } from "./SidebarGroupItem";
import { SidebarSection } from "./SidebarSection";
import { Divider } from "../ui/Divider";
import { Tooltip } from "../ui/Tooltip";
import { UserMenu } from "./UserMenu";

export function Sidebar() {
  const { user } = useAuthStore();
  const { menus, isLoaded } = usePermissionStore();
  const { setMobileOpen, setIsOverflowing } = useSidebar();

  const expanded = false; // 항상 collapsed (아이콘만)
  const navRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  // 서버 메뉴 로드 완료 → 서버 데이터만 사용 (권한 없으면 빈 메뉴)
  // system_admin은 항상 전체 메뉴 표시 (서버에서 전체 반환)
  let mainMenuItems;
  let visibleAdminItems;
  let bottomItems;

  if (isLoaded) {
    const categorized = categorizeMenus(menus);
    mainMenuItems = categorized.main;
    visibleAdminItems = categorized.admin;
    bottomItems = categorized.bottom;
  } else {
    // 권한 로딩 전 레거시 폴백
    mainMenuItems = mainNavItems.filter((item) => item.path !== "/settings");
    visibleAdminItems = filterNavItemsByRole(adminNavItems, user?.role);
    bottomItems = [];
  }

  const showSettings = bottomItems.length > 0 || !isLoaded;

  // Overflow detection: ResizeObserver (container size) + MutationObserver (content changes)
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const check = () => {
      const isOverflow = el.scrollHeight > el.clientHeight + 1;
      setOverflows(isOverflow);
      setIsOverflowing(isOverflow);
    };

    const ro = new ResizeObserver(check);
    ro.observe(el);

    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });

    check();

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsOverflowing]);

  return (
    <aside
      data-tour="sidebar"
      className="bg-surface-card border-r border-line flex flex-col w-14 h-full"
    >
      {/* Main Navigation - overflow hidden (no scroll) */}
      <div ref={navRef} className="flex-1 overflow-hidden py-2 px-1.5 relative">
        <SidebarSection expanded={expanded}>
          {mainMenuItems
            .filter(
              (item) =>
                item.menuType !== "menu_group" ||
                (item.children && item.children.length > 0),
            )
            .map((item) =>
              item.children && item.children.length > 0 ? (
                <SidebarGroupItem
                  key={item.permissionKey || item.path}
                  item={item}
                  variant="default"
                />
              ) : (
                <SidebarNavItem
                  key={item.path}
                  {...item}
                  expanded={expanded}
                  variant="default"
                />
              ),
            )}
        </SidebarSection>

        {/* Admin Menu */}
        {visibleAdminItems.length > 0 && (
          <>
            <Divider className="my-3" />
            <SidebarSection
              title="관리자"
              badge="Admin"
              badgeVariant="warning"
              expanded={expanded}
            >
              {visibleAdminItems
                .filter(
                  (item) =>
                    item.menuType !== "menu_group" ||
                    (item.children && item.children.length > 0),
                )
                .map((item) =>
                  item.children && item.children.length > 0 ? (
                    <SidebarGroupItem
                      key={item.permissionKey || item.path}
                      item={item}
                      variant="admin"
                    />
                  ) : (
                    <SidebarNavItem
                      key={item.path}
                      {...item}
                      expanded={expanded}
                      variant="admin"
                    />
                  ),
                )}
            </SidebarSection>
          </>
        )}
        {/* Fade overlay when items are clipped */}
        {overflows && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface-card to-transparent pointer-events-none" />
        )}
      </div>

      {/* Overflow: hamburger button to open full menu overlay */}
      {overflows && (
        <div className="px-1.5 pb-1 flex-shrink-0">
          <Tooltip content="전체 메뉴 열기" side="right">
            <button
              onClick={() => setMobileOpen(true)}
              className="w-full flex items-center justify-center p-2 rounded-button text-content-tertiary hover:bg-surface-raised hover:text-content-primary transition-colors"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Bottom Section: User + Settings - 항상 하단에 고정 */}
      <div className="px-1.5 py-2 space-y-1 flex-shrink-0 border-t border-line">
        {/* User Menu */}
        <UserMenu />

        {/* Settings Button — 권한 있을 때만 표시 */}
        {showSettings && (
          <Tooltip content="설정" side="right">
            <Link
              to="/settings"
              data-tour="nav-settings"
              className="w-full flex items-center justify-center p-1.5 rounded-button text-content-tertiary hover:bg-surface-raised hover:text-content-primary transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Link>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
