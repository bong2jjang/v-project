/**
 * Config Store
 *
 * Zustand 기반 설정 관리 상태
 *
 * ⚠️ IMPORTANT: DB-First Architecture
 * - **Account**: /api/accounts-db를 사용하세요 (이 store는 deprecated)
 * - **Gateway**: /api/gateways를 사용하세요 (이 store는 deprecated)
 * - **General**: 이 store를 사용하세요 (권장)
 *
 * 이 store는 주로 General 설정과 백업/복원을 위해 사용됩니다.
 * Account와 Gateway는 각각의 전용 API를 사용하는 것을 권장합니다.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import * as api from "../lib/api";
import type {
  BackupInfo,
  MatterbridgeConfig,
  ValidationResult,
} from "../lib/api/types";

interface ConfigState {
  // 상태
  config: MatterbridgeConfig | null;
  validation: ValidationResult | null;
  backups: BackupInfo[];
  isLoading: boolean;
  error: string | null;
  lastBackupPath: string | null;

  // Actions
  /**
   * 현재 설정 조회
   *
   * ⚠️ 주의: Account와 Gateway는 각각의 전용 API를 사용하는 것을 권장합니다.
   * - Account: getAccounts() from lib/api/accounts.ts
   * - Gateway: getGateways() from lib/api/gateway.ts
   * - General: 이 함수 사용 권장
   */
  fetchConfig: () => Promise<void>;
  /**
   * 설정 업데이트
   *
   * ⚠️ 주의: General 섹션만 업데이트하세요.
   * Account와 Gateway를 포함하면 400 에러가 발생합니다.
   */
  updateConfig: (
    config: MatterbridgeConfig,
    createBackup?: boolean,
  ) => Promise<void>;
  validateConfig: (config?: MatterbridgeConfig | null) => Promise<boolean>;
  createBackup: () => Promise<void>;
  fetchBackups: () => Promise<void>;
  restoreConfig: (backupPath: string) => Promise<void>;
  clearError: () => void;
  clearValidation: () => void;
  reset: () => void;
}

const initialState = {
  config: null,
  validation: null,
  backups: [],
  isLoading: false,
  error: null,
  lastBackupPath: null,
};

export const useConfigStore = create<ConfigState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * 현재 설정 조회
       */
      fetchConfig: async () => {
        set({ isLoading: true, error: null });
        try {
          const config = await api.getConfig();
          set({ config, isLoading: false });
        } catch (error) {
          const errorMessage =
            error instanceof api.ApiClientError
              ? error.getUserMessage()
              : "설정 조회 실패";
          set({ error: errorMessage, isLoading: false });
        }
      },

      /**
       * 설정 업데이트
       */
      updateConfig: async (config, createBackup = true) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.updateConfig(config, createBackup);
          set({
            config,
            isLoading: false,
            lastBackupPath: response.backup_path || null,
          });

          // 백업 목록 다시 조회
          if (createBackup) {
            get().fetchBackups();
          }
        } catch (error) {
          const errorMessage =
            error instanceof api.ApiClientError
              ? error.getUserMessage()
              : "설정 업데이트 실패";
          set({ error: errorMessage, isLoading: false });
          throw error; // 상위에서 에러 처리 가능하도록
        }
      },

      /**
       * 설정 검증
       *
       * @returns 검증 성공 여부
       */
      validateConfig: async (config = null) => {
        set({ isLoading: true, error: null, validation: null });
        try {
          const validation = await api.validateConfig(config);
          set({ validation, isLoading: false });
          return validation.valid;
        } catch (error) {
          const errorMessage =
            error instanceof api.ApiClientError
              ? error.getUserMessage()
              : "설정 검증 실패";
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      /**
       * 백업 생성
       */
      createBackup: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.createBackup();
          set({
            isLoading: false,
            lastBackupPath: response.backup_path || null,
          });

          // 백업 목록 다시 조회
          get().fetchBackups();
        } catch (error) {
          const errorMessage =
            error instanceof api.ApiClientError
              ? error.getUserMessage()
              : "백업 생성 실패";
          set({ error: errorMessage, isLoading: false });
        }
      },

      /**
       * 백업 목록 조회
       */
      fetchBackups: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.listBackups();
          set({ backups: response.backups, isLoading: false });
        } catch (error) {
          const errorMessage =
            error instanceof api.ApiClientError
              ? error.getUserMessage()
              : "백업 목록 조회 실패";
          set({ error: errorMessage, isLoading: false });
        }
      },

      /**
       * 설정 복원
       */
      restoreConfig: async (backupPath: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.restoreConfig(backupPath);

          // 복원 후 현재 설정 다시 조회
          const config = await api.getConfig();
          set({ config, isLoading: false });
        } catch (error) {
          const errorMessage =
            error instanceof api.ApiClientError
              ? error.getUserMessage()
              : "설정 복원 실패";
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      /**
       * 에러 초기화
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * 검증 결과 초기화
       */
      clearValidation: () => {
        set({ validation: null });
      },

      /**
       * 전체 상태 초기화
       */
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "config-store",
    },
  ),
);
