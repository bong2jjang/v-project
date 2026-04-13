/**
 * Base API Client
 *
 * Axios 기반 HTTP 클라이언트 with 에러 처리 및 인터셉터
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import type { ApiError, ApiErrorDetail } from "./types";
import { authLogger } from "../lib/utils/authLogger";

// API Base URL
// Docker 환경: Vite proxy가 /api → backend로 전달하므로 빈 문자열 사용
// 로컬 환경: VITE_API_URL로 명시 지정
const _envUrl = import.meta.env.VITE_API_URL;
const API_BASE_URL =
  _envUrl && _envUrl.length > 0
    ? _envUrl
    : ""; // 빈 문자열 = 같은 origin (Vite proxy 사용)

// 401 리다이렉트 플래그 (중복 리다이렉트 방지)
let isRedirecting = false;

// 토큰 갱신 Promise (중복 방지)
let refreshPromise: Promise<void> | null = null;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Refresh 실패 카운터 (연속 3회 실패 시에만 로그아웃)
let refreshFailureCount = 0;
const MAX_REFRESH_FAILURES = 3;

/**
 * API 에러 클래스
 */
export class ApiClientError extends Error {
  public status: number;
  public detail: ApiErrorDetail | string;
  public originalError: AxiosError;

  get statusCode(): number {
    return this.status;
  }

  constructor(error: AxiosError) {
    const apiError = error.response?.data as ApiError | undefined;
    const detail = apiError?.detail || "Unknown error";

    super(
      typeof detail === "string"
        ? detail
        : detail.message || "API request failed",
    );

    this.name = "ApiClientError";
    this.status = error.response?.status || 500;
    this.detail = detail;
    this.originalError = error;
  }

  /**
   * 사용자 친화적 에러 메시지 반환
   */
  getUserMessage(): string {
    if (typeof this.detail === "string") {
      return this.detail;
    }

    const detail = this.detail as ApiErrorDetail;

    // 특정 에러 타입별 메시지
    switch (detail.error) {
      case "already_running":
        return "메시지 브리지가 이미 실행 중입니다.";
      case "not_running":
        return "메시지 브리지가 실행 중이 아닙니다.";
      case "validation_failed":
        return `설정 검증 실패: ${detail.errors?.[0] || detail.message}`;
      case "backup_not_found":
        return "백업 파일을 찾을 수 없습니다.";
      case "invalid_backup":
        return "유효하지 않은 백업 파일입니다.";
      default:
        return detail.message || "요청 처리 중 오류가 발생했습니다.";
    }
  }
}

