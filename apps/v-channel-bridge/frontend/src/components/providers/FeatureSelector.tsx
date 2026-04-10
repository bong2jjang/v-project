/**
 * FeatureSelector Component
 *
 * Provider에서 활성화할 기능을 카테고리별로 선택하는 UI
 * - Core 기능은 항상 활성화 (비활성화 불가)
 * - 플랫폼 미지원 기능은 비활성화 표시
 * - null = 전체 활성화
 */

import { FeatureCatalogItem } from "@/lib/api/providers";
import { Info, Lock } from "lucide-react";

interface FeatureSelectorProps {
  platform: "slack" | "teams";
  features: FeatureCatalogItem[];
  categoryLabels: Record<string, string>;
  /** null = 전체 선택 (기본값), string[] = 선택된 기능 ID 목록 */
  selectedFeatures: string[] | null;
  onChange: (features: string[] | null) => void;
  disabled?: boolean;
}

export function FeatureSelector({
  platform,
  features,
  categoryLabels,
  selectedFeatures,
  onChange,
  disabled,
}: FeatureSelectorProps) {
  // 플랫폼이 지원하는 기능만 표시
  const platformFeatures = features.filter((f) => {
    const support = f.platform_support[platform];
    return support !== undefined;
  });

  // 카테고리별 그룹핑
  const categories = Object.keys(categoryLabels);
  const grouped: Record<string, FeatureCatalogItem[]> = {};
  for (const cat of categories) {
    grouped[cat] = platformFeatures.filter((f) => f.category === cat);
  }

  // selectedFeatures = null → 전체 선택
  const isAllSelected = selectedFeatures === null;

  const isFeatureSelected = (featureId: string): boolean => {
    if (isAllSelected) return true;
    return selectedFeatures!.includes(featureId);
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      // 전체 선택 → 핵심 기능만 선택
      const coreIds = platformFeatures
        .filter((f) => f.is_core)
        .map((f) => f.id);
      onChange(coreIds);
    } else {
      // 개별 선택 → 전체 선택 (null)
      onChange(null);
    }
  };

  const handleToggleFeature = (featureId: string, isCore: boolean) => {
    if (isCore) return; // 핵심 기능은 토글 불가

    const support = features.find((f) => f.id === featureId)?.platform_support[
      platform
    ];
    if (!support?.supported) return; // 미지원 기능은 토글 불가

    // 현재 선택 상태 계산
    const current = isAllSelected
      ? platformFeatures.map((f) => f.id)
      : [...(selectedFeatures ?? [])];

    if (current.includes(featureId)) {
      const next = current.filter((id) => id !== featureId);
      // 전체 선택 상태와 동일하면 null로 변환
      const allIds = platformFeatures.map((f) => f.id);
      onChange(
        next.length === allIds.length && allIds.every((id) => next.includes(id))
          ? null
          : next,
      );
    } else {
      const next = [...current, featureId];
      const allIds = platformFeatures.map((f) => f.id);
      onChange(
        next.length === allIds.length && allIds.every((id) => next.includes(id))
          ? null
          : next,
      );
    }
  };

  const selectedCount = isAllSelected
    ? platformFeatures.length
    : (selectedFeatures?.length ?? 0);

  return (
    <div className="space-y-3">
      {/* 헤더: 전체 선택 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-content-primary">
            기능 선택
          </span>
          <span className="text-xs text-content-tertiary">
            ({selectedCount}/{platformFeatures.length}개 활성화)
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggleAll}
          disabled={disabled}
          className="text-xs text-brand-500 hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAllSelected ? "개별 설정" : "전체 활성화"}
        </button>
      </div>

      {/* 카테고리별 기능 목록 */}
      {categories.map((cat) => {
        const catFeatures = grouped[cat];
        if (!catFeatures || catFeatures.length === 0) return null;

        return (
          <div key={cat} className="space-y-1">
            <div className="text-xs font-semibold text-content-tertiary uppercase tracking-wide px-1">
              {categoryLabels[cat] || cat}
            </div>
            <div className="space-y-1">
              {catFeatures.map((feature) => {
                const support = feature.platform_support[platform];
                const isSupported = support?.supported ?? false;
                const isCore = feature.is_core;
                const isSelected = isFeatureSelected(feature.id);
                const isDisabled = disabled || isCore || !isSupported;

                return (
                  <label
                    key={feature.id}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isCore ? (
                        <div
                          className="w-4 h-4 flex items-center justify-center"
                          title="핵심 기능 (비활성화 불가)"
                        >
                          <Lock className="w-3.5 h-3.5 text-brand-500" />
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() =>
                            handleToggleFeature(feature.id, isCore)
                          }
                          className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500 disabled:opacity-50"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-content-primary">
                          {feature.name}
                        </span>
                        {isCore && (
                          <span className="text-xs px-1.5 py-0.5 bg-brand-500/10 text-brand-500 rounded">
                            핵심
                          </span>
                        )}
                        {!isSupported && (
                          <span className="text-xs px-1.5 py-0.5 bg-surface-hover text-content-tertiary rounded">
                            미지원
                          </span>
                        )}
                        {isSupported && !support?.implemented && (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded">
                            개발중
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-content-tertiary mt-0.5">
                        {!isSupported && support?.reason
                          ? support.reason
                          : feature.description}
                      </p>
                    </div>
                    {isSupported &&
                      support?.required_scopes &&
                      support.required_scopes.length > 0 && (
                        <div
                          className="flex-shrink-0 mt-0.5"
                          title={`필요 권한: ${support.required_scopes.join(", ")}`}
                        >
                          <Info className="w-3.5 h-3.5 text-content-tertiary" />
                        </div>
                      )}
                    {isSupported &&
                      support?.required_permissions &&
                      support.required_permissions.length > 0 && (
                        <div
                          className="flex-shrink-0 mt-0.5"
                          title={`필요 권한: ${support.required_permissions.join(", ")}`}
                        >
                          <Info className="w-3.5 h-3.5 text-content-tertiary" />
                        </div>
                      )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
