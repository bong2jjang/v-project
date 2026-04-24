"""Loop transition 편집/삭제/복원/리비전 API.

엔드포인트 (`/api/tickets/{ticket_id}/transitions/{transition_id}` 하위):
  PATCH   /                              - 편집 (note, artifacts)
  DELETE  /                              - 소프트 삭제
  POST    /restore                       - 삭제 복원
  GET     /revisions                     - 리비전 목록
  POST    /revisions/{revision_no}/revert - 해당 리비전으로 되돌리기

모든 엔드포인트는 `access_control.check_transition_edit_access` 가드를
통과한 사용자(작성자 본인 또는 SYSTEM_ADMIN)만 호출 가능.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.workspace import Workspace
from app.schemas.transition import (
    LoopTransitionDetailOut,
    LoopTransitionRevisionOut,
    TransitionDeleteRequest,
    TransitionEditRequest,
    TransitionRestoreRequest,
    TransitionRevertRequest,
)
from app.services import transition_service

router = APIRouter(prefix="/api/ws/{workspace_id}/tickets/{ticket_id}/transitions", tags=["transitions"])


def _to_detail(transition, user: User) -> LoopTransitionDetailOut:
    """`LoopTransition` → 상세 응답. 버튼 플래그를 서버가 계산해 포함."""
    base = LoopTransitionDetailOut.model_validate(transition)
    base.can_edit = transition_service.compute_can_edit(user, transition)
    base.can_delete = base.can_edit and transition.deleted_at is None
    base.can_restore = transition_service.compute_can_restore(user, transition)
    return base


@router.patch("/{transition_id}", response_model=LoopTransitionDetailOut)
async def edit_transition(
    ticket_id: str,
    transition_id: str,
    payload: TransitionEditRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> LoopTransitionDetailOut:
    transition = transition_service.edit_transition(
        db,
        ticket_id=ticket_id,
        transition_id=transition_id,
        note=payload.note,
        artifacts=payload.artifacts,
        reason=payload.reason,
        current_user=current_user,
    )
    return _to_detail(transition, current_user)


@router.delete("/{transition_id}", response_model=LoopTransitionDetailOut)
async def delete_transition(
    ticket_id: str,
    transition_id: str,
    payload: TransitionDeleteRequest | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> LoopTransitionDetailOut:
    reason = payload.reason if payload is not None else None
    transition = transition_service.soft_delete_transition(
        db,
        ticket_id=ticket_id,
        transition_id=transition_id,
        reason=reason,
        current_user=current_user,
    )
    return _to_detail(transition, current_user)


@router.post(
    "/{transition_id}/restore",
    response_model=LoopTransitionDetailOut,
    status_code=status.HTTP_200_OK,
)
async def restore_transition(
    ticket_id: str,
    transition_id: str,
    payload: TransitionRestoreRequest | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> LoopTransitionDetailOut:
    reason = payload.reason if payload is not None else None
    transition = transition_service.restore_transition(
        db,
        ticket_id=ticket_id,
        transition_id=transition_id,
        reason=reason,
        current_user=current_user,
    )
    return _to_detail(transition, current_user)


@router.get(
    "/{transition_id}/revisions",
    response_model=list[LoopTransitionRevisionOut],
)
async def list_revisions(
    ticket_id: str,
    transition_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> list[LoopTransitionRevisionOut]:
    items = transition_service.list_revisions(
        db, ticket_id, transition_id, current_user
    )
    return [LoopTransitionRevisionOut.model_validate(r) for r in items]


@router.post(
    "/{transition_id}/revisions/{revision_no}/revert",
    response_model=LoopTransitionDetailOut,
)
async def revert_to_revision(
    ticket_id: str,
    transition_id: str,
    revision_no: int,
    payload: TransitionRevertRequest | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> LoopTransitionDetailOut:
    reason = payload.reason if payload is not None else None
    transition = transition_service.revert_to_revision(
        db,
        ticket_id=ticket_id,
        transition_id=transition_id,
        revision_no=revision_no,
        reason=reason,
        current_user=current_user,
    )
    return _to_detail(transition, current_user)
