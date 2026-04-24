"""itsm_ai_suggestion — LLM 생성 분류/초안/유사티켓 기록."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class AISuggestion(Base):
    __tablename__ = "itsm_ai_suggestion"
    __table_args__ = (
        Index("ix_itsm_ai_suggestion_ticket", "ticket_id", "created_at"),
        Index("ix_itsm_ai_suggestion_kind", "kind"),
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

    kind = Column(String(30), nullable=False)
    prompt_ref = Column(String(100), nullable=True)
    result = Column(JSONB, nullable=False)
    accepted = Column(Boolean, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
