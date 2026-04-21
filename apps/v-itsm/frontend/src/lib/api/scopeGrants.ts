/**
 * v-itsm Scope Grant API 클라이언트.
 */

import { apiClient, get, post, del } from "./client";
import type {
  ScopeGrant,
  ScopeGrantCreateInput,
  ScopeGrantUpdateInput,
  ScopeGrantListResponse,
  UserScopeSummary,
} from "./itsmTypes";

export interface ScopeGrantListParams {
  permission_group_id?: number;
  customer_id?: string;
  product_id?: string;
}

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export async function listScopeGrants(
  params: ScopeGrantListParams = {},
): Promise<ScopeGrantListResponse> {
  return get<ScopeGrantListResponse>(`/api/scope-grants${toQuery(params)}`);
}

export async function getScopeGrant(id: string): Promise<ScopeGrant> {
  return get<ScopeGrant>(`/api/scope-grants/${id}`);
}

export async function createScopeGrant(
  data: ScopeGrantCreateInput,
): Promise<ScopeGrant> {
  return post<ScopeGrant>(`/api/scope-grants`, data);
}

export async function updateScopeGrant(
  id: string,
  data: ScopeGrantUpdateInput,
): Promise<ScopeGrant> {
  const response = await apiClient.patch<ScopeGrant>(
    `/api/scope-grants/${id}`,
    data,
  );
  return response.data;
}

export async function deleteScopeGrant(id: string): Promise<void> {
  await del<void>(`/api/scope-grants/${id}`);
}

export async function getMyScopeSummary(): Promise<UserScopeSummary> {
  return get<UserScopeSummary>(`/api/scope-grants/my`);
}
