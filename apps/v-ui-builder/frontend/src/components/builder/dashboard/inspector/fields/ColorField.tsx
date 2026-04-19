/**
 * ColorField — 컬러 피커 + hex 텍스트.
 *
 * JSON Schema 로는 일반 string 이지만 필드명이 `color` 또는 format=color 일 때 선택된다.
 */

interface ColorFieldProps {
  label: string;
  description?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function sanitize(hex: string): string {
  const v = hex.trim();
  if (!v) return "#000000";
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
    if (v.length === 4) {
      return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    }
    return v;
  }
  return "#000000";
}

export function ColorField({
  label,
  description,
  value,
  onChange,
  disabled,
}: ColorFieldProps) {
  const current = value ?? "";
  const swatch = sanitize(current);
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <div className="flex items-stretch gap-1.5">
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-9 h-[30px] border border-line rounded-button cursor-pointer disabled:opacity-50"
        />
        <input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          disabled={disabled}
          className="flex-1 min-w-0 px-2 py-1.5 text-[12px] font-mono bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50"
        />
      </div>
      {description && (
        <span className="block mt-0.5 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </label>
  );
}
