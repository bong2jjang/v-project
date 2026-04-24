"""itsm_kpi_snapshot — 일/주 단위 KPI 집계 스냅샷."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from v_platform.models.base import Base


class KPISnapshot(Base):
    __tablename__ = "itsm_kpi_snapshot"
    __table_args__ = (
        UniqueConstraint(
            "period_start", "period_end", "dept_id", name="uq_itsm_kpi_period_dept"
        ),
        Index("ix_itsm_kpi_period", "period_start", "period_end"),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    sla_met_ratio = Column(Numeric(5, 2), nullable=True)
    mttr_minutes = Column(Integer, nullable=True)
    reopen_ratio = Column(Numeric(5, 2), nullable=True)
    volume = Column(Integer, nullable=False, default=0)
    ai_adoption_ratio = Column(Numeric(5, 2), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
