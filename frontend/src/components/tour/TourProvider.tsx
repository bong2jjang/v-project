/**
 * TourProvider 컴포넌트
 *
 * 앱 전체에서 투어 기능을 제공하고 초기 투어를 자동으로 시작
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTour } from "../../hooks/useTour";
import { useAuthStore } from "../../store/auth";

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const { startMainTour, isMainTourCompleted } = useTour();

  // 첫 방문자에게 자동으로 메인 투어 시작
  useEffect(() => {
    // 로그인한 사용자만
    if (!user) return;

    // 대시보드 페이지에서만
    if (location.pathname !== "/") return;

    // 메인 투어를 완료하지 않은 경우
    if (isMainTourCompleted()) return;

    // DOM이 완전히 로드된 후 투어 시작 (약간의 지연)
    const timer = setTimeout(() => {
      // 모든 투어 요소가 렌더링되었는지 확인
      const hasRequiredElements =
        document.querySelector("[data-tour='sidebar']") &&
        document.querySelector("[data-tour='provider-status']");

      if (hasRequiredElements) {
        startMainTour();
      }
    }, 1500); // 1.5초 후 시작 (페이지 로드 완료 대기)

    return () => clearTimeout(timer);
  }, [user, location.pathname, isMainTourCompleted, startMainTour]);

  return <>{children}</>;
}
