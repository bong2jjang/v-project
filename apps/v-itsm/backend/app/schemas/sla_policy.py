"""SLA Policy 스키마 — 설계 §6.1 (카테고리 단위 예외 정책).

SLATier 는 계약 단위 기본 등급, SLAPolicy 는 category 단위 오버라이드.
우선순위 산출: Contract.sla_tier → SLAPolicy(category match) → 하드코딩 기본값.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Priority


class SLAPolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    priority: Priority
    category: str | None = Field(default=None, max_length=100)
    response_minutes: int = Field(..., ge=1)
    resolution_minutes: int = Field(..., ge=1)
    business_hours: dict[str, Any] | None = None
    active: bool = True


class SLAPolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    priority: Priority | None = None
    category: str | None = Field(default=None, max_length=100)
    response_minutes: int | None = Field(default=None, ge=1)
    resolution_minutes: int | None = Field(default=None, ge=1)
    business_hours: dict[str, Any] | None = None
    active: bool | None = None


class SLAPolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    priority: str
    category: str | None
    response_minutes: int
    resolution_minutes: int
    business_hours: dict[str, Any] | None
    active: bool
    created_at: datetime
    updated_at: datetime


class SLAPolicyListResponse(BaseModel):
    items: list[SLAPolicyOut]
    total: int


class SLARecalcResult(BaseModel):
    """정책/티어 변경 후 재계산 결과 요약."""

    tickets_scanned: int
    timers_updated: int
    skipped_breached: int
    skipped_satisfied: int
