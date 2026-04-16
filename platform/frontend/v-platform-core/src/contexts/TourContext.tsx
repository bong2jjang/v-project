/**
 * TourContext — 투어 기능 의존성 주입
 *
 * 플랫폼 컴포넌트(Help, HelpButton, Layout, UserMenu)는 이 컨텍스트를 통해
 * 투어 함수를 사용합니다. 앱의 TourProvider가 실제 Driver.js 구현을 주입하면
 * 플랫폼 컴포넌트가 자동으로 동작합니다.
 *
 * 앱이 TourContextProvider로 감싸지 않으면 no-op 기본값이 사용됩니다.
 */

import { createContext, useContext, type ReactNode } from "react";

export interface TourContextValue {
  startMainTour: () => void;
  startPageTour: (page: string) => void;
  resetAllTours: () => void;
  isRunning: boolean;
}

const defaultValue: TourContextValue = {
  startMainTour: () => {},
  startPageTour: () => {},
  resetAllTours: () => {},
  isRunning: false,
};

const TourContext = createContext<TourContextValue>(defaultValue);

export function TourContextProvider({
  value,
  children,
}: {
  value: TourContextValue;
  children: ReactNode;
}) {
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTourContext(): TourContextValue {
  return useContext(TourContext);
}
