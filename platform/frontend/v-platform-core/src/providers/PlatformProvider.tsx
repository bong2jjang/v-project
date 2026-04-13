/**
 * PlatformProvider — v-platform 플랫폼 컨텍스트 래퍼
 *
 * Theme, Auth, Permission, Notification 등 플랫폼 기능을
 * 단일 Provider로 합성하여 앱에서 한 번만 감싸면 됩니다.
 *
 * Usage:
 *   <PlatformProvider config={{ apiBaseUrl: '...', appName: 'my-app' }}>
 *     <App />
 *   </PlatformProvider>
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarProvider } from "../hooks/useSidebar";
import { useSystemSettingsStore } from "../stores/systemSettings";
import { systemSettingsApi } from "../api/systemSettings";

// ── Config ──

export interface PlatformConfig {
  /** API base URL (e.g. "" for same-origin, "http://127.0.0.1:8000") */
  apiBaseUrl?: string;
  /** Application identifier */
  appName: string;
  /** Display title shown on TopBar, Login/Register pages (default: appName) */
  appTitle?: string;
  /** Short description shown on Login page (default: "") */
  appDescription?: string;
  /** Logo icon as React node (default: built-in V icon) */
  appLogo?: React.ReactNode;
  /** Feature toggles */
  features?: {
    sso?: boolean;
    organizations?: boolean;
    auditLog?: boolean;
    notifications?: boolean;
  };
  /** Theme defaults */
  theme?: {
    defaultTheme?: "light" | "dark" | "system";
  };
}

const defaultConfig: PlatformConfig = {
  apiBaseUrl: "",
  appName: "v-platform",
  features: {
    sso: true,
    organizations: true,
    auditLog: true,
    notifications: true,
  },
  theme: {
    defaultTheme: "system",
  },
};

// ── Context ──

const PlatformConfigContext = createContext<PlatformConfig>(defaultConfig);

export function usePlatformConfig(): PlatformConfig {
  return useContext(PlatformConfigContext);
}

// ── QueryClient ──

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 min
    },
  },
});

// ── Provider ──

interface PlatformProviderProps {
  config: PlatformConfig;
  children: ReactNode;
}

/**
 * document.title을 브랜딩 설정에 맞춰 반응형으로 동기화
 * 우선순위: 인증된 시스템 설정 > 공개 브랜딩 > config.appTitle > config.appName
 */
function DocumentTitleSync({ config }: { config: PlatformConfig }) {
  const settings = useSystemSettingsStore((s) => s.settings);
  const [publicTitle, setPublicTitle] = useState<string | null>(null);

  // 로그인 전용: 공개 브랜딩 조회 (인증 불필요)
  useEffect(() => {
    systemSettingsApi
      .getPublicBranding()
      .then((b) => setPublicTitle(b.app_title || null))
      .catch(() => setPublicTitle(null));
  }, []);

  useEffect(() => {
    document.title =
      settings?.app_title ||
      publicTitle ||
      config.appTitle ||
      config.appName;
  }, [settings?.app_title, publicTitle, config.appTitle, config.appName]);

  return null;
}

export function PlatformProvider({ config, children }: PlatformProviderProps) {
  const mergedConfig = { ...defaultConfig, ...config };

  return (
    <PlatformConfigContext.Provider value={mergedConfig}>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <DocumentTitleSync config={mergedConfig} />
          {children}
        </SidebarProvider>
      </QueryClientProvider>
    </PlatformConfigContext.Provider>
  );
}

export default PlatformProvider;
