"""itsm_feedback — 고객 만족도 / 재오픈 요청."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from v_platform.models.base import Base


class Feedback(Base):
    __tablename__ = "itsm_feedback"
    __table_args__ = (
        Index("ix_itsm_feedback_ticket", "ticket_id"),
    )

    id = Column(String(26), primary_key=True)
    ticket_id = Column(
        String(26),
        ForeignKey("itsm_ticket.id", ondelete="CASCADE"),
        nullable=False,
    )

    score = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    reopen = Column(Boolean, nullable=False, default=False)

    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
