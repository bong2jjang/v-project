"""모니터링 서비스 상태 체크 API

공유 인프라(Prometheus/Grafana/Loki/cAdvisor/Node Exporter)의 Health 상태를
조회하는 플랫폼 공통 엔드포인트. 모든 앱에서 동일한 URL(`/api/monitoring/*`)
로 접근 가능.
"""

import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from v_platform.models.user import User
from v_platform.utils.auth import require_permission

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


class ServiceHealth(BaseModel):
    """서비스 Health 상태"""

    service_id: str
    status: str  # healthy, warning, error, unknown
    response_time_ms: Optional[int] = None
    error: Optional[str] = None


SERVICES = [
    {
        "id": "prometheus",
        "url": "http://prometheus:9090/api/v1/status/runtimeinfo",
    },
    {"id": "grafana", "url": "http://grafana:3000/api/health"},
    {"id": "loki", "url": "http://loki:3100/ready"},
    {"id": "cadvisor", "url": "http://cadvisor:8080/healthz"},
    {"id": "node_exporter", "url": "http://node_exporter:9100/metrics"},
]


async def _probe(client: httpx.AsyncClient, service: dict) -> ServiceHealth:
    try:
        start = time.time()
        response = await client.get(service["url"])
        elapsed_ms = int((time.time() - start) * 1000)

        if response.status_code == 200:
            status = "healthy" if elapsed_ms < 2000 else "warning"
            return ServiceHealth(
                service_id=service["id"],
                status=status,
                response_time_ms=elapsed_ms,
            )
        return ServiceHealth(
            service_id=service["id"],
            status="error",
            error=f"HTTP {response.status_code}",
        )
    except httpx.TimeoutException:
        return ServiceHealth(
            service_id=service["id"], status="error", error="Request timeout"
        )
    except Exception as e:  # noqa: BLE001
        return ServiceHealth(service_id=service["id"], status="error", error=str(e))


@router.get("/health")
async def check_all_services(
    current_user: User = Depends(require_permission("monitoring", "read")),
) -> list[ServiceHealth]:
    """모든 모니터링 서비스의 Health 상태 확인"""
    async with httpx.AsyncClient(timeout=2.0) as client:
        return [await _probe(client, s) for s in SERVICES]


@router.get("/health/{service_id}")
async def check_service_health(
    service_id: str,
    current_user: User = Depends(require_permission("monitoring", "read")),
) -> ServiceHealth:
    """특정 모니터링 서비스의 Health 상태 확인"""
    service = next((s for s in SERVICES if s["id"] == service_id), None)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    async with httpx.AsyncClient(timeout=2.0) as client:
        return await _probe(client, service)
