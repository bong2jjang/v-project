/**
 * LineChart — line_chart ui tool 의 component 렌더러.
 * Recharts 기반. series[].data[{x,y}] 를 카테고리 축으로 merge 하여 다중 라인.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface LineChartSeries {
  name: string;
  data: Array<{ x: string | number; y: number }>;
}

export interface LineChartProps {
  title: string;
  series: LineChartSeries[];
  x_label: string;
  y_label: string;
  show_legend: boolean;
  smooth: boolean;
}

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function mergeSeries(series: LineChartSeries[]): Array<Record<string, unknown>> {
  const xs = new Map<string | number, Record<string, unknown>>();
  for (const s of series) {
    for (const pt of s.data) {
      const row = xs.get(pt.x) ?? { x: pt.x };
      row[s.name] = pt.y;
      xs.set(pt.x, row);
    }
  }
  return Array.from(xs.values());
}

export function LineChart({
  title,
  series,
  x_label,
  y_label,
  show_legend,
  smooth,
}: LineChartProps) {
  const data = mergeSeries(series);
  return (
    <div className="flex flex-col h-full min-h-0">
      {title && (
        <div className="text-[12.5px] font-semibold text-content-primary mb-1 shrink-0">
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart
            data={data}
            margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-line"
            />
            <XAxis
              dataKey="x"
              tick={{ fontSize: 10 }}
              label={
                x_label
                  ? { value: x_label, position: "insideBottom", fontSize: 10 }
                  : undefined
              }
            />
            <YAxis
              tick={{ fontSize: 10 }}
              label={
                y_label
                  ? { value: y_label, angle: -90, position: "insideLeft", fontSize: 10 }
                  : undefined
              }
            />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            {show_legend && <Legend wrapperStyle={{ fontSize: 10 }} />}
            {series.map((s, i) => (
              <Line
                key={s.name}
                type={smooth ? "monotone" : "linear"}
                dataKey={s.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.8}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            ))}
          </RLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
