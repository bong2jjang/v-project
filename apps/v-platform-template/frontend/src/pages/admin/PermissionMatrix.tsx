/**
 * PermissionManagement 페이지 (통합 권한 관리)
 *
 * 두 가지 뷰 모드:
 * 1. 사용자별 뷰 — 사용자/그룹 선택 → 전체 메뉴 권한 편집
 * 2. 메뉴별 뷰 — 메뉴 선택 → 전체 사용자 권한 편집
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, User, Menu } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import { usePermissionStore } from "../../store/permission";
import { Button } from "../../components/ui/Button";
import { Skeleton, SkeletonTableRow } from "../../components/ui/Skeleton";
import { Alert } from "../../components/ui/Alert";
import { UserPermissionView } from "../../components/admin/permissions/UserPermissionView";
import { MenuPermissionView } from "../../components/admin/permissions/MenuPermissionView";
import type { MenuItemResponse, User as UserType } from "../../lib/api/types";
import * as permissionApi from "../../lib/api/permissions";
import * as usersApi from "../../lib/api/users";

type ViewMode = "user" | "menu";

export default function PermissionMatrix() {
  const canEdit = usePermissionStore().canWrite("permission_management");
  const [viewMode, setViewMode] = useState<ViewMode>("user");
  const [menus, setMenus] = useState<MenuItemResponse[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allMenusRes, usersRes] = await Promise.all([
        permissionApi.getAllMenus(),
        usersApi.getUsers({ per_page: 1000 }),
      ]);
      setMenus(allMenusRes.menus);
      setUsers(usersRes.users);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(`데이터를 불러올 수 없습니다: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <>
        <ContentHeader
          title="권한 관리"
          description="사용자별·메뉴별 접근 권한 설정"
        />
        <div className="page-container space-y-section-gap">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <div className="border border-line rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  {[1, 2, 3, 4].map((i) => (
                    <th key={i} className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={4} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHeader
        title="권한 관리"
        description="사용자별·메뉴별 접근 권한 설정"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchData}
          >
            새로고침
          </Button>
        }
      />

      <div className="page-container space-y-section-gap">
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 뷰 전환 탭 */}
        <div className="flex items-center gap-1 p-1 bg-surface-raised rounded-lg w-fit">
          <button
            onClick={() => setViewMode("user")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${viewMode === "user" ? "bg-surface-card text-content-primary shadow-sm" : "text-content-secondary hover:text-content-primary"}
            `}
          >
            <User className="w-4 h-4" />
            사용자별 뷰
          </button>
          <button
            onClick={() => setViewMode("menu")}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${viewMode === "menu" ? "bg-surface-card text-content-primary shadow-sm" : "text-content-secondary hover:text-content-primary"}
            `}
          >
            <Menu className="w-4 h-4" />
            메뉴별 뷰
          </button>
        </div>

        {/* 뷰 콘텐츠 */}
        {viewMode === "user" ? (
          <UserPermissionView menus={menus} users={users} readOnly={!canEdit} />
        ) : (
          <MenuPermissionView menus={menus} readOnly={!canEdit} />
        )}
      </div>
    </>
  );
}
