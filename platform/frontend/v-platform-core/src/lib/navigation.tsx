/**
 * Navigation 정의
 *
 * 서버 메뉴 데이터와 아이콘 매핑을 중앙에서 관리
 */

import { ComponentType } from "react";
import { icons as lucideIcons } from "lucide-react";
import type { MenuItemResponse } from "../api/types";
import { isAdminRole } from "../api/types";

export type UserRole = "system_admin" | "org_admin" | "user";

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ active: boolean }>;
  permissionKey?: string;
  badge?: string;
  /** menu_group일 때 하위 메뉴 */
  children?: NavItem[];
  /** 메뉴 타입 (그룹 판별용) */
  menuType?: string;
}

/**
 * permission_key → 아이콘 컴포넌트 레지스트리
 */
const ICON_REGISTRY: Record<string, ComponentType<{ active: boolean }>> = {
  dashboard: DashboardIcon,
  channels: ChannelsIcon,
  messages: MessagesIcon,
  statistics: StatisticsIcon,
  integrations: IntegrationsIcon,
  help: HelpIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  audit_logs: LogsIcon,
  monitoring: MonitoringIcon,
  menu_management: MenuManagementIcon,
  permission_management: PermissionManagementIcon,
  permission_groups: PermissionGroupsIcon,
  organizations: OrganizationsIcon,
};

/** 관리자 전용 메뉴 키 (Sidebar 섹션 분리용) */
const ADMIN_MENU_KEYS = new Set([
  "users",
  "audit_logs",
  "monitoring",
  "menu_management",
  "permission_management",
  "permission_groups",
  "organizations",
]);

/** 하단 고정 메뉴 키 (settings) */
const BOTTOM_MENU_KEYS = new Set(["settings"]);

/** 기본 아이콘 — 빌트인 메뉴 폴백 (문서 페이지) */
function DefaultPageIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
      />
    </svg>
  );
}

/**
 * icon 필드(kebab-case)를 Lucide 아이콘 NavItem 컴포넌트로 변환
 * 캐시하여 React가 동일 컴포넌트 타입으로 인식하도록 함
 */
const lucideIconCache = new Map<string, ComponentType<{ active: boolean }>>();

function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function resolveLucideIcon(
  iconName: string,
): ComponentType<{ active: boolean }> | null {
  if (lucideIconCache.has(iconName)) return lucideIconCache.get(iconName)!;

  const pascalName = toPascalCase(iconName);
  const LucideIcon = (
    lucideIcons as Record<string, ComponentType<Record<string, unknown>>>
  )[pascalName];
  if (!LucideIcon) return null;

  const NavIcon = ({ active }: { active: boolean }) => (
    <LucideIcon
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      strokeWidth={2}
      size={24}
    />
  );
  NavIcon.displayName = `LucideNavIcon(${iconName})`;

  lucideIconCache.set(iconName, NavIcon);
  return NavIcon;
}

/** 커스텀 메뉴 폴백 (외부 링크) */
function DefaultLinkIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 3h6v6M10 14L21 3"
      />
    </svg>
  );
}

/**
 * 서버 메뉴 데이터를 NavItem으로 변환
 */
export function menuToNavItem(menu: MenuItemResponse): NavItem {
  // 아이콘 우선순위: 1) 커스텀 icon 필드 → 2) 빌트인 레지스트리 → 3) 타입별 기본
  const customIcon = menu.icon ? resolveLucideIcon(menu.icon) : null;

  return {
    path: menu.path,
    label: menu.label,
    icon:
      customIcon ||
      ICON_REGISTRY[menu.permission_key] ||
      (menu.menu_type === "menu_group"
        ? MenuGroupIcon
        : menu.menu_type === "built_in"
          ? DefaultPageIcon
          : DefaultLinkIcon),
    permissionKey: menu.permission_key,
    badge:
      menu.section === "admin" || ADMIN_MENU_KEYS.has(menu.permission_key)
        ? "Admin"
        : undefined,
    menuType: menu.menu_type,
  };
}

/**
 * 메뉴 목록을 메인/관리자/하단 섹션으로 분류
 * menu_group이 있으면 parent_key 기반 2차원 계층 구조 생성
 */
