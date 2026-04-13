/**
 * Permission & Menu API Client
 *
 * RBAC 권한 및 메뉴 관리 API
 */

import { get, post, put, del } from "./client";
import type {
  MyMenusResponse,
  MyPermissionsResponse,
  PermissionMatrixResponse,
  PermissionGrant,
  MenuItemResponse,
  AccessLevel,
  User,
} from "./types";

// ── 메뉴 ──────────────────────────────────────────────────────────

/** 현재 사용자가 접근 가능한 메뉴 목록 */
export async function getMyMenus(): Promise<MyMenusResponse> {
  return get<MyMenusResponse>("/api/menus");
}

/** 전체 메뉴 목록 (system_admin 전용) */
export async function getAllMenus(): Promise<{ menus: MenuItemResponse[] }> {
  return get<{ menus: MenuItemResponse[] }>("/api/menus/all");
}

/** 커스텀 메뉴 등록 (system_admin 전용) */
export async function createMenu(data: {
  permission_key: string;
  label: string;
  icon?: string;
  path: string;
  menu_type: string;
  iframe_url?: string;
  iframe_fullscreen?: boolean;
  open_in_new_tab?: boolean;
  parent_key?: string;
  sort_order?: number;
  section?: string;
}): Promise<MenuItemResponse> {
  return post<MenuItemResponse>("/api/menus", data);
}

/** 메뉴 수정 (system_admin 전용) */
export async function updateMenu(
  menuId: number,
  data: {
    label?: string;
    icon?: string;
    path?: string;
    iframe_url?: string;
    iframe_fullscreen?: boolean;
    open_in_new_tab?: boolean;
    parent_key?: string | null;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<MenuItemResponse> {
  return put<MenuItemResponse>(`/api/menus/${menuId}`, data);
}

/** 커스텀 메뉴 삭제 (system_admin 전용) */
export async function deleteMenu(menuId: number): Promise<{ message: string }> {
  return del<{ message: string }>(`/api/menus/${menuId}`);
}

/** 메뉴 순서 변경 (system_admin 전용) */
export async function reorderMenus(
  orders: Array<{ id: number; sort_order: number }>,
): Promise<{ message: string }> {
  return put<{ message: string }>("/api/menus/reorder", { orders });
}

// ── 권한 ──────────────────────────────────────────────────────────

/** 내 권한 목록 */
export async function getMyPermissions(): Promise<MyPermissionsResponse> {
  return get<MyPermissionsResponse>("/api/permissions/me");
}

/** 특정 사용자의 권한 목록 (admin) */
export async function getUserPermissions(
  userId: number,
): Promise<{ user_id: number; role: string; permissions: unknown[] }> {
  return get(`/api/permissions/user/${userId}`);
}

/** 사용자 권한 일괄 설정 (admin) */
export async function setUserPermissions(
  userId: number,
  permissions: PermissionGrant[],
): Promise<{ message: string; permissions: unknown[] }> {
  return put(`/api/permissions/user/${userId}`, { permissions });
}

/** 전체 권한 매트릭스 (admin) */
export async function getPermissionMatrix(): Promise<PermissionMatrixResponse> {
  return get<PermissionMatrixResponse>("/api/permissions/matrix");
}

/** 유효 권한 매트릭스 (그룹+개인 통합, source 포함) */
export async function getEffectiveMatrix(): Promise<{
  menus: MenuItemResponse[];
  users: Array<{
    user: User;
    permissions: Record<
      number,
      { level: AccessLevel; source: string; group_names?: string[] }
    >;
  }>;
}> {
  return get("/api/permissions/effective-matrix");
}

/** 특정 메뉴에 대한 모든 사용자 권한 조회 */
export async function getPermissionsByMenu(menuItemId: number): Promise<{
  menu_item_id: number;
  menu_label: string;
  permission_key: string;
  users: Array<{
    user_id: number;
    email: string;
    username: string;
    role: string;
    access_level: AccessLevel;
    source: string;
    group_names?: string[];
  }>;
}> {
  return get(`/api/permissions/by-menu/${menuItemId}`);
}

/** 특정 메뉴에 대한 여러 사용자 권한 일괄 설정 */
export async function setPermissionsByMenu(
  menuItemId: number,
  permissions: Array<{ menu_item_id: number; access_level: AccessLevel }>,
): Promise<{ message: string; count: number }> {
  return put(`/api/permissions/by-menu/${menuItemId}`, { permissions });
}

/** 그룹 템플릿을 여러 사용자에게 일괄 적용 */
export async function bulkAssignGroup(
  groupId: number,
  userIds: number[],
): Promise<{ message: string; group_id: number; user_count: number }> {
  return put(`/api/permissions/bulk/by-group/${groupId}`, {
    user_ids: userIds,
  });
}
