/**
 * v-itsm 관리자 통합 업무(Cross-workspace) API 클라이언트 — v0.6.
 *
 * - SYSTEM_ADMIN: 전체 워크스페이스/고객/제품 대상
 * - 일반 사용자: ScopeGrant 기반 ACL 자동 적용 (스코프 없으면 403)
 * - owner_id 필터 허용 — "관리하는 티켓" 중 특정 담당자로 좁히기 위함
 */

import { get } from "./client";
import type {
  LoopStage,
  RequestServiceType,
  TicketListResponse,
} from "./itsmTypes";

export interface AdminAllWorkListParams {
  page?: number;
  page_size?: number;
  stage?: LoopStage;
  owner_id?: number;
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

export async function listAdminAllWorkTickets(
  params: AdminAllWorkListParams = {},
): Promise<TicketListResponse> {
  return get<TicketListResponse>(`/api/admin/all-work/tickets${toQuery(params)}`);
}
