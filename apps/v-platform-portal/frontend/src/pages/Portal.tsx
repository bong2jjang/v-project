/**
 * Portal — 앱 런처 + 시스템 상태 + 사이트맵
 */

import { useEffect, useState } from "react";
import {
  Rocket, Activity, CheckCircle, XCircle, AlertCircle, Clock,
  ExternalLink, RefreshCw, Map, LayoutDashboard, Server,
  MessageSquare, Ticket, Settings, ChevronRight,
} from "lucide-react";
import type { PortalApp, AppHealth, SitemapEntry } from "../lib/api/portal";
import { getApps, getAllHealth, getSitemap } from "../lib/api/portal";

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-6 h-6" />,
  Ticket: <Ticket className="w-6 h-6" />,
  LayoutDashboard: <LayoutDashboard className="w-6 h-6" />,
  Settings: <Settings className="w-6 h-6" />,
  Server: <Server className="w-6 h-6" />,
};

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy" || status === "online") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="w-3 h-3" /> Online
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <AlertCircle className="w-3 h-3" /> Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="w-3 h-3" /> Offline
    </span>
  );
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
  const handleClick = () => {
    // Token Relay: 포탈 토큰을 URL 파라미터로 전달
    const url = token
      ? `${app.frontend_url}?auth_token=${encodeURIComponent(token)}`
      : app.frontend_url;
    window.open(url, "_blank");
  };

  return (
    <button
      onClick={handleClick}
      className="flex flex-col p-6 rounded-xl border border-line bg-surface-card hover:bg-surface-hover hover:border-brand-300 transition-all text-left group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
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
      <p className="text-sm text-content-secondary flex-1">{app.description}</p>
      {health?.response_time_ms && (
        <div className="mt-3 flex items-center gap-1 text-xs text-content-tertiary">
          <Clock className="w-3 h-3" />
          {health.response_time_ms.toFixed(0)}ms
        </div>
      )}
    </button>
  );
}

export default function Portal() {
  const [apps, setApps] = useState<PortalApp[]>([]);
  const [health, setHealth] = useState<AppHealth[]>([]);
  const [sitemap, setSitemap] = useState<SitemapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const token = localStorage.getItem("access_token");

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-600 rounded-lg">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  v-platform Portal
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {apps.length}개 앱 등록 · {onlineCount}개 Online
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              새로고침
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* App Launcher */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <LayoutDashboard className="w-5 h-5 text-content-secondary" />
                <h2 className="text-lg font-semibold text-content-primary">
                  앱
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {apps.map((app) => (
                  <AppCard
                    key={app.app_id}
                    app={app}
                    health={getHealth(app.app_id)}
                    token={token}
                  />
                ))}
                {apps.length === 0 && (
                  <div className="col-span-full text-center py-12 text-content-secondary">
                    등록된 앱이 없습니다. PORTAL_APPS 환경변수를 설정하세요.
                  </div>
                )}
              </div>
            </section>

            {/* System Status */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-content-secondary" />
                <h2 className="text-lg font-semibold text-content-primary">
                  시스템 상태
                </h2>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        앱
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        상태
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        서비스
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        응답 시간
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {health.map((h) => (
                      <tr key={h.app_id}>
                        <td className="px-4 py-3 font-medium text-content-primary">
                          {apps.find((a) => a.app_id === h.app_id)
                            ?.display_name || h.app_id}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={h.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-content-secondary">
                          {Object.entries(h.services || {}).map(
                            ([name, svc]) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 mr-2"
                              >
                                {(svc as any).status === "healthy" ? (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                )}
                                {name}
                              </span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-content-tertiary">
                          {h.response_time_ms
                            ? `${h.response_time_ms.toFixed(0)}ms`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Sitemap */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-5 h-5 text-content-secondary" />
                <h2 className="text-lg font-semibold text-content-primary">
                  사이트맵
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sitemap.map((entry) => (
                  <div
                    key={entry.app_id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <h3 className="font-semibold text-content-primary mb-3">
                      {entry.display_name}
                    </h3>
                    <ul className="space-y-1">
                      {entry.menus.map((menu) => (
                        <li
                          key={menu.permission_key}
                          className="flex items-center gap-2 text-sm text-content-secondary py-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          {menu.label}
                        </li>
                      ))}
                      {entry.menus.length === 0 && (
                        <li className="text-sm text-content-tertiary">
                          메뉴 정보 없음
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
