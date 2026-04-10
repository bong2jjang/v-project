/**
 * ProvidersStatusCard Component
 *
 * Slack과 Teams Provider 연결 상태 표시
 */

import { useEffect } from "react";
import { Card, CardBody } from "../ui/Card";
import { useBridgeStore } from "../../store/bridge";
import { useAuthStore } from "../../store/auth";
import { isTokenExpired } from "../../lib/api/auth";
import {
  Activity,
  Loader2,
  MessageSquare,
  Power,
  Wifi,
  WifiOff,
} from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";

export const ProvidersStatusCard = () => {
  const {
    status,
    providers,
    routes,
    fetchStatus,
    fetchProviders,
    fetchRoutes,
    isLoading,
  } = useBridgeStore();

  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || isTokenExpired()) return;

    // 초기 데이터 로드
    const loadData = () => {
      fetchStatus();
      fetchProviders();
      fetchRoutes();
    };

    loadData();

    // 30초마다 갱신 - 토큰 만료 여부 실시간 확인
    const interval = setInterval(() => {
      if (useAuthStore.getState().isAuthenticated && !isTokenExpired()) {
        fetchStatus();
        fetchProviders();
      }
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // 인증 상태 변경 시 재시작

  const slackProvider = providers.find((p) => p.platform === "slack");
  const teamsProvider = providers.find((p) => p.platform === "teams");

  const isRunning = status?.is_running ?? false;
  const activeRoutes = routes?.length ?? 0;
  const activeTasks = status?.active_tasks ?? 0;

  return (
    <Card>
      <CardBody>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <Activity className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-heading-sm text-content-primary">
                  브리지 상태
                </h2>
                <InfoTooltip
                  title="브리지 상태"
                  description="Slack·Teams Provider의 연결 상태와 등록된 Route 수, 활성 Task 수를 실시간으로 표시합니다. 30초마다 자동 갱신됩니다."
                  hint="Provider가 '연결 끊김'이면 계정 설정 페이지에서 토큰/인증 정보를 확인하세요."
                  side="bottom"
                />
              </div>
              <p className="text-body-sm text-content-secondary">
                Provider 연결 및 Route 현황
              </p>
            </div>
          </div>

          {/* 브리지 실행 상태 */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              isRunning ? "bg-status-success-light" : "bg-status-warning-light"
            }`}
          >
            <Power
              className={`w-4 h-4 ${
                isRunning ? "text-status-success" : "text-status-warning"
              }`}
            />
            <span
              className={`text-body-sm font-medium ${
                isRunning ? "text-status-success" : "text-status-warning"
              }`}
            >
              {isRunning ? "실행 중" : "대기 중"}
            </span>
          </div>
        </div>

        {isLoading && !status ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-content-tertiary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Provider 상태 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Slack Provider */}
              <div className="p-4 rounded-lg border border-divider bg-surface-elevated">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded bg-[#611f69]/10">
                    <MessageSquare className="w-5 h-5 text-[#611f69]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-body-base font-medium text-content-primary">
                      Slack
                    </h3>
                    <p className="text-body-sm text-content-secondary">
                      {slackProvider?.connected ? "연결됨" : "연결 안 됨"}
                    </p>
                  </div>
                  {slackProvider?.connected ? (
                    <Wifi className="w-5 h-5 text-status-success" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-status-error" />
                  )}
                </div>
              </div>

              {/* Teams Provider */}
              <div className="p-4 rounded-lg border border-divider bg-surface-elevated">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded bg-[#5558AF]/10">
                    <MessageSquare className="w-5 h-5 text-[#5558AF]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-body-base font-medium text-content-primary">
                      Teams
                    </h3>
                    <p className="text-body-sm text-content-secondary">
                      {teamsProvider?.connected ? "연결됨" : "연결 안 됨"}
                    </p>
                  </div>
                  {teamsProvider?.connected ? (
                    <Wifi className="w-5 h-5 text-status-success" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-status-error" />
                  )}
                </div>
              </div>
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-4">
              {/* Active Routes */}
              <div className="text-center p-4 rounded-lg bg-surface-elevated border border-divider">
                <div className="text-heading-lg text-brand-primary font-bold mb-1">
                  {activeRoutes}
                </div>
                <div className="text-body-sm text-content-secondary">
                  Active Routes
                </div>
              </div>

              {/* Active Tasks */}
              <div className="text-center p-4 rounded-lg bg-surface-elevated border border-divider">
                <div className="text-heading-lg text-brand-primary font-bold mb-1">
                  {activeTasks}
                </div>
                <div className="text-body-sm text-content-secondary">
                  Active Tasks
                </div>
              </div>

              {/* Connected Providers */}
              <div className="text-center p-4 rounded-lg bg-surface-elevated border border-divider">
                <div className="text-heading-lg text-brand-primary font-bold mb-1">
                  {(slackProvider?.connected ? 1 : 0) +
                    (teamsProvider?.connected ? 1 : 0)}
                  /2
                </div>
                <div className="text-body-sm text-content-secondary">
                  Providers
                </div>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
