/**
 * ProviderCard Component
 *
 * Provider 카드 (Slack/Teams 정보 표시)
 */

import {
  Edit2,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  Link,
} from "lucide-react";
import { ProviderResponse } from "@/lib/api/providers";

interface ProviderCardProps {
  provider: ProviderResponse;
  onEdit: (provider: ProviderResponse) => void;
  onDelete: (provider: ProviderResponse) => void;
  onTest: (provider: ProviderResponse) => void;
  onToggleEnabled?: (provider: ProviderResponse) => void;
  isTesting?: boolean;
  isToggling?: boolean;
  featureCatalogCount?: number;
  readOnly?: boolean;
}

export function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onTest,
  onToggleEnabled,
  isTesting = false,
  isToggling = false,
  featureCatalogCount,
  readOnly,
}: ProviderCardProps) {
  const platformLabel = provider.platform === "slack" ? "Slack" : "Teams";
  const platformColor =
    provider.platform === "slack" ? "text-purple-500" : "text-blue-500";

  const enabledFeaturesCount = provider.enabled_features?.length ?? null;
  const allFeaturesActive = enabledFeaturesCount === null;

  return (
    <div className="p-6 bg-surface-card border border-line rounded-lg hover:border-brand-500/30 transition-colors">
      <div className="flex items-start justify-between">
        {/* Provider 정보 */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-lg font-semibold text-content-primary">
              {provider.name}
            </h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${platformColor} bg-opacity-10`}
            >
              {platformLabel}
            </span>
            {/* 설정 상태 */}
            {provider.is_valid ? (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 rounded">
                <CheckCircle className="w-3 h-3" />
                설정 완료
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
                <XCircle className="w-3 h-3" />
                설정 오류
              </span>
            )}
            {/* 브리지 연결 상태 */}
            {provider.is_connected ? (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded">
                <Link className="w-3 h-3" />
                브리지 연결됨
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-content-tertiary bg-surface-hover rounded">
                브리지 대기중
              </span>
            )}
            <button
              onClick={() => onToggleEnabled?.(provider)}
              disabled={readOnly || isToggling}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                provider.enabled
                  ? "bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20"
                  : "bg-status-danger/10 text-status-danger border border-status-danger/20 hover:bg-status-danger/20"
              } disabled:opacity-50`}
              title={provider.enabled ? "클릭하여 비활성화" : "클릭하여 활성화"}
            >
              {isToggling ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span
                  className={`inline-block w-2 h-2 rounded-full ${provider.enabled ? "bg-status-success" : "bg-status-danger"}`}
                />
              )}
              {provider.enabled ? "활성" : "비활성"}
            </button>
          </div>

          {/* 플랫폼별 정보 */}
          <div className="space-y-2 text-sm">
            {provider.platform === "slack" && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-24">Bot Token:</span>
                  <code className="text-content-secondary font-mono text-xs">
                    {provider.token || "미설정"}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-24">App Token:</span>
                  <code className="text-content-secondary font-mono text-xs">
                    {provider.app_token || "미설정"}
                  </code>
                </div>
              </>
            )}

            {provider.platform === "teams" && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-24">Tenant ID:</span>
                  <code className="text-content-secondary font-mono text-xs">
                    {provider.tenant_id || "미설정"}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-24">App ID:</span>
                  <code className="text-content-secondary font-mono text-xs">
                    {provider.app_id || "미설정"}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-content-tertiary w-24">Team ID:</span>
                  <code className="text-content-secondary font-mono text-xs">
                    {provider.team_id || "미설정"}
                  </code>
                </div>
                {provider.has_delegated_auth && (
                  <div className="flex items-center gap-2">
                    <span className="text-content-tertiary w-24">MS Auth:</span>
                    <span className="flex items-center gap-1 text-xs text-blue-500">
                      <Link className="w-3 h-3" />
                      {provider.ms_user_id || "연결됨"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 활성화된 기능 */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-content-tertiary">기능:</span>
            {allFeaturesActive ? (
              <span className="text-xs px-2 py-0.5 bg-brand-500/10 text-brand-500 rounded">
                전체 활성화
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-surface-hover text-content-secondary rounded">
                {enabledFeaturesCount}
                {featureCatalogCount ? `/${featureCatalogCount}` : ""}개 선택
              </span>
            )}
          </div>

          {/* 검증 상태 */}
          {!provider.is_valid && provider.validation_errors && (
            <div className="mt-3 p-2 bg-status-error/10 border border-status-error/20 rounded text-xs text-status-error">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {Array.isArray(provider.validation_errors)
                    ? provider.validation_errors.map((err, idx) => (
                        <div key={idx}>
                          <strong>{err.field}:</strong> {err.message}
                        </div>
                      ))
                    : typeof provider.validation_errors === "string"
                      ? provider.validation_errors
                      : "검증 오류"}
                </div>
              </div>
            </div>
          )}

          {/* 생성일 */}
          <div className="mt-3 text-xs text-content-tertiary">
            생성일:{" "}
            {new Date(provider.created_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onTest(provider)}
            disabled={isTesting || !provider.enabled}
            className="p-2 hover:bg-surface-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="연결 테스트"
          >
            <TestTube className="w-4 h-4 text-content-secondary" />
          </button>
          <button
            onClick={() => onEdit(provider)}
            disabled={readOnly}
            className="p-2 hover:bg-surface-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="수정"
          >
            <Edit2 className="w-4 h-4 text-content-secondary" />
          </button>
          <button
            onClick={() => onDelete(provider)}
            disabled={readOnly}
            className="p-2 hover:bg-status-error/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="삭제"
          >
            <Trash2 className="w-4 h-4 text-status-error" />
          </button>
        </div>
      </div>
    </div>
  );
}
