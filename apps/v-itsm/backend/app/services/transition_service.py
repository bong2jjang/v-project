"""Loop transition 편집/삭제/복원 + 리비전 이력 서비스.

설계 문서 `docusaurus/docs/apps/v-itsm/design/LOOP_TRANSITION_EDITING_DESIGN.md` §5 기준.

핵심 정책:
  - 작성자 본인(`actor_id == user.id`) 또는 SYSTEM_ADMIN 만 편집/삭제/복원 가능.
  - 편집 가능 창은 `ITSM_TRANSITION_EDIT_WINDOW_MINUTES` 환경변수로 제어
    (기본 0 = 무제한, 음수 = 전면 차단).
  - 삭제는 소프트 삭제(`deleted_at`). 복원 시 새 리비전 생성.
  - 리비전 `operation`: create / edit / delete / restore / revert.
  - 모든 쓰기는 before-image 스냅샷을 담은 리비전을 선 기록한 뒤 대상 행을 변경.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID
from v_platform.models.user import User

from app.models.enums import ScopeLevel
from app.models.loop import LoopTransition, LoopTransitionRevision
from app.models.ticket import Ticket
from app.services import access_control


def _new_ulid() -> str:
    return str(ULID())


def _edit_window_minutes() -> int:
    raw = os.getenv("ITSM_TRANSITION_EDIT_WINDOW_MINUTES", "0")
    try:
        return int(raw)
    except ValueError:
        return 0


def _ensure_ticket_write(
    db: Session, ticket_id: str, user: User
) -> Ticket:
    """전이가 걸린 티켓에 대한 write 스코프 재확인 (삭제/복원도 write 권한 기반)."""
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")
    scope = access_control.get_user_scope(db, user)
    if not access_control.check_ticket_access(scope, ticket, ScopeLevel.WRITE):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied for transition edit")
    return ticket


def _next_revision_no(db: Session, transition_id: str) -> int:
    stmt = select(func.coalesce(func.max(LoopTransitionRevision.revision_no), 0)).where(
        LoopTransitionRevision.transition_id == transition_id
    )
    return int(db.execute(stmt).scalar_one() or 0) + 1


def _record_revision(
    db: Session,
    *,
    transition: LoopTransition,
    operation: str,
    actor_id: int | None,
    reason: str | None,
    snapshot_from: LoopTransition | None = None,
) -> LoopTransitionRevision:
    """리비전 1건을 append-only 로 기록.

    `snapshot_from` 이 없으면 `transition` 자체의 현재 상태를 스냅샷한다.
    삭제(delete) 시에는 before-image 를 그대로 보존하기 위해 `snapshot_from=transition`
    (변경 전) 호출이 의미를 가진다.
    """
    src = snapshot_from or transition
    rev = LoopTransitionRevision(
        id=_new_ulid(),
        transition_id=transition.id,
        revision_no=_next_revision_no(db, transition.id),
        operation=operation,
        actor_id=actor_id,
        reason=reason,
        snapshot_note=src.note,
        snapshot_artifacts=src.artifacts,
        snapshot_from_stage=src.from_stage,
        snapshot_to_stage=src.to_stage,
        snapshot_action=src.action,
    )
    db.add(rev)
    db.flush()
    return rev


def get_latest_revision(
    db: Session, transition_id: str
) -> LoopTransitionRevision | None:
    stmt = (
        select(LoopTransitionRevision)
        .where(LoopTransitionRevision.transition_id == transition_id)
        .order_by(LoopTransitionRevision.revision_no.desc())
        .limit(1)
    )
    return db.execute(stmt).scalars().first()


def list_revisions(
    db: Session, ticket_id: str, transition_id: str, current_user: User
) -> list[LoopTransitionRevision]:
    """단일 전이의 리비전 목록. 티켓 read 권한 필요."""
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")
    scope = access_control.get_user_scope(db, current_user)
    if not access_control.check_ticket_access(scope, ticket, ScopeLevel.READ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied")

    transition = db.get(LoopTransition, transition_id)
    if transition is None or transition.ticket_id != ticket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transition not found")

    stmt = (
        select(LoopTransitionRevision)
        .where(LoopTransitionRevision.transition_id == transition_id)
        .order_by(LoopTransitionRevision.revision_no.asc())
    )
    return list(db.execute(stmt).scalars().all())


# ── 편집 ──────────────────────────────────────────────────────
def edit_transition(
    db: Session,
    *,
    ticket_id: str,
    transition_id: str,
    note: str | None,
    artifacts: dict | None,
    reason: str | None,
    current_user: User,
) -> LoopTransition:
    """전이의 note/artifacts 를 갱신. 리비전 선기록 후 로우 업데이트."""
    _ensure_ticket_write(db, ticket_id, current_user)
    transition = db.get(LoopTransition, transition_id)
    if transition is None or transition.ticket_id != ticket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transition not found")

    access_control.check_transition_edit_access(
        current_user,
        transition,
        edit_window_minutes=_edit_window_minutes(),
    )

    # 변경 전 상태를 스냅샷
    before_snapshot = LoopTransition(
        note=transition.note,
        artifacts=transition.artifacts,
        from_stage=transition.from_stage,
        to_stage=transition.to_stage,
        action=transition.action,
    )

    transition.note = note
    transition.artifacts = artifacts
    now = datetime.now(timezone.utc)
    transition.last_edited_at = now
    transition.last_edited_by = current_user.id
    transition.edit_count = (transition.edit_count or 0) + 1

    # edit 리비전은 "편집 후" 상태로 기록 (사용자가 본 최종본)
    rev = _record_revision(
        db,
        transition=transition,
        operation="edit",
        actor_id=current_user.id,
        reason=reason,
    )
    # 단, 이전 값 복원(diff) 을 위해 before 스냅샷도 남겨두지 않고 체인으로 추적.
    # 최초 create 리비전에 이전 상태가 있으므로 revert 시 그 리비전을 지정하면 됨.
    del before_snapshot

    transition.head_revision_id = rev.id
    db.commit()
    db.refresh(transition)
    return transition


# ── 소프트 삭제 ───────────────────────────────────────────────
def soft_delete_transition(
    db: Session,
    *,
    ticket_id: str,
    transition_id: str,
    reason: str | None,
    current_user: User,
) -> LoopTransition:
    _ensure_ticket_write(db, ticket_id, current_user)
    transition = db.get(LoopTransition, transition_id)
    if transition is None or transition.ticket_id != ticket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transition not found")

    if transition.deleted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "already deleted")

    access_control.check_transition_edit_access(
        current_user,
        transition,
        edit_window_minutes=_edit_window_minutes(),
    )

    # 삭제 직전 상태를 스냅샷으로 보존
    rev = _record_revision(
        db,
        transition=transition,
        operation="delete",
        actor_id=current_user.id,
        reason=reason,
    )

    now = datetime.now(timezone.utc)
    transition.deleted_at = now
    transition.deleted_by = current_user.id
    transition.head_revision_id = rev.id
    db.commit()
    db.refresh(transition)
    return transition


# ── 복원 ──────────────────────────────────────────────────────
def restore_transition(
    db: Session,
    *,
    ticket_id: str,
    transition_id: str,
    reason: str | None,
    current_user: User,
) -> LoopTransition:
    _ensure_ticket_write(db, ticket_id, current_user)
    transition = db.get(LoopTransition, transition_id)
    if transition is None or transition.ticket_id != ticket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transition not found")

    if transition.deleted_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "not deleted")

    access_control.check_transition_edit_access(
        current_user,
        transition,
        edit_window_minutes=_edit_window_minutes(),
        allow_when_deleted=True,
    )

    transition.deleted_at = None
    transition.deleted_by = None

    rev = _record_revision(
        db,
        transition=transition,
        operation="restore",
        actor_id=current_user.id,
        reason=reason,
    )
    transition.head_revision_id = rev.id
    db.commit()
    db.refresh(transition)
    return transition


# ── 특정 리비전으로 되돌리기 ──────────────────────────────────
def revert_to_revision(
    db: Session,
    *,
    ticket_id: str,
    transition_id: str,
    revision_no: int,
    reason: str | None,
    current_user: User,
) -> LoopTransition:
    _ensure_ticket_write(db, ticket_id, current_user)
    transition = db.get(LoopTransition, transition_id)
    if transition is None or transition.ticket_id != ticket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "transition not found")

    access_control.check_transition_edit_access(
        current_user,
        transition,
        edit_window_minutes=_edit_window_minutes(),
    )

    target_stmt = select(LoopTransitionRevision).where(
        LoopTransitionRevision.transition_id == transition_id,
        LoopTransitionRevision.revision_no == revision_no,
    )
    target = db.execute(target_stmt).scalars().first()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "revision not found")

    transition.note = target.snapshot_note
    transition.artifacts = target.snapshot_artifacts
    # from/to/action 은 FSM 무결성 때문에 되돌리지 않음 — 사용자 편집 가능 필드만 복원.

    now = datetime.now(timezone.utc)
    transition.last_edited_at = now
    transition.last_edited_by = current_user.id
    transition.edit_count = (transition.edit_count or 0) + 1

    rev = _record_revision(
        db,
        transition=transition,
        operation="revert",
        actor_id=current_user.id,
        reason=reason or f"reverted to revision {revision_no}",
    )
    transition.head_revision_id = rev.id
    db.commit()
    db.refresh(transition)
    return transition


def list_transitions_with_meta(
    db: Session,
    *,
    ticket_id: str,
    include_deleted: bool,
    current_user: User,
) -> list[LoopTransition]:
    """티켓의 전이 목록. 기본은 deleted 제외. 가드는 호출부(`tickets.py`)에서 통과."""
    stmt = (
        select(LoopTransition)
        .where(LoopTransition.ticket_id == ticket_id)
        .order_by(LoopTransition.transitioned_at.asc())
    )
    if not include_deleted:
        stmt = stmt.where(LoopTransition.deleted_at.is_(None))
    return list(db.execute(stmt).scalars().all())


def compute_can_edit(
    user: User,
    transition: LoopTransition,
    *,
    now: datetime | None = None,
) -> bool:
    """UI 버튼 활성화 판정용 — 가드 예외를 잡아 bool 로 변환."""
    try:
        access_control.check_transition_edit_access(
            user,
            transition,
            now=now,
            edit_window_minutes=_edit_window_minutes(),
        )
        return True
    except HTTPException:
        return False


def compute_can_restore(user: User, transition: LoopTransition) -> bool:
    if transition.deleted_at is None:
        return False
    try:
        access_control.check_transition_edit_access(
            user,
            transition,
            edit_window_minutes=_edit_window_minutes(),
            allow_when_deleted=True,
        )
        return True
    except HTTPException:
        return False


__all__ = [
    "edit_transition",
    "soft_delete_transition",
    "restore_transition",
    "revert_to_revision",
    "list_transitions_with_meta",
    "list_revisions",
    "get_latest_revision",
    "compute_can_edit",
    "compute_can_restore",
]
