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

/** 그룹에 사용자 추가 */
export async function addGroupMember(
  groupId: number,
  userId: number,
): Promise<{ message: string }> {
  return post(`/api/permission-groups/${groupId}/members`, {
    user_id: userId,
  });
}

/** 그룹에서 사용자 제거 */
export async function removeGroupMember(
  groupId: number,
  userId: number,
): Promise<{ message: string }> {
  return del(`/api/permission-groups/${groupId}/members/${userId}`);
}

/** 특정 사용자가 소속된 그룹 목록 */
export async function getUserGroups(userId: number): Promise<{
  user_id: number;
  username: string;
  groups: Array<{
    id: number;
    name: string;
    description: string | null;
    is_default: boolean;
    assigned_at: string;
  }>;
}> {
  return get(`/api/permission-groups/user/${userId}/groups`);
}

/** 그룹 멤버 추가를 위한 사용자 검색 (이미 소속된 사용자 제외) */
export async function searchUsersForGroup(
  query: string,
  groupId?: number,
  limit: number = 20,
): Promise<{
  users: Array<{
    id: number;
    username: string;
    email: string;
    role: string;
  }>;
}> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (groupId) params.set("group_id", String(groupId));
  params.set("limit", String(limit));
  return get(`/api/permission-groups/members/search?${params.toString()}`);
}
