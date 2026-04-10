/**
 * Button 컴포넌트
 *
 * 스타일 전략:
 * - primary: 브랜드 배경 (CTA용)
 * - success/danger/warning: status 색상 테두리 + 아이콘 색상 강조
 * - secondary: 중립 테두리
 * - ghost: 최소 스타일, hover 시 표시
 */

import { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, { button: string; icon: string }> =
  {
    primary: {
      button:
        "bg-brand-600 text-content-inverse hover:bg-brand-700 border border-brand-700",
      icon: "",
    },
    secondary: {
      button:
        "bg-surface-card text-content-primary hover:bg-surface-raised border border-line-heavy hover:border-content-tertiary",
      icon: "",
    },
    success: {
      button:
        "bg-surface-card text-content-primary hover:bg-status-success-light border border-status-success-border hover:border-status-success",
      icon: "text-status-success",
    },
    danger: {
      button:
        "bg-surface-card text-content-primary hover:bg-status-danger-light border border-status-danger-border hover:border-status-danger",
      icon: "text-status-danger",
    },
    warning: {
      button:
        "bg-surface-card text-content-primary hover:bg-status-warning-light border border-status-warning-border hover:border-status-warning",
      icon: "text-status-warning",
    },
    ghost: {
      button:
        "bg-transparent text-content-secondary hover:text-content-primary hover:bg-surface-raised border border-transparent hover:border-line",
      icon: "",
    },
  };

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-body-sm",
  md: "px-4 py-2 text-body-base",
  lg: "px-6 py-3 text-body-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center gap-2 font-medium rounded-button transition-all duration-normal focus-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

  const { button: variantClass, icon: iconClass } = variantClasses[variant];
  const classes = `${baseClasses} ${variantClass} ${sizeClasses[size]} ${className}`;

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        <>
          {icon && <span className={`flex-shrink-0 ${iconClass}`}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
