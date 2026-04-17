"""ProjectService — 소유권 검사 + CRUD + 최신 버전 아티팩트 로드."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import UIBuilderArtifact, UIBuilderMessage, UIBuilderProject
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: int, data: ProjectCreate) -> UIBuilderProject:
        project = UIBuilderProject(
            user_id=user_id,
            name=data.name,
            description=data.description,
            template=data.template,
            llm_provider=data.llm_provider,
            llm_model=data.llm_model,
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def list_by_user(self, user_id: int) -> list[UIBuilderProject]:
        return (
            self.db.query(UIBuilderProject)
            .filter(UIBuilderProject.user_id == user_id)
            .order_by(UIBuilderProject.updated_at.desc())
            .all()
        )

    def get_owned(self, project_id: UUID, user_id: int) -> UIBuilderProject:
        project = (
            self.db.query(UIBuilderProject)
            .filter(UIBuilderProject.id == project_id)
            .first()
        )
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="project not found"
            )
        if project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="not your project"
            )
        return project

    def update(
        self, project_id: UUID, user_id: int, data: ProjectUpdate
    ) -> UIBuilderProject:
        project = self.get_owned(project_id, user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        self.db.commit()
        self.db.refresh(project)
        return project

    def delete(self, project_id: UUID, user_id: int) -> None:
        project = self.get_owned(project_id, user_id)
        self.db.delete(project)
        self.db.commit()

    def list_messages(
        self, project_id: UUID, user_id: int
    ) -> list[UIBuilderMessage]:
        self.get_owned(project_id, user_id)
        return (
            self.db.query(UIBuilderMessage)
            .filter(UIBuilderMessage.project_id == project_id)
            .order_by(UIBuilderMessage.created_at.asc())
            .all()
        )

    def latest_artifacts(
        self, project_id: UUID, user_id: int
    ) -> list[UIBuilderArtifact]:
        """프로젝트의 각 파일 경로별 최신 버전 아티팩트."""
        self.get_owned(project_id, user_id)
        subq = (
            self.db.query(
                UIBuilderArtifact.file_path,
                func.max(UIBuilderArtifact.version).label("max_version"),
            )
            .filter(UIBuilderArtifact.project_id == project_id)
            .group_by(UIBuilderArtifact.file_path)
            .subquery()
        )
        return (
            self.db.query(UIBuilderArtifact)
            .join(
                subq,
                (UIBuilderArtifact.file_path == subq.c.file_path)
                & (UIBuilderArtifact.version == subq.c.max_version),
            )
            .filter(UIBuilderArtifact.project_id == project_id)
            .order_by(UIBuilderArtifact.file_path.asc())
            .all()
        )

    def upsert_artifact(
        self, project_id: UUID, user_id: int, file_path: str, content: str
    ) -> UIBuilderArtifact:
        """동일 파일 경로면 version을 +1 증가시켜 저장 (덮어쓰기가 아닌 버저닝)."""
        self.get_owned(project_id, user_id)
        latest = (
            self.db.query(UIBuilderArtifact)
            .filter(
                UIBuilderArtifact.project_id == project_id,
                UIBuilderArtifact.file_path == file_path,
            )
            .order_by(UIBuilderArtifact.version.desc())
            .first()
        )
        next_version = (latest.version + 1) if latest else 1
        artifact = UIBuilderArtifact(
            project_id=project_id,
            file_path=file_path,
            content=content,
            version=next_version,
        )
        self.db.add(artifact)
        self.db.commit()
        self.db.refresh(artifact)
        return artifact
