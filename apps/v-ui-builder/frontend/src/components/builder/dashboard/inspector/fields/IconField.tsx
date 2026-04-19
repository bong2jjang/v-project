/**
 * IconField — iconMap 에 등록된 Lucide 아이콘만 선택 가능.
 * AI 가 임의 아이콘 이름을 넣어도 resolveIcon 이 Blocks 로 fallback 하므로 안전.
 */

import { useMemo } from "react";

import { resolveIcon } from "../../iconMap";

const ICON_OPTIONS = [
  "Activity",
  "BarChart3",
  "BarChartHorizontal",
  "Bell",
  "Blocks",
  "Bookmark",
  "CircleDotDashed",
  "FileText",
  "Heading",
  "LayoutGrid",
  "LineChart",
  "MessageSquare",
  "Minus",
  "PieChart",
  "Table",
  "TrendingUp",
] as const;

interface IconFieldProps {
  label: string;
  description?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  nullable?: boolean;
  disabled?: boolean;
}

export function IconField({
  label,
  description,
  value,
  onChange,
  nullable,
  disabled,
}: IconFieldProps) {
  const Preview = useMemo(() => resolveIcon(value), [value]);
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <div className="flex items-stretch gap-1.5">
        <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-button border border-line bg-surface-input text-content-secondary shrink-0">
          <Preview size={13} />
        </span>
        <select
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              onChange(nullable ? null : "Blocks");
            } else {
              onChange(v);
            }
          }}
          disabled={disabled}
          className="flex-1 min-w-0 px-2 py-1.5 text-[12px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50"
        >
          {nullable && <option value="">(없음)</option>}
          {ICON_OPTIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {description && (
        <span className="block mt-0.5 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </label>
  );
}
