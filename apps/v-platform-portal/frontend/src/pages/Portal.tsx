/**
 * Portal — 앱 런처 + 시스템 상태 + 사이트맵
 *
 * 플랫폼 디자인 시스템 준수:
 * - ContentHeader + page-container + space-y-section-gap
 * - Skeleton 로딩 패턴
 * - Card/Badge/Table 컴포넌트 사용
 */

import { useEffect, useState, useCallback } from "react";
import {
  Rocket, Activity, CheckCircle, XCircle, Clock,
  ExternalLink, RefreshCw, Map, LayoutDashboard, Server,
  MessageSquare, Ticket, Settings, ChevronRight,
} from "lucide-react";
import { useAuthStore } from "../store/auth";
import { ContentHeader } from "../components/layout/ContentHeader";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton, SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import type { PortalApp, AppHealth, SitemapEntry } from "../lib/api/portal";
import { getApps, getAllHealth, getSitemap } from "../lib/api/portal";
import { createSsoRelay } from "@v-platform/core/api/auth";

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-6 h-6" />,
  Ticket: <Ticket className="w-6 h-6" />,
  LayoutDashboard: <LayoutDashboard className="w-6 h-6" />,
  Settings: <Settings className="w-6 h-6" />,
  Server: <Server className="w-6 h-6" />,
};

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy" || status === "online") {
    return <Badge variant="success">Online</Badge>;
  }
  if (status === "degraded") {
    return <Badge variant="warning">Degraded</Badge>;
  }
  return <Badge variant="danger">Offline</Badge>;
}

function AppCard({
  app,
  health,
  token,
}: {
  app: PortalApp;
  health?: AppHealth;
  token: string | null;
}) {
  const [launching, setLaunching] = useState(false);

  const handleClick = async () => {
    if (!token) {
      window.open(app.frontend_url, "_blank");
      return;
    }

    setLaunching(true);
    try {
      const { code } = await createSsoRelay();
      window.open(
        `${app.frontend_url}?sso_code=${encodeURIComponent(code)}`,
        "_blank",
      );
    } catch {
      // Relay 실패 시 토큰 없이 열기 (앱 자체 로그인으로 폴백)
      window.open(app.frontend_url, "_blank");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card className={`hover:border-brand-300 transition-all cursor-pointer group ${launching ? "opacity-70 pointer-events-none" : ""}`} onClick={handleClick}>
      <CardBody>
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 transition-colors">
            {ICON_MAP[app.icon] || <Server className="w-6 h-6" />}
          </div>
          <div className="flex items-center gap-2">
            {health && <StatusBadge status={health.status} />}
            <ExternalLink className="w-4 h-4 text-content-tertiary group-hover:text-brand-500 transition-colors" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-content-primary mb-1">
          {app.display_name}
        </h3>
        <p className="text-sm text-content-secondary">{app.description}</p>
        {health?.response_time_ms && (
          <div className="mt-3 flex items-center gap-1 text-xs text-content-tertiary">
            <Clock className="w-3 h-3" />
            {health.response_time_ms.toFixed(0)}ms
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-section-gap">
      {/* 앱 카드 스켈레톤 */}
      <div>
        <Skeleton className="h-6 w-20 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
      {/* 시스템 상태 스켈레톤 */}
      <div>
        <Skeleton className="h-6 w-32 mb-4" />
        <Card>
          <CardBody>
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-8 w-full" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function Portal() {
  const [apps, setApps] = useState<PortalApp[]>([]);
  const [health, setHealth] = useState<AppHealth[]>([]);
  const [sitemap, setSitemap] = useState<SitemapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { token } = useAuthStore();

  const loadData = useCallback(async () => {
    try {
      const [appsData, healthData, sitemapData] = await Promise.all([
        getApps(),
        getAllHealth(),
        getSitemap(),
      ]);
      setApps(appsData);
      setHealth(healthData);
      setSitemap(sitemapData);
    } catch (e) {
      console.error("Failed to load portal data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getHealth = (appId: string) =>
    health.find((h) => h.app_id === appId);

  const onlineCount = health.filter(
    (h) => h.status === "healthy" || h.status === "online"
  ).length;

  return (
    <>
      <ContentHeader
        title="앱 포탈"
        description={`${apps.length}개 앱 등록 · ${onlineCount}개 Online`}
        actions={
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        }
      />
      <div className="page-container">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-section-gap">
            {/* 앱 런처 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="w-5 h-5 text-content-secondary" />
                <h2 className="text-heading-md text-content-primary">앱</h2>
              </div>
              {apps.length === 0 ? (
                <EmptyState
                  title="등록된 앱이 없습니다"
                  description="PORTAL_APPS 환경변수를 설정하세요."
                />
              ) : (
                <div data-tour="app-launcher" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {apps.map((app) => (
                    <AppCard
                      key={app.app_id}
                      app={app}
                      health={getHealth(app.app_id)}
                      token={token}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 시스템 상태 */}
            <div data-tour="system-status">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-content-secondary" />
                <h2 className="text-heading-md text-content-primary">시스템 상태</h2>
              </div>
              <Card>
                <CardBody className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary uppercase">앱</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary uppercase">상태</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary uppercase">서비스</th>
                        <th className="px-4 py-3 text-left text-caption font-medium text-content-tertiary uppercase">응답</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {health.map((h) => (
                        <tr key={h.app_id}>
                          <td className="px-4 py-3 text-body-sm font-medium text-content-primary">
                            {apps.find((a) => a.app_id === h.app_id)?.display_name || h.app_id}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={h.status} /></td>
                          <td className="px-4 py-3 text-body-sm text-content-secondary">
                            {Object.entries(h.services || {}).map(([name, svc]) => (
                              <span key={name} className="inline-flex items-center gap-1 mr-2">
                                {(svc as any).status === "healthy"
                                  ? <CheckCircle className="w-3 h-3 text-status-success" />
                                  : <XCircle className="w-3 h-3 text-status-danger" />}
                                {name}
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-body-sm text-content-tertiary">
                            {h.response_time_ms ? `${h.response_time_ms.toFixed(0)}ms` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
            </div>

            {/* 사이트맵 */}
            <div data-tour="sitemap">
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-5 h-5 text-content-secondary" />
                <h2 className="text-heading-md text-content-primary">사이트맵</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sitemap.map((entry) => (
                  <Card key={entry.app_id}>
                    <CardHeader>
                      <CardTitle>{entry.display_name}</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <ul className="space-y-1">
                        {entry.menus.map((menu) => (
                          <li key={menu.permission_key} className="flex items-center gap-2 text-body-sm text-content-secondary py-1">
                            <ChevronRight className="w-3 h-3" />
                            {menu.label}
                          </li>
                        ))}
                        {entry.menus.length === 0 && (
                          <li className="text-body-sm text-content-tertiary">메뉴 정보 없음</li>
                        )}
                      </ul>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
