/**
 * useKeyboardShortcuts Hook
 *
 * 전역 키보드 단축키 관리
 *
 * 단축키:
 * - Shift + ?: 도움말 페이지 열기
 * - Ctrl/Cmd + Shift + T: 메인 투어 시작
 */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTour } from "./useTour";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startMainTour } = useTour();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Shift + ? (도움말 페이지)
      if (event.shiftKey && event.key === "?") {
        event.preventDefault();
        navigate("/help");
        return;
      }

      // Ctrl/Cmd + Shift + T (메인 투어)
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "T"
      ) {
        event.preventDefault();
        startMainTour();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate, location, startMainTour]);
}
