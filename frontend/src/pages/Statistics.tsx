/**
 * Statistics 페이지
 *
 * 메시지 전송 통계 및 분석 대시보드
 */

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Paperclip,
  RefreshCw,
  Calendar,
  Zap,
} from "lucide-react";
import {
  getMessageStats,
  type MessageStatsResponse,
} from "../lib/api/messages";
import { ContentHeader } from "../components/Layout";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Alert } from "../components/ui/Alert";
import { Toggle } from "../components/ui/Toggle";
import { InfoTooltip } from "../components/ui/InfoTooltip";
import {
  MessageTrendChart,
  ChannelDistributionChart,
  HourlyDistributionChart,
  DeliveryStatusChart,
  PlatformDirectionChart,
} from "../components/statistics";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAuthStore } from "../store/auth";
import type { WebSocketMessage } from "../lib/websocket/types";

// ─── 날짜 프리셋 ──────────────────────────────────────────────────────────────

type DatePreset = "today" | "7d" | "30d" | "all";

function getPresetRange(preset: DatePreset): {
  from?: string;
  to?: string;
} {
  const now = new Date();
  const toISO = (d: Date) => d.toISOString().split("T")[0];

  if (preset === "today") {
    return { from: toISO(now), to: toISO(now) };
  }
  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return { from: toISO(from), to: toISO(now) };
  }
  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    return { from: toISO(from), to: toISO(now) };
  }
  return {};
}

// ─── 요약 카드 ─────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  tooltip: { title: string; description: string; hint?: string };
}

