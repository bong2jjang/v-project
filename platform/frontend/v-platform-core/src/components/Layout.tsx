/**
 * Layout 컴포넌트 (새 버전)
 *
 * VS Code 스타일 레이아웃:
 * - 왼쪽: Sidebar (네비게이션)
 * - 위쪽: TopBar (상태, 설정, 사용자)
 * - 가운데: Content Area (페이지)
 * - 아래쪽: Footer
 */

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  User,
  KeyRound,
  Sparkles,
  LogOut,
  ArrowDown,
  RefreshCw,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronRight,
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
import { useSystemSettingsStore } from "../stores/systemSettings";
import { usePlatformConfig } from "../providers/PlatformProvider";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTour } from "../hooks/useTour";
import { getRoleDisplayName } from "../api/types";
import { NotificationBell } from "./notifications/NotificationBell";
import { ToastContainer } from "./notifications/ToastContainer";
import { AnnouncementPopup } from "./notifications/AnnouncementPopup";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useTheme, type ContentWidth } from "../hooks/useTheme";

/* ── 페이지별 임시 너비 오버라이드 컨텍스트 ── */
interface PageWidthContextValue {
  /** 현재 유효 너비 (페이지 오버라이드 > 전역 설정) */
  effectiveWidth: ContentWidth;
  /** 페이지별 오버라이드 토글 (넓게↔기본 전환) */
  togglePageWidth: () => void;
  /** 페이지 오버라이드가 활성화되어 있는지 */
  hasOverride: boolean;
}

const PageWidthContext = createContext<PageWidthContextValue>({
  effectiveWidth: "default",
  togglePageWidth: () => {},
  hasOverride: false,
});

export function usePageWidth() {
  return useContext(PageWidthContext);
}

interface LayoutContentProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutContentProps) {
  const { actualState, isMobileOpen, closeMobile } = useSidebar();
  const { user, logout } = useAuthStore();
  const { menus, isLoaded } = usePermissionStore();
  const { settings } = useSystemSettingsStore();
  const { appName, appTitle, appVersion, brandName } = usePlatformConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const { startMainTour } = useTour();
  const mainRef = useRef<HTMLElement>(null);

  // 전역 키보드 단축키
  useKeyboardShortcuts();

  // 페이지별 임시 너비 오버라이드
  const { contentWidth, showWideViewToggle, pullToRefresh } = useTheme();

  const { pullDistance, isPulling, isRefreshing, isPWA, threshold } =
    usePullToRefresh(mainRef, { enabled: pullToRefresh });
  const [pageWidthOverride, setPageWidthOverride] = useState<ContentWidth | null>(null);

  // 모바일 프로필 메뉴 접기/펴기 (기본 접힘)
  const [profileMenuExpanded, setProfileMenuExpanded] = useState(false);

  const effectiveWidth = pageWidthOverride ?? contentWidth;

  const togglePageWidth = useCallback(() => {
    setPageWidthOverride((prev) => {
      const current = prev ?? contentWidth;
      return current === "default" ? "wide" : "default";
    });
  }, [contentWidth]);

  // 라우트 변경 시 페이지 오버라이드 리셋
  useEffect(() => {
    setPageWidthOverride(null);
  }, [location.pathname]);

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
                {/* Logo Area — TopBar 와 동일한 settings 기반 로고/타이틀 */}
                <div className="flex items-center h-12 px-3 border-b border-line flex-shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {settings?.app_logo_url ? (
                      <img
                        src={settings.app_logo_url}
                        alt="Logo"
                        className="h-7 w-auto rounded-lg flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center w-7 h-7 bg-brand-600 rounded-lg shadow-sm flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-content-inverse"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-body-sm font-semibold text-content-primary truncate">
                      {settings?.app_title || appTitle || "v-platform"}
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
                    {/* User Info — 클릭 시 프로필 메뉴 토글 */}
                    <button
                      type="button"
                      onClick={() => setProfileMenuExpanded((prev) => !prev)}
                      aria-expanded={profileMenuExpanded}
                      className="w-full px-4 py-3 border-b border-line flex items-center gap-3 hover:bg-surface-raised transition-colors text-left"
                    >
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
                      {profileMenuExpanded ? (
                        <ChevronDown className="w-4 h-4 text-content-tertiary flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-content-tertiary flex-shrink-0" />
                      )}
                    </button>

                    {/* Profile Actions — 접이식 (프로필/비밀번호/투어/로그아웃) */}
                    {profileMenuExpanded && (
                      <div className="border-b border-line bg-surface-raised/30">
                        <button
                          onClick={() => {
                            closeMobile();
                            navigate("/profile");
                          }}
                          className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-body-sm text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
                        >
                          <User className="w-4 h-4" />
                          프로필
                        </button>

                        <button
                          onClick={() => {
                            closeMobile();
                            navigate("/password-change");
                          }}
                          className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-body-sm text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                          비밀번호 변경
                        </button>

                        <button
                          onClick={() => {
                            closeMobile();
                            startMainTour();
                          }}
                          className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-body-sm text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          투어 다시 보기
                        </button>

                        <button
                          onClick={handleMobileLogout}
                          className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-body-sm text-status-danger hover:bg-status-danger-light transition-colors border-t border-line"
                        >
                          <LogOut className="w-4 h-4" />
                          로그아웃
                        </button>
                      </div>
                    )}

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
                  </div>
                )}
              </div>
            </aside>
          </>
        )}

        {/* Main Content - 스크롤 가능 */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto relative"
          style={{
            ...(isPWA && pullToRefresh ? { overscrollBehaviorY: "none" as const } : {}),
            ...(pageWidthOverride ? { "--content-max-width": pageWidthOverride === "wide" ? "100%" : "80rem" } as React.CSSProperties : {}),
          }}
        >
          {/* 넓게보기 토글 — 메인 콘텐츠 우측 상단 (테마 설정으로 표시 여부 제어) */}
          {showWideViewToggle && (
            <button
              type="button"
              onClick={togglePageWidth}
              className={`hidden md:block absolute top-2 right-3 z-10 p-1.5 rounded-button transition-colors ${
                pageWidthOverride !== null
                  ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-50/10"
                  : "text-content-tertiary hover:text-content-secondary hover:bg-surface-raised"
              }`}
              title={effectiveWidth === "wide" ? "기본보기" : "넓게보기"}
            >
              {effectiveWidth === "wide" ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
          {/* PWA Pull-to-Refresh Indicator */}
          {isPWA && pullToRefresh && pullDistance > 0 && (
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
          <PageWidthContext.Provider value={{ effectiveWidth, togglePageWidth, hasOverride: pageWidthOverride !== null }}>
            {children}
          </PageWidthContext.Provider>
        </main>
      </div>

      {/* Footer - 전체 넓이, 항상 화면 하단 고정 */}
      <footer className="bg-surface-card border-t border-line flex-shrink-0">
        <div className="px-4 py-0.5">
          <div className="flex items-center justify-end text-caption text-content-tertiary">
            <div className="flex items-center gap-3">
              <span>
                {brandName ? `${brandName} ` : ""}
                {settings?.app_title || appTitle || appName}
                {appVersion ? ` v${appVersion}` : ""}
              </span>
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
