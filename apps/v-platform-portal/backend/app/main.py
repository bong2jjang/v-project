"""v-platform-portal — 통합 앱 포탈

모든 v-platform 앱의 런처, SSO 통합 로그인, 사이트맵, 통합 대시보드를 제공합니다.
"""

import logging
import structlog
from contextlib import asynccontextmanager

from v_platform.app import PlatformApp

from app.api.portal import router as portal_router

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(name)s %(message)s")
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(fastapi_app):
    logger.info("Starting v-platform-portal")
    platform.init_platform()
    logger.info("v-platform-portal ready")
    yield
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
