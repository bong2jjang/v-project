/**
 * NotificationPopover Component
 *
 * 알림 목록 팝오버
 */

import { useState, useMemo } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import {
  useNotificationStore,
  type NotificationSeverity,
} from "../../stores/notification";
import { useAuthStore } from "../../stores/auth";
import { isAdminRole } from "../../api/types";
import { NotificationItem } from "./NotificationItem";

interface NotificationPopoverProps {
  onClose: () => void;
}

type FilterTab = "all" | "critical" | "error" | "warning" | "info" | "success";

export function NotificationPopover({ onClose }: NotificationPopoverProps) {
  const { notifications, markAllAsRead, clearAll } = useNotificationStore();
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // 권한 필터링된 알림 목록
  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      // requiredRole이 없으면 모두 볼 수 있음
      if (!notification.requiredRole) return true;

      // 사용자가 없으면 볼 수 없음
      if (!user) return false;

      // admin 권한이 필요한 알림
      if (notification.requiredRole === "admin") {
        return isAdminRole(user.role);
      }

      // user 이상 권한이 필요한 알림 (모든 로그인 사용자)
      return true;
    });
  }, [notifications, user]);

  // 필터링된 알림 목록
  const filteredNotifications = visibleNotifications.filter((n) => {
    if (activeFilter === "all") return true;
    return n.severity === activeFilter;
  });

  // 탭 정의
  const tabs: {
    value: FilterTab;
    label: string;
    severity?: NotificationSeverity;
  }[] = [
    { value: "all", label: "전체" },
    { value: "critical", label: "긴급", severity: "critical" },
    { value: "error", label: "에러", severity: "error" },
    { value: "warning", label: "경고", severity: "warning" },
    { value: "success", label: "성공", severity: "success" },
    { value: "info", label: "정보", severity: "info" },
  ];

  // 각 필터별 알림 개수
  const getCount = (filter: FilterTab): number => {
    if (filter === "all") return visibleNotifications.length;
    return visibleNotifications.filter((n) => n.severity === filter).length;
  };

  return (
    <div className="w-[calc(100vw-2rem)] sm:w-[400px] max-h-[calc(100dvh-6rem)] bg-surface-card border border-line rounded-lg shadow-elevation-high flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-line">
        <h3 className="text-lg font-semibold text-content-primary">알림</h3>
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-raised rounded-button transition-colors"
          disabled={visibleNotifications.every((n) => n.read)}
        >
          <CheckCheck className="w-4 h-4" />
          모두 읽음
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex gap-1 p-2 border-b border-line overflow-x-auto">
        {tabs.map((tab) => {
          const count = getCount(tab.value);
          const isActive = activeFilter === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-button
                transition-colors whitespace-nowrap
                ${
                  isActive
                    ? "bg-brand-500 text-white"
                    : "text-content-secondary hover:text-content-primary hover:bg-surface-raised"
                }
              `}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`
                    min-w-[20px] h-5 px-1.5 flex items-center justify-center
                    text-xs font-medium rounded-full
                    ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-surface-raised text-content-secondary"
                    }
                  `}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-content-secondary mb-2">알림이 없습니다</p>
            <p className="text-sm text-content-tertiary">
              {activeFilter === "all"
                ? "새로운 알림이 도착하면 여기에 표시됩니다"
                : `${tabs.find((t) => t.value === activeFilter)?.label} 알림이 없습니다`}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClose={onClose}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {visibleNotifications.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-t border-line">
          <span className="text-sm text-content-tertiary">
            총 {visibleNotifications.length}개의 알림
          </span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-status-error hover:bg-status-error/10 rounded-button transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            모두 지우기
          </button>
        </div>
      )}
    </div>
  );
}
