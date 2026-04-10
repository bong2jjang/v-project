/**
 * Select 컴포넌트
 *
 * 디자인 시스템 토큰 기반 선택 필드
 */

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options = [],
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const selectClasses = `
      block w-full px-3 py-2 border rounded-input shadow-sm text-body-base
      focus-ring
      disabled:bg-surface-raised disabled:cursor-not-allowed
      ${error ? "border-status-danger text-status-danger" : "border-line-heavy"}
      ${className}
    `;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-heading-sm text-content-primary">
            {label}
            {props.required && (
              <span className="text-status-danger ml-1">*</span>
            )}
          </label>
        )}
        <select ref={ref} className={selectClasses} {...props}>
          {options.length > 0
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-body-sm text-status-danger">{error}</p>}
        {helperText && !error && (
          <p className="text-body-sm text-content-secondary">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
