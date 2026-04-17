"""Artifact (파일 스냅샷) 스키마."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ArtifactUpsert(BaseModel):
    file_path: str = Field(..., min_length=1, max_length=500)
    content: str


class ArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    file_path: str
    content: str
    version: int
    created_at: datetime
