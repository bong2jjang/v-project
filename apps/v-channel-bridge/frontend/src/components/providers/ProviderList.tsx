/**
 * ProviderList Component
 *
 * Provider 목록 및 관리 (CRUD + 테스트)
 */

import { useEffect, useState } from "react";
import { Plus, RefreshCw, AlertCircle } from "lucide-react";
import { useProvidersStore } from "@/store/providers";
import { ProviderResponse } from "@/lib/api/providers";
import { Button } from "../ui/Button";
import { Skeleton, SkeletonProviderCard } from "../ui/Skeleton";
import { ProviderCard } from "./ProviderCard";
import { FeaturePermissionMatrix } from "./FeaturePermissionMatrix";

interface ProviderListProps {
  onAddProvider: () => void;
  onEditProvider: (provider: ProviderResponse) => void;
  readOnly?: boolean;
}

export function ProviderList({
  onAddProvider,
  onEditProvider,
  readOnly,
}: ProviderListProps) {
  const {
    providers,
    isLoading,
    isTesting,
    error,
    testResult,
    featureCatalog,
    categoryLabels,
    fetchProviders,
    fetchFeatureCatalog,
    deleteProvider,
    updateProvider,
    testConnection,
    clearError,
    clearTestResult,
  } = useProvidersStore();

  const [testingId, setTestingId] = useState<number | null>(null);
  const [_testingProviderId, setTestingProviderId] = useState<number | null>(
    null,
  );
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchFeatureCatalog();
  }, [fetchProviders, fetchFeatureCatalog]);

  const handleDelete = async (provider: ProviderResponse) => {
    if (
      !confirm(
        `Provider "${provider.name}"를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }

    try {
      await deleteProvider(provider.id);
    } catch (error) {
      // 에러는 store에서 처리
    }
  };

  const handleTest = async (provider: ProviderResponse) => {
    setTestingId(provider.id);
    setTestingProviderId(provider.id);
    clearTestResult();

    try {
      await testConnection(provider.id);
    } catch (error) {
      // 에러는 store에서 처리
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnabled = async (provider: ProviderResponse) => {
    setTogglingId(provider.id);
    try {
      await updateProvider(provider.id, { enabled: !provider.enabled });
    } catch (error) {
      // 에러는 store에서 처리
    } finally {
      setTogglingId(null);
    }
  };

  // 카탈로그에서 플랫폼별 기능 수 계산
  const getCatalogCountForPlatform = (platform: "slack" | "teams") => {
    if (!featureCatalog) return undefined;
    return featureCatalog.filter(
      (f) => f.platform_support[platform] !== undefined,
    ).length;
  };

  if (isLoading && providers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <SkeletonProviderCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-heading-md text-content-primary mb-1">
            플랫폼 연동
          </h3>
          <p className="text-body-sm text-content-secondary">
            Slack 및 Teams 연동 설정 관리
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => fetchProviders()}>
            <RefreshCw
              className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">새로고침</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onAddProvider}
            disabled={readOnly}
          >
            <Plus className="w-4 h-4 mr-1" />
            플랫폼 연동
          </Button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-status-error">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-status-error hover:text-status-error/80 text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 테스트 결과 */}
      {testResult && (
        <div
          className={`p-4 border rounded-lg ${
            testResult.success
              ? "bg-status-success/10 border-status-success/20"
              : "bg-status-error/10 border-status-error/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                testResult.success ? "text-status-success" : "text-status-error"
              }`}
            />
            <div className="flex-1 space-y-3">
              <p
                className={`text-sm font-medium ${
                  testResult.success
                    ? "text-status-success"
                    : "text-status-error"
                }`}
              >
                {testResult.message}
              </p>

              {/* 기능 권한 매트릭스 */}
              {testResult.feature_permissions &&
                testResult.feature_permissions.length > 0 && (
                  <div className="bg-surface-card border border-line rounded-lg p-3">
                    <FeaturePermissionMatrix
                      permissions={testResult.feature_permissions}
                      categoryLabels={categoryLabels}
                    />
                  </div>
                )}

              {/* 상세 정보 */}
              {testResult.details && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-content-secondary hover:text-content-primary">
                    상세 정보 보기
                  </summary>
                  <pre className="mt-2 text-xs text-content-secondary font-mono overflow-auto p-2 bg-surface-elevated rounded max-h-40">
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <button
              onClick={() => {
                clearTestResult();
                setTestingProviderId(null);
              }}
              className={`text-sm flex-shrink-0 ${
                testResult.success
                  ? "text-status-success hover:text-status-success/80"
                  : "text-status-error hover:text-status-error/80"
              }`}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Provider 목록 */}
      {providers.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-line rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
              <Plus className="w-6 h-6 text-content-tertiary" />
            </div>
            <div>
              <p className="text-content-primary font-medium">
                연동된 플랫폼이 없습니다
              </p>
              <p className="text-sm text-content-secondary mt-1">
                Slack 또는 Teams와 플랫폼 연동을 설정하세요
              </p>
            </div>
            <button
              onClick={onAddProvider}
              disabled={readOnly}
              className="mt-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-button transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              플랫폼 연동
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={onEditProvider}
              onDelete={handleDelete}
              onTest={handleTest}
              onToggleEnabled={handleToggleEnabled}
              isTesting={testingId === provider.id && isTesting}
              isToggling={togglingId === provider.id}
              featureCatalogCount={getCatalogCountForPlatform(
                provider.platform,
              )}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
