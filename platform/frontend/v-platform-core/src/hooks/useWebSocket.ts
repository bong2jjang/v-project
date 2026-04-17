/**
 * useWebSocket Hook
 *
 * WebSocket 연결 및 메시지 처리
 * - Exponential backoff (1s → 30s 상한), 무제한 재시도
 * - 브라우저 가시성 복귀 / 온라인 복귀 시 즉시 재연결
 * - 초기 실패 5회까지만 에러 이벤트 호출 (콘솔 노이즈 억제)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { WebSocketMessage, ClientMessage } from "../lib/websocket/types";

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  /** 초기 재연결 간격(ms). Exponential backoff로 최대 maxReconnectInterval까지 증가. */
  reconnectInterval?: number;
  /** 재연결 간격 상한(ms). 기본 30초. */
  maxReconnectInterval?: number;
  /** onError 콜백을 호출할 최대 횟수(콘솔 스팸 방지). 재시도 자체는 무제한. */
  errorReportLimit?: number;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectInterval = 1000,
  maxReconnectInterval = 30000,
  errorReportLimit = 5,
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
        // 초기 N회까지만 보고 — 백엔드 다운 중 무한 재시도 노이즈 방지
        if (reconnectCountRef.current < errorReportLimit) {
          onErrorRef.current?.(error);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setIsConnected(false);
        onDisconnectRef.current?.();

        if (!shouldConnectRef.current) return;

        // Exponential backoff: base * 2^attempt, max로 상한
        reconnectCountRef.current += 1;
        setReconnectCount(reconnectCountRef.current);
        const delay = Math.min(
          reconnectInterval * Math.pow(2, reconnectCountRef.current - 1),
          maxReconnectInterval,
        );
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      wsRef.current = ws;
    } catch {
      // WebSocket 생성 실패
    }
  }, [url, reconnectInterval, maxReconnectInterval, errorReportLimit]);

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

  /** 재연결 카운터 초기화 및 즉시 재연결 시도 */
  const retry = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectCountRef.current = 0;
    setReconnectCount(0);
    shouldConnectRef.current = true;
    connect();
  }, [connect]);

  // 가시성 복귀 / 온라인 복귀 시 즉시 재연결 (대기 백오프 건너뛰기)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tryImmediate = () => {
      if (!shouldConnectRef.current) return;
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      connect();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryImmediate();
    };
    const onOnline = () => tryImmediate();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
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
