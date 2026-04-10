/**
 * 시스템 설정 API 클라이언트
 */

import { apiClient } from "./client";

export interface SystemSettings {
  id: number;
  manual_enabled: boolean;
  manual_url: string;
  default_start_page: string;
}

export interface SystemSettingsUpdate {
  manual_enabled?: boolean;
  manual_url?: string;
  default_start_page?: string;
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
};
