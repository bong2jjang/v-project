"""Persistent Notifications API — scope 기반 알림 CRUD

관리자: 알림 생성/수정/삭제 + scope 조정
일반 사용자: 알림 조회/읽음 처리
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user, require_permission
from v_platform.services.persistent_notification import PersistentNotificationService

router = APIRouter(prefix="/api/notifications-v2", tags=["notifications-v2"])


# ── Schemas ──

class NotificationCreate(BaseModel):
    title: str = Field(..., max_length=200)
    message: str
    severity: str = Field(default="info", pattern="^(critical|error|warning|info|success)$")
    category: str = Field(default="system")
    scope: str = Field(default="app", pattern="^(global|app|role|user)$")
    target_role: Optional[str] = None
    target_user_id: Optional[int] = None
    link: Optional[str] = None
    expires_at: Optional[datetime] = None


class NotificationUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    message: Optional[str] = None
    severity: Optional[str] = None
    scope: Optional[str] = Field(None, pattern="^(global|app|role|user)$")
    target_role: Optional[str] = None
    target_user_id: Optional[int] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    category: str
    scope: str
    app_id: Optional[str] = None
    target_role: Optional[str] = None
    target_user_id: Optional[int] = None
    source: Optional[str] = None
    link: Optional[str] = None
    is_active: bool
    is_system: bool = False
    expires_at: Optional[str] = None
    created_by: Optional[int] = None
    created_at: str
    is_read: bool = False


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


# ── Endpoints ──

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    request: Request,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """현재 사용자에게 해당하는 알림 목록 (scope 기반 필터)"""
    app_id = getattr(request.app.state, 'app_id', None)
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)

    notifications, total = PersistentNotificationService.list_for_user(
        db=db,
        user_id=current_user.id,
        user_role=user_role,
        app_id=app_id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )

    unread = PersistentNotificationService.unread_count(
        db=db, user_id=current_user.id, app_id=app_id, user_role=user_role,
    )

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                **{k: (v.isoformat() if isinstance(v, datetime) else v)
                   for k, v in n.to_dict(current_user.id).items()
                   if k in NotificationResponse.model_fields}
            )
            for n in notifications
        ],
        total=total,
        unread_count=unread,
    )


@router.post("", response_model=NotificationResponse)
async def create_notification(
    request: Request,
    data: NotificationCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """알림 생성 (관리자)"""
    app_id = getattr(request.app.state, 'app_id', None)

    notif = PersistentNotificationService.create(
        db=db,
        title=data.title,
        message=data.message,
        severity=data.severity,
        category=data.category,
        scope=data.scope,
        app_id=app_id,
        target_role=data.target_role,
        target_user_id=data.target_user_id,
        source="admin",
        link=data.link,
        expires_at=data.expires_at,
        created_by=current_user.id,
    )

    return NotificationResponse(**{
        k: (v.isoformat() if isinstance(v, datetime) else v)
        for k, v in notif.to_dict(current_user.id).items()
        if k in NotificationResponse.model_fields
    })


@router.put("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: int,
    data: NotificationUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """알림 수정 — scope, 대상, 활성 상태 등 변경 (관리자)"""
    updates = data.model_dump(exclude_none=True)
    notif = PersistentNotificationService.update(db, notification_id, **updates)
    if not notif:
        raise HTTPException(404, "알림을 찾을 수 없습니다.")

    return NotificationResponse(**{
        k: (v.isoformat() if isinstance(v, datetime) else v)
        for k, v in notif.to_dict(current_user.id).items()
        if k in NotificationResponse.model_fields
    })


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """알림 읽음 처리"""
    PersistentNotificationService.mark_read(db, notification_id, current_user.id)
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """전체 읽음 처리"""
    app_id = getattr(request.app.state, 'app_id', None)
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    PersistentNotificationService.mark_all_read(db, current_user.id, app_id, user_role)
    return {"status": "ok"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """알림 삭제 (관리자) — 시스템 기본 알림은 삭제 불가"""
    notif = PersistentNotificationService.get(db, notification_id)
    if not notif:
        raise HTTPException(404, "알림을 찾을 수 없습니다.")
    if notif.is_system:
        raise HTTPException(403, "시스템 기본 알림은 삭제할 수 없습니다. 비활성화만 가능합니다.")
    if not PersistentNotificationService.delete(db, notification_id):
        raise HTTPException(500, "알림 삭제에 실패했습니다.")
    return {"status": "deleted"}
