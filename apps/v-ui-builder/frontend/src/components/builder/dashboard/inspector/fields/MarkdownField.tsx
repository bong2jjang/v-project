/**
 * MarkdownField — 여러 줄 텍스트(마크다운) 입력. textarea.
 *
 * markdown/body/message 처럼 본문 성 문자열에 사용.
 */

interface MarkdownFieldProps {
  label: string;
  description?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
}

export function MarkdownField({
  label,
  description,
  value,
  onChange,
  rows,
  disabled,
}: MarkdownFieldProps) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 4}
        disabled={disabled}
        className="w-full px-2 py-1.5 text-[12px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50 font-mono resize-y"
      />
      {description && (
        <span className="block mt-0.5 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </label>
  );
}
