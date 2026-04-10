/**
 * PlatformDirectionChart 컴포넌트
 *
 * 플랫폼 방향별 메시지 분포
 * - by_platform: Slack vs Teams (발신 기준)
 * - by_direction: Slack→Teams, Teams→Slack
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

interface PlatformDirectionChartProps {
  byPlatform?: Record<string, number>;
  byDirection?: Record<string, number>;
}

const PLATFORM_COLORS: Record<string, string> = {
  slack: "#4A154B",
  teams: "#5059C9",
};

const DIRECTION_COLORS: Record<string, string> = {
  "slack→teams": "#7C3AED",
  "teams→slack": "#2563EB",
};

const PLATFORM_LABELS: Record<string, string> = {
  slack: "Slack",
  teams: "Teams",
};

const DIRECTION_LABELS: Record<string, string> = {
  "slack→teams": "Slack → Teams",
  "teams→slack": "Teams → Slack",
};

export const PlatformDirectionChart = memo(function PlatformDirectionChart({
  byPlatform = {},
  byDirection = {},
}: PlatformDirectionChartProps) {
  const directionData = useMemo(() => {
    return Object.entries(byDirection)
      .filter(([, count]) => count > 0)
      .map(([direction, count]) => ({
        direction: DIRECTION_LABELS[direction] ?? direction,
        key: direction,
        count,
        color: DIRECTION_COLORS[direction] ?? "#6b7280",
      }))
      .sort((a, b) => b.count - a.count);
  }, [byDirection]);

  const platformData = useMemo(() => {
    return Object.entries(byPlatform)
      .filter(([, count]) => count > 0)
      .map(([platform, count]) => ({
        platform: PLATFORM_LABELS[platform] ?? platform,
        key: platform,
        count,
        color: PLATFORM_COLORS[platform] ?? "#6b7280",
      }))
      .sort((a, b) => b.count - a.count);
  }, [byPlatform]);

  const hasDirection = directionData.length > 0;
  const hasPlatform = platformData.length > 0;

  if (!hasDirection && !hasPlatform) {
    return (
      <div className="flex items-center justify-center h-64 text-content-tertiary">
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  // 방향 데이터가 있으면 방향 차트 우선 표시
  if (hasDirection) {
    return (
      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={directionData}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              className="stroke-line-light"
            />
            <XAxis
              type="number"
              tick={{ fill: "currentColor", fontSize: 11 }}
              stroke="currentColor"
            />
            <YAxis
              type="category"
              dataKey="direction"
              tick={{ fill: "currentColor", fontSize: 11 }}
              stroke="currentColor"
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface-card)",
                border: "1px solid var(--color-line-heavy)",
                borderRadius: "var(--radius-card)",
              }}
              labelStyle={{ color: "var(--color-content-primary)" }}
              itemStyle={{ color: "var(--color-content-secondary)" }}
              formatter={(value: number) => [
                `${value.toLocaleString()}건`,
                "메시지",
              ]}
            />
            <Bar dataKey="count" name="메시지" radius={[0, 4, 4, 0]}>
              {directionData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 수치 요약 */}
        <div className="grid grid-cols-2 gap-2">
          {directionData.map((item) => {
            const total = directionData.reduce((s, d) => s + d.count, 0);
            return (
              <div
                key={item.key}
                className="flex items-center gap-2 p-2 rounded-lg bg-surface-base"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-content-secondary truncate">
                    {item.direction}
                  </p>
                  <p className="text-sm font-semibold text-content-primary tabular-nums">
                    {item.count.toLocaleString()}
                    <span className="text-xs font-normal text-content-tertiary ml-1">
                      ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}
                      %)
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 방향 없고 플랫폼만 있을 때
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={platformData}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-line-light" />
        <XAxis
          dataKey="platform"
          tick={{ fill: "currentColor", fontSize: 12 }}
          stroke="currentColor"
        />
        <YAxis
          tick={{ fill: "currentColor", fontSize: 12 }}
          stroke="currentColor"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface-card)",
            border: "1px solid var(--color-line-heavy)",
            borderRadius: "var(--radius-card)",
          }}
          formatter={(value: number) => [
            `${value.toLocaleString()}건`,
            "메시지",
          ]}
        />
        <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
        <Bar dataKey="count" name="메시지" radius={[4, 4, 0, 0]}>
          {platformData.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
