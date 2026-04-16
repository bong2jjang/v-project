/**
 * UserMenu 컴포넌트
 *
 * 사용자 정보 및 액션 드롭다운 메뉴
 * - 사용자 정보 (이름, 역할)
 * - 프로필
 * - 비밀번호 변경
 * - 로그아웃
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";
import { getRoleDisplayName } from "../../api/types";
import { useTour } from "../../hooks/useTour";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { startMainTour } = useTour();

  // avatar_url이 바뀌면 에러 상태 초기화
  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar_url]);

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button - Sidebar용 (아이콘만) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center p-1.5 rounded-button text-content-tertiary hover:bg-surface-raised hover:text-content-primary transition-colors"
        title={`${user.username} (${getRoleDisplayName(user.role)})`}
      >
        {user.avatar_url && !avatarError ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="w-6 h-6 rounded-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-content-inverse font-medium text-xs">
            {user.username.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* Dropdown Menu - Sidebar 오른쪽으로 펼쳐짐 */}
      {isOpen && (
        <div className="absolute left-full bottom-0 ml-2 w-56 bg-surface-card border border-line rounded-card shadow-dropdown z-dropdown">
          {/* User Info */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
            {user.avatar_url && !avatarError ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-600 text-content-inverse font-semibold text-sm flex-shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-body-base font-medium text-content-primary truncate">
                {user.username}
              </p>
              <p className="text-caption text-content-secondary truncate">{user.email}</p>
              <p className="text-caption text-content-tertiary mt-0.5">
                {getRoleDisplayName(user.role)} 권한
              </p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                navigate("/profile");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              프로필
            </button>

            <button
              onClick={() => {
                navigate("/password-change");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              비밀번호 변경
            </button>
          </div>

          {/* Tour */}
          <div className="border-t border-line py-2">
            <button
              onClick={() => {
                setIsOpen(false);
                startMainTour();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-body-base text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors"
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              투어 다시 보기
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-line py-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-body-base text-status-danger hover:bg-status-danger-light transition-colors"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
