"""itsm_notification_log — 알림 전송 로그 (pending/success/failure + 재시도)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class NotificationLog(Base):
    __tablename__ = "itsm_notification_log"
    __table_args__ = (
        Index("ix_inlog_ticket", "ticket_id"),
        Index("ix_inlog_event", "event_type"),
        Index("ix_inlog_status_created", "status", "created_at"),
        Index("ix_inlog_target_user", "target_user_id"),
        Index("ix_inlog_created_desc", "created_at"),
    )

    id = Column(String(26), primary_key=True)
    ticket_id = Column(
        String(26),
        ForeignKey("itsm_ticket.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type = Column(String(40), nullable=False)
    channel = Column(String(20), nullable=False)
    target_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_address = Column(String(300), nullable=False)
    payload = Column(JSONB, nullable=False)

    status = Column(String(20), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    last_retry_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
