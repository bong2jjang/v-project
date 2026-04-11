/**
 * Settings 페이지
 *
 * 사용자 설정 및 시스템 관리
 */

import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/auth";
import { usePermissionStore } from "../stores/permission";
import { isAdminRole, getRoleDisplayName } from "../api/types";
import { useSystemSettingsStore } from "../stores/systemSettings";
import { ThemeSettings } from "../components/settings/ThemeSettings";
import { SecurityTab } from "../components/settings/SecurityTab";
import { SessionSettings } from "../components/settings/SessionSettings";
import { SystemSettingsTab } from "../components/settings/SystemSettingsTab";
import NotificationManagement from "./admin/NotificationManagement";
import { Card, CardBody } from "../components/ui/Card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/Tabs";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { ContentHeader } from "../components/Layout";

const Settings = () => {
  const { user } = useAuthStore();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = isAdminRole(user?.role);
  const canEdit = usePermissionStore().canWrite("settings");
  // 모든 사용자: 개요 탭부터 시작
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { fetchSettings } = useSystemSettingsStore();

  // 초기 데이터 로딩 (모든 사용자는 systemSettings만)
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // URL 해시로 탭 전환 (키보드 단축키용)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // #help -> help
      // 공용 탭: overview, theme, session
      // 관리자 전용 탭: security, system
      const allowedTabs = isAdmin
        ? ["overview", "theme", "session", "security", "system", "notifications"]
        : ["overview", "theme", "session"];

      if (hash && allowedTabs.includes(hash)) {
        setActiveTab(hash);
      } else if (!hash) {
        // 해시가 없으면 기본값 "overview"로 설정
        setActiveTab("overview");
      }
    };

    // 초기 로드 시 해시 확인
    handleHashChange();

    // 해시 변경 감지
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [isAdmin]);

  return (
    <>
      <ContentHeader
        title="설정"
        description="사용자 설정 및 시스템 관리"
        actions={
          <div className="flex items-center gap-3">
            <Badge
              variant="info"
              className="bg-white/15 text-white border-white/25 dark:bg-surface-card dark:text-content-secondary dark:border-line-heavy"
            >
              v1.1.0
            </Badge>
          </div>
        }
      />

      <div className="page-container space-y-section-gap">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6">
            <Alert variant="success" onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6">
            <Alert variant="danger" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {/* 공통 설정 UI - 모든 사용자 */}
        <Card data-tour="settings-tabs">
          <CardBody>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                {/* 공용 탭 1: 개요 (제일 먼저 표시) */}
                <TabsTrigger
                  value="overview"
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  }
                >
                  개요
                </TabsTrigger>

                {/* 공용 탭 2: 테마 */}
                <TabsTrigger
                  value="theme"
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
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                  }
                >
                  테마
                </TabsTrigger>

                {/* 공용 탭 3: 세션 설정 */}
                <TabsTrigger
                  value="session"
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
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                >
                  세션
                </TabsTrigger>

                {/* 관리자 전용 탭 1: 보안 */}
                {isAdmin && (
                  <TabsTrigger
                    value="security"
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
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    }
                  >
                    보안
                  </TabsTrigger>
                )}

                {/* 관리자 전용 탭 2: 시스템 설정 */}
                {isAdmin && (
                  <TabsTrigger
                    value="system"
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
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    }
                  >
                    시스템 설정
                  </TabsTrigger>
                )}
                {isAdmin && (
                  <TabsTrigger
                    value="notifications"
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    }
                  >
                    알림 관리
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Overview Tab - 모든 사용자 (첫 번째) */}
              <TabsContent value="overview">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-heading-md text-content-primary mb-4">
                      시스템 정보
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 사용자 정보 */}
                      <div className="border border-line rounded-lg p-4">
                        <h4 className="text-heading-sm text-content-primary mb-3">
                          사용자 정보
                        </h4>
                        <dl className="space-y-2">
                          <div>
                            <dt className="text-xs text-content-secondary">
                              이름
                            </dt>
                            <dd className="text-sm text-content-primary">
                              {user?.username || "Unknown"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-content-secondary">
                              이메일
                            </dt>
                            <dd className="text-sm text-content-primary">
                              {user?.email || "Unknown"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-content-secondary">
                              역할
                            </dt>
                            <dd className="text-sm text-content-primary">
                              <Badge variant="info">
                                {getRoleDisplayName(user?.role)}
                              </Badge>
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* 애플리케이션 정보 */}
                      <div className="border border-line rounded-lg p-4">
                        <h4 className="text-heading-sm text-content-primary mb-3">
                          애플리케이션
                        </h4>
                        <dl className="space-y-2">
                          <div>
                            <dt className="text-xs text-content-secondary">
                              버전
                            </dt>
                            <dd className="text-sm font-mono text-content-primary">
                              v1.1.0
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-content-secondary">
                              아키텍처
                            </dt>
                            <dd className="text-sm text-content-primary">
                              Provider Pattern
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-content-secondary">
                              서비스
                            </dt>
                            <dd className="text-sm text-content-primary">
                              v-platform
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="bg-status-info-light border border-status-info-border rounded-lg p-4">
                    <div className="flex gap-2">
                      <svg
                        className="w-5 h-5 text-status-info flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="text-sm text-content-primary">
                        <p className="font-medium mb-1">도움말</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>
                            <strong>연동 관리</strong> 메뉴에서 Slack/Teams
                            계정을 관리할 수 있습니다
                          </li>
                          <li>
                            Route 관리는 <strong>채널 관리</strong> 페이지에서
                            할 수 있습니다
                          </li>
                          <li>변경사항은 즉시 적용됩니다 (재시작 불필요)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Theme Tab */}
              <TabsContent value="theme">
                <ThemeSettings />
              </TabsContent>

              {/* Session Tab */}
              <TabsContent value="session">
                <SessionSettings />
              </TabsContent>

              {/* Security Tab - 관리자 전용 */}
              {isAdmin && (
                <TabsContent value="security">
                  <SecurityTab readOnly={!canEdit} />
                </TabsContent>
              )}

              {/* System Settings Tab - 관리자 전용 */}
              {isAdmin && (
                <TabsContent value="system">
                  <SystemSettingsTab readOnly={!canEdit} />
                </TabsContent>
              )}
              {isAdmin && (
                <TabsContent value="notifications">
                  <NotificationManagement />
                </TabsContent>
              )}
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </>
  );
};

export default Settings;
