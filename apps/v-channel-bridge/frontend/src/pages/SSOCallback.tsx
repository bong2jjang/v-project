/**
 * SSO Callback Page
 *
 * SSO 인증 완료 후 백엔드에서 리다이렉트되는 페이지입니다.
 * URL 파라미터에서 토큰을 추출하여 인증 상태를 설정합니다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import * as authApi from "../lib/api/auth";
import { Loader2 } from "lucide-react";

export default function SSOCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const expiresAt = params.get("expires_at");
    const errorParam = params.get("error");

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        sso_failed: "SSO 인증에 실패했습니다. 다시 시도해주세요.",
        sso_no_email:
          "SSO 계정에 이메일 정보가 없습니다. 관리자에게 문의하세요.",
        account_disabled: "계정이 비활성화되었습니다. 관리자에게 문의하세요.",
      };
      setError(errorMessages[errorParam] || "로그인 중 오류가 발생했습니다.");
      setTimeout(() => navigate("/login", { replace: true }), 3000);
      return;
    }

    if (token && expiresAt) {
      handleSSOToken(token, expiresAt);
    } else {
      navigate("/login", { replace: true });
    }
  }, []);

  async function handleSSOToken(token: string, expiresAt: string) {
    try {
      // 1. 토큰 저장
      authApi.saveToken(token, expiresAt);

      // 2. 사용자 정보 조회 (토큰으로 /api/auth/me 호출)
      const user = await authApi.getCurrentUser();
      authApi.saveUser(user);

      // 3. Auth store 업데이트
      const expiresAtDate = new Date(expiresAt);
      useAuthStore.setState({
        user,
        token,
        tokenExpiresAt: expiresAtDate,
        isAuthenticated: true,
        isInitialized: true,
      });

      // 4. 토큰 자동 갱신 예약
      useAuthStore.getState().scheduleTokenRefresh(expiresAtDate);

      // 5. URL에서 토큰 파라미터 제거 후 대시보드로 이동
      window.history.replaceState({}, "", "/sso/callback");
      navigate("/", { replace: true });
    } catch {
      setError("로그인 처리 중 오류가 발생했습니다.");
      authApi.logout();
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-lg font-medium">{error}</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            잠시 후 로그인 페이지로 이동합니다...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          로그인 처리 중...
        </p>
      </div>
    </div>
  );
}
