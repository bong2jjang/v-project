"""Snapshot 요청/응답 스키마."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SnapshotListItem(BaseModel):
    """리스트 응답 — files 본문 제외, 크기 최소."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    slug: str
    title: str
    message_id: UUID | None
    created_at: datetime


class SnapshotMessage(BaseModel):
    """스냅샷과 연결된 대화 메시지 1건."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    content: str
    created_at: datetime


class SnapshotResponse(SnapshotListItem):
    """상세 응답 — Sandpack 주입용 files + 관련 대화 포함."""

    files: dict[str, str] = Field(default_factory=dict)
    user_prompt: SnapshotMessage | None = None
    assistant_message: SnapshotMessage | None = None


class SnapshotConfirmResponse(BaseModel):
    project_id: UUID
    current_snapshot_id: UUID | None
