/**
 * UserOAuthList Component
 *
 * 사용자 OAuth 연동 목록 (Settings 탭 내에서 사용)
 */

import { useEffect, useState } from "react";
import { useUserOAuthStore } from "../../stores/user-oauth";
import { UserOAuthCard } from "./UserOAuthCard";
import { Skeleton, SkeletonOAuthCard } from "../ui/Skeleton";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";

export function UserOAuthList() {
  const {
    oauthList,
    isLoading,
    error,
    fetchMyOAuth,
    disconnect,
    openConnectPopup,
    clearError,
  } = useUserOAuthStore();

  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);

  useEffect(() => {
    fetchMyOAuth();
  }, [fetchMyOAuth]);

  const handleConnect = (accountId: number) => {
    openConnectPopup(accountId);
  };

  const handleDisconnect = async (accountId: number) => {
    if (!confirm("이 플랫폼 연동을 해제하시겠습니까?")) return;

    setDisconnectingId(accountId);
    try {
      await disconnect(accountId);
    } finally {
      setDisconnectingId(null);
    }
  };

  if (isLoading && oauthList.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <SkeletonOAuthCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-heading-md text-content-primary mb-1">
          내 플랫폼 연동
        </h3>
        <p className="text-body-sm text-content-secondary">
          등록된 플랫폼 계정에 개인 OAuth를 연동하면, 브리지 메시지가 내
          이름으로 전송됩니다.
        </p>
      </div>

      {error && (
        <Alert variant="danger" onClose={clearError}>
          {error}
        </Alert>
      )}

      {oauthList.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          }
          title="연동 가능한 계정이 없습니다"
          description="관리자가 플랫폼 계정을 먼저 등록해야 합니다."
        />
      ) : (
        <div className="space-y-3">
          {oauthList.map((oauth) => (
            <UserOAuthCard
              key={`${oauth.account_id}-${oauth.platform}`}
              oauth={oauth}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isDisconnecting={disconnectingId === oauth.account_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
