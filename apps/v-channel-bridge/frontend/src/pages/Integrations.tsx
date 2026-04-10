/**
 * Integrations 페이지
 *
 * 내 OAuth 연동 + 관리자 플랫폼/OAuth 관리를 하나의 페이지로 통합
 */

import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { usePermissionStore } from "../store/permission";
import { isAdminRole } from "../lib/api/types";
import { UserOAuthList } from "../components/oauth/UserOAuthList";
import { AdminOAuthOverview } from "../components/oauth/AdminOAuthOverview";
import { ProviderList } from "../components/providers/ProviderList";
import { ProviderModal } from "../components/providers/ProviderModal";
import { Card, CardBody } from "../components/ui/Card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/Tabs";
import { ContentHeader } from "../components/Layout";
import { ProviderResponse } from "../lib/api/providers";

const Integrations = () => {
  const { user } = useAuthStore();
  const isAdmin = isAdminRole(user?.role);
  const canEdit = usePermissionStore().canWrite("integrations");
  const [activeTab, setActiveTab] = useState<string>("my-oauth");

  // Provider 모달 상태
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<ProviderResponse | null>(null);

  // URL 해시로 탭 전환
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const allowedTabs = isAdmin
        ? ["my-oauth", "providers", "oauth-admin"]
        : ["my-oauth"];

      if (hash && allowedTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isAdmin]);

  // Provider 모달 핸들러
  const handleAddProvider = () => {
    setEditingProvider(null);
    setIsProviderModalOpen(true);
  };

  const handleEditProvider = (provider: ProviderResponse) => {
    setEditingProvider(provider);
    setIsProviderModalOpen(true);
  };

  const handleCloseProviderModal = () => {
    setIsProviderModalOpen(false);
    setEditingProvider(null);
  };

  return (
    <>
      <ContentHeader
        title="연동 관리"
        description="플랫폼 계정 연동 및 OAuth 토큰 관리"
      />

      <div className="page-container space-y-section-gap">
        <Card>
          <CardBody>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                {/* 내 연동 (모든 사용자) */}
                <TabsTrigger
                  value="my-oauth"
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
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                  }
                >
                  내 연동
                </TabsTrigger>

                {/* 플랫폼 연동 (관리자) */}
                {isAdmin && (
                  <TabsTrigger
                    value="providers"
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
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    }
                  >
                    플랫폼 연동
                  </TabsTrigger>
                )}

                {/* OAuth 관리 (관리자) */}
                {isAdmin && (
                  <TabsTrigger
                    value="oauth-admin"
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
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    }
                  >
                    OAuth 관리
                  </TabsTrigger>
                )}
              </TabsList>

              {/* 내 연동 탭 */}
              <TabsContent value="my-oauth">
                <UserOAuthList />
              </TabsContent>

              {/* 플랫폼 연동 탭 */}
              {isAdmin && (
                <TabsContent value="providers">
                  <ProviderList
                    onAddProvider={handleAddProvider}
                    onEditProvider={handleEditProvider}
                    readOnly={!canEdit}
                  />
                </TabsContent>
              )}

              {/* OAuth 관리 탭 */}
              {isAdmin && (
                <TabsContent value="oauth-admin">
                  <AdminOAuthOverview readOnly={!canEdit} />
                </TabsContent>
              )}
            </Tabs>
          </CardBody>
        </Card>
      </div>

      {/* Provider Modal */}
      <ProviderModal
        isOpen={isProviderModalOpen}
        onClose={handleCloseProviderModal}
        provider={editingProvider}
        readOnly={!canEdit}
      />
    </>
  );
};

export default Integrations;
