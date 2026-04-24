"""itsm_scheduler_override — APScheduler 잡 간격/일시정지 오버라이드.

메모리 잡스토어 기준. 기동 시 레지스트리가 이 테이블을 읽어 최종 interval 결정.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from v_platform.models.base import Base


class SchedulerOverride(Base):
    __tablename__ = "itsm_scheduler_override"

    job_id = Column(String(50), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    interval_seconds = Column(Integer, nullable=False)
    paused = Column(Boolean, nullable=False, default=False)

    updated_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
