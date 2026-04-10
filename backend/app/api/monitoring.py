"""모니터링 서비스 상태 체크 API"""

import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models.user import User
from app.utils.auth import require_permission

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


class ServiceHealth(BaseModel):
    """서비스 Health 상태"""

    service_id: str
    status: str  # healthy, warning, error, unknown
    response_time_ms: Optional[int] = None
    error: Optional[str] = None


# 모니터링 서비스 목록
SERVICES = [
    {
        "id": "prometheus",
        "url": "http://prometheus:9090/api/v1/status/runtimeinfo",
    },
    {"id": "grafana", "url": "http://grafana:3000/api/health"},
    {"id": "loki", "url": "http://loki:3100/ready"},
    {"id": "cadvisor", "url": "http://cadvisor:8080/healthz"},
    # Node Exporter와 Promtail은 health endpoint가 없으므로 metrics endpoint 사용
    {"id": "node_exporter", "url": "http://node_exporter:9100/metrics"},
]


@router.get("/health")
async def check_all_services(
    current_user: User = Depends(require_permission("monitoring", "read")),
) -> list[ServiceHealth]:
    """
    모든 모니터링 서비스의 Health 상태 확인

    Returns:
        각 서비스의 상태 정보 리스트
    """
    results = []

    async with httpx.AsyncClient(timeout=2.0) as client:
        for service in SERVICES:
            try:
                start = time.time()
                response = await client.get(service["url"])
                elapsed_ms = int((time.time() - start) * 1000)

                if response.status_code == 200:
                    # 응답시간이 2초 이상이면 경고
                    status = "healthy" if elapsed_ms < 2000 else "warning"
                    results.append(
                        ServiceHealth(
                            service_id=service["id"],
                            status=status,
                            response_time_ms=elapsed_ms,
                        )
                    )
                else:
                    results.append(
                        ServiceHealth(
                            service_id=service["id"],
                            status="error",
                            error=f"HTTP {response.status_code}",
                        )
                    )
            except httpx.TimeoutException:
                results.append(
                    ServiceHealth(
                        service_id=service["id"],
                        status="error",
                        error="Request timeout",
                    )
                )
            except Exception as e:
                results.append(
                    ServiceHealth(
                        service_id=service["id"],
                        status="error",
                        error=str(e),
                    )
                )

    return results


@router.get("/health/{service_id}")
async def check_service_health(
    service_id: str,
    current_user: User = Depends(require_permission("monitoring", "read")),
) -> ServiceHealth:
    """
    특정 모니터링 서비스의 Health 상태 확인

    Args:
        service_id: 서비스 ID (prometheus, grafana, loki, cadvisor, node_exporter)

    Returns:
        서비스 상태 정보
    """
    service = next((s for s in SERVICES if s["id"] == service_id), None)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    try:
        start = time.time()
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(service["url"])
            elapsed_ms = int((time.time() - start) * 1000)

            if response.status_code == 200:
                status = "healthy" if elapsed_ms < 2000 else "warning"
                return ServiceHealth(
                    service_id=service_id,
                    status=status,
                    response_time_ms=elapsed_ms,
                )
            else:
                return ServiceHealth(
                    service_id=service_id,
                    status="error",
                    error=f"HTTP {response.status_code}",
                )
    except httpx.TimeoutException:
        return ServiceHealth(
            service_id=service_id,
            status="error",
            error="Request timeout",
        )
    except Exception as e:
        return ServiceHealth(
            service_id=service_id,
            status="error",
            error=str(e),
        )
