"""헬스 체크 API 엔드포인트

Apps register custom health checks via HealthRegistry instead of
hard-coding service-specific imports.
"""

import inspect
import logging
import os
import time
from typing import Callable

import redis.asyncio as aioredis
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from v_platform.core.database import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ServiceHealth(BaseModel):
    """개별 서비스 상태"""

    status: str  # "healthy" | "unhealthy" | "unknown"
    response_time_ms: float | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """헬스 체크 응답 모델"""

    status: str
    bridge_running: bool = False  # backward compat — apps override via registry
    version: str
    services: dict[str, ServiceHealth]


# ---------------------------------------------------------------------------
# HealthRegistry — apps register their own checks here
# ---------------------------------------------------------------------------

class HealthRegistry:
    """Registry for health-check functions.

    Platform defaults (database, redis) are registered automatically.
    Apps can add their own via ``register()``.

    Usage::

        from v_platform.api.health import health_registry
        health_registry.register("my_service", my_check_fn)

    ``check_fn`` must return a ``ServiceHealth`` instance.  It may be sync
    or async.
    """

    def __init__(self):
        self._checks: dict[str, Callable[[], ServiceHealth]] = {}

    def register(self, name: str, check_fn: Callable):
        """Register a named health check.

        Args:
            name: Unique service name shown in the health response.
            check_fn: Sync or async callable returning ``ServiceHealth``.
        """
        self._checks[name] = check_fn

    async def run_all(self) -> dict[str, ServiceHealth]:
        """Execute every registered check and return the results dict."""
        results: dict[str, ServiceHealth] = {}
        for name, fn in self._checks.items():
            try:
                result = fn()
                if inspect.isawaitable(result):
                    result = await result
                results[name] = result
            except Exception as exc:
                logger.warning("Health check %s failed: %s", name, exc)
                results[name] = ServiceHealth(
                    status="unhealthy", error=str(exc)[:120]
                )
        return results


# Module-level singleton
health_registry = HealthRegistry()


# ---------------------------------------------------------------------------
# Platform default checks
# ---------------------------------------------------------------------------

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


# Register platform defaults
health_registry.register("database", _check_db)
health_registry.register("redis", _check_redis)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """시스템 헬스 체크 — 등록된 모든 서비스 상태 포함"""
    services = await health_registry.run_all()

    overall = (
        "healthy"
        if all(s.status == "healthy" for s in services.values())
        else "degraded"
    )

    return HealthResponse(
        status=overall,
        version="1.0.0",
        services=services,
    )
