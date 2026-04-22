"""v-itsm 통합 설정 API (관리자) — 설계 §7.1 + §9.1.

Slack/Teams/Email 비밀키를 DB(Fernet 암호화)로 관리. 시크릿은 출력 시
`*_set` 불린으로만 노출되고 평문은 provider 초기화에서만 복호화된다.

PATCH 후에는 reload_providers() 로 레지스트리를 즉시 갱신한다.
POST test/{channel} 은 provider.is_connected 로 소프트 체크 후
record_test_result 로 마지막 테스트 결과를 기록한다.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.providers import provider_registry, reload_providers
from app.schemas.common_message import Platform
from app.schemas.integration_settings import (
    IntegrationSettingsOut,
    IntegrationSettingsUpdate,
    IntegrationTestResult,
)
from app.services import integration_settings_service

router = APIRouter(prefix="/api/admin/integrations", tags=["admin-integrations"])

_CHANNEL_TO_PLATFORM = {
    "slack": Platform.SLACK,
    "teams": Platform.TEAMS,
}


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("", response_model=IntegrationSettingsOut)
async def get_integrations(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> IntegrationSettingsOut:
    _require_admin(current_user)
    row = integration_settings_service.get_settings(db)
    return integration_settings_service.to_out(row)


@router.patch("", response_model=IntegrationSettingsOut)
async def update_integrations(
    payload: IntegrationSettingsUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> IntegrationSettingsOut:
    _require_admin(current_user)
    row = integration_settings_service.update_settings(
        db, payload, actor_id=current_user.id
    )
    # provider 재초기화 — 실패해도 설정 변경은 유지 (fail-open)
    try:
        await reload_providers()
    except Exception:  # noqa: BLE001
        pass
    return integration_settings_service.to_out(row)


@router.post("/test/{channel}", response_model=IntegrationTestResult)
async def test_integration(
    channel: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> IntegrationTestResult:
    _require_admin(current_user)
    if channel == "email":
        ok, message = True, "email probe not implemented — recorded as skipped"
    else:
        platform = _CHANNEL_TO_PLATFORM.get(channel)
        if platform is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"unknown channel: {channel}"
            )
        provider = provider_registry.get(platform)
        if provider is None:
            ok, message = False, "provider not initialised"
        elif not provider.is_connected:
            ok, message = False, "provider not connected (check credentials)"
        else:
            ok, message = True, "provider connected"

    try:
        integration_settings_service.record_test_result(
            db, channel, ok=ok, message=message
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    return IntegrationTestResult(
        ok=ok, message=message, tested_at=datetime.now(timezone.utc)
    )
