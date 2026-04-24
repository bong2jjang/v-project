"""v-itsm 사용자 알림 선호 API (본인) — 설계 §7.5.

사용자별 알림 채널/조용시간/이벤트 오버라이드를 본인이 조회·수정하는 엔드포인트.
`(user_id, workspace_id)` 복합 UNIQUE 이므로 최초 GET 에서 자동 생성(upsert)
한 뒤 PATCH 로 부분 업데이트한다. 관리자 전용이 아니므로 role 가드 없음.

엔드포인트:
  - `/api/ws/{workspace_id}/me/notification-pref` — 명시적 WS 지정
  - `/api/me/notification-pref` — 사용자의 기본(default) WS 로 자동 해석
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.user_notification_pref import (
    UserNotificationPrefOut,
    UserNotificationPrefUpdate,
)
from app.services import user_notification_pref_service

router = APIRouter(
    prefix="/api/ws/{workspace_id}/me/notification-pref",
    tags=["me-notification-pref"],
)

# 워크스페이스를 지정하지 않고 기본 WS 로 처리하는 편의 라우터
default_router = APIRouter(
    prefix="/api/me/notification-pref",
    tags=["me-notification-pref"],
)


def _resolve_default_workspace(db: Session, current_user: User) -> Workspace:
    """현재 사용자의 is_default 멤버십 → 전사 공통 WS → 404 순으로 해석."""
    member = db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.is_default.is_(True),
        )
    ).scalar_one_or_none()
    if member is not None:
        ws = db.get(Workspace, member.workspace_id)
        if ws is not None and ws.archived_at is None:
            return ws

    ws = db.execute(
        select(Workspace).where(Workspace.is_default.is_(True))
    ).scalar_one_or_none()
    if ws is not None and ws.archived_at is None:
        return ws

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="기본 워크스페이스를 찾을 수 없습니다.",
    )


@router.get("", response_model=UserNotificationPrefOut)
async def get_my_notification_pref(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> UserNotificationPrefOut:
    pref = user_notification_pref_service.get_or_create(
        db, current_user.id, workspace_id=workspace.id
    )
    return UserNotificationPrefOut.model_validate(pref)


@router.patch("", response_model=UserNotificationPrefOut)
async def update_my_notification_pref(
    payload: UserNotificationPrefUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> UserNotificationPrefOut:
    pref = user_notification_pref_service.get_or_create(
        db, current_user.id, workspace_id=workspace.id
    )
    updated = user_notification_pref_service.update(db, pref, payload)
    return UserNotificationPrefOut.model_validate(updated)


@default_router.get("", response_model=UserNotificationPrefOut)
async def get_my_notification_pref_default(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserNotificationPrefOut:
    workspace = _resolve_default_workspace(db, current_user)
    pref = user_notification_pref_service.get_or_create(
        db, current_user.id, workspace_id=workspace.id
    )
    return UserNotificationPrefOut.model_validate(pref)


@default_router.patch("", response_model=UserNotificationPrefOut)
async def update_my_notification_pref_default(
    payload: UserNotificationPrefUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserNotificationPrefOut:
    workspace = _resolve_default_workspace(db, current_user)
    pref = user_notification_pref_service.get_or_create(
        db, current_user.id, workspace_id=workspace.id
    )
    updated = user_notification_pref_service.update(db, pref, payload)
    return UserNotificationPrefOut.model_validate(updated)
