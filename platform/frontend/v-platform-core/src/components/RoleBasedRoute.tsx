/**
 * RoleBasedRoute 컴포넌트
 *
 * 역할 기반 라우트 가드
 * - 로그인하지 않은 사용자: /login으로 리다이렉트
 * - 권한 없는 사용자: /403으로 리다이렉트
 * - 권한 있는 사용자: 자식 컴포넌트 렌더링
 */

import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/auth";

export type UserRole = "admin" | "user";

interface RoleBasedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function RoleBasedRoute({
  children,
  allowedRoles,
}: RoleBasedRouteProps) {
  const { user } = useAuthStore();

  // 로그인하지 않은 경우
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 특정 역할이 필요한 경우, 권한 확인
  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) {
    return <Navigate to="/403" replace />;
  }

  // 권한이 있는 경우, 자식 컴포넌트 렌더링
  return <>{children}</>;
}
