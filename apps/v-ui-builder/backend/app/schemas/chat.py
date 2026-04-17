"""Chat (LLM 대화 스트림) 요청 스키마."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    project_id: UUID
    prompt: str = Field(..., min_length=1)
    model: str | None = None


class ProviderInfo(BaseModel):
    name: str
    available: bool
    models: list[str] = []
