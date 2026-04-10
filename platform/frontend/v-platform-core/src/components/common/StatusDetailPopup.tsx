/**
 * StatusDetailPopup 컴포넌트
 *
 * 각 서비스별 상태를 상세히 표시하는 팝업 (서비스별 체크 진행 상태 포함)
 */

import { createPortal } from "react-dom";
import { X, RefreshCw, Loader2, Clock } from "lucide-react";
import { Badge } from "../ui/Badge";

export interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error" | "restarting" | "connecting";
  description: string;
  icon: React.ReactNode;
  isChecking?: boolean;
  responseTimeMs?: number;
  error?: string;
}

export interface StatusDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceStatus[];
  onRefresh: () => void;
  lastUpdated: Date;
  isRefreshing?: boolean;
}

export function StatusDetailPopup({
  isOpen,
  onClose,
  services,
  onRefresh,
  lastUpdated,
  isRefreshing = false,
}: StatusDetailPopupProps) {
  if (!isOpen) return null;

  const getStatusVariant = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "running":
        return "success";
      case "connecting":
      case "restarting":
        return "warning";
      case "stopped":
      case "error":
        return "danger";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "running":
        return "Running";
      case "connecting":
        return "Connecting";
      case "restarting":
        return "Restarting";
      case "stopped":
        return "Stopped";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative bg-surface-card rounded-xl shadow-2xl max-w-md w-full border border-stroke-subtle"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-stroke-subtle">
            <div>
              <h3 className="text-lg font-semibold text-content-primary">
                System Status
              </h3>
              <p className="text-sm text-content-secondary mt-1">
                각 서비스의 상태를 확인하세요
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
                title="상태 새로고침"
              >
                <RefreshCw
                  className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-raised transition-colors"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Service List */}
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {services.map((service, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 bg-surface-elevated rounded-lg border transition-colors ${
                  service.isChecking
                    ? "border-brand-400 dark:border-brand-600"
                    : "border-stroke-subtle hover:border-stroke"
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                    service.isChecking
                      ? "bg-brand-50 dark:bg-brand-950/20 border-brand-200 dark:border-brand-800 text-brand-500"
                      : "bg-surface-card border-stroke-subtle text-content-secondary"
                  }`}
                >
                  {service.isChecking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    service.icon
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-content-primary">
                      {service.name}
                    </h4>
                    {service.isChecking ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        확인 중
                      </span>
                    ) : (
                      <Badge variant={getStatusVariant(service.status)} dot>
                        {getStatusLabel(service.status)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-content-tertiary leading-relaxed">
                    {service.description}
                  </p>
                  {/* 응답시간 / 에러 */}
                  {!service.isChecking && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {service.responseTimeMs !== undefined && (
                        <span className="inline-flex items-center gap-1 text-xs text-content-tertiary">
                          <Clock className="w-3 h-3" />
                          {service.responseTimeMs}ms
                        </span>
                      )}
                      {service.error && service.status !== "running" && (
                        <span className="text-xs text-red-500 dark:text-red-400 break-all">
                          {service.error}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-stroke-subtle">
            <p className="text-xs text-content-tertiary text-center flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              마지막 업데이트: {lastUpdated.toLocaleTimeString("ko-KR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
