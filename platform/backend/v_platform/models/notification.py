"""Notification Model — 영속 알림 (DB 저장, scope 기반 전달)"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, JSON,
)
from sqlalchemy.orm import relationship
from v_platform.models.base import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("idx_notifications_scope_app", "scope", "app_id"),
        Index("idx_notifications_active_created", "is_active", "created_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 알림 내용
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="info")
    category = Column(String(50), nullable=False, default="system")

    # 범위 (Scope)
    scope = Column(String(20), nullable=False, default="app")  # global/app/role/user
    app_id = Column(String(50), nullable=True)  # NULL=global
    target_role = Column(String(50), nullable=True)  # NULL=모든 역할
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # 메타데이터
    source = Column(String(100), nullable=True)
    link = Column(String(500), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)

    # 상태
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # 발신자
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    reads = relationship("NotificationRead", back_populates="notification", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])

    def to_dict(self, user_id: int | None = None) -> dict:
        read_by = {r.user_id for r in self.reads} if self.reads else set()
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "category": self.category,
            "scope": self.scope,
            "app_id": self.app_id,
            "target_role": self.target_role,
            "target_user_id": self.target_user_id,
            "source": self.source,
            "link": self.link,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_read": user_id in read_by if user_id else False,
        }


class NotificationRead(Base):
    __tablename__ = "notification_reads"
    __table_args__ = (
        Index("uq_notification_user_read", "notification_id", "user_id", unique=True),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    notification_id = Column(Integer, ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    notification = relationship("Notification", back_populates="reads")
