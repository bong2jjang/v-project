"""SLA Tier 스키마 (Pydantic v2) — 설계 §4.1.11·§6.

priority_matrix 형식:
    {
        "critical": {"response": 15, "resolution": 240},
        "high":     {"response": 30, "resolution": 480},
        "normal":   {"response": 60, "resolution": 1440},
        "low":      {"response": 120, "resolution": 2880}
    }
business_hours 는 null = 24/7.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SLATierCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=30)
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    priority_matrix: dict[str, dict[str, int]]
    business_hours: dict[str, Any] | None = None
    active: bool = True


class SLATierUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=30)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    priority_matrix: dict[str, dict[str, int]] | None = None
    business_hours: dict[str, Any] | None = None
    active: bool | None = None


class SLATierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    description: str | None
    priority_matrix: dict[str, dict[str, int]]
    business_hours: dict[str, Any] | None
    active: bool
    created_at: datetime
    updated_at: datetime


class SLATierListResponse(BaseModel):
    items: list[SLATierOut]
    total: int
