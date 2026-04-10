/**
 * SessionSettings Component
 *
 * 세션 관리 설정 (만료 경고, 자동 연장, Idle timeout)
 */

import { Bell, Zap, Timer } from "lucide-react";
import { useSessionSettingsStore } from "../../stores/sessionSettings";

export function SessionSettings() {
  const { settings, updateSettings, resetSettings } = useSessionSettingsStore();

  return (
    <div className="space-y-section-gap">
      {/* 토큰 만료 경고 설정 */}
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3 mb-4">
          <Bell className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              세션 만료 경고
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              세션이 곧 만료될 때 미리 알림을 받을 수 있습니다.
            </p>

            <div className="space-y-4">
              {/* 경고 활성화 */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-content-primary">
                  경고 알림 활성화
                </label>
                <button
                  onClick={() =>
                    updateSettings({ warningEnabled: !settings.warningEnabled })
                  }
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                    ${
                      settings.warningEnabled
                        ? "bg-brand-500"
                        : "bg-surface-raised"
                    }
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${settings.warningEnabled ? "translate-x-6" : "translate-x-1"}
                    `}
                  />
                </button>
              </div>

              {settings.warningEnabled && (
                <>
                  {/* 경고 시작 시간 */}
                  <div>
                    <label className="block text-sm font-medium text-content-primary mb-2">
                      경고 시작 시간
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[3, 5, 10].map((minutes) => (
                        <button
                          key={minutes}
                          onClick={() =>
                            updateSettings({ warningThresholdMinutes: minutes })
                          }
                          className={`
                            px-4 py-2 rounded-button text-sm font-medium transition-colors
                            ${
                              settings.warningThresholdMinutes === minutes
                                ? "bg-brand-500 text-white"
                                : "bg-surface-raised text-content-primary hover:bg-surface-elevated"
                            }
                          `}
                        >
                          {minutes}분 전
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-content-tertiary mt-2">
                      세션 만료 {settings.warningThresholdMinutes}분 전부터
                      경고를 표시합니다.
                    </p>
                  </div>

                  {/* 알림 반복 간격 */}
                  <div>
                    <label className="block text-sm font-medium text-content-primary mb-2">
                      알림 반복 간격
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((minutes) => (
                        <button
                          key={minutes}
                          onClick={() =>
                            updateSettings({ reminderIntervalMinutes: minutes })
                          }
                          className={`
                            px-4 py-2 rounded-button text-sm font-medium transition-colors
                            ${
                              settings.reminderIntervalMinutes === minutes
                                ? "bg-brand-500 text-white"
                                : "bg-surface-raised text-content-primary hover:bg-surface-elevated"
                            }
                          `}
                        >
                          {minutes}분마다
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-content-tertiary mt-2">
                      경고를 {settings.reminderIntervalMinutes}분마다
                      반복합니다.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 자동 연장 설정 */}
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3 mb-4">
          <Zap className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              자동 세션 연장
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              활동이 감지되면 자동으로 세션을 연장합니다.
            </p>

            <div className="space-y-4">
              {/* 자동 연장 활성화 */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-content-primary">
                  자동 연장 활성화
                </label>
                <button
                  onClick={() =>
                    updateSettings({
                      autoExtendEnabled: !settings.autoExtendEnabled,
                    })
                  }
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                    ${
                      settings.autoExtendEnabled
                        ? "bg-brand-500"
                        : "bg-surface-raised"
                    }
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${settings.autoExtendEnabled ? "translate-x-6" : "translate-x-1"}
                    `}
                  />
                </button>
              </div>

              {settings.autoExtendEnabled && (
                <div>
                  <label className="block text-sm font-medium text-content-primary mb-2">
                    자동 연장 시작 시간
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 5].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() =>
                          updateSettings({
                            autoExtendThresholdMinutes: minutes,
                          })
                        }
                        className={`
                          px-4 py-2 rounded-button text-sm font-medium transition-colors
                          ${
                            settings.autoExtendThresholdMinutes === minutes
                              ? "bg-brand-500 text-white"
                              : "bg-surface-raised text-content-primary hover:bg-surface-elevated"
                          }
                        `}
                      >
                        {minutes}분 전
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-content-tertiary mt-2">
                    만료 {settings.autoExtendThresholdMinutes}분 전부터 활동
                    감지 시 자동 연장합니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Idle Timeout 설정 */}
      <div className="p-6 bg-surface-card border border-line rounded-lg">
        <div className="flex items-start gap-3 mb-4">
          <Timer className="w-5 h-5 text-content-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary mb-2">
              비활성 시간 제한
            </h3>
            <p className="text-sm text-content-secondary mb-4">
              일정 시간 동안 활동이 없으면 자동으로 로그아웃됩니다.
            </p>

            <div className="space-y-4">
              {/* Idle timeout 활성화 */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-content-primary">
                  비활성 제한 활성화
                </label>
                <button
                  onClick={() =>
                    updateSettings({
                      idleTimeoutEnabled: !settings.idleTimeoutEnabled,
                    })
                  }
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                    ${
                      settings.idleTimeoutEnabled
                        ? "bg-brand-500"
                        : "bg-surface-raised"
                    }
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${settings.idleTimeoutEnabled ? "translate-x-6" : "translate-x-1"}
                    `}
                  />
                </button>
              </div>

              {settings.idleTimeoutEnabled && (
                <div>
                  <label className="block text-sm font-medium text-content-primary mb-2">
                    비활성 시간
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() =>
                          updateSettings({ idleTimeoutMinutes: minutes })
                        }
                        className={`
                          px-4 py-2 rounded-button text-sm font-medium transition-colors
                          ${
                            settings.idleTimeoutMinutes === minutes
                              ? "bg-brand-500 text-white"
                              : "bg-surface-raised text-content-primary hover:bg-surface-elevated"
                          }
                        `}
                      >
                        {minutes}분
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-content-tertiary mt-2">
                    {settings.idleTimeoutMinutes}분 동안 활동이 없으면 자동
                    로그아웃됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 기본값으로 초기화 */}
      <div className="flex justify-end">
        <button
          onClick={resetSettings}
          className="px-4 py-2 text-sm font-medium text-content-tertiary hover:text-content-primary transition-colors"
        >
          기본값으로 초기화
        </button>
      </div>
    </div>
  );
}
