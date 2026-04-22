"""v-itsm 사용자 알림 선호 API (본인) — 설계 §7.5.

사용자별 알림 채널/조용시간/이벤트 오버라이드를 본인이 조회·수정하는 엔드포인트.
`itsm_user_notification_pref.user_id` UNIQUE 이므로 최초 GET 에서 자동 생성(upsert)
한 뒤 PATCH 로 부분 업데이트한다. 관리자 전용이 아니므로 role 가드 없음.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.schemas.user_notification_pref import (
    UserNotificationPrefOut,
    UserNotificationPrefUpdate,
)
from app.services import user_notification_pref_service

router = APIRouter(
    prefix="/api/me/notification-pref",
    tags=["me-notification-pref"],
)


@router.get("", response_model=UserNotificationPrefOut)
async def get_my_notification_pref(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserNotificationPrefOut:
    pref = user_notification_pref_service.get_or_create(db, current_user.id)
    return UserNotificationPrefOut.model_validate(pref)


@router.patch("", response_model=UserNotificationPrefOut)
async def update_my_notification_pref(
    payload: UserNotificationPrefUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserNotificationPrefOut:
    pref = user_notification_pref_service.get_or_create(db, current_user.id)
    updated = user_notification_pref_service.update(db, pref, payload)
    return UserNotificationPrefOut.model_validate(updated)
