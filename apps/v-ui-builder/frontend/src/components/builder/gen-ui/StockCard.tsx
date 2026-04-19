/**
 * StockCard — stock ui tool 의 component 렌더러.
 * Recharts LineChart 로 시계열 price 를 표시하고, 하단 Range Pills(1D~1Y)로
 * 기간을 전환한다. `onAction("setRange", { symbol, range })` 를 호출하면
 * 서버의 stock.invoke_action 이 새 props 를 ui_patch 로 내려보낸다.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import { Card, CardBody } from "@v-platform/core/components/ui/Card";

export interface StockSeriesPoint {
  t: number;
  price: number;
}

export type StockRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";

const RANGE_OPTIONS: { value: StockRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
];

export interface StockCardProps {
  symbol: string;
  range: StockRange;
  current: number;
  change: number;
  change_pct: number;
  series: StockSeriesPoint[];
  onAction?: (action: string, args: Record<string, unknown>) => void;
  actionPending?: boolean;
}

export function StockCard({
  symbol,
  range,
  current,
  change,
  change_pct,
  series,
  onAction,
  actionPending,
}: StockCardProps) {
  const up = change >= 0;
  const accent = up ? "#16a34a" : "#dc2626";
  const Trend = up ? TrendingUp : TrendingDown;

  const handleRange = (next: StockRange) => {
    if (!onAction || actionPending || next === range) return;
    onAction("setRange", { symbol, range: next });
  };

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
        {onAction && (
          <div className="mt-2 flex items-center gap-1">
            {RANGE_OPTIONS.map((opt) => {
              const active = opt.value === range;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRange(opt.value)}
                  disabled={actionPending || active}
                  className={`rounded-button px-2 py-0.5 text-[10.5px] font-medium transition-colors disabled:cursor-not-allowed ${
                    active
                      ? "bg-brand-600 text-content-inverse"
                      : "bg-surface-page text-content-secondary hover:bg-surface-overlay hover:text-content-primary disabled:opacity-50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {actionPending && (
              <span className="ml-1 text-[10px] text-content-tertiary">
                불러오는 중…
              </span>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
