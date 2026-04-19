/**
 * JsonField — 임의 배열/객체 값을 JSON 으로 직접 편집.
 *
 * 파싱 실패 시 내부 buffer 만 업데이트하고 상위 onChange 는 호출하지 않는다 —
 * 디바운스 저장이 잘못된 JSON 을 전송하지 않도록.
 */

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

interface JsonFieldProps {
  label: string;
  description?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  rows?: number;
  disabled?: boolean;
}

function stringify(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function JsonField({
  label,
  description,
  value,
  onChange,
  rows,
  disabled,
}: JsonFieldProps) {
  const [buffer, setBuffer] = useState(() => stringify(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = stringify(value);
    setBuffer((prev) => {
      try {
        const prevParsed = prev.trim() === "" ? undefined : JSON.parse(prev);
        if (JSON.stringify(prevParsed) === JSON.stringify(value)) return prev;
      } catch {
        // fall through — 상위 값이 정상이고 내부 buffer 가 깨졌다면 덮어쓴다.
      }
      return next;
    });
  }, [value]);

  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-content-secondary mb-1">
        {label}
      </span>
      <textarea
        value={buffer}
        onChange={(e) => {
          const text = e.target.value;
          setBuffer(text);
          const trimmed = text.trim();
          if (trimmed === "") {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(trimmed);
            setError(null);
            onChange(parsed);
          } catch (err) {
            setError(err instanceof Error ? err.message : "JSON 파싱 실패");
          }
        }}
        rows={rows ?? 8}
        disabled={disabled}
        className="w-full px-2 py-1.5 text-[11px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50 font-mono resize-y"
      />
      {error && (
        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-status-danger">
          <AlertCircle size={10} /> {error}
        </span>
      )}
      {!error && description && (
        <span className="block mt-0.5 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </label>
  );
}
