/**
 * BooleanField — on/off 토글 스위치.
 */

interface BooleanFieldProps {
  label: string;
  description?: string;
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BooleanField({
  label,
  description,
  value,
  onChange,
  disabled,
}: BooleanFieldProps) {
  const checked = Boolean(value);
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <span className="pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="w-3.5 h-3.5 rounded-sm border border-line text-brand-500 focus:ring-brand-500"
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-medium text-content-secondary">
          {label}
        </span>
        {description && (
          <span className="block text-[10px] text-content-tertiary">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
