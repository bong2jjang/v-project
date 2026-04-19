"""Project 요청/응답 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .artifact import ArtifactResponse
from .message import MessageResponse
from .snapshot import SnapshotListItem


Template = Literal["react-ts", "vue", "vanilla-ts"]
LLMProviderName = Literal["openai", "anthropic", "gemini"]
ProjectType = Literal["sandpack", "genui"]


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    project_type: ProjectType = "sandpack"
    template: Template = "react-ts"
    llm_provider: LLMProviderName = "openai"
    llm_model: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    llm_provider: LLMProviderName | None = None
    llm_model: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: int
    name: str
    description: str | None
    project_type: str = "sandpack"
    template: str
    llm_provider: str
    llm_model: str | None
    current_snapshot_id: UUID | None = None
    current_snapshot: SnapshotListItem | None = None
    created_at: datetime
    updated_at: datetime


class ProjectDetailResponse(ProjectResponse):
    messages: list[MessageResponse] = []
    artifacts: list[ArtifactResponse] = []
