/**
 * useKeyboardShortcuts Hook
 *
 * 전역 키보드 단축키 관리
 *
 * 단축키:
 * - Shift + ?: 헬프 메뉴 열기 (설정 > 도움말 탭)
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
      // Shift + ? (헬프 메뉴)
      if (event.shiftKey && event.key === "?") {
        event.preventDefault();
        // 이미 설정 페이지에 있으면 도움말 탭으로 이동하지 않음
        // URL에 해시를 사용하여 탭 전환
        if (location.pathname === "/settings") {
          // 설정 페이지에서는 help 탭 활성화를 위해 상태 전달
          window.location.hash = "#help";
        } else {
          navigate("/settings#help");
        }
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
