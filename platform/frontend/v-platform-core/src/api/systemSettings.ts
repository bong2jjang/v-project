/**
 * 시스템 설정 API 클라이언트
 */

import { apiClient } from "./client";

export interface SystemSettings {
  id: number;
  manual_enabled: boolean;
  manual_url: string;
  default_start_page: string;
  // 앱 브랜딩
  app_title?: string;
  app_description?: string;
  app_logo_url?: string;
}

export interface SystemSettingsUpdate {
  manual_enabled?: boolean;
  manual_url?: string;
  default_start_page?: string;
  app_title?: string;
  app_description?: string;
  app_logo_url?: string;
}

export interface PublicBranding {
  app_title?: string | null;
  app_description?: string | null;
  app_logo_url?: string | null;
}

export const systemSettingsApi = {
  /**
   * 시스템 설정 조회
   */
  getSettings: async (): Promise<SystemSettings> => {
    const response = await apiClient.get<SystemSettings>(
      "/api/system-settings/",
    );
    return response.data;
  },

  /**
   * 시스템 설정 업데이트 (관리자 전용)
   */
  updateSettings: async (
    update: SystemSettingsUpdate,
  ): Promise<SystemSettings> => {
    const response = await apiClient.put<SystemSettings>(
      "/api/system-settings/",
      update,
    );
    return response.data;
  },

  /**
   * 공개 브랜딩 조회 (인증 불필요) - 로그인 페이지용
   */
  getPublicBranding: async (): Promise<PublicBranding> => {
    const response = await apiClient.get<PublicBranding>(
      "/api/system-settings/branding",
    );
    return response.data;
  },
};
