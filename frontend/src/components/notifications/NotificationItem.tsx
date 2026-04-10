/**
 * NotificationItem Component
 *
 * 개별 알림 아이템
 */

import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  useNotificationStore,
  type Notification,
} from "../../store/notification";
import { formatDistanceToNow } from "../../lib/utils/date";

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
}

export function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const { markAsRead, removeNotification } = useNotificationStore();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // 링크가 있으면 이동
    if (notification.link) {
      window.location.hash = notification.link;
      onClose?.();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNotification(notification.id);
  };

  // Severity에 따른 아이콘
  const getIcon = () => {
    switch (notification.severity) {
      case "critical":
        return <XCircle className="w-5 h-5 text-status-error" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-status-error" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-status-warning" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-status-success" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-status-info" />;
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        p-4 border-b border-line last:border-b-0
        hover:bg-surface-raised transition-colors
        ${notification.link ? "cursor-pointer" : ""}
        ${!notification.read ? "bg-brand-50/50 dark:bg-brand-950/20" : ""}
      `}
    >
      <div className="flex gap-3">
        {/* 읽음/읽지 않음 표시 */}
        <div className="flex-shrink-0 mt-1">
          {!notification.read && (
            <div className="w-2 h-2 rounded-full bg-brand-500" />
          )}
        </div>

        {/* 아이콘 */}
        <div className="flex-shrink-0">{getIcon()}</div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-content-primary mb-1">
            {notification.title}
          </h4>
          <p className="text-sm text-content-secondary mb-2 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-content-tertiary">
            {formatDistanceToNow(new Date(notification.timestamp))}
          </p>
        </div>

        {/* 삭제 버튼 */}
        {notification.dismissible && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 p-1 hover:bg-surface-card rounded transition-colors"
            aria-label="삭제"
          >
            <XCircle className="w-4 h-4 text-content-tertiary" />
          </button>
        )}
      </div>
    </div>
  );
}
