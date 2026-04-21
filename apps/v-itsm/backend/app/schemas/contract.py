"""Contract 스키마 (Pydantic v2) — 설계 §4.1.12·§4.1.13."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ContractStatus


class ContractCreate(BaseModel):
    contract_no: str = Field(..., min_length=1, max_length=50)
    customer_id: str = Field(..., min_length=26, max_length=26)
    name: str = Field(..., min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    sla_tier_id: str | None = Field(default=None, min_length=26, max_length=26)
    status: ContractStatus = ContractStatus.ACTIVE
    notes: str | None = None
    product_ids: list[str] = Field(default_factory=list)


class ContractUpdate(BaseModel):
    contract_no: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    sla_tier_id: str | None = Field(default=None, min_length=26, max_length=26)
    status: ContractStatus | None = None
    notes: str | None = None
    product_ids: list[str] | None = None


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contract_no: str
    customer_id: str
    name: str
    start_date: date | None
    end_date: date | None
    sla_tier_id: str | None
    status: str
    notes: str | None
    product_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ContractListResponse(BaseModel):
    items: list[ContractOut]
    total: int
    page: int
    page_size: int
