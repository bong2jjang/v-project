import { useState, useEffect, useCallback, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePlatformConfig } from "../providers/PlatformProvider";
import { useAuthStore } from "../stores/auth";
import { useSystemSettingsStore } from "../stores/systemSettings";
import { ApiClientError } from "../api/client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { SSOButton } from "../components/auth/SSOButton";
import { getSSOProviders, getSSOAuthorizeUrl } from "../api/auth";
import type { SSOProviderInfo } from "../api/types";

export default function Login() {
  const navigate = useNavigate();
  const { appTitle, appDescription } = usePlatformConfig();
  const { login, isLoading } = useAuthStore();
  const { settings: systemSettings } = useSystemSettingsStore();

  // 개발 모드에서는 기본 계정 정보를 미리 채움
  const [email, setEmail] = useState(
    import.meta.env.DEV ? "admin@example.com" : "",
  );
  const [password, setPassword] = useState(
    import.meta.env.DEV ? "Admin123!" : "",
  );
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState<SSOProviderInfo[]>([]);
  const [ssoLoading, setSsoLoading] = useState(false);

  // SSO Provider 목록 조회 (404 시 조용히 무시 — 백엔드에 SSO 미설정)
  useEffect(() => {
    getSSOProviders()
      .then(setSsoProviders)
      .catch(() => {
        // SSO 엔드포인트가 없거나 비활성화된 경우 무시
        setSsoProviders([]);
      });
  }, []);

  // SSO 팝업 결과 수신 (MS OAuth와 동일한 postMessage 패턴)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type !== "sso-login-result") return;

      if (event.data.success && event.data.token) {
        try {
          const { saveToken, getCurrentUser, saveUser } =
            await import("../api/auth");
          saveToken(event.data.token, event.data.expires_at);
          const user = await getCurrentUser();
          saveUser(user);
          useAuthStore.setState({
            user,
            token: event.data.token,
            tokenExpiresAt: new Date(event.data.expires_at),
            isAuthenticated: true,
            isInitialized: true,
          });
          useAuthStore
            .getState()
            .scheduleTokenRefresh(new Date(event.data.expires_at));
          const startPage =
            user.start_page || systemSettings?.default_start_page || "/";
          navigate(startPage, { replace: true });
        } catch {
          setError("로그인 처리 중 오류가 발생했습니다.");
        }
      } else {
        setError(event.data.error || "SSO 로그인에 실패했습니다.");
      }
      setSsoLoading(false);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate, systemSettings?.default_start_page]);

  const handleSSOLogin = useCallback(
    async (providerName: string) => {
      if (ssoLoading) return;
      setSsoLoading(true);
      setError(null);
      try {
        const authUrl = await getSSOAuthorizeUrl(providerName);
        // MS OAuth와 동일한 팝업 방식 — dev tunnel 간섭 없음
        const w = 500;
        const h = 650;
        const left = window.screenX + (window.innerWidth - w) / 2;
        const top = window.screenY + (window.innerHeight - h) / 2;
        const popup = window.open(
          authUrl,
          "sso-login",
          `width=${w},height=${h},left=${left},top=${top}`,
        );
        if (!popup) {
          setError("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
          setSsoLoading(false);
        } else {
          // 팝업이 메시지 없이 닫힌 경우 (사용자가 X 클릭) ssoLoading 리셋
          const pollTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(pollTimer);
              setSsoLoading(false);
            }
          }, 500);
        }
      } catch {
        setError("SSO 로그인 준비 중 오류가 발생했습니다.");
        setSsoLoading(false);
      }
    },
    [ssoLoading],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 유효성 검사
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      await login({ email, password, remember_me: rememberMe });
      // 사용자 시작페이지로 이동 (미설정 시 대시보드)
      const startPage =
        useAuthStore.getState().user?.start_page ||
        systemSettings?.default_start_page ||
        "/";
      navigate(startPage);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.getUserMessage());
      } else {
        setError("로그인 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* 헤더 */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            {appTitle || "v-platform"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {appDescription || "로그인하여 계속하세요"}
          </p>
        </div>

        {/* 로그인 폼 */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                이메일
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                비밀번호
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

          {/* Remember Me 체크박스 및 비밀번호 찾기 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700 dark:focus:ring-offset-gray-900"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
              >
                로그인 상태 유지 (30일)
              </label>
            </div>

            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <Alert variant="error" className="mt-4">
              {error}
            </Alert>
          )}

          {/* 로그인 버튼 */}
          <div>
            <Button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </div>
        </form>

        {/* SSO 로그인 섹션 — form 밖에 배치하여 form submit 간섭 방지 */}
        {ssoProviders.length > 0 && (
          <div className="mt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                  또는
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {ssoProviders.map((provider) => (
                <SSOButton
                  key={provider.name}
                  provider={provider}
                  onClick={() => handleSSOLogin(provider.name)}
                  disabled={isLoading || ssoLoading}
                />
              ))}
            </div>
          </div>
        )}

        {/* 회원가입 링크 */}
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            계정이 없으신가요?{" "}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
