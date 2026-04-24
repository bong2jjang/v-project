"""v-itsm 스케줄러 모니터링/오버라이드 API (관리자) — 설계 §9.2.

AsyncIOScheduler 로 돌아가는 잡들의 현재 상태(next_run_at/last_run_at)와
오버라이드(interval/paused)를 조회/변경한다. JobSpec 의 min/max 로 입력 클램프
는 scheduler_registry 가 담당.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.workspace import Workspace
from app.schemas.scheduler import (
    SchedulerJobListResponse,
    SchedulerJobOut,
    SchedulerRescheduleIn,
)
from app.services.scheduler_registry import scheduler_registry

router = APIRouter(prefix="/api/ws/{workspace_id}/scheduler", tags=["scheduler"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("/jobs", response_model=SchedulerJobListResponse)
async def list_jobs(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SchedulerJobListResponse:
    _require_admin(current_user)
    items = scheduler_registry.snapshot(db)
    return SchedulerJobListResponse(
        items=[SchedulerJobOut(**row) for row in items],
        total=len(items),
    )


@router.patch("/jobs/{job_id}", response_model=SchedulerJobOut)
async def reschedule_job(
    job_id: str,
    payload: SchedulerRescheduleIn,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SchedulerJobOut:
    _require_admin(current_user)
    try:
        snap = scheduler_registry.reschedule(
            db,
            job_id,
            interval_seconds=payload.interval_seconds,
            paused=payload.paused,
            updated_by=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e
    return SchedulerJobOut(**snap)
