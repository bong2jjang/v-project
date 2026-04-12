"""v-platform-template — 새 앱 시작용 템플릿

v-platform의 모든 공통 기능(인증/RBAC/감사/조직도/설정)을 포함합니다.
앱 전용 라우터를 register_app_routers()로 추가하세요.

사용법:
  1. 이 디렉토리를 복사하여 새 앱 생성
  2. app_name, version 수정
  3. app/models/ 에 SQLAlchemy 모델 추가
  4. migrations/ 에 마이그레이션 스크립트 추가 (a001_*.py)
  5. app/api/ 에 앱 전용 API 라우터 추가
  6. register_app_routers()로 앱 라우터 등록

디렉토리 구조:
  backend/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py          ← 이 파일
  │   ├── models/           ← 앱 전용 SQLAlchemy 모델
  │   │   └── __init__.py
  │   ├── api/              ← 앱 전용 FastAPI 라우터
  │   └── services/         ← 앱 전용 서비스
  ├── migrations/           ← 앱 전용 DB 마이그레이션 (a001_*.py)
  ├── requirements.txt
  └── Dockerfile
"""

import logging
import structlog
from contextlib import asynccontextmanager

from v_platform.app import PlatformApp
from v_platform.services.websocket_manager import manager
from v_platform.services.event_broadcaster import EventBroadcaster
import v_platform.services.event_broadcaster as broadcaster_module

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(name)s %(message)s")
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(fastapi_app):
    logger.info("Starting v-platform-template")
    platform.init_platform()

    # 앱 전용 DB 초기화가 필요하면 여기에 추가
    # from v_platform.core.database import SessionLocal
    # db = SessionLocal()
    # try:
    #     # 앱 초기 데이터 시드 등
    #     pass
    # finally:
    #     db.close()

    # EventBroadcaster — WebSocket 알림 전달에 필요
    broadcaster = EventBroadcaster(manager, None)
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()

    logger.info("v-platform-template ready")

    yield

    if broadcaster_module.broadcaster:
        await broadcaster_module.broadcaster.stop()
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
