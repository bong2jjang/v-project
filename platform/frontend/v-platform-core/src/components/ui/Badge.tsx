/**
 * Badge 컴포넌트
 *
 * 다크모드 호환 시맨틱 뱃지
 */

import { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "default"
  | "error"
  | "secondary";

type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    "bg-status-success-light text-status-success border-status-success-border",
  danger:
    "bg-status-danger-light text-status-danger border-status-danger-border",
  warning:
    "bg-status-warning-light text-status-warning border-status-warning-border",
  info: "bg-status-info-light text-status-info border-status-info-border",
  default: "bg-surface-raised text-content-secondary border-line",
  error:
    "bg-status-danger-light text-status-danger border-status-danger-border",
  secondary: "bg-surface-raised text-content-secondary border-line",
};

const dotClasses: Record<BadgeVariant, string> = {
  success: "bg-status-success",
  danger: "bg-status-danger",
  warning: "bg-status-warning",
  info: "bg-status-info",
  default: "bg-content-tertiary",
  error: "bg-status-danger",
  secondary: "bg-content-tertiary",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-caption",
  lg: "px-3 py-1 text-sm",
};

export function Badge({
  variant = "default",
  dot = false,
  size = "md",
  children,
  className = "",
  ...props
}: BadgeProps) {
  const classes = `inline-flex items-center gap-1.5 rounded-badge font-medium border ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  return (
    <span className={classes} {...props}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]}`} />
      )}
      {children}
    </span>
  );
}
