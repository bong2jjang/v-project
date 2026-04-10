/**
 * Toggle 컴포넌트
 *
 * ON/OFF 스위치 토글
 */

import { forwardRef } from "react";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    { checked, onChange, disabled = false, label, size = "md", className = "" },
    ref,
  ) => {
    const sizeClasses = {
      sm: {
        container: "w-9 h-5",
        thumb: "w-3.5 h-3.5",
        translate: "translate-x-4",
      },
      md: {
        container: "w-11 h-6",
        thumb: "w-4 h-4",
        translate: "translate-x-5",
      },
      lg: {
        container: "w-14 h-7",
        thumb: "w-5 h-5",
        translate: "translate-x-7",
      },
    };

    const { container, thumb, translate } = sizeClasses[size];

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked
            ? "bg-brand-600 dark:bg-brand-500"
            : "bg-neutral-200 dark:bg-neutral-700"
        } ${container} ${className}`}
      >
        <span className="sr-only">{label || "Toggle"}</span>
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${thumb} ${
            checked ? translate : "translate-x-1"
          }`}
        />
      </button>
    );
  },
);

Toggle.displayName = "Toggle";