export function categorizeMenus(menus: MenuItemResponse[]): {
  main: NavItem[];
  admin: NavItem[];
  bottom: NavItem[];
} {
  const main: NavItem[] = [];
  const admin: NavItem[] = [];
  const bottom: NavItem[] = [];

  // 1) 그룹 메뉴 식별
  const groupKeys = new Set(
    menus
      .filter((m) => m.menu_type === "menu_group")
      .map((m) => m.permission_key),
  );

  // 2) parent_key로 묶인 자식 NavItem 수집
  const childrenMap = new Map<string, NavItem[]>();
  const nestedKeys = new Set<string>();

  for (const menu of menus) {
    if (menu.parent_key && groupKeys.has(menu.parent_key)) {
      nestedKeys.add(menu.permission_key);
      if (!childrenMap.has(menu.parent_key)) {
        childrenMap.set(menu.parent_key, []);
      }
      childrenMap.get(menu.parent_key)!.push(menuToNavItem(menu));
    }
  }

  // 3) 최상위 메뉴만 분류 (자식은 그룹에 포함)
  for (const menu of menus) {
    if (nestedKeys.has(menu.permission_key)) continue;

    const navItem = menuToNavItem(menu);

    if (menu.menu_type === "menu_group") {
      navItem.children = childrenMap.get(menu.permission_key) || [];
    }

    if (BOTTOM_MENU_KEYS.has(menu.permission_key)) {
      bottom.push(navItem);
    } else if (
      menu.section === "admin" ||
      ADMIN_MENU_KEYS.has(menu.permission_key)
    ) {
      admin.push(navItem);
    } else {
      main.push(navItem);
    }
  }

  return { main, admin, bottom };
}

// ── 레거시 호환: 하드코딩된 메뉴 (권한 로딩 전 폴백) ──

export const mainNavItems: NavItem[] = [
  {
    path: "/",
    label: "대시보드",
    icon: DashboardIcon,
    permissionKey: "dashboard",
  },
  {
    path: "/channels",
    label: "채널 관리",
    icon: ChannelsIcon,
    permissionKey: "channels",
  },
  {
    path: "/messages",
    label: "메시지 히스토리",
    icon: MessagesIcon,
    permissionKey: "messages",
  },
  {
    path: "/statistics",
    label: "통계",
    icon: StatisticsIcon,
    permissionKey: "statistics",
  },
  {
    path: "/integrations",
    label: "연동 관리",
    icon: IntegrationsIcon,
    permissionKey: "integrations",
  },
  { path: "/help", label: "도움말", icon: HelpIcon, permissionKey: "help" },
  {
    path: "/settings",
    label: "설정",
    icon: SettingsIcon,
    permissionKey: "settings",
  },
];

export const adminNavItems: NavItem[] = [
  {
    path: "/users",
    label: "사용자 관리",
    icon: UsersIcon,
    permissionKey: "users",
    badge: "Admin",
  },
  {
    path: "/audit-logs",
    label: "감사 로그",
    icon: LogsIcon,
    permissionKey: "audit_logs",
    badge: "Admin",
  },
  {
    path: "/monitoring",
    label: "모니터링",
    icon: MonitoringIcon,
    permissionKey: "monitoring",
    badge: "Admin",
  },
];

/**
 * 사용자 역할에 따라 접근 가능한 메뉴 필터링 (레거시 호환)
 */
export function filterNavItemsByRole(
  items: NavItem[],
  role?: UserRole | string,
): NavItem[] {
  if (!role) return [];
  // system_admin과 org_admin은 모든 항목 접근 가능
  if (isAdminRole(role)) return items;
  // 일반 사용자는 Admin 뱃지 없는 항목만
  return items.filter((item) => !item.badge);
}

/**
 * 사용자가 특정 메뉴에 접근할 수 있는지 확인 (레거시 호환)
 */
export function hasAccessToPath(
  path: string,
  role?: UserRole | string,
): boolean {
  const allItems = [...mainNavItems, ...adminNavItems];
  const item = allItems.find((i) => i.path === path);
  if (!item) return false;
  if (!item.badge) return true;
  return isAdminRole(role);
}

/* ── Nav Icons ── */

/** 메뉴 그룹 아이콘 (폴더) */
function MenuGroupIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  );
}

function ChannelsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

function MessagesIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function StatisticsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function IntegrationsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function HelpIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
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
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function LogsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function MonitoringIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8"
      />
    </svg>
  );
}

function MenuManagementIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {/* ListTree: 계층형 메뉴 구조 */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12h-8M21 6h-8M21 18h-8M3 6h4v4H3V6zm2 8v6m0 0h4"
      />
    </svg>
  );
}

function PermissionManagementIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function PermissionGroupsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {/* UserCog: 사용자 + 톱니바퀴 */}
      <circle cx="18" cy="15" r="3" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 17H3v-1a6 6 0 0112 0v1m-5-9a4 4 0 11-8 0 4 4 0 018 0z"
      />
      <path
        strokeLinecap="round"
        strokeWidth={2}
        d="M18 12v1m0 4v1m2.6-4.5l-.87.5m-3.46 2l-.87.5m0-5l.87.5m3.46 2l.87.5"
      />
    </svg>
  );
}

function OrganizationsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? "text-brand-600" : "text-content-tertiary"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}
