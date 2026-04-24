"""v-itsm 워크스페이스 관리자 API (SYSTEM_ADMIN 전용) — 설계 §4.1.

엔드포인트:
  GET    /api/admin/workspaces        - 전체 WS 목록 (아카이빙 포함 옵션)
  POST   /api/admin/workspaces        - WS 생성 (플랫폼 ITSM 관리자 only)
  PUT    /api/admin/workspaces/{id}   - WS 수정
  DELETE /api/admin/workspaces/{id}   - WS 아카이빙 (이관 필수, D6)
  GET    /api/admin/global-kpi        - 전역 KPI 집계 (ws=all)

모든 엔드포인트: SYSTEM_ADMIN 전용.
WS 생성 시 생성자를 ws_admin 으로 자동 등록.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.models.sla import SLATimer
from app.models.ticket import Ticket
from app.models.workspace import Workspace
from app.schemas.kpi import (
    KPISummaryOut,
    PriorityCount,
    ServiceTypeCount,
    StageCount,
)
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceListResponse,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.services import workspace_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


def _get_ws_or_404(db: Session, workspace_id: str) -> Workspace:
    ws = workspace_service.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "워크스페이스를 찾을 수 없습니다.")
    return ws


# ── 워크스페이스 CRUD ─────────────────────────────────────────────────────────

@router.get("/workspaces", response_model=WorkspaceListResponse)
async def list_workspaces(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceListResponse:
    _require_admin(current_user)
    items, total = workspace_service.list_all_workspaces(
        db, page=page, page_size=page_size, include_archived=include_archived
    )
    return WorkspaceListResponse(
        items=[WorkspaceOut.model_validate(ws) for ws in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/workspaces",
    response_model=WorkspaceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceOut:
    _require_admin(current_user)

    if workspace_service.get_workspace_by_slug(db, payload.slug) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"slug '{payload.slug}' 가 이미 사용 중입니다.")

    ws = workspace_service.create_workspace(db, payload, created_by=current_user.id)
    # 생성자를 ws_admin 으로 자동 등록
    workspace_service.add_member(db, ws.id, current_user.id, role="ws_admin", is_default=False)
    return WorkspaceOut.model_validate(ws)


@router.put("/workspaces/{id}", response_model=WorkspaceOut)
async def update_workspace(
    id: str,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceOut:
    _require_admin(current_user)
    ws = _get_ws_or_404(db, id)

    if payload.slug is not None and payload.slug != ws.slug:
        conflict = workspace_service.get_workspace_by_slug(db, payload.slug)
        if conflict is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"slug '{payload.slug}' 가 이미 사용 중입니다.")

    updated = workspace_service.update_workspace(db, ws, payload)
    return WorkspaceOut.model_validate(updated)


@router.delete("/workspaces/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_workspace(
    id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_admin(current_user)
    ws = _get_ws_or_404(db, id)

    if ws.archived_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 아카이빙된 워크스페이스입니다.")

    # D6: 활성 티켓 존재 시 아카이빙 거부 (이관 필수)
    open_count = db.execute(
        select(func.count(Ticket.id)).where(
            Ticket.workspace_id == ws.id,
            Ticket.current_stage != "closed",
        )
    ).scalar_one()
    if int(open_count) > 0:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"미종결 티켓 {open_count}건을 먼저 이관하거나 종결하세요.",
        )

    workspace_service.archive_workspace(db, ws)


# ── 전역 KPI ──────────────────────────────────────────────────────────────────

@router.get("/global-kpi", response_model=KPISummaryOut)
async def global_kpi(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> KPISummaryOut:
    """전체 워크스페이스 통합 KPI — SYSTEM_ADMIN 전용."""
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    since_30d = now - timedelta(days=30)

    def _count(extra_where=None):
        stmt = select(func.count(Ticket.id)).select_from(Ticket)
        if extra_where is not None:
            stmt = stmt.where(extra_where)
        return int(db.execute(stmt).scalar_one())

    total_tickets = _count()
    open_tickets = _count(Ticket.current_stage != "closed")
    closed_tickets = _count(Ticket.current_stage == "closed")
    opened_last_30d = _count(Ticket.opened_at >= since_30d)
    closed_last_30d = _count(
        (Ticket.closed_at.is_not(None)) & (Ticket.closed_at >= since_30d)
    )
    reopened_count = _count(Ticket.reopened_count > 0)
    reopen_ratio = (reopened_count / total_tickets) if total_tickets > 0 else 0.0

    mttr_value = db.execute(
        select(
            func.avg(
                func.extract("epoch", Ticket.closed_at - Ticket.opened_at) / 60.0
            )
        ).where(Ticket.closed_at.is_not(None))
    ).scalar_one_or_none()
    mttr_minutes: float | None = float(mttr_value) if mttr_value is not None else None

    by_stage = [
        StageCount(stage=row[0], count=int(row[1]))
        for row in db.execute(
            select(Ticket.current_stage, func.count(Ticket.id)).group_by(Ticket.current_stage)
        ).all()
    ]
    by_priority = [
        PriorityCount(priority=row[0], count=int(row[1]))
        for row in db.execute(
            select(Ticket.priority, func.count(Ticket.id)).group_by(Ticket.priority)
        ).all()
    ]
    by_service_type = [
        ServiceTypeCount(service_type=row[0], count=int(row[1]))
        for row in db.execute(
            select(Ticket.service_type, func.count(Ticket.id)).group_by(Ticket.service_type)
        ).all()
    ]

    sla_row = db.execute(
        select(
            func.count(),
            func.sum(case((SLATimer.satisfied_at.is_not(None), 1), else_=0)),
            func.sum(
                case(
                    (
                        (SLATimer.breached_at.is_not(None))
                        & (SLATimer.satisfied_at.is_(None)),
                        1,
                    ),
                    else_=0,
                )
            ),
            func.sum(
                case(
                    (
                        (SLATimer.warning_sent_at.is_not(None))
                        & (SLATimer.breached_at.is_(None))
                        & (SLATimer.satisfied_at.is_(None)),
                        1,
                    ),
                    else_=0,
                )
            ),
        ).select_from(SLATimer)
    ).one()

    sla_total = int(sla_row[0] or 0)
    sla_satisfied = int(sla_row[1] or 0)
    sla_breached = int(sla_row[2] or 0)
    sla_warning = int(sla_row[3] or 0)
    sla_active = sla_total - sla_satisfied - sla_breached - sla_warning
    denom = sla_satisfied + sla_breached
    sla_met_ratio = (sla_satisfied / denom) if denom > 0 else 0.0

    return KPISummaryOut(
        total_tickets=total_tickets,
        open_tickets=open_tickets,
        closed_tickets=closed_tickets,
        opened_last_30d=opened_last_30d,
        closed_last_30d=closed_last_30d,
        sla_total=sla_total,
        sla_active=max(0, sla_active),
        sla_warning=sla_warning,
        sla_breached=sla_breached,
        sla_satisfied=sla_satisfied,
        sla_met_ratio=sla_met_ratio,
        mttr_minutes=mttr_minutes,
        reopen_ratio=reopen_ratio,
        by_stage=by_stage,
        by_priority=by_priority,
        by_service_type=by_service_type,
    )
