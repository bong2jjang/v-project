"""VMS Chat Ops Backend API - Light-Zowe Architecture

FastAPI 기반 백엔드 API 서버
"""

import os
import asyncio
import logging
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import redis.asyncio as aioredis

from app.api import (
    health,
    websocket,
    messages,
    auth,
    auth_microsoft,
    users,
    user_oauth,
    audit_logs,
    metrics,
    monitoring,
    notifications,
    system_settings,
    accounts_crud,
    accounts_test,
    bridge,
    teams_webhook,
    teams_notifications,
    menus,
    permissions,
    auth_sso,
    organizations,
    permission_groups,
)
from app.services.websocket_manager import manager
from app.services.event_broadcaster import EventBroadcaster
import app.services.event_broadcaster as broadcaster_module
from app.db import init_db
from app.middleware.metrics import MetricsMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.sso import init_sso_providers
from app.services.log_buffer import install as _install_log_buffer

# Light-Zowe Architecture
from app.services.websocket_bridge import WebSocketBridge, set_bridge
from app.services.route_manager import RouteManager
from app.services.message_queue import MessageQueue, set_message_queue
from app.services.teams_subscription_manager import (
    TeamsSubscriptionManager,
    set_subscription_manager,
)
from app.adapters import SlackProvider, TeamsProvider

