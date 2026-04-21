/**
 * v-itsm SLA Tier API 클라이언트.
 */

import { apiClient, get, post, del } from "./client";
import type {
  SlaTier,
  SlaTierCreateInput,
  SlaTierUpdateInput,
  SlaTierListResponse,
} from "./itsmTypes";

export interface SlaTierListParams {
  active_only?: boolean;
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

export async function listSlaTiers(
  params: SlaTierListParams = {},
): Promise<SlaTierListResponse> {
  return get<SlaTierListResponse>(`/api/sla-tiers${toQuery(params)}`);
}

export async function getSlaTier(id: string): Promise<SlaTier> {
  return get<SlaTier>(`/api/sla-tiers/${id}`);
}

export async function createSlaTier(
  data: SlaTierCreateInput,
): Promise<SlaTier> {
  return post<SlaTier>(`/api/sla-tiers`, data);
}

export async function updateSlaTier(
  id: string,
  data: SlaTierUpdateInput,
): Promise<SlaTier> {
  const response = await apiClient.patch<SlaTier>(
    `/api/sla-tiers/${id}`,
    data,
  );
  return response.data;
}

export async function deleteSlaTier(id: string): Promise<void> {
  await del<void>(`/api/sla-tiers/${id}`);
}
