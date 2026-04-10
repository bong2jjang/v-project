/**
 * Forbidden (403) 페이지
 *
 * 접근 권한이 없는 사용자가 페이지에 접근할 때 표시
 * - 접근 가능한 페이지가 있으면 해당 페이지로 안내
 * - 접근 가능한 페이지가 없으면 관리자 연락 안내 + 프로필/로그아웃 제공
 */

import { useNavigate } from "react-router-dom";
import { ShieldX, ArrowLeft, Home, UserCog, LogOut, User } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/auth";
import { usePermissionStore } from "../store/permission";
import { getRoleDisplayName } from "../lib/api/types";

export default function Forbidden() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { menus } = usePermissionStore();

  // 접근 가능한 첫 번째 페이지 (서버 메뉴 데이터 사용)
  const firstMenu = menus.length > 0 ? menus[0] : null;
  const hasAccessiblePage = firstMenu !== null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* 아이콘 */}
        <div className="flex justify-center">
          <div className="rounded-full bg-state-error-subtle p-6">
            <ShieldX className="h-16 w-16 text-state-error-emphasis" />
          </div>
        </div>

        {/* 헤딩 */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-content-primary">
            접근 권한 없음
          </h1>
          <p className="text-lg text-content-secondary">
            {hasAccessiblePage
              ? "이 페이지에 대한 접근 권한이 없습니다."
              : "현재 접근 가능한 페이지가 없습니다."}
          </p>
        </div>

        {/* 상세 정보 */}
        <div className="bg-surface-card rounded-lg p-6 space-y-4 border border-border-subtle">
          <div className="flex items-center gap-3 text-sm text-content-secondary">
            <UserCog className="h-5 w-5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-content-primary">현재 계정 정보</p>
              <p>
                {user?.username} ({getRoleDisplayName(user?.role)})
              </p>
            </div>
          </div>

          <div className="bg-state-warning-subtle border border-state-warning-emphasis rounded-md p-4 text-sm text-left">
            <p className="font-medium text-state-warning-emphasis mb-2">
              {hasAccessiblePage
                ? "이 기능에 대한 권한이 필요합니다"
                : "메뉴 접근 권한이 설정되지 않았습니다"}
            </p>
            <p className="text-content-secondary">
              {hasAccessiblePage
                ? "이 기능을 사용하려면 시스템 관리자에게 권한 부여를 요청하세요."
                : "시스템 관리자에게 연락하여 필요한 메뉴 권한을 요청해주세요. 권한이 부여되면 해당 페이지에 접근할 수 있습니다."}
            </p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {hasAccessiblePage ? (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate(-1)}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                이전 페이지로
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate(firstMenu.path)}
                icon={<Home className="h-4 w-4" />}
              >
                홈으로 이동
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => navigate("/profile")}
                icon={<User className="h-4 w-4" />}
              >
                내 프로필
              </Button>
              <Button
                variant="danger"
                onClick={handleLogout}
                icon={<LogOut className="h-4 w-4" />}
              >
                로그아웃
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
