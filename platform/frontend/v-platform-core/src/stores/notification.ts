/**
 * Notification Store
 *
 * 알림 상태 관리 (Zustand)
 */

import { create } from "zustand";

// === Types ===

export type NotificationSeverity =
  | "critical"
  | "error"
  | "warning"
  | "info"
  | "success";

export type NotificationCategory =
  | "service"
  | "message"
  | "config"
  | "user"
  | "system"
  | "session"
  | "auth"
  | "api";

export interface NotificationAction {
  label: string;
  action: string;
  params?: Record<string, any>;
}

export interface Notification {
  id: string;
  timestamp: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
  message: string;
  source: string;
  metadata?: Record<string, any>;
  actions?: NotificationAction[];
  link?: string;
  dismissible: boolean;
  persistent: boolean;
  read: boolean;
  requiredRole?: "admin" | "user"; // 알림을 볼 수 있는 최소 권한 (없으면 모두 볼 수 있음)
}

export interface NotificationFilter {
  severity: NotificationSeverity[];
  category: NotificationCategory[];
  unreadOnly: boolean;
}

// === Store ===

interface NotificationStore {
  // State
  notifications: Notification[];
  toasts: Notification[];
  filter: NotificationFilter;

  // Computed
  unreadCount: number;
  filteredNotifications: Notification[];

  // Actions
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setFilter: (filter: Partial<NotificationFilter>) => void;

  // Toast specific
  addToast: (notification: Notification) => void;
  removeToast: (id: string) => void;
}

const DEFAULT_FILTER: NotificationFilter = {
  severity: [],
  category: [],
  unreadOnly: false,
};

// Toast를 표시할지 결정하는 로직
const shouldShowToast = (notification: Notification): boolean => {
  // critical, error, warning은 항상 toast로 표시
  if (
    notification.severity === "critical" ||
    notification.severity === "error" ||
    notification.severity === "warning"
  ) {
    return true;
  }

  // success도 toast로 표시
  if (notification.severity === "success") {
    return true;
  }

  return false;
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // Initial State
  notifications: [],
  toasts: [],
  filter: DEFAULT_FILTER,

  // Computed (getter로 구현)
  get unreadCount() {
    return get().notifications.filter((n) => !n.read).length;
  },

  get filteredNotifications() {
    const { notifications, filter } = get();

    return notifications.filter((notification) => {
      // Severity 필터
      if (
        filter.severity.length > 0 &&
        !filter.severity.includes(notification.severity)
      ) {
        return false;
      }

      // Category 필터
      if (
        filter.category.length > 0 &&
        !filter.category.includes(notification.category)
      ) {
        return false;
      }

      // Unread only 필터
      if (filter.unreadOnly && notification.read) {
        return false;
      }

      return true;
    });
  },

  // Actions
  addNotification: (notification) =>
    set((state) => {
      // 중복 방지 (같은 ID가 이미 있으면 무시)
      if (state.notifications.find((n) => n.id === notification.id)) {
        return state;
      }

      // 최대 100개까지만 유지 (오래된 것부터 삭제)
      const newNotifications = [notification, ...state.notifications].slice(
        0,
        100,
      );

      // Toast 표시 여부 결정
      const newToasts = shouldShowToast(notification)
        ? [notification, ...state.toasts].slice(0, 3) // 최대 3개
        : state.toasts;

      return {
        notifications: newNotifications,
        toasts: newToasts,
      };
    }),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAll: () =>
    set({
      notifications: [],
      toasts: [],
    }),

  setFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),

  // Toast specific
  addToast: (notification) =>
    set((state) => ({
      toasts: [notification, ...state.toasts].slice(0, 3),
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
