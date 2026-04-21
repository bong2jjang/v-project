"""itsm_loop_transition — Loop FSM 전이 이력 (append-only)."""

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


class LoopTransition(Base):
    __tablename__ = "itsm_loop_transition"
    __table_args__ = (
        Index("ix_itsm_loop_transition_ticket", "ticket_id", "transitioned_at"),
    )

    id = Column(String(26), primary_key=True)
    ticket_id = Column(
        String(26),
        ForeignKey("itsm_ticket.id", ondelete="CASCADE"),
        nullable=False,
    )

    from_stage = Column(String(20), nullable=True)
    to_stage = Column(String(20), nullable=False)
    action = Column(String(20), nullable=False)

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
    artifacts = Column(JSONB, nullable=True)

    transitioned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
