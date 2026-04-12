"""App Registry — manages registered v-platform apps for the portal.

Primary source: DB (portal_apps table).
Fallback/seed: PORTAL_APPS environment variable — if DB is empty on startup,
env var entries are inserted as initial data.
"""

import os
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class RegisteredApp:
    app_id: str
    display_name: str
    description: str
    icon: str  # Lucide icon name
    frontend_url: str
    api_url: str
    health_endpoint: str = "/api/health"
    sort_order: int = 0
    is_active: bool = True
    id: Optional[int] = None


@dataclass
class AppHealth:
    app_id: str
    status: str  # "online" | "offline" | "degraded"
    services: dict = field(default_factory=dict)
    response_time_ms: Optional[float] = None


class AppRegistry:
    def __init__(self):
        self._apps: dict[str, RegisteredApp] = {}

    # ── Load / Seed ──────────────────────────────────────────────────

    def seed_from_env(self, db_session):
        """DB가 비어 있으면 PORTAL_APPS env var로 초기 데이터 삽입."""
        from app.models.portal_app import PortalApp

        if db_session.query(PortalApp).count() > 0:
            logger.info("portal_apps table already has data, skipping env seed")
            return

        raw = os.getenv("PORTAL_APPS", "")
        if not raw:
            return

        for idx, entry in enumerate(raw.split(",")):
            parts = entry.strip().split("|")
            if len(parts) >= 6:
                row = PortalApp(
                    app_id=parts[0].strip(),
                    display_name=parts[1].strip(),
                    description=parts[2].strip(),
                    icon=parts[3].strip(),
                    frontend_url=parts[4].strip(),
                    api_url=parts[5].strip(),
                    sort_order=idx * 10,
                )
                db_session.add(row)
                logger.info(f"Seeded app from env: {row.app_id}")

        db_session.commit()

    def reload_from_db(self, db_session):
        """DB에서 앱 목록을 다시 로드하여 메모리에 반영."""
        from app.models.portal_app import PortalApp

        rows = (
            db_session.query(PortalApp)
            .order_by(PortalApp.sort_order, PortalApp.id)
            .all()
        )
        self._apps.clear()
        for r in rows:
            self._apps[r.app_id] = RegisteredApp(
                id=r.id,
                app_id=r.app_id,
                display_name=r.display_name,
                description=r.description or "",
                icon=r.icon or "Box",
                frontend_url=r.frontend_url,
                api_url=r.api_url,
                health_endpoint=r.health_endpoint or "/api/health",
                sort_order=r.sort_order or 0,
                is_active=r.is_active,
            )
        logger.info(f"Loaded {len(self._apps)} apps from DB")

    # ── Query ────────────────────────────────────────────────────────

    def get_all(self) -> list[RegisteredApp]:
        return [a for a in self._apps.values() if a.is_active]

    def get_all_dicts(self) -> list[dict]:
        """활성 앱을 dict 리스트로 반환 (API 직렬화용)."""
        return [
            {
                "id": a.id,
                "app_id": a.app_id,
                "display_name": a.display_name,
                "description": a.description,
                "icon": a.icon,
                "frontend_url": a.frontend_url,
                "api_url": a.api_url,
                "health_endpoint": a.health_endpoint,
                "sort_order": a.sort_order,
                "is_active": a.is_active,
            }
            for a in self._apps.values()
            if a.is_active
        ]

    def get(self, app_id: str) -> Optional[RegisteredApp]:
        return self._apps.get(app_id)

    # ── Health Check ─────────────────────────────────────────────────

    async def check_health(self, app_id: str) -> AppHealth:
        app = self._apps.get(app_id)
        if not app:
            return AppHealth(app_id=app_id, status="unknown")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                import time

                t = time.monotonic()
                resp = await client.get(f"{app.api_url}{app.health_endpoint}")
                elapsed = round((time.monotonic() - t) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    return AppHealth(
                        app_id=app_id,
                        status=data.get("status", "online"),
                        services=data.get("services", {}),
                        response_time_ms=elapsed,
                    )
                else:
                    return AppHealth(
                        app_id=app_id,
                        status="degraded",
                        response_time_ms=elapsed,
                    )
        except Exception as e:
            logger.warning(f"Health check failed for {app_id}: {e}")
            return AppHealth(app_id=app_id, status="offline")

    async def check_all_health(self) -> list[AppHealth]:
        results = []
        for app_id in self._apps:
            health = await self.check_health(app_id)
            results.append(health)
        return results


# Module-level singleton
app_registry = AppRegistry()
