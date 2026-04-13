/**
 * useActivityDetection Hook
 *
 * 사용자 활동 감지 (마우스, 키보드, 터치)
 */

import { useEffect, useState, useCallback, useRef } from "react";

export interface ActivityDetectionOptions {
  throttleMs?: number; // 활동 감지 간격 (기본 1000ms)
  events?: string[]; // 감지할 이벤트들
}

const DEFAULT_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function useActivityDetection(options?: ActivityDetectionOptions) {
  const { throttleMs = 1000, events = DEFAULT_EVENTS } = options || {};

  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isActive, setIsActive] = useState(true);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Throttled activity handler
  const handleActivity = useCallback(() => {
    // 이미 타이머가 실행 중이면 무시
    if (throttleTimerRef.current) {
      return;
    }

    // 활동 시간 업데이트
    setLastActivityTime(Date.now());
    setIsActive(true);

    // Throttle 타이머 설정
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
    }, throttleMs);
  }, [throttleMs]);

  // 이벤트 리스너 등록
  useEffect(() => {
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [events, handleActivity]);

  // 비활성 상태 체크 (매초)
  useEffect(() => {
    const checkActivity = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime;

      // 5초 이상 활동 없으면 비활성으로 간주
      if (timeSinceLastActivity > 5000) {
        setIsActive(false);
      }
    }, 1000);

    return () => clearInterval(checkActivity);
  }, [lastActivityTime]);

  return {
    lastActivityTime,
    isActive,
    timeSinceLastActivity: Date.now() - lastActivityTime,
  };
}
