/**
 * Authentication Store
 *
 * 사용자 인증 상태 관리 (Zustand)
 */

import { create } from "zustand";
import type { User } from "../api/types";
import * as authApi from "../api/auth";
import { authLogger } from "../lib/utils/authLogger";

// 자동 갱신 타이머 참조 (전역)
let refreshTimerId: NodeJS.Timeout | null = null;

interface AuthState {
  user: User | null;
  token: string | null;
  tokenExpiresAt: Date | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // 초기 로드 완료 여부

  // Actions
  login: (credentials: {
    email: string;
    password: string;
    remember_me?: boolean;
  }) => Promise<void>;
  register: (userData: {
    email: string;
    username: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshToken: () => Promise<void>;
  loadUserFromStorage: () => void;
  isAdmin: () => boolean;
  scheduleTokenRefresh: (expiresAt: Date) => void;
  cancelTokenRefresh: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  tokenExpiresAt: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  /**
   * 로그인
   */
  login: async (credentials) => {
    set({ isLoading: true });
    authLogger.logAuthState("Login started", { email: credentials.email });

    try {
      // 디바이스 정보 추가
      const loginData = {
        ...credentials,
        device_name: authApi.generateDeviceName(),
        device_fingerprint: await authApi.generateDeviceFingerprint(),
      };

      const response = await authApi.login(loginData);

      // 토큰 및 사용자 정보 저장
      authApi.saveToken(response.access_token, response.expires_at);
      authApi.saveUser(response.user);

      const expiresAt = new Date(response.expires_at);

      set({
        user: response.user,
        token: response.access_token,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true,
        isLoading: false,
      });

      authLogger.logAuthState("Login successful", {
        user: response.user.email,
        role: response.user.role,
        expiresAt: expiresAt.toISOString(),
      });

      // 자동 토큰 갱신 예약 (만료 2분 전)
      get().scheduleTokenRefresh(expiresAt);
    } catch (error) {
      authLogger.logError("Login failed", error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * 회원가입
   */
  register: async (userData) => {
    set({ isLoading: true });
    try {
      await authApi.register(userData);

      // 회원가입 후 자동 로그인
      await get().login({
        email: userData.email,
        password: userData.password,
      });

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * 로그아웃
   */
  logout: async () => {
    set({ isLoading: true });
    authLogger.logAuthState("Logout started");

    try {
      await authApi.logout();
      authLogger.logAuthState("Logout API call successful");
    } catch (error) {
      authLogger.logError("Logout API call failed", error);
    } finally {
      // 자동 갱신 타이머 취소
      get().cancelTokenRefresh();

      set({
        user: null,
        token: null,
        tokenExpiresAt: null,
        isAuthenticated: false,
        isLoading: false,
      });

      authLogger.logAuthState("Logged out (state cleared)");
    }
  },

  /**
   * 모든 디바이스에서 로그아웃
   */
  logoutAll: async () => {
    set({ isLoading: true });
    try {
      await authApi.logoutAll();
    } finally {
      // 자동 갱신 타이머 취소
      get().cancelTokenRefresh();

      set({
        user: null,
        token: null,
        tokenExpiresAt: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * 토큰 갱신
   */
  refreshToken: async () => {
    authLogger.logTokenEvent("refreshToken() called from store");

    try {
      const response = await authApi.refreshToken();

      authApi.saveToken(response.access_token, response.expires_at);
      authApi.saveUser(response.user);

      const expiresAt = new Date(response.expires_at);

      set({
        user: response.user,
        token: response.access_token,
        tokenExpiresAt: expiresAt,
        isAuthenticated: true,
      });

      authLogger.logTokenEvent("Store token refreshed successfully", {
        expiresAt: expiresAt.toISOString(),
      });

      // 자동 토큰 갱신 다시 예약
      get().scheduleTokenRefresh(expiresAt);
    } catch (error) {
      authLogger.logError("Store token refresh failed", error);
      // 갱신 실패 시 로그아웃
      await get().logout();
      throw error;
    }
  },

  /**
   * 로컬 스토리지에서 사용자 정보 로드
   */
  loadUserFromStorage: () => {
    authLogger.logAuthState("Loading user from storage");

    // SSO Token Relay: URL에서 auth_token 파라미터 수신 (포탈에서 전달)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const relayToken = params.get("auth_token");
      if (relayToken) {
        authLogger.logAuthState("Token relay received from portal");
        authApi.setToken(relayToken);
        // URL에서 토큰 파라미터 제거 (보안)
        const url = new URL(window.location.href);
        url.searchParams.delete("auth_token");
        window.history.replaceState({}, "", url.toString());
      }
    }

    const token = authApi.getToken();
    const user = authApi.getUser();
    const expiresAt = authApi.getTokenExpiresAt();

    if (token && user) {
      const expired = authApi.isTokenExpired();

      authLogger.logAuthState("User found in storage", {
        user: user.email,
        expiresAt: expiresAt?.toISOString(),
        isExpired: expired,
      });

      // 토큰이 만료되었으면 인증 상태를 false로 설정하고 갱신 시도
      if (expired) {
        set({
          user,
          token,
          tokenExpiresAt: expiresAt,
          isAuthenticated: false,
          isInitialized: true,
        });

        authLogger.logTokenEvent("Token expired, attempting refresh");
        get()
          .refreshToken()
          .catch(() => {
            // 갱신 실패 시 로그아웃
            authLogger.logWarning("Token refresh failed on load, logging out");
            get().logout();
          });
      } else {
        set({
          user,
          token,
          tokenExpiresAt: expiresAt,
          isAuthenticated: true,
          isInitialized: true,
        });

        if (expiresAt) {
          // 만료되지 않았으면 자동 갱신 예약
          authLogger.logTokenEvent("Scheduling auto-refresh");
          get().scheduleTokenRefresh(expiresAt);
        }
      }
    } else {
      authLogger.logAuthState("No user found in storage");
      set({ isInitialized: true });
    }
  },

  /**
   * 관리자 권한 확인
   */
  isAdmin: () => {
    const { user } = get();
    return (
      user?.role === "system_admin" ||
      user?.role === "org_admin" ||
      user?.role === "admin"
    );
  },

  /**
   * 자동 토큰 갱신 예약
   * 토큰 만료 2분 전에 자동으로 갱신
   */
  scheduleTokenRefresh: (expiresAt: Date) => {
    // 기존 타이머 취소
    get().cancelTokenRefresh();

    const now = Date.now();
    const expiresAtMs = expiresAt.getTime();
    const timeUntilRefresh = expiresAtMs - now - 2 * 60 * 1000; // 만료 2분 전

    // 이미 만료 2분 전을 지났다면 즉시 갱신
    if (timeUntilRefresh <= 0) {
      authLogger.logTokenEvent("Token expires soon, refreshing immediately");
      console.log("[Auth] Token expires soon, refreshing now...");
      get()
        .refreshToken()
        .catch((error) => {
          console.error("[Auth] Auto refresh failed:", error);
        });
      return;
    }

    // 타이머 설정
    const minutesUntilRefresh = Math.floor(timeUntilRefresh / 1000 / 60);
    authLogger.logTokenEvent("Scheduled auto-refresh", {
      minutesUntilRefresh,
      expiresAt: expiresAt.toISOString(),
    });

    console.log(
      `[Auth] Scheduling token refresh in ${minutesUntilRefresh} minutes`,
    );

    refreshTimerId = setTimeout(() => {
      authLogger.logTokenEvent("Auto-refresh timer triggered");
      console.log("[Auth] Auto-refreshing token...");
      get()
        .refreshToken()
        .catch((error) => {
          console.error("[Auth] Auto refresh failed:", error);
        });
    }, timeUntilRefresh);
  },

  /**
   * 자동 토큰 갱신 타이머 취소
   */
  cancelTokenRefresh: () => {
    if (refreshTimerId) {
      clearTimeout(refreshTimerId);
      refreshTimerId = null;
      authLogger.logTokenEvent("Auto-refresh timer cancelled");
      console.log("[Auth] Token refresh timer cancelled");
    }
  },
}));
