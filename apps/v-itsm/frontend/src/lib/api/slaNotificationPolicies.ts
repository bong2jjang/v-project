import { apiClient, get, post, del } from "./client";
import type {
  SlaNotificationPolicy,
  SlaNotificationPolicyCreateInput,
  SlaNotificationPolicyUpdateInput,
  SlaNotificationPolicyListResponse,
  Priority,
  RequestServiceType,
  TriggerEvent,
} from "./itsmTypes";

export interface SlaNotificationPolicyListParams {
  page?: number;
  page_size?: number;
  trigger_event?: TriggerEvent;
  priority?: Priority;
  service_type?: RequestServiceType;
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

export async function listSlaNotificationPolicies(
  params: SlaNotificationPolicyListParams = {},
): Promise<SlaNotificationPolicyListResponse> {
  return get<SlaNotificationPolicyListResponse>(
    `/api/admin/sla-notification-policies${toQuery(params)}`,
  );
}

export async function getSlaNotificationPolicy(
  id: string,
): Promise<SlaNotificationPolicy> {
  return get<SlaNotificationPolicy>(`/api/admin/sla-notification-policies/${id}`);
}

export async function createSlaNotificationPolicy(
  data: SlaNotificationPolicyCreateInput,
): Promise<SlaNotificationPolicy> {
  return post<SlaNotificationPolicy>(`/api/admin/sla-notification-policies`, data);
}

export async function updateSlaNotificationPolicy(
  id: string,
  data: SlaNotificationPolicyUpdateInput,
): Promise<SlaNotificationPolicy> {
  const response = await apiClient.patch<SlaNotificationPolicy>(
    `/api/admin/sla-notification-policies/${id}`,
    data,
  );
  return response.data;
}

export async function deleteSlaNotificationPolicy(id: string): Promise<void> {
  await del<void>(`/api/admin/sla-notification-policies/${id}`);
}
