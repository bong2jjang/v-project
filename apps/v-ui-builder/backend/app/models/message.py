"""ui_builder_messages — LLM 대화 히스토리."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from v_platform.models.base import Base


class UIBuilderMessage(Base):
    __tablename__ = "ui_builder_messages"
    __table_args__ = (
        Index("idx_ui_builder_messages_project", "project_id", "created_at"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ui_builder_projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    ui_calls = Column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        default=list,
    )
    scope = Column(
        String(16),
        nullable=False,
        server_default=text("'project'"),
        default="project",
    )
    dashboard_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ui_builder_dashboards.id", ondelete="CASCADE"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("UIBuilderProject", back_populates="messages")
