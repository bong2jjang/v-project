/**
 * Dashboard 페이지 — v-platform-template
 *
 * 기본 대시보드. 앱별 위젯을 추가하세요.
 */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAuthStore } from "../store/auth";

interface HealthStatus {
  status: string;
  services: Record<string, { status: string; response_time_ms: number }>;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 환영 메시지 */}
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold text-content-primary">
                환영합니다, {user?.username || "사용자"}님
              </h2>
              <p className="mt-1 text-content-secondary">
                이 페이지는 앱 전용 대시보드 위젯을 추가할 수 있는 템플릿입니다.
              </p>
            </CardBody>
          </Card>

          {/* 시스템 상태 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>플랫폼</CardTitle>
              </CardHeader>
              <CardBody>
                <Badge variant={health?.status === "healthy" ? "success" : "danger"}>
                  {health?.status || "확인 중..."}
                </Badge>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>데이터베이스</CardTitle>
              </CardHeader>
              <CardBody>
                <Badge
                  variant={
                    health?.services?.database?.status === "healthy"
                      ? "success"
                      : "danger"
                  }
                >
                  {health?.services?.database?.status || "확인 중..."}
                </Badge>
                {health?.services?.database?.response_time_ms && (
                  <span className="ml-2 text-sm text-content-tertiary">
                    {health.services.database.response_time_ms.toFixed(1)}ms
                  </span>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Redis</CardTitle>
              </CardHeader>
              <CardBody>
                <Badge
                  variant={
                    health?.services?.redis?.status === "healthy"
                      ? "success"
                      : "danger"
                  }
                >
                  {health?.services?.redis?.status || "확인 중..."}
                </Badge>
                {health?.services?.redis?.response_time_ms && (
                  <span className="ml-2 text-sm text-content-tertiary">
                    {health.services.redis.response_time_ms.toFixed(1)}ms
                  </span>
                )}
              </CardBody>
            </Card>
          </div>

          {/* 앱 전용 위젯 추가 영역 */}
          <Card>
            <CardHeader>
              <CardTitle>앱 전용 영역</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-content-secondary">
                이 영역에 앱별 대시보드 위젯을 추가하세요.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