/**
 * Cookie에서 CSRF 토큰 가져오기
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Axios 인스턴스 생성
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30초
    withCredentials: true, // 쿠키 전송 활성화 (refresh_token, csrf_token)
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request 인터셉터
  client.interceptors.request.use(
    (config) => {
      // 토큰 만료 사전 검증
      const tokenExpiresAtStr = localStorage.getItem("token_expires_at");
      if (tokenExpiresAtStr) {
        const tokenExpiresAt = new Date(tokenExpiresAtStr);
        const now = new Date();

        if (now >= tokenExpiresAt) {
          // 만료된 토큰으로 요청 차단
          authLogger.logWarning("[API] Token expired, blocking request", {
            url: config.url,
            expiresAt: tokenExpiresAt.toISOString(),
            now: now.toISOString(),
          });

          console.warn("[API] Token expired, blocking request to", config.url);

          // 인증 엔드포인트는 제외
          const isAuthEndpoint =
            config.url?.includes("/auth/login") ||
            config.url?.includes("/auth/register") ||
            config.url?.includes("/auth/refresh");

          if (!isAuthEndpoint) {
            return Promise.reject(new Error("Token expired"));
          }
        }
      }

      // JWT 토큰 추가
      const token = localStorage.getItem("token");
      const hasToken = !!token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // CSRF 토큰 추가 (변경 요청에만, 인증 엔드포인트 제외)
      let hasCsrf = false;
      const isAuthEndpoint =
        config.url?.includes("/auth/login") ||
        config.url?.includes("/auth/register") ||
        config.url?.includes("/auth/refresh") ||
        config.url?.includes("/auth/forgot-password") ||
        config.url?.includes("/auth/reset-password");

      if (
        config.method &&
        !["get", "head", "options"].includes(config.method.toLowerCase()) &&
        !isAuthEndpoint
      ) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          config.headers["X-CSRF-Token"] = csrfToken;
          hasCsrf = true;
        } else {
          authLogger.logWarning(
            `CSRF token missing for ${config.method.toUpperCase()} ${config.url}`,
          );
        }
      }

      // 상세 요청 로깅
      authLogger.logRequest(
        config.method?.toUpperCase() || "UNKNOWN",
        config.url || "",
        hasToken,
        hasCsrf,
      );

      return config;
    },
    (error) => {
      authLogger.logError("Request interceptor error", error);
      return Promise.reject(error);
    },
  );

  // Response 인터셉터
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // 상세 응답 로깅
      authLogger.logResponse(
        response.config.method?.toUpperCase() || "UNKNOWN",
        response.config.url || "",
        response.status,
        response.data,
      );

      return response;
    },
    async (error: AxiosError) => {
      // 상세 에러 로깅
      authLogger.logResponse(
        error.config?.method?.toUpperCase() || "UNKNOWN",
        error.config?.url || "",
        error.response?.status || 0,
        error.response?.data,
      );

      // 401 Unauthorized - 토큰 갱신 시도
      if (error.response?.status === 401) {
        const requestUrl = error.config?.url || "";
        const originalRequest = error.config;

        authLogger.logWarning(
          `401 Unauthorized: ${originalRequest?.method?.toUpperCase()} ${requestUrl}`,
          {
            isRedirecting,
            currentPath: window.location.pathname,
            hasToken: !!localStorage.getItem("token"),
            hasCsrfCookie: !!getCsrfToken(),
          },
        );

        console.warn(
          `[API] 401 Unauthorized: ${originalRequest?.method?.toUpperCase()} ${requestUrl}`,
        );

        // 로그인/회원가입/리프레시 엔드포인트는 401 자동 처리 제외
        const isAuthEndpoint =
          requestUrl.includes("/auth/login") ||
          requestUrl.includes("/auth/register") ||
          requestUrl.includes("/auth/refresh");

        // 이미 리다이렉트 중이거나 로그인 페이지이거나 인증 엔드포인트면 스킵
        if (
          isRedirecting ||
          window.location.pathname.includes("/login") ||
          isAuthEndpoint
        ) {
          authLogger.logWarning("Skipping auto-refresh", {
            reason: isRedirecting
              ? "already redirecting"
              : isAuthEndpoint
                ? "auth endpoint"
                : "login page",
          });
          throw new ApiClientError(error);
        }

        // 토큰 갱신 (중복 방지)
        if (!refreshPromise && originalRequest) {
          authLogger.logTokenEvent("Starting token refresh", {
            queueSize: failedQueue.length,
          });

          refreshPromise = (async () => {
            try {
              // 토큰 갱신
              authLogger.logTokenEvent("Calling /api/auth/refresh");
              const response = await apiClient.post<{
                access_token: string;
                expires_at: string;
                user: unknown;
              }>("/api/auth/refresh", {});

              // 새 토큰 및 사용자 정보 저장
              const { access_token, expires_at, user } = response.data;
              localStorage.setItem("token", access_token);
              localStorage.setItem("token_expires_at", expires_at);
              localStorage.setItem("user", JSON.stringify(user));

              authLogger.logTokenEvent("Token refreshed successfully", {
                expiresAt: expires_at,
                hasCsrfCookie: !!getCsrfToken(),
                userSaved: !!user,
              });

              // Refresh 성공 시 실패 카운터 리셋
              refreshFailureCount = 0;

              // 대기 중인 요청들 성공 처리
              failedQueue.forEach((promise) => promise.resolve());
              failedQueue = [];
            } catch (refreshError) {
              // Refresh 실패 카운터 증가
              refreshFailureCount++;

              authLogger.logError("Token refresh failed", {
                error: refreshError,
                queueSize: failedQueue.length,
                failureCount: refreshFailureCount,
                maxFailures: MAX_REFRESH_FAILURES,
              });

              // 대기 중인 요청들 실패 처리
              failedQueue.forEach((promise) => promise.reject(refreshError));
              failedQueue = [];

              // 연속 3회 실패 시에만 로그아웃
              if (refreshFailureCount >= MAX_REFRESH_FAILURES) {
                authLogger.logWarning(
                  `Max refresh failures (${MAX_REFRESH_FAILURES}) reached, logging out`,
                );

                // 리다이렉트 플래그 설정
                isRedirecting = true;

                // 로컬 스토리지 정리
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("token_expires_at");

                authLogger.logAuthState(
                  "Logging out due to max refresh failures",
                );

                // 알림 추가 (동적 import로 순환 참조 방지)
                import("../stores/notification").then(
                  ({ useNotificationStore }) => {
                    useNotificationStore.getState().addNotification({
                      id: "session-refresh-failed",
                      timestamp: new Date().toISOString(),
                      severity: "error",
                      category: "session",
                      title: "세션 만료",
                      message:
                        "세션을 갱신할 수 없어 로그아웃되었습니다. 다시 로그인해주세요.",
                      source: "api_client",
                      link: "/login",
                      dismissible: true,
                      persistent: false,
                      read: false,
                    });
                  },
                );

                // 로그인 페이지로 리다이렉트
                console.warn(
                  "[API] Max token refresh failures, redirecting to /login",
                );
                window.location.href = "/login";

                // 리다이렉트 플래그 및 카운터 리셋 (3초 후)
                setTimeout(() => {
                  isRedirecting = false;
                  refreshFailureCount = 0;
                }, 3000);
              } else {
                // 아직 재시도 가능
                authLogger.logWarning(
                  `Refresh failed (${refreshFailureCount}/${MAX_REFRESH_FAILURES}), will retry on next request`,
                );
              }

              throw refreshError;
            } finally {
              refreshPromise = null;
            }
          })();
        }

        // 갱신 완료 대기 후 원래 요청 재시도
        if (refreshPromise) {
          return refreshPromise
            .then(() => {
              if (originalRequest) {
                const token = localStorage.getItem("token");

                // 토큰 업데이트
                originalRequest.headers.set("Authorization", `Bearer ${token}`);

                authLogger.logTokenEvent(
                  "Retrying original request after refresh",
                  {
                    url: originalRequest.url,
                    hasToken: !!token,
                    tokenLength: token?.length,
                  },
                );

                return apiClient(originalRequest);
              }
              throw error;
            })
            .catch((retryError) => {
              authLogger.logError("Retry after refresh failed", retryError);
              throw new ApiClientError(error);
            });
        }

        throw new ApiClientError(error);
      }

      // 네트워크 에러
      if (!error.response) {
        const targetUrl = error.config?.baseURL || API_BASE_URL;
        throw new ApiClientError({
          ...error,
          response: {
            status: 0,
            data: {
              detail: {
                error: "network_error",
                message: `백엔드 서버(${targetUrl})에 연결할 수 없습니다. Docker 서비스가 실행 중인지 확인해주세요.`,
              },
            },
            statusText: "Network Error",
            headers: {},
            config: error.config!,
          },
        } as AxiosError);
      }

      // API 에러로 변환
      throw new ApiClientError(error);
    },
  );

  return client;
}

/**
 * Global API Client 인스턴스
 */
export const apiClient = createApiClient();

/**
 * 타입 안전한 GET 요청
 */
export async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

/**
 * 타입 안전한 POST 요청
 */
export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

/**
 * 타입 안전한 PUT 요청
 */
export async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.put<T>(url, data, config);
  return response.data;
}

/**
 * 타입 안전한 DELETE 요청
 */
export async function del<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}
