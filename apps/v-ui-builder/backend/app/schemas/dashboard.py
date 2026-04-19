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
    source: str = "chat"
    category: str | None = None
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
    source: str = Field(default="pin-drag", max_length=16)
    category: str | None = Field(default=None, max_length=32)
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None


class WidgetManualCreate(BaseModel):
    """팔레트에서 수동 추가 — tool 이름만 주면 서버가 default_args/grid 를 채워준다."""

    tool: str = Field(..., min_length=1, max_length=100)
    props: dict[str, Any] | None = Field(
        default=None, description="override default_args (없으면 카탈로그 기본값 사용)"
    )
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None


class WidgetUpdate(BaseModel):
    """Inspector 편집 — props/grid 변경. `expected_updated_at` 로 낙관적 잠금."""

    props: dict[str, Any] | None = None
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None
    expected_updated_at: datetime | None = Field(
        default=None,
        description="클라이언트가 가진 updated_at. 서버 값과 다르면 409 반환.",
    )


class WidgetConflict(BaseModel):
    """409 응답 본문 — 클라이언트가 최신 상태로 갱신하거나 덮어쓰기 결정."""

    detail: str = "widget was modified by another editor"
    current: WidgetRead


# 팔레트 카탈로그는 레지스트리가 `schema` 키를 포함하는 dict 배열을 반환.
# Pydantic v2 의 `schema` 필드명 충돌을 피하려 라우터에서 list[dict[str, Any]] 그대로 전달.


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
