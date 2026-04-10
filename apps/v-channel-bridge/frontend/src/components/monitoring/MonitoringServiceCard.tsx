/**
 * 모니터링 서비스 카드 컴포넌트
 */

import { ExternalLink, BookOpen, Clock, Loader2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { MonitoringService } from "@/types/monitoring";

interface MonitoringServiceCardProps {
  service: MonitoringService;
  isChecking?: boolean;
  onShowGuide?: (serviceId: string) => void;
}

export function MonitoringServiceCard({
  service,
  isChecking = false,
  onShowGuide,
}: MonitoringServiceCardProps) {
  const handleOpenService = () => {
    if (service.hasUI) {
      window.open(service.url, "_blank", "noopener,noreferrer");
    }
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      metrics: "메트릭",
      logs: "로그",
      visualization: "시각화",
      container: "컨테이너",
    };
    return labels[category] || category;
  };

  return (
    <div
      className={`bg-surface-card border rounded-card transition-all duration-normal shadow-sm ${
        isChecking
          ? "border-brand-400 dark:border-brand-500 shadow-brand-100 dark:shadow-none"
          : "border-stroke-default hover:border-stroke-hover hover:bg-surface-raised"
      }`}
    >
      {/* 헤더 */}
      <div className="p-5 border-b border-stroke-default">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{service.icon}</span>
            <div>
              <h3 className="text-lg font-semibold text-content-primary">
                {service.name}
              </h3>
              <p className="text-sm text-content-secondary">
                {getCategoryLabel(service.category)}
              </p>
            </div>
          </div>

          {/* 상태 뱃지 — 체크 중엔 스피너 표시 */}
          {isChecking ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
              <Loader2 className="w-3 h-3 animate-spin" />
              확인 중
            </span>
          ) : (
            <StatusBadge status={service.status} />
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="p-5 space-y-4">
        {/* 설명 */}
        <p className="text-sm text-content-secondary">{service.description}</p>

        {/* URL 및 상태 정보 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <span>📍</span>
            <span className="font-mono text-xs break-all">{service.url}</span>
          </div>

          {isChecking ? (
            <div className="flex items-center gap-2 text-sm text-brand-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>응답 대기 중...</span>
            </div>
          ) : (
            <>
              {service.responseTimeMs !== undefined && (
                <div className="flex items-center gap-2 text-sm text-content-secondary">
                  <Clock className="w-4 h-4" />
                  <span>응답: {service.responseTimeMs}ms</span>
                </div>
              )}

              {service.error && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <span>⚠️</span>
                  <span className="break-all">{service.error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 주요 기능 */}
        <div>
          <h4 className="text-sm font-medium text-content-primary mb-2">
            주요 기능
          </h4>
          <ul className="space-y-1">
            {service.features.map((feature, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-content-secondary"
              >
                <span className="text-green-500 dark:text-green-400 mt-0.5">
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="p-5 bg-surface-base border-t border-stroke-default flex gap-3">
        {service.hasUI && (
          <button
            onClick={handleOpenService}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800"
            title="새 탭에서 열기"
          >
            <ExternalLink className="w-4 h-4" />
            대시보드 열기
          </button>
        )}

        {onShowGuide && (
          <button
            onClick={() => onShowGuide(service.id)}
            className={`${service.hasUI ? "" : "flex-1"} px-4 py-2 rounded-lg text-sm font-medium border-2 border-stroke-default bg-surface-card text-content-primary hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-colors flex items-center justify-center gap-2`}
          >
            <BookOpen className="w-4 h-4" />
            사용법
          </button>
        )}
      </div>
    </div>
  );
}
