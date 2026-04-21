/**
 * v-itsm Contract API 클라이언트.
 */

import { apiClient, get, post, del } from "./client";
import type {
  Contract,
  ContractCreateInput,
  ContractUpdateInput,
  ContractListResponse,
  ContractStatus,
} from "./itsmTypes";

export interface ContractListParams {
  page?: number;
  page_size?: number;
  customer_id?: string;
  status?: ContractStatus;
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

export async function listContracts(
  params: ContractListParams = {},
): Promise<ContractListResponse> {
  return get<ContractListResponse>(`/api/contracts${toQuery(params)}`);
}

export async function getContract(id: string): Promise<Contract> {
  return get<Contract>(`/api/contracts/${id}`);
}

export async function createContract(
  data: ContractCreateInput,
): Promise<Contract> {
  return post<Contract>(`/api/contracts`, data);
}

export async function updateContract(
  id: string,
  data: ContractUpdateInput,
): Promise<Contract> {
  const response = await apiClient.patch<Contract>(
    `/api/contracts/${id}`,
    data,
  );
  return response.data;
}

export async function deleteContract(id: string): Promise<void> {
  await del<void>(`/api/contracts/${id}`);
}
