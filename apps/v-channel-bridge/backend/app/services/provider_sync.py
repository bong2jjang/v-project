"""Provider 자동 동기화 헬퍼

Account DB 변경 시 브리지의 Provider를 DB 상태에 맞춰 즉시 재구성합니다.
이 헬퍼가 있기 전에는 계정 수정 후 백엔드 재시작 또는 수동 reload-providers
호출이 필요했습니다.
"""

from __future__ import annotations

import os
from typing import Optional

import structlog
from sqlalchemy.orm import Session

from app.adapters import SlackProvider, TeamsProvider
from app.adapters.base import BasePlatformProvider
from app.models import Account
from app.services.websocket_bridge import get_bridge

logger = structlog.get_logger()


def build_provider_from_account(account: Account) -> Optional[BasePlatformProvider]:
    """Account 레코드로부터 Provider 인스턴스를 생성한다.

    필수 자격증명이 빠졌거나 계정이 비활성/무효 상태면 None을 반환한다.
    """
    if not account.enabled or not account.is_valid:
        return None

    try:
        if account.platform == "slack":
            token = account.token_decrypted
            app_token = account.app_token_decrypted
            if not (token and app_token):
                return None
            message_mode = os.getenv("SLACK_MESSAGE_MODE", "sender_info")
            return SlackProvider(
                bot_token=token,
                app_token=app_token,
                message_mode=message_mode,
            )

        if account.platform == "teams":
            app_id = account.app_id_decrypted
            app_password = account.app_password_decrypted
            tenant_id = account.tenant_id_decrypted
            if not (app_id and app_password and tenant_id):
                return None
            return TeamsProvider(
                app_id=app_id,
                app_password=app_password,
                tenant_id=tenant_id,
                team_id=account.team_id_decrypted,
                account_id=account.id,
                webhook_url=account.webhook_url_decrypted,
            )
    except Exception as e:
        logger.warning(
            "Failed to build provider from account",
            account=account.name,
            platform=account.platform,
            error=str(e),
        )
        return None

    return None


async def sync_provider_for_platform(db: Session, platform: str) -> Optional[str]:
    """주어진 플랫폼의 Provider를 DB 상태에 맞춰 재구성한다.

    - DB에 해당 플랫폼의 enabled & valid 계정이 있으면: 해당 계정 기준 Provider로 교체
    - 없으면: 기존 Provider 제거

    Returns:
        수행한 동작을 나타내는 문자열("added"/"removed"/"replaced"/"noop") 또는
        브리지가 초기화되지 않은 경우 None.
    """
    bridge = get_bridge()
    if not bridge:
        logger.debug(
            "Bridge not initialized; skipping provider sync", platform=platform
        )
        return None

    account = (
        db.query(Account)
        .filter(
            Account.platform == platform,
            Account.enabled.is_(True),
            Account.is_valid.is_(True),
        )
        .order_by(Account.id)
        .first()
    )

    had_existing = platform in bridge.providers
    if had_existing:
        await bridge.remove_provider(platform)

    if not account:
        action = "removed" if had_existing else "noop"
        logger.info("Provider synced", platform=platform, action=action)
        return action

    provider = build_provider_from_account(account)
    if not provider:
        action = "removed" if had_existing else "noop"
        logger.info(
            "Provider synced (no valid provider could be built)",
            platform=platform,
            account=account.name,
            action=action,
        )
        return action

    success = await bridge.add_provider(provider)
    if not success:
        action = "removed" if had_existing else "noop"
        logger.warning(
            "Provider registration failed during sync",
            platform=platform,
            account=account.name,
        )
        return action

    action = "replaced" if had_existing else "added"
    logger.info(
        "Provider synced",
        platform=platform,
        account=account.name,
        action=action,
    )
    return action


async def sync_account_provider(db: Session, account: Account) -> Optional[str]:
    """Account 변경 시 해당 플랫폼의 Provider를 재동기화하는 헬퍼."""
    return await sync_provider_for_platform(db, account.platform)
