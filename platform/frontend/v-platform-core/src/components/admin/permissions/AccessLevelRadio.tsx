/**
 * AccessLevelRadio — none / read / write 토글 버튼 그룹
 */

import type { AccessLevel } from "../../../api/types";

interface AccessLevelRadioProps {
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  disabled?: boolean;
  /** org_admin 위임 제한: 자신의 최대 권한 */
  maxLevel?: AccessLevel;
}

const LEVELS: {
  value: AccessLevel;
  label: string;
  activeClass: string;
}[] = [
  {
    value: "none",
    label: "없음",
    activeClass:
      "bg-neutral-200 text-content-primary dark:bg-neutral-700 dark:text-neutral-200",
  },
  {
    value: "read",
    label: "읽기",
    activeClass:
      "bg-status-info-light text-status-info dark:bg-blue-900/50 dark:text-blue-300",
  },
  {
    value: "write",
    label: "쓰기",
    activeClass:
      "bg-status-success-light text-status-success dark:bg-green-900/50 dark:text-green-300",
  },
];

const LEVEL_ORDER: AccessLevel[] = ["none", "read", "write"];

export function AccessLevelRadio({
  value,
  onChange,
  disabled = false,
  maxLevel,
}: AccessLevelRadioProps) {
  const maxIdx = maxLevel ? LEVEL_ORDER.indexOf(maxLevel) : 2;

  return (
    <div className="inline-flex rounded-md border border-line overflow-hidden select-none">
      {LEVELS.map((lvl, i) => {
        const idx = LEVEL_ORDER.indexOf(lvl.value);
        const exceedsMax = idx > maxIdx;
        const isDisabled = disabled || exceedsMax;
        const isActive = value === lvl.value;

        return (
          <button
            key={lvl.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(lvl.value)}
            className={`
              px-3 py-1 text-xs font-medium transition-all outline-none
              ${i > 0 ? "border-l border-line" : ""}
              ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              ${
                isActive
                  ? lvl.activeClass
                  : "bg-surface-card text-content-secondary hover:bg-surface-raised"
              }
            `}
          >
            {lvl.label}
          </button>
        );
      })}
    </div>
  );
}
