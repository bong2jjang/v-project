import { apiClient, get, post, del } from "./client";
import type {
  SlaPolicy,
  SlaPolicyCreateInput,
  SlaPolicyUpdateInput,
  SlaPolicyListResponse,
  SlaRecalcResult,
  Priority,
} from "./itsmTypes";

export interface SlaPolicyListParams {
  page?: number;
  page_size?: number;
  priority?: Priority;
  category?: string;
  active_only?: boolean;
  search?: string;
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

export async function listSlaPolicies(
  params: SlaPolicyListParams = {},
): Promise<SlaPolicyListResponse> {
  return get<SlaPolicyListResponse>(`/api/admin/sla-policies${toQuery(params)}`);
}

export async function getSlaPolicy(id: string): Promise<SlaPolicy> {
  return get<SlaPolicy>(`/api/admin/sla-policies/${id}`);
}

export async function createSlaPolicy(data: SlaPolicyCreateInput): Promise<SlaPolicy> {
  return post<SlaPolicy>(`/api/admin/sla-policies`, data);
}

export async function updateSlaPolicy(
  id: string,
  data: SlaPolicyUpdateInput,
): Promise<SlaPolicy> {
  const response = await apiClient.patch<SlaPolicy>(`/api/admin/sla-policies/${id}`, data);
  return response.data;
}

export async function deleteSlaPolicy(id: string): Promise<void> {
  await del<void>(`/api/admin/sla-policies/${id}`);
}

export async function recalculateSlaPolicy(id: string): Promise<SlaRecalcResult> {
  return post<SlaRecalcResult>(`/api/admin/sla-policies/${id}/recalculate`, {});
}
