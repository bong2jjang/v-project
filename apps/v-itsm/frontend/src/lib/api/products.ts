/**
 * v-itsm Product API 클라이언트.
 */

import { apiClient, get, post, del } from "./client";
import type {
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  ProductListResponse,
} from "./itsmTypes";

export interface ProductListParams {
  page?: number;
  page_size?: number;
  active?: boolean;
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

export async function listProducts(
  params: ProductListParams = {},
): Promise<ProductListResponse> {
  return get<ProductListResponse>(`/api/products${toQuery(params)}`);
}

export async function getProduct(id: string): Promise<Product> {
  return get<Product>(`/api/products/${id}`);
}

export async function createProduct(
  data: ProductCreateInput,
): Promise<Product> {
  return post<Product>(`/api/products`, data);
}

export async function updateProduct(
  id: string,
  data: ProductUpdateInput,
): Promise<Product> {
  const response = await apiClient.patch<Product>(`/api/products/${id}`, data);
  return response.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await del<void>(`/api/products/${id}`);
}
