/**
 * AlertBanner — alert_banner ui tool 의 component 렌더러.
 * 대시보드 상단 공지/상태 배너. dismissible 시 닫기 버튼(로컬 상태), CTA 링크 선택.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AlertBannerProps {
  variant: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  dismissible: boolean;
  cta_label: string | null;
  cta_href: string | null;
}

interface VariantStyle {
  Icon: LucideIcon;
  iconClass: string;
  container: string;
}

const VARIANT: Record<AlertBannerProps["variant"], VariantStyle> = {
  info: {
    Icon: Info,
    iconClass: "text-status-info",
    container: "border-status-info-border bg-status-info-light",
  },
  warning: {
    Icon: AlertTriangle,
    iconClass: "text-status-warning",
    container: "border-status-warning-border bg-status-warning-light",
  },
  success: {
    Icon: CheckCircle2,
    iconClass: "text-status-success",
    container: "border-status-success-border bg-status-success-light",
  },
  error: {
    Icon: XCircle,
    iconClass: "text-status-danger",
    container: "border-status-danger-border bg-status-danger-light",
  },
};

export function AlertBanner({
  variant,
  title,
  message,
  dismissible,
  cta_label,
  cta_href,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const { Icon, iconClass, container } = VARIANT[variant];

  return (
    <div
      className={`flex items-center gap-2 rounded-input border px-3 py-2 ${container}`}
    >
      <Icon size={16} className={`${iconClass} shrink-0`} />
      <div className="min-w-0 flex-1">
        <span className="text-[12.5px] font-semibold text-content-primary">
          {title}
        </span>
        <span className="ml-2 text-[11.5px] text-content-secondary">
          {message}
        </span>
      </div>
      {cta_label && cta_href && (
        <a
          href={cta_href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-button bg-surface-card border border-line px-2 py-0.5 text-[11px] text-content-primary hover:border-brand-500 hover:text-brand-500 shrink-0"
        >
          {cta_label}
        </a>
      )}
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex items-center justify-center w-5 h-5 rounded-button text-content-tertiary hover:text-content-primary shrink-0"
          aria-label="배너 닫기"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
