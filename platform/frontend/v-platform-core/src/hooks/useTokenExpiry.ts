/**
 * useTokenExpiry Hook
 *
 * 토큰 만료 상태 추적 및 스마트 경고 로직
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuthStore } from "../store/auth";

export interface TokenExpiryConfig {
  warningThresholdMinutes: number; // 경고 시작 시간 (기본 5분)
  reminderIntervalMinutes: number; // 알림 반복 간격 (기본 1분)
  snoozeMinutes: number; // 나중에 알림 기간 (기본 2분)
}

export interface TokenExpiryState {
  shouldShowWarning: boolean;
  timeLeft: number; // 초
  isExpired: boolean;
  snoozeWarning: () => void;
  extendSession: () => Promise<void>;
}

const DEFAULT_CONFIG: TokenExpiryConfig = {
  warningThresholdMinutes: 5,
  reminderIntervalMinutes: 1,
  snoozeMinutes: 2,
};

export function useTokenExpiry(
  config?: Partial<TokenExpiryConfig>,
): TokenExpiryState {
  const { tokenExpiresAt, refreshToken } = useAuthStore();
  const [lastWarningTime, setLastWarningTime] = useState(0);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const finalConfig: TokenExpiryConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // 토큰 만료까지 남은 시간 계산 (1초마다 업데이트)
  useEffect(() => {
    if (!tokenExpiresAt) {
      setTimeLeft(0);
      return;
    }

    const updateTimeLeft = () => {
      const now = Date.now();
      const expiresAtMs = new Date(tokenExpiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [tokenExpiresAt]);

  // 만료 여부 (tokenExpiresAt으로 직접 계산하여 타이밍 이슈 방지)
  const isExpired = useMemo(() => {
    if (!tokenExpiresAt) return false;

    const now = Date.now();
    const expiresAtMs = new Date(tokenExpiresAt).getTime();
    return now >= expiresAtMs;
  }, [tokenExpiresAt]);

  // 경고 표시 여부 (스마트 로직)
  const shouldShowWarning = useMemo(() => {
    if (!tokenExpiresAt || timeLeft <= 0) return false;

    // 경고 임계값 체크
    const warningThresholdSeconds = finalConfig.warningThresholdMinutes * 60;
    if (timeLeft > warningThresholdSeconds) return false;

    const now = Date.now();

    // 스누즈 기간 체크
    if (now < snoozedUntil) return false;

    // 알림 간격 체크 (1분마다 1회)
    const intervalMs = finalConfig.reminderIntervalMinutes * 60 * 1000;
    if (lastWarningTime > 0 && now - lastWarningTime < intervalMs) {
      return false;
    }

    return true;
  }, [
    tokenExpiresAt,
    timeLeft,
    snoozedUntil,
    lastWarningTime,
    finalConfig.warningThresholdMinutes,
    finalConfig.reminderIntervalMinutes,
  ]);

  // 경고 표시 시 lastWarningTime 업데이트
  useEffect(() => {
    if (shouldShowWarning) {
      setLastWarningTime(Date.now());
    }
  }, [shouldShowWarning]);

  // NOTE: 로그아웃은 TokenExpiryManager에서 처리합니다.
  // 이 훅은 상태만 추적합니다.

  // 스누즈 기능
  const snoozeWarning = useCallback(() => {
    const snoozeMs = finalConfig.snoozeMinutes * 60 * 1000;
    setSnoozedUntil(Date.now() + snoozeMs);
  }, [finalConfig.snoozeMinutes]);

  // 세션 연장 (즉시 토큰 갱신)
  const extendSession = useCallback(async () => {
    try {
      await refreshToken();
      // 성공 시 스누즈 및 경고 타이머 리셋
      setSnoozedUntil(0);
      setLastWarningTime(0);
    } catch (error) {
      console.error("Failed to extend session:", error);
      throw error;
    }
  }, [refreshToken]);

  return {
    shouldShowWarning,
    timeLeft,
    isExpired,
    snoozeWarning,
    extendSession,
  };
}
