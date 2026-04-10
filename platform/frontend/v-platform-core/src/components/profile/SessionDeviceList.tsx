/**
 * SessionDeviceList 컴포넌트
 *
 * 로그인된 디바이스 목록 표시 및 관리
 * - 디바이스별 정보 표시
 * - 개별 디바이스 로그아웃
 * - 모든 디바이스 로그아웃
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveDevices, logoutDevice, logoutAll } from "../../api/auth";
import { useNotificationStore } from "../../stores/notification";
import type { DeviceInfo } from "../../api/types";
import { Smartphone, Monitor, Tablet, X, LogOut } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function SessionDeviceList() {
  const navigate = useNavigate();
  const { addNotification } = useNotificationStore();

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutingDeviceId, setLogoutingDeviceId] = useState<number | null>(
    null,
  );
  const [isLogoutingAll, setIsLogoutingAll] = useState(false);

  // 디바이스 목록 로드
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      const data = await getActiveDevices();
      setDevices(data);
    } catch (error) {
      console.error("Failed to load devices:", error);
      addNotification({
        id: `devices-load-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "디바이스 목록 로드 실패",
        message: "디바이스 목록을 불러오는데 실패했습니다.",
        source: "session_device_list",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutDevice = async (deviceId: number) => {
    try {
      setLogoutingDeviceId(deviceId);
      await logoutDevice(deviceId);

      addNotification({
        id: `device-logout-success-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "디바이스 로그아웃 성공",
        message: "해당 디바이스에서 로그아웃되었습니다.",
        source: "session_device_list",
        dismissible: true,
        persistent: false,
        read: false,
      });

      // 목록 새로고침
      await loadDevices();
    } catch (error) {
      console.error("Failed to logout device:", error);
      addNotification({
        id: `device-logout-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "디바이스 로그아웃 실패",
        message: "디바이스 로그아웃에 실패했습니다.",
        source: "session_device_list",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setLogoutingDeviceId(null);
    }
  };

  const handleLogoutAll = async () => {
    if (
      !confirm(
        "모든 디바이스에서 로그아웃하시겠습니까? 현재 세션도 종료됩니다.",
      )
    ) {
      return;
    }

    try {
      setIsLogoutingAll(true);
      await logoutAll();

      addNotification({
        id: `logout-all-success-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "success",
        category: "user",
        title: "모든 디바이스 로그아웃 성공",
        message: "모든 디바이스에서 로그아웃되었습니다.",
        source: "session_device_list",
        dismissible: true,
        persistent: false,
        read: false,
      });

      // 로그인 페이지로 이동
      navigate("/login");
    } catch (error) {
      console.error("Failed to logout all devices:", error);
      addNotification({
        id: `logout-all-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "user",
        title: "모든 디바이스 로그아웃 실패",
        message: "모든 디바이스 로그아웃에 실패했습니다.",
        source: "session_device_list",
        dismissible: true,
        persistent: false,
        read: false,
      });
    } finally {
      setIsLogoutingAll(false);
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (
      name.includes("mobile") ||
      name.includes("android") ||
      name.includes("ios")
    ) {
      return <Smartphone className="w-5 h-5" />;
    }
    if (name.includes("tablet") || name.includes("ipad")) {
      return <Tablet className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "알 수 없음";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "알 수 없음";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-content-secondary">로딩 중...</div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-content-secondary">활성 세션이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 디바이스 목록 */}
      <div className="space-y-3">
        {devices.map((device) => {
          const isCurrent =
            device.device_fingerprint ===
            localStorage.getItem("device_fingerprint");

          return (
            <div
              key={device.id}
              className="p-4 bg-surface-base border border-line rounded-card hover:border-line-hover transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* 디바이스 정보 */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* 아이콘 */}
                  <div className="flex-shrink-0 text-content-secondary mt-1">
                    {getDeviceIcon(device.device_name)}
                  </div>

                  {/* 상세 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-body-base font-medium text-content-primary truncate">
                        {device.device_name || "알 수 없는 디바이스"}
                      </p>
                      {isCurrent && (
                        <Badge variant="info" size="sm">
                          현재 디바이스
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-body-sm text-content-secondary">
                      <p>
                        <span className="font-medium">IP 주소:</span>{" "}
                        {device.ip_address || "알 수 없음"}
                      </p>
                      <p>
                        <span className="font-medium">마지막 활동:</span>{" "}
                        {formatDate(device.last_used_at)}
                      </p>
                      <p>
                        <span className="font-medium">로그인 시간:</span>{" "}
                        {formatDate(device.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                {!isCurrent && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleLogoutDevice(device.id)}
                    disabled={logoutingDeviceId === device.id}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {logoutingDeviceId === device.id
                      ? "로그아웃 중..."
                      : "로그아웃"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 모든 디바이스 로그아웃 버튼 */}
      {devices.length > 1 && (
        <div className="pt-2 border-t border-line">
          <Button
            variant="danger"
            onClick={handleLogoutAll}
            disabled={isLogoutingAll}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isLogoutingAll ? "로그아웃 중..." : "모든 디바이스에서 로그아웃"}
          </Button>
          <p className="text-caption text-content-tertiary mt-2">
            모든 디바이스에서 로그아웃하면 현재 세션도 종료됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
