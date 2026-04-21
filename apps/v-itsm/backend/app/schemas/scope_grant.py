"""ScopeGrant 스키마 (Pydantic v2) — 설계 §4.1.14·§4.3.

NULL = 와일드카드: service_type/customer_id/product_id 중 어느 하나라도 null 이면
해당 축은 "모든 값" 을 의미한다.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RequestServiceType, ScopeLevel


class ScopeGrantCreate(BaseModel):
    permission_group_id: int
    service_type: RequestServiceType | None = None
    customer_id: str | None = Field(default=None, min_length=26, max_length=26)
    product_id: str | None = Field(default=None, min_length=26, max_length=26)
    scope_level: ScopeLevel = ScopeLevel.READ


class ScopeGrantUpdate(BaseModel):
    service_type: RequestServiceType | None = None
    customer_id: str | None = Field(default=None, min_length=26, max_length=26)
    product_id: str | None = Field(default=None, min_length=26, max_length=26)
    scope_level: ScopeLevel | None = None


class ScopeGrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    permission_group_id: int
    service_type: str | None
    customer_id: str | None
    product_id: str | None
    scope_level: str
    granted_by: int | None
    created_at: datetime
    updated_at: datetime


class ScopeGrantListResponse(BaseModel):
    items: list[ScopeGrantOut]
    total: int


class UserScopeGrantItem(BaseModel):
    """`/api/scope-grants/my` 요소 — 계산된 사용자 스코프 튜플."""

    service_type: str | None
    customer_id: str | None
    product_id: str | None
    scope_level: str


class UserScopeSummaryOut(BaseModel):
    """GET /api/scope-grants/my — 현재 사용자의 총합 스코프 요약."""

    is_admin: bool
    grants: list[UserScopeGrantItem]
