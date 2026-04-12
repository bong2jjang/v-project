/**
 * SystemSettingsTab Component
 *
 * 시스템 전역 설정 (메뉴얼 링크 등)
 */

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Home, Save, Palette } from "lucide-react";
import { useSystemSettingsStore } from "../../stores/systemSettings";
import { usePermissionStore } from "../../stores/permission";
import { useNotificationStore } from "../../stores/notification";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { InfoBox } from "../ui/InfoBox";

export function SystemSettingsTab({ readOnly }: { readOnly?: boolean }) {
  const { settings, isLoading, error, updateSettings, clearError } =
    useSystemSettingsStore();
  const { menus, isLoaded: permissionsLoaded } = usePermissionStore();
  const { addToast } = useNotificationStore();

  const [manualEnabled, setManualEnabled] = useState(
    settings?.manual_enabled ?? true,
  );
  const [manualUrl, setManualUrl] = useState(
    settings?.manual_url ?? "http://127.0.0.1:3000",
  );
  const [defaultStartPage, setDefaultStartPage] = useState(
    settings?.default_start_page ?? "/",
  );
  const [appTitle, setAppTitle] = useState(settings?.app_title ?? "");
  const [appDescription, setAppDescription] = useState(settings?.app_description ?? "");
  const [appLogoUrl, setAppLogoUrl] = useState(settings?.app_logo_url ?? "");
  const [isDirty, setIsDirty] = useState(false);

  // 시스템에서 사용 가능한 모든 페이지 목록 (menu_group 및 외부 링크 제외)
  const pageOptions = useMemo(() => {
    const options: { path: string; label: string }[] = [
      { path: "/", label: "대시보드" },
    ];
    if (!permissionsLoaded) return options;

    for (const menu of menus) {
      if (menu.menu_type === "menu_group") continue;
      if (menu.path && menu.path !== "/" && !menu.path.startsWith("http")) {
        options.push({ path: menu.path, label: menu.label });
      }
    }
    return options;
  }, [menus, permissionsLoaded]);

  // settings가 로드되면 로컬 상태 업데이트
  useEffect(() => {
    if (settings) {
      setManualEnabled(settings.manual_enabled);
      setManualUrl(settings.manual_url);
      setDefaultStartPage(settings.default_start_page);
      setAppTitle(settings.app_title ?? "");
      setAppDescription(settings.app_description ?? "");
      setAppLogoUrl(settings.app_logo_url ?? "");
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings({
        manual_enabled: manualEnabled,
        manual_url: manualUrl,
        default_start_page: defaultStartPage,
        app_title: appTitle || undefined,
        app_description: appDescription || undefined,
        app_logo_url: appLogoUrl || undefined,
      });
      addToast({
        id: `system-settings-saved-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "system",
        title: "설정 저장 완료",
        message: "시스템 설정이 저장되었습니다.",
        source: "system_settings",
        dismissible: true,
        persistent: false,
        read: false,
      });
      setIsDirty(false);
    } catch (err) {
      // Error handled by store
    }
  };

  const handleManualEnabledChange = (enabled: boolean) => {
    setManualEnabled(enabled);
    setIsDirty(true);
  };

  const handleManualUrlChange = (url: string) => {
    setManualUrl(url);
    setIsDirty(true);
  };

  return (
    <div className="space-y-section-gap">
      {error && (
        <Alert variant="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* 시작 페이지 설정 */}
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3 mb-4">
          <Home className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              기본 시작 페이지
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              모든 사용자가 로그인 시 처음 이동할 기본 페이지를 설정합니다.
              사용자가 개인 프로필에서 별도로 시작 페이지를 지정한 경우, 개인
              설정이 우선 적용됩니다.
            </p>

            <div className="space-y-4">
              {/* 시작 페이지 선택 */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  시작 페이지
                </label>
                <select
                  value={defaultStartPage}
                  onChange={(e) => {
                    setDefaultStartPage(e.target.value);
                    setIsDirty(true);
                  }}
                  disabled={readOnly}
                  className="
                    w-full px-3 py-2 bg-surface-base border border-line rounded-input
                    text-content-primary
                    focus:outline-none focus:ring-2 focus:ring-brand-500
                  "
                >
                  {pageOptions.map((opt) => (
                    <option key={opt.path} value={opt.path}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-content-tertiary mt-2">
                  개인 시작 페이지를 설정하지 않은 사용자에게 적용됩니다.
                </p>
              </div>

              {/* 우선순위 안내 */}
              <div className="p-3 bg-surface-raised rounded-lg">
                <p className="text-xs font-medium text-content-secondary mb-1.5">
                  시작 페이지 적용 우선순위
                </p>
                <ol className="text-xs text-content-tertiary space-y-1 list-decimal list-inside">
                  <li>사용자 개인 설정 (프로필 &gt; 시작 페이지에서 설정)</li>
                  <li>시스템 기본값 (이 설정)</li>
                  <li>대시보드 (&quot;/&quot;)</li>
                </ol>
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={readOnly || !isDirty || isLoading}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메뉴얼 설정 */}
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              메뉴얼 설정
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              Topbar에 메뉴얼 바로가기 버튼 표시 여부 및 URL을 설정합니다.
            </p>

            <div className="space-y-4">
              {/* 메뉴얼 표시 토글 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-content-primary">
                    메뉴얼 링크 표시
                  </label>
                  <p className="text-xs text-content-tertiary mt-1">
                    Topbar 우측에 메뉴얼 바로가기 버튼을 표시합니다.
                  </p>
                </div>
                <button
                  onClick={() => handleManualEnabledChange(!manualEnabled)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                    ${manualEnabled ? "bg-brand-500" : "bg-surface-raised"}
                    ${readOnly ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                  disabled={readOnly}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${manualEnabled ? "translate-x-6" : "translate-x-1"}
                    `}
                  />
                </button>
              </div>

              {/* 메뉴얼 URL 입력 */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  메뉴얼 URL
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => handleManualUrlChange(e.target.value)}
                  placeholder="http://127.0.0.1:3000"
                  disabled={readOnly}
                  className="
                    w-full px-3 py-2 bg-surface-base border border-line rounded-input
                    text-content-primary placeholder-content-tertiary
                    focus:outline-none focus:ring-2 focus:ring-brand-500
                  "
                />
                <p className="text-xs text-content-tertiary mt-2">
                  프로덕션 환경에서는 실제 도메인으로 변경하세요. (예:
                  https://docs.vms-chat-ops.com)
                </p>
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={readOnly || !isDirty || isLoading}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 앱 브랜딩 설정 */}
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3 mb-4">
          <Palette className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              앱 브랜딩
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              로그인 페이지, TopBar에 표시되는 앱 이름과 설명을 설정합니다.
            </p>

            <div className="space-y-4">
              {/* 앱 타이틀 */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1">
                  앱 타이틀
                </label>
                <input
                  type="text"
                  value={appTitle}
                  onChange={(e) => { setAppTitle(e.target.value); setIsDirty(true); }}
                  disabled={readOnly}
                  placeholder="예: v-channel-bridge"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-content-tertiary mt-1">
                  TopBar 좌측과 로그인 페이지에 표시됩니다. 비어있으면 기본값을 사용합니다.
                </p>
              </div>

              {/* 앱 설명 */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1">
                  앱 설명
                </label>
                <input
                  type="text"
                  value={appDescription}
                  onChange={(e) => { setAppDescription(e.target.value); setIsDirty(true); }}
                  disabled={readOnly}
                  placeholder="예: Slack ↔ Teams 메시지 브리지"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-content-tertiary mt-1">
                  로그인 페이지 부제목으로 표시됩니다.
                </p>
              </div>

              {/* 로고 URL */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-1">
                  로고 이미지 URL (선택)
                </label>
                <input
                  type="text"
                  value={appLogoUrl}
                  onChange={(e) => { setAppLogoUrl(e.target.value); setIsDirty(true); }}
                  disabled={readOnly}
                  placeholder="https://example.com/logo.svg"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface-raised text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-content-tertiary mt-1">
                  TopBar 좌측 로고 이미지. 비어있으면 기본 아이콘을 사용합니다.
                </p>
                {appLogoUrl && (
                  <div className="mt-2 p-2 border border-line rounded-lg inline-block">
                    <img src={appLogoUrl} alt="Logo preview" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={readOnly || !isDirty || isLoading}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 안내 */}
      <InfoBox variant="info" title="시스템 설정 안내">
        <ul className="list-disc list-inside space-y-1 text-body-sm">
          <li>메뉴얼 링크는 모든 사용자에게 표시됩니다.</li>
          <li>URL은 http:// 또는 https://로 시작해야 합니다.</li>
          <li>개발 환경에서는 127.0.0.1:3000을 사용합니다.</li>
          <li>설정 변경은 즉시 적용되며, 관리자만 수정할 수 있습니다.</li>
        </ul>
      </InfoBox>
    </div>
  );
}
