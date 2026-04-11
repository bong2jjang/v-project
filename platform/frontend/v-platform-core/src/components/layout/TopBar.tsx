/**
 * TopBar 컴포넌트
 *
 * 상단 바 (간소화됨)
 * - 햄버거 버튼 (모바일용 Sidebar 토글)
 * - Manual Button (시스템 설정에 따라 표시)
 * - System Status (종합 상태 + 상세 팝업, 서비스별 체크 진행 상태)
 * - Theme Toggle
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Activity, Database, Zap, Server, Wifi } from "lucide-react";
import { StatusDetailPopup, ServiceStatus } from "../common";
import { Badge } from "../ui/Badge";
import { usePlatformConfig } from "../../providers/PlatformProvider";
import { useRealtimeStatus } from "../../hooks/useRealtimeStatus";
import { useTheme } from "../../hooks/useTheme";
import { useSidebar } from "../../hooks/useSidebar";
import { useAuthStore } from "../../stores/auth";
import { usePermissionStore } from "../../stores/permission";
import { useSystemSettingsStore } from "../../stores/systemSettings";
import { resolveStartPage } from "../../lib/resolveStartPage";
import { apiClient } from "../../api/client";

// 헬스 응답 타입
interface HealthResponse {
  status: string;
  bridge_running: boolean;
  version: string;
  services: {
    database?: { status: string; response_time_ms?: number; error?: string };
    redis?: { status: string; response_time_ms?: number; error?: string };
  };
}

// 초기 서비스 목록 (status는 이후 체크로 채워짐)
const INITIAL_SERVICES: Omit<ServiceStatus, "status">[] = [
  {
    name: "WebSocket",
    description: "실시간 업데이트를 위한 서버 연결",
    icon: <Wifi className="w-5 h-5" />,
  },
  {
    name: "App Service",
    description: "앱 서비스",
    icon: <Server className="w-5 h-5" />,
  },
  {
    name: "Backend API",
    description: "FastAPI 백엔드 서버",
    icon: <Activity className="w-5 h-5" />,
  },
  {
    name: "Database",
    description: "PostgreSQL 데이터베이스 서버",
    icon: <Database className="w-5 h-5" />,
  },
  {
    name: "Redis Cache",
    description: "Redis 캐시 및 세션 스토어",
    icon: <Zap className="w-5 h-5" />,
  },
];

export function TopBar() {
  const navigate = useNavigate();
  const { appTitle } = usePlatformConfig();
  const { user } = useAuthStore();
  const { menus } = usePermissionStore();
  const { theme, setTheme } = useTheme();
  const { isMobileOpen, setMobileOpen, breakpoint } = useSidebar();
  const { isConnected, reconnectCount } = useRealtimeStatus({
    enabled: true,
    channels: ["status"],
  });
  const { settings } = useSystemSettingsStore();
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [services, setServices] = useState<ServiceStatus[]>(
    INITIAL_SERVICES.map((s) => ({
      ...s,
      status: "connecting" as const,
      isChecking: false,
    })),
  );

  const showHamburger = breakpoint === "tablet" || breakpoint === "mobile";

  // 단일 서비스 상태 업데이트 헬퍼
  const updateService = useCallback(
    (name: string, patch: Partial<ServiceStatus>) => {
      setServices((prev) =>
        prev.map((s) => (s.name === name ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  // 서비스별 개별 체크
  const checkAllServices = useCallback(
    async (signal?: AbortSignal) => {
      // 모든 서비스 checking 상태로
      setServices((prev) => prev.map((s) => ({ ...s, isChecking: true })));
      setIsRefreshing(true);

      // 1. WebSocket — 이미 알고 있음
      updateService("WebSocket", {
        isChecking: false,
        status: isConnected
          ? "running"
          : reconnectCount > 0
            ? "connecting"
            : "stopped",
      });

      // 2. Backend API + DB + Redis — 한 번의 /api/health 호출로 커버
      const t = performance.now();
      try {
        const res = await apiClient.get<HealthResponse>("/api/health", {
          signal,
        });
        const apiMs = Math.round(performance.now() - t);
        const data = res.data;

        if (signal?.aborted) return;

        updateService("Backend API", {
          isChecking: false,
          status: "running",
          responseTimeMs: apiMs,
          error: undefined,
        });
        updateService("Message Bridge", {
          isChecking: false,
          status: data.bridge_running ? "running" : "stopped",
          responseTimeMs: apiMs,
          error: undefined,
        });
        updateService("Database", {
          isChecking: false,
          status:
            data.services?.database?.status === "healthy" ? "running" : "error",
          responseTimeMs: data.services?.database?.response_time_ms,
          error: data.services?.database?.error ?? undefined,
        });
        updateService("Redis Cache", {
          isChecking: false,
          status:
            data.services?.redis?.status === "healthy" ? "running" : "error",
          responseTimeMs: data.services?.redis?.response_time_ms,
          error: data.services?.redis?.error ?? undefined,
        });
      } catch {
        if (signal?.aborted) return;
        const errMs = Math.round(performance.now() - t);
        for (const name of [
          "Backend API",
          "Message Bridge",
          "Database",
          "Redis Cache",
        ]) {
          updateService(name, {
            isChecking: false,
            status: "error",
            responseTimeMs: errMs,
            error: "연결 실패",
          });
        }
      }

      setLastUpdated(new Date());
      setIsRefreshing(false);
    },
    [isConnected, reconnectCount, updateService],
  );

  // WebSocket 연결 상태 실시간 반영
  useEffect(() => {
    updateService("WebSocket", {
      isChecking: false,
      status: isConnected
        ? "running"
        : reconnectCount > 0
          ? "connecting"
          : "stopped",
      error: undefined,
    });
  }, [isConnected, reconnectCount, updateService]);

  // 초기 + 30초 주기 자동 체크
  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    checkAllServices(ctrl.signal);

    const interval = setInterval(() => {
      const c = new AbortController();
      abortRef.current = c;
      checkAllServices(c.signal);
    }, 30000);

    return () => {
      ctrl.abort();
      clearInterval(interval);
    };
  }, [checkAllServices]);

  // 새로고침 버튼 핸들러
  const handleRefresh = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    checkAllServices(ctrl.signal);
  }, [checkAllServices]);

  // 팝업 열릴 때 즉시 체크
  const handleOpenPopup = useCallback(() => {
    setShowStatusPopup(true);
    handleRefresh();
  }, [handleRefresh]);

  // 종합 상태 계산
  const hasError = services.some(
    (s) => !s.isChecking && (s.status === "error" || s.status === "stopped"),
  );
  const hasWarning = services.some(
    (s) =>
      !s.isChecking && (s.status === "connecting" || s.status === "restarting"),
  );
  const overallStatus = isRefreshing
    ? "warning"
    : hasError
      ? "error"
      : hasWarning
        ? "warning"
        : "success";

  const handleManualClick = () => {
    if (settings?.manual_url) {
      try {
        const url = new URL(settings.manual_url);
        if (url.protocol === "http:" || url.protocol === "https:") {
          window.open(settings.manual_url, "_blank", "noopener,noreferrer");
        }
      } catch (e) {
        console.error("Invalid manual URL:", e);
      }
    }
  };

  return (
    <nav className="bg-surface-card/80 backdrop-blur-lg border-b border-line sticky top-0 z-nav shadow-nav">
      <div className="px-4">
        <div className="flex items-center justify-between h-12">
          {/* Left: Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-3">
            {showHamburger && (
              <button
                onClick={() => setMobileOpen(!isMobileOpen)}
                className="p-1.5 rounded-button text-content-tertiary hover:bg-surface-raised transition-colors"
              >
                {isMobileOpen ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            )}

            {/* Logo — 클릭 시 시작페이지로 이동 */}
            <button
              onClick={() =>
                navigate(
                  resolveStartPage(
                    user?.start_page || "",
                    settings?.default_start_page || "/",
                    menus,
                  ),
                )
              }
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
              title="시작 페이지로 이동"
            >
              <div className="flex items-center justify-center w-7 h-7 bg-brand-600 rounded-lg shadow-sm">
                <svg
                  className="w-4 h-4 text-content-inverse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </div>
              <span className="text-body-sm font-semibold text-content-primary">
                {appTitle || "v-platform"}
              </span>
            </button>
          </div>

          {/* Right: Manual + Theme + Status */}
          <div className="flex items-center gap-2">
            {/* 메뉴얼 버튼 */}
            {settings?.manual_enabled && (
              <button
                onClick={handleManualClick}
                title="메뉴얼 열기"
                className="p-1.5 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-raised transition-colors duration-normal"
              >
                <BookOpen className="w-5 h-5" />
              </button>
            )}

            {/* Theme Toggle */}
            <button
              data-tour="theme-toggle"
              onClick={() => {
                if (theme === "light") setTheme("dark");
                else if (theme === "dark") setTheme("system");
                else setTheme("light");
              }}
              title={
                theme === "light"
                  ? "다크 모드로 전환"
                  : theme === "dark"
                    ? "시스템 모드로 전환"
                    : "라이트 모드로 전환"
              }
              className="p-1.5 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-raised transition-colors duration-normal"
            >
              {theme === "light" ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : theme === "dark" ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>

            {/* 종합 시스템 상태 배지 */}
            <button
              onClick={handleOpenPopup}
              className="hover:opacity-80 transition-opacity"
              title="시스템 상태 상세 보기"
            >
              <Badge
                variant={
                  overallStatus === "success"
                    ? "success"
                    : overallStatus === "warning"
                      ? "warning"
                      : "danger"
                }
                dot
              >
                {isRefreshing
                  ? "..."
                  : overallStatus === "success"
                    ? "OK"
                    : overallStatus === "warning"
                      ? "Warn"
                      : "Error"}
              </Badge>
            </button>
          </div>
        </div>
      </div>

      {/* 상태 상세 팝업 */}
      <StatusDetailPopup
        isOpen={showStatusPopup}
        onClose={() => setShowStatusPopup(false)}
        services={services}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
      />
    </nav>
  );
}
