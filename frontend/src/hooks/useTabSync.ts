/**
 * useTabSync Hook
 *
 * BroadcastChannel API를 사용하여 여러 탭 간 세션 상태 동기화
 */

import { useEffect, useState, useCallback } from "react";

export interface TabSyncMessage {
  type: "logout" | "token_refresh" | "session_extend";
  timestamp: number;
  data?: any;
}

export interface TabSyncOptions {
  channelName?: string;
  onLogout?: () => void;
  onTokenRefresh?: (data: any) => void;
  onSessionExtend?: (data: any) => void;
}

export function useTabSync(options?: TabSyncOptions) {
  const {
    channelName = "vms-session-sync",
    onLogout,
    onTokenRefresh,
    onSessionExtend,
  } = options || {};

  const [isSupported, setIsSupported] = useState(false);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);

  // BroadcastChannel 지원 확인
  useEffect(() => {
    const supported = "BroadcastChannel" in window;
    setIsSupported(supported);

    if (!supported) {
      console.warn(
        "[TabSync] BroadcastChannel is not supported in this browser",
      );
      return;
    }

    // 채널 생성
    const bc = new BroadcastChannel(channelName);
    setChannel(bc);

    // 메시지 수신 처리
    bc.onmessage = (event: MessageEvent<TabSyncMessage>) => {
      const message = event.data;

      console.log("[TabSync] Received message:", message);

      switch (message.type) {
        case "logout":
          onLogout?.();
          break;
        case "token_refresh":
          onTokenRefresh?.(message.data);
          break;
        case "session_extend":
          onSessionExtend?.(message.data);
          break;
        default:
          console.warn("[TabSync] Unknown message type:", message.type);
      }
    };

    return () => {
      bc.close();
    };
  }, [channelName, onLogout, onTokenRefresh, onSessionExtend]);

  // 로그아웃 브로드캐스트
  const broadcastLogout = useCallback(() => {
    if (!channel) return;

    try {
      const message: TabSyncMessage = {
        type: "logout",
        timestamp: Date.now(),
      };

      channel.postMessage(message);
      console.log("[TabSync] Broadcasted logout");
    } catch (error) {
      // Channel이 닫혔거나 사용 불가능한 경우 무시
      console.warn("[TabSync] Failed to broadcast logout:", error);
    }
  }, [channel]);

  // 토큰 갱신 브로드캐스트
  const broadcastTokenRefresh = useCallback(
    (data: any) => {
      if (!channel) return;

      try {
        const message: TabSyncMessage = {
          type: "token_refresh",
          timestamp: Date.now(),
          data,
        };

        channel.postMessage(message);
        console.log("[TabSync] Broadcasted token refresh");
      } catch (error) {
        console.warn("[TabSync] Failed to broadcast token refresh:", error);
      }
    },
    [channel],
  );

  // 세션 연장 브로드캐스트
  const broadcastSessionExtend = useCallback(
    (data: any) => {
      if (!channel) return;

      try {
        const message: TabSyncMessage = {
          type: "session_extend",
          timestamp: Date.now(),
          data,
        };

        channel.postMessage(message);
        console.log("[TabSync] Broadcasted session extend");
      } catch (error) {
        console.warn("[TabSync] Failed to broadcast session extend:", error);
      }
    },
    [channel],
  );

  return {
    isSupported,
    broadcastLogout,
    broadcastTokenRefresh,
    broadcastSessionExtend,
  };
}
