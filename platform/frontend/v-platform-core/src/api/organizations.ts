/**
 * Organization API Client
 *
 * 회사·부서 CRUD API
 */

import { get, post, put, del } from "./client";
import type { Company, Department, OrgTreeResponse } from "./types";

// ── 회사 ──────────────────────────────────────────────────────────

/** 회사 목록 */
export async function getCompanies(): Promise<Company[]> {
  return get<Company[]>("/api/organizations/companies");
}

/** 회사 생성 */
export async function createCompany(data: {
  name: string;
  code: string;
}): Promise<Company> {
  return post<Company>("/api/organizations/companies", data);
}

/** 회사 수정 */
export async function updateCompany(
  companyId: number,
  data: { name?: string; code?: string; is_active?: boolean },
): Promise<Company> {
  return put<Company>(`/api/organizations/companies/${companyId}`, data);
}

/** 회사 삭제 */
export async function deleteCompany(companyId: number): Promise<void> {
  return del<void>(`/api/organizations/companies/${companyId}`);
}

// ── 부서 ──────────────────────────────────────────────────────────

/** 부서 목록 (회사별, 플랫 배열) */
export async function getDepartments(companyId: number): Promise<Department[]> {
  return get<Department[]>(
    `/api/organizations/companies/${companyId}/departments?flat=true`,
  );
}

/** 부서 생성 */
export async function createDepartment(
  companyId: number,
  data: {
    name: string;
    code?: string;
    parent_id?: number;
    sort_order?: number;
  },
): Promise<Department> {
  return post<Department>(
    `/api/organizations/companies/${companyId}/departments`,
    data,
  );
}

/** 부서 수정 */
export async function updateDepartment(
  departmentId: number,
  data: {
    name?: string;
    code?: string;
    parent_id?: number | null;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<Department> {
  return put<Department>(
    `/api/organizations/departments/${departmentId}`,
    data,
  );
}

/** 부서 삭제 */
export async function deleteDepartment(departmentId: number): Promise<void> {
  return del<void>(`/api/organizations/departments/${departmentId}`);
}

// ── 조직도 트리 ────────────────────────────────────────────────────

/** 조직도 트리 조회 (회사 > 부서 > 사용자) */
export async function getOrgTree(): Promise<OrgTreeResponse> {
  return get<OrgTreeResponse>("/api/organizations/tree");
}
