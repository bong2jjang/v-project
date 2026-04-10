/**
 * Audit Log API 클라이언트
 *
 * 감사 로그 조회 및 내보내기 API
 */

import { get } from "./client";
import { apiClient } from "./client";
import type { AuditLogListResponse, AuditLog } from "./types";

export interface GetAuditLogsParams {
  page?: number;
  per_page?: number;
  action?: string;
  user_id?: number;
  user_email?: string;
  resource_type?: string;
  resource_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  ip_address?: string;
}

/**
 * 감사 로그 목록 조회 (관리자 전용)
 */
export async function getAuditLogs(
  params?: GetAuditLogsParams,
): Promise<AuditLogListResponse> {
  return get<AuditLogListResponse>("/api/audit-logs", { params });
}

/**
 * 특정 감사 로그 조회 (관리자 전용)
 */
export async function getAuditLog(logId: number): Promise<AuditLog> {
  return get<AuditLog>(`/api/audit-logs/${logId}`);
}

/**
 * 감사 로그 CSV 내보내기 (관리자 전용)
 */
export async function exportAuditLogsCSV(
  params?: Omit<GetAuditLogsParams, "page" | "per_page">,
): Promise<Blob> {
  const response = await apiClient.get("/api/audit-logs/export/csv", {
    params,
    responseType: "blob",
  });
  return response.data;
}

/**
 * 감사 로그 통계 조회 (관리자 전용)
 */
export interface AuditLogStats {
  period_days: number;
  start_date: string;
  end_date: string;
  total_logs: number;
  by_status: Record<string, number>;
  top_actions: Array<{ action: string; count: number }>;
  top_users: Array<{ user_email: string; count: number }>;
}

export async function getAuditLogStats(days?: number): Promise<AuditLogStats> {
  return get<AuditLogStats>("/api/audit-logs/stats/summary", {
    params: days ? { days } : undefined,
  });
}
