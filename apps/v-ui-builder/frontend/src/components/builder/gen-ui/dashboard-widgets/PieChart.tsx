/**
 * PieChart — pie_chart ui tool 의 component 렌더러.
 * Recharts Pie 로 구성비 표시. show_legend / show_labels 옵션.
 */

import {
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface PieItem {
  label: string;
  value: number;
  color: string | null;
}

export interface PieChartProps {
  title: string;
  items: PieItem[];
  show_legend: boolean;
  show_labels: boolean;
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

export function PieChart({
  title,
  items,
  show_legend,
  show_labels,
}: PieChartProps) {
  const data = items.map((it, i) => ({
    name: it.label,
    value: it.value,
    color: it.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  return (
    <div className="flex flex-col h-full min-h-0">
      {title && (
        <div className="text-[12.5px] font-semibold text-content-primary mb-1 shrink-0">
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="70%"
              label={
                show_labels
                  ? ({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  : false
              }
              labelLine={show_labels}
              style={{ fontSize: 10 }}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11 }} />
            {show_legend && <Legend wrapperStyle={{ fontSize: 10 }} />}
          </RPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
