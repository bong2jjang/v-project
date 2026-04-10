/**
 * ProviderModal Component
 *
 * Provider 추가/수정 모달
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  Link,
  Unlink,
  CheckCircle,
  Settings,
} from "lucide-react";
import {
  ProviderResponse,
  ProviderCreateRequest,
  ProviderUpdateRequest,
  providersApi,
} from "@/lib/api/providers";
import { useProvidersStore } from "@/store/providers";
import { FeatureSelector } from "./FeatureSelector";

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: ProviderResponse | null;
  readOnly?: boolean;
}

interface ValidationErrors {
  name?: string;
  token?: string;
  app_token?: string;
  tenant_id?: string;
  app_id?: string;
  app_password?: string;
  team_id?: string;
}

export function ProviderModal({
  isOpen,
  onClose,
  provider,
  readOnly,
}: ProviderModalProps) {
  const {
    createProvider,
    updateProvider,
    isLoading,
    featureCatalog,
    categoryLabels,
    fetchFeatureCatalog,
  } = useProvidersStore();

  // Form state
  const [platform, setPlatform] = useState<"slack" | "teams">("slack");
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Slack fields
  const [token, setToken] = useState("");
  const [appToken, setAppToken] = useState("");

  // Teams fields
  const [tenantId, setTenantId] = useState("");
  const [appId, setAppId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  // webhookUrl state removed — Power Automate webhook is no longer used

  // 공통 설정
  const [prefixMessagesWithNick, setPrefixMessagesWithNick] = useState(true);
  const [editSuffix, setEditSuffix] = useState(" (edited)");
  const [editDisable, setEditDisable] = useState(false);
  const [useUsername, setUseUsername] = useState(true);
  const [noSendJoinPart, setNoSendJoinPart] = useState(true);
  const [useApi, setUseApi] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Feature selection (null = 전체 활성화)
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null>(null);
  const [showFeatureSelector, setShowFeatureSelector] = useState(false);

  // UI state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showGuide, setShowGuide] = useState(false);

  // Microsoft Delegated Auth state
  const [msAuthConnected, setMsAuthConnected] = useState(false);
  const [msUserId, setMsUserId] = useState<string | null>(null);
  const [msAuthLoading, setMsAuthLoading] = useState(false);

  const isEditMode = !!provider;

  // Microsoft Delegated Auth 상태 조회
  const refreshMsAuthStatus = useCallback(async () => {
    if (!provider || provider.platform !== "teams") return;
    try {
      const status = await providersApi.getMicrosoftAuthStatus(provider.id);
      setMsAuthConnected(status.has_delegated_auth);
      setMsUserId(status.ms_user_id);
    } catch {
      setMsAuthConnected(false);
      setMsUserId(null);
    }
  }, [provider]);

  // OAuth 팝업 결과 수신
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "ms-oauth-result") {
        if (event.data.status === "success") {
          refreshMsAuthStatus();
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshMsAuthStatus]);

  // 모달 열릴 때 카탈로그 로드 + 폼 초기화
  useEffect(() => {
    if (isOpen) {
      fetchFeatureCatalog();

      if (provider) {
        setPlatform(provider.platform);
        setName(provider.name);
        setEnabled(provider.enabled);
        setToken("");
        setAppToken("");
        setTenantId("");
        setAppId("");
        setAppPassword("");
        setTeamId("");
        // webhookUrl removed
        setEnabledFeatures(provider.enabled_features ?? null);
        // 공통 설정 초기화
        setPrefixMessagesWithNick(provider.prefix_messages_with_nick ?? true);
        setEditSuffix(provider.edit_suffix ?? " (edited)");
        setEditDisable(provider.edit_disable ?? false);
        setUseUsername(provider.use_username ?? true);
        setNoSendJoinPart(provider.no_send_join_part ?? true);
        setUseApi(provider.use_api ?? true);
        setDebugMode(provider.debug ?? false);
        // Delegated Auth 상태 초기화 및 조회
        setMsAuthConnected(provider.has_delegated_auth ?? false);
        setMsUserId(provider.ms_user_id ?? null);
        if (provider.platform === "teams") {
          refreshMsAuthStatus();
        }
      } else {
        setPlatform("slack");
        setName("");
        setEnabled(true);
        setToken("");
        setAppToken("");
        setTenantId("");
        setAppId("");
        setAppPassword("");
        setTeamId("");
        // webhookUrl removed
        setEnabledFeatures(null);
        setPrefixMessagesWithNick(true);
        setEditSuffix(" (edited)");
        setEditDisable(false);
        setUseUsername(true);
        setNoSendJoinPart(true);
        setUseApi(true);
        setDebugMode(false);
        setMsAuthConnected(false);
        setMsUserId(null);
      }
      setErrors({});
      setShowGuide(false);
      setShowFeatureSelector(false);
      setShowAdvancedSettings(false);
    }
  }, [isOpen, provider, fetchFeatureCatalog, refreshMsAuthStatus]);

  // 검증
  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!name.trim()) {
      newErrors.name = "이름을 입력해주세요";
    }

    if (platform === "slack") {
      if (!isEditMode && !token.trim()) {
        newErrors.token = "Bot Token을 입력해주세요";
      }
      if (token && !token.startsWith("xoxb-")) {
        newErrors.token = "올바른 형식이 아닙니다 (xoxb-로 시작)";
      }
      if (appToken && !appToken.startsWith("xapp-")) {
        newErrors.app_token = "올바른 형식이 아닙니다 (xapp-로 시작)";
      }
    }

    if (platform === "teams") {
      if (!isEditMode && !tenantId.trim()) {
        newErrors.tenant_id = "Tenant ID를 입력해주세요";
      }
      if (!isEditMode && !appId.trim()) {
        newErrors.app_id = "App ID를 입력해주세요";
      }
      if (!isEditMode && !appPassword.trim()) {
        newErrors.app_password = "App Password를 입력해주세요";
      }
      if (!isEditMode && !teamId.trim()) {
        newErrors.team_id = "Team ID를 입력해주세요";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 저장
  const handleSave = async () => {
    if (!validate()) return;

    try {
      if (isEditMode && provider) {
        const data: ProviderUpdateRequest = {
          name,
          enabled,
          enabled_features: enabledFeatures,
          prefix_messages_with_nick: prefixMessagesWithNick,
          edit_suffix: editSuffix,
          edit_disable: editDisable,
          use_username: useUsername,
        };

        if (platform === "slack") {
          if (token) data.token = token;
          if (appToken) data.app_token = appToken;
          data.no_send_join_part = noSendJoinPart;
          data.use_api = useApi;
          data.debug = debugMode;
        } else {
          if (tenantId) data.tenant_id = tenantId;
          if (appId) data.app_id = appId;
          if (appPassword) data.app_password = appPassword;
          if (teamId) data.team_id = teamId;
        }

        await updateProvider(provider.id, data);
      } else {
        const data: ProviderCreateRequest = {
          name,
          platform,
          enabled,
          enabled_features: enabledFeatures,
          prefix_messages_with_nick: prefixMessagesWithNick,
          edit_suffix: editSuffix,
          edit_disable: editDisable,
          use_username: useUsername,
        };

        if (platform === "slack") {
          data.token = token;
          data.app_token = appToken;
          data.no_send_join_part = noSendJoinPart;
          data.use_api = useApi;
          data.debug = debugMode;
        } else {
          data.tenant_id = tenantId;
          data.app_id = appId;
          data.app_password = appPassword;
          data.team_id = teamId;
        }

        await createProvider(data);
      }

      onClose();
    } catch (error) {
      // 에러는 store에서 처리
    }
  };

  if (!isOpen) return null;

  const catalogForPlatform =
    featureCatalog?.filter((f) => f.platform_support[platform] !== undefined) ??
    [];

  const selectedFeatureCount =
    enabledFeatures === null
      ? catalogForPlatform.length
      : enabledFeatures.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface-card border border-line rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-content-primary">
            {isEditMode ? "플랫폼 수정" : "플랫폼 연동"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-content-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Platform 선택 (추가 모드만) */}
          {!isEditMode && (
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">
                플랫폼 선택 *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPlatform("slack")}
                  disabled={readOnly}
                  className={`p-3 border rounded-lg transition-colors text-center ${
                    platform === "slack"
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-line hover:border-brand-500/30"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-sm font-medium text-content-primary">
                    Slack
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform("teams")}
                  disabled={readOnly}
                  className={`p-3 border rounded-lg transition-colors text-center ${
                    platform === "teams"
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-line hover:border-brand-500/30"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-sm font-medium text-content-primary">
                    Teams
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">
              이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: slack-main, teams-main"
              className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                errors.name ? "border-status-error" : "border-line"
              }`}
              disabled={readOnly || isEditMode}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-status-error">{errors.name}</p>
            )}
          </div>

          {/* Slack 필드 */}
          {platform === "slack" && (
            <>
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Bot Token {!isEditMode && "*"}
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={readOnly}
                  placeholder="xoxb-..."
                  className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.token ? "border-status-error" : "border-line"
                  }`}
                />
                {errors.token && (
                  <p className="mt-1 text-xs text-status-error">
                    {errors.token}
                  </p>
                )}
                {isEditMode && (
                  <p className="mt-1 text-xs text-content-tertiary">
                    비워두면 기존 토큰 유지
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  App Token (Socket Mode)
                </label>
                <input
                  type="password"
                  value={appToken}
                  onChange={(e) => setAppToken(e.target.value)}
                  disabled={readOnly}
                  placeholder="xapp-..."
                  className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.app_token ? "border-status-error" : "border-line"
                  }`}
                />
                {errors.app_token && (
                  <p className="mt-1 text-xs text-status-error">
                    {errors.app_token}
                  </p>
                )}
                <p className="mt-1 text-xs text-content-tertiary">
                  Socket Mode 사용 시 필수
                </p>
              </div>
            </>
          )}

          {/* Teams 필드 */}
          {platform === "teams" && (
            <>
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Tenant ID {!isEditMode && "*"}
                </label>
                <input
                  type="password"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  disabled={readOnly}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.tenant_id ? "border-status-error" : "border-line"
                  }`}
                />
                {errors.tenant_id && (
                  <p className="mt-1 text-xs text-status-error">
                    {errors.tenant_id}
                  </p>
                )}
                {isEditMode && (
                  <p className="mt-1 text-xs text-content-tertiary">
                    비워두면 기존 값 유지
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  App ID {!isEditMode && "*"}
                </label>
                <input
                  type="password"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  disabled={readOnly}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.app_id ? "border-status-error" : "border-line"
                  }`}
                />
                {errors.app_id && (
                  <p className="mt-1 text-xs text-status-error">
                    {errors.app_id}
                  </p>
                )}
                {isEditMode && (
                  <p className="mt-1 text-xs text-content-tertiary">
                    비워두면 기존 값 유지
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  App Password {!isEditMode && "*"}
                </label>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  disabled={readOnly}
                  placeholder="Client Secret"
                  className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.app_password ? "border-status-error" : "border-line"
                  }`}
                />
                {errors.app_password && (
                  <p className="mt-1 text-xs text-status-error">
                    {errors.app_password}
                  </p>
                )}
                {isEditMode && (
                  <p className="mt-1 text-xs text-content-tertiary">
                    비워두면 기존 값 유지
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Team ID {!isEditMode && "*"}
                </label>
                <input
                  type="password"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={readOnly}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full px-3 py-2 bg-surface-base border rounded-lg text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.team_id ? "border-status-error" : "border-line"
                  }`}
                />
                {errors.team_id && (
                  <p className="mt-1 text-xs text-status-error">
                    {errors.team_id}
                  </p>
                )}
                <p className="mt-1 text-xs text-content-tertiary">
                  {isEditMode ? "비워두면 기존 값 유지 · " : ""}채널 조회,
                  메시지 라우팅에 필수
                </p>
              </div>

              {/* Microsoft Delegated Auth */}
              <div className="p-4 border border-line rounded-lg bg-surface-base space-y-3">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-content-primary">
                    Microsoft 계정 연결
                  </span>
                </div>
                <p className="text-xs text-content-tertiary">
                  Teams ↔ Slack 양방향 브리지에 필요합니다. Graph API Change
                  Notifications를 통해 Teams 메시지를 수신하고, 채널/DM/그룹
                  채팅 라우팅을 지원합니다.
                </p>
                {isEditMode ? (
                  msAuthConnected ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        {msUserId || "연결됨"}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!provider) return;
                          setMsAuthLoading(true);
                          try {
                            await providersApi.disconnectMicrosoftAuth(
                              provider.id,
                            );
                            setMsAuthConnected(false);
                            setMsUserId(null);
                          } finally {
                            setMsAuthLoading(false);
                          }
                        }}
                        disabled={readOnly || msAuthLoading}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-status-error hover:bg-status-error/10 border border-status-error/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Unlink className="w-3 h-3" />
                        연결 해제
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!provider) return;
                        const authToken = localStorage.getItem("token");
                        const url = `/api/auth/microsoft/login?account_id=${provider.id}&auth_token=${encodeURIComponent(authToken || "")}`;
                        window.open(
                          url,
                          "ms-oauth",
                          "width=600,height=700,popup=yes",
                        );
                      }}
                      disabled={readOnly}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Link className="w-4 h-4" />
                      Microsoft 계정 연결
                    </button>
                  )
                ) : (
                  <p className="text-xs text-content-secondary italic">
                    Provider 저장 후 Microsoft 계정을 연결할 수 있습니다.
                  </p>
                )}
              </div>
            </>
          )}

          {/* 고급 설정 (메시지 옵션) */}
          <div className="border border-line rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface-base hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-content-tertiary" />
                <span className="text-sm font-medium text-content-primary">
                  메시지 설정
                </span>
              </div>
              {showAdvancedSettings ? (
                <ChevronUp className="w-4 h-4 text-content-tertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-content-tertiary" />
              )}
            </button>
            {showAdvancedSettings && (
              <div className="p-4 border-t border-line space-y-3">
                {/* 닉네임 접두사 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefixMessagesWithNick}
                    onChange={(e) =>
                      setPrefixMessagesWithNick(e.target.checked)
                    }
                    disabled={readOnly}
                    className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-content-primary">
                    닉네임 접두사 표시
                  </span>
                </label>

                {/* 사용자 이름 표시 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useUsername}
                    onChange={(e) => setUseUsername(e.target.checked)}
                    disabled={readOnly}
                    className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-content-primary">
                    사용자 이름 사용
                  </span>
                </label>

                {/* 편집 비활성화 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editDisable}
                    onChange={(e) => setEditDisable(e.target.checked)}
                    disabled={readOnly}
                    className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-content-primary">
                    메시지 편집 비활성화
                  </span>
                </label>

                {/* 편집 접미사 */}
                {!editDisable && (
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">
                      편집 접미사
                    </label>
                    <input
                      type="text"
                      value={editSuffix}
                      onChange={(e) => setEditSuffix(e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-1.5 text-sm bg-surface-base border border-line rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}

                {/* Slack 전용 설정 */}
                {platform === "slack" && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noSendJoinPart}
                        onChange={(e) => setNoSendJoinPart(e.target.checked)}
                        disabled={readOnly}
                        className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
                      />
                      <span className="text-sm text-content-primary">
                        입장/퇴장 메시지 숨기기
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useApi}
                        onChange={(e) => setUseApi(e.target.checked)}
                        disabled={readOnly}
                        className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
                      />
                      <span className="text-sm text-content-primary">
                        API 모드 사용
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={(e) => setDebugMode(e.target.checked)}
                        disabled={readOnly}
                        className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
                      />
                      <span className="text-sm text-content-primary">
                        디버그 모드
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 기능 선택 (카탈로그 로드 완료 시) */}
          {featureCatalog && featureCatalog.length > 0 && (
            <div className="border border-line rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowFeatureSelector(!showFeatureSelector)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-base hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-content-primary">
                    기능 설정
                  </span>
                  <span className="text-xs text-content-tertiary">
                    {selectedFeatureCount}/{catalogForPlatform.length}개 활성화
                  </span>
                </div>
                {showFeatureSelector ? (
                  <ChevronUp className="w-4 h-4 text-content-tertiary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-content-tertiary" />
                )}
              </button>
              {showFeatureSelector && (
                <div className="p-4 border-t border-line">
                  <FeatureSelector
                    platform={platform}
                    features={featureCatalog}
                    categoryLabels={categoryLabels}
                    selectedFeatures={enabledFeatures}
                    onChange={setEnabledFeatures}
                    disabled={readOnly}
                  />
                </div>
              )}
            </div>
          )}

          {/* 활성화 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={readOnly}
              className="w-4 h-4 text-brand-500 border-line rounded focus:ring-brand-500"
            />
            <label htmlFor="enabled" className="text-sm text-content-primary">
              활성화
            </label>
          </div>

          {/* 가이드 토글 */}
          <div>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-sm text-brand-500 hover:text-brand-600"
            >
              {platform === "slack" ? "Slack" : "Teams"} 토큰 발급 방법{" "}
              {showGuide ? "숨기기" : "보기"}
            </button>
            {showGuide && (
              <div className="mt-2 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg text-xs text-content-secondary space-y-1">
                {platform === "slack" ? (
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      <a
                        href="https://api.slack.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline"
                      >
                        Slack API
                      </a>
                      에서 앱 생성
                    </li>
                    <li>OAuth & Permissions에서 Bot Token Scopes 설정</li>
                    <li>Install App to Workspace</li>
                    <li>Bot User OAuth Token 복사 (xoxb-)</li>
                    <li>Socket Mode 활성화 → App Token 생성 (xapp-)</li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Azure Portal → Azure AD → App registrations</li>
                    <li>New registration으로 앱 생성</li>
                    <li>API permissions → Microsoft Graph 권한 추가</li>
                    <li>Certificates & secrets → Client secret 생성</li>
                    <li>Tenant ID, App ID, Secret 복사</li>
                  </ol>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-line">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary hover:bg-surface-hover rounded-button transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={readOnly || isLoading}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "저장 중..." : isEditMode ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
