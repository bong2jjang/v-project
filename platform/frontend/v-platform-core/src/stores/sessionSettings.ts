/**
 * Session Settings Store
 *
 * 세션 관리 관련 사용자 설정 저장
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionSettings {
  // 토큰 만료 경고 설정
  warningEnabled: boolean; // 경고 알림 활성화 여부
  warningThresholdMinutes: number; // 경고 시작 시간 (3/5/10분)
  reminderIntervalMinutes: number; // 알림 반복 간격
  snoozeMinutes: number; // 스누즈 기간

  // 자동 연장 설정
  autoExtendEnabled: boolean; // 활동 감지 시 자동 연장
  autoExtendThresholdMinutes: number; // 자동 연장 시작 시간 (만료 N분 전)

  // Idle Timeout 설정
  idleTimeoutEnabled: boolean; // Idle timeout 활성화
  idleTimeoutMinutes: number; // 비활성 시간 (분)
}

interface SessionSettingsStore {
  settings: SessionSettings;
  updateSettings: (settings: Partial<SessionSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: SessionSettings = {
  // 경고 설정
  warningEnabled: true,
  warningThresholdMinutes: 5,
  reminderIntervalMinutes: 1,
  snoozeMinutes: 2,

  // 자동 연장 설정
  autoExtendEnabled: false,
  autoExtendThresholdMinutes: 3,

  // Idle timeout 설정
  idleTimeoutEnabled: false,
  idleTimeoutMinutes: 30,
};

export const useSessionSettingsStore = create<SessionSettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      resetSettings: () =>
        set({
          settings: DEFAULT_SETTINGS,
        }),
    }),
    {
      name: "session-settings", // localStorage key
    },
  ),
);
