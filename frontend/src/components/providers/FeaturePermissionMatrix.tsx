/**
 * FeaturePermissionMatrix Component
 *
 * 연결 테스트 결과로 반환된 기능별 권한 상태를 표시하는 매트릭스 UI
 */

import {
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  MinusCircle,
} from "lucide-react";
import { FeaturePermissionStatus, PermissionStatus } from "@/lib/api/providers";

interface FeaturePermissionMatrixProps {
  permissions: FeaturePermissionStatus[];
  categoryLabels?: Record<string, string>;
}

const STATUS_CONFIG: Record<
  PermissionStatus,
  { icon: React.ReactNode; label: string; className: string }
> = {
  granted: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: "권한 있음",
    className: "text-status-success",
  },
  missing: {
    icon: <XCircle className="w-4 h-4" />,
    label: "권한 없음",
    className: "text-status-error",
  },
  partial: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: "일부 권한",
    className: "text-amber-500",
  },
  unknown: {
    icon: <HelpCircle className="w-4 h-4" />,
    label: "확인 불가",
    className: "text-content-tertiary",
  },
  not_applicable: {
    icon: <MinusCircle className="w-4 h-4" />,
    label: "미지원",
    className: "text-content-tertiary",
  },
};

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  messaging: "메시징",
  file: "파일",
  social: "소셜",
  channel: "채널 관리",
};

export function FeaturePermissionMatrix({
  permissions,
  categoryLabels = DEFAULT_CATEGORY_LABELS,
}: FeaturePermissionMatrixProps) {
  if (!permissions || permissions.length === 0) return null;

  // not_applicable 제외하고 카테고리별 그룹핑
  const visible = permissions.filter((p) => p.status !== "not_applicable");

  const categories = [...new Set(visible.map((p) => p.category))];
  const grouped: Record<string, FeaturePermissionStatus[]> = {};
  for (const cat of categories) {
    grouped[cat] = visible.filter((p) => p.category === cat);
  }

  // 요약 통계
  const granted = permissions.filter((p) => p.status === "granted").length;
  const missing = permissions.filter((p) => p.status === "missing").length;
  const partial = permissions.filter((p) => p.status === "partial").length;

  return (
    <div className="space-y-2.5">
      {/* 요약 배지 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-content-secondary">
          기능 권한:
        </span>
        {granted > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-status-success/10 text-status-success">
            <CheckCircle className="w-3 h-3" />
            {granted}개 정상
          </span>
        )}
        {partial > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
            <AlertCircle className="w-3 h-3" />
            {partial}개 일부
          </span>
        )}
        {missing > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-status-error/10 text-status-error">
            <XCircle className="w-3 h-3" />
            {missing}개 누락
          </span>
        )}
      </div>

      {/* 카테고리별 상세 — 2열 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((cat) => {
          const catItems = grouped[cat];
          if (!catItems || catItems.length === 0) return null;

          return (
            <div key={cat}>
              <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wide mb-1 px-1">
                {categoryLabels[cat] || cat}
              </div>
              <div className="space-y-0.5">
                {catItems.map((item) => {
                  const config = STATUS_CONFIG[item.status];
                  const hasMissing =
                    item.missing_scopes && item.missing_scopes.length > 0;
                  return (
                    <div
                      key={item.feature_id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-base group"
                    >
                      <span className={`flex-shrink-0 ${config.className}`}>
                        {config.icon}
                      </span>
                      <span className="text-xs text-content-primary truncate">
                        {item.feature_name}
                      </span>
                      {item.note && (
                        <span
                          className="ml-auto text-xs text-content-tertiary truncate max-w-[40%] text-right"
                          title={item.note}
                        >
                          {item.note}
                        </span>
                      )}
                      {hasMissing && (
                        <span
                          className="ml-auto text-xs font-mono text-status-error truncate max-w-[40%] text-right"
                          title={item.missing_scopes!.join(", ")}
                        >
                          {item.missing_scopes!.join(", ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
