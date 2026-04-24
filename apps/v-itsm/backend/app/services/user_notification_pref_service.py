"""User Notification Preference service.

user_id + workspace_id 복합 UNIQUE 이므로 본인 upsert(`get_or_create` + `update`) 패턴과
관리자용 단건 조회/삭제만 노출. 라우터에서는 `/api/ws/{wid}/me/notification-pref` 로
연결한다.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.user_notification_pref import UserNotificationPref
from app.schemas.user_notification_pref import UserNotificationPrefUpdate


def _new_ulid() -> str:
    return str(ULID())


def get_by_user(
    db: Session, user_id: int, *, workspace_id: str
) -> UserNotificationPref | None:
    stmt = select(UserNotificationPref).where(
        UserNotificationPref.user_id == user_id,
        UserNotificationPref.workspace_id == workspace_id,
    )
    return db.execute(stmt).scalar_one_or_none()


def get_or_create(
    db: Session, user_id: int, *, workspace_id: str
) -> UserNotificationPref:
    row = get_by_user(db, user_id, workspace_id=workspace_id)
    if row is not None:
        return row
    row = UserNotificationPref(
        id=_new_ulid(),
        workspace_id=workspace_id,
        user_id=user_id,
        channels=["email"],
        enabled=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update(
    db: Session,
    pref: UserNotificationPref,
    payload: UserNotificationPrefUpdate,
) -> UserNotificationPref:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(pref, field, value)
    db.commit()
    db.refresh(pref)
    return pref


def delete_by_user(db: Session, user_id: int, *, workspace_id: str) -> bool:
    row = get_by_user(db, user_id, workspace_id=workspace_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
