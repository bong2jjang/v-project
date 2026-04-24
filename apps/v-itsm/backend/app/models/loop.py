"""itsm_loop_transition + revision — Loop FSM 전이 이력.

편집/삭제/복원을 리비전 스냅샷 체인으로 관리. `LoopTransitionRevision` 은
각 전이의 모든 변경(create/edit/delete/restore/revert)을 추가 전용 로그로 보존.
"""

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
)
from sqlalchemy.dialects.postgresql import JSONB
from v_platform.models.base import Base


class LoopTransition(Base):
    __tablename__ = "itsm_loop_transition"
    __table_args__ = (
        Index("ix_itsm_loop_transition_ticket", "ticket_id", "transitioned_at"),
        Index(
            "ix_itsm_loop_transition_deleted",
            "deleted_at",
            postgresql_where=Column("deleted_at"),
        ),
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

    from_stage = Column(String(20), nullable=True)
    to_stage = Column(String(20), nullable=False)
    action = Column(String(20), nullable=False)

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
    artifacts = Column(JSONB, nullable=True)

    transitioned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_edited_at = Column(DateTime(timezone=True), nullable=True)
    last_edited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    edit_count = Column(Integer, nullable=False, default=0)
    head_revision_id = Column(String(26), nullable=True)


class LoopTransitionRevision(Base):
    """전이 편집/삭제/복원 리비전.

    `operation` 종류:
      - create  : 전이 생성 시점 초기 스냅샷
      - edit    : 작성자 편집
      - delete  : 소프트 삭제 (스냅샷은 직전 상태)
      - restore : 삭제 복원 (스냅샷은 복원 후 상태)
      - revert  : 리비전 기준으로 되돌리기 (스냅샷은 복원 후 상태)
    """

    __tablename__ = "itsm_loop_transition_revision"
    __table_args__ = (
        UniqueConstraint(
            "transition_id", "revision_no", name="uq_itsm_transition_revision"
        ),
        Index(
            "ix_itsm_loop_transition_revision_tid",
            "transition_id",
            "revision_no",
        ),
        Index(
            "ix_itsm_loop_transition_revision_actor",
            "actor_id",
            "created_at",
        ),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    transition_id = Column(
        String(26),
        ForeignKey("itsm_loop_transition.id", ondelete="CASCADE"),
        nullable=False,
    )
    revision_no = Column(Integer, nullable=False)
    operation = Column(String(20), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)

    snapshot_note = Column(Text, nullable=True)
    snapshot_artifacts = Column(JSONB, nullable=True)
    snapshot_from_stage = Column(String(20), nullable=True)
    snapshot_to_stage = Column(String(20), nullable=True)
    snapshot_action = Column(String(20), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
