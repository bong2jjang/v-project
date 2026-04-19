/**
 * HorizontalBarChart — horizontal_bar_chart ui tool 의 component 렌더러.
 * 상위 N 항목을 가로 막대로 보여주는 랭킹 차트. sort + top_n 클라이언트 처리.
 */

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface HbarItem {
  label: string;
  value: number;
}

export interface HorizontalBarChartProps {
  title: string;
  items: HbarItem[];
  sort: "desc" | "asc" | "none";
  top_n: number | null;
  color: string;
}

function processItems(
  items: HbarItem[],
  sort: HorizontalBarChartProps["sort"],
  top_n: number | null,
): HbarItem[] {
  let arr = [...items];
  if (sort === "desc") arr.sort((a, b) => b.value - a.value);
  else if (sort === "asc") arr.sort((a, b) => a.value - b.value);
  if (top_n && top_n > 0) arr = arr.slice(0, top_n);
  return arr;
}

export function HorizontalBarChart({
  title,
  items,
  sort,
  top_n,
  color,
}: HorizontalBarChartProps) {
  const data = processItems(items, sort, top_n);
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
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-line"
              horizontal={false}
            />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 10 }}
              width={60}
            />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="value" fill={color} radius={[0, 2, 2, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
