"""Ticket 요청/응답 스키마 (Pydantic v2)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    ChannelSource,
    LoopAction,
    LoopStage,
    Priority,
    RequestServiceType,
)


class TicketIntakeRequest(BaseModel):
    """POST /api/tickets/intake — 채널/웹폼 최초 접수."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    source_channel: ChannelSource
    source_ref: str | None = Field(default=None, max_length=200)
    priority: Priority = Priority.NORMAL
    category_l1: str | None = Field(default=None, max_length=100)
    category_l2: str | None = Field(default=None, max_length=100)
    requester_id: int | None = None

    # 요청 서비스 구분 및 고객/제품/계약 연계 (a004)
    service_type: RequestServiceType = RequestServiceType.INTERNAL
    customer_id: str | None = None
    product_id: str | None = None
    contract_id: str | None = None


class TicketUpdateRequest(BaseModel):
    """PATCH /api/tickets/{id} — 일부 필드 갱신 (전이 제외)."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: Priority | None = None
    category_l1: str | None = Field(default=None, max_length=100)
    category_l2: str | None = Field(default=None, max_length=100)
    current_owner_id: int | None = None
    sla_policy_id: str | None = None

    service_type: RequestServiceType | None = None
    customer_id: str | None = None
    product_id: str | None = None
    contract_id: str | None = None


class TicketTransitionRequest(BaseModel):
    """POST /api/tickets/{id}/transition — Loop FSM 전이."""

    action: LoopAction
    note: str | None = None
    artifacts: dict | None = None


class TicketOut(BaseModel):
    """Ticket 표현 DTO."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_no: str
    title: str
    description: str | None
    source_channel: str
    source_ref: str | None
    priority: str
    category_l1: str | None
    category_l2: str | None
    current_stage: str
    service_type: str
    customer_id: str | None
    product_id: str | None
    contract_id: str | None
    requester_id: int | None
    current_owner_id: int | None
    sla_policy_id: str | None
    opened_at: datetime
    closed_at: datetime | None
    reopened_count: int
    created_at: datetime
    updated_at: datetime


class TicketListResponse(BaseModel):
    items: list[TicketOut]
    total: int
    page: int
    page_size: int


class LoopTransitionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    from_stage: str | None
    to_stage: str
    action: str
    actor_id: int | None
    note: str | None
    artifacts: dict | None
    transitioned_at: datetime


class AllowedActionsOut(BaseModel):
    """GET /api/tickets/{id}/allowed-actions — UI 버튼 활성화 용."""

    current_stage: LoopStage
    allowed: list[LoopAction]
