/**
 * v-itsm 내 업무(Cross-workspace) API 클라이언트 — v0.6.
 *
 * 서버가 owner_id 를 current_user.id 로 고정하므로 클라이언트는 전달하지 않는다.
 */

import { get } from "./client";
import type {
  LoopStage,
  RequestServiceType,
  TicketListResponse,
} from "./itsmTypes";

export interface MyWorkListParams {
  page?: number;
  page_size?: number;
  stage?: LoopStage;
  service_type?: RequestServiceType;
  customer_id?: string;
  product_id?: string;
  workspace_id?: string;
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

export async function listMyWorkTickets(
  params: MyWorkListParams = {},
): Promise<TicketListResponse> {
  return get<TicketListResponse>(`/api/my-work/tickets${toQuery(params)}`);
}
