"""KPI Dashboard 응답 스키마 (Pydantic v2).

관제/운영 지표 요약용 라이브 계산 DTO. `itsm_kpi_snapshot` 은 배치 집계용이므로
별도의 실시간 계산 엔드포인트 `/api/kpi/summary` 에 대응한다.
"""

from __future__ import annotations

from pydantic import BaseModel


class StageCount(BaseModel):
    stage: str
    count: int


class PriorityCount(BaseModel):
    priority: str
    count: int


class ServiceTypeCount(BaseModel):
    service_type: str
    count: int


class KPISummaryOut(BaseModel):
    """GET /api/kpi/summary — 대시보드 상단 카드 + 분포 차트."""

    # 전체 티켓 수 (open / closed)
    total_tickets: int
    open_tickets: int
    closed_tickets: int

    # 최근 30일 내 접수 건수
    opened_last_30d: int
    closed_last_30d: int

    # SLA 지표
    sla_total: int
    sla_active: int
    sla_warning: int
    sla_breached: int
    sla_satisfied: int
    sla_met_ratio: float  # satisfied / (satisfied + breached)

    # MTTR(분) — closed 티켓의 opened_at → closed_at 평균
    mttr_minutes: float | None

    # Re-open Rate — reopened_count > 0 / total
    reopen_ratio: float

    # 분포
    by_stage: list[StageCount]
    by_priority: list[PriorityCount]
    by_service_type: list[ServiceTypeCount]
