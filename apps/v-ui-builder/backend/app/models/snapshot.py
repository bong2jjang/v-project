"""ui_builder_snapshots — 프로젝트 내부 프리뷰 버전 스냅샷.

하나의 프로젝트가 여러 스냅샷을 가지며, slug 는 프로젝트 스코프 내 고유 (UNIQUE(project_id, slug)).
files 는 `{file_path: content}` JSONB 로 저장되어 Sandpack 에 즉시 주입 가능.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from v_platform.models.base import Base


class UIBuilderSnapshot(Base):
    __tablename__ = "ui_builder_snapshots"
    __table_args__ = (
        UniqueConstraint("project_id", "slug", name="uq_ui_builder_snapshots_project_slug"),
        Index(
            "idx_ui_builder_snapshots_project",
            "project_id",
            "created_at",
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
    slug = Column(String(32), nullable=False)
    title = Column(String(200), nullable=False)
    files = Column(JSONB, nullable=False)
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ui_builder_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship(
        "UIBuilderProject",
        back_populates="snapshots",
        foreign_keys=[project_id],
    )
