/**
 * KpiCard — kpi_card ui tool 의 component 렌더러.
 * 큰 숫자 + 변화량(pct|abs) + 추세 화살표 + 선택적 sparkline.
 */

import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { resolveIcon } from "../../dashboard/iconMap";

export interface KpiCardProps {
  label: string;
  value: number;
  unit: string;
  delta: number | null;
  delta_type: "pct" | "abs";
  trend: "up" | "down" | "flat";
  icon: string | null;
  sparkline: number[];
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const stride = w / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * stride;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="text-brand-500">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  delta_type,
  trend,
  icon,
  sparkline,
}: KpiCardProps) {
  const Icon = resolveIcon(icon);
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendClass =
    trend === "up"
      ? "text-status-success"
      : trend === "down"
        ? "text-status-danger"
        : "text-content-tertiary";

  const deltaText =
    delta === null || delta === undefined
      ? null
      : delta_type === "pct"
        ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`
        : `${delta >= 0 ? "+" : ""}${formatValue(delta)}`;

  return (
    <div className="flex flex-col h-full px-3 py-2 gap-1">
      <div className="flex items-center gap-1.5 text-content-secondary">
        {icon && <Icon size={12} />}
        <span className="text-[11.5px] truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[22px] font-bold text-content-primary leading-none">
          {formatValue(value)}
        </span>
        {unit && (
          <span className="text-[12px] text-content-secondary">{unit}</span>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between">
        {deltaText !== null ? (
          <div className={`flex items-center gap-1 text-[11px] ${trendClass}`}>
            <TrendIcon size={12} />
            <span>{deltaText}</span>
          </div>
        ) : (
          <span />
        )}
        {sparkline.length > 1 && <Sparkline points={sparkline} />}
      </div>
    </div>
  );
}
