"""itsm_workspaces / itsm_workspace_members — 워크스페이스 격리 단위."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from v_platform.models.base import Base


class Workspace(Base):
    __tablename__ = "itsm_workspaces"
    __table_args__ = (
        Index("ix_itsm_workspaces_slug", "slug"),
    )

    id = Column(String(26), primary_key=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon_url = Column(Text, nullable=True)
    settings = Column(JSON, nullable=False, default=dict)
    is_default = Column(Boolean, nullable=False, default=False)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    archived_at = Column(DateTime(timezone=True), nullable=True)


class WorkspaceMember(Base):
    __tablename__ = "itsm_workspace_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_itsm_ws_member"),
        Index("ix_itsm_ws_members_user", "user_id"),
        Index("ix_itsm_ws_members_ws", "workspace_id"),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(20), nullable=False, default="ws_member")
    is_default = Column(Boolean, nullable=False, default=False)
    joined_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
