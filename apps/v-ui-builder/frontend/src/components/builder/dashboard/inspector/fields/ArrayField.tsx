/**
 * ArrayField — 원시 값(string/number) 배열 편집기.
 *
 * 각 아이템별 입력칸 + 추가/삭제 버튼. 배열 안에 객체가 있는 경우엔
 * JsonField 를 쓰도록 fieldResolver 가 분기한다.
 */

import { Minus, Plus } from "lucide-react";

interface ArrayFieldProps {
  label: string;
  description?: string;
  value: unknown[];
  itemType: "string" | "number";
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
}

export function ArrayField({
  label,
  description,
  value,
  itemType,
  onChange,
  disabled,
}: ArrayFieldProps) {
  const items = Array.isArray(value) ? value : [];

  const update = (idx: number, next: unknown) => {
    const copy = [...items];
    copy[idx] = next;
    onChange(copy);
  };

  const addItem = () => {
    onChange([...items, itemType === "number" ? 0 : ""]);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-content-secondary">
          {label}
        </span>
        <button
          type="button"
          onClick={addItem}
          disabled={disabled}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-content-secondary hover:text-brand-500 rounded-button disabled:opacity-50"
        >
          <Plus size={10} /> 추가
        </button>
      </div>
      <div className="space-y-1">
        {items.length === 0 && (
          <div className="text-[10px] text-content-tertiary px-2 py-1 border border-dashed border-line rounded-button">
            (빈 배열)
          </div>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="flex items-stretch gap-1">
            <input
              type={itemType === "number" ? "number" : "text"}
              value={item == null ? "" : String(item)}
              onChange={(e) => {
                const raw = e.target.value;
                if (itemType === "number") {
                  const n = raw === "" ? 0 : Number(raw);
                  if (Number.isFinite(n)) update(idx, n);
                } else {
                  update(idx, raw);
                }
              }}
              disabled={disabled}
              className="flex-1 min-w-0 px-2 py-1 text-[11.5px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              disabled={disabled}
              className="inline-flex items-center justify-center w-6 h-[26px] rounded-button text-content-tertiary hover:text-status-danger hover:bg-status-danger-light disabled:opacity-50"
              title="삭제"
            >
              <Minus size={11} />
            </button>
          </div>
        ))}
      </div>
      {description && (
        <span className="block mt-1 text-[10px] text-content-tertiary">
          {description}
        </span>
      )}
    </div>
  );
}
