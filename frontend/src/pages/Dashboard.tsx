/**
 * Dashboard 페이지
 *
 * Chat Bridge 실시간 모니터링 및 제어
 * - Provider 상태 (Slack, Teams)
 * - Route 현황 및 메시지 흐름
 * - 실시간 메트릭 및 로그
 *
 * 레이아웃:
 * ┌─────────────────────────────────────┐
 * │    ProvidersStatus (전체 너비)        │  ← 1행: Provider 연결 상태
 * └─────────────────────────────────────┘
 * ┌─────────────────────────────────────┐
 * │     RealtimeMetrics (전체 너비)       │  ← 2행: 실시간 메시지 처리량
 * └─────────────────────────────────────┘
 * ┌──────────────────┬──────────────────┐
 * │ MessageFlow      │ RecentActivity   │  ← 3행: 메시지 흐름 + 최근 활동
 * └──────────────────┴──────────────────┘
 * ┌─────────────────────────────────────┐
 * │         LogViewer (전체 너비)         │  ← 4행: 로그
 * └─────────────────────────────────────┘
 */

import { LogViewer } from "../components/dashboard";
import { RealtimeMetricsChart } from "../components/dashboard/RealtimeMetricsChart";
import { MessageFlowWidget } from "../components/dashboard/MessageFlowWidget";
import { ProvidersStatusCard } from "../components/dashboard/ProvidersStatusCard";
import { RecentActivityStream } from "../components/dashboard/RecentActivityStream";
import { useRealtimeStatus } from "../hooks/useRealtimeStatus";
import { ContentHeader } from "../components/Layout";

const Dashboard = () => {
  const { isConnected, hasConnectedOnce } = useRealtimeStatus({
    enabled: false, // TODO: Fix WebSocket token refresh issue
    channels: ["status", "logs"],
  });

  // WebSocket이 비활성화된 동안에는 HTTP 기반으로 서버 도달 가능 여부 판단
  const isServerReachable = true || isConnected || hasConnectedOnce;

  return (
    <>
      <ContentHeader
        title="대시보드"
        description="Chat Bridge 실시간 모니터링 - Slack과 Teams 간 메시지 연동 상태"
      />

      <div className="page-container space-y-section-gap">
        {/* Section 1: Provider 상태 (전체 너비) */}
        <div data-tour="provider-status">
          <ProvidersStatusCard />
        </div>

        {/* Section 2: 실시간 메시지 처리량 (전체 너비) */}
        <div data-tour="realtime-metrics">
          <RealtimeMetricsChart />
        </div>

        {/* Section 3: 메시지 흐름 / 최근 활동 */}
        <div
          data-tour="message-activity"
          className="grid grid-cols-1 lg:grid-cols-2 gap-section-gap"
        >
          <MessageFlowWidget />
          <RecentActivityStream />
        </div>

        {/* Section 4: 로그 뷰어 (전체 너비) */}
        <div data-tour="log-viewer">
          <LogViewer isServerReachable={isServerReachable} />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
