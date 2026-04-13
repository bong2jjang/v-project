/**
 * 모니터링 서비스 관리 페이지
 */

import { useState } from "react";
import { RefreshCw, Filter, CheckCircle2, Clock } from "lucide-react";
import { ContentHeader } from "@/components/layout/ContentHeader";
import { MonitoringServiceCard } from "@/components/monitoring/MonitoringServiceCard";
import { Modal } from "@/components/ui/Modal";
import { useMonitoringHealth } from "@/hooks/useMonitoringHealth";
import { usageGuides } from "@/data/monitoringServices";
import type { ServiceCategory, ServiceStatus } from "@/types/monitoring";

export default function Monitoring() {
  const {
    services,
    isLoading,
    checkingIds,
    lastCheckedAt,
    error,
    refreshHealth,
  } = useMonitoringHealth();
  const [categoryFilter, setCategoryFilter] = useState<"all" | ServiceCategory>(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>(
    "all",
  );
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // 필터링된 서비스
  const filteredServices = services.filter((service) => {
    if (categoryFilter !== "all" && service.category !== categoryFilter)
      return false;
    if (statusFilter !== "all" && service.status !== statusFilter) return false;
    return true;
  });

  // 전체 체크 현황
  const totalCount = services.length;
  const doneCount = totalCount - checkingIds.size;
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const errorCount = services.filter((s) => s.status === "error").length;

  const formatLastChecked = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const selectedGuide = selectedGuideId
    ? usageGuides.find((g) => g.serviceId === selectedGuideId)
    : null;

  const handleShowGuide = (serviceId: string) => {
    setSelectedGuideId(serviceId);
    setIsGuideModalOpen(true);
  };

  const handleCloseGuide = () => {
    setIsGuideModalOpen(false);
    setSelectedGuideId(null);
  };

  return (
    <>
      <ContentHeader
        title="모니터링 서비스"
        description="시스템 모니터링 도구 및 서비스 관리"
      />

      <div className="page-container space-y-section-gap">
        {/* 에러 표시 */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* 필터 및 새로고침 */}
        <div className="bg-surface-card border border-stroke-default rounded-lg p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 카테고리 필터 */}
            <div className="flex-1">
              <label className="flex items-center gap-2 text-sm font-medium text-content-primary mb-2">
                <Filter className="w-4 h-4" />
                카테고리
              </label>
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as "all" | ServiceCategory)
                }
                className="w-full px-3 py-2 bg-surface-base border border-stroke-default rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">전체</option>
                <option value="metrics">메트릭</option>
                <option value="logs">로그</option>
                <option value="visualization">시각화</option>
                <option value="container">컨테이너</option>
              </select>
            </div>

            {/* 상태 필터 */}
            <div className="flex-1">
              <label className="flex items-center gap-2 text-sm font-medium text-content-primary mb-2">
                <Filter className="w-4 h-4" />
                상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | ServiceStatus)
                }
                className="w-full px-3 py-2 bg-surface-base border border-stroke-default rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">전체</option>
                <option value="healthy">정상</option>
                <option value="warning">경고</option>
                <option value="error">오류</option>
                <option value="unknown">알 수 없음</option>
              </select>
            </div>

            {/* 새로고침 버튼 */}
            <div className="flex items-end w-full md:w-auto">
              <button
                onClick={refreshHealth}
                disabled={isLoading}
                className="w-full md:w-auto px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                {isLoading ? "확인 중..." : "새로고침"}
              </button>
            </div>
          </div>

          {/* 체크 진행 현황 바 */}
          {isLoading && (
            <div className="space-y-2">
              {/* 진행 바 */}
              <div className="w-full bg-surface-base rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(doneCount / totalCount) * 100}%` }}
                />
              </div>
              {/* 서비스별 현황 칩 */}
              <div className="flex flex-wrap gap-2">
                {services.map((service) => {
                  const checking = checkingIds.has(service.id);
                  return (
                    <span
                      key={service.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        checking
                          ? "bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-800"
                          : service.status === "healthy"
                            ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                            : service.status === "error"
                              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                              : "bg-surface-base text-content-secondary border-stroke-default"
                      }`}
                    >
                      {checking ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {service.name}
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-content-tertiary">
                {doneCount} / {totalCount} 완료
              </p>
            </div>
          )}

          {/* 결과 요약 (체크 완료 후) */}
          {!isLoading && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-content-secondary">
                  {filteredServices.length}개 표시
                </span>
                {healthyCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    정상 {healthyCount}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    오류 {errorCount}
                  </span>
                )}
              </div>
              {lastCheckedAt && (
                <span className="flex items-center gap-1 text-xs text-content-tertiary">
                  <Clock className="w-3 h-3" />
                  마지막 확인: {formatLastChecked(lastCheckedAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 서비스 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => (
            <MonitoringServiceCard
              key={service.id}
              service={service}
              isChecking={checkingIds.has(service.id)}
              onShowGuide={handleShowGuide}
            />
          ))}
        </div>

        {/* 빈 결과 */}
        {filteredServices.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-surface-card border border-stroke-default rounded-lg">
            <p className="text-content-secondary">
              필터 조건에 맞는 서비스가 없습니다
            </p>
          </div>
        )}

        {/* 사용 가이드 모달 */}
        <Modal
          isOpen={isGuideModalOpen}
          onClose={handleCloseGuide}
          title={selectedGuide ? selectedGuide.title : "사용 가이드"}
          size="lg"
        >
          {selectedGuide && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-content-primary mb-3">
                  사용 방법
                </h3>
                <ol className="space-y-3">
                  {selectedGuide.steps.map((step, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm text-content-secondary"
                    >
                      <span className="flex-shrink-0 w-7 h-7 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="pt-1">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {selectedGuide.queries && selectedGuide.queries.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-content-primary mb-3">
                    유용한 쿼리
                  </h3>
                  <div className="space-y-4">
                    {selectedGuide.queries.map((query, index) => (
                      <div
                        key={index}
                        className="bg-surface-base border border-stroke-default rounded-lg p-4"
                      >
                        <h4 className="text-sm font-medium text-content-primary mb-2">
                          {query.title}
                        </h4>
                        <code className="block bg-surface-elevated text-content-secondary text-xs p-3 rounded-lg mb-2 overflow-x-auto font-mono">
                          {query.query}
                        </code>
                        <p className="text-xs text-content-secondary">
                          {query.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
