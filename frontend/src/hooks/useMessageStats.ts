/**
 * useMessageStats Hook
 *
 * 메시지 통계 데이터를 실시간으로 가져오는 hook
 */

import { useState, useEffect } from "react";
import { getMessageStats, type MessageStats } from "../lib/api/messages";

export type TimeRange = "1h" | "6h" | "24h";

export const useMessageStats = (
  timeRange: TimeRange,
  refreshInterval = 30000,
) => {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      const now = new Date();
      const from_date = new Date(now);

      // 시간 범위에 따라 from_date 설정
      switch (timeRange) {
        case "1h":
          from_date.setHours(now.getHours() - 1);
          break;
        case "6h":
          from_date.setHours(now.getHours() - 6);
          break;
        case "24h":
          from_date.setHours(now.getHours() - 24);
          break;
      }

      const data = await getMessageStats({
        from_date: from_date.toISOString(),
        to_date: now.toISOString(),
      });

      setStats(data);
    } catch (err: any) {
      setError(err.message || "메시지 통계를 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 초기 로드
    fetchStats();

    // 주기적 갱신
    const interval = setInterval(fetchStats, refreshInterval);

    return () => clearInterval(interval);
  }, [timeRange, refreshInterval]);

  return { stats, isLoading, error, refetch: fetchStats };
};
