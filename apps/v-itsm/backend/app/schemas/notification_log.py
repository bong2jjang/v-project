"""Notification Log 스키마 — 설계 §7.4.

필터/페이징, 상태 뱃지, 재시도 요청, CSV·JSON 내보내기 DTO.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NotificationLogFilter(BaseModel):
    """GET /api/notification-logs 쿼리 파라미터 모델."""

    status: str | None = None  # pending | success | failure
    channel: str | None = None  # slack | teams | email
    event_type: str | None = None
    ticket_id: str | None = None
    target_user_id: int | None = None
    since: datetime | None = None
    until: datetime | None = None
    search: str | None = None  # target_address / error_message LIKE

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=200)


class NotificationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str | None
    event_type: str
    channel: str
    target_user_id: int | None
    target_address: str
    payload: dict[str, Any]

    status: str
    error_message: str | None
    retry_count: int
    last_retry_at: datetime | None
    delivered_at: datetime | None
    created_at: datetime


class NotificationLogListResponse(BaseModel):
    items: list[NotificationLogOut]
    total: int
    page: int
    page_size: int


class NotificationLogRetryResult(BaseModel):
    ok: bool
    message: str
    log: NotificationLogOut
