/**
 * Providers Store - Provider 관리
 *
 * Slack/Teams Provider CRUD 상태 관리
 */

import { create } from "zustand";
import {
  providersApi,
  ProviderResponse,
  ProviderCreateRequest,
  ProviderUpdateRequest,
  ConnectionTestResponse,
  FeatureCatalogItem,
} from "@/lib/api/providers";

interface ProvidersState {
  // 상태
  providers: ProviderResponse[];
  selectedProvider: ProviderResponse | null;
  testResult: ConnectionTestResponse | null;
  featureCatalog: FeatureCatalogItem[] | null;
  categoryLabels: Record<string, string>;
  isLoading: boolean;
  isTesting: boolean;
  isCatalogLoading: boolean;
  error: string | null;

  // 액션
  fetchProviders: () => Promise<void>;
  createProvider: (data: ProviderCreateRequest) => Promise<void>;
  updateProvider: (id: number, data: ProviderUpdateRequest) => Promise<void>;
  deleteProvider: (id: number) => Promise<void>;
  testConnection: (id: number) => Promise<ConnectionTestResponse>;
  fetchFeatureCatalog: () => Promise<void>;
  setSelectedProvider: (provider: ProviderResponse | null) => void;
  clearError: () => void;
  clearTestResult: () => void;
}

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  // 초기 상태
  providers: [],
  selectedProvider: null,
  testResult: null,
  featureCatalog: null,
  categoryLabels: {},
  isLoading: false,
  isTesting: false,
  isCatalogLoading: false,
  error: null,

  // Provider 목록 조회
  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const providers = await providersApi.getProviders();
      set({ providers, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch providers",
        isLoading: false,
      });
    }
  },

  // Provider 추가
  createProvider: async (data: ProviderCreateRequest) => {
    set({ isLoading: true, error: null });
    try {
      await providersApi.createProvider(data);
      await get().fetchProviders();
      set({ isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create provider",
        isLoading: false,
      });
      throw error;
    }
  },

  // Provider 수정
  updateProvider: async (id: number, data: ProviderUpdateRequest) => {
    set({ isLoading: true, error: null });
    try {
      await providersApi.updateProvider(id, data);
      await get().fetchProviders();
      set({ isLoading: false, selectedProvider: null });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to update provider",
        isLoading: false,
      });
      throw error;
    }
  },

  // Provider 삭제
  deleteProvider: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await providersApi.deleteProvider(id);
      await get().fetchProviders();
      set({ isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to delete provider",
        isLoading: false,
      });
      throw error;
    }
  },

  // 연결 테스트
  testConnection: async (id: number) => {
    set({ isTesting: true, error: null, testResult: null });
    try {
      const result = await providersApi.testConnection(id);
      set({ testResult: result, isTesting: false });
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to test connection";
      set({
        error: errorMessage,
        testResult: {
          success: false,
          message: errorMessage,
        },
        isTesting: false,
      });
      throw error;
    }
  },

  // 기능 카탈로그 조회
  fetchFeatureCatalog: async () => {
    if (get().featureCatalog !== null) return; // 이미 로드됨
    set({ isCatalogLoading: true });
    try {
      const catalog = await providersApi.getFeatureCatalog();
      set({
        featureCatalog: catalog.features,
        categoryLabels: catalog.category_labels,
        isCatalogLoading: false,
      });
    } catch (error) {
      set({ isCatalogLoading: false });
    }
  },

  // 선택된 Provider 설정
  setSelectedProvider: (provider: ProviderResponse | null) => {
    set({ selectedProvider: provider, error: null });
  },

  clearError: () => set({ error: null }),
  clearTestResult: () => set({ testResult: null }),
}));
