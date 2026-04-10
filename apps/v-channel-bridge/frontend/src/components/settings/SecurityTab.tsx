/**
 * Security Tab Component
 *
 * 보안 설정 - 활성 디바이스 관리 및 세션 관리
 */

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import * as authApi from "../../lib/api/auth";
import type { DeviceInfo } from "../../lib/api/types";
import {
  Smartphone,
  Monitor,
  Tablet,
  X,
  LogOut,
  AlertTriangle,
} from "lucide-react";

export function SecurityTab({ readOnly }: { readOnly?: boolean }) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadActiveDevices();
  }, []);

  const loadActiveDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getActiveDevices();
      setDevices(data);
    } catch (err) {
      setError("디바이스 목록을 불러오는데 실패했습니다.");
      console.error("Failed to load devices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: number) => {
    if (!confirm("이 디바이스에서 로그아웃하시겠습니까?")) {
      return;
    }

    try {
      await authApi.logoutDevice(deviceId);
      setSuccess("디바이스 로그아웃이 완료되었습니다.");
      setTimeout(() => setSuccess(null), 3000);
      // 목록 새로고침
      await loadActiveDevices();
    } catch (err) {
      setError("디바이스 로그아웃에 실패했습니다.");
      console.error("Failed to revoke device:", err);
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
      await authApi.logoutAll();
      // 로그인 페이지로 리다이렉트
      window.location.href = "/login";
    } catch (err) {
      setError("전체 로그아웃에 실패했습니다.");
      console.error("Failed to logout all devices:", err);
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

  return (
    <div className="space-y-section-gap">
      {/* 경고 메시지 */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* 활성 디바이스 섹션 */}
      <Card>
        <CardHeader
          title="활성 디바이스"
          description="현재 로그인되어 있는 모든 디바이스를 확인하고 관리할 수 있습니다."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={loadActiveDevices}
              disabled={isLoading}
            >
              {isLoading ? "로딩 중..." : "새로고침"}
            </Button>
          }
        />
        <CardBody>
          {isLoading && devices.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
              디바이스 목록을 불러오는 중...
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
              활성 디바이스가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device, index) => (
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
                          {index === 0 && (
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
                    {index !== 0 && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevokeDevice(device.id)}
                        disabled={readOnly}
                        className="flex-shrink-0"
                      >
                        <X className="w-4 h-4 mr-1" />
                        로그아웃
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 모든 디바이스 로그아웃 섹션 */}
      <Card>
        <CardHeader
          title="전체 로그아웃"
          description="모든 디바이스에서 로그아웃합니다. 현재 세션도 종료됩니다."
        />
        <CardBody>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-status-warning mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-body-base text-content-primary mb-4">
                이 작업은 모든 디바이스에서 현재 계정을 로그아웃시킵니다.
                계속하려면 다시 로그인해야 합니다.
              </p>
              <Button
                variant="danger"
                onClick={handleLogoutAll}
                disabled={readOnly}
              >
                <LogOut className="w-4 h-4 mr-2" />
                모든 디바이스에서 로그아웃
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
