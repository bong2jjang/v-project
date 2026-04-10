/**
 * NotificationSettings Component
 *
 * 알림 설정 (브라우저 알림 권한 관리)
 */

import { Bell, BellOff, Check } from "lucide-react";
import { useBrowserNotification } from "../../hooks/useBrowserNotification";

export function NotificationSettings() {
  const { isSupported, permission, requestPermission, isEnabled } =
    useBrowserNotification();

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  if (!isSupported) {
    return (
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3">
          <BellOff className="w-5 h-5 text-content-tertiary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              브라우저 알림
            </h3>
            <p className="text-sm text-content-secondary">
              이 브라우저는 데스크톱 알림을 지원하지 않습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-surface-card border border-line rounded-lg">
      <div className="flex items-start gap-3">
        <Bell className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-content-primary mb-2">
            브라우저 알림
          </h3>
          <p className="text-sm text-content-secondary mb-4">
            중요한 이벤트(긴급, 오류)를 데스크톱 알림으로 받을 수 있습니다.
          </p>

          <div className="space-y-3">
            {/* 현재 상태 */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-content-tertiary">현재 상태:</span>
              {permission === "granted" && (
                <span className="flex items-center gap-1.5 text-status-success">
                  <Check className="w-4 h-4" />
                  활성화됨
                </span>
              )}
              {permission === "denied" && (
                <span className="text-status-error">차단됨</span>
              )}
              {permission === "default" && (
                <span className="text-content-secondary">미설정</span>
              )}
            </div>

            {/* 권한 요청 버튼 */}
            {!isEnabled && (
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-button transition-colors text-sm font-medium"
                disabled={permission === "denied"}
              >
                {permission === "denied"
                  ? "브라우저 설정에서 권한을 허용해주세요"
                  : "알림 권한 요청"}
              </button>
            )}

            {permission === "denied" && (
              <p className="text-xs text-content-tertiary">
                브라우저 주소창의 자물쇠 아이콘을 클릭하여 알림 권한을 허용할 수
                있습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
