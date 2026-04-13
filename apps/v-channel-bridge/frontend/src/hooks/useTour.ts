/**
 * useTour 훅
 *
 * Product Tour 상태 관리 및 제어
 */

import { useCallback, useEffect } from "react";
import { driver, DriveStep, Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "../lib/tour/driver-theme.css";
import {
  mainTourSteps,
  channelsTourSteps,
  messagesTourSteps,
  settingsTourSteps,
  statisticsTourSteps,
} from "../lib/tour";

// LocalStorage 키
const TOUR_STORAGE = {
  MAIN_COMPLETED: "tour_main_completed",
  PAGE_SEEN: "tour_page_seen_",
};

type PageName =
  | "dashboard"
  | "channels"
  | "messages"
  | "settings"
  | "statistics";

let driverInstance: Driver | null = null;

/**
 * Driver.js 인스턴스 생성 (재사용 가능한 설정)
 */
function createDriver(onComplete?: () => void): Driver {
  // 기존 인스턴스가 활성화되어 있으면 종료
  if (driverInstance?.isActive()) {
    driverInstance.destroy();
  }

  driverInstance = driver({
    showProgress: true,
    progressText: "{{current}}/{{total}}",
    nextBtnText: "다음",
    prevBtnText: "이전",
    doneBtnText: "완료",
    popoverClass: "vms-tour",
    stagePadding: 8,
    stageRadius: 8,
    smoothScroll: true,
    onDestroyed: () => {
      // 투어 완료 콜백 실행
      if (onComplete) {
        onComplete();
      }
    },
  });

  return driverInstance;
}

export function useTour() {
  /**
   * 메인 투어 시작
   */
  const startMainTour = useCallback(() => {
    // 투어 완료 시 localStorage에 저장하는 콜백
    const onComplete = () => {
      localStorage.setItem(TOUR_STORAGE.MAIN_COMPLETED, "true");
    };

    const tourDriver = createDriver(onComplete);
    tourDriver.setSteps(mainTourSteps);
    tourDriver.drive();
  }, []);

  /**
   * 페이지별 투어 시작
   */
  const startPageTour = useCallback((pageName: PageName) => {
    let steps: DriveStep[] = [];

    switch (pageName) {
      case "channels":
        steps = channelsTourSteps;
        break;
      case "messages":
        steps = messagesTourSteps;
        break;
      case "settings":
        steps = settingsTourSteps;
        break;
      case "statistics":
        steps = statisticsTourSteps;
        break;
      default:
        steps = mainTourSteps;
    }

    // 페이지 투어 완료 시 localStorage에 저장하는 콜백
    const onComplete = () => {
      localStorage.setItem(TOUR_STORAGE.PAGE_SEEN + pageName, "true");
    };

    const tourDriver = createDriver(onComplete);
    tourDriver.setSteps(steps);
    tourDriver.drive();
  }, []);

  /**
   * 메인 투어 완료 여부 확인
   */
  const isMainTourCompleted = useCallback((): boolean => {
    return localStorage.getItem(TOUR_STORAGE.MAIN_COMPLETED) === "true";
  }, []);

  /**
   * 페이지 투어 본 적 있는지 확인
   */
  const isPageTourSeen = useCallback((pageName: PageName): boolean => {
    return localStorage.getItem(TOUR_STORAGE.PAGE_SEEN + pageName) === "true";
  }, []);

  /**
   * 투어 상태 초기화
   */
  const resetAllTours = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE.MAIN_COMPLETED);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(TOUR_STORAGE.PAGE_SEEN)) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  /**
   * 현재 활성 투어 중지
   */
  const stopTour = useCallback(() => {
    if (driverInstance?.isActive()) {
      driverInstance.destroy();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 투어 중지
      if (driverInstance?.isActive()) {
        driverInstance.destroy();
      }
    };
  }, []);

  return {
    startMainTour,
    startPageTour,
    isMainTourCompleted,
    isPageTourSeen,
    resetAllTours,
    stopTour,
  };
}
