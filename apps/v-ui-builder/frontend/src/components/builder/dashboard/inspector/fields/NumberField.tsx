/**
 * NumberField — 숫자 입력. ge/le 로 min/max 를 주입하면 브라우저 기본 검증이 동작한다.
 */

interface NumberFieldProps {
  label: string;
  description?: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  disabled?: boolean;
}

export function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  nullable,
  disabled,
}: NumberFieldProps) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <input
        type="number"
        value={value == null ? "" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            onChange(nullable ? null : 0);
            return;
          }
          const n = Number(v);
          if (Number.isFinite(n)) onChange(n);
        }}
        min={min}
        max={max}
        step={step ?? "any"}
        disabled={disabled}
        className="w-full px-2 py-1.5 text-[12px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50"
      />
      {description && (
        <span className="block mt-0.5 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </label>
  );
}
