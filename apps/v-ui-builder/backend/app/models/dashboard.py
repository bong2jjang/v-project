"""ui_builder_dashboards — 프로젝트의 유일한 대시보드 캔버스.

v0.2 확정: 프로젝트당 1 개(`UNIQUE(project_id)`). 프로젝트 생성 시 자동 보장.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from v_platform.models.base import Base


class UIBuilderDashboard(Base):
    __tablename__ = "ui_builder_dashboards"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_ui_builder_dashboards_project"),
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
    name = Column(String(200), nullable=False, default="Dashboard")
    description = Column(Text, nullable=True)
    layout_cols = Column(Integer, nullable=False, default=12)
    row_height = Column(Integer, nullable=False, default=64)
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

    project = relationship("UIBuilderProject", back_populates="dashboard")
    widgets = relationship(
        "UIBuilderDashboardWidget",
        back_populates="dashboard",
        cascade="all, delete-orphan",
        order_by="UIBuilderDashboardWidget.created_at",
    )
