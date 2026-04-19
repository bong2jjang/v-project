/**
 * StatGrid — stat_grid ui tool 의 component 렌더러.
 * 2~4 열 격자에 미니 지표(label/value/delta/unit)를 배치.
 */

export interface StatGridItem {
  label: string;
  value: number | string;
  delta: number | null;
  unit: string;
}

export interface StatGridProps {
  items: StatGridItem[];
  columns: number;
}

const COL_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function StatGrid({ items, columns }: StatGridProps) {
  const colClass = COL_CLASS[columns] ?? "grid-cols-3";
  return (
    <div className={`grid gap-2 ${colClass} h-full`}>
      {items.map((item, idx) => {
        const hasDelta = item.delta !== null && item.delta !== undefined;
        const deltaClass =
          !hasDelta
            ? ""
            : (item.delta as number) > 0
              ? "text-status-success"
              : (item.delta as number) < 0
                ? "text-status-danger"
                : "text-content-tertiary";
        return (
          <div
            key={idx}
            className="flex flex-col px-2 py-1.5 rounded-input border border-line bg-surface-card min-w-0"
          >
            <span className="text-[11px] text-content-secondary truncate">
              {item.label}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[16px] font-semibold text-content-primary leading-none truncate">
                {item.value}
              </span>
              {item.unit && (
                <span className="text-[10.5px] text-content-tertiary">
                  {item.unit}
                </span>
              )}
            </div>
            {hasDelta && (
              <span className={`mt-0.5 text-[10.5px] ${deltaClass}`}>
                {(item.delta as number) >= 0 ? "+" : ""}
                {(item.delta as number).toFixed(1)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
