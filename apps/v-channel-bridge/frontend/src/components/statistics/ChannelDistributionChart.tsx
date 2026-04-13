/**
 * ChannelDistributionChart 컴포넌트
 *
 * 채널별 메시지 분포 차트 (Bar Chart)
 * - React.memo로 최적화
 * - useMemo로 데이터 변환 캐싱
 */

import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface ChannelDistributionChartProps {
  data: Record<string, number>;
}

const COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

export const ChannelDistributionChart = memo(function ChannelDistributionChart({
  data,
}: ChannelDistributionChartProps) {
  // Convert data to array format and sort by count (memoized)
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([channel, count]) => ({
        channel:
          channel.length > 15 ? channel.substring(0, 15) + "..." : channel,
        fullChannel: channel,
        messages: count,
      }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 10); // Top 10 channels
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
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-line-light" />
        <XAxis
          dataKey="channel"
          className="text-body-sm"
          tick={{ fill: "currentColor" }}
          stroke="currentColor"
          angle={-45}
          textAnchor="end"
          height={80}
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
          formatter={(value: number, _name: string, props: any) => [
            value,
            `${props.payload.fullChannel}: ${value}`,
          ]}
        />
        <Legend wrapperStyle={{ paddingTop: "20px" }} />
        <Bar dataKey="messages" name="메시지" radius={[8, 8, 0, 0]}>
          {chartData.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
