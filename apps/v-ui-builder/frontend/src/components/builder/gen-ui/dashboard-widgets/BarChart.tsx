/**
 * BarChart — bar_chart ui tool 의 component 렌더러.
 * Recharts 기반 세로 바 차트. categories[] × series[{name,data[]}] 로 stacked/grouped 지원.
 */

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BarChartSeries {
  name: string;
  data: number[];
}

export interface BarChartProps {
  title: string;
  categories: string[];
  series: BarChartSeries[];
  stacked: boolean;
  show_legend: boolean;
}

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function buildRows(
  categories: string[],
  series: BarChartSeries[],
): Array<Record<string, unknown>> {
  return categories.map((cat, idx) => {
    const row: Record<string, unknown> = { category: cat };
    for (const s of series) row[s.name] = s.data[idx] ?? 0;
    return row;
  });
}

export function BarChart({
  title,
  categories,
  series,
  stacked,
  show_legend,
}: BarChartProps) {
  const data = buildRows(categories, series);
  return (
    <div className="flex flex-col h-full min-h-0">
      {title && (
        <div className="text-[12.5px] font-semibold text-content-primary mb-1 shrink-0">
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart
            data={data}
            margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-line"
            />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            {show_legend && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {series.map((s, i) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                fill={COLORS[i % COLORS.length]}
                stackId={stacked ? "stack" : undefined}
                radius={stacked ? [0, 0, 0, 0] : [2, 2, 0, 0]}
              />
            ))}
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
