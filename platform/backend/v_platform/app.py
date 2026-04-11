"""PlatformApp — v-platform framework entry point

Provides a pre-configured FastAPI app with auth, RBAC, audit log,
user management, and all platform middleware/routers.
Apps register their own routers via register_app_routers().
"""

import os
from typing import Callable, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from v_platform.middleware.csrf import CSRFMiddleware
from v_platform.middleware.metrics import MetricsMiddleware
from v_platform.core.database import init_db
from v_platform.core.logging import configure_platform_logging
from v_platform.sso import init_sso_providers
from v_platform.api import (
    auth,
    auth_sso,
    auth_microsoft,
    users,
    user_oauth,
    permissions,
    permission_groups,
    menus,
    organizations,
    audit_logs,
    system_settings,
    health,
    notifications,
    metrics,
    websocket,
    persistent_notifications,
)


class PlatformApp:
    """Reusable platform framework instance"""

    def __init__(
        self,
        app_name: str = "v-platform",
        version: str = "0.1.0",
        description: str = "",
        lifespan: Optional[Callable] = None,
        cors_origins: Optional[list[str]] = None,
    ):
        self.app_name = app_name
        self.version = version

        # Initialize structured logging before anything else
        configure_platform_logging(app_name=app_name)

        self.fastapi = FastAPI(
            title=f"{app_name} API",
            description=description,
            version=version,
            lifespan=lifespan,
        )
        self.fastapi.state.app_id = app_name

        self._setup_middleware(cors_origins)
        self._setup_rate_limiter()
        self._register_platform_routers()

    def _setup_middleware(self, cors_origins: Optional[list[str]] = None):
        """CORS, CSRF, Metrics middleware"""
        default_origins = ["http://localhost:3000", "http://localhost:5173"]
        extra = os.getenv("CORS_ORIGINS", "")
        origins = (cors_origins or default_origins) + [
            o.strip() for o in extra.split(",") if o.strip()
        ]

        self.fastapi.add_middleware(CSRFMiddleware)
        self.fastapi.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        self.fastapi.add_middleware(MetricsMiddleware)

    def _setup_rate_limiter(self):
        limiter = Limiter(key_func=get_remote_address)
        self.fastapi.state.limiter = limiter
        self.fastapi.add_exception_handler(
            RateLimitExceeded, _rate_limit_exceeded_handler
        )

    def _register_platform_routers(self):
        """Register all platform routers (auth, RBAC, audit, etc.)"""
        self.fastapi.include_router(auth.router)
        self.fastapi.include_router(auth_sso.router)
        self.fastapi.include_router(auth_microsoft.router)
        self.fastapi.include_router(users.router)
        self.fastapi.include_router(user_oauth.router)
        self.fastapi.include_router(permissions.router)
        self.fastapi.include_router(permission_groups.router)
        self.fastapi.include_router(menus.router)
        self.fastapi.include_router(organizations.router)
        self.fastapi.include_router(audit_logs.router)
        self.fastapi.include_router(system_settings.router)
        self.fastapi.include_router(health.router, prefix="/api", tags=["health"])
        self.fastapi.include_router(
            notifications.router,
            prefix="/api/notifications",
            tags=["notifications"],
        )
        self.fastapi.include_router(metrics.router, tags=["metrics"])
        self.fastapi.include_router(
            websocket.router, prefix="/api", tags=["websocket"]
        )
        self.fastapi.include_router(persistent_notifications.router)

    def register_app_routers(self, *routers):
        """Register app-specific routers"""
        for router in routers:
            self.fastapi.include_router(router)

    def init_platform(self):
        """Initialize database and SSO providers"""
        init_db()
        init_sso_providers()
