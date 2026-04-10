"""v-platform-template — 새 앱 시작용 템플릿

v-platform의 모든 공통 기능(인증/RBAC/감사/조직도/설정)을 포함합니다.
앱 전용 라우터를 register_app_routers()로 추가하세요.

사용법:
  1. 이 디렉토리를 복사하여 새 앱 생성
  2. app_name, version 수정
  3. 앱 전용 API/모델/서비스 추가
  4. register_app_routers()로 앱 라우터 등록
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
    logger.info("Starting v-platform-template")
    init_db()
    init_sso_providers()
    logger.info("v-platform-template ready")

    yield

    logger.info("v-platform-template stopped")


# ── Platform App 생성 ──
platform = PlatformApp(
    app_name="v-platform-template",
    version="1.0.0",
    description="Template app with all platform features (auth, RBAC, audit, org, settings)",
    lifespan=lifespan,
)

# ── 앱 전용 라우터 등록 (여기에 추가) ──
# from app.api import my_feature
# platform.register_app_routers(my_feature.router)

# ── ASGI app ──
app = platform.fastapi


@app.get("/")
async def root():
    return {
        "app": "v-platform-template",
        "platform": "v-platform",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
