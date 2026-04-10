import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { usePermissionStore } from "../store/permission";
import { useSystemSettingsStore } from "../store/systemSettings";
import { resolveStartPage } from "../lib/resolveStartPage";
import { isAdminRole } from "../lib/api/types";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * RBAC 권한 키 (서버 menu_item.permission_key)
   * 지정하면 해당 메뉴에 대한 read 이상 권한이 필요
   */
  permissionKey?: string;
  /**
   * 레거시: 관리자 역할 필요 여부
   * @deprecated permissionKey 사용 권장
   */
  requiredRole?: "admin";
}

/**
 * 권한 기반 라우트 보호 컴포넌트
 *
 * - `/` (루트) 접근 시 dashboard 권한 없으면 첫 번째 접근 가능 페이지로 자동 이동
 * - 다른 페이지 접근 시 권한 없으면 시작 페이지 fallback 후 최종적으로 /forbidden
 */
export function ProtectedRoute({
  children,
  permissionKey,
  requiredRole,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isInitialized } = useAuthStore();
  const { menus, isLoaded, canAccess } = usePermissionStore();
  const { settings } = useSystemSettingsStore();
  const location = useLocation();

  // 0. 초기화 대기 중
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-base">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  // 1. 인증 검사
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. 권한 데이터 로딩 대기
  if (permissionKey && !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-base">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  // 3. RBAC 권한 검사 (system_admin은 항상 통과)
  if (permissionKey && user?.role !== "system_admin") {
    if (!canAccess(permissionKey)) {
      // 루트 경로(/): 접근 가능한 첫 페이지로 자동 이동
      if (location.pathname === "/") {
        const firstAccessible = menus.find(
          (m) => m.permission_key !== permissionKey,
        );
        if (firstAccessible) {
          return <Navigate to={firstAccessible.path} replace />;
        }
        return <Navigate to="/forbidden" replace />;
      }

      // 비-루트 경로: 시작 페이지 fallback 체인 시도
      // (권한 변경으로 저장된 시작 페이지에 접근 불가한 경우 등)
      const fallback = resolveStartPage(
        "", // 현재 페이지가 이미 접근 불가이므로 개인 설정 무시
        settings?.default_start_page || "/",
        menus,
      );
      if (fallback !== location.pathname) {
        return <Navigate to={fallback} replace />;
      }
      return <Navigate to="/forbidden" replace />;
    }
  }

  // 4. 레거시 역할 검사 (requiredRole="admin")
  if (requiredRole === "admin" && !isAdminRole(user?.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
