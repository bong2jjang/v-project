/**
 * useNotifications Hook
 *
 * WebSocket을 통한 실시간 알림 수신 및 처리
 */

import { useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { useNotificationStore, type Notification } from "../stores/notification";
import { useAuthStore } from "../stores/auth";
import { useBrowserNotification } from "./useBrowserNotification";

// WebSocket API URL 생성
const getWebSocketUrl = (token: string): string => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // 각 앱의 Vite 프록시를 경유하여 올바른 백엔드로 연결
  const host = window.location.hostname;
  const port = window.location.port;
  const hostWithPort = port ? `${host}:${port}` : host;
  return `${protocol}//${hostWithPort}/api/ws?token=${token}`;
};

export function useNotifications() {
  const { token } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const { showNotification, isEnabled: isBrowserNotificationEnabled } =
    useBrowserNotification();

  // WebSocket URL 생성
  const wsUrl = token ? getWebSocketUrl(token) : "";

  // WebSocket 연결
  const { send: sendMessage, isConnected } = useWebSocket({
    url: wsUrl,
    autoConnect: !!token,
    reconnectInterval: 3000,

    onMessage: (message) => {
      // notification 타입 메시지 처리
      if (message.type === "notification" && message.data) {
        const notification = message.data as Notification;
        addNotification(notification);

        // 브라우저 알림 표시 (critical/error만)
        if (
          isBrowserNotificationEnabled &&
          (notification.severity === "critical" ||
            notification.severity === "error")
        ) {
          showNotification({
            title: notification.title,
            body: notification.message,
            tag: notification.id,
            requireInteraction: notification.severity === "critical",
          });
        }
      }
    },

    onDisconnect: () => {
      // 정상적인 재연결 과정에서 발생 가능하므로 로그 제거
    },

    onError: (error) => {
      // React StrictMode에서 useEffect 이중 실행으로 인한 에러 무시
      // 실제 기능에는 영향 없음 (재연결 로직이 자동 처리)
      // 프로덕션에서는 StrictMode가 비활성화되어 발생하지 않음
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_WS) {
        console.debug("Notifications WebSocket reconnecting...", error);
      }
    },
  });

  // 연결되면 notifications 채널 구독
  useEffect(() => {
    if (isConnected) {
      sendMessage({
        type: "subscribe",
        data: { channels: ["notifications"] },
      });
    }
  }, [isConnected, sendMessage]);

  return {
    isConnected,
  };
}
