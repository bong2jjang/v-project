/**
 * Input 컴포넌트
 *
 * 디자인 시스템 토큰 기반 입력 필드
 */

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", ...props }, ref) => {
    const inputClasses = `
      block w-full px-3 py-2 border rounded-input shadow-sm text-body-base
      focus-ring
      disabled:bg-surface-raised disabled:cursor-not-allowed
      ${error ? "border-status-danger text-status-danger placeholder:text-status-danger/50" : "border-line-heavy"}
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
        <input ref={ref} className={inputClasses} {...props} />
        {error && <p className="text-body-sm text-status-danger">{error}</p>}
        {helperText && !error && (
          <p className="text-body-sm text-content-secondary">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
