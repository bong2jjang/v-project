/**
 * v-itsm SLA Timer API 클라이언트.
 */

import { get } from "./client";
import type {
  Priority,
  SlaSummary,
  SlaTimerKind,
  SlaTimerListResponse,
  SlaTimerStatus,
} from "./itsmTypes";

export interface SlaTimerListParams {
  page?: number;
  page_size?: number;
  status?: SlaTimerStatus;
  kind?: SlaTimerKind;
  priority?: Priority;
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

export async function listSlaTimers(
  params: SlaTimerListParams = {},
): Promise<SlaTimerListResponse> {
  return get<SlaTimerListResponse>(`/api/sla-timers${toQuery(params)}`);
}

export async function getSlaSummary(): Promise<SlaSummary> {
  return get<SlaSummary>(`/api/sla-timers/summary`);
}
