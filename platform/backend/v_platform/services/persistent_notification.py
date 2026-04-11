"""Persistent Notification Service — scope 기반 알림 생성/조회/관리

Scopes:
  - global: 전 앱 전 사용자
  - app: 특정 앱 사용자
  - role: 특정 역할 사용자
  - user: 특정 사용자
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from v_platform.models.notification import Notification, NotificationRead

logger = logging.getLogger(__name__)


class PersistentNotificationService:

    @staticmethod
    def create(
        db: Session,
        title: str,
        message: str,
        severity: str = "info",
        category: str = "system",
        scope: str = "app",
        app_id: Optional[str] = None,
        target_role: Optional[str] = None,
        target_user_id: Optional[int] = None,
        source: Optional[str] = None,
        link: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        created_by: Optional[int] = None,
    ) -> Notification:
        notif = Notification(
            title=title,
            message=message,
            severity=severity,
            category=category,
            scope=scope,
            app_id=app_id if scope != "global" else None,
            target_role=target_role if scope == "role" else None,
            target_user_id=target_user_id if scope == "user" else None,
            source=source,
            link=link,
            expires_at=expires_at,
            created_by=created_by,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        logger.info(f"Notification created: scope={scope} title={title}")
        return notif

    @staticmethod
    def list_for_user(
        db: Session,
        user_id: int,
        user_role: str,
        app_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int]:
        now = datetime.now(timezone.utc)

        base_filter = and_(
            Notification.is_active.is_(True),
            or_(Notification.expires_at.is_(None), Notification.expires_at > now),
        )

        scope_filter = or_(
            Notification.scope == "global",
            and_(Notification.scope == "app", Notification.app_id == app_id),
            and_(Notification.scope == "role", Notification.target_role == user_role),
            and_(Notification.scope == "user", Notification.target_user_id == user_id),
        )

        query = db.query(Notification).filter(base_filter, scope_filter)

        if unread_only:
            read_ids = db.query(NotificationRead.notification_id).filter(
                NotificationRead.user_id == user_id
            ).subquery()
            query = query.filter(~Notification.id.in_(read_ids))

        total = query.count()
        notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
        return notifications, total

    @staticmethod
    def get(db: Session, notification_id: int) -> Optional[Notification]:
        return db.query(Notification).filter(Notification.id == notification_id).first()

    @staticmethod
    def update(db: Session, notification_id: int, **kwargs) -> Optional[Notification]:
        notif = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notif:
            return None
        for key, value in kwargs.items():
            if hasattr(notif, key) and value is not None:
                setattr(notif, key, value)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def mark_read(db: Session, notification_id: int, user_id: int) -> bool:
        existing = db.query(NotificationRead).filter(
            NotificationRead.notification_id == notification_id,
            NotificationRead.user_id == user_id,
        ).first()
        if existing:
            return True
        db.add(NotificationRead(notification_id=notification_id, user_id=user_id))
        db.commit()
        return True

    @staticmethod
    def mark_all_read(db: Session, user_id: int, app_id: Optional[str] = None, user_role: Optional[str] = None):
        now = datetime.now(timezone.utc)
        scope_filter = or_(
            Notification.scope == "global",
            and_(Notification.scope == "app", Notification.app_id == app_id),
            and_(Notification.scope == "role", Notification.target_role == user_role),
            and_(Notification.scope == "user", Notification.target_user_id == user_id),
        )
        notifs = db.query(Notification).filter(
            Notification.is_active.is_(True),
            or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            scope_filter,
        ).all()

        read_ids = {r.notification_id for r in db.query(NotificationRead).filter(
            NotificationRead.user_id == user_id
        ).all()}

        for n in notifs:
            if n.id not in read_ids:
                db.add(NotificationRead(notification_id=n.id, user_id=user_id))
        db.commit()

    @staticmethod
    def delete(db: Session, notification_id: int) -> bool:
        notif = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notif:
            return False
        db.delete(notif)
        db.commit()
        return True

    @staticmethod
    def unread_count(db: Session, user_id: int, app_id: Optional[str] = None, user_role: Optional[str] = None) -> int:
        now = datetime.now(timezone.utc)
        scope_filter = or_(
            Notification.scope == "global",
            and_(Notification.scope == "app", Notification.app_id == app_id),
            and_(Notification.scope == "role", Notification.target_role == user_role),
            and_(Notification.scope == "user", Notification.target_user_id == user_id),
        )
        read_ids = db.query(NotificationRead.notification_id).filter(
            NotificationRead.user_id == user_id
        ).subquery()

        return db.query(Notification).filter(
            Notification.is_active.is_(True),
            or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            scope_filter,
            ~Notification.id.in_(read_ids),
        ).count()
