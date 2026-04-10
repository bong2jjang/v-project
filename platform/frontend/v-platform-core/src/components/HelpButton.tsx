/**
 * HelpButton 컴포넌트
 *
 * 전역 헬프 버튼 (Product Tour 접근)
 * - 전체 투어 시작
 * - 현재 페이지 가이드
 * - 도움말 센터 링크
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTour } from "../hooks/useTour";
import { useSystemSettingsStore } from "../stores/systemSettings";

export function HelpButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { startMainTour, startPageTour } = useTour();
  const { settings } = useSystemSettingsStore();

  // 현재 페이지명 추출
  const getCurrentPage = ():
    | "dashboard"
    | "channels"
    | "messages"
    | "settings"
    | "statistics"
    | null => {
    const path = location.pathname;
    if (path === "/") return "dashboard";
    if (path.startsWith("/channels")) return "channels";
    if (path.startsWith("/messages")) return "messages";
    if (path.startsWith("/statistics")) return "statistics";
    if (path.startsWith("/settings")) return "settings";
    return null;
  };

  const currentPage = getCurrentPage();

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        data-tour="help-button"
        onClick={() => setMenuOpen(!menuOpen)}
        title="도움말"
        className="p-1.5 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-raised transition-colors duration-normal"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface-card border border-line rounded-card shadow-modal z-dropdown">
          <div className="py-1">
            {/* 전체 투어 */}
            <button
              onClick={() => {
                setMenuOpen(false);
                startMainTour();
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-surface-raised transition-colors flex items-center gap-3"
            >
              <svg
                className="w-5 h-5 text-brand-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <div className="flex-1">
                <div className="text-body-sm font-medium text-content-primary">
                  전체 투어 시작
                </div>
                <div className="text-label-sm text-content-tertiary">
                  주요 기능 둘러보기
                </div>
              </div>
            </button>

            {/* 현재 페이지 가이드 */}
            {currentPage && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  startPageTour(currentPage);
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-surface-raised transition-colors flex items-center gap-3"
              >
                <svg
                  className="w-5 h-5 text-status-info"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-content-primary">
                    현재 페이지 가이드
                  </div>
                  <div className="text-label-sm text-content-tertiary">
                    {currentPage === "dashboard" && "대시보드 기능 안내"}
                    {currentPage === "channels" && "채널 관리 안내"}
                    {currentPage === "messages" && "메시지 히스토리 안내"}
                    {currentPage === "statistics" && "통계 기능 안내"}
                    {currentPage === "settings" && "설정 페이지 안내"}
                  </div>
                </div>
              </button>
            )}

            <div className="my-1 border-t border-line" />

            {/* 도움말 센터 — 시스템 설정의 매뉴얼 URL로 이동 */}
            {settings?.manual_enabled && settings?.manual_url && (
              <a
                href={settings.manual_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="w-full px-4 py-2.5 text-left hover:bg-surface-raised transition-colors flex items-center gap-3"
              >
                <svg
                  className="w-5 h-5 text-content-tertiary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-content-primary">
                    도움말 센터
                  </div>
                  <div className="text-label-sm text-content-tertiary">
                    사용 가이드 및 FAQ
                  </div>
                </div>
                <svg
                  className="w-3.5 h-3.5 text-content-tertiary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
