/**
 * RouteModal - Route 추가/수정 모달
 *
 * Source → Target 라우팅 룰을 추가하는 모달
 */

import { useState, useEffect } from "react";
import { useRoutesStore } from "@/store/routes";
import { useProvidersStore } from "@/store/providers";
import { ChannelInputField } from "./ChannelInputField";
import type { RouteCreateRequest, RouteResponse } from "@/lib/api/routes";

interface RouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editRoute?: RouteResponse | null;
  readOnly?: boolean;
}

export function RouteModal({
  isOpen,
  onClose,
  onSuccess,
  editRoute,
  readOnly,
}: RouteModalProps) {
  const { addRoute, deleteRoute, isLoading } = useRoutesStore();
  const { providers, fetchProviders } = useProvidersStore();

  const [formData, setFormData] = useState<RouteCreateRequest>({
    source_platform: "",
    source_channel: "",
    target_platform: "",
    target_channel: "",
    target_channel_name: "",
    source_channel_name: "",
    message_mode: "sender_info",
    is_bidirectional: true,
    is_enabled: true,
    save_history: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = !!editRoute;

  useEffect(() => {
    if (isOpen) {
      fetchProviders();

      if (editRoute) {
        setFormData({
          source_platform: editRoute.source.platform,
          source_channel: editRoute.source.channel_id,
          target_platform: editRoute.targets[0]?.platform || "",
          target_channel: editRoute.targets[0]?.channel_id || "",
          target_channel_name: editRoute.targets[0]?.channel_name || "",
          source_channel_name: editRoute.source.channel_name || "",
          message_mode: editRoute.targets[0]?.message_mode || "sender_info",
          is_bidirectional: editRoute.targets[0]?.is_bidirectional ?? true,
          is_enabled: editRoute.targets[0]?.is_enabled ?? true,
          save_history: editRoute.targets[0]?.save_history ?? true,
        });
      } else {
        setFormData({
          source_platform: "",
          source_channel: "",
          target_platform: "",
          target_channel: "",
          target_channel_name: "",
          source_channel_name: "",
          message_mode: "sender_info",
          is_bidirectional: true,
          is_enabled: true,
          save_history: true,
        });
      }

      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, fetchProviders, editRoute]);

  const availableProviders = providers.filter((p) => p.enabled && p.is_valid);

  const getProviderDisplayName = (provider: {
    name: string;
    platform: string;
  }) => {
    const platformLabel =
      provider.platform === "slack"
        ? "Slack"
        : provider.platform === "teams"
          ? "Microsoft Teams"
          : provider.platform;
    return `${provider.name} (${platformLabel})`;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.source_platform)
      newErrors.source_platform = "채널 1 플랫폼을 선택하세요";
    if (!formData.source_channel)
      newErrors.source_channel = "채널 1을 선택하세요";
    if (!formData.target_platform)
      newErrors.target_platform = "채널 2 플랫폼을 선택하세요";
    if (!formData.target_channel)
      newErrors.target_channel = "채널 2를 선택하세요";
    if (
      formData.source_platform === formData.target_platform &&
      formData.source_channel === formData.target_channel
    ) {
      newErrors.target_channel = "두 채널이 같을 수 없습니다";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitError(null);
      if (isEditMode && editRoute) {
        await deleteRoute({
          source_platform: editRoute.source.platform,
          source_channel: editRoute.source.channel_id,
          target_platform: editRoute.targets[0].platform,
          target_channel: editRoute.targets[0].channel_id,
        });
      }
      await addRoute(formData);
      onSuccess?.();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : isEditMode
            ? "Route 수정에 실패했습니다"
            : "Route 추가에 실패했습니다",
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-surface-card rounded-lg shadow-xl max-w-2xl w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-heading-lg text-content-primary">
              {isEditMode ? "Route 수정" : "Route 추가"}
            </h2>
            <button
              onClick={onClose}
              className="text-content-secondary hover:text-content-primary transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Edit mode: current route info */}
          {isEditMode && editRoute && (
            <div className="mb-5 px-4 py-3 bg-status-info-light border border-status-info-border rounded-md">
              <div className="flex items-center gap-2 flex-wrap text-sm text-content-primary">
                <svg
                  className="w-4 h-4 text-status-info flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-semibold">수정 중인 Route:</span>
                <span className="text-content-secondary truncate max-w-[40%]">
                  {editRoute.source.channel_name || editRoute.source.channel_id}
                </span>
                <svg
                  className="w-4 h-4 text-brand-500 flex-shrink-0"
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
                <span className="text-content-secondary truncate max-w-[40%]">
                  {editRoute.targets[0]?.channel_name ||
                    editRoute.targets[0]?.channel_id}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submitError && (
            <div className="mb-4 p-3 bg-status-danger-light border border-status-danger-border rounded-md text-status-danger text-sm">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ─── Options (상단 배치) ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Message Mode */}
              <div className="p-4 bg-surface-elevated rounded-md border border-border-subtle">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-brand-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <h3 className="text-sm font-semibold text-content-primary">
                    메시지 모드
                  </h3>
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="message_mode"
                      value="sender_info"
                      checked={formData.message_mode === "sender_info"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          message_mode: e.target.value,
                        })
                      }
                      disabled={readOnly}
                      className="mt-0.5 w-4 h-4 text-brand-600 border-border-subtle focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
                        👤 발신자 정보 표시
                      </div>
                      <div className="text-xs text-content-tertiary mt-0.5">
                        username · 아이콘으로 발신자 표시
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="message_mode"
                      value="editable"
                      checked={formData.message_mode === "editable"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          message_mode: e.target.value,
                        })
                      }
                      disabled={readOnly}
                      className="mt-0.5 w-4 h-4 text-brand-600 border-border-subtle focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
                        ✏️ 편집 가능 모드
                      </div>
                      <div className="text-xs text-content-tertiary mt-0.5">
                        메시지 편집·삭제 실시간 반영
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Routing Direction */}
              <div className="p-4 bg-surface-elevated rounded-md border border-border-subtle">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-brand-600 flex-shrink-0"
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
                  <h3 className="text-sm font-semibold text-content-primary">
                    라우팅 방향
                  </h3>
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="routing_direction"
                      checked={formData.is_bidirectional === true}
                      onChange={() =>
                        setFormData({ ...formData, is_bidirectional: true })
                      }
                      disabled={readOnly}
                      className="mt-0.5 w-4 h-4 text-brand-600 border-border-subtle focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
                        ↔ 양방향{" "}
                        <span className="text-xs text-brand-500 font-normal">
                          (권장)
                        </span>
                      </div>
                      <div className="text-xs text-content-tertiary mt-0.5">
                        채널 1 ↔ 채널 2 자동 동기화
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="routing_direction"
                      checked={formData.is_bidirectional === false}
                      onChange={() =>
                        setFormData({ ...formData, is_bidirectional: false })
                      }
                      disabled={readOnly}
                      className="mt-0.5 w-4 h-4 text-brand-600 border-border-subtle focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
                        → 단방향
                      </div>
                      <div className="text-xs text-content-tertiary mt-0.5">
                        채널 1 → 채널 2 만 전송
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Route Status */}
              <div className="p-4 bg-surface-elevated rounded-md border border-border-subtle">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-brand-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="text-sm font-semibold text-content-primary">
                    상태
                  </h3>
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="route_status"
                      checked={formData.is_enabled === true}
                      onChange={() =>
                        setFormData({ ...formData, is_enabled: true })
                      }
                      disabled={readOnly}
                      className="mt-0.5 w-4 h-4 text-brand-600 border-border-subtle focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
                        <span className="inline-block w-2 h-2 rounded-full bg-status-success mr-1" />
                        활성
                      </div>
                      <div className="text-xs text-content-tertiary mt-0.5">
                        메시지 자동 전달
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="route_status"
                      checked={formData.is_enabled === false}
                      onChange={() =>
                        setFormData({ ...formData, is_enabled: false })
                      }
                      disabled={readOnly}
                      className="mt-0.5 w-4 h-4 text-brand-600 border-border-subtle focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
                        <span className="inline-block w-2 h-2 rounded-full bg-status-danger mr-1" />
                        비활성
                      </div>
                      <div className="text-xs text-content-tertiary mt-0.5">
                        라우팅 일시 중지
                      </div>
                    </div>
                  </label>
                </div>
              </div>

            </div>

            {/* ─── 히스토리 토글 ─── */}
            <div className="p-4 bg-surface-elevated rounded-md border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-brand-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-content-primary">
                    메시지 히스토리
                  </h3>
                  <p className="text-xs text-content-tertiary mt-0.5">
                    {formData.save_history
                      ? "전달된 메시지를 DB에 기록"
                      : "메시지 전달만 하고 기록하지 않음"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.save_history}
                onClick={() =>
                  !readOnly &&
                  setFormData({
                    ...formData,
                    save_history: !formData.save_history,
                  })
                }
                disabled={readOnly}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  formData.save_history ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    formData.save_history ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* ─── Divider ─── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-xs text-content-tertiary">채널 설정</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>

            {/* ─── Channel 1 ─── */}
            <div className="space-y-3 p-4 bg-surface-elevated rounded-md border-2 border-transparent hover:border-brand-200 transition-colors">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold">
                  1
                </span>
                <h3 className="text-sm font-semibold text-content-primary">
                  채널 1
                </h3>
                <span className="text-xs text-content-tertiary">(소스)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  플랫폼
                </label>
                <select
                  value={formData.source_platform}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      source_platform: e.target.value,
                      source_channel: "",
                    });
                    setErrors({ ...errors, source_platform: "" });
                  }}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-border-subtle rounded-button bg-surface-card text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">플랫폼 선택</option>
                  {availableProviders.map((p) => (
                    <option key={p.id} value={p.platform}>
                      {getProviderDisplayName(p)}
                    </option>
                  ))}
                </select>
                {errors.source_platform && (
                  <div className="mt-1 text-xs text-status-danger">
                    {errors.source_platform}
                  </div>
                )}
              </div>

              <div>
                <ChannelInputField
                  platform={formData.source_platform}
                  value={formData.source_channel}
                  channelName={formData.source_channel_name}
                  onChange={(channelId, channelName) => {
                    setFormData({
                      ...formData,
                      source_channel: channelId,
                      source_channel_name: channelName || "",
                    });
                    setErrors({ ...errors, source_channel: "" });
                  }}
                  disabled={readOnly || !formData.source_platform}
                  label="채널"
                />
                {errors.source_channel && (
                  <div className="mt-1 text-xs text-status-danger">
                    {errors.source_channel}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Direction Arrow ─── */}
            <div className="flex justify-center">
              {formData.is_bidirectional ? (
                <svg
                  className="w-7 h-7 text-brand-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="양방향"
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
                  className="w-7 h-7 text-brand-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="단방향 (채널 1 → 채널 2)"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              )}
            </div>

            {/* ─── Channel 2 ─── */}
            <div className="space-y-3 p-4 bg-surface-elevated rounded-md border-2 border-transparent hover:border-brand-200 transition-colors">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold">
                  2
                </span>
                <h3 className="text-sm font-semibold text-content-primary">
                  채널 2
                </h3>
                <span className="text-xs text-content-tertiary">(타겟)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  플랫폼
                </label>
                <select
                  value={formData.target_platform}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      target_platform: e.target.value,
                      target_channel: "",
                      target_channel_name: "",
                    });
                    setErrors({ ...errors, target_platform: "" });
                  }}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-border-subtle rounded-button bg-surface-card text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">플랫폼 선택</option>
                  {availableProviders.map((p) => (
                    <option key={p.id} value={p.platform}>
                      {getProviderDisplayName(p)}
                    </option>
                  ))}
                </select>
                {errors.target_platform && (
                  <div className="mt-1 text-xs text-status-danger">
                    {errors.target_platform}
                  </div>
                )}
              </div>

              <div>
                <ChannelInputField
                  platform={formData.target_platform}
                  value={formData.target_channel}
                  channelName={formData.target_channel_name}
                  onChange={(channelId, channelName) => {
                    setFormData({
                      ...formData,
                      target_channel: channelId,
                      target_channel_name: channelName || "",
                    });
                    setErrors({ ...errors, target_channel: "" });
                  }}
                  disabled={readOnly || !formData.target_platform}
                  label="채널"
                />
                {errors.target_channel && (
                  <div className="mt-1 text-xs text-status-danger">
                    {errors.target_channel}
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              {availableProviders.length === 0 ? (
                <p className="text-xs text-status-warning flex-1 min-w-0">
                  활성화된 플랫폼이 없습니다. 연동 관리에서 플랫폼 연동을
                  설정하세요.
                </p>
              ) : (
                <div className="hidden sm:block" />
              )}
              <div className="flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-4 py-2 border border-border-subtle rounded-button text-sm text-content-secondary hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={
                    readOnly || isLoading || availableProviders.length === 0
                  }
                  className="px-4 py-2 bg-brand-600 text-content-inverse text-sm rounded-button hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading
                    ? isEditMode
                      ? "수정 중..."
                      : "추가 중..."
                    : isEditMode
                      ? "수정"
                      : "추가"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
