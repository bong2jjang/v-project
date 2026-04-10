/**
 * DeliveryStatusChart 컴포넌트
 *
 * 전송 상태별 분포 (Pie Chart)
 * sent / failed / retrying / pending
 */

import { memo, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DeliveryStatusChartProps {
  data: Record<string, number>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  sent: { label: "전송 완료", color: "#10b981" },
  partial_success: { label: "부분 성공", color: "#f59e0b" },
  failed: { label: "전송 실패", color: "#ef4444" },
  retrying: { label: "재시도 중", color: "#f59e0b" },
  pending: { label: "대기 중", color: "#6b7280" },
};

const DEFAULT_COLOR = "#a3a3a3";

export const DeliveryStatusChart = memo(function DeliveryStatusChart({
  data,
}: DeliveryStatusChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        name: STATUS_CONFIG[status]?.label ?? status,
        value: count,
        color: STATUS_CONFIG[status]?.color ?? DEFAULT_COLOR,
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const total = useMemo(
    () => chartData.reduce((sum, d) => sum + d.value, 0),
    [chartData],
  );

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-content-tertiary">
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-card)",
              border: "1px solid var(--color-line-heavy)",
              borderRadius: "var(--radius-card)",
            }}
            labelStyle={{ color: "var(--color-content-primary)" }}
            formatter={(value: number, name: string) => [
              `${value.toLocaleString()}건 (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              name,
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 상태별 수치 테이블 */}
      <div className="space-y-2">
        {chartData.map((item) => (
          <div key={item.status} className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-content-secondary flex-1">
              {item.name}
            </span>
            <span className="text-xs font-medium text-content-primary tabular-nums">
              {item.value.toLocaleString()}
            </span>
            <span className="text-xs text-content-tertiary tabular-nums w-12 text-right">
              {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
