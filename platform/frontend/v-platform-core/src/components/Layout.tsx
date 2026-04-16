/**
 * Layout 컴포넌트 (새 버전)
 *
 * VS Code 스타일 레이아웃:
 * - 왼쪽: Sidebar (네비게이션)
 * - 위쪽: TopBar (상태, 설정, 사용자)
 * - 가운데: Content Area (페이지)
 * - 아래쪽: Footer
 */

import { ReactNode, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  User,
  KeyRound,
  Sparkles,
  LogOut,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { SidebarProvider, useSidebar } from "../hooks/useSidebar";
import { Sidebar } from "./layout/Sidebar";
import { TopBar } from "./layout/TopBar";
import {
  mainNavItems,
  adminNavItems,
  filterNavItemsByRole,
  categorizeMenus,
} from "../lib/navigation";
import { SidebarNavItem } from "./layout/SidebarNavItem";
import { MobileSidebarGroupItem } from "./layout/MobileSidebarGroupItem";
import { SidebarSection } from "./layout/SidebarSection";
import { Divider } from "./ui/Divider";
import { useAuthStore } from "../stores/auth";
import { usePermissionStore } from "../stores/permission";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTour } from "../hooks/useTour";
import { getRoleDisplayName } from "../api/types";
import { NotificationBell } from "./notifications/NotificationBell";
import { ToastContainer } from "./notifications/ToastContainer";
import { AnnouncementPopup } from "./notifications/AnnouncementPopup";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

interface LayoutContentProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutContentProps) {
  const { actualState, isMobileOpen, closeMobile } = useSidebar();
  const { user, logout } = useAuthStore();
  const { menus, isLoaded } = usePermissionStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { startMainTour } = useTour();
  const mainRef = useRef<HTMLElement>(null);
  const { pullDistance, isPulling, isRefreshing, isPWA, threshold } =
    usePullToRefresh(mainRef);

  // 전역 키보드 단축키
  useKeyboardShortcuts();

