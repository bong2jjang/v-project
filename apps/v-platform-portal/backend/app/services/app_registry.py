"""App Registry — manages registered v-platform apps for the portal.

Apps are registered via PORTAL_APPS environment variable:
  PORTAL_APPS=app_id|display_name|description|icon|frontend_url|api_url,...
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
    is_active: bool = True


@dataclass
class AppHealth:
    app_id: str
    status: str  # "online" | "offline" | "degraded"
    services: dict = field(default_factory=dict)
    response_time_ms: Optional[float] = None


class AppRegistry:
    def __init__(self):
        self._apps: dict[str, RegisteredApp] = {}
        self._load_from_env()

    def _load_from_env(self):
        """Load apps from PORTAL_APPS environment variable."""
        raw = os.getenv("PORTAL_APPS", "")
        if not raw:
            return

        for entry in raw.split(","):
            parts = entry.strip().split("|")
            if len(parts) >= 6:
                app = RegisteredApp(
                    app_id=parts[0].strip(),
                    display_name=parts[1].strip(),
                    description=parts[2].strip(),
                    icon=parts[3].strip(),
                    frontend_url=parts[4].strip(),
                    api_url=parts[5].strip(),
                )
                self._apps[app.app_id] = app
                logger.info(f"Registered app: {app.app_id} ({app.display_name})")

    def register(self, app: RegisteredApp):
        self._apps[app.app_id] = app

    def get_all(self) -> list[RegisteredApp]:
        return [a for a in self._apps.values() if a.is_active]

    def get(self, app_id: str) -> Optional[RegisteredApp]:
        return self._apps.get(app_id)

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
