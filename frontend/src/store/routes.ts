/**
 * Routes Store - Route 관리
 *
 * 동적 라우팅 룰 CRUD 상태 관리
 */

import { create } from "zustand";
import {
  routesApi,
  RouteResponse,
  RouteCreateRequest,
  ChannelInfo,
} from "@/lib/api/routes";

interface RoutesState {
  // 상태
  routes: RouteResponse[];
  channelsCache: Record<string, ChannelInfo[]>; // platform별 채널 캐시
  isLoading: boolean;
  isLoadingChannels: boolean;
  error: string | null;

  // 액션
  fetchRoutes: () => Promise<void>;
  addRoute: (route: RouteCreateRequest) => Promise<void>;
  deleteRoute: (route: RouteCreateRequest) => Promise<void>;
  toggleRoute: (params: {
    source_platform: string;
    source_channel: string;
    target_platform: string;
    target_channel: string;
    is_enabled: boolean;
  }) => Promise<void>;
  fetchChannels: (platform: string) => Promise<ChannelInfo[]>;
  clearError: () => void;
}

export const useRoutesStore = create<RoutesState>((set, get) => ({
  // 초기 상태
  routes: [],
  channelsCache: {},
  isLoading: false,
  isLoadingChannels: false,
  error: null,

  // Route 목록 조회
  fetchRoutes: async () => {
    set({ isLoading: true, error: null });
    try {
      const routes = await routesApi.getRoutes();
      set({ routes, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch routes",
        isLoading: false,
      });
    }
  },

  // Route 추가
  addRoute: async (route: RouteCreateRequest) => {
    set({ isLoading: true, error: null });
    try {
      await routesApi.addRoute(route);
      // 목록 새로고침
      await get().fetchRoutes();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to add route",
        isLoading: false,
      });
      throw error;
    }
  },

  // Route 활성/비활성 토글
  toggleRoute: async (params) => {
    set({ error: null });
    try {
      await routesApi.toggleRoute(params);
      // 목록 새로고침
      await get().fetchRoutes();
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to toggle route",
      });
      throw error;
    }
  },

  // Route 삭제
  deleteRoute: async (route: RouteCreateRequest) => {
    set({ isLoading: true, error: null });
    try {
      await routesApi.deleteRoute(route);

      // 채널 캐시 정리 (삭제된 Route의 플랫폼 캐시 제거)
      set((state) => {
        const newCache = { ...state.channelsCache };
        delete newCache[route.source_platform];
        delete newCache[route.target_platform];
        return { channelsCache: newCache };
      });

      // 목록 새로고침
      await get().fetchRoutes();
      set({ isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to delete route",
        isLoading: false,
      });
      throw error;
    }
  },

  // 채널 목록 조회 (캐시 포함)
  fetchChannels: async (platform: string): Promise<ChannelInfo[]> => {
    // 캐시 확인 (빈 배열은 캐시하지 않으므로 재시도)
    const cached = get().channelsCache[platform];
    if (cached && cached.length > 0) {
      return cached;
    }

    set({ isLoadingChannels: true, error: null });
    try {
      const channels = await routesApi.getChannels(platform);
      // 캐시 저장 (빈 배열은 캐시하지 않음)
      if (channels.length > 0) {
        set((state) => ({
          channelsCache: {
            ...state.channelsCache,
            [platform]: channels,
          },
          isLoadingChannels: false,
        }));
      } else {
        set({ isLoadingChannels: false });
      }
      return channels;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch channels",
        isLoadingChannels: false,
      });
      throw error;
    }
  },

  // 에러 초기화
  clearError: () => set({ error: null }),
}));
