/**
 * AdminOAuthOverview Component
 *
 * 관리자용 전체 사용자 OAuth 연동 현황
 */

import { useEffect, useState } from "react";
import { Trash2, RefreshCw, Users, Link2, Link2Off } from "lucide-react";
import { useUserOAuthStore } from "@/stores/user-oauth";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Skeleton, SkeletonCard, SkeletonTableRow } from "../ui/Skeleton";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";

export function AdminOAuthOverview({ readOnly }: { readOnly?: boolean }) {
  const {
    adminList,
    adminStats,
    isLoading,
    error,
    adminFetchAll,
    adminFetchStats,
    adminRevoke,
    clearError,
  } = useUserOAuthStore();

  const [revokingId, setRevokingId] = useState<number | null>(null);

  useEffect(() => {
    adminFetchAll();
    adminFetchStats();
  }, [adminFetchAll, adminFetchStats]);

  const handleRevoke = async (tokenId: number, userName: string) => {
    if (!confirm(`"${userName}"의 OAuth 연동을 강제 해제하시겠습니까?`)) return;

    setRevokingId(tokenId);
    try {
      await adminRevoke(tokenId);
      // 통계도 갱신
      await adminFetchStats();
    } finally {
      setRevokingId(null);
    }
  };

  const handleRefresh = () => {
    adminFetchAll();
    adminFetchStats();
  };

  if (isLoading && adminList.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="overflow-x-auto border border-line rounded-lg">
          <table className="w-full">
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-heading-md text-content-primary mb-1">
            사용자 OAuth 연동 현황
          </h3>
          <p className="text-body-sm text-content-secondary">
            전체 사용자의 플랫폼 연동 상태를 관리합니다.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          새로고침
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* 통계 카드 */}
      {adminStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-card border border-line rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-4 h-4 text-content-tertiary" />
              <span className="text-caption text-content-tertiary">전체</span>
            </div>
            <span className="text-2xl font-bold text-content-primary">
              {adminStats.total}
            </span>
          </div>
          <div className="p-4 bg-surface-card border border-line rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-status-success" />
              <span className="text-caption text-content-tertiary">활성</span>
            </div>
            <span className="text-2xl font-bold text-status-success">
              {adminStats.active}
            </span>
          </div>
          <div className="p-4 bg-surface-card border border-line rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Link2Off className="w-4 h-4 text-content-tertiary" />
              <span className="text-caption text-content-tertiary">비활성</span>
            </div>
            <span className="text-2xl font-bold text-content-secondary">
              {adminStats.inactive}
            </span>
          </div>
          <div className="p-4 bg-surface-card border border-line rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-caption text-content-tertiary">
                플랫폼별
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              {Object.entries(adminStats.by_platform).map(
                ([platform, count]) => (
                  <Badge
                    key={platform}
                    variant={platform === "slack" ? "info" : "default"}
                  >
                    {platform === "slack" ? "Slack" : "Teams"} {count}
                  </Badge>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {/* 연동 목록 테이블 */}
      {adminList.length === 0 ? (
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          title="사용자 OAuth 연동 없음"
          description="아직 OAuth를 연동한 사용자가 없습니다."
        />
      ) : (
        <div className="border border-line rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-raised border-b border-line">
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  사용자
                </th>
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  계정
                </th>
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  플랫폼
                </th>
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  플랫폼 이메일
                </th>
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  토큰 상태
                </th>
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  토큰 만료
                </th>
                <th className="text-left px-4 py-3 text-caption font-medium text-content-secondary">
                  마지막 사용
                </th>
                <th className="text-right px-4 py-3 text-caption font-medium text-content-secondary">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {adminList.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-content-primary font-medium">
                        {entry.user_name}
                      </div>
                      <div className="text-xs text-content-tertiary">
                        {entry.user_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    {entry.account_name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={entry.platform === "slack" ? "info" : "default"}
                    >
                      {entry.platform === "slack" ? "Slack" : "Teams"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    {entry.platform_email || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {entry.token_status === "active" ? (
                      <Badge variant="success" dot>
                        활성
                      </Badge>
                    ) : entry.token_status === "expired_refreshable" ? (
                      <Badge variant="info" dot>
                        자동 갱신 예정
                      </Badge>
                    ) : (
                      <Badge variant="danger" dot>
                        재연동 필요
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {entry.token_expires_at ? (
                      <span
                        className={
                          entry.token_status === "active"
                            ? "text-content-tertiary"
                            : entry.token_status === "expired_refreshable"
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-red-600 dark:text-red-400"
                        }
                      >
                        {new Date(entry.token_expires_at).toLocaleDateString(
                          "ko-KR",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    ) : (
                      <span className="text-content-tertiary">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-content-tertiary text-xs">
                    {entry.last_used_at
                      ? new Date(entry.last_used_at).toLocaleDateString(
                          "ko-KR",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(entry.id, entry.user_name)}
                      disabled={readOnly || revokingId === entry.id}
                      className="p-1.5 hover:bg-status-danger-light rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="강제 해제"
                    >
                      {revokingId === entry.id ? (
                        <div className="w-4 h-4 border-2 border-status-danger border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-status-danger" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
