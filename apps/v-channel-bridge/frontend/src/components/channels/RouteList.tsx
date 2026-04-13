/**
 * RouteList - Route 목록 표시
 *
 * 라우팅 룰 목록을 카드 형식으로 표시
 */

import { useEffect, useState } from "react";
import { useRoutesStore } from "@/store/routes";
import type { RouteResponse } from "@/lib/api/routes";

/** 채널 ID를 maxLen 이하로 줄여 표시하고, 전체 ID를 툴팁으로 보여주는 컴포넌트 */
function TruncatedId({ id, maxLen = 24 }: { id: string; maxLen?: number }) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  const needsTruncate = id.length > maxLen;
  const display = needsTruncate
    ? `${id.slice(0, Math.floor(maxLen / 2))}...${id.slice(-Math.floor(maxLen / 3))}`
    : id;

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!needsTruncate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ visible: true, x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <>
      <span
        className="text-xs text-content-tertiary font-mono mt-0.5 truncate block cursor-default"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip((p) => ({ ...p, visible: false }))}
      >
        {display}
      </span>
      {tooltip.visible && (
        <div
          className="fixed z-[9999] px-3 py-1.5 text-xs font-mono bg-gray-900 text-white rounded-md shadow-xl break-all max-w-[min(480px,90vw)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {id}
        </div>
      )}
    </>
  );
}

interface RouteListProps {
  onRefresh?: () => void;
  onEdit?: (route: RouteResponse) => void;
  readOnly?: boolean;
}

