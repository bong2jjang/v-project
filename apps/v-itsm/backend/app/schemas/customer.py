"""Customer / CustomerContact 스키마 (Pydantic v2) — 설계 §4.1.8·§4.1.9."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import CustomerStatus, RequestServiceType


# ─── Customer ────────────────────────────────────────────────
class CustomerCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    service_type: RequestServiceType
    industry: str | None = Field(default=None, max_length=100)
    status: CustomerStatus = CustomerStatus.ACTIVE
    notes: str | None = None


class CustomerUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    service_type: RequestServiceType | None = None
    industry: str | None = Field(default=None, max_length=100)
    status: CustomerStatus | None = None
    notes: str | None = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    service_type: str
    industry: str | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerOut]
    total: int
    page: int
    page_size: int


# ─── CustomerContact ─────────────────────────────────────────
class CustomerContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    role_title: str | None = Field(default=None, max_length=100)
    is_primary: bool = False
    notes: str | None = None


class CustomerContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    role_title: str | None = Field(default=None, max_length=100)
    is_primary: bool | None = None
    notes: str | None = None


class CustomerContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    name: str
    email: str | None
    phone: str | None
    role_title: str | None
    is_primary: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
