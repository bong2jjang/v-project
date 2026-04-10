/**
 * PlatformIcon 컴포넌트
 *
 * 플랫폼별 아이콘을 표시하는 컴포넌트
 */

import type { Platform } from "../../lib/api/types";
import { PLATFORM_CONFIG } from "../../lib/utils/platform";

interface PlatformIconProps {
  platform: Platform;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PlatformIcon({
  platform,
  size = "md",
  className = "",
}: PlatformIconProps) {
  const config = PLATFORM_CONFIG[platform];

  const sizeClasses = {
    sm: "w-5 h-5 text-xs",
    md: "w-6 h-6 text-sm",
    lg: "w-8 h-8 text-base",
  };

  return (
    <span
      className={`inline-flex items-center justify-center ${sizeClasses[size]} ${config.bgColor} ${config.color} rounded ${className}`}
      title={config.label}
      aria-label={`${config.label} 플랫폼`}
    >
      {config.icon}
    </span>
  );
}
