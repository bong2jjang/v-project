"""스케줄러 잡 모니터링/오버라이드 스키마 — 설계 §9.2.

`scheduler_registry.snapshot(db)` 가 돌려주는 dict 를 타입화하고,
PATCH payload 로 interval/paused 를 오버라이드할 수 있도록 한다.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SchedulerJobOut(BaseModel):
    job_id: str
    description: str
    interval_seconds: int
    default_interval_seconds: int
    min_interval_seconds: int
    max_interval_seconds: int
    paused: bool
    next_run_at: str | None = None
    last_run_at: str | None = None
    override_updated_at: str | None = None
    override_updated_by: int | None = None


class SchedulerJobListResponse(BaseModel):
    items: list[SchedulerJobOut]
    total: int


class SchedulerRescheduleIn(BaseModel):
    interval_seconds: int | None = Field(default=None, ge=1)
    paused: bool | None = None
