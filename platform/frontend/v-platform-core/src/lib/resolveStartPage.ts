/**
 * 시작 페이지 권한 검증 유틸리티
 *
 * 사용자가 설정한 시작 페이지에 접근 권한이 없는 경우 (권한 변경 등)
 * 안전한 fallback 페이지를 반환합니다.
 *
 * 우선순위: 사용자 개인 설정 → 시스템 기본값 → "/"
 * 각 단계에서 접근 가능한 메뉴 목록에 포함되는지 확인합니다.
 */

import type { MenuItemResponse } from "../api/types";

/**
 * 접근 가능한 메뉴 목록을 기준으로, 실제 이동할 시작 페이지를 결정합니다.
 *
 * @param userStartPage - 사용자 개인 설정 (빈 문자열 = 시스템 기본값 사용)
 * @param systemDefault - 시스템 기본 시작 페이지
 * @param menus - 사용자가 접근 가능한 메뉴 목록 (RBAC 필터 적용 완료)
 * @returns 접근 가능한 시작 페이지 경로
 */
export function resolveStartPage(
  userStartPage: string,
  systemDefault: string,
  menus: MenuItemResponse[],
): string {
  const accessiblePaths = new Set(
    menus
      .filter((m) => m.menu_type !== "menu_group" && m.path)
      .map((m) => m.path),
  );

  // 1순위: 사용자 개인 설정 (권한 있을 때만)
  if (userStartPage && accessiblePaths.has(userStartPage)) {
    return userStartPage;
  }

  // 2순위: 시스템 기본값 (권한 있을 때만)
  if (
    systemDefault &&
    systemDefault !== "/" &&
    accessiblePaths.has(systemDefault)
  ) {
    return systemDefault;
  }

  // 3순위: 대시보드 (ProtectedRoute에서 추가 fallback 처리)
  return "/";
}