function SummaryCard({
  title,
  value,
  sub,
  icon,
  iconBg,
  valueColor = "text-content-primary",
  tooltip,
}: SummaryCardProps) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-body-sm text-content-secondary">{title}</p>
              <InfoTooltip
                title={tooltip.title}
                description={tooltip.description}
                hint={tooltip.hint}
                side="bottom"
              />
            </div>
            <p className={`text-heading-lg font-bold ${valueColor}`}>{value}</p>
            {sub && (
              <p className="text-xs text-content-tertiary mt-0.5">{sub}</p>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

const Statistics = () => {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<MessageStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>(
    {},
  );
  const [activePreset, setActivePreset] = useState<DatePreset | null>("30d");
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  const fetchStats = useCallback(
    async (range?: { from?: string; to?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const r = range ?? dateRange;
        const result = await getMessageStats({
          from_date: r.from ? `${r.from}T00:00:00` : undefined,
          to_date: r.to ? `${r.to}T23:59:59` : undefined,
        });
        setStats(result);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "통계를 불러오는데 실패했습니다";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [dateRange],
  );

  // 날짜 프리셋 선택
  const handlePreset = (preset: DatePreset) => {
    setActivePreset(preset);
    const range = getPresetRange(preset);
    setDateRange(range);
    fetchStats(range);
  };

  // 직접 날짜 적용
  const handleApplyDateRange = () => {
    setActivePreset(null);
    fetchStats(dateRange);
  };

  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "message_created" && realtimeEnabled) {
        setTimeout(() => fetchStats(), 1000);
      }
    },
    [realtimeEnabled, fetchStats],
  );

  const wsUrl = token
    ? `ws://${window.location.hostname}:8000/api/ws?token=${encodeURIComponent(token)}`
    : "";

  const { isConnected, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    autoConnect: false,
  });

  useEffect(() => {
    if (isConnected && realtimeEnabled) {
      send({ type: "subscribe", data: { channels: ["messages"] } });
    }
  }, [isConnected, realtimeEnabled, send]);

  // 최초 로드: 최근 30일
  useEffect(() => {
    const range = getPresetRange("30d");
    setDateRange(range);
    fetchStats(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 파생 수치 계산 ──────────────────────────────────────────────────────────

  const totalMessages = stats?.total_messages ?? 0;

  const successRate =
    stats?.success_rate != null ? `${stats.success_rate.toFixed(1)}%` : "—";

  const successRateColor =
    stats?.success_rate == null
      ? "text-content-tertiary"
      : stats.success_rate >= 90
        ? "text-status-success"
        : stats.success_rate >= 80
          ? "text-amber-500"
          : "text-status-error";

  const failedCount =
    (stats?.by_status?.["failed"] ?? 0) + (stats?.by_status?.["retrying"] ?? 0);

  const failedColor =
    failedCount === 0 ? "text-status-success" : "text-status-error";

  const withAttachment = stats?.with_attachment ?? 0;
  const attachmentPct =
    totalMessages > 0
      ? `${((withAttachment / totalMessages) * 100).toFixed(1)}% 비율`
      : undefined;

  return (
    <>
      <ContentHeader
        title="통계 대시보드"
        description="메시지 전송 통계 및 분석"
        actions={
          <>
            <div className="flex items-center gap-2 px-3 py-2 bg-white text-brand-700 rounded-button dark:bg-brand-600 dark:text-content-inverse">
              <Zap className="w-4 h-4" />
              <span className="text-body-base font-medium">실시간</span>
              <Toggle
                checked={realtimeEnabled}
                onChange={setRealtimeEnabled}
                label="실시간 업데이트"
                size="sm"
              />
              <span className="text-body-base font-semibold min-w-[24px]">
                {realtimeEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => fetchStats()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-button hover:bg-white/90 dark:bg-brand-600 dark:text-content-inverse dark:hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              새로고침
            </button>
          </>
        }
      />

      <div className="page-container space-y-section-gap">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 날짜 필터 */}
        <Card data-tour="stats-date-filter">
          <CardBody>
            <div className="space-y-3">
              {/* 프리셋 버튼 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-content-tertiary flex-shrink-0" />
                {(
                  [
                    { key: "today" as DatePreset, label: "오늘" },
                    { key: "7d" as DatePreset, label: "최근 7일" },
                    { key: "30d" as DatePreset, label: "최근 30일" },
                    { key: "all" as DatePreset, label: "전체" },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePreset(key)}
                    className={`px-3 py-1.5 text-sm rounded-button transition-colors ${
                      activePreset === key
                        ? "bg-brand-500 text-white"
                        : "bg-surface-hover text-content-secondary hover:text-content-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 직접 입력 */}
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-body-sm font-medium text-content-secondary mb-1">
                    시작 날짜
                  </label>
                  <input
                    type="date"
                    value={dateRange.from || ""}
                    onChange={(e) => {
                      setActivePreset(null);
                      setDateRange((p) => ({ ...p, from: e.target.value }));
                    }}
                    className="px-3 py-2 border border-line-heavy rounded-input focus-ring text-sm"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-content-secondary mb-1">
                    종료 날짜
                  </label>
                  <input
                    type="date"
                    value={dateRange.to || ""}
                    onChange={(e) => {
                      setActivePreset(null);
                      setDateRange((p) => ({ ...p, to: e.target.value }));
                    }}
                    className="px-3 py-2 border border-line-heavy rounded-input focus-ring text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyDateRange}
                  disabled={isLoading}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-button transition-colors disabled:opacity-50"
                >
                  적용
                </button>
                {(dateRange.from || dateRange.to) && (
                  <button
                    type="button"
                    onClick={() => handlePreset("all")}
                    className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-hover rounded-button transition-colors"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 로딩 스켈레톤 */}
        {isLoading && !stats && (
          <div className="animate-pulse space-y-section-gap">
            {/* 요약 카드 4개 스켈레톤 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-section-gap">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-card border border-line rounded-lg p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-20 bg-surface-raised rounded" />
                    <div className="h-8 w-8 bg-surface-raised rounded-lg" />
                  </div>
                  <div className="h-7 w-24 bg-surface-raised rounded" />
                  <div className="h-3 w-32 bg-surface-raised rounded" />
                </div>
              ))}
            </div>
            {/* 차트 스켈레톤 */}
            <div className="bg-surface-card border border-line rounded-lg p-5 space-y-3">
              <div className="h-5 w-28 bg-surface-raised rounded" />
              <div className="h-64 bg-surface-raised rounded" />
            </div>
            {/* 하단 2열 차트 스켈레톤 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-section-gap">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-card border border-line rounded-lg p-5 space-y-3"
                >
                  <div className="h-5 w-24 bg-surface-raised rounded" />
                  <div className="h-48 bg-surface-raised rounded" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 데이터 없음 */}
        {!isLoading && !stats && (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-content-tertiary" />
            <h3 className="mt-2 text-heading-sm text-content-primary">
              통계 데이터가 없습니다
            </h3>
            <p className="mt-1 text-body-base text-content-secondary">
              메시지가 전송되면 통계가 표시됩니다.
            </p>
          </div>
        )}

        {stats && (
          <>
            {/* 요약 카드 4개 */}
            <div
              data-tour="stats-summary"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-section-gap"
            >
              <SummaryCard
                title="총 메시지"
                value={totalMessages.toLocaleString()}
                sub={`채널 ${Object.keys(stats.by_channel).length}개 활성`}
                icon={
                  <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                }
                iconBg="bg-brand-100 dark:bg-brand-900/30"
                tooltip={{
                  title: "총 메시지",
                  description:
                    "선택한 기간 동안 브리지를 통해 처리된 전체 메시지 수입니다. Slack·Teams 양방향으로 전달된 모든 메시지가 포함됩니다.",
                  hint: "날짜 필터를 변경하면 해당 기간의 수치가 반영됩니다.",
                }}
              />
              <SummaryCard
                title="전송 성공률"
                value={successRate}
                sub={
                  stats.by_status
                    ? `성공 ${(stats.by_status["sent"] ?? 0).toLocaleString()}건`
                    : undefined
                }
                icon={
                  <CheckCircle2
                    className={`w-5 h-5 ${
                      stats.success_rate != null && stats.success_rate >= 90
                        ? "text-status-success"
                        : "text-amber-500"
                    }`}
                  />
                }
                iconBg={
                  stats.success_rate != null && stats.success_rate >= 90
                    ? "bg-status-success-light"
                    : "bg-amber-100 dark:bg-amber-900/20"
                }
                valueColor={successRateColor}
                tooltip={{
                  title: "전송 성공률",
                  description:
                    "전송 시도된 메시지 중 실제로 수신 채널에 도달한 비율입니다. 성공(sent) ÷ (성공 + 실패) × 100 으로 계산됩니다.",
                  hint: "90% 이상 정상 · 80% 미만이면 네트워크 또는 봇 권한을 확인하세요.",
                }}
              />
              <SummaryCard
                title="실패 / 재시도"
                value={failedCount.toLocaleString()}
                sub={
                  stats.by_status
                    ? `실패 ${stats.by_status["failed"] ?? 0}건 · 재시도 ${stats.by_status["retrying"] ?? 0}건`
                    : undefined
                }
                icon={
                  <XCircle
                    className={`w-5 h-5 ${failedCount > 0 ? "text-status-error" : "text-status-success"}`}
                  />
                }
                iconBg={
                  failedCount > 0
                    ? "bg-status-error-light"
                    : "bg-status-success-light"
                }
                valueColor={failedColor}
                tooltip={{
                  title: "실패 / 재시도",
                  description:
                    "전송에 실패(failed)했거나 현재 자동 재시도 중(retrying)인 메시지 수의 합산입니다. 0건이 정상 상태입니다.",
                  hint: "값이 있으면 상세 로그에서 원인(봇 권한 부족, 채널 없음 등)을 확인하세요.",
                }}
              />
              <SummaryCard
                title="첨부파일 포함"
                value={withAttachment.toLocaleString()}
                sub={attachmentPct}
                icon={<Paperclip className="w-5 h-5 text-status-info" />}
                iconBg="bg-status-info-light"
                tooltip={{
                  title: "첨부파일 포함",
                  description:
                    "이미지, 파일 등 첨부파일이 하나 이상 포함된 메시지 수입니다. 괄호 안 비율은 전체 메시지 대비 첨부파일 포함 비율입니다.",
                  hint: "파일 전송 기능이 활성화된 Route에서만 집계됩니다.",
                }}
              />
            </div>

            {/* 메시지 추세 (full width) */}
            <Card data-tour="stats-charts">
              <CardHeader>
                <ChartTitle
                  title="메시지 추세"
                  description="날짜별 메시지 전송량 변화를 선형 그래프로 보여줍니다. 선택한 기간의 일별 추이를 한눈에 파악할 수 있습니다."
                  hint="급격한 증가는 특정 이벤트나 채널 활성화를, 감소는 브리지 중단 또는 사용 감소를 나타낼 수 있습니다."
                />
              </CardHeader>
              <CardBody>
                <MessageTrendChart data={stats.by_day} />
              </CardBody>
            </Card>

            {/* 전송 상태 + 플랫폼/방향 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-section-gap">
              <Card>
                <CardHeader>
                  <ChartTitle
                    title="전송 상태 분포"
                    description="메시지의 최종 전송 결과를 4가지 상태로 분류합니다. sent(전송 완료), failed(실패), retrying(자동 재시도 중), pending(대기 중)."
                    hint="sent 비율이 높을수록 건강한 상태입니다. failed·retrying이 있다면 봇 권한이나 채널 설정을 확인하세요."
                  />
                </CardHeader>
                <CardBody>
                  {stats.by_status &&
                  Object.keys(stats.by_status).length > 0 ? (
                    <DeliveryStatusChart data={stats.by_status} />
                  ) : (
                    <div className="flex items-center justify-center h-40 text-content-tertiary text-sm">
                      전송 상태 데이터가 없습니다
                    </div>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <ChartTitle
                    title="플랫폼 방향"
                    description="메시지가 어느 플랫폼에서 어느 플랫폼으로 흘렀는지 방향별 트래픽을 보여줍니다. (예: Slack → Teams, Teams → Slack)"
                    hint="두 방향의 비율이 비슷하면 양방향 브리지가 균형 있게 사용 중입니다. 한쪽만 크다면 단방향 위주 사용입니다."
                  />
                </CardHeader>
                <CardBody>
                  <PlatformDirectionChart
                    byPlatform={stats.by_platform}
                    byDirection={stats.by_direction}
                  />
                </CardBody>
              </Card>
            </div>

            {/* 시간대별 분포 (full width) */}
            <Card>
              <CardHeader>
                <ChartTitle
                  title="시간대별 분포"
                  description="0~23시 각 시간대별 메시지 발생 패턴을 면적 그래프로 보여줍니다. 서비스 피크 시간대를 파악할 수 있습니다."
                  hint="피크 시간대에 오류가 집중된다면 해당 시간대의 서버 부하나 네트워크 상태를 점검하세요."
                />
              </CardHeader>
              <CardBody>
                <HourlyDistributionChart data={stats.by_hour} />
              </CardBody>
            </Card>

            {/* 채널별 분포 + Route별 트래픽 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-section-gap">
              <Card>
                <CardHeader>
                  <ChartTitle
                    title="채널별 분포 (Top 10)"
                    description="메시지를 가장 많이 발신한 소스 채널 상위 10개를 막대 그래프로 보여줍니다."
                    hint="특정 채널에 트래픽이 집중된다면 해당 채널의 Route 설정이 올바른지 확인하세요."
                  />
                </CardHeader>
                <CardBody>
                  <ChannelDistributionChart data={stats.by_channel} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <ChartTitle
                    title="Route별 트래픽 (Top 5)"
                    description="등록된 Route(채널 간 연결 경로) 중 메시지 처리량이 많은 상위 5개를 가로 막대로 보여줍니다."
                    hint="Route는 설정 > 채널 연동에서 관리합니다. 사용량이 0인 Route는 연결 상태를 확인하세요."
                  />
                </CardHeader>
                <CardBody>
                  <GatewayTopChart data={stats.by_gateway} />
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ─── 차트 헤더 (제목 + InfoTooltip) ────────────────────────────────────────────

function ChartTitle({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-heading-sm font-semibold text-content-primary">
        {title}
      </span>
      <InfoTooltip
        title={title}
        description={description}
        hint={hint}
        side="bottom"
      />
    </div>
  );
}

// ─── 인라인 Route Top 차트 (단순 수평 바) ──────────────────────────────────────

function GatewayTopChart({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const max = items[0]?.[1] ?? 1;

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-content-tertiary text-sm">
        데이터가 없습니다
      </div>
    );
  }

  const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

  return (
    <div className="space-y-3 py-2">
      {items.map(([gateway, count], i) => (
        <div key={gateway} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span
              className="text-content-secondary truncate max-w-[60%]"
              title={gateway}
            >
              {gateway}
            </span>
            <span className="text-content-primary font-medium tabular-nums">
              {count.toLocaleString()}건
            </span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(count / max) * 100}%`,
                backgroundColor: COLORS[i],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Statistics;
