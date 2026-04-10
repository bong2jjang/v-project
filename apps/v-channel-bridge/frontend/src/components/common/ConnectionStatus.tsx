/**
 * ConnectionStatus 컴포넌트
 *
 * WebSocket 연결 상태 표시
 */

import { Badge } from "../ui/Badge";

export interface ConnectionStatusProps {
  isConnected: boolean;
  reconnectCount?: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ConnectionStatus({
  isConnected,
  reconnectCount = 0,
  showLabel = true,
  size = "sm",
}: ConnectionStatusProps) {
  const iconSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (!showLabel) {
    // Icon only
    return (
      <div
        className={`${iconSize} rounded-full ${
          isConnected
            ? "bg-green-500"
            : reconnectCount > 0
              ? "bg-yellow-500"
              : "bg-red-500"
        } ${!isConnected && "animate-pulse"}`}
        title={
          isConnected
            ? "Connected"
            : reconnectCount > 0
              ? `Reconnecting... (attempt ${reconnectCount})`
              : "Disconnected"
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${iconSize} rounded-full ${
          isConnected
            ? "bg-green-500"
            : reconnectCount > 0
              ? "bg-yellow-500"
              : "bg-red-500"
        } ${!isConnected && "animate-pulse"}`}
      />
      <span className={`${textSize} text-content-secondary`}>
        {isConnected
          ? "Connected"
          : reconnectCount > 0
            ? `Reconnecting... (${reconnectCount})`
            : "Disconnected"}
      </span>
    </div>
  );
}

export interface ConnectionStatusBadgeProps {
  isConnected: boolean;
  reconnectCount?: number;
}

export function ConnectionStatusBadge({
  isConnected,
  reconnectCount = 0,
}: ConnectionStatusBadgeProps) {
  const variant = isConnected
    ? "success"
    : reconnectCount > 0
      ? "warning"
      : "danger";

  const label = isConnected
    ? "Live"
    : reconnectCount > 0
      ? "Reconnecting..."
      : "Offline";

  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