  const handleMobileLogout = async () => {
    closeMobile();
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  // 라우트 변경 시 모바일/오버플로 오버레이 자동 닫기
  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  const sidebarVisible = actualState !== "hidden";

  // 서버 메뉴 기반 또는 레거시 폴백
  const useServerMenus = isLoaded && menus.length > 0;
  let mobileMainItems;
  let mobileAdminItems;

  let mobileBottomItems: ReturnType<typeof categorizeMenus>["bottom"] = [];

  if (useServerMenus) {
    const categorized = categorizeMenus(menus);
    mobileMainItems = categorized.main;
    mobileAdminItems = categorized.admin;
    mobileBottomItems = categorized.bottom;
  } else {
    mobileMainItems = mainNavItems.filter((item) => item.path !== "/settings");
    mobileAdminItems = filterNavItemsByRole(adminNavItems, user?.role);
  }

  const mobileShowSettings = mobileBottomItems.length > 0 || !isLoaded;

  return (
    <div className="h-screen bg-surface-page flex flex-col overflow-hidden">
      {/* TopBar - 전체 넓이, 고정 */}
      <TopBar />

      {/* Main area with Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar - 전체 높이, 고정 */}
        {sidebarVisible && <Sidebar />}

        {/* Mobile Overlay */}
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={closeMobile}
            />
            {/* Mobile Sidebar - with text labels */}
            <aside className="fixed left-0 top-0 bottom-0 w-60 bg-surface-card z-50">
              <div className="h-full flex flex-col border-r border-line">
                {/* Logo Area */}
                <div className="flex items-center h-12 px-3 border-b border-line flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-7 h-7 bg-brand-600 rounded-lg shadow-sm">
                      <svg
                        className="w-4 h-4 text-content-inverse"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </div>
                    <span className="text-body-sm font-bold text-content-primary">
                      VMS Channel Bridge
                    </span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-3 px-2">
                  <SidebarSection expanded={true}>
                    {mobileMainItems
                      .filter(
                        (item) =>
                          item.menuType !== "menu_group" ||
                          (item.children && item.children.length > 0),
                      )
                      .map((item) =>
                        item.children && item.children.length > 0 ? (
                          <MobileSidebarGroupItem
                            key={item.permissionKey || item.path}
                            item={item}
                            variant="default"
                          />
                        ) : (
                          <SidebarNavItem
                            key={item.path}
                            {...item}
                            expanded={true}
                            variant="default"
                          />
                        ),
                      )}
                  </SidebarSection>

                  {mobileAdminItems.length > 0 && (
                    <>
                      <Divider className="my-3" />
                      <SidebarSection
                        title="관리자"
                        badge="Admin"
                        badgeVariant="warning"
                        expanded={true}
                      >
                        {mobileAdminItems
                          .filter(
                            (item) =>
                              item.menuType !== "menu_group" ||
                              (item.children && item.children.length > 0),
                          )
                          .map((item) =>
                            item.children && item.children.length > 0 ? (
                              <MobileSidebarGroupItem
                                key={item.permissionKey || item.path}
                                item={item}
                                variant="admin"
                              />
                            ) : (
                              <SidebarNavItem
                                key={item.path}
                                {...item}
                                expanded={true}
                                variant="admin"
                              />
                            ),
                          )}
                      </SidebarSection>
                    </>
                  )}
                </div>

                {/* Bottom: Settings + User Actions */}
                {user && (
                  <div className="flex-shrink-0 border-t border-line">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-line">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-600 text-content-inverse font-medium text-body-base flex-shrink-0">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-medium text-content-primary truncate">
                            {user.username}
                          </p>
                          <p className="text-caption text-content-secondary truncate">
                            {user.email}
                          </p>
                          <p className="text-caption text-content-tertiary">
                            {getRoleDisplayName(user.role)} 권한
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Settings Link */}
                    {mobileShowSettings && (
                      <Link
                        to="/settings"
                        onClick={closeMobile}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
                      >
                        <Settings className="w-5 h-5" />
                        설정
                      </Link>
                    )}

                    {/* User Action Buttons */}
                    <button
                      onClick={() => {
                        closeMobile();
                        navigate("/profile");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
                    >
                      <User className="w-5 h-5" />
                      프로필
                    </button>

                    <button
                      onClick={() => {
                        closeMobile();
                        navigate("/password-change");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
                    >
                      <KeyRound className="w-5 h-5" />
                      비밀번호 변경
                    </button>

                    <button
                      onClick={() => {
                        closeMobile();
                        startMainTour();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors border-t border-line"
                    >
                      <Sparkles className="w-5 h-5" />
                      투어 다시 보기
                    </button>

                    <button
                      onClick={handleMobileLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-body-base text-status-danger hover:bg-status-danger-light transition-colors border-t border-line"
                    >
                      <LogOut className="w-5 h-5" />
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}

        {/* Main Content - 스크롤 가능 */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto"
          style={isPWA ? { overscrollBehaviorY: "none" } : undefined}
        >
          {/* PWA Pull-to-Refresh Indicator */}
          {isPWA && pullDistance > 0 && (
            <div
              className="flex items-center justify-center pointer-events-none"
              style={{
                height: pullDistance,
                transition: isPulling ? "none" : "height 0.3s ease-out",
              }}
            >
              {isRefreshing ? (
                <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />
              ) : (
                <ArrowDown
                  className="w-5 h-5 text-content-tertiary transition-transform duration-200"
                  style={{
                    transform:
                      pullDistance >= threshold ? "rotate(180deg)" : "none",
                  }}
                />
              )}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Footer - 전체 넓이, 항상 화면 하단 고정 */}
      <footer className="bg-surface-card border-t border-line flex-shrink-0">
        <div className="px-4 py-0.5">
          <div className="flex items-center justify-end text-caption text-content-tertiary">
            <div className="flex items-center gap-3">
              <span>VMS Channel Bridge v1.1.0</span>
              {/* 알림 벨 */}
              <NotificationBell />
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Container - 화면 우측 하단 고정 */}
      <ToastContainer />

      {/* Announcement Popup - 미읽은 공지사항 팝업 */}
      <AnnouncementPopup />
    </div>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}

/* ── Content Header — 페이지 헤더 컴포넌트 (기존 유지) ── */
export { ContentHeader } from "./layout/ContentHeader";
