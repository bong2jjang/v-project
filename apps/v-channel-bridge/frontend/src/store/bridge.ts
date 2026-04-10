/**
 * Bridge Store - 메시지 브리지
 *
 * 자체 메시지 브리지 상태 관리
 */

import { create } from "zustand";
import {
  bridgeApi,
  BridgeStatus,
  ProviderStatus,
  Route,
} from "@/lib/api/bridge";

interface BridgeState {
  // 상태
  status: BridgeStatus | null;
  providers: ProviderStatus[];
  routes: Route[];
  logs: string[];
  isLoading: boolean;
  error: string | null;

  // 액션
  fetchStatus: () => Promise<void>;
  fetchProviders: () => Promise<void>;
  fetchRoutes: () => Promise<void>;
  fetchLogs: (lines?: number) => Promise<void>;
  addRoute: (route: {
    source_platform: string;
    source_channel: string;
    target_platform: string;
    target_channel: string;
    target_channel_name?: string;
  }) => Promise<void>;
  removeRoute: (route: {
    source_platform: string;
    source_channel: string;
    target_platform: string;
    target_channel: string;
  }) => Promise<void>;
  sendCommand: (command: string) => Promise<any>;
  startBridge: () => Promise<void>;
  stopBridge: () => Promise<void>;
  clearError: () => void;
}

export const useBridgeStore = create<BridgeState>((set, get) => ({
  // 초기 상태
  status: null,
  providers: [],
  routes: [],
  logs: [],
  isLoading: false,
  error: null,

  // 브리지 상태 조회
  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await bridgeApi.getStatus();
      set({ status, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch status",
        isLoading: false,
      });
    }
  },

  // Provider 목록 조회
  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const providers = await bridgeApi.getProviders();
      set({ providers, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch providers",
        isLoading: false,
      });
    }
  },

  // 라우팅 룰 목록 조회
  fetchRoutes: async () => {
    set({ isLoading: true, error: null });
    try {
      const routes = await bridgeApi.getRoutes();
      set({ routes, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch routes",
        isLoading: false,
      });
    }
  },

  // 로그 조회
  fetchLogs: async (lines = 100) => {
    set({ isLoading: true, error: null });
    try {
      const response = await bridgeApi.getLogs(lines);
      set({ logs: response.logs || [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch logs",
        logs: [],
        isLoading: false,
      });
    }
  },

  // 라우팅 룰 추가
  addRoute: async (route) => {
    set({ isLoading: true, error: null });
    try {
      await bridgeApi.addRoute(route);
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

  // 라우팅 룰 제거
  removeRoute: async (route) => {
    set({ isLoading: true, error: null });
    try {
      await bridgeApi.removeRoute(route);
      // 목록 새로고침
      await get().fetchRoutes();
      set({ isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to remove route",
        isLoading: false,
      });
      throw error;
    }
  },

  // 커맨드 실행
  sendCommand: async (command: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await bridgeApi.sendCommand(command);
      set({ isLoading: false });
      return response;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to send command",
        isLoading: false,
      });
      throw error;
    }
  },

  // 브리지 시작
  startBridge: async () => {
    set({ isLoading: true, error: null });
    try {
      await bridgeApi.start();
      // 상태 새로고침
      await get().fetchStatus();
      set({ isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to start bridge",
        isLoading: false,
      });
      throw error;
    }
  },

  // 브리지 중지
  stopBridge: async () => {
    set({ isLoading: true, error: null });
    try {
      await bridgeApi.stop();
      // 상태 새로고침
      await get().fetchStatus();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to stop bridge",
        isLoading: false,
      });
      throw error;
    }
  },

  // 에러 클리어
  clearError: () => set({ error: null }),
}));
