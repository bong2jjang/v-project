/**
 * v-itsm KPI 대시보드 페이지.
 *
 * 티켓/SLA 통합 KPI를 요약 카드 + Recharts 시각화로 제공한다.
 * 60초 주기로 자동 새로고침.
 */

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ContentHeader } from "../components/Layout";
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Skeleton,
} from "../components/ui";
import { getKpiSummary } from "../lib/api/kpi";
import type { KpiSummary } from "../lib/api/itsmTypes";
import {
  LOOP_STAGE_LABELS,
  PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
} from "../lib/api/itsmTypes";

type CardTone = "default" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<CardTone, string> = {
  default: "text-content-primary",
  info: "text-info-600",
  success: "text-success-600",
  warning: "text-warning-600",
  danger: "text-danger-600",
};

const SLA_COLORS: Record<"active" | "warning" | "breached" | "satisfied", string> = {
  active: "#3b82f6",
  warning: "#f59e0b",
  breached: "#ef4444",
  satisfied: "#10b981",
};

const STAGE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#64748b",
];

const PRIORITY_COLORS: Record<"critical" | "high" | "normal" | "low", string> = {
  critical: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#64748b",
};

const SERVICE_COLORS = ["#0ea5e9", "#8b5cf6", "#22c55e", "#f59e0b"];

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: CardTone;
}

function SummaryCard({ label, value, hint, tone = "default" }: SummaryCardProps) {
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-content-tertiary">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${TONE_CLASSES[tone]}`}>
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-content-tertiary">{hint}</div>
        )}
      </CardBody>
    </Card>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

function formatRatio(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

function formatMinutes(m: number | null): string {
  if (m === null || Number.isNaN(m)) return "-";
  if (m < 60) return `${Math.round(m)}분`;
  const hours = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  if (hours < 24) return `${hours}시간 ${mins}분`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}일 ${remainHours}시간`;
}

export default function Kpi() {
  const [data, setData] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const kpi = await getKpiSummary();
        if (!cancelled) {
          setData(kpi);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "KPI 조회 실패");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    const id = setInterval(() => void fetchData(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const slaPieData = data
    ? [
        { name: "충족", value: data.sla_satisfied, key: "satisfied" as const },
        { name: "위반", value: data.sla_breached, key: "breached" as const },
        { name: "경고", value: data.sla_warning, key: "warning" as const },
        { name: "진행중", value: data.sla_active, key: "active" as const },
      ].filter((d) => d.value > 0)
    : [];

  const stageBarData = data
    ? data.by_stage.map((r) => ({
        stage: LOOP_STAGE_LABELS[r.stage] ?? r.stage,
        count: r.count,
      }))
    : [];

  const priorityPieData = data
    ? data.by_priority
        .map((r) => ({
          name: PRIORITY_LABELS[r.priority] ?? r.priority,
          value: r.count,
          key: r.priority,
        }))
        .filter((d) => d.value > 0)
    : [];

  const serviceBarData = data
    ? data.by_service_type.map((r) => ({
        service: SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
        count: r.count,
      }))
    : [];

  return (
    <>
      <ContentHeader
        title="KPI 대시보드"
        description="티켓/SLA 운영 지표를 실시간 요약합니다. 60초마다 자동 갱신됩니다."
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {loading && !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* 상단 KPI 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                label="총 티켓"
                value={formatNumber(data.total_tickets)}
                hint={`최근 30일 +${formatNumber(data.opened_last_30d)}`}
              />
              <SummaryCard
                label="진행중"
                value={formatNumber(data.open_tickets)}
                tone="info"
              />
              <SummaryCard
                label="종료"
                value={formatNumber(data.closed_tickets)}
                hint={`최근 30일 ${formatNumber(data.closed_last_30d)}`}
                tone="success"
              />
              <SummaryCard
                label="Re-open 비율"
                value={formatRatio(data.reopen_ratio)}
                tone={data.reopen_ratio > 0.1 ? "warning" : "default"}
              />
              <SummaryCard
                label="SLA 준수율"
                value={
                  data.sla_satisfied + data.sla_breached > 0
                    ? formatRatio(data.sla_met_ratio)
                    : "-"
                }
                hint={`충족 ${data.sla_satisfied} / 위반 ${data.sla_breached}`}
                tone={
                  data.sla_met_ratio >= 0.9
                    ? "success"
                    : data.sla_met_ratio >= 0.7
                      ? "warning"
                      : "danger"
                }
              />
              <SummaryCard
                label="SLA 경고"
                value={formatNumber(data.sla_warning)}
                tone="warning"
              />
              <SummaryCard
                label="SLA 위반"
                value={formatNumber(data.sla_breached)}
                tone="danger"
              />
              <SummaryCard
                label="MTTR"
                value={formatMinutes(data.mttr_minutes)}
                hint="평균 처리시간"
              />
            </div>

            {/* 차트 2단 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* SLA 분포 Donut */}
              <Card>
                <CardHeader>
                  <CardTitle>SLA 타이머 분포</CardTitle>
                </CardHeader>
                <CardBody>
                  {slaPieData.length === 0 ? (
                    <div className="py-12 text-center text-content-tertiary text-sm">
                      SLA 타이머가 없습니다.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={slaPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {slaPieData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={SLA_COLORS[entry.key]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardBody>
              </Card>

              {/* Stage Bar */}
              <Card>
                <CardHeader>
                  <CardTitle>단계별 티켓 수</CardTitle>
                </CardHeader>
                <CardBody>
                  {stageBarData.length === 0 ? (
                    <div className="py-12 text-center text-content-tertiary text-sm">
                      데이터가 없습니다.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={stageBarData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stage" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {stageBarData.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={STAGE_COLORS[idx % STAGE_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardBody>
              </Card>

              {/* Priority Pie */}
              <Card>
                <CardHeader>
                  <CardTitle>우선순위 분포</CardTitle>
                </CardHeader>
                <CardBody>
                  {priorityPieData.length === 0 ? (
                    <div className="py-12 text-center text-content-tertiary text-sm">
                      데이터가 없습니다.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={priorityPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label
                        >
                          {priorityPieData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={
                                PRIORITY_COLORS[
                                  entry.key as keyof typeof PRIORITY_COLORS
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardBody>
              </Card>

              {/* Service type Bar */}
              <Card>
                <CardHeader>
                  <CardTitle>서비스 구분별 티켓</CardTitle>
                </CardHeader>
                <CardBody>
                  {serviceBarData.length === 0 ? (
                    <div className="py-12 text-center text-content-tertiary text-sm">
                      데이터가 없습니다.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={serviceBarData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="service" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {serviceBarData.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={
                                SERVICE_COLORS[idx % SERVICE_COLORS.length]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
