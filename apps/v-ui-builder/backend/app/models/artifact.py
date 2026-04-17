"""ui_builder_artifacts — 생성된 파일 스냅샷 (버전별)."""

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
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from v_platform.models.base import Base


class UIBuilderArtifact(Base):
    __tablename__ = "ui_builder_artifacts"
    __table_args__ = (
        UniqueConstraint("project_id", "file_path", "version"),
        Index(
            "idx_ui_builder_artifacts_project",
            "project_id",
            "file_path",
            "version",
        ),
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
    file_path = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("UIBuilderProject", back_populates="artifacts")
