/**
 * v-itsm Customer / CustomerContact API 클라이언트.
 */

import { apiClient, get, post, del } from "./client";
import type {
  Customer,
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerListResponse,
  CustomerContact,
  CustomerContactCreateInput,
  CustomerContactUpdateInput,
  CustomerStatus,
  RequestServiceType,
} from "./itsmTypes";

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  service_type?: RequestServiceType;
  status?: CustomerStatus;
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

export async function listCustomers(
  params: CustomerListParams = {},
): Promise<CustomerListResponse> {
  return get<CustomerListResponse>(`/api/customers${toQuery(params)}`);
}

export async function getCustomer(id: string): Promise<Customer> {
  return get<Customer>(`/api/customers/${id}`);
}

export async function createCustomer(
  data: CustomerCreateInput,
): Promise<Customer> {
  return post<Customer>(`/api/customers`, data);
}

export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput,
): Promise<Customer> {
  const response = await apiClient.patch<Customer>(
    `/api/customers/${id}`,
    data,
  );
  return response.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await del<void>(`/api/customers/${id}`);
}

export async function listContacts(
  customerId: string,
): Promise<CustomerContact[]> {
  return get<CustomerContact[]>(`/api/customers/${customerId}/contacts`);
}

export async function createContact(
  customerId: string,
  data: CustomerContactCreateInput,
): Promise<CustomerContact> {
  return post<CustomerContact>(
    `/api/customers/${customerId}/contacts`,
    data,
  );
}

export async function updateContact(
  contactId: string,
  data: CustomerContactUpdateInput,
): Promise<CustomerContact> {
  const response = await apiClient.patch<CustomerContact>(
    `/api/customers/contacts/${contactId}`,
    data,
  );
  return response.data;
}

export async function deleteContact(contactId: string): Promise<void> {
  await del<void>(`/api/customers/contacts/${contactId}`);
}
