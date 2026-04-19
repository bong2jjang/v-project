"""ui_builder_projects — 대화로 만드는 하나의 UI 앱 단위."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from v_platform.models.base import Base


class UIBuilderProject(Base):
    __tablename__ = "ui_builder_projects"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    template = Column(String(50), nullable=False, default="react-ts")
    llm_provider = Column(String(50), nullable=False, default="openai")
    llm_model = Column(String(100), nullable=True)
    current_snapshot_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "ui_builder_snapshots.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_ui_builder_projects_current_snapshot",
        ),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    messages = relationship(
        "UIBuilderMessage",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="UIBuilderMessage.created_at",
    )
    artifacts = relationship(
        "UIBuilderArtifact",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    snapshots = relationship(
        "UIBuilderSnapshot",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="UIBuilderSnapshot.created_at.desc()",
        foreign_keys="UIBuilderSnapshot.project_id",
    )
    current_snapshot = relationship(
        "UIBuilderSnapshot",
        foreign_keys=[current_snapshot_id],
        post_update=True,
    )
