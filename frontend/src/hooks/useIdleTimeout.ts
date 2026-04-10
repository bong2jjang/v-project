/**
 * useIdleTimeout Hook
 *
 * 비활성 시간 추적 및 타임아웃 처리
 */

import { useEffect, useState } from "react";
import { useActivityDetection } from "./useActivityDetection";

export interface IdleTimeoutOptions {
  timeoutMinutes: number; // 비활성 타임아웃 (분)
  onTimeout: () => void; // 타임아웃 콜백
  enabled?: boolean; // 활성화 여부
}

export function useIdleTimeout(options: IdleTimeoutOptions) {
  const { timeoutMinutes, onTimeout, enabled = true } = options;
  const { lastActivityTime } = useActivityDetection();
  const [isIdle, setIsIdle] = useState(false);
  const [idleTimeLeft, setIdleTimeLeft] = useState(timeoutMinutes * 60);

  // 비활성 시간 체크
  useEffect(() => {
    if (!enabled) {
      setIsIdle(false);
      setIdleTimeLeft(timeoutMinutes * 60);
      return;
    }

    const checkIdle = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = Math.floor((now - lastActivityTime) / 1000);
      const timeoutSeconds = timeoutMinutes * 60;
      const remaining = Math.max(0, timeoutSeconds - timeSinceActivity);

      setIdleTimeLeft(remaining);

      if (timeSinceActivity >= timeoutSeconds) {
        setIsIdle(true);
        onTimeout();
      } else {
        setIsIdle(false);
      }
    }, 1000);

    return () => clearInterval(checkIdle);
  }, [enabled, lastActivityTime, timeoutMinutes, onTimeout]);

  return {
    isIdle,
    idleTimeLeft, // 초
    idleTimeLeftMinutes: Math.floor(idleTimeLeft / 60),
    idleTimeLeftSeconds: idleTimeLeft % 60,
  };
}
