/**
 * NotificationBell Component
 *
 * Footer에 표시되는 알림 벨 아이콘
 */

import { useState, useMemo } from "react";
import { Bell } from "lucide-react";
import { useNotificationStore } from "../../stores/notification";
import { useAuthStore } from "../../stores/auth";
import { isAdminRole } from "../../lib/api/types";
import { NotificationPopover } from "./NotificationPopover";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications } = useNotificationStore();
  const { user } = useAuthStore();

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

  // 읽지 않은 알림 개수
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;

  // 가장 높은 severity 색상 결정
  const getIconColor = () => {
    const unreadNotifications = visibleNotifications.filter((n) => !n.read);

    if (unreadNotifications.some((n) => n.severity === "critical")) {
      return "text-status-error";
    }
    if (unreadNotifications.some((n) => n.severity === "error")) {
      return "text-status-error";
    }
    if (unreadNotifications.some((n) => n.severity === "warning")) {
      return "text-status-warning";
    }
    if (unreadCount > 0) {
      return "text-brand-500";
    }
    return "text-content-tertiary";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-surface-raised rounded-button transition-colors"
        aria-label="알림"
      >
        <Bell className={`w-5 h-5 ${getIconColor()}`} />
        {unreadCount > 0 && (
          <span
            className={`absolute top-1.5 right-2.5 w-2 h-2 rounded-full ${getIconColor().replace("text-", "bg-")}`}
          />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover */}
          <div className="absolute right-0 bottom-full mb-2 z-50">
            <NotificationPopover onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
