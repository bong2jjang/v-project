"""Provider registry — Platform → outbound provider 싱글톤 테이블.

사용 패턴
    # 앱 기동 시 (lifespan)
    await init_providers()           # DB 우선, 없으면 env fallback
    # 관리자가 통합설정 저장 후
    await reload_providers()         # 재등록

    # 알림 송출 지점
    provider = provider_registry.get(Platform.SLACK)
    if provider:
        await provider.send_message(common_msg)

    # 앱 종료 시
    await shutdown_providers()

설계 결정
  * **DB(IntegrationSettings) 우선, 환경변수는 fallback** — Operations Console 에서
    저장한 설정이 런타임 재기동 없이 반영되도록 `reload_providers()` 제공.
  * 누락은 로그만 남기고 무시 — 부분 구성(Slack 만, Teams 만) 허용.
  * 연결 실패 시에도 registry 에 등록은 함. send_message 는 is_connected 확인 후 drop.
  * ITSM 알림은 fail-open — provider 부재가 티켓 저장/전이를 막아선 안 됨.
"""

from __future__ import annotations

import os
from typing import Any

import structlog

from app.providers.base import BaseOutboundProvider
from app.schemas.common_message import Platform

logger = structlog.get_logger(__name__)


class _ProviderRegistry:
    """플랫폼 → provider 인스턴스 매핑. 모듈 싱글톤."""

    def __init__(self) -> None:
        self._providers: dict[Platform, BaseOutboundProvider] = {}

    def register(self, platform: Platform, provider: BaseOutboundProvider) -> None:
        self._providers[platform] = provider

    def get(self, platform: Platform) -> BaseOutboundProvider | None:
        return self._providers.get(platform)

    def all(self) -> dict[Platform, BaseOutboundProvider]:
        return dict(self._providers)

    def clear(self) -> None:
        self._providers.clear()


provider_registry = _ProviderRegistry()


def _slack_config_from_env() -> dict[str, Any] | None:
    bot_token = os.getenv("SLACK_BOT_TOKEN", "").strip()
    if not bot_token:
        return None
    return {"bot_token": bot_token}


def _teams_config_from_env() -> dict[str, Any] | None:
    tenant_id = os.getenv("TEAMS_TENANT_ID", "").strip()
    app_id = os.getenv("TEAMS_APP_ID", "").strip()
    app_password = os.getenv("TEAMS_APP_PASSWORD", "").strip()
    team_id = os.getenv("TEAMS_TEAM_ID", "").strip()
    webhook_url = os.getenv("TEAMS_NOTIFICATION_URL", "").strip()

    # 최소 조건: graph 3종 OR webhook
    has_graph = all((tenant_id, app_id, app_password))
    if not has_graph and not webhook_url:
        return None
    return {
        "tenant_id": tenant_id,
        "app_id": app_id,
        "app_password": app_password,
        "team_id": team_id,
        "webhook_url": webhook_url,
    }


def _slack_config_from_db() -> dict[str, Any] | None:
    """IntegrationSettings → Slack cfg. DB row 없으면 None (env fallback)."""
    try:
        from app.services import integration_settings_service
        from v_platform.core.database import SessionLocal
    except Exception:  # noqa: BLE001
        return None

    try:
        with SessionLocal() as db:
            plain = integration_settings_service.get_slack_plaintext(db)
    except Exception as e:  # noqa: BLE001
        logger.warning("integration_settings.slack_read_error", error=str(e))
        return None

    bot_token = (plain.get("bot_token") or "").strip()
    if not bot_token:
        return None
    return {"bot_token": bot_token}


def _teams_config_from_db() -> dict[str, Any] | None:
    try:
        from app.services import integration_settings_service
        from v_platform.core.database import SessionLocal
    except Exception:  # noqa: BLE001
        return None

    try:
        with SessionLocal() as db:
            plain = integration_settings_service.get_teams_plaintext(db)
    except Exception as e:  # noqa: BLE001
        logger.warning("integration_settings.teams_read_error", error=str(e))
        return None

    tenant_id = (plain.get("tenant_id") or "").strip()
    app_id = (plain.get("app_id") or "").strip()
    app_password = (plain.get("app_password") or "").strip()
    team_id = (plain.get("team_id") or "").strip()
    webhook_url = (plain.get("webhook_url") or "").strip()

    has_graph = all((tenant_id, app_id, app_password))
    if not has_graph and not webhook_url:
        return None
    return {
        "tenant_id": tenant_id,
        "app_id": app_id,
        "app_password": app_password,
        "team_id": team_id,
        "webhook_url": webhook_url,
    }


async def init_providers() -> None:
    """DB(IntegrationSettings) 우선, 없으면 env 로 provider 를 초기화.

    실패 시 경고만 로그, 예외 전파 없음.
    """
    from app.providers.slack_provider import SlackOutboundProvider
    from app.providers.teams_provider import TeamsOutboundProvider

    slack_cfg = _slack_config_from_db() or _slack_config_from_env()
    source = (
        "db" if _slack_config_from_db()
        else ("env" if _slack_config_from_env() else "none")
    )
    if slack_cfg:
        slack = SlackOutboundProvider(slack_cfg)
        try:
            ok = await slack.connect()
            provider_registry.register(Platform.SLACK, slack)
            logger.info("Slack provider registered", connected=ok, source=source)
        except Exception as e:  # noqa: BLE001
            logger.warning("Slack provider init error", error=str(e), source=source)
    else:
        logger.info("Slack provider skipped — bot_token missing in DB and env")

    teams_cfg = _teams_config_from_db() or _teams_config_from_env()
    tsource = (
        "db" if _teams_config_from_db()
        else ("env" if _teams_config_from_env() else "none")
    )
    if teams_cfg:
        teams = TeamsOutboundProvider(teams_cfg)
        try:
            ok = await teams.connect()
            provider_registry.register(Platform.TEAMS, teams)
            logger.info("Teams provider registered", connected=ok, source=tsource)
        except Exception as e:  # noqa: BLE001
            logger.warning("Teams provider init error", error=str(e), source=tsource)
    else:
        logger.info(
            "Teams provider skipped — graph credentials and webhook both missing"
        )


# Backwards-compatible alias (기존 lifespan 이 이 이름을 호출하고 있을 수 있음)
async def init_providers_from_env() -> None:
    await init_providers()


async def reload_providers() -> None:
    """통합설정 저장 후 런타임 재등록. 기존 세션을 정리한 뒤 init_providers()."""
    await shutdown_providers()
    await init_providers()


async def shutdown_providers() -> None:
    """모든 provider 세션 정리."""
    for platform, provider in provider_registry.all().items():
        try:
            await provider.disconnect()
            logger.info("Provider disconnected", platform=platform.value)
        except Exception as e:
            logger.warning(
                "Provider disconnect error", platform=platform.value, error=str(e)
            )
    provider_registry.clear()
