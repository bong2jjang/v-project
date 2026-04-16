/**
 * Authentication API
 *
 * 사용자 인증 관련 API (로그인, 회원가입, 토큰 관리)
 */

import { post, get, del } from "./client";
import type {
  LoginRequest,
  RegisterRequest,
  Token,
  User,
  DeviceInfo,
  PasswordResetVerifyResponse,
  MessageResponse,
  SSOProviderInfo,
} from "./types";

/**
 * SSO Provider 목록 조회
 */
export async function getSSOProviders(): Promise<SSOProviderInfo[]> {
  return get<SSOProviderInfo[]>("/api/auth/sso/providers");
}

/**
 * SSO 인증 URL 조회 (Vite proxy 경유)
 *
 * 백엔드에서 Microsoft OAuth authorize URL을 JSON으로 받아옵니다.
 * 프론트엔드가 dev tunnel을 직접 방문하지 않고 Microsoft로 바로 이동합니다.
 */
export async function getSSOAuthorizeUrl(
  providerName: string,
): Promise<string> {
  const result = await get<{ auth_url: string }>(
    `/api/auth/sso/${providerName}/authorize`,
  );
  return result.auth_url;
}

/**
 * 로그인
 */
export async function login(credentials: LoginRequest): Promise<Token> {
  return post<Token>("/api/auth/login", credentials);
}

/**
 * 회원가입
 */
export async function register(userData: RegisterRequest): Promise<User> {
  return post<User>("/api/auth/register", userData);
}

/**
 * 현재 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<User> {
  return get<User>("/api/auth/me");
}

/**
 * 로그아웃 (서버 및 클라이언트 토큰 제거)
 */
export async function logout(): Promise<void> {
  try {
    // 서버에 로그아웃 요청 (Refresh Token 무효화)
    await post("/api/auth/logout", {});
  } catch (error) {
    // 서버 에러가 있어도 클라이언트 토큰은 제거
    console.error("Logout error:", error);
  } finally {
    // 로컬 토큰 제거
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("token_expires_at");
  }
}

/**
 * 모든 디바이스에서 로그아웃
 */
export async function logoutAll(): Promise<void> {
  try {
    await post("/api/auth/logout-all", {});
  } finally {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("token_expires_at");
  }
}

/**
 * 토큰 갱신
 */
export async function refreshToken(): Promise<Token> {
  return post<Token>("/api/auth/refresh", {});
}

/**
 * 활성 디바이스 목록 조회
 */
export async function getActiveDevices(): Promise<DeviceInfo[]> {
  return get<DeviceInfo[]>("/api/auth/devices");
}

/**
 * 특정 디바이스 로그아웃
 */
export async function logoutDevice(deviceId: number): Promise<void> {
  await del(`/api/auth/devices/${deviceId}`);
}

/**
 * 토큰 저장
 */
export function saveToken(token: string, expiresAt?: string): void {
  localStorage.setItem("token", token);
  if (expiresAt) {
    localStorage.setItem("token_expires_at", expiresAt);
  }
}

/**
 * 토큰 만료 시간 가져오기
 */
export function getTokenExpiresAt(): Date | null {
  const expiresAt = localStorage.getItem("token_expires_at");
  if (!expiresAt) return null;

  try {
    return new Date(expiresAt);
  } catch {
    return null;
  }
}

/**
 * 토큰이 만료되었는지 확인
 */
export function isTokenExpired(): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return true;

  // 만료 1분 전부터 갱신 필요로 간주
  const expiryThreshold = new Date(expiresAt.getTime() - 60 * 1000);
  return new Date() >= expiryThreshold;
}

/**
 * 토큰 가져오기
 */
export function getToken(): string | null {
  return localStorage.getItem("token");
}

/**
 * 사용자 정보 저장
 */
export function saveUser(user: User): void {
  localStorage.setItem("user", JSON.stringify(user));
}

/**
 * 사용자 정보 가져오기
 */
export function getUser(): User | null {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

/**
 * 로그인 상태 확인
 */
export function isAuthenticated(): boolean {
  return getToken() !== null && getUser() !== null;
}

/**
 * 관리자 권한 확인
 */
export function isAdmin(): boolean {
  const user = getUser();
  return (
    user?.role === "system_admin" ||
    user?.role === "org_admin" ||
    user?.role === "admin"
  );
}

/**
 * 디바이스 핑거프린트 생성
 * FingerprintJS를 사용하여 정교한 브라우저 핑거프린팅 수행
 */
export async function generateDeviceFingerprint(): Promise<string> {
  try {
    // FingerprintJS 동적 import (지연 로딩)
    const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.warn("FingerprintJS failed, using fallback:", error);
    // Fallback: 간단한 핑거프린트 생성
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width,
      screen.height,
      screen.colorDepth,
    ];

    const str = components.join("|");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

/**
 * 디바이스 이름 생성
 */
export function generateDeviceName(): string {
  const ua = navigator.userAgent;

  // OS 감지
  let os = "Unknown OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS")) os = "iOS";

  // 브라우저 감지
  let browser = "Unknown Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";

  return `${os} - ${browser}`;
}

// ============================================================
// SSO Relay API (1회용 코드 기반 토큰 교환)
// ============================================================

/**
 * SSO Relay 코드 생성 (포탈에서 호출)
 *
 * 인증된 사용자에 대해 1회용 SSO 코드를 생성합니다.
 */
export async function createSsoRelay(): Promise<{ code: string }> {
  return post<{ code: string }>("/api/auth/sso-relay/create", {});
}

/**
 * SSO Relay 코드 교환 (앱에서 호출)
 *
 * 1회용 SSO 코드를 JWT + 사용자 정보로 교환합니다.
 */
export async function exchangeSsoCode(code: string): Promise<Token> {
  return post<Token>("/api/auth/sso-relay/exchange", { code });
}

// ============================================================
// 비밀번호 재설정 API
// ============================================================

/**
 * 비밀번호 재설정 요청
 *
 * 사용자 이메일로 재설정 링크를 발송합니다.
 */
export async function requestPasswordReset(
  email: string,
): Promise<MessageResponse> {
  return post<MessageResponse>("/api/auth/password-reset/request", { email });
}

/**
 * 비밀번호 재설정 토큰 검증
 *
 * 재설정 토큰의 유효성을 확인합니다.
 */
export async function verifyPasswordResetToken(
  token: string,
): Promise<PasswordResetVerifyResponse> {
  return get<PasswordResetVerifyResponse>(
    `/api/auth/password-reset/verify?token=${encodeURIComponent(token)}`,
  );
}

/**
 * 비밀번호 재설정 확인
 *
 * 토큰을 검증하고 새 비밀번호로 변경합니다.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<MessageResponse> {
  return post<MessageResponse>("/api/auth/password-reset/confirm", {
    token,
    new_password: newPassword,
  });
}
