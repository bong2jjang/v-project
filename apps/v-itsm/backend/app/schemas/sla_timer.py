"""SLA Timer 응답 스키마 (Pydantic v2).

관제(SLA Monitor) UI 전용 DTO. 타이머와 연관된 티켓의 요약 정보를 함께 내려준다.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SLATimerOut(BaseModel):
    """itsm_sla_timer 단일 로우 + 티켓 요약."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    kind: str  # response | resolution
    due_at: datetime
    warning_sent_at: datetime | None
    breached_at: datetime | None
    satisfied_at: datetime | None
    created_at: datetime

    # 조회 편의를 위한 티켓 요약
    ticket_no: str
    ticket_title: str
    ticket_priority: str
    ticket_stage: str
    ticket_service_type: str
    customer_id: str | None
    product_id: str | None

    # 파생 상태: active | warning | breached | satisfied
    status: str
    # due_at 까지 남은 초 (+면 아직, -면 초과)
    remaining_seconds: int


class SLATimerListResponse(BaseModel):
    items: list[SLATimerOut]
    total: int
    page: int
    page_size: int


class SLASummaryOut(BaseModel):
    """GET /api/sla-timers/summary — 관제 상단 요약 카드."""

    active: int
    warning: int
    breached: int
    satisfied: int
    total: int
