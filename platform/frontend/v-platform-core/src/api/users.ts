/**
 * User Management API
 *
 * 사용자 관리 API (관리자 전용)
 */

import { get, post, put, del } from "./client";
import type {
  AdminUserCreate,
  User,
  UserListResponse,
  UserUpdate,
  UserUpdateMe,
  UserPasswordChange,
  UserRoleUpdate,
  GroupBrief,
  EffectivePermission,
} from "./types";

/**
 * 사용자 생성 (관리자 전용)
 */
export async function createUser(data: AdminUserCreate): Promise<User> {
  return post<User>("/api/users", data);
}

/**
 * 사용자 목록 조회 (관리자 전용)
 */
export async function getUsers(params?: {
  page?: number;
  per_page?: number;
  role?: string;
  is_active?: boolean;
  search?: string;
  company_id?: number;
  department_id?: number;
  group_id?: number;
}): Promise<UserListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.append("page", params.page.toString());
  if (params?.per_page)
    queryParams.append("per_page", params.per_page.toString());
  if (params?.role) queryParams.append("role", params.role);
  if (params?.is_active !== undefined)
    queryParams.append("is_active", params.is_active.toString());
  if (params?.search) queryParams.append("search", params.search);
  if (params?.company_id)
    queryParams.append("company_id", params.company_id.toString());
  if (params?.department_id)
    queryParams.append("department_id", params.department_id.toString());
  if (params?.group_id)
    queryParams.append("group_id", params.group_id.toString());

  const query = queryParams.toString();
  return get<UserListResponse>(`/api/users${query ? `?${query}` : ""}`);
}

/**
 * 특정 사용자 조회 (관리자 전용)
 */
export async function getUser(userId: number): Promise<User> {
  return get<User>(`/api/users/${userId}`);
}

/**
 * 사용자 정보 수정 (관리자 전용)
 */
export async function updateUser(
  userId: number,
  data: UserUpdate,
): Promise<User> {
  return put<User>(`/api/users/${userId}`, data);
}

/**
 * 사용자 삭제 (관리자 전용)
 */
export async function deleteUser(userId: number): Promise<void> {
  return del<void>(`/api/users/${userId}`);
}

/**
 * 사용자 역할 변경 (관리자 전용)
 */
export async function updateUserRole(
  userId: number,
  data: UserRoleUpdate,
): Promise<User> {
  return put<User>(`/api/users/${userId}/role`, data);
}

/**
 * 본인 정보 조회
 */
export async function getMe(): Promise<User> {
  return get<User>("/api/users/me");
}

/**
 * 본인 정보 수정
 */
export async function updateMe(data: UserUpdateMe): Promise<User> {
  return put<User>("/api/users/me", data);
}

/**
 * 비밀번호 변경
 */
export async function changePassword(
  data: UserPasswordChange,
): Promise<{ message: string }> {
  return put<{ message: string }>("/api/users/me/password", data);
}

/** 사용자 그룹 설정 */
export async function setUserGroups(
  userId: number,
  groupIds: number[],
): Promise<{ message: string; groups: GroupBrief[] }> {
  return put(`/api/users/${userId}/groups`, { group_ids: groupIds });
}

/** 사용자 그룹 조회 */
export async function getUserGroups(
  userId: number,
): Promise<{ user_id: number; groups: GroupBrief[] }> {
  return get(`/api/users/${userId}/groups`);
}

/** 사용자 유효 권한 조회 (그룹+개인 MAX) */
export async function getUserEffectivePermissions(
  userId: number,
): Promise<{ user_id: number; effective_permissions: EffectivePermission[] }> {
  return get(`/api/users/${userId}/effective-permissions`);
}
