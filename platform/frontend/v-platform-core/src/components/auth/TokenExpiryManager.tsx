/**
 * TokenExpiryManager Component
 *
 * 토큰 만료 관리 및 통합 알림 시스템 연동
 * (UI 없음, 로직만 담당)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTokenExpiry } from "../../hooks/useTokenExpiry";
import { useNotificationStore } from "../../stores/notification";
import { useAuthStore } from "../../stores/auth";
import { useSessionSettingsStore } from "../../stores/sessionSettings";
import { useActivityDetection } from "../../hooks/useActivityDetection";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";
import { useTabSync } from "../../hooks/useTabSync";
import { getSystemNotificationStatus } from "../../api/persistentNotifications";

export interface TokenExpiryManagerProps {
  config?: {
    warningThresholdMinutes?: number;
    reminderIntervalMinutes?: number;
    snoozeMinutes?: number;
  };
}

export function TokenExpiryManager({ config }: TokenExpiryManagerProps) {
  const navigate = useNavigate();
  const { settings } = useSessionSettingsStore();
  const [sessionNotifEnabled, setSessionNotifEnabled] = useState(true);

  // 시스템 알림 상태 조회 — 세션 카테고리가 앱에서 비활성이면 알림 억제
  useEffect(() => {
    getSystemNotificationStatus()
      .then((statuses) => {
        const sessionStatus = statuses.find((s) => s.category === "session");
        if (sessionStatus && !sessionStatus.is_active) {
          setSessionNotifEnabled(false);
        }
      })
      .catch(() => {
        // API 실패 시 기본 활성 유지
      });
  }, []);

  // 사용자 설정과 config prop 병합 (prop이 우선)
  const finalConfig = {
    warningThresholdMinutes:
      config?.warningThresholdMinutes ?? settings.warningThresholdMinutes,
    reminderIntervalMinutes:
      config?.reminderIntervalMinutes ?? settings.reminderIntervalMinutes,
    snoozeMinutes: config?.snoozeMinutes ?? settings.snoozeMinutes,
  };

  const {
    shouldShowWarning,
    timeLeft,
    isExpired,
    snoozeWarning,
    extendSession,
  } = useTokenExpiry(finalConfig);
  const { addNotification, removeNotification } = useNotificationStore();
  const { tokenExpiresAt, logout, refreshToken } = useAuthStore();
  const [lastExpiresAt, setLastExpiresAt] = useState(tokenExpiresAt);
  const isLoggedOut = useRef(false);
  const autoExtendTriggered = useRef(false);
  const isInitialMount = useRef(true);

  // Phase 3: 활동 감지
  const { lastActivityTime } = useActivityDetection();

  // Phase 3: 탭 동기화 (먼저 정의하여 broadcastLogout 등을 사용 가능하게 함)
  const handleTabLogout = useCallback(() => {
    if (!isLoggedOut.current) {
      isLoggedOut.current = true;
      logout();
      navigate("/login");
    }
  }, [logout, navigate]);

  const handleTabTokenRefresh = useCallback(() => {
    // 다른 탭에서 토큰 갱신됨 - 경고 알림 제거
    removeNotification("session-warning");
  }, [removeNotification]);

  const handleTabSessionExtend = useCallback(() => {
    // 다른 탭에서 세션 연장됨 - 경고 알림 제거
    removeNotification("session-warning");
  }, [removeNotification]);

  const { broadcastLogout, broadcastTokenRefresh, broadcastSessionExtend } =
    useTabSync({
      onLogout: handleTabLogout,
      onTokenRefresh: handleTabTokenRefresh,
      onSessionExtend: handleTabSessionExtend,
    });

  // Phase 3: Idle timeout (broadcastLogout이 정의된 후)
  const handleIdleTimeout = useCallback(() => {
    if (isLoggedOut.current) return;
    isLoggedOut.current = true;

    logout();

    if (sessionNotifEnabled) {
      addNotification({
        id: "session-idle-timeout",
        timestamp: new Date().toISOString(),
        severity: "warning",
        category: "session",
        title: "비활성으로 인한 로그아웃",
        message: `${settings.idleTimeoutMinutes}분 동안 활동이 없어 자동으로 로그아웃되었습니다.`,
        source: "token_expiry_manager",
        dismissible: true,
        persistent: false,
        read: false,
      });
    }

    broadcastLogout();
    navigate("/login");
  }, [
    logout,
    addNotification,
    navigate,
    settings.idleTimeoutMinutes,
    broadcastLogout,
    sessionNotifEnabled,
  ]);

  useIdleTimeout({
    timeoutMinutes: settings.idleTimeoutMinutes,
    onTimeout: handleIdleTimeout,
    enabled: settings.idleTimeoutEnabled,
  });

  // 경고 비활성화 시 early return (Phase 3 기능은 계속 동작)
  // Idle timeout과 탭 동기화는 경고와 무관하게 동작

  // 자동 갱신 성공 감지
  useEffect(() => {
    if (tokenExpiresAt && lastExpiresAt) {
      const expiresAtMs = new Date(tokenExpiresAt).getTime();
      const lastMs = new Date(lastExpiresAt).getTime();

      // tokenExpiresAt이 미래로 변경됨 = 자동 갱신 성공
      if (expiresAtMs > lastMs + 1000) {
        // 경고 해제
        removeNotification("session-warning");

        if (sessionNotifEnabled) {
          // 성공 알림 (선택적 - info로 표시)
          addNotification({
            id: `session-auto-refreshed-${Date.now()}`,
            timestamp: new Date().toISOString(),
            severity: "info",
            category: "session",
            title: "세션 자동 연장됨",
            message: "세션이 자동으로 연장되었습니다.",
            source: "token_expiry_manager",
            dismissible: true,
            persistent: false,
            read: false,
          });
        }
      }
    }

    setLastExpiresAt(tokenExpiresAt);
  }, [tokenExpiresAt, lastExpiresAt, removeNotification, addNotification]);

  // Phase 3: 자동 연장 (활동 감지 시)
  useEffect(() => {
    if (!settings.autoExtendEnabled || autoExtendTriggered.current) {
      return;
    }

    if (!tokenExpiresAt) return;

    const now = Date.now();
    const expiresAtMs = new Date(tokenExpiresAt).getTime();
    const timeUntilExpiry = Math.floor((expiresAtMs - now) / 1000);
    const autoExtendThreshold = settings.autoExtendThresholdMinutes * 60;

    // 자동 연장 임계값 도달 && 최근 5초 이내 활동 감지
    const timeSinceActivity = Math.floor((now - lastActivityTime) / 1000);
    if (timeUntilExpiry <= autoExtendThreshold && timeSinceActivity < 5) {
      autoExtendTriggered.current = true;

      refreshToken()
        .then(() => {
          removeNotification("session-warning");
          broadcastTokenRefresh({ autoExtend: true });

          if (sessionNotifEnabled) {
            addNotification({
              id: `session-auto-extended-${Date.now()}`,
              timestamp: new Date().toISOString(),
              severity: "info",
              category: "session",
              title: "활동 감지로 세션 자동 연장",
              message: "사용자 활동이 감지되어 세션이 자동으로 연장되었습니다.",
              source: "token_expiry_manager",
              dismissible: true,
              persistent: false,
              read: false,
            });
          }

          // 다음 자동 연장을 위해 플래그 리셋
          setTimeout(() => {
            autoExtendTriggered.current = false;
          }, 60000); // 1분 후 다시 자동 연장 가능
        })
        .catch((error) => {
          console.error("[TokenExpiryManager] Auto extend failed:", error);
          autoExtendTriggered.current = false;
        });
    }
  }, [
    settings.autoExtendEnabled,
    settings.autoExtendThresholdMinutes,
    tokenExpiresAt,
    lastActivityTime,
    refreshToken,
    removeNotification,
    addNotification,
    broadcastTokenRefresh,
  ]);

  // tokenExpiresAt 변경 시 초기 마운트 플래그 해제
  useEffect(() => {
    if (tokenExpiresAt) {
      isInitialMount.current = false;
    } else {
      // 로그아웃 시 플래그 리셋 (다음 로그인을 위해)
      isInitialMount.current = true;
      isLoggedOut.current = false;
    }
  }, [tokenExpiresAt]);

  // 만료 시 자동 로그아웃 + 알림
  useEffect(() => {
    // 초기 마운트 시에는 skip (이전 세션의 만료된 토큰으로 인한 오작동 방지)
    if (isInitialMount.current) {
      return;
    }

    if (isExpired && !isLoggedOut.current) {
      isLoggedOut.current = true;

      // 로그아웃 실행
      logout();

      // 경고 알림 제거
      removeNotification("session-warning");

      if (sessionNotifEnabled) {
        // 만료 알림 표시
        addNotification({
          id: "session-expired",
          timestamp: new Date().toISOString(),
          severity: "error",
          category: "session",
          title: "세션 만료",
          message:
            "로그인이 만료되어 자동으로 로그아웃되었습니다. 다시 로그인해주세요.",
          source: "token_expiry_manager",
          dismissible: true,
          persistent: false,
          read: false,
        });
      }

      // 탭 동기화: 다른 탭에도 로그아웃 브로드캐스트
      broadcastLogout();

      // 로그인 페이지로 리다이렉트
      navigate("/login");
    }
  }, [
    isExpired,
    logout,
    removeNotification,
    addNotification,
    navigate,
    broadcastLogout,
    tokenExpiresAt,
    timeLeft,
  ]);

  // 경고 알림 표시
  useEffect(() => {
    if (!settings.warningEnabled || !sessionNotifEnabled) return;

    if (shouldShowWarning && !isExpired) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;

      // 세션 연장 핸들러
      const handleExtendSession = async () => {
        try {
          await extendSession();

          // 경고 알림 제거
          removeNotification("session-warning");

          // 탭 동기화: 다른 탭에도 브로드캐스트
          broadcastSessionExtend({ manual: true });

          // 성공 알림
          addNotification({
            id: `session-extended-${Date.now()}`,
            timestamp: new Date().toISOString(),
            severity: "success",
            category: "session",
            title: "세션 연장됨",
            message: "세션이 성공적으로 연장되었습니다.",
            source: "token_expiry_manager",
            dismissible: true,
            persistent: false,
            read: false,
          });
        } catch (error) {
          // 실패 알림
          addNotification({
            id: `session-extend-failed-${Date.now()}`,
            timestamp: new Date().toISOString(),
            severity: "error",
            category: "session",
            title: "세션 연장 실패",
            message: "세션을 연장할 수 없습니다. 다시 로그인해주세요.",
            source: "token_expiry_manager",
            dismissible: true,
            persistent: false,
            read: false,
          });
        }
      };

      // 스누즈 핸들러
      const handleSnooze = () => {
        snoozeWarning();
        removeNotification("session-warning");
      };

      // 경고 알림 추가 (기존 알림 덮어쓰기)
      removeNotification("session-warning");
      addNotification({
        id: "session-warning",
        timestamp: new Date().toISOString(),
        severity: "warning",
        category: "session",
        title: "세션 만료 예정",
        message: `${minutes}분 ${seconds}초 후 자동으로 로그아웃됩니다.`,
        source: "token_expiry_manager",
        actions: [
          {
            label: "세션 연장",
            action: "extend_session",
          },
          {
            label: "나중에 알림",
            action: "snooze_warning",
          },
        ],
        dismissible: true,
        persistent: false,
        read: false,
      });

      // 액션 핸들러 매핑 (NotificationToast에서 사용)
      (window as any).__notificationActionHandlers = {
        extend_session: handleExtendSession,
        snooze_warning: handleSnooze,
      };
    }
  }, [
    settings.warningEnabled,
    sessionNotifEnabled,
    shouldShowWarning,
    timeLeft,
    isExpired,
    extendSession,
    snoozeWarning,
    removeNotification,
    addNotification,
    broadcastSessionExtend,
  ]);

  // UI 없음, 로직만
  return null;
}
