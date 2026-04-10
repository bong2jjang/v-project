/**
 * HourlyDistributionChart 컴포넌트
 *
 * 시간대별 메시지 분포 차트 (Area Chart)
 * - React.memo로 최적화
 * - useMemo로 데이터 변환 캐싱
 */

import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface HourlyDistributionChartProps {
  data: Record<string, number>;
}

export const HourlyDistributionChart = memo(function HourlyDistributionChart({
  data,
}: HourlyDistributionChartProps) {
  // Convert data to array format (24 hours) - memoized
  const chartData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const hourStr = hour.toString().padStart(2, "0");
      return {
        hour: `${hourStr}:00`,
        messages: data[hourStr] || 0,
      };
    });
  }, [data]);

  const hasData = chartData.some((item) => item.messages > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-content-tertiary">
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <defs>
          <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-brand-600)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-brand-600)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-line-light" />
        <XAxis
          dataKey="hour"
          className="text-body-sm"
          tick={{ fill: "currentColor" }}
          stroke="currentColor"
          interval={2}
        />
        <YAxis
          className="text-body-sm"
          tick={{ fill: "currentColor" }}
          stroke="currentColor"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface-card)",
            border: "1px solid var(--color-line-heavy)",
            borderRadius: "var(--radius-card)",
          }}
          labelStyle={{ color: "var(--color-content-primary)" }}
          itemStyle={{ color: "var(--color-content-secondary)" }}
        />
        <Legend wrapperStyle={{ paddingTop: "20px" }} />
        <Area
          type="monotone"
          dataKey="messages"
          stroke="var(--color-brand-600)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorMessages)"
          name="메시지"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
