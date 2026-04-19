/**
 * StockCard — stock ui tool 의 component 렌더러.
 * Recharts LineChart 로 시계열 price 를 표시한다.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { Card, CardBody } from "@v-platform/core/components/ui/Card";

export interface StockSeriesPoint {
  t: number;
  price: number;
}

export interface StockCardProps {
  symbol: string;
  range: "1d" | "5d" | "1mo" | "3mo";
  current: number;
  change: number;
  change_pct: number;
  series: StockSeriesPoint[];
}

export function StockCard({
  symbol,
  range,
  current,
  change,
  change_pct,
  series,
}: StockCardProps) {
  const up = change >= 0;
  const accent = up ? "#16a34a" : "#dc2626";
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardBody className="py-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-heading-sm font-semibold text-content-primary">
                {symbol}
              </span>
              <span className="text-caption text-content-tertiary uppercase">
                {range}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-content-primary">
                {current.toFixed(2)}
              </span>
              <span
                className="inline-flex items-center gap-1 text-body-sm"
                style={{ color: accent }}
              >
                <Trend className="h-3.5 w-3.5" />
                {up ? "+" : ""}
                {change.toFixed(2)} ({change_pct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip
                formatter={(v: number) => v.toFixed(2)}
                labelFormatter={() => ""}
                contentStyle={{ fontSize: 11, padding: "2px 6px" }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={accent}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}
