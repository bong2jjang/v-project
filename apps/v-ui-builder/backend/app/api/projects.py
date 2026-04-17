"""Project CRUD + 메시지/아티팩트 조회 라우터."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.schemas.artifact import ArtifactResponse, ArtifactUpsert
from app.schemas.message import MessageResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.project_service import ProjectService


router = APIRouter(prefix="/api/projects", tags=["ui-builder:projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    svc = ProjectService(db)
    return ProjectResponse.model_validate(svc.create(current_user.id, data))


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    svc = ProjectService(db)
    return [
        ProjectResponse.model_validate(p) for p in svc.list_by_user(current_user.id)
    ]


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProjectDetailResponse:
    svc = ProjectService(db)
    project = svc.get_owned(project_id, current_user.id)
    messages = svc.list_messages(project_id, current_user.id)
    artifacts = svc.latest_artifacts(project_id, current_user.id)
    return ProjectDetailResponse(
        **ProjectResponse.model_validate(project).model_dump(),
        messages=[MessageResponse.model_validate(m) for m in messages],
        artifacts=[ArtifactResponse.model_validate(a) for a in artifacts],
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    svc = ProjectService(db)
    return ProjectResponse.model_validate(svc.update(project_id, current_user.id, data))


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    svc = ProjectService(db)
    svc.delete(project_id, current_user.id)


@router.get("/{project_id}/messages", response_model=list[MessageResponse])
def list_messages(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    svc = ProjectService(db)
    return [
        MessageResponse.model_validate(m)
        for m in svc.list_messages(project_id, current_user.id)
    ]


@router.get("/{project_id}/artifacts", response_model=list[ArtifactResponse])
def list_artifacts(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[ArtifactResponse]:
    svc = ProjectService(db)
    return [
        ArtifactResponse.model_validate(a)
        for a in svc.latest_artifacts(project_id, current_user.id)
    ]


@router.post(
    "/{project_id}/artifacts",
    response_model=ArtifactResponse,
    status_code=status.HTTP_201_CREATED,
)
def upsert_artifact(
    project_id: UUID,
    data: ArtifactUpsert,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ArtifactResponse:
    svc = ProjectService(db)
    artifact = svc.upsert_artifact(
        project_id, current_user.id, data.file_path, data.content
    )
    return ArtifactResponse.model_validate(artifact)
