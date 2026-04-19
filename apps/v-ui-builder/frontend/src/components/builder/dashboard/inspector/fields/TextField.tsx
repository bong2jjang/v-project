/**
 * TextField — 단일 행 텍스트 입력. JSON Schema string (enum/format 지정 없음) 기본 후보.
 */

interface TextFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  disabled,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
