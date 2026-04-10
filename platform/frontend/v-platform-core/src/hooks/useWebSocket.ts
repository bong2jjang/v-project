/**
 * useWebSocket Hook
 *
 * WebSocket 연결 및 메시지 처리
 * - 연결 실패 시 불필요한 리렌더 방지
 * - 안정적인 재연결 로직
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { WebSocketMessage, ClientMessage } from "../lib/websocket/types";

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  autoConnect = true,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const shouldConnectRef = useRef(autoConnect);
  const reconnectCountRef = useRef(0);

  // 콜백을 ref로 유지하여 connect 함수의 의존성 제거
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    // 이미 연결되어 있으면 무시
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    // 재연결 제한 확인
    if (reconnectCountRef.current >= maxReconnectAttempts) {
      return;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectCountRef.current = 0;
        setReconnectCount(0);
        onConnectRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessageRef.current?.(message);
        } catch {
          // JSON 파싱 실패 무시
        }
      };

      ws.onerror = (error) => {
        onErrorRef.current?.(error);
      };

      ws.onclose = () => {
        wsRef.current = null;
        setIsConnected(false);
        onDisconnectRef.current?.();

        // 자동 재연결
        if (
          shouldConnectRef.current &&
          reconnectCountRef.current < maxReconnectAttempts
        ) {
          reconnectCountRef.current += 1;
          setReconnectCount(reconnectCountRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch {
      // WebSocket 생성 실패
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
        ws.onerror = () => {};
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectCountRef.current = 0;
    setReconnectCount(0);
  }, []);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch {
        // 전송 실패 무시
      }
    }
  }, []);

  /** 재연결 카운터 초기화 및 재연결 시도 */
  const retry = useCallback(() => {
    reconnectCountRef.current = 0;
    setReconnectCount(0);
    shouldConnectRef.current = true;
    connect();
  }, [connect]);

  // 초기 연결 및 정리
  useEffect(() => {
    shouldConnectRef.current = autoConnect;
    if (autoConnect) {
      connect();
    }

    return () => {
      shouldConnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // StrictMode double-mount: 연결 중인 소켓을 즉시 close()하면
          // "WebSocket is closed before the connection is established" 경고 발생.
          // onopen 이후 닫아서 경고를 방지한다.
          ws.onopen = () => ws.close();
          ws.onerror = () => {};
        }
        wsRef.current = null;
      }
    };
  }, [autoConnect, connect]);

  return {
    isConnected,
    reconnectCount,
    connect: retry,
    disconnect,
    send,
  };
}
