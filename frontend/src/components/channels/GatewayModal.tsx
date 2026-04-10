/**
 * GatewayModal 컴포넌트 (개선 버전)
 *
 * Gateway 추가/수정 모달 - 플랫폼 기반 입력 개선
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Modal, ModalFooter } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { InfoBox } from "../ui/InfoBox";
import { PlatformIcon } from "../ui/PlatformIcon";
import type {
  GatewayConfig,
  GatewayInOutConfig,
  Platform,
} from "../../lib/api/types";
import {
  PLATFORM_CONFIG,
  PLATFORM_GUIDE,
  getPlatform,
  getAccountName,
  buildAccount,
} from "../../lib/utils/platform";
import { providersApi, type ProviderResponse } from "../../lib/api/providers";

interface GatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (gateway: GatewayConfig) => Promise<void>;
  gateway?: GatewayConfig;
  mode: "add" | "edit";
}

interface ValidationErrors {
  name?: string;
  channels?: string[];
}

interface ChannelInput {
  platform: Platform;
  accountName: string;
  channel: string;
}

export function GatewayModal({
  isOpen,
  onClose,
  onSave,
  gateway,
  mode,
}: GatewayModalProps) {
  const [name, setName] = useState("");
  const [enable, setEnable] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [channels, setChannels] = useState<ChannelInput[]>([
    { platform: "slack", accountName: "", channel: "" },
    { platform: "teams", accountName: "", channel: "" },
  ]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [expandedHelpers, setExpandedHelpers] = useState<Set<number>>(
    new Set(),
  );
  const [focusedField, setFocusedField] = useState<{
    index: number;
    field:
      | "gateway-name"
      | "gateway-status"
      | "platform"
      | "accountName"
      | "channel";
  } | null>(null);
  const [accounts, setAccounts] = useState<{
    slack: ProviderResponse[];
    teams: ProviderResponse[];
  } | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 계정 목록 초기화 (재진입 시 새로 로드하도록)
      setAccounts(null);

      if (mode === "edit" && gateway) {
        setName(gateway.name);
        setEnable(gateway.enable !== false);

        // 기존 GatewayInOutConfig를 ChannelInput으로 변환
        const channelInputs: ChannelInput[] = gateway.inout.map((inout) => {
          const platform = getPlatform(inout.account);
          const accountName = getAccountName(inout.account);
          console.log("[GatewayModal] Parsing inout:", {
            original: inout.account,
            platform,
            accountName,
            channel: inout.channel,
          });
          return { platform, accountName, channel: inout.channel };
        });

        console.log(
          "[GatewayModal] Edit mode - parsed channels:",
          channelInputs,
        );

        setChannels(
          channelInputs.length > 0
            ? channelInputs
            : [
                { platform: "slack", accountName: "", channel: "" },
                { platform: "teams", accountName: "", channel: "" },
              ],
        );
      } else {
        setName("");
        setEnable(true);
        setChannels([
          { platform: "slack", accountName: "", channel: "" },
          { platform: "teams", accountName: "", channel: "" },
        ]);
      }
      setErrors({});
      setGeneralError(null);
      setExpandedHelpers(new Set());
      setFocusedField(null);

      // 모달이 열릴 때 항상 계정 목록 로드 (Add/Edit 모드 공통)
      loadAccounts();
    }
  }, [isOpen, mode, gateway]);

  const loadAccounts = async () => {
    // 이미 로드 중이거나 로드 완료된 경우 중복 호출 방지
    if (loadingAccounts || accounts) {
      return;
    }

    setLoadingAccounts(true);
    try {
      const data = await providersApi.getProviders();
      console.log("[GatewayModal] Loaded providers from DB:", data);

      // DB 응답을 플랫폼별로 분류
      const slackAccounts = data.filter(
        (acc) => acc.platform === "slack" && acc.enabled && acc.is_valid,
      );
      const teamsAccounts = data.filter(
        (acc) => acc.platform === "teams" && acc.enabled && acc.is_valid,
      );

      console.log("[GatewayModal] Filtered accounts:", {
        slack: slackAccounts.map((a) => a.name),
        teams: teamsAccounts.map((a) => a.name),
      });

      setAccounts({
        slack: slackAccounts,
        teams: teamsAccounts,
      });
    } catch (err) {
      console.error("[GatewayModal] Failed to load accounts:", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // 계정 필드에 포커스될 때 계정 목록 로드
  const handleAccountFieldFocus = (index: number) => {
    setFocusedField({ index, field: "accountName" });
    // 계정 목록이 아직 로드되지 않았으면 로드
    if (!accounts && !loadingAccounts) {
      loadAccounts();
    }
  };

  const handleAddChannel = () => {
    setChannels([
      ...channels,
      { platform: "slack", accountName: "", channel: "" },
    ]);
  };

  const handleRemoveChannel = (index: number) => {
    if (channels.length > 2) {
      setChannels(channels.filter((_, i) => i !== index));
      if (errors.channels) {
        const newChannelErrors = [...errors.channels];
        newChannelErrors.splice(index, 1);
        setErrors({ ...errors, channels: newChannelErrors });
      }
    }
  };

  const handleChannelChange = (
    index: number,
    field: keyof ChannelInput,
    value: string,
  ) => {
    const newChannels = [...channels];
    if (field === "platform") {
      newChannels[index] = {
        ...newChannels[index],
        platform: value as Platform,
      };
    } else {
      newChannels[index] = { ...newChannels[index], [field]: value };
    }
    setChannels(newChannels);

    // 에러 클리어
    if (errors.channels && errors.channels[index]) {
      const newChannelErrors = [...errors.channels];
      newChannelErrors[index] = "";
      setErrors({ ...errors, channels: newChannelErrors });
    }
  };

  const toggleHelper = (index: number) => {
    setExpandedHelpers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Gateway 이름 검증
    if (!name.trim()) {
      newErrors.name = "Gateway 이름을 입력해주세요";
    } else if (name.length < 3) {
      newErrors.name = "Gateway 이름은 3자 이상이어야 합니다";
    }

    // 채널 검증
    const channelErrors: string[] = [];
    const validChannels = channels.filter(
      (ch) => ch.accountName.trim() || ch.channel.trim(),
    );

    if (validChannels.length < 2) {
      setGeneralError("Gateway에는 최소 2개의 채널이 필요합니다");
      return false;
    }

    channels.forEach((channel, index) => {
      // 빈 채널은 건너뛰기
      if (!channel.accountName.trim() && !channel.channel.trim()) {
        channelErrors[index] = "";
        return;
      }

      // 계정 이름 검증
      if (!channel.accountName.trim()) {
        channelErrors[index] = "계정 이름을 입력해주세요";
      }
      // 채널 ID 검증
      else if (!channel.channel.trim()) {
        channelErrors[index] = "채널 ID를 입력해주세요";
      } else {
        channelErrors[index] = "";
      }
    });

    if (channelErrors.some((err) => err)) {
      newErrors.channels = channelErrors;
    }

    setErrors(newErrors);
    setGeneralError(null);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveClick = () => {
    if (!validate()) return;
    // 확인 다이얼로그 표시
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    setSaving(true);
    setGeneralError(null);

    try {
      // ChannelInput을 GatewayInOutConfig로 변환
      const validChannels = channels.filter(
        (ch) => ch.accountName.trim() && ch.channel.trim(),
      );

      const inout: GatewayInOutConfig[] = validChannels.map((ch) => ({
        account: buildAccount(ch.platform, ch.accountName),
        channel: ch.channel,
      }));

      await onSave({ name, enable, inout });
      onClose();
    } catch (error: any) {
      // 백엔드 유효성 검증 오류 파싱
      let errorMessage = "Gateway 저장에 실패했습니다";

      if (error?.response?.data) {
        const errorData = error.response.data;

        // API 오류 메시지 추출
        if (typeof errorData === "string") {
          errorMessage = errorData;
        } else if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (errorData.detail.error) {
            errorMessage = errorData.detail.error;

            // validation_errors가 있으면 상세 오류 표시
            if (
              errorData.detail.errors &&
              Array.isArray(errorData.detail.errors)
            ) {
              const validationErrors = errorData.detail.errors
                .map(
                  (err: any) =>
                    `• ${err.field || "Unknown"}: ${err.message || err}`,
                )
                .join("\n");
              errorMessage = `${errorMessage}\n\n유효성 검증 오류:\n${validationErrors}`;
            }
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setGeneralError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={mode === "add" ? "Gateway 추가" : "Gateway 수정"}
        size="lg"
        footer={
          <ModalFooter
            onCancel={onClose}
            onConfirm={handleSaveClick}
            confirmText={mode === "add" ? "추가" : "저장"}
            confirmVariant="primary"
            loading={saving}
          />
        }
      >
        <div className="space-y-6">
          {generalError && (
            <Alert variant="danger" onClose={() => setGeneralError(null)}>
              {generalError}
            </Alert>
          )}

          {/* 안내 메시지 */}
          <div className="bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 rounded-card p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-body-sm font-semibold text-brand-900 dark:text-brand-100 mb-1">
                  Gateway 설정 가이드
                </h3>
                <p className="text-body-xs text-brand-800 dark:text-brand-200">
                  Gateway는 2개 이상의 채널을 연결하여 메시지를 실시간으로
                  동기화합니다. 각 항목을 순서대로 입력하고, 플랫폼별 안내를
                  참고하세요.
                </p>
              </div>
            </div>
          </div>

          {/* Gateway Name */}
          <div>
            <Input
              label="Gateway 이름"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              onFocus={() =>
                setFocusedField({ index: -1, field: "gateway-name" })
              }
              onBlur={() => setFocusedField(null)}
              placeholder="예: Slack-Teams 연동"
              error={errors.name}
              required
            />
            {focusedField?.field === "gateway-name" && (
              <p className="mt-1 text-body-xs text-content-secondary transition-opacity duration-200 ease-in">
                이 Gateway를 식별할 수 있는 의미있는 이름을 입력하세요 (3자
                이상)
              </p>
            )}
          </div>

          {/* Enable/Disable */}
          <div>
            <div
              onFocus={() =>
                setFocusedField({ index: -1, field: "gateway-status" })
              }
              onBlur={() => setFocusedField(null)}
            >
              <Select
                label="상태"
                value={enable ? "true" : "false"}
                onChange={(e) => setEnable(e.target.value === "true")}
                options={[
                  { value: "true", label: "활성화" },
                  { value: "false", label: "비활성화" },
                ]}
              />
            </div>
            {focusedField?.field === "gateway-status" && (
              <p className="mt-1 text-body-xs text-content-secondary transition-opacity duration-200 ease-in">
                비활성화하면 이 Gateway를 통한 메시지 동기화가 중단됩니다
              </p>
            )}
          </div>

          {/* Channel Mappings */}
          <div>
            <label className="block text-heading-sm text-content-primary mb-2">
              채널 매핑 <span className="text-status-danger">*</span>
            </label>
            <div className="bg-status-info-light dark:bg-status-info-light/10 border border-status-info-border rounded-card p-3 mb-3">
              <p className="text-body-sm text-content-primary font-medium mb-1">
                📌 채널 매핑 설정 방법
              </p>
              <ol className="list-decimal list-inside space-y-1 text-body-xs text-content-secondary ml-2">
                <li>
                  <strong>플랫폼</strong>: 연결할 메시징 서비스를 선택하세요
                </li>
                <li>
                  <strong>계정 이름</strong>: 플랫폼에서 사용할 식별자를
                  입력하세요
                </li>
                <li>
                  <strong>채널 ID</strong>: 동기화할 채널의 고유 ID를 입력하세요
                </li>
              </ol>
              <p className="text-body-xs text-content-secondary mt-2">
                💡 최소 2개의 채널을 추가해야 하며, 같은 플랫폼 간에도 연결
                가능합니다 (예: Slack 채널 2개)
              </p>
            </div>

            <div className="space-y-4">
              {channels.map((channel, index) => {
                const platformConfig = PLATFORM_CONFIG[channel.platform];

                return (
                  <div
                    key={index}
                    className="border border-line rounded-card p-4 bg-surface-raised"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        {/* 플랫폼 선택 */}
                        <div>
                          <label className="block text-body-sm font-medium text-content-primary mb-1">
                            채널 {index + 1} - 플랫폼
                          </label>
                          {focusedField?.index === index &&
                            focusedField?.field === "platform" && (
                              <p className="text-body-xs text-content-secondary mb-2 transition-opacity duration-200 ease-in">
                                이 채널이 속한 메시징 플랫폼을 선택하세요
                              </p>
                            )}
                          <div className="relative">
                            <select
                              value={channel.platform}
                              onChange={(e) =>
                                handleChannelChange(
                                  index,
                                  "platform",
                                  e.target.value,
                                )
                              }
                              onFocus={() =>
                                setFocusedField({ index, field: "platform" })
                              }
                              onBlur={() => setFocusedField(null)}
                              className="w-full px-3 py-2 pl-10 border border-line rounded-input bg-white dark:bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                              aria-describedby={`platform-help-${index}`}
                            >
                              <option value="slack">Slack</option>
                              <option value="teams">Microsoft Teams</option>
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <PlatformIcon
                                platform={channel.platform}
                                size="sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 계정 선택 (드롭다운) */}
                        <div>
                          <label className="block text-body-sm font-medium text-content-primary mb-1">
                            채널 {index + 1} - 계정
                          </label>
                          {focusedField?.index === index &&
                            focusedField?.field === "accountName" && (
                              <p className="text-body-xs text-content-secondary mb-2 transition-opacity duration-200 ease-in">
                                {platformConfig.label}에 연결할 계정을
                                선택하세요
                              </p>
                            )}
                          {loadingAccounts ? (
                            <div className="flex items-center gap-2 px-3 py-2 border border-line rounded-input bg-surface-raised text-content-secondary">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-600" />
                              <span className="text-body-sm">
                                계정 목록 로딩 중...
                              </span>
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const platformAccounts =
                                  channel.platform === "slack"
                                    ? accounts?.slack || []
                                    : accounts?.teams || [];

                                // 계정 목록이 없지만 현재 값이 있는 경우 (Edit 모드 또는 로딩 실패)
                                const hasCurrentValue =
                                  channel.accountName.trim() !== "";
                                const hasAccounts = platformAccounts.length > 0;

                                if (
                                  hasAccounts ||
                                  (hasCurrentValue && !accounts)
                                ) {
                                  // 옵션 목록 생성: 현재 값 + 로드된 계정들
                                  const allOptions = new Set<string>();
                                  if (hasCurrentValue) {
                                    allOptions.add(channel.accountName);
                                  }
                                  platformAccounts.forEach((acc) =>
                                    allOptions.add(acc.name),
                                  );

                                  return (
                                    <>
                                      <select
                                        value={channel.accountName}
                                        onChange={(e) =>
                                          handleChannelChange(
                                            index,
                                            "accountName",
                                            e.target.value,
                                          )
                                        }
                                        onFocus={() =>
                                          handleAccountFieldFocus(index)
                                        }
                                        onBlur={() => setFocusedField(null)}
                                        className="w-full px-3 py-2 border border-line rounded-input bg-white dark:bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                                      >
                                        <option value="">계정 선택...</option>
                                        {Array.from(allOptions).map((name) => (
                                          <option key={name} value={name}>
                                            {name}
                                          </option>
                                        ))}
                                      </select>
                                      {!hasAccounts && hasCurrentValue && (
                                        <p className="text-body-xs text-status-warning mt-1">
                                          ⚠️ 계정 목록을 불러올 수 없어 현재
                                          값만 표시됩니다
                                        </p>
                                      )}
                                    </>
                                  );
                                } else {
                                  // 계정도 없고 현재 값도 없는 경우
                                  return (
                                    <div className="p-3 bg-status-warning-light border border-status-warning-border rounded-card">
                                      <p className="text-body-sm text-content-primary mb-2">
                                        ⚠️ 등록된{" "}
                                        {channel.platform === "slack"
                                          ? "Slack"
                                          : "Teams"}{" "}
                                        계정이 없습니다.
                                      </p>
                                      <p className="text-body-xs text-content-secondary mb-2">
                                        Gateway를 생성하려면 먼저 계정을
                                        추가해야 합니다.
                                      </p>
                                      <Link
                                        to="/accounts"
                                        onClick={onClose}
                                        className="inline-flex items-center gap-1 text-body-sm text-brand-600 hover:text-brand-700 font-medium"
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
                                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                          />
                                        </svg>
                                        계정 관리 페이지로 이동
                                      </Link>
                                    </div>
                                  );
                                }
                              })()}
                            </>
                          )}
                        </div>

                        {/* 채널 ID */}
                        <div>
                          <label className="block text-body-sm font-medium text-content-primary mb-1">
                            채널 {index + 1} - 채널 ID
                          </label>
                          {focusedField?.index === index &&
                            focusedField?.field === "channel" && (
                              <p className="text-body-xs text-content-secondary mb-2 transition-opacity duration-200 ease-in">
                                메시지를 동기화할 {platformConfig.label} 채널의
                                고유 ID를 입력하세요
                              </p>
                            )}
                          <Input
                            value={channel.channel}
                            onChange={(e) =>
                              handleChannelChange(
                                index,
                                "channel",
                                e.target.value,
                              )
                            }
                            onFocus={() =>
                              setFocusedField({ index, field: "channel" })
                            }
                            onBlur={() => setFocusedField(null)}
                            placeholder={`예: ${PLATFORM_GUIDE[channel.platform].channelExample}`}
                            error={errors.channels?.[index]}
                          />

                          {/* 채널 ID 찾기 도우미 */}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleHelper(index)}
                              className="text-body-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 transition-colors"
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${
                                  expandedHelpers.has(index) ? "rotate-90" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              채널 ID 찾는 방법
                            </button>

                            {expandedHelpers.has(index) && (
                              <div className="mt-2 p-3 bg-status-info-light dark:bg-status-info-light/10 border border-status-info-border rounded-card">
                                <p className="text-body-sm text-content-primary font-medium mb-2">
                                  {platformConfig.label} 채널 ID 확인 방법:
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-body-sm text-content-secondary">
                                  {PLATFORM_GUIDE[
                                    channel.platform
                                  ].channelSteps.map((step, stepIndex) => (
                                    <li key={stepIndex}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      {channels.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChannel(index)}
                          className="mt-6 p-2 text-status-danger hover:bg-status-danger-light dark:hover:bg-status-danger-light/10 rounded-button transition-colors"
                          title="채널 삭제"
                          aria-label={`채널 ${index + 1} 삭제`}
                        >
                          <svg
                            className="w-5 h-5"
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
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleAddChannel}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                }
              >
                채널 추가
              </Button>
              <span className="text-body-xs text-content-tertiary">
                더 많은 채널을 추가하여 여러 채널을 동시에 동기화할 수 있습니다
              </span>
            </div>
          </div>

          {/* Info */}
          <InfoBox variant="info" title="💡 참고사항">
            <div className="space-y-3 text-body-sm">
              <div>
                <p className="font-semibold text-content-primary mb-2">
                  플랫폼별 예시:
                </p>
                <ul className="list-none space-y-2 ml-2">
                  <li className="flex items-start gap-2">
                    <span className="text-lg">📱</span>
                    <div>
                      <strong className="text-content-primary">Slack</strong>
                      <br />
                      <span className="text-content-secondary text-body-xs">
                        계정: "{PLATFORM_GUIDE.slack.accountNameExample}" /
                        채널: "{PLATFORM_GUIDE.slack.channelExample}"
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lg">💼</span>
                    <div>
                      <strong className="text-content-primary">Teams</strong>
                      <br />
                      <span className="text-content-secondary text-body-xs">
                        계정: "{PLATFORM_GUIDE.teams.accountNameExample}" /
                        채널: "{PLATFORM_GUIDE.teams.channelExample}"
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="border-t border-status-info-border pt-2">
                <p className="text-content-secondary">
                  🔍 각 채널 카드의 <strong>"채널 ID 찾는 방법"</strong> 버튼을
                  클릭하면 플랫폼별 상세한 단계별 가이드를 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </InfoBox>
        </div>
      </Modal>

      {/* 저장 확인 다이얼로그 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowConfirmDialog(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-yellow-600 dark:text-yellow-500"
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
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-content-primary mb-2">
                    서비스 일시 중지 안내
                  </h3>
                  <div className="text-sm text-content-secondary space-y-2">
                    <p>
                      Gateway 설정을 저장하려면{" "}
                      <strong className="text-content-primary">
                        Matterbridge 서비스를 일시 중지
                      </strong>
                      해야 합니다.
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mt-3">
                      <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                        <strong>주의:</strong> 서비스 중지 중(약 3-5초)에는
                        메시지 동기화가 일시적으로 중단됩니다.
                      </p>
                    </div>
                    <p className="mt-3">계속 진행하시겠습니까?</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={saving}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSave}
                  disabled={saving}
                >
                  {saving ? "저장 중..." : "확인 및 저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
