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
from sqlalchemy.orm import Session

from v_platform.models.notification import (
    Notification,
    NotificationAppOverride,
    NotificationRead,
)

logger = logging.getLogger(__name__)


class PersistentNotificationService:
    @staticmethod
    def _build_scope_filter(user_id: int, user_role: str, app_id: Optional[str] = None):
        """SYSTEM 알림을 포함한 scope 필터 생성

        - SYSTEM+global: 전체 사용자
        - SYSTEM+role (target_role=NULL): system_admin, org_admin에게만 전달
        - SYSTEM+user (target_user_id=NULL): 모든 사용자에게 전달 (본인 알림)
        - 일반+role: target_role 정확히 매칭
        - 일반+user: target_user_id 정확히 매칭
        """
        conditions = [
            Notification.scope == "global",
            and_(Notification.scope == "app", Notification.app_id == app_id),
            # 커스텀 role/user: 해당 앱으로 한정
            and_(
                Notification.scope == "role",
                Notification.is_system.is_(False),
                Notification.target_role == user_role,
                Notification.app_id == app_id,
            ),
            and_(
                Notification.scope == "user",
                Notification.is_system.is_(False),
                Notification.target_user_id == user_id,
                Notification.app_id == app_id,
            ),
            # SYSTEM+user: 모든 사용자에게 (본인 알림)
            and_(Notification.scope == "user", Notification.is_system.is_(True)),
        ]
        # SYSTEM+role: system_admin, org_admin에게만
        if user_role in ("system_admin", "org_admin"):
            conditions.append(
                and_(Notification.scope == "role", Notification.is_system.is_(True))
            )
        return or_(*conditions)

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
        delivery_type: str = "toast",
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
            delivery_type=delivery_type,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        logger.info(f"Notification created: scope={scope} title={title}")
        return notif

    @staticmethod
    def _get_disabled_system_ids(db: Session, app_id: Optional[str]) -> set[int]:
        """해당 앱에서 비활성화된 시스템 알림 ID 집합"""
        if not app_id:
            return set()
        rows = (
            db.query(NotificationAppOverride.notification_id)
            .filter(
                NotificationAppOverride.app_id == app_id,
                NotificationAppOverride.is_active.is_(False),
            )
            .all()
        )
        return {r[0] for r in rows}

    @staticmethod
    def _get_app_overrides(db: Session, app_id: Optional[str]) -> dict[int, bool]:
        """해당 앱의 시스템 알림 override 맵 {notification_id: is_active}"""
        if not app_id:
            return {}
        rows = (
            db.query(NotificationAppOverride)
            .filter(
                NotificationAppOverride.app_id == app_id,
            )
            .all()
        )
        return {r.notification_id: r.is_active for r in rows}

    @staticmethod
    def list_for_user(
        db: Session,
        user_id: int,
        user_role: str,
        app_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        delivery_types: Optional[list[str]] = None,
    ) -> tuple[list[Notification], int]:
        now = datetime.now(timezone.utc)

        base_filter = and_(
            Notification.is_active.is_(True),
            or_(Notification.expires_at.is_(None), Notification.expires_at > now),
        )

        scope_filter = PersistentNotificationService._build_scope_filter(
            user_id, user_role, app_id
        )

        # 앱별로 비활성된 시스템 알림 제외
        disabled_ids = PersistentNotificationService._get_disabled_system_ids(
            db, app_id
        )

        query = db.query(Notification).filter(base_filter, scope_filter)
        if disabled_ids:
            query = query.filter(~Notification.id.in_(disabled_ids))

        if delivery_types:
            query = query.filter(Notification.delivery_type.in_(delivery_types))

        if unread_only:
            read_ids = (
                db.query(NotificationRead.notification_id)
                .filter(NotificationRead.user_id == user_id)
                .subquery()
            )
            query = query.filter(~Notification.id.in_(read_ids))

        total = query.count()
        notifications = (
            query.order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return notifications, total

    @staticmethod
    def list_all(
        db: Session,
        app_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Notification], int, dict[int, bool]]:
        """관리자용: SYSTEM 알림 + 해당 앱 커스텀 알림

        Returns: (notifications, total, app_overrides)
        app_overrides: 시스템 알림의 앱별 is_active 오버라이드 맵
        """
        query = db.query(Notification).filter(
            or_(
                Notification.is_system.is_(True),
                Notification.app_id == app_id,
            )
        )
        total = query.count()
        notifications = (
            query.order_by(
                Notification.is_system.desc(), Notification.created_at.desc()
            )
            .offset(offset)
            .limit(limit)
            .all()
        )
        app_overrides = PersistentNotificationService._get_app_overrides(db, app_id)
        return notifications, total, app_overrides

    @staticmethod
    def get(db: Session, notification_id: int) -> Optional[Notification]:
        return db.query(Notification).filter(Notification.id == notification_id).first()

    @staticmethod
    def update(db: Session, notification_id: int, **kwargs) -> Optional[Notification]:
        notif = (
            db.query(Notification).filter(Notification.id == notification_id).first()
        )
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
        existing = (
            db.query(NotificationRead)
            .filter(
                NotificationRead.notification_id == notification_id,
                NotificationRead.user_id == user_id,
            )
            .first()
        )
        if existing:
            return True
        db.add(NotificationRead(notification_id=notification_id, user_id=user_id))
        db.commit()
        return True

    @staticmethod
    def mark_all_read(
        db: Session,
        user_id: int,
        app_id: Optional[str] = None,
        user_role: Optional[str] = None,
    ):
        now = datetime.now(timezone.utc)
        scope_filter = PersistentNotificationService._build_scope_filter(
            user_id, user_role or "", app_id
        )
        disabled_ids = PersistentNotificationService._get_disabled_system_ids(
            db, app_id
        )
        query = db.query(Notification).filter(
            Notification.is_active.is_(True),
            or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            scope_filter,
        )
        if disabled_ids:
            query = query.filter(~Notification.id.in_(disabled_ids))
        notifs = query.all()

        read_ids = {
            r.notification_id
            for r in db.query(NotificationRead)
            .filter(NotificationRead.user_id == user_id)
            .all()
        }

        for n in notifs:
            if n.id not in read_ids:
                db.add(NotificationRead(notification_id=n.id, user_id=user_id))
        db.commit()

    @staticmethod
    def delete(db: Session, notification_id: int) -> bool:
        notif = (
            db.query(Notification).filter(Notification.id == notification_id).first()
        )
        if not notif:
            return False
        db.delete(notif)
        db.commit()
        return True

    @staticmethod
    def set_app_override(
        db: Session,
        notification_id: int,
        app_id: str,
        is_active: bool,
    ) -> NotificationAppOverride:
        """시스템 알림의 앱별 활성/비활성 설정 (upsert)"""
        override = (
            db.query(NotificationAppOverride)
            .filter(
                NotificationAppOverride.notification_id == notification_id,
                NotificationAppOverride.app_id == app_id,
            )
            .first()
        )
        if override:
            override.is_active = is_active
        else:
            override = NotificationAppOverride(
                notification_id=notification_id,
                app_id=app_id,
                is_active=is_active,
            )
            db.add(override)
        db.commit()
        db.refresh(override)
        return override

    @staticmethod
    def get_system_status(
        db: Session,
        app_id: Optional[str] = None,
    ) -> list[dict]:
        """앱별 시스템 알림 활성 상태 목록 반환"""
        system_notifs = (
            db.query(Notification)
            .filter(
                Notification.is_system.is_(True),
            )
            .all()
        )
        overrides = PersistentNotificationService._get_app_overrides(db, app_id)
        result = []
        for n in system_notifs:
            effective = overrides.get(n.id, n.is_active)
            result.append(
                {
                    "id": n.id,
                    "title": n.title,
                    "category": n.category,
                    "scope": n.scope,
                    "is_active": effective,
                }
            )
        return result

    @staticmethod
    def unread_count(
        db: Session,
        user_id: int,
        app_id: Optional[str] = None,
        user_role: Optional[str] = None,
    ) -> int:
        now = datetime.now(timezone.utc)
        scope_filter = PersistentNotificationService._build_scope_filter(
            user_id, user_role or "", app_id
        )
        disabled_ids = PersistentNotificationService._get_disabled_system_ids(
            db, app_id
        )
        read_ids = (
            db.query(NotificationRead.notification_id)
            .filter(NotificationRead.user_id == user_id)
            .subquery()
        )

        query = db.query(Notification).filter(
            Notification.is_active.is_(True),
            or_(Notification.expires_at.is_(None), Notification.expires_at > now),
            scope_filter,
            ~Notification.id.in_(read_ids),
        )
        if disabled_ids:
            query = query.filter(~Notification.id.in_(disabled_ids))
        return query.count()
