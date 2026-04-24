import { Navigate, Outlet } from "react-router-dom";
import { useWorkspaceStore } from "../../stores/workspace";
import { SpinnerOverlay } from "../ui/Spinner";

/**
 * v0.7 — 전역 WS 컨텍스트 기반 라우트 가드.
 *
 * URL에서 `:wid`를 읽지 않고 store의 `currentWorkspaceId`만으로 판단.
 * - 미초기화: 스피너
 * - 초기화 완료 & 선택된 WS 없음: /workspaces 로 리다이렉트
 * - 정상: <Outlet /> 렌더
 */
export function WorkspaceGate() {
  const { currentWorkspaceId, isLoading, initialized } = useWorkspaceStore();

  if (!initialized || isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-surface-page">
        <SpinnerOverlay label="워크스페이스 로딩 중..." />
      </div>
    );
  }

  if (!currentWorkspaceId) {
    return <Navigate to="/workspaces" replace />;
  }

  return <Outlet />;
}
