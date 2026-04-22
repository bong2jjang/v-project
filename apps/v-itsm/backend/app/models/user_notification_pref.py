"""itsm_user_notification_pref — 사용자별 알림 선호 (앱 로컬).

플랫폼 승격 보류 대안. 사용자당 한 로우 (user_id UNIQUE).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class UserNotificationPref(Base):
    __tablename__ = "itsm_user_notification_pref"

    id = Column(String(26), primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    slack_user_id = Column(String(50), nullable=True)
    teams_user_id = Column(String(100), nullable=True)
    teams_channel_override = Column(String(200), nullable=True)
    email_override = Column(String(300), nullable=True)

    channels = Column(
        JSONB,
        nullable=False,
        default=lambda: ["email"],
    )
    event_overrides = Column(JSONB, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    quiet_hours = Column(JSONB, nullable=True)

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
