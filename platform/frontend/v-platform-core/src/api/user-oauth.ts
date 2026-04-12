/**
 * User OAuth API 클라이언트
 *
 * 사용자별 OAuth 연동 관리 API
 */

import { apiClient } from "./client";

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type TokenStatus =
  | "active"
  | "expired_refreshable"
  | "inactive"
  | "not_connected";

export interface OAuthStatus {
  id: number | null;
  account_id: number;
  account_name: string;
  platform: string;
  is_connected: boolean;
  platform_user_name: string | null;
  platform_email: string | null;
  token_expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  token_status: TokenStatus;
}

export interface AdminOAuthEntry {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  account_id: number;
  account_name: string;
  platform: string;
  platform_email: string | null;
  is_active: boolean;
  token_status: TokenStatus;
  token_expires_at: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

export interface AdminOAuthStats {
  total: number;
  active: number;
  inactive: number;
  by_platform: Record<string, number>;
}

// ─── API 클라이언트 ─────────────────────────────────────────────────────────

export const userOAuthApi = {
  /**
   * 내 OAuth 연동 목록 조회
   */
  async getMyOAuth(): Promise<OAuthStatus[]> {
    const response = await apiClient.get<OAuthStatus[]>("/api/users/me/oauth");
    return response.data;
  },

  /**
   * 특정 Account의 연동 상태 조회
   */
  async getOAuthStatus(accountId: number): Promise<OAuthStatus> {
    const response = await apiClient.get<OAuthStatus>(
      `/api/users/me/oauth/${accountId}/status`,
    );
    return response.data;
  },

  /**
   * OAuth 연동 시작 URL 생성
   * 브라우저 팝업으로 열어야 함
   */
  getConnectUrl(accountId: number): string {
    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL ?? "";
    return `${baseUrl}/api/users/me/oauth/${accountId}/connect?auth_token=${token}`;
  },

  /**
   * OAuth 연동 해제
   */
  async disconnect(accountId: number): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `/api/users/me/oauth/${accountId}/disconnect`,
    );
    return response.data;
  },

  // ─── 관리자 API ───────────────────────────────────────────────────────────

  /**
   * 전체 사용자 OAuth 연동 현황 (관리자)
   */
  async adminGetAll(): Promise<AdminOAuthEntry[]> {
    const response = await apiClient.get<AdminOAuthEntry[]>("/api/admin/oauth");
    return response.data;
  },

  /**
   * 특정 사용자 연동 강제 해제 (관리자)
   */
  async adminRevoke(tokenId: number): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(
      `/api/admin/oauth/${tokenId}`,
    );
    return response.data;
  },

  /**
   * OAuth 연동 통계 (관리자)
   */
  async adminGetStats(): Promise<AdminOAuthStats> {
    const response = await apiClient.get<AdminOAuthStats>(
      "/api/admin/oauth/stats",
    );
    return response.data;
  },
};
