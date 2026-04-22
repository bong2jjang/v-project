"""SLA 알림 정책 스키마 — 설계 §7.2 (warning/breach 별 채널·대상 매핑)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Priority, RequestServiceType

TriggerEvent = Literal["warning", "breach"]


class SLANotificationPolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    trigger_event: TriggerEvent
    applies_priority: Priority | None = None
    applies_service_type: RequestServiceType | None = None
    notify_channels: list[str] = Field(default_factory=list)
    notify_assignee: bool = True
    notify_assignee_manager: bool = False
    notify_custom_user_ids: list[int] | None = None
    notify_custom_addresses: list[str] | None = None
    template_key: str | None = Field(default=None, max_length=50)
    active: bool = True


class SLANotificationPolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    trigger_event: TriggerEvent | None = None
    applies_priority: Priority | None = None
    applies_service_type: RequestServiceType | None = None
    notify_channels: list[str] | None = None
    notify_assignee: bool | None = None
    notify_assignee_manager: bool | None = None
    notify_custom_user_ids: list[int] | None = None
    notify_custom_addresses: list[str] | None = None
    template_key: str | None = Field(default=None, max_length=50)
    active: bool | None = None


class SLANotificationPolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    trigger_event: str
    applies_priority: str | None
    applies_service_type: str | None
    notify_channels: list[str]
    notify_assignee: bool
    notify_assignee_manager: bool
    notify_custom_user_ids: list[int] | None
    notify_custom_addresses: list[str] | None
    template_key: str | None
    active: bool
    created_at: datetime
    updated_at: datetime


class SLANotificationPolicyListResponse(BaseModel):
    items: list[SLANotificationPolicyOut]
    total: int
