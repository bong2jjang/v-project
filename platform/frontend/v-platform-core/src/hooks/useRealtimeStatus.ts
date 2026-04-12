/**
 * useRealtimeStatus — Platform default
 *
 * 플랫폼 WebSocket 연결 상태를 추적합니다.
 * TopBar 등에서 시스템 상태 표시에 사용됩니다.
 *
 * Apps can override this by placing their own useRealtimeStatus.ts
 * in the app's hooks directory (e.g. v-channel-bridge adds bridge-specific handling).
 */

import { useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAuthStore } from "../stores/auth";

interface UseRealtimeStatusOptions {
  enabled?: boolean;
  channels?: string[];
}

export function useRealtimeStatus({
  enabled = true,
  channels = ["status"],
}: UseRealtimeStatusOptions = {}) {
  const { token } = useAuthStore();

  const wsUrl = token
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`
    : "";

  const { isConnected, reconnectCount, send, connect } = useWebSocket({
    url: wsUrl,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    autoConnect: enabled && !!token,
  });

  // 연결 시 채널 구독
  useEffect(() => {
    if (isConnected && channels.length > 0) {
      send({
        type: "subscribe",
        data: { channels },
      });
    }
  }, [isConnected, channels, send]);

  return {
    isConnected,
    reconnectCount,
    retry: connect,
  };
}
