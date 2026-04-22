/**
 * v-itsm Ticket API 클라이언트 (v0.2).
 */

import { apiClient, get, post } from "./client";
import type {
  AllowedActions,
  ListTransitionsOptions,
  LoopStage,
  LoopTransition,
  LoopTransitionDetail,
  RequestServiceType,
  Ticket,
  TicketIntakeInput,
  TicketListResponse,
  TicketTransitionInput,
  TicketUpdateInput,
} from "./itsmTypes";

export interface TicketListParams {
  page?: number;
  page_size?: number;
  stage?: LoopStage;
  owner_id?: number;
  service_type?: RequestServiceType;
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

export async function intakeTicket(data: TicketIntakeInput): Promise<Ticket> {
  return post<Ticket>(`/api/tickets/intake`, data);
}

export async function listTickets(
  params: TicketListParams = {},
): Promise<TicketListResponse> {
  return get<TicketListResponse>(`/api/tickets${toQuery(params)}`);
}

export async function getTicket(id: string): Promise<Ticket> {
  return get<Ticket>(`/api/tickets/${id}`);
}

export async function updateTicket(
  id: string,
  data: TicketUpdateInput,
): Promise<Ticket> {
  const response = await apiClient.patch<Ticket>(`/api/tickets/${id}`, data);
  return response.data;
}

export async function transitionTicket(
  id: string,
  data: TicketTransitionInput,
): Promise<LoopTransition> {
  return post<LoopTransition>(`/api/tickets/${id}/transition`, data);
}

export async function listTransitions(
  id: string,
  options: ListTransitionsOptions = {},
): Promise<LoopTransitionDetail[]> {
  const qs = toQuery({
    include_deleted: options.include_deleted ? "true" : undefined,
    with_latest_revision: options.with_latest_revision ? "true" : undefined,
  });
  return get<LoopTransitionDetail[]>(`/api/tickets/${id}/transitions${qs}`);
}

export async function getAllowedActions(id: string): Promise<AllowedActions> {
  return get<AllowedActions>(`/api/tickets/${id}/allowed-actions`);
}
