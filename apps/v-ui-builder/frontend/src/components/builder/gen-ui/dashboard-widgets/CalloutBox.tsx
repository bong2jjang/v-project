/**
 * CalloutBox — callout_box ui tool 의 component 렌더러.
 * variant 별 색상/아이콘 + 제목 + 본문. 작업 주의사항/성공 피드백 강조 용도.
 */

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CalloutBoxProps {
  variant: "info" | "warning" | "success" | "error";
  title: string;
  body: string;
}

interface VariantStyle {
  Icon: LucideIcon;
  iconClass: string;
  container: string;
}

const VARIANT: Record<CalloutBoxProps["variant"], VariantStyle> = {
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

export function CalloutBox({ variant, title, body }: CalloutBoxProps) {
  const { Icon, iconClass, container } = VARIANT[variant];
  return (
    <div
      className={`flex items-start gap-2 rounded-input border px-3 py-2 ${container}`}
    >
      <Icon size={16} className={`${iconClass} shrink-0 mt-0.5`} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-content-primary">
          {title}
        </div>
        <div className="mt-0.5 text-[11.5px] text-content-secondary leading-relaxed whitespace-pre-wrap break-words">
          {body}
        </div>
      </div>
    </div>
  );
}
