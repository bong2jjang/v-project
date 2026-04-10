/**
 * Permission Store
 *
 * RBAC 권한 및 메뉴 상태 관리 (Zustand)
 */

import { create } from "zustand";
import type { AccessLevel, MenuItemResponse } from "../lib/api/types";
import * as permissionApi from "../lib/api/permissions";

const ACCESS_ORDER: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
};

interface PermissionState {
  /** 서버에서 받은 접근 가능 메뉴 목록 (access_level 포함) */
  menus: MenuItemResponse[];
  /** permission_key → access_level 맵 */
  permissions: Record<string, AccessLevel>;
  /** 데이터 로드 완료 여부 */
  isLoaded: boolean;
  /** 로딩 중 여부 */
  isLoading: boolean;

  // Actions
  fetchPermissions: () => Promise<void>;
  hasPermission: (key: string, level?: AccessLevel) => boolean;
  canAccess: (key: string) => boolean;
  canWrite: (key: string) => boolean;
  getMenusBySection: () => {
    main: MenuItemResponse[];
    admin: MenuItemResponse[];
  };
  reset: () => void;
}

/** 관리자 전용 메뉴 permission_key 목록 */
const ADMIN_MENU_KEYS = new Set([
  "users",
  "audit_logs",
  "monitoring",
  "menu_management",
  "permission_management",
]);

export const usePermissionStore = create<PermissionState>((set, get) => ({
  menus: [],
  permissions: {},
  isLoaded: false,
  isLoading: false,

  fetchPermissions: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });

    try {
      const [menusRes, permsRes] = await Promise.all([
        permissionApi.getMyMenus(),
        permissionApi.getMyPermissions(),
      ]);

      set({
        menus: menusRes.menus,
        permissions: permsRes.permissions,
        isLoaded: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  hasPermission: (key: string, level: AccessLevel = "read") => {
    const { permissions } = get();
    const userLevel = permissions[key];
    if (!userLevel) return false;
    return ACCESS_ORDER[userLevel] >= ACCESS_ORDER[level];
  },

  canAccess: (key: string) => get().hasPermission(key, "read"),
  canWrite: (key: string) => get().hasPermission(key, "write"),

  getMenusBySection: () => {
    const { menus } = get();
    const main: MenuItemResponse[] = [];
    const admin: MenuItemResponse[] = [];

    for (const menu of menus) {
      if (ADMIN_MENU_KEYS.has(menu.permission_key)) {
        admin.push(menu);
      } else {
        main.push(menu);
      }
    }

    return { main, admin };
  },

  reset: () => set({ menus: [], permissions: {}, isLoaded: false }),
}));
