/**
 * useRealtimeStatus Hook
 *
 * WebSocket을 통한 실시간 상태 업데이트
 * - 최초 연결 성공 시에만 API 호출
 * - 연결 실패 시 불필요한 API 호출 방지
 */

import { useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useBridgeStore } from "../store";
import { useAuthStore } from "../store/auth";
import type { WebSocketMessage } from "../lib/websocket/types";

interface UseRealtimeStatusOptions {
  enabled?: boolean;
  channels?: string[];
}

export function useRealtimeStatus({
  enabled = true,
  channels = ["status", "logs", "config"],
}: UseRealtimeStatusOptions = {}) {
  const { setStatus, addLogs, fetchStatus, fetchLogs } = useBridgeStore();
  const { token } = useAuthStore();
  const hasConnectedOnce = useRef(false);

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "status_update":
          if (message.data) {
            setStatus({
              running: message.data.running,
              pid: message.data.pid,
              uptime: message.data.uptime,
              version: message.data.version,
              container_status: message.data.container_status,
              last_restart: message.data.last_restart,
            });
          }
          break;

        case "log_update":
          if (message.data?.lines) {
            addLogs(message.data.lines);
          }
          break;

        case "message_created":
          // 새 메시지 생성 이벤트 - 커스텀 핸들러로 전달
          // Messages 페이지에서 처리
          break;

        case "config_update":
        case "connection":
        case "subscription_updated":
        case "pong":
          break;

        case "error":
          console.error("WebSocket error:", message.data);
          break;
      }
    },
    [setStatus, addLogs],
  );

  const handleConnect = useCallback(() => {
    // 연결 성공 시에만 초기 데이터 로딩
    hasConnectedOnce.current = true;
    fetchStatus();
    fetchLogs(100);
  }, [fetchStatus, fetchLogs]);

  // WebSocket URL에 인증 토큰 포함
  const wsUrl = token
    ? `ws://${window.location.hostname}:8000/api/ws?token=${encodeURIComponent(token)}`
    : "";

  const { isConnected, reconnectCount, send, connect } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onConnect: handleConnect,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
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
    hasConnectedOnce: hasConnectedOnce.current,
    retry: connect,
  };
}
