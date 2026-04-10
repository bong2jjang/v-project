"""v-channel-bridge — Slack ↔ Teams Message Bridge

v-platform 기반 앱 진입점
"""

import os
import asyncio
import logging
import structlog
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import redis.asyncio as aioredis

from v_platform.app import PlatformApp
from v_platform.services.websocket_manager import manager
from v_platform.services.event_broadcaster import EventBroadcaster
import v_platform.services.event_broadcaster as broadcaster_module
from v_platform.core.database import init_db
from v_platform.sso import init_sso_providers

# App-specific imports (v-channel-bridge)
from app.api import (
    messages,
    accounts_crud,
    accounts_test,
    bridge,
    teams_webhook,
    teams_notifications,
    monitoring,
)
from app.services.websocket_bridge import WebSocketBridge, set_bridge
from app.services.route_manager import RouteManager
from app.services.message_queue import MessageQueue, set_message_queue
from app.services.teams_subscription_manager import (
    TeamsSubscriptionManager,
    set_subscription_manager,
)
from app.services.log_buffer import install as _install_log_buffer
from app.adapters import SlackProvider, TeamsProvider

# Logging setup
_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(levelname)-8s %(name)s %(message)s",
)
for _noisy in ("slack_bolt", "slack_sdk", "aiohttp", "asyncio"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

_install_log_buffer(getattr(logging, _LOG_LEVEL, logging.INFO))

logger = structlog.get_logger()


class _AccessLogFilter(logging.Filter):
    _SUPPRESS = frozenset(["/api/health", "/api/bridge/status"])

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not any(path in msg for path in self._SUPPRESS)


logging.getLogger("uvicorn.access").addFilter(_AccessLogFilter())


async def migrate_env_to_db() -> int:
    """Migrate .env credentials to DB (auto-migration)"""
    from v_platform.core.database import get_db_session
    from app.models import Account

    account_count = 0
    db = next(get_db_session())

    try:
        slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
        slack_app_token = os.getenv("SLACK_APP_TOKEN")

        if slack_bot_token and slack_app_token:
            slack_account = Account(
                name="slack-default", platform="slack", enabled=True, is_valid=True,
            )
            slack_account.token_decrypted = slack_bot_token
            slack_account.app_token_decrypted = slack_app_token
            db.add(slack_account)
            account_count += 1

        teams_app_id = os.getenv("TEAMS_APP_ID")
        teams_app_password = os.getenv("TEAMS_APP_PASSWORD")
        teams_tenant_id = os.getenv("TEAMS_TENANT_ID")

        if teams_app_id and teams_app_password and teams_tenant_id:
            teams_account = Account(
                name="teams-default", platform="teams", enabled=True,
                tenant_id=teams_tenant_id, app_id=teams_app_id, is_valid=True,
            )
            teams_account.app_password_decrypted = teams_app_password
            db.add(teams_account)
            account_count += 1

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
    """Initialize v-channel-bridge (DB-first strategy)"""
    from v_platform.core.database import get_db_session
    from app.models import Account

    redis_url = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")
    redis_client = await aioredis.from_url(redis_url, decode_responses=True)

    route_manager = RouteManager(redis_client)
    message_queue = MessageQueue(batch_size=50, flush_interval=5.0)
    set_message_queue(message_queue)

    bridge = WebSocketBridge(route_manager, message_queue)

    bridge_type = os.getenv("BRIDGE_TYPE", "native")

    if bridge_type == "native":
        logger.info("Initializing v-channel-bridge providers")

        db = next(get_db_session())
        try:
            accounts = (
                db.query(Account)
                .filter(Account.enabled.is_(True), Account.is_valid.is_(True))
                .all()
            )

            if not accounts:
                count = await migrate_env_to_db()
                if count > 0:
                    accounts = (
                        db.query(Account)
                        .filter(Account.enabled.is_(True), Account.is_valid.is_(True))
                        .all()
                    )

            for account in accounts:
                try:
                    if account.platform == "slack":
                        token = account.token_decrypted
                        app_token = account.app_token_decrypted
                        if token and app_token:
                            message_mode = os.getenv("SLACK_MESSAGE_MODE", "sender_info")
                            provider = SlackProvider(
                                bot_token=token, app_token=app_token,
                                message_mode=message_mode,
                            )
                            success = await bridge.add_provider(provider)
                            if success:
                                logger.info(f"Slack Provider registered: {account.name}")

                    elif account.platform == "teams":
                        app_password = account.app_password_decrypted
                        tenant_id = account.tenant_id_decrypted
                        app_id = account.app_id_decrypted
                        if tenant_id and app_id and app_password:
                            provider = TeamsProvider(
                                app_id=app_id, app_password=app_password,
                                tenant_id=tenant_id,
                                team_id=account.team_id_decrypted,
                                account_id=account.id,
                                webhook_url=account.webhook_url_decrypted,
                            )
                            success = await bridge.add_provider(provider)
                            if success:
                                logger.info(f"Teams Provider registered: {account.name}")

                except Exception as e:
                    logger.warning(f"Failed to process account {account.name}: {e}")
                    continue
        finally:
            db.close()

    set_bridge(bridge)
    logger.info("v-channel-bridge initialized")
    return bridge


@asynccontextmanager
async def lifespan(fastapi_app):
    """App lifecycle — startup/shutdown"""
    logger.info("Starting v-channel-bridge")

    # Platform init
    init_db()
    init_sso_providers()

    # EventBroadcaster
    broadcaster = EventBroadcaster(manager, None)
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()

    # Bridge init
    bridge = None
    bridge_task = None

    try:
        bridge = await init_bridge()
        bridge_task = asyncio.create_task(bridge.start())
        logger.info("v-channel-bridge started")

        # Teams subscription manager
        teams_provider = bridge.providers.get("teams")
        notification_url = os.getenv("TEAMS_NOTIFICATION_URL", "")
        if not notification_url:
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

    except Exception as e:
        logger.error("Failed to start bridge", error=str(e))

    yield

    # Shutdown
    logger.info("Stopping v-channel-bridge")

    from app.services.teams_subscription_manager import get_subscription_manager
    sub_mgr = get_subscription_manager()
    if sub_mgr:
        try:
            await sub_mgr.stop()
        except Exception:
            pass
        set_subscription_manager(None)

    if bridge:
        try:
            await bridge.stop()
        except Exception:
            pass

    if bridge_task and not bridge_task.done():
        bridge_task.cancel()
        try:
            await bridge_task
        except asyncio.CancelledError:
            pass

    if broadcaster_module.broadcaster:
        await broadcaster_module.broadcaster.stop()

    logger.info("Shutdown complete")


# Create app via PlatformApp
platform = PlatformApp(
    app_name="v-channel-bridge",
    version="2.0.0",
    description="v-platform + v-channel-bridge: Slack ↔ Teams Message Bridge",
    lifespan=lifespan,
)

# Register app-specific routers
platform.register_app_routers(
    bridge.router,
    messages.router,
    accounts_crud.router,
    accounts_test.router,
    teams_webhook.router,
    teams_notifications.router,
    monitoring.router,
)

# ASGI app for uvicorn
app = platform.fastapi


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "app": "v-channel-bridge",
        "platform": "v-platform",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
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
