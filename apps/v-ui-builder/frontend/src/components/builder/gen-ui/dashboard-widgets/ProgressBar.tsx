/**
 * ProgressBar — progress_bar ui tool 의 component 렌더러.
 * 목표 대비 달성률을 색상 변형(blue/green/amber/rose) 바로 표시.
 */

export interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: "blue" | "green" | "amber" | "rose";
}

const COLOR_CLASS: Record<ProgressBarProps["color"], string> = {
  blue: "bg-brand-500",
  green: "bg-status-success",
  amber: "bg-status-warning",
  rose: "bg-status-danger",
};

export function ProgressBar({
  label,
  current,
  target,
  unit,
  color,
}: ProgressBarProps) {
  const safeTarget = target === 0 ? 1 : target;
  const ratio = Math.max(0, Math.min(1, current / safeTarget));
  const pct = (ratio * 100).toFixed(1);
  const barClass = COLOR_CLASS[color] ?? COLOR_CLASS.blue;

  return (
    <div className="flex flex-col h-full justify-center px-3 py-2 gap-1.5">
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-content-secondary truncate">{label}</span>
        <span className="text-content-primary font-medium shrink-0">
          {current}
          {unit} / {target}
          {unit}{" "}
          <span className="text-content-tertiary">({pct}%)</span>
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-surface-raised overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] ${barClass}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
