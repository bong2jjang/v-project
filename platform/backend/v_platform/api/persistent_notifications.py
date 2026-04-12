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
from v_platform.utils.auth import get_current_user
from v_platform.services.persistent_notification import PersistentNotificationService
from v_platform.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notifications-v2", tags=["notifications-v2"])


# ── Schemas ──


class NotificationCreate(BaseModel):
    title: str = Field(..., max_length=200)
    message: str
    severity: str = Field(
        default="info", pattern="^(critical|error|warning|info|success)$"
    )
    category: str = Field(default="system")
    scope: str = Field(default="app", pattern="^(global|app|role|user)$")
    target_role: Optional[str] = None
    target_user_id: Optional[int] = None
    link: Optional[str] = None
    expires_at: Optional[datetime] = None
    delivery_type: str = Field(default="toast", pattern="^(toast|announcement|both)$")


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
    delivery_type: Optional[str] = Field(None, pattern="^(toast|announcement|both)$")


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
    delivery_type: str = "toast"
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
    admin_view: bool = Query(default=False),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """알림 목록 — admin_view=true면 전체 알림, 아니면 scope 기반 필터"""
    app_id = getattr(request.app.state, "app_id", None)
    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    if admin_view:
        # 관리자 뷰: SYSTEM 알림 + 해당 앱 커스텀 알림
        notifications, total, app_overrides = PersistentNotificationService.list_all(
            db=db,
            app_id=app_id,
            limit=limit,
            offset=offset,
        )
        unread = 0
    else:
        app_overrides = {}

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
            db=db,
            user_id=current_user.id,
            app_id=app_id,
            user_role=user_role,
        )

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                **{
                    k: (v.isoformat() if isinstance(v, datetime) else v)
                    for k, v in n.to_dict(
                        current_user.id,
                        app_is_active=app_overrides.get(n.id)
                        if n.is_system and n.id in app_overrides
                        else None,
                    ).items()
                    if k in NotificationResponse.model_fields
                }
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
    """알림 생성 (관리자) — 커스텀 알림은 해당 앱으로 한정"""
    if data.scope == "global":
        raise HTTPException(
            400, "커스텀 알림은 전역(global) 범위를 사용할 수 없습니다."
        )
    if data.scope == "role" and not data.target_role:
        raise HTTPException(
            400, "역할 범위 알림은 대상 역할(target_role)이 필요합니다."
        )
    if data.scope == "user" and not data.target_user_id:
        raise HTTPException(
            400, "사용자 범위 알림은 대상 사용자 ID(target_user_id)가 필요합니다."
        )

    app_id = getattr(request.app.state, "app_id", None)

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
        delivery_type=data.delivery_type,
    )

    # 실시간 WebSocket 브로드캐스트 (toast 또는 both일 때만)
    if data.delivery_type in ("toast", "both"):
        ws_notif = NotificationService.create_notification(
            severity=data.severity,
            category=data.category,
            title=data.title,
            message=data.message,
            source="admin",
            link=data.link,
            persistent=True,
        )
        ws_notif["persistent_id"] = notif.id
        await NotificationService.broadcast_notification(ws_notif)

    return NotificationResponse(
        **{
            k: (v.isoformat() if isinstance(v, datetime) else v)
            for k, v in notif.to_dict(current_user.id).items()
            if k in NotificationResponse.model_fields
        }
    )


@router.put("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: int,
    data: NotificationUpdate,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """알림 수정 — scope, 대상, 활성 상태 등 변경 (관리자)

    시스템 알림의 is_active 토글은 앱별 override로 처리됨.
    """
    existing = PersistentNotificationService.get(db, notification_id)
    if not existing:
        raise HTTPException(404, "알림을 찾을 수 없습니다.")

    scope = data.scope if data.scope is not None else existing.scope
    if scope == "role" and data.target_role is not None and not data.target_role:
        raise HTTPException(
            400, "역할 범위 알림은 대상 역할(target_role)이 필요합니다."
        )
    if scope == "user" and data.target_user_id is not None and not data.target_user_id:
        raise HTTPException(
            400, "사용자 범위 알림은 대상 사용자 ID(target_user_id)가 필요합니다."
        )

    app_id = getattr(request.app.state, "app_id", None)
    app_is_active = None

    # 시스템 알림의 is_active 토글 → 앱별 override
    if existing.is_system and data.is_active is not None:
        if app_id:
            PersistentNotificationService.set_app_override(
                db,
                notification_id,
                app_id,
                data.is_active,
            )
            app_is_active = data.is_active
        # 시스템 알림은 원본 is_active를 변경하지 않음
        updates = data.model_dump(exclude_none=True)
        updates.pop("is_active", None)
    else:
        updates = data.model_dump(exclude_none=True)

    if updates:
        notif = PersistentNotificationService.update(db, notification_id, **updates)
        if not notif:
            raise HTTPException(404, "알림을 찾을 수 없습니다.")
    else:
        notif = existing

    return NotificationResponse(
        **{
            k: (v.isoformat() if isinstance(v, datetime) else v)
            for k, v in notif.to_dict(
                current_user.id, app_is_active=app_is_active
            ).items()
            if k in NotificationResponse.model_fields
        }
    )


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
    app_id = getattr(request.app.state, "app_id", None)
    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )
    PersistentNotificationService.mark_all_read(db, current_user.id, app_id, user_role)
    return {"status": "ok"}


@router.get("/system-status")
async def get_system_status(
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """앱별 시스템 알림 활성 상태 목록 — 프론트엔드에서 기능 활성 여부 판단용"""
    app_id = getattr(request.app.state, "app_id", None)
    return PersistentNotificationService.get_system_status(db, app_id)


@router.get("/announcements", response_model=list[NotificationResponse])
async def list_announcements(
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """미읽은 공지사항(announcement/both) 목록 — 팝업 표시용"""
    app_id = getattr(request.app.state, "app_id", None)
    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )
    notifications, _ = PersistentNotificationService.list_for_user(
        db=db,
        user_id=current_user.id,
        user_role=user_role,
        app_id=app_id,
        limit=10,
        offset=0,
        unread_only=True,
        delivery_types=["announcement", "both"],
    )
    return [
        NotificationResponse(
            **{
                k: (v.isoformat() if isinstance(v, datetime) else v)
                for k, v in n.to_dict(current_user.id).items()
                if k in NotificationResponse.model_fields
            }
        )
        for n in notifications
    ]


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
        raise HTTPException(
            403, "시스템 기본 알림은 삭제할 수 없습니다. 비활성화만 가능합니다."
        )
    if not PersistentNotificationService.delete(db, notification_id):
        raise HTTPException(500, "알림 삭제에 실패했습니다.")
    return {"status": "deleted"}
