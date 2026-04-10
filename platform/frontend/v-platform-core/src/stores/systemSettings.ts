/**
 * System Settings Store
 *
 * Zustand 기반 시스템 설정 관리 상태
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  systemSettingsApi,
  type SystemSettings,
  type SystemSettingsUpdate,
} from "../lib/api/systemSettings";
import { ApiClientError } from "../lib/api/client";

interface SystemSettingsState {
  // 상태
  settings: SystemSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (update: SystemSettingsUpdate) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  settings: null,
  isLoading: false,
  error: null,
};

export const useSystemSettingsStore = create<SystemSettingsState>()(
  devtools(
    (set) => ({
      ...initialState,

      /**
       * 시스템 설정 조회
       */
      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await systemSettingsApi.getSettings();
          set({ settings, isLoading: false });
        } catch (error) {
          const errorMessage =
            error instanceof ApiClientError
              ? error.getUserMessage()
              : "시스템 설정 조회 실패";
          set({ error: errorMessage, isLoading: false });
        }
      },

      /**
       * 시스템 설정 업데이트 (관리자 전용)
       */
      updateSettings: async (update) => {
        set({ isLoading: true, error: null });
        try {
          const settings = await systemSettingsApi.updateSettings(update);
          set({ settings, isLoading: false });
        } catch (error) {
          const errorMessage =
            error instanceof ApiClientError
              ? error.getUserMessage()
              : "시스템 설정 저장 실패";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      /**
       * 에러 메시지 제거
       */
      clearError: () => set({ error: null }),

      /**
       * 상태 초기화
       */
      reset: () => set(initialState),
    }),
    {
      name: "system-settings-store",
    },
  ),
);
