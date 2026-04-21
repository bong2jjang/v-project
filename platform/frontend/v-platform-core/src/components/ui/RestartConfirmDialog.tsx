/**
 * Restart 확인 다이얼로그
 *
 * 설정 변경 후 앱 재시작 확인. 브랜드/앱 이름은 PlatformConfig에서 받음.
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { usePlatformConfig } from "../../providers/PlatformProvider";
import { useSystemSettingsStore } from "../../stores/systemSettings";

interface RestartConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRestarting?: boolean;
  title?: string;
  message?: string;
  error?: string | null;
  /** 컨테이너/서비스 이름 (docker 가이드에 표시) — 생략 시 appName 사용 */
  serviceName?: string;
}

export const RestartConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isRestarting = false,
  title,
  message,
  error = null,
  serviceName,
}: RestartConfirmDialogProps) => {
  const { appName, appTitle } = usePlatformConfig();
  const settings = useSystemSettingsStore((s) => s.settings);
  const displayName = settings?.app_title || appTitle || appName;
  const dockerName = serviceName || appName;
  const effectiveTitle = title ?? `${displayName} 재시작`;
  const effectiveMessage =
    message ??
    `설정이 변경되었습니다. 변경사항을 적용하려면 ${displayName}을(를) 재시작해야 합니다.`;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={!isRestarting ? onClose : undefined}
      />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-surface-card rounded-xl shadow-2xl max-w-lg w-full p-6 border border-stroke-subtle">
          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                error ? "bg-status-danger/10" : "bg-warning/10"
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 ${error ? "text-status-danger" : "text-warning"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-content-primary mb-1.5">
                {error ? "재시작 실패" : effectiveTitle}
              </h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                {error ? `${displayName} 재시작에 실패했습니다.` : effectiveMessage}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 space-y-3">
              <div className="p-4 bg-status-danger-light/50 rounded-lg border border-status-danger-border">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg
                      className="w-5 h-5 text-status-danger"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-status-danger mb-2">
                      오류 상세
                    </p>
                    <p className="text-sm text-content-secondary break-words leading-relaxed">
                      {error}
                    </p>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Guide */}
              {(error.includes("slack") ||
                error.includes("Slack") ||
                error.includes("token") ||
                error.includes("channel")) && (
                <div className="p-4 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-800">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-content-primary mb-3">
                        Slack 확인 사항
                      </p>
                      <ul className="space-y-2.5 text-sm text-content-secondary">
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            1
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">
                            Slack App 설정에서{" "}
                            <strong>"Bot User OAuth Token"</strong> 확인
                            (xoxb-로 시작)
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            2
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">
                            봇을 해당 채널에 초대 (
                            <code className="px-1.5 py-0.5 bg-surface-elevated rounded text-xs font-mono">
                              /invite @봇이름
                            </code>
                            )
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            3
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">
                            채널 ID가 정확한지 확인 (채널 우클릭 → 링크 복사)
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Teams Error Guide */}
              {(error.includes("teams") ||
                error.includes("Teams") ||
                error.includes("tenant") ||
                error.includes("app_id")) && (
                <div className="p-4 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-800">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-content-primary mb-3">
                        Microsoft Teams 확인 사항
                      </p>
                      <ul className="space-y-2.5 text-sm text-content-secondary">
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            1
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">
                            Azure Portal에서 <strong>Tenant ID</strong>,{" "}
                            <strong>App ID</strong>,{" "}
                            <strong>Client Secret</strong> 확인
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            2
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">
                            봇이 Teams 채널에 추가되어 있는지 확인
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            3
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">
                            봇 권한 설정 확인 (채널 읽기/쓰기 권한)
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Container Error Guide */}
              {(error.includes("no container") ||
                error.includes("container") ||
                error.includes("service")) && (
                <div className="p-4 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-800">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center mt-0.5">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-content-primary mb-3">
                        Docker 컨테이너 확인 사항
                      </p>
                      <ul className="space-y-2.5 text-sm text-content-secondary">
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            1
                          </span>
                          <div className="flex-1 pt-0.5">
                            <div className="leading-relaxed mb-1.5">
                              Docker Compose로 모든 서비스 재시작:
                            </div>
                            <code className="block px-2 py-1 bg-surface-elevated rounded text-xs font-mono">
                              docker compose up -d
                            </code>
                          </div>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            2
                          </span>
                          <div className="flex-1 pt-0.5">
                            <div className="leading-relaxed mb-1.5">
                              {dockerName} 컨테이너 상태 확인:
                            </div>
                            <code className="block px-2 py-1 bg-surface-elevated rounded text-xs font-mono">
                              {`docker ps -a | grep ${dockerName}`}
                            </code>
                          </div>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                            3
                          </span>
                          <div className="flex-1 pt-0.5">
                            <div className="leading-relaxed mb-1.5">
                              컨테이너 로그 확인:
                            </div>
                            <code className="block px-2 py-1 bg-surface-elevated rounded text-xs font-mono">
                              {`docker logs ${dockerName}`}
                            </code>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Generic Error Guide */}
              {!error.includes("slack") &&
                !error.includes("Slack") &&
                !error.includes("teams") &&
                !error.includes("Teams") &&
                !error.includes("token") &&
                !error.includes("channel") &&
                !error.includes("container") &&
                !error.includes("service") && (
                  <div className="p-4 bg-surface-elevated/50 rounded-lg border border-stroke-subtle">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center mt-0.5">
                        <svg
                          className="w-3 h-3 text-brand-600 dark:text-brand-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-content-tertiary leading-relaxed pt-0.5">
                        설정 탭에서 {displayName} 설정을 확인하거나, 대시보드에서
                        상세 로그를 확인해주세요.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Info Message (only when no error) */}
          {!error && (
            <div className="mb-5">
              <div className="p-4 bg-surface-elevated/50 rounded-lg border border-stroke-subtle">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center mt-0.5">
                    <svg
                      className="w-3 h-3 text-brand-600 dark:text-brand-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-content-tertiary leading-relaxed pt-0.5">
                    재시작 중에는 메시지 동기화가 일시적으로 중단됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-element-gap px-card-x py-card-y border-t border-line bg-surface-raised">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isRestarting}
              className="min-w-[110px]"
            >
              {error ? "닫기" : "나중에"}
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              loading={isRestarting}
              disabled={isRestarting}
              icon={<RefreshCw className="w-4 h-4" />}
              className="min-w-[110px]"
            >
              {isRestarting ? "재시작 중..." : error ? "다시 시도" : "재시작"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
