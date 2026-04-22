"""itsm_sla_notification_policy — SLA 이벤트(warning/breach)별 알림 대상·채널 정책."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class SLANotificationPolicy(Base):
    __tablename__ = "itsm_sla_notification_policy"
    __table_args__ = (
        Index(
            "ix_snp_trigger_active",
            "trigger_event",
            "active",
        ),
    )

    id = Column(String(26), primary_key=True)
    name = Column(String(100), nullable=False)
    trigger_event = Column(String(20), nullable=False)  # warning | breach
    applies_priority = Column(String(20), nullable=True)
    applies_service_type = Column(String(20), nullable=True)

    notify_channels = Column(JSONB, nullable=False)  # ["slack","teams","email"]
    notify_assignee = Column(Boolean, nullable=False, default=True)
    notify_assignee_manager = Column(Boolean, nullable=False, default=False)
    notify_custom_user_ids = Column(JSONB, nullable=True)
    notify_custom_addresses = Column(JSONB, nullable=True)

    template_key = Column(String(50), nullable=True)
    active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
