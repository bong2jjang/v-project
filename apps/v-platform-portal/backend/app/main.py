"""v-platform-portal — 통합 앱 포탈

모든 v-platform 앱의 런처, SSO 통합 로그인, 사이트맵, 통합 대시보드를 제공합니다.
"""

import logging
import structlog
from contextlib import asynccontextmanager

from v_platform.app import PlatformApp
from v_platform.services.websocket_manager import manager
from v_platform.services.event_broadcaster import EventBroadcaster
import v_platform.services.event_broadcaster as broadcaster_module

from app.api.portal import router as portal_router
from app.services.app_registry import app_registry

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(name)s %(message)s")
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(fastapi_app):
    logger.info("Starting v-platform-portal")
    platform.init_platform()

    # DB seed (env var → DB if empty) + load apps into memory
    from v_platform.core.database import SessionLocal

    db = SessionLocal()
    try:
        app_registry.seed_from_env(db)
        app_registry.reload_from_db(db)
    finally:
        db.close()

    # EventBroadcaster — WebSocket 알림 전달에 필요
    broadcaster = EventBroadcaster(manager, None)
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()

    logger.info("v-platform-portal ready")
    yield
    if broadcaster_module.broadcaster:
        await broadcaster_module.broadcaster.stop()
    logger.info("v-platform-portal stopped")


platform = PlatformApp(
    app_name="v-platform-portal",
    version="1.0.0",
    description="v-platform 통합 포탈 — 앱 런처, SSO, 사이트맵",
    lifespan=lifespan,
)

# Portal-specific routes
platform.register_app_routers(portal_router)

app = platform.fastapi


@app.get("/")
async def root():
    return {
        "app": "v-platform-portal",
        "platform": "v-platform",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
