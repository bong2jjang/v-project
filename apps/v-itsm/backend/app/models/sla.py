"""itsm_sla_policy, itsm_sla_timer — SLA 정책 및 티켓별 타이머."""

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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class SLAPolicy(Base):
    __tablename__ = "itsm_sla_policy"
    __table_args__ = (
        UniqueConstraint("priority", "category", name="uq_itsm_sla_policy_priority_cat"),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name = Column(String(100), nullable=False)
    priority = Column(String(20), nullable=False)
    category = Column(String(100), nullable=True)

    response_minutes = Column(Integer, nullable=False)
    resolution_minutes = Column(Integer, nullable=False)

    business_hours = Column(JSONB, nullable=True)
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


class SLATimer(Base):
    __tablename__ = "itsm_sla_timer"
    __table_args__ = (
        UniqueConstraint("ticket_id", "kind", name="uq_itsm_sla_timer_ticket_kind"),
        Index("ix_itsm_sla_timer_due", "due_at"),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    ticket_id = Column(
        String(26),
        ForeignKey("itsm_ticket.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind = Column(String(20), nullable=False)

    due_at = Column(DateTime(timezone=True), nullable=False)
    warning_sent_at = Column(DateTime(timezone=True), nullable=True)
    breached_at = Column(DateTime(timezone=True), nullable=True)
    satisfied_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
