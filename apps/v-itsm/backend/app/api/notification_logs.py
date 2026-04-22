"""v-itsm 알림 전송 로그 API (관리자) — 설계 §7.4 + §9.1.

NotificationLog 에는 provider 송출 결과(pending/success/failure) 와 payload 가
남아 있으므로, 관리자가 실패 건을 모아보고 재시도할 수 있어야 한다.
재시도는 기록된 payload(text/blocks/channel_id) 를 provider 로 다시 보낸 뒤
결과에 따라 mark_success / mark_failure(is_retry=True) 를 기록한다.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.providers import provider_registry
from app.schemas.common_message import (
    Channel,
    ChannelType,
    CommonMessage,
    MessageType,
    Platform,
    User as MsgUser,
)
from app.schemas.notification_log import (
    NotificationLogFilter,
    NotificationLogListResponse,
    NotificationLogOut,
    NotificationLogRetryResult,
)
from app.services import notification_log_service

router = APIRouter(
    prefix="/api/admin/notification-logs",
    tags=["admin-notification-logs"],
)

logger = structlog.get_logger(__name__)

_BOT_USER = MsgUser(
    id="itsm-bot",
    username="itsm",
    display_name="ITSM Bot",
    platform=Platform.VMS,
)


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("", response_model=NotificationLogListResponse)
async def list_notification_logs(
    filt: NotificationLogFilter = Depends(),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationLogListResponse:
    _require_admin(current_user)
    items, total = notification_log_service.list_logs(db, filt)
    return NotificationLogListResponse(
        items=[NotificationLogOut.model_validate(r) for r in items],
        total=total,
        page=filt.page,
        page_size=filt.page_size,
    )


@router.get("/{log_id}", response_model=NotificationLogOut)
async def get_notification_log(
    log_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationLogOut:
    _require_admin(current_user)
    row = notification_log_service.get_log(db, log_id)
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "notification log not found"
        )
    return NotificationLogOut.model_validate(row)


@router.post("/{log_id}/retry", response_model=NotificationLogRetryResult)
async def retry_notification_log(
    log_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> NotificationLogRetryResult:
    _require_admin(current_user)
    row = notification_log_service.get_log(db, log_id)
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "notification log not found"
        )

    try:
        platform = Platform(row.channel)
    except ValueError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"unsupported channel for retry: {row.channel}",
        ) from None

    payload = row.payload or {}
    text = str(payload.get("text") or "")
    blocks = payload.get("blocks") or None
    channel_id = row.target_address or str(payload.get("channel_id") or "")
    if not text or not channel_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "stored payload missing text or channel_id",
        )

    notification_log_service.mark_retry_pending(db, log_id)

    provider = provider_registry.get(platform)
    if provider is None:
        notification_log_service.mark_failure(
            db, log_id, error="provider_missing", is_retry=True
        )
        updated = notification_log_service.get_log(db, log_id)
        return NotificationLogRetryResult(
            ok=False,
            message="provider not initialised",
            log=NotificationLogOut.model_validate(updated),
        )
    if not provider.is_connected:
        notification_log_service.mark_failure(
            db, log_id, error="provider_disconnected", is_retry=True
        )
        updated = notification_log_service.get_log(db, log_id)
        return NotificationLogRetryResult(
            ok=False,
            message="provider not connected (check credentials)",
            log=NotificationLogOut.model_validate(updated),
        )

    msg = CommonMessage(
        message_id=f"itsm-{uuid.uuid4().hex[:12]}",
        timestamp=datetime.now(timezone.utc),
        type=MessageType.TEXT,
        platform=platform,
        user=_BOT_USER,
        channel=Channel(
            id=channel_id,
            name="",
            platform=platform,
            type=ChannelType.CHANNEL,
        ),
        text=text,
        raw_message={"blocks": blocks} if blocks else {},
    )

    try:
        sent = await provider.send_message(msg)
        ok = bool(sent)
    except Exception as e:  # noqa: BLE001 — fail-open
        logger.warning(
            "notification_log.retry_exception",
            platform=platform.value,
            log_id=log_id,
            error=str(e),
        )
        notification_log_service.mark_failure(
            db, log_id, error=str(e), is_retry=True
        )
        updated = notification_log_service.get_log(db, log_id)
        return NotificationLogRetryResult(
            ok=False,
            message=f"provider exception: {e}",
            log=NotificationLogOut.model_validate(updated),
        )

    if ok:
        notification_log_service.mark_success(db, log_id)
        message = "retry delivered"
    else:
        notification_log_service.mark_failure(
            db, log_id, error="send_returned_false", is_retry=True
        )
        message = "provider returned false"

    updated = notification_log_service.get_log(db, log_id)
    return NotificationLogRetryResult(
        ok=ok,
        message=message,
        log=NotificationLogOut.model_validate(updated),
    )
