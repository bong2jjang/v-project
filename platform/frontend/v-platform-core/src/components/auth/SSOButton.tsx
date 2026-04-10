/**
 * SSO Login Button
 *
 * SSO Provider 정보를 받아 로그인 버튼을 렌더링합니다.
 * Provider의 icon 필드에 따라 적절한 아이콘을 표시합니다.
 */

import { KeyRound, Building2, Shield, LogIn } from "lucide-react";
import type { SSOProviderInfo } from "../../lib/api/types";

interface SSOButtonProps {
  provider: SSOProviderInfo;
  onClick: () => void;
  disabled?: boolean;
}

/** Provider icon 필드에 따른 아이콘 매핑 */
function getProviderIcon(icon: string) {
  switch (icon) {
    case "microsoft":
      return <MicrosoftIcon />;
    case "key":
      return <KeyRound className="w-5 h-5" />;
    case "building":
      return <Building2 className="w-5 h-5" />;
    case "shield":
      return <Shield className="w-5 h-5" />;
    default:
      return <LogIn className="w-5 h-5" />;
  }
}

/** Microsoft 로고 SVG */
function MicrosoftIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function SSOButton({ provider, onClick, disabled }: SSOButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {getProviderIcon(provider.icon)}
      <span>{provider.display_name}(으)로 로그인</span>
    </button>
  );
}
