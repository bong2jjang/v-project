"""워크스페이스 API 스키마 (Pydantic v2) — 설계 §4.1."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: str | None
    icon_url: str | None
    settings: dict[str, Any]
    is_default: bool
    created_by: int | None
    created_at: datetime
    archived_at: datetime | None


class WorkspaceSummaryOut(BaseModel):
    """내 WS 목록용 — 역할·Default 여부·티켓 건수 포함."""

    id: str
    name: str
    slug: str
    description: str | None
    icon_url: str | None
    is_default: bool       # 전사 공용 WS 여부
    my_role: str           # ws_admin | ws_member | ws_viewer
    is_my_default: bool    # 내 기본 WS 여부
    ticket_count: int
    created_at: datetime


class WorkspaceMemberOut(BaseModel):
    id: str
    workspace_id: str
    user_id: int
    email: str
    username: str
    role: str
    is_default: bool
    joined_at: datetime


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_-]+$")
    description: str | None = None
    icon_url: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"^[a-z0-9_-]+$")
    description: str | None = None
    icon_url: str | None = None
    settings: dict[str, Any] | None = None
    is_default: bool | None = None


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceOut]
    total: int
    page: int
    page_size: int


class WorkspaceMemberAdd(BaseModel):
    user_id: int
    role: str = Field("ws_member", pattern=r"^(ws_admin|ws_member|ws_viewer)$")
    is_default: bool = False


class WorkspaceMemberRoleUpdate(BaseModel):
    role: str = Field(..., pattern=r"^(ws_admin|ws_member|ws_viewer)$")


class WorkspaceSwitchOut(BaseModel):
    current_workspace_id: str
    workspace: WorkspaceOut
