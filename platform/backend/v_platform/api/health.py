"""헬스 체크 API 엔드포인트"""

import os
import time

import redis.asyncio as aioredis
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from v_platform.core.database import get_db_session
try:
    from app.services.websocket_bridge import get_bridge
except ImportError:
    get_bridge = lambda: None  # noqa: E731

router = APIRouter()


class ServiceHealth(BaseModel):
    """개별 서비스 상태"""

    status: str  # "healthy" | "unhealthy" | "unknown"
    response_time_ms: float | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """헬스 체크 응답 모델"""

    status: str
    bridge_running: bool
    version: str
    services: dict[str, ServiceHealth]


async def _check_db() -> ServiceHealth:
    t = time.monotonic()
    try:
        db = next(get_db_session())
        db.execute(text("SELECT 1"))
        return ServiceHealth(
            status="healthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
        )
    except Exception as e:
        return ServiceHealth(
            status="unhealthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
            error=str(e)[:120],
        )


async def _check_redis() -> ServiceHealth:
    t = time.monotonic()
    try:
        redis_url = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")
        client = await aioredis.from_url(redis_url, decode_responses=True)
        await client.ping()
        await client.aclose()
        return ServiceHealth(
            status="healthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
        )
    except Exception as e:
        return ServiceHealth(
            status="unhealthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
            error=str(e)[:120],
        )


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """시스템 헬스 체크 — Backend / DB / Redis 상태 포함"""
    bridge = get_bridge()
    bridge_running = bridge.is_running if bridge else False

    db_health, redis_health = await _check_db(), await _check_redis()

    overall = (
        "healthy"
        if db_health.status == "healthy" and redis_health.status == "healthy"
        else "degraded"
    )

    return HealthResponse(
        status=overall,
        bridge_running=bridge_running,
        version="1.0.0",
        services={
            "database": db_health,
            "redis": redis_health,
        },
    )


@router.get("/status")
async def get_status() -> dict[str, str | bool | list[str]]:
    """메시지 브리지 상태 조회"""
    bridge = get_bridge()

    if not bridge:
        return {
            "running": False,
            "uptime": "N/A",
            "connected_platforms": [],
        }

    connected_platforms = [
        platform
        for platform, provider in bridge.providers.items()
        if provider.is_connected
    ]

    return {
        "running": bridge.is_running,
        "uptime": "N/A",
        "connected_platforms": connected_platforms,
    }