# 로그 레벨 설정 (기본 INFO, LOG_LEVEL 환경변수로 조정 가능)
_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(levelname)-8s %(name)s %(message)s",
)
# 과도하게 verbose한 서드파티 로거 수준 조정
for _noisy in ("slack_bolt", "slack_sdk", "aiohttp", "asyncio"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

# 대시보드 LogViewer용 인메모리 로그 버퍼
_install_log_buffer(getattr(logging, _LOG_LEVEL, logging.INFO))

logger = structlog.get_logger()


class _AccessLogFilter(logging.Filter):
    """헬스체크·상태 폴링 엔드포인트를 접근 로그에서 제외"""

    _SUPPRESS = frozenset(["/api/health", "/api/bridge/status"])

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not any(path in msg for path in self._SUPPRESS)


logging.getLogger("uvicorn.access").addFilter(_AccessLogFilter())


async def migrate_env_to_db() -> int:
    """
    .env 환경 변수를 DB로 자동 마이그레이션

    Returns:
        생성된 Account 개수
    """
    from app.db import get_db_session
    from app.models import Account

    account_count = 0
    db = next(get_db_session())

    try:
        # Slack 마이그레이션
        slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
        slack_app_token = os.getenv("SLACK_APP_TOKEN")

        if slack_bot_token and slack_app_token:
            logger.info("Migrating Slack credentials from .env to DB")

            slack_account = Account(
                name="slack-default",
                platform="slack",
                enabled=True,
                is_valid=True,
            )
            # 암호화하여 저장 (property setter 사용)
            slack_account.token_decrypted = slack_bot_token
            slack_account.app_token_decrypted = slack_app_token

            db.add(slack_account)
            account_count += 1

            logger.info("Slack account migrated to DB: slack-default")

        # Teams 마이그레이션
        teams_app_id = os.getenv("TEAMS_APP_ID")
        teams_app_password = os.getenv("TEAMS_APP_PASSWORD")
        teams_tenant_id = os.getenv("TEAMS_TENANT_ID")

        if teams_app_id and teams_app_password and teams_tenant_id:
            logger.info("Migrating Teams credentials from .env to DB")

            teams_account = Account(
                name="teams-default",
                platform="teams",
                enabled=True,
                tenant_id=teams_tenant_id,
                app_id=teams_app_id,
                is_valid=True,
            )
            # 암호화하여 저장 (property setter 사용)
            teams_account.app_password_decrypted = teams_app_password

            db.add(teams_account)
            account_count += 1

            logger.info("Teams account migrated to DB: teams-default")

        # DB 커밋
        if account_count > 0:
            db.commit()
            logger.info(f"Migrated {account_count} accounts from .env to DB")

    except Exception as e:
        logger.error("Failed to migrate env to DB", error=str(e))
        db.rollback()
        account_count = 0
    finally:
        db.close()

    return account_count


async def init_bridge() -> WebSocketBridge:
    """
    Light-Zowe 브리지 초기화 (DB 우선 전략)

    1. DB에서 Account 조회
    2. 없으면 .env에서 조회 → DB에 자동 추가
    3. Provider 등록

    Returns:
        WebSocketBridge 인스턴스
    """
    from app.db import get_db_session
    from app.models import Account

    try:
        # Redis 연결
        redis_url = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")
        redis_client = await aioredis.from_url(redis_url, decode_responses=True)

        # Route Manager 생성
        route_manager = RouteManager(redis_client)

        # Message Queue 생성 (배치 큐)
        message_queue = MessageQueue(batch_size=50, flush_interval=5.0)
        set_message_queue(message_queue)

        # WebSocket Bridge 생성
        bridge = WebSocketBridge(route_manager, message_queue)

        # Provider 등록 (DB 우선 전략)
        bridge_type = os.getenv("BRIDGE_TYPE", "native")

        if bridge_type == "native":
            logger.info("Initializing Light-Zowe providers")

            # DB 세션 생성
            db = next(get_db_session())

            try:
                # 1. DB에서 활성화된 Account 조회
                accounts = (
                    db.query(Account)
                    .filter(Account.enabled.is_(True), Account.is_valid.is_(True))
                    .all()
                )

                if not accounts:
                    logger.info("No accounts in DB, checking .env for migration")
                    # 2. DB가 비어있으면 .env → DB 자동 마이그레이션
                    count = await migrate_env_to_db()

                    if count > 0:
                        # 마이그레이션 후 다시 조회
                        accounts = (
                            db.query(Account)
                            .filter(
                                Account.enabled.is_(True), Account.is_valid.is_(True)
                            )
                            .all()
                        )

                if not accounts:
                    logger.warning(
                        "No providers configured in DB or .env, bridge will run without providers"
                    )

                # 3. DB의 Account로 Provider 등록
                for account in accounts:
                    try:
                        if account.platform == "slack":
                            # 복호화 시도 (실패 시 예외 발생)
                            token = account.token_decrypted
                            app_token = account.app_token_decrypted

                            if token and app_token:
                                # 환경 변수에서 메시지 모드 읽기
                                message_mode = os.getenv(
                                    "SLACK_MESSAGE_MODE", "sender_info"
                                )
                                slack_provider = SlackProvider(
                                    bot_token=token,
                                    app_token=app_token,
                                    message_mode=message_mode,
                                )
                                success = await bridge.add_provider(slack_provider)
                                if success:
                                    logger.info(
                                        f"Slack Provider registered from DB: {account.name}"
                                    )
                                else:
                                    logger.warning(
                                        f"Slack Provider failed to connect: {account.name}"
                                    )
                            else:
                                logger.warning(
                                    f"Slack account {account.name} missing tokens"
                                )

                        elif account.platform == "teams":
                            # 복호화 시도 (실패 시 예외 발생)
                            app_password = account.app_password_decrypted

                            tenant_id = account.tenant_id_decrypted
                            app_id = account.app_id_decrypted

                            if tenant_id and app_id and app_password:
                                teams_provider = TeamsProvider(
                                    app_id=app_id,
                                    app_password=app_password,
                                    tenant_id=tenant_id,
                                    team_id=account.team_id_decrypted,
                                    account_id=account.id,
                                    webhook_url=account.webhook_url_decrypted,
                                )
                                success = await bridge.add_provider(teams_provider)
                                if success:
                                    logger.info(
                                        f"Teams Provider registered from DB: {account.name}"
                                    )
                                else:
                                    logger.warning(
                                        f"Teams Provider failed to connect: {account.name}"
                                    )
                            else:
                                logger.warning(
                                    f"Teams account {account.name} missing credentials"
                                )

                    except Exception as e:
                        # 복호화 실패 등 개별 account 처리 실패 시 건너뛰고 계속 진행
                        logger.warning(
                            f"Failed to process account {account.name} (id={account.id}): {e}"
                        )
                        continue

            finally:
                db.close()

        # 브리지 싱글톤 설정
        set_bridge(bridge)

        logger.info("Light-Zowe bridge initialized successfully")

        return bridge

    except Exception as e:
        logger.error("Failed to initialize Light-Zowe bridge", error=str(e))
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 생명주기 관리 - 시작/종료 이벤트"""
    # Startup
    logger.info("Starting VMS Chat Ops (Light-Zowe)")

    # 데이터베이스 초기화
    init_db()

    # SSO Provider 초기화
    init_sso_providers()

    # EventBroadcaster 초기화 및 시작 (WebSocket 관리)
    broadcaster = EventBroadcaster(manager, None)  # control_service 제거
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()

    # Light-Zowe 브리지 초기화
    bridge = None
    bridge_task = None

    try:
        bridge = await init_bridge()

        # 브리지 시작 (백그라운드 태스크)
        bridge_task = asyncio.create_task(bridge.start())

        logger.info("Light-Zowe bridge started")

        # Teams Graph API 구독 매니저 시작
        teams_provider = bridge.providers.get("teams")
        notification_url = os.getenv("TEAMS_NOTIFICATION_URL", "")
        if not notification_url:
            # BACKEND_URL 기반 자동 생성
            backend_url = os.getenv("BACKEND_URL", "").rstrip("/")
            if backend_url:
                notification_url = f"{backend_url}/api/teams/notifications"

        if teams_provider and notification_url:
            sub_mgr = TeamsSubscriptionManager(
                teams_provider=teams_provider,
                route_manager=bridge.route_manager,
                notification_url=notification_url,
            )
            set_subscription_manager(sub_mgr)
            await sub_mgr.start()
            logger.info(
                "Teams subscription manager started",
                notification_url=notification_url,
            )
        elif teams_provider:
            logger.warning(
                "Teams provider found but no BACKEND_URL or "
                "TEAMS_NOTIFICATION_URL configured — "
                "Graph notifications disabled"
            )

    except Exception as e:
        logger.error("Failed to start Light-Zowe bridge", error=str(e))

    yield

    # Shutdown
    logger.info("Stopping VMS Chat Ops (Light-Zowe)")

    # 구독 매니저 중지
    from app.services.teams_subscription_manager import get_subscription_manager

    sub_mgr = get_subscription_manager()
    if sub_mgr:
        try:
            await sub_mgr.stop()
        except Exception as e:
            logger.error("Error stopping subscription manager", error=str(e))
        set_subscription_manager(None)

    # 브리지 중지
    if bridge:
        try:
            await bridge.stop()
            logger.info("Light-Zowe bridge stopped")
        except Exception as e:
            logger.error("Error stopping bridge", error=str(e))

    # 브리지 태스크 취소
    if bridge_task and not bridge_task.done():
        bridge_task.cancel()
        try:
            await bridge_task
        except asyncio.CancelledError:
            pass

    # EventBroadcaster 중지
    if broadcaster_module.broadcaster:
        await broadcaster_module.broadcaster.stop()

    logger.info("Shutdown complete")


# Rate Limiter 설정
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="VMS Chat Ops API (Light-Zowe)",
    description="""
## VMS Chat Ops 관리 API - Light-Zowe 아키텍처

Slack과 Microsoft Teams 간 자체 메시지 브리지를 관리하기 위한 REST API입니다.

### 아키텍처

**Light-Zowe**: Zowe Chat의 Common Schema, Provider Pattern, Command Processor 개념을 Docker + FastAPI로 구현

### 주요 기능

* **자체 메시지 브리지**: Matterbridge 대신 WebSocket Bridge 사용
* **Provider Pattern**: Slack, Teams 어댑터를 플러그인으로 분리
* **동적 라우팅**: Redis 기반 라우팅 룰 (재시작 불필요)
* **Command Processor**: `/vms`, `/bridge`, `/route` 커맨드 지원
* **실시간 모니터링**: WebSocket을 통한 상태 업데이트
* **메시지 추적**: 메시지 전송 기록 조회

### 인증

JWT 기반 인증 (Bearer Token)

### API 문서

* **Swagger UI**: `/docs` (현재 페이지)
* **ReDoc**: `/redoc`
* **OpenAPI Schema**: `/openapi.json`

### 지원

* **GitHub**: [vms-chat-ops](https://github.com/bong2jjang/vms-chat-ops)
* **문서**: `docusaurus/` 디렉토리 참조
    """,
    version="1.1.0",
    lifespan=lifespan,
    contact={
        "name": "VMS Chat Ops Team",
        "url": "https://github.com/bong2jjang/vms-chat-ops",
    },
    license_info={
        "name": "Private",
    },
)

# CORS 설정
_default_origins = ["http://localhost:3000", "http://localhost:5173"]
_extra_origins = os.getenv("CORS_ORIGINS", "")
_cors_origins = _default_origins + [
    o.strip() for o in _extra_origins.split(",") if o.strip()
]
# CSRF 보호 미들웨어 (CORS보다 먼저 등록 → CORS가 outermost)
app.add_middleware(CSRFMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus 메트릭 미들웨어
app.add_middleware(MetricsMiddleware)

# Rate Limiter 상태 추가
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/")
async def root() -> dict[str, str]:
    """루트 엔드포인트"""
    return {
        "message": "VMS Chat Ops API (Light-Zowe)",
        "version": "1.1.0",
        "architecture": "Light-Zowe (Provider Pattern)",
        "docs": "/docs",
    }


# API 라우터 등록
app.include_router(auth.router)  # 인증 API (prefix 포함)
app.include_router(users.router)  # 사용자 관리 API (prefix 포함)
app.include_router(audit_logs.router)  # 감사 로그 API (prefix 포함)
app.include_router(system_settings.router)  # 시스템 설정 API (prefix 포함)
app.include_router(accounts_crud.router)  # 계정 관리 API - DB 기반 (prefix 포함)
app.include_router(accounts_test.router)  # 계정 연결 테스트 API
app.include_router(auth_microsoft.router)  # Microsoft OAuth2 Delegated Auth
app.include_router(user_oauth.router)  # 사용자별 OAuth 연동
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(bridge.router)  # 메시지 브리지 API (prefix 포함)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(messages.router, tags=["messages"])
app.include_router(metrics.router, tags=["metrics"])  # Prometheus 메트릭
app.include_router(monitoring.router)  # 모니터링 서비스 관리 (prefix 포함)
app.include_router(
    notifications.router, prefix="/api/notifications", tags=["notifications"]
)  # 알림 API
app.include_router(teams_webhook.router)  # Teams Bot Framework Webhook
app.include_router(teams_notifications.router)  # Teams Graph API Change Notifications
app.include_router(menus.router)  # RBAC 메뉴 관리 API
app.include_router(permissions.router)  # RBAC 권한 관리 API
app.include_router(organizations.router)  # 회사/부서 관리 API
app.include_router(permission_groups.router)  # 권한 그룹 관리 API
app.include_router(auth_sso.router)  # SSO Authentication


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """전역 예외 핸들러 (HTTPException은 FastAPI 기본 핸들러에 위임)"""
    from fastapi import HTTPException

    if isinstance(exc, HTTPException):
        raise exc
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
