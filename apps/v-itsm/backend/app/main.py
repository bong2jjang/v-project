"""v-itsm — 업무 루프 관리 시스템

접수(VOC) → 분석(사업) → 실행(제품) → 검증(운영) → 답변(고객) 5단계 루프를
ITSM 표준 프로세스 위에서 관리하는 앱입니다. v-platform의 공통 기능
(인증/RBAC/감사/조직도/설정)을 그대로 사용하며, 앱 전용 도메인은
app/models 와 app/api 에 추가합니다.

설계 문서: docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md

디렉토리 구조:
  backend/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py          ← 이 파일
  │   ├── models/           ← itsm_* SQLAlchemy 모델
  │   │   └── __init__.py
  │   ├── api/              ← 앱 전용 FastAPI 라우터
  │   └── services/         ← 앱 전용 서비스 (SLA 타이머, Loop FSM 등)
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

from app.api import contracts as contracts_router
from app.api import customers as customers_router
from app.api import integrations as integrations_router
from app.api import kpi as kpi_router
from app.api import me_notification_pref as me_notification_pref_router
from app.api import notification_logs as notification_logs_router
from app.api import products as products_router
from app.api import scheduler as scheduler_router
from app.api import scope_grants as scope_grants_router
from app.api import sla_notification_policies as sla_notification_policies_router
from app.api import sla_policies as sla_policies_router
from app.api import sla_tiers as sla_tiers_router
from app.api import sla_timers as sla_timers_router
from app.api import tickets as tickets_router
from app.api import transitions as transitions_router
from app.providers import init_providers_from_env, shutdown_providers
from app.services import sla_timer  # noqa: F401 — JobSpec 을 레지스트리에 등록하는 side-effect
from app.services.scheduler_registry import scheduler_registry

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(name)s %(message)s")
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(fastapi_app):
    logger.info("Starting v-itsm")
    platform.init_platform()

    # 앱 전용 DB 초기화가 필요하면 여기에 추가
    # from v_platform.core.database import SessionLocal
    # db = SessionLocal()
    # try:
    #     # SLA 정책 시드, Loop FSM 초기 상태 등
    #     pass
    # finally:
    #     db.close()

    # EventBroadcaster — WebSocket 알림 전달에 필요
    broadcaster = EventBroadcaster(manager, None)
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()

    # Slack/Teams outbound provider 초기화 — env 누락은 fail-open (로그만)
    await init_providers_from_env()

    # 스케줄러 레지스트리 — SLA 스캔 등 모든 잡을 단일 AsyncIOScheduler 로 기동
    # (itsm_scheduler_override 에 오버라이드가 있으면 반영)
    scheduler_registry.start()

    logger.info("v-itsm ready")

    yield

    scheduler_registry.stop()
    await shutdown_providers()
    if broadcaster_module.broadcaster:
        await broadcaster_module.broadcaster.stop()
    logger.info("v-itsm stopped")


# ── Platform App 생성 ──
platform = PlatformApp(
    app_name="v-itsm",
    version="0.1.0",
    description="Business workflow loop management (ITSM) app — 5-stage loop: intake/analyze/execute/verify/answer",
    lifespan=lifespan,
)

# ── 앱 전용 라우터 등록 ──
platform.register_app_routers(
    tickets_router.router,
    transitions_router.router,
    customers_router.router,
    products_router.router,
    contracts_router.router,
    sla_tiers_router.router,
    sla_policies_router.router,
    sla_notification_policies_router.router,
    sla_timers_router.router,
    scope_grants_router.router,
    scheduler_router.router,
    integrations_router.router,
    notification_logs_router.router,
    me_notification_pref_router.router,
    kpi_router.router,
)

# ── ASGI app ──
app = platform.fastapi


@app.get("/")
async def root():
    return {
        "app": "v-itsm",
        "platform": "v-platform",
        "version": "0.1.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
