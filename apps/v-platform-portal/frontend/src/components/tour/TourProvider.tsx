/**
 * TourProvider 컴포넌트 — Portal 전용
 *
 * 앱 전체에서 투어 기능을 제공하고 초기 투어를 자동으로 시작
 * 플랫폼 TourContext에 실제 투어 함수를 주입
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { TourContextProvider } from "@v-platform/core/contexts/TourContext";
import { useTour } from "../../hooks/useTour";
import { useAuthStore } from "../../store/auth";

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const { startMainTour, startPageTour, resetAllTours, isMainTourCompleted } =
    useTour();

  // 첫 방문자에게 자동으로 메인 투어 시작
  useEffect(() => {
    if (!user) return;
    if (location.pathname !== "/") return;
    if (isMainTourCompleted()) return;

    const timer = setTimeout(() => {
      const hasRequiredElements =
        document.querySelector("[data-tour='sidebar']") &&
        document.querySelector("[data-tour='app-launcher']");

      if (hasRequiredElements) {
        startMainTour();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [user, location.pathname, isMainTourCompleted, startMainTour]);

  return (
    <TourContextProvider
      value={{
        startMainTour,
        startPageTour,
        resetAllTours,
        isRunning: false,
      }}
    >
      {children}
    </TourContextProvider>
  );
}
