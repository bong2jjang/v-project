"""Dashboard / Widget 요청·응답 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WidgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dashboard_id: UUID
    call_id: str
    tool: str
    component: str
    props: dict[str, Any] = Field(default_factory=dict)
    source_message_id: UUID | None = None
    source_call_id: str | None = None
    grid_x: int
    grid_y: int
    grid_w: int
    grid_h: int
    created_at: datetime
    updated_at: datetime


class WidgetCreate(BaseModel):
    """Pin 드래그 드롭 시 카드 → 위젯 복제 요청."""

    call_id: str = Field(..., min_length=1, max_length=64)
    tool: str = Field(..., min_length=1, max_length=100)
    component: str = Field(..., min_length=1, max_length=100)
    props: dict[str, Any] = Field(default_factory=dict)
    source_message_id: UUID | None = None
    source_call_id: str | None = Field(default=None, max_length=64)
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None


class WidgetLayoutItem(BaseModel):
    """bulk layout 갱신(P3.2 에서 사용)."""

    id: UUID
    grid_x: int = Field(..., ge=0)
    grid_y: int = Field(..., ge=0)
    grid_w: int = Field(..., ge=1)
    grid_h: int = Field(..., ge=1)


class WidgetLayoutBulkUpdate(BaseModel):
    items: list[WidgetLayoutItem]


class DashboardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    description: str | None
    layout_cols: int
    row_height: int
    created_at: datetime
    updated_at: datetime


class DashboardDetail(DashboardRead):
    widgets: list[WidgetRead] = Field(default_factory=list)
