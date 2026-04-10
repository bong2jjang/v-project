/**
 * User OAuth Store
 *
 * 사용자별 OAuth 연동 상태 관리 (Zustand)
 */

import { create } from "zustand";
import {
  userOAuthApi,
  OAuthStatus,
  AdminOAuthEntry,
  AdminOAuthStats,
} from "@/lib/api/user-oauth";
import { ApiClientError } from "@/lib/api/client";

/** ApiClientError이면 getUserMessage(), 아니면 기본 메시지 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) return error.getUserMessage();
  if (error instanceof Error) return error.message;
  return fallback;
}

interface UserOAuthState {
  // 상태
  oauthList: OAuthStatus[];
  adminList: AdminOAuthEntry[];
  adminStats: AdminOAuthStats | null;
  isLoading: boolean;
  error: string | null;

  // 액션
  fetchMyOAuth: () => Promise<void>;
  disconnect: (accountId: number) => Promise<void>;
  openConnectPopup: (accountId: number) => void;
  adminFetchAll: () => Promise<void>;
  adminRevoke: (tokenId: number) => Promise<void>;
  adminFetchStats: () => Promise<void>;
  clearError: () => void;
}

export const useUserOAuthStore = create<UserOAuthState>((set, get) => ({
  oauthList: [],
  adminList: [],
  adminStats: null,
  isLoading: false,
  error: null,

  /**
   * 내 OAuth 연동 목록 조회
   */
  fetchMyOAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const oauthList = await userOAuthApi.getMyOAuth();
      set({ oauthList, isLoading: false });
    } catch (error) {
      set({
        error: extractErrorMessage(error, "OAuth 목록 조회 실패"),
        isLoading: false,
      });
    }
  },

  /**
   * OAuth 연동 해제
   */
  disconnect: async (accountId: number) => {
    set({ error: null });
    try {
      await userOAuthApi.disconnect(accountId);
      // 목록 갱신
      await get().fetchMyOAuth();
    } catch (error) {
      set({ error: extractErrorMessage(error, "연동 해제 실패") });
      throw error;
    }
  },

  /**
   * OAuth 연동 팝업 열기
   */
  openConnectPopup: (accountId: number) => {
    const url = userOAuthApi.getConnectUrl(accountId);
    const popup = window.open(url, "oauth_connect", "width=600,height=700");

    // 팝업 닫힘 감지 → 목록 갱신
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          get().fetchMyOAuth();
        }
      }, 500);
    }
  },

  /**
   * 관리자: 전체 OAuth 연동 목록
   */
  adminFetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const adminList = await userOAuthApi.adminGetAll();
      set({ adminList, isLoading: false });
    } catch (error) {
      set({
        error: extractErrorMessage(error, "관리자 목록 조회 실패"),
        isLoading: false,
      });
    }
  },

  /**
   * 관리자: 특정 사용자 연동 강제 해제
   */
  adminRevoke: async (tokenId: number) => {
    set({ error: null });
    try {
      await userOAuthApi.adminRevoke(tokenId);
      await get().adminFetchAll();
    } catch (error) {
      set({ error: extractErrorMessage(error, "강제 해제 실패") });
      throw error;
    }
  },

  /**
   * 관리자: OAuth 연동 통계
   */
  adminFetchStats: async () => {
    try {
      const adminStats = await userOAuthApi.adminGetStats();
      set({ adminStats });
    } catch (error) {
      set({ error: extractErrorMessage(error, "통계 조회 실패") });
    }
  },

  clearError: () => set({ error: null }),
}));
