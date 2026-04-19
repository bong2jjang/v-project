"""Snapshot 라우터 — 프로젝트 내부 프리뷰 버전 리스트/열람/확정."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.schemas.snapshot import (
    SnapshotConfirmResponse,
    SnapshotListItem,
    SnapshotMessage,
    SnapshotResponse,
)
from app.services.snapshot_service import SnapshotService


router = APIRouter(tags=["ui-builder:snapshots"])


class ConfirmRequest(BaseModel):
    snapshot_id: UUID | None = None


@router.get(
    "/api/projects/{project_id}/snapshots",
    response_model=list[SnapshotListItem],
)
def list_project_snapshots(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[SnapshotListItem]:
    svc = SnapshotService(db)
    return [
        SnapshotListItem.model_validate(s)
        for s in svc.list_for_project(project_id, current_user.id)
    ]


@router.get("/api/snapshots/{snapshot_id}", response_model=SnapshotResponse)
def get_snapshot(
    snapshot_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotResponse:
    svc = SnapshotService(db)
    snap = svc.get_owned(snapshot_id, current_user.id)
    user_msg, assistant_msg = svc.get_linked_messages(snap)
    return SnapshotResponse(
        id=snap.id,
        project_id=snap.project_id,
        slug=snap.slug,
        title=snap.title,
        message_id=snap.message_id,
        created_at=snap.created_at,
        files=snap.files or {},
        user_prompt=SnapshotMessage.model_validate(user_msg) if user_msg else None,
        assistant_message=(
            SnapshotMessage.model_validate(assistant_msg) if assistant_msg else None
        ),
    )


@router.delete(
    "/api/snapshots/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_snapshot(
    snapshot_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    svc = SnapshotService(db)
    svc.delete(snapshot_id, current_user.id)


@router.post(
    "/api/projects/{project_id}/current-snapshot",
    response_model=SnapshotConfirmResponse,
    status_code=status.HTTP_200_OK,
)
def confirm_current_snapshot(
    project_id: UUID,
    body: ConfirmRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SnapshotConfirmResponse:
    svc = SnapshotService(db)
    project = svc.confirm(project_id, body.snapshot_id, current_user.id)
    return SnapshotConfirmResponse(
        project_id=project.id,
        current_snapshot_id=project.current_snapshot_id,
    )
