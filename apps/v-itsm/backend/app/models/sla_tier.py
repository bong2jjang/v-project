"""itsm_sla_tier — 계약에 연결되는 SLA 등급 (PLATINUM/GOLD/SILVER/BRONZE 등)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class SLATier(Base):
    __tablename__ = "itsm_sla_tier"

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    code = Column(String(30), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # priority → {response, resolution} 분 단위
    # {"critical": {"response": 15, "resolution": 240}, "high": {...}, "normal": {...}, "low": {...}}
    priority_matrix = Column(JSONB, nullable=False)

    # NULL = 24/7, 값 있으면 {"weekdays": [...], "start": "09:00", "end": "18:00", "tz": "Asia/Seoul"} 등
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
