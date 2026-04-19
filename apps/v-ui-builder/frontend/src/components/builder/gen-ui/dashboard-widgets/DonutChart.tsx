/**
 * DonutChart — donut_chart ui tool 의 component 렌더러.
 * Recharts Pie + innerRadius 로 도넛. 중앙에 center_label/center_value(자동합) 오버레이.
 */

import {
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface DonutItem {
  label: string;
  value: number;
  color: string | null;
}

export interface DonutChartProps {
  title: string;
  items: DonutItem[];
  center_label: string;
  center_value: string | null;
  show_legend: boolean;
}

const DEFAULT_COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#84cc16",
];

function formatTotal(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function DonutChart({
  title,
  items,
  center_label,
  center_value,
  show_legend,
}: DonutChartProps) {
  const data = items.map((it, i) => ({
    name: it.label,
    value: it.value,
    color: it.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));
  const total = items.reduce((acc, it) => acc + (it.value || 0), 0);
  const centerText = center_value ?? formatTotal(total);

  return (
    <div className="flex flex-col h-full min-h-0">
      {title && (
        <div className="text-[12.5px] font-semibold text-content-primary mb-1 shrink-0">
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={1}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11 }} />
            {show_legend && <Legend wrapperStyle={{ fontSize: 10 }} />}
          </RPieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10.5px] text-content-tertiary">
            {center_label}
          </span>
          <span className="text-[16px] font-semibold text-content-primary">
            {centerText}
          </span>
        </div>
      </div>
    </div>
  );
}
