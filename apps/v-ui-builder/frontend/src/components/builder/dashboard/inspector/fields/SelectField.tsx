/**
 * SelectField — JSON Schema enum 을 드롭다운으로.
 */

interface SelectFieldProps {
  label: string;
  description?: string;
  value: string | number | null | undefined;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string | number) => void;
  disabled?: boolean;
}

export function SelectField({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <select
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => String(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
        disabled={disabled}
        className="w-full px-2 py-1.5 text-[12px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      {description && (
        <span className="block mt-0.5 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </label>
  );
}
