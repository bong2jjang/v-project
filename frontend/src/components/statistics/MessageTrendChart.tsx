/**
 * MessageTrendChart 컴포넌트
 *
 * 일별 메시지 추세 차트 (Line Chart)
 * - React.memo로 최적화
 * - useMemo로 데이터 변환 캐싱
 */

import { memo, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MessageTrendChartProps {
  data: Record<string, number>;
}

export const MessageTrendChart = memo(function MessageTrendChart({
  data,
}: MessageTrendChartProps) {
  // Convert data to array format for Recharts (memoized)
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
        fullDate: date,
        messages: count,
      }))
      .sort(
        (a, b) =>
          new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime(),
      );
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-content-tertiary">
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-line-light" />
        <XAxis
          dataKey="date"
          className="text-body-sm"
          tick={{ fill: "currentColor" }}
          stroke="currentColor"
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
        <Legend
          wrapperStyle={{
            paddingTop: "20px",
          }}
        />
        <Line
          type="monotone"
          dataKey="messages"
          stroke="var(--color-brand-600)"
          strokeWidth={2}
          dot={{ fill: "var(--color-brand-600)", r: 4 }}
          activeDot={{ r: 6 }}
          name="메시지"
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
