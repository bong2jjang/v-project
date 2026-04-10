"""v-platform 독립 실행 테스트

v-channel-bridge 없이 v-platform만으로 부팅되는지 검증합니다.
이 앱은 platform API만 제공하며, 앱 전용 기능은 없습니다.
"""

import os
import logging
import structlog
from contextlib import asynccontextmanager

from v_platform.app import PlatformApp
from v_platform.core.database import init_db
from v_platform.sso import init_sso_providers

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(name)s %(message)s")
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(fastapi_app):
    logger.info("Starting v-platform-test (platform only)")
    init_db()
    init_sso_providers()
    logger.info("v-platform-test ready")
    yield
    logger.info("v-platform-test stopped")


platform = PlatformApp(
    app_name="v-platform-test",
    version="0.1.0",
    description="Platform-only test app — no app-specific features",
    lifespan=lifespan,
)

app = platform.fastapi


@app.get("/")
async def root():
    return {
        "app": "v-platform-test",
        "platform": "v-platform",
        "version": "0.1.0",
        "purpose": "Platform independent verification",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
