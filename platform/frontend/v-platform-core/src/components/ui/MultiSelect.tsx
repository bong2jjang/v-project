/**
 * MultiSelect Component
 *
 * 다중 선택 가능한 드롭다운 컴포넌트
 */

import { useState, useRef, useEffect } from "react";

export interface MultiSelectProps {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** value → display label 매핑 (없으면 value 그대로 표시) */
  optionLabels?: Record<string, string>;
  /** 각 옵션 앞에 표시할 prefix renderer */
  renderOptionPrefix?: (option: string) => React.ReactNode;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "선택...",
  disabled = false,
  optionLabels,
  renderOptionPrefix,
}: MultiSelectProps) {
  const getLabel = (value: string) => optionLabels?.[value] ?? value;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setIsOpen(false);
  };

  const selectAll = () => {
    onChange([...options]);
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-body-sm font-medium text-content-primary">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Selected items display button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-line-heavy rounded-input bg-surface-card text-left focus-ring transition-colors ${
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:border-line-heaviest"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {selected.length === 0 ? (
                <span className="text-content-tertiary">{placeholder}</span>
              ) : selected.length <= 3 ? (
                selected.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-600/10 text-brand-600 rounded text-body-sm"
                  >
                    {getLabel(item)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOption(item);
                      }}
                      className="hover:text-brand-700"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-content-primary">
                  {selected.length}개 선택됨
                </span>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-content-tertiary transition-transform ${
                isOpen ? "transform rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-surface-card border border-line rounded-card shadow-lg max-h-60 overflow-auto">
            {/* Bulk actions */}
            <div className="sticky top-0 bg-surface-card border-b border-line px-3 py-2 flex items-center justify-between">
              <button
                type="button"
                onClick={selectAll}
                className="text-body-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                전체 선택
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-body-sm text-content-tertiary hover:text-content-primary"
                >
                  선택 해제
                </button>
              )}
            </div>

            {/* Options list */}
            <div className="py-1">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-body-sm text-content-tertiary">
                  옵션이 없습니다
                </div>
              ) : (
                options.map((option) => {
                  const isSelected = selected.includes(option);
                  const displayLabel = getLabel(option);
                  const hasCustomLabel = displayLabel !== option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleOption(option)}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-surface-raised transition-colors ${
                        isSelected ? "bg-brand-600/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center ${
                          isSelected
                            ? "bg-brand-600 border-brand-600"
                            : "border-line-heavy bg-surface-card"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Prefix (플랫폼 아이콘 등) */}
                      {renderOptionPrefix?.(option)}

                      {/* Option label */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-body-sm ${isSelected ? "text-brand-600 font-medium" : "text-content-primary"}`}
                        >
                          {displayLabel}
                        </span>
                        {hasCustomLabel && (
                          <span className="ml-1.5 text-body-xs text-content-tertiary font-mono">
                            {option}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
