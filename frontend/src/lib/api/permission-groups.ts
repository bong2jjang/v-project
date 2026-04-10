/**
 * Permission Group API Client
 *
 * 권한 그룹 CRUD + grants + members API
 */

import { get, post, put, del } from "./client";
import type { PermissionGroup, AccessLevel } from "./types";

/** 그룹 목록 */
export async function getGroups(): Promise<PermissionGroup[]> {
  return get<PermissionGroup[]>("/api/permission-groups");
}

/** 그룹 상세 */
export async function getGroup(groupId: number): Promise<PermissionGroup> {
  return get<PermissionGroup>(`/api/permission-groups/${groupId}`);
}

/** 그룹 생성 (system_admin) */
export async function createGroup(data: {
  name: string;
  description?: string;
}): Promise<PermissionGroup> {
  return post<PermissionGroup>("/api/permission-groups", data);
}

/** 그룹 수정 (system_admin) */
export async function updateGroup(
  groupId: number,
  data: { name?: string; description?: string; is_active?: boolean },
): Promise<PermissionGroup> {
  return put<PermissionGroup>(`/api/permission-groups/${groupId}`, data);
}

/** 그룹 삭제 (system_admin) */
export async function deleteGroup(groupId: number): Promise<void> {
  return del<void>(`/api/permission-groups/${groupId}`);
}

/** 그룹 메뉴 권한 설정 (system_admin) */
export async function setGroupGrants(
  groupId: number,
  grants: Array<{ menu_item_id: number; access_level: AccessLevel }>,
): Promise<{ message: string; count: number }> {
  return put(`/api/permission-groups/${groupId}/grants`, { grants });
}

/** 그룹 소속 사용자 목록 */
export async function getGroupMembers(groupId: number): Promise<{
  group_id: number;
  group_name: string;
  members: Array<{
    user_id: number;
    email: string;
    username: string;
    role: string;
    assigned_by: number | null;
    created_at: string;
  }>;
}> {
  return get(`/api/permission-groups/${groupId}/members`);
}
