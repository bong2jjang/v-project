"""itsm_assignment — 담당자 배정 이력."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from v_platform.models.base import Base


class Assignment(Base):
    __tablename__ = "itsm_assignment"
    __table_args__ = (
        Index("ix_itsm_assignment_ticket", "ticket_id", "assigned_at"),
        Index("ix_itsm_assignment_owner", "owner_id"),
    )

    id = Column(String(26), primary_key=True)
    ticket_id = Column(
        String(26),
        ForeignKey("itsm_ticket.id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False, default="primary")

    assigned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    released_at = Column(DateTime(timezone=True), nullable=True)
