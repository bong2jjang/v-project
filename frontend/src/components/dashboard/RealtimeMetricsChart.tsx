/**
 * RealtimeMetricsChart Component
 *
 * 시간대별 메시지 처리량을 실시간으로 보여주는 라인 차트
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { useMessageStats, TimeRange } from "../../hooks/useMessageStats";
import { Loader2, TrendingUp, RefreshCw, ExternalLink } from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";

export const RealtimeMetricsChart = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("6h");
  const { stats, isLoading, error, refetch } = useMessageStats(timeRange);

  // 시간대별 데이터를 차트 형식으로 변환 + 이동평균 추세선
  const chartData = stats?.by_hour
    ? addTrendLine(buildChartData(stats.by_hour, timeRange))
    : [];

  return (
    <Card>
      <CardBody>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-heading-md font-semibold text-content-primary">
                  실시간 메시지 처리량
                </h3>
                <InfoTooltip
                  title="실시간 메시지 처리량"
                  description="선택한 시간 범위(1시간/6시간/24시간) 동안 시간대별로 처리된 메시지 수를 라인 차트로 보여줍니다. 점선은 이동평균 추세선입니다."
                  hint="차트 하단의 총 메시지·활성 Route·활성 채널은 해당 기간의 요약 수치입니다."
                  side="bottom"
                />
              </div>
              <p className="text-body-sm text-content-tertiary">
                최근{" "}
                {timeRange === "1h"
                  ? "1시간"
                  : timeRange === "6h"
                    ? "6시간"
                    : "24시간"}{" "}
                동안의 메시지 흐름
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 메시지 히스토리 바로가기 */}
            <button
              onClick={() => navigate("/messages")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-surface-secondary hover:bg-surface-raised
                text-body-sm font-medium text-content-secondary hover:text-brand-primary
                transition-all group"
              title="메시지 히스토리 페이지로 이동"
            >
              <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>히스토리</span>
            </button>

            {/* 시간 범위 선택 */}
            <div className="flex gap-1 bg-surface-secondary rounded-lg p-1">
              {(["1h", "6h", "24h"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-md text-body-sm font-medium transition-colors ${
                    timeRange === range
                      ? "bg-surface-primary text-content-primary shadow-sm"
                      : "text-content-tertiary hover:text-content-secondary"
                  }`}
                >
                  {range === "1h"
                    ? "1시간"
                    : range === "6h"
                      ? "6시간"
                      : "24시간"}
                </button>
              ))}
            </div>

            {/* 새로고침 버튼 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* 차트 */}
        <div className="h-80">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-body text-content-error mb-2">
                  데이터를 불러오는데 실패했습니다
                </p>
                <p className="text-body-sm text-content-tertiary mb-4">
                  {error}
                </p>
                <Button onClick={() => refetch()} variant="secondary" size="sm">
                  다시 시도
                </Button>
              </div>
            </div>
          ) : isLoading && !stats ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-content-tertiary" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-body text-content-tertiary">
                  표시할 데이터가 없습니다
                </p>
                <p className="text-body-sm text-content-tertiary mt-1">
                  메시지가 전송되면 여기에 표시됩니다
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  opacity={0.2}
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{
                    fill: "var(--color-content-tertiary)",
                    fontSize: 12,
                    fontFamily: "Pretendard Variable, sans-serif",
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                  dy={8}
                />
                <YAxis
                  tick={{
                    fill: "var(--color-content-tertiary)",
                    fontSize: 12,
                    fontFamily: "Pretendard Variable, sans-serif",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{
                    color: "var(--color-content-secondary)",
                    fontSize: "12px",
                    marginBottom: "4px",
                    fontFamily: "Pretendard Variable, sans-serif",
                  }}
                  itemStyle={{
                    color: "var(--color-brand-primary)",
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: "Pretendard Variable, sans-serif",
                  }}
                  cursor={{
                    stroke: "var(--color-brand-primary)",
                    strokeWidth: 1,
                    opacity: 0.1,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  stroke="var(--color-brand-primary)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "var(--color-brand-primary)",
                    stroke: "var(--color-brand-primary)",
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: "var(--color-brand-primary)",
                    stroke: "var(--color-brand-primary)",
                    strokeWidth: 2,
                  }}
                  name="메시지"
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="var(--color-content-tertiary)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={false}
                  name="추세"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 통계 요약 */}
        {stats && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-caption text-content-tertiary mb-1">
                  총 메시지
                </p>
                <p className="text-display-sm font-bold text-content-primary">
                  {stats.total_messages.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-caption text-content-tertiary mb-1">
                  활성 Route
                </p>
                <p className="text-display-sm font-bold text-content-primary">
                  {Object.keys(stats.by_gateway || {}).length}
                </p>
              </div>
              <div>
                <p className="text-caption text-content-tertiary mb-1">
                  활성 채널
                </p>
                <p className="text-display-sm font-bold text-content-primary">
                  {Object.keys(stats.by_channel || {}).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

/**
 * by_hour ("00"~"23") 데이터를 시간 범위에 맞게 차트 데이터로 변환
 *
 * - 현재 시각 기준으로 선택한 범위(1h/6h/24h)에 해당하는 시간대만 추출
 * - 시간순으로 정렬 (과거 → 현재)
 * - by_hour 키는 UTC 시간 기준이므로 로컬↔UTC 변환 필요
 */
function buildChartData(
  byHour: Record<string, number>,
  timeRange: TimeRange,
): { time: string; messages: number }[] {
  const now = new Date();
  const currentLocalHour = now.getHours();
  const tzOffsetHours = Math.round(now.getTimezoneOffset() / 60);

  const rangeHours = timeRange === "1h" ? 1 : timeRange === "6h" ? 6 : 24;

  const result: { time: string; messages: number }[] = [];

  for (let i = rangeHours - 1; i >= 0; i--) {
    const localHour = (currentLocalHour - i + 24) % 24;
    // by_hour 키는 UTC 기준이므로 로컬 시간을 UTC로 변환하여 조회
    const utcHour = (localHour + tzOffsetHours + 24) % 24;
    const utcKey = String(utcHour).padStart(2, "0");
    const count = byHour[utcKey] ?? 0;

    result.push({
      time: `${String(localHour).padStart(2, "0")}시`,
      messages: count,
    });
  }

  return result;
}

/**
 * 이동평균(Moving Average) 추세선을 추가
 *
 * 윈도우 크기 3의 단순 이동평균을 계산하여 각 데이터 포인트에 `trend` 필드를 추가합니다.
 * 데이터가 3개 미만이면 전체 평균을 사용합니다.
 */
function addTrendLine(
  data: { time: string; messages: number }[],
): { time: string; messages: number; trend: number }[] {
  if (data.length === 0) return [];

  const WINDOW = Math.min(3, data.length);

  return data.map((point, i) => {
    // 현재 인덱스를 중심으로 윈도우 범위 계산
    const start = Math.max(0, i - Math.floor(WINDOW / 2));
    const end = Math.min(data.length, start + WINDOW);
    const slice = data.slice(start, end);
    const avg = slice.reduce((sum, p) => sum + p.messages, 0) / slice.length;

    return { ...point, trend: Math.round(avg * 10) / 10 };
  });
}
