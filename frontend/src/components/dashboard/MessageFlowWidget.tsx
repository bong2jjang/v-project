/**
 * MessageFlowWidget Component
 *
 * 메시지 흐름을 시각적으로 표시하는 위젯
 */

import { useState, useEffect } from "react";
import { Card, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { getMessageStats } from "../../lib/api/messages";
import type { MessageStats } from "../../lib/api/messages";
import { Loader2, GitBranch, RefreshCw, ArrowRight } from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";

interface FlowItem {
  source: string;
  destination: string;
  count: number;
}

export const MessageFlowWidget = () => {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      const now = new Date();
      const from_date = new Date(now);
      from_date.setHours(now.getHours() - 24); // 최근 24시간

      const data = await getMessageStats({
        from_date: from_date.toISOString(),
        to_date: now.toISOString(),
      });

      setStats(data);
    } catch (err: any) {
      setError(err.message || "메시지 흐름 데이터를 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  // 방향별 흐름 데이터 생성 (by_direction 우선, fallback: by_gateway)
  const flowItems: FlowItem[] = stats
    ? Object.entries(stats.by_direction ?? stats.by_gateway)
        .sort(([, a], [, b]) => b - a) // 메시지 수 내림차순
        .slice(0, 5)
        .map(([key, count]) => {
          // by_direction: "slack→teams" 형태 파싱
          const parts = key.split("→");
          if (parts.length === 2) {
            return {
              source: formatPlatformName(parts[0]),
              destination: formatPlatformName(parts[1]),
              count,
            };
          }
          // by_gateway fallback
          return { source: key, destination: "", count };
        })
    : [];

  const maxCount = Math.max(...flowItems.map((item) => item.count), 1);

  return (
    <Card>
      <CardBody>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <GitBranch className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-heading-md font-semibold text-content-primary">
                  메시지 흐름
                </h3>
                <InfoTooltip
                  title="메시지 흐름"
                  description="최근 24시간 동안 플랫폼 간(Slack → Teams, Teams → Slack) 방향별 메시지 처리량을 막대 그래프로 보여줍니다. 상위 5개 방향이 표시됩니다."
                  hint="두 방향의 비율이 비슷하면 양방향 브리지가 균형 있게 사용되고 있습니다."
                  side="bottom"
                />
              </div>
              <p className="text-body-sm text-content-tertiary">
                최근 24시간 Route별 메시지 흐름
              </p>
            </div>
          </div>

          {/* 새로고침 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchStats()}
            disabled={isLoading}
            className="p-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {/* 콘텐츠 */}
        {error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-body text-content-error mb-2">
                데이터를 불러오는데 실패했습니다
              </p>
              <p className="text-body-sm text-content-tertiary mb-4">{error}</p>
              <Button
                onClick={() => fetchStats()}
                variant="secondary"
                size="sm"
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : isLoading && !stats ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-content-tertiary" />
          </div>
        ) : flowItems.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-body text-content-tertiary">
                표시할 메시지 흐름이 없습니다
              </p>
              <p className="text-body-sm text-content-tertiary mt-1">
                메시지가 전송되면 여기에 흐름이 표시됩니다
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {flowItems.map((item, index) => {
              // 메시지 수에 따른 너비 계산 (최소 20%, 최대 100%)
              const widthPercent = Math.max(20, (item.count / maxCount) * 100);

              return (
                <div key={index} className="space-y-2">
                  {/* Gateway 이름 및 메시지 수 */}
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm font-medium text-content-primary">
                      {item.source}
                    </span>
                    <span className="text-body-sm text-content-secondary">
                      {item.count.toLocaleString()} 메시지
                    </span>
                  </div>

                  {/* 흐름 시각화 바 */}
                  <div className="relative h-12 bg-surface-secondary rounded-lg overflow-hidden">
                    {/* 진행 바 */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />

                    {/* 내용 */}
                    <div className="relative h-full flex items-center justify-between px-4">
                      <div className="flex items-center gap-3 text-content-primary mix-blend-difference">
                        <div className="w-2 h-2 rounded-full bg-current" />
                        <span className="text-body-sm font-medium">
                          {item.source}
                        </span>
                      </div>

                      {item.destination && (
                        <>
                          <ArrowRight className="w-5 h-5 text-content-primary mix-blend-difference" />
                          <div className="flex items-center gap-3 text-content-primary mix-blend-difference">
                            <span className="text-body-sm font-medium">
                              {item.destination}
                            </span>
                            <div className="w-2 h-2 rounded-full bg-current" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 총계 */}
            {stats && (
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-body font-medium text-content-secondary">
                    총 메시지
                  </span>
                  <span className="text-heading-sm font-bold text-brand-primary">
                    {stats.total_messages.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

/** 플랫폼 키를 표시용 이름으로 변환 */
function formatPlatformName(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "slack") return "Slack";
  if (trimmed === "teams") return "Teams";
  return raw.trim();
}
