/**
 * Toast Component
 *
 * 개별 토스트 메시지
 */

import { useEffect, useState } from "react";
import {
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { Notification } from "../../stores/notification";

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  autoDismissDelay?: number; // ms, 기본 5000ms (5초)
}

export function Toast({
  notification,
  onDismiss,
  autoDismissDelay = 5000,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  // Auto-dismiss 타이머
  useEffect(() => {
    if (!notification.dismissible) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / autoDismissDelay) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        handleDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [notification.dismissible, autoDismissDelay]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300); // 애니메이션 시간
  };

  // Severity에 따른 아이콘 및 스타일
  const getVariant = () => {
    switch (notification.severity) {
      case "critical":
        return {
          icon: <XCircle className="w-5 h-5 text-red-700" />,
          bgColor: "bg-red-50 backdrop-blur-sm",
          borderColor: "border-red-200 ring-2 ring-red-100",
          progressColor: "bg-red-300/50",
          textColor: "text-red-900",
          textSecondaryColor: "text-red-800",
        };
      case "error":
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-700" />,
          bgColor: "bg-red-50 backdrop-blur-sm",
          borderColor: "border-red-200 ring-2 ring-red-100",
          progressColor: "bg-red-300/50",
          textColor: "text-red-900",
          textSecondaryColor: "text-red-800",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-700" />,
          bgColor: "bg-amber-50 backdrop-blur-sm",
          borderColor: "border-amber-200 ring-2 ring-amber-100",
          progressColor: "bg-amber-300/50",
          textColor: "text-amber-900",
          textSecondaryColor: "text-amber-800",
        };
      case "success":
        return {
          icon: <CheckCircle className="w-5 h-5 text-emerald-700" />,
          bgColor: "bg-emerald-50 backdrop-blur-sm",
          borderColor: "border-emerald-200 ring-2 ring-emerald-100",
          progressColor: "bg-emerald-300/50",
          textColor: "text-emerald-900",
          textSecondaryColor: "text-emerald-800",
        };
      case "info":
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-700" />,
          bgColor: "bg-blue-50 backdrop-blur-sm",
          borderColor: "border-blue-200 ring-2 ring-blue-100",
          progressColor: "bg-blue-300/50",
          textColor: "text-blue-900",
          textSecondaryColor: "text-blue-800",
        };
    }
  };

  const variant = getVariant();

  return (
    <div
      className={`
        relative w-[400px] max-w-full overflow-hidden
        rounded-lg border shadow-elevation-high
        ${variant.bgColor} ${variant.borderColor}
        transition-all duration-300 ease-out
        ${
          isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
        }
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Progress bar */}
      {notification.dismissible && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-surface-raised/30">
          <div
            className={`h-full transition-all duration-50 ${variant.progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex gap-3 p-4 pt-5">
        {/* 아이콘 */}
        <div className="flex-shrink-0">{variant.icon}</div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold mb-1 ${variant.textColor}`}>
            {notification.title}
          </h4>
          <p className={`text-sm line-clamp-3 ${variant.textSecondaryColor}`}>
            {notification.message}
          </p>

          {/* 액션 버튼들 */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // 액션 핸들러 실행
                    if (action.action) {
                      const handlers = (window as any)
                        .__notificationActionHandlers;
                      if (handlers && handlers[action.action]) {
                        handlers[action.action](action.params);
                      }
                    }
                    handleDismiss();
                  }}
                  className={`
                    px-3 py-1 text-xs font-medium rounded-button
                    transition-colors
                    ${
                      index === 0
                        ? "bg-black/10 hover:bg-black/15 backdrop-blur-sm border border-black/20"
                        : "bg-black/5 hover:bg-black/10 backdrop-blur-sm border border-black/10"
                    }
                    ${variant.textColor}
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        {notification.dismissible && (
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 p-1 hover:bg-black/10 rounded-button transition-colors ${variant.textColor}`}
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
