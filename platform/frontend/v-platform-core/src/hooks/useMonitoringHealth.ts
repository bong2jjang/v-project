/**
 * 모니터링 서비스 Health Check 훅
 *
 * 갱신 시 서비스별로 개별 체크하여 완료되는 순서대로 상태를 업데이트합니다.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { monitoringApi } from "../api/monitoring";
import { monitoringServices } from "../data/monitoringServices";
import type { MonitoringService } from "../types/monitoring";

interface UseMonitoringHealthReturn {
  services: MonitoringService[];
  isLoading: boolean;
  checkingIds: Set<string>;
  lastCheckedAt: Date | null;
  error: string | null;
  refreshHealth: () => Promise<void>;
}

export function useMonitoringHealth(
  autoRefresh = true,
  interval = 30000,
): UseMonitoringHealthReturn {
  const [services, setServices] =
    useState<MonitoringService[]>(monitoringServices);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abortController = new AbortController();
    abortRef.current = abortController;

    setError(null);

    const allIds = new Set(monitoringServices.map((s) => s.id));
    setCheckingIds(allIds);

    const promises = monitoringServices.map(async (service) => {
      try {
        const health = await monitoringApi.checkServiceHealth(service.id);

        if (abortController.signal.aborted) return;

        setServices((prev) =>
          prev.map((s) =>
            s.id === service.id
              ? {
                  ...s,
                  status: health.status,
                  responseTimeMs: health.response_time_ms,
                  error: health.error,
                }
              : s,
          ),
        );
      } catch {
        if (abortController.signal.aborted) return;

        setServices((prev) =>
          prev.map((s) =>
            s.id === service.id
              ? { ...s, status: "error", error: "연결 실패" }
              : s,
          ),
        );
      } finally {
        if (!abortController.signal.aborted) {
          setCheckingIds((prev) => {
            const next = new Set(prev);
            next.delete(service.id);
            return next;
          });
        }
      }
    });

    await Promise.allSettled(promises);

    if (!abortController.signal.aborted) {
      setLastCheckedAt(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();

    if (autoRefresh) {
      const intervalId = setInterval(checkHealth, interval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, interval, checkHealth]);

  return {
    services,
    isLoading: checkingIds.size > 0,
    checkingIds,
    lastCheckedAt,
    error,
    refreshHealth: checkHealth,
  };
}