export function RouteList({ onRefresh, onEdit, readOnly }: RouteListProps) {
  const {
    routes,
    fetchRoutes,
    deleteRoute,
    toggleRoute,
    isLoading,
    error,
    clearError,
  } = useRoutesStore();
  const [deleteConfirm, setDeleteConfirm] = useState<RouteResponse | null>(
    null,
  );
  const [togglingRoute, setTogglingRoute] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case "slack":
        return "Slack";
      case "teams":
        return "Teams";
      default:
        return platform;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "slack":
        return "🟣";
      case "teams":
        return "🔷";
      default:
        return "📡";
    }
  };

  const handleToggle = async (route: RouteResponse) => {
    const target = route.targets[0];
    if (!target) return;

    const routeKey = `${route.source.platform}-${route.source.channel_id}-${target.platform}-${target.channel_id}`;
    setTogglingRoute(routeKey);
    try {
      await toggleRoute({
        source_platform: route.source.platform,
        source_channel: route.source.channel_id,
        target_platform: target.platform,
        target_channel: target.channel_id,
        is_enabled: !(target.is_enabled !== false),
      });
    } catch (err) {
      console.error("Failed to toggle route:", err);
    } finally {
      setTogglingRoute(null);
    }
  };

  const handleDelete = async (route: RouteResponse) => {
    try {
      await deleteRoute({
        source_platform: route.source.platform,
        source_channel: route.source.channel_id,
        target_platform: route.targets[0].platform,
        target_channel: route.targets[0].channel_id,
      });
      setDeleteConfirm(null);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete route:", err);
    }
  };

  if (isLoading && routes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error && routes.length === 0) {
    return (
      <div className="text-center py-10">
        <svg
          className="w-12 h-12 text-status-danger mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h3 className="text-heading-md text-content-primary mb-2">
          Route를 불러올 수 없습니다
        </h3>
        <p className="text-body-base text-content-secondary mb-4">{error}</p>
        <button
          onClick={() => {
            clearError();
            fetchRoutes();
          }}
          className="px-4 py-2 bg-brand-600 text-content-inverse rounded-button hover:bg-brand-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="text-center py-10">
        <svg
          className="w-12 h-12 text-content-tertiary mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        <h3 className="text-heading-md text-content-primary mb-2">
          등록된 Route가 없습니다
        </h3>
        <p className="text-body-base text-content-secondary">
          "Route 추가" 버튼을 눌러 첫 번째 라우팅 룰을 만드세요
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {routes.map((route, index) => {
          const target = route.targets[0];
          const isBidirectional = target?.is_bidirectional !== false;
          const messageMode = target?.message_mode || "sender_info";
          const isEnabled = target?.is_enabled !== false;
          const routeKey = `${route.source.platform}-${route.source.channel_id}-${target?.platform}-${target?.channel_id}`;

          return (
            <div
              key={`${route.source.platform}-${route.source.channel_id}-${index}`}
              className={`border rounded-lg transition-colors overflow-hidden ${
                isEnabled
                  ? "border-border-subtle bg-surface-card hover:border-brand-300"
                  : "border-border-subtle/50 bg-surface-card/60 opacity-60"
              }`}
            >
              {/* ── Badge row ── */}
              <div className="flex items-center flex-wrap gap-2 px-4 pt-3 pb-0">
                {/* Direction badge */}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isBidirectional
                      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "bg-surface-elevated text-content-secondary border border-border-subtle"
                  }`}
                >
                  {isBidirectional ? (
                    <>
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                      양방향
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                      단방향
                    </>
                  )}
                </span>

                {/* Message mode badge */}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    messageMode === "editable"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-surface-elevated text-content-tertiary border border-border-subtle"
                  }`}
                >
                  {messageMode === "editable"
                    ? "✏️ 편집 가능"
                    : "👤 발신자 정보"}
                </span>

                {/* Enabled/Disabled toggle */}
                <button
                  onClick={() => handleToggle(route)}
                  disabled={readOnly || togglingRoute === routeKey}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                    isEnabled
                      ? "bg-status-success/10 text-status-success border border-status-success/20 hover:bg-status-success/20"
                      : "bg-status-danger/10 text-status-danger border border-status-danger/20 hover:bg-status-danger/20"
                  } disabled:opacity-50`}
                  title={isEnabled ? "클릭하여 비활성화" : "클릭하여 활성화"}
                >
                  {togglingRoute === routeKey ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${isEnabled ? "bg-status-success" : "bg-status-danger"}`}
                    />
                  )}
                  {isEnabled ? "활성" : "비활성"}
                </button>
              </div>

              {/* ── Channel row ── */}
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 p-4">
                {/* Source */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">
                    {getPlatformIcon(route.source.platform)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-content-tertiary mb-0.5">
                      채널 1 · {getPlatformLabel(route.source.platform)}
                    </div>
                    <div className="text-sm font-semibold text-content-primary truncate">
                      {route.source.channel_name || route.source.channel_id}
                    </div>
                    <TruncatedId id={route.source.channel_id} />
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center lg:flex-shrink-0 lg:px-1">
                  {isBidirectional ? (
                    <svg
                      className="w-5 h-5 lg:hidden text-brand-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 lg:hidden text-brand-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  )}
                  {isBidirectional ? (
                    <svg
                      className="hidden lg:block w-5 h-5 text-brand-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="hidden lg:block w-5 h-5 text-brand-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  )}
                </div>

                {/* Targets */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {route.targets.map((t, ti) => (
                    <div
                      key={`${t.platform}-${t.channel_id}-${ti}`}
                      className="flex items-center gap-3 min-w-0"
                    >
                      <span className="text-xl flex-shrink-0">
                        {getPlatformIcon(t.platform)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-content-tertiary mb-0.5">
                          채널 2 · {getPlatformLabel(t.platform)}
                        </div>
                        <div className="text-sm font-semibold text-content-primary truncate">
                          {t.channel_name || t.channel_id}
                        </div>
                        <TruncatedId id={t.channel_id} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 self-start lg:self-center lg:pl-2">
                  <button
                    onClick={() => onEdit?.(route)}
                    disabled={readOnly}
                    className="p-1.5 text-content-secondary hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Route 수정"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(route)}
                    disabled={readOnly}
                    className="p-1.5 text-content-secondary hover:text-status-danger hover:bg-status-danger-light rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Route 삭제"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-surface-card rounded-lg shadow-xl max-w-sm w-full p-5">
              <div className="flex items-start gap-3 mb-4">
                <svg
                  className="w-5 h-5 text-status-danger mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="text-base font-semibold text-content-primary">
                    Route 삭제
                  </h3>
                  <p className="text-sm text-content-secondary mt-0.5">
                    {deleteConfirm.targets[0]?.is_bidirectional !== false
                      ? "양방향 라우트입니다. 양쪽 방향 모두 삭제됩니다."
                      : "이 라우팅 룰을 삭제하시겠습니까?"}
                  </p>
                </div>
              </div>

              {/* Route summary */}
              <div className="mb-4 p-3 bg-surface-elevated rounded-md">
                <div className="flex items-center gap-2 text-sm">
                  <span>{getPlatformIcon(deleteConfirm.source.platform)}</span>
                  <span className="font-medium text-content-primary truncate">
                    {deleteConfirm.source.channel_name ||
                      deleteConfirm.source.channel_id}
                  </span>
                  <svg
                    className="w-4 h-4 text-brand-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {deleteConfirm.targets[0]?.is_bidirectional !== false ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    )}
                  </svg>
                  <span>
                    {getPlatformIcon(deleteConfirm.targets[0].platform)}
                  </span>
                  <span className="font-medium text-content-primary truncate">
                    {deleteConfirm.targets[0].channel_name ||
                      deleteConfirm.targets[0].channel_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-sm border border-border-subtle rounded-button text-content-secondary hover:bg-surface-elevated disabled:opacity-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-sm bg-status-danger text-white rounded-button hover:bg-status-danger/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
