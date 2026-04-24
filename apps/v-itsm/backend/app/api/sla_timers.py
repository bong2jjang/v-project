"""v-itsm SLA Timer 조회 API — 관제(Monitor) UI 전용.

엔드포인트:
  GET /api/sla-timers              - 타이머 목록 (status/kind/priority 필터)
  GET /api/sla-timers/summary      - 상태별 카운트 요약

상태 분류(API 계산):
  satisfied : satisfied_at != NULL
  breached  : breached_at != NULL (satisfied 아님)
  warning   : warning_sent_at != NULL (breached/satisfied 아님)
  active    : 나머지

ACL: 티켓 스코프(`access_control`)를 SLA Timer 조회에도 동일 적용.
  SYSTEM_ADMIN 전권, 그 외 ScopeGrant union 에 매칭된 티켓의 타이머만.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.enums import Priority, ScopeLevel
from app.models.sla import SLATimer
from app.models.ticket import Ticket
from app.models.workspace import Workspace
from app.schemas.sla_timer import (
    SLASummaryOut,
    SLATimerListResponse,
    SLATimerOut,
)
from app.services import access_control

router = APIRouter(prefix="/api/ws/{workspace_id}/sla-timers", tags=["sla-timers"])


def _derive_status(t: SLATimer) -> str:
    if t.satisfied_at is not None:
        return "satisfied"
    if t.breached_at is not None:
        return "breached"
    if t.warning_sent_at is not None:
        return "warning"
    return "active"


def _to_out(timer: SLATimer, ticket: Ticket) -> SLATimerOut:
    now = datetime.now(timezone.utc)
    remaining = int((timer.due_at - now).total_seconds())
    return SLATimerOut(
        id=timer.id,
        ticket_id=timer.ticket_id,
        kind=timer.kind,
        due_at=timer.due_at,
        warning_sent_at=timer.warning_sent_at,
        breached_at=timer.breached_at,
        satisfied_at=timer.satisfied_at,
        created_at=timer.created_at,
        ticket_no=ticket.ticket_no,
        ticket_title=ticket.title,
        ticket_priority=ticket.priority,
        ticket_stage=ticket.current_stage,
        ticket_service_type=ticket.service_type,
        customer_id=ticket.customer_id,
        product_id=ticket.product_id,
        status=_derive_status(timer),
        remaining_seconds=remaining,
    )


def _apply_status_filter(stmt, status_filter: str | None):
    if status_filter is None:
        return stmt
    if status_filter == "satisfied":
        return stmt.where(SLATimer.satisfied_at.is_not(None))
    if status_filter == "breached":
        return stmt.where(
            SLATimer.breached_at.is_not(None), SLATimer.satisfied_at.is_(None)
        )
    if status_filter == "warning":
        return stmt.where(
            SLATimer.warning_sent_at.is_not(None),
            SLATimer.breached_at.is_(None),
            SLATimer.satisfied_at.is_(None),
        )
    if status_filter == "active":
        return stmt.where(
            SLATimer.warning_sent_at.is_(None),
            SLATimer.breached_at.is_(None),
            SLATimer.satisfied_at.is_(None),
        )
    return stmt


@router.get("", response_model=SLATimerListResponse)
async def list_timers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(
        None, alias="status", description="active|warning|breached|satisfied"
    ),
    kind: str | None = Query(None, description="response|resolution"),
    priority: Priority | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLATimerListResponse:
    scope = access_control.get_user_scope(db, current_user)

    # SLA 타이머와 티켓 조인
    stmt = (
        select(SLATimer, Ticket)
        .join(Ticket, Ticket.id == SLATimer.ticket_id)
        .where(Ticket.workspace_id == workspace.id)
        .order_by(SLATimer.due_at.asc())
    )
    count_stmt = (
        select(func.count())
        .select_from(SLATimer)
        .join(Ticket, Ticket.id == SLATimer.ticket_id)
        .where(Ticket.workspace_id == workspace.id)
    )

    # 스코프 WHERE 주입 (Ticket 기준)
    stmt = access_control.apply_scope_to_query(stmt, scope, required=ScopeLevel.READ)
    count_stmt = access_control.apply_scope_to_query(
        count_stmt, scope, required=ScopeLevel.READ
    )

    stmt = _apply_status_filter(stmt, status_filter)
    count_stmt = _apply_status_filter(count_stmt, status_filter)

    if kind is not None:
        stmt = stmt.where(SLATimer.kind == kind)
        count_stmt = count_stmt.where(SLATimer.kind == kind)

    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority.value)
        count_stmt = count_stmt.where(Ticket.priority == priority.value)

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    rows = db.execute(stmt.offset(offset).limit(page_size)).all()
    items = [_to_out(timer, ticket) for (timer, ticket) in rows]
    return SLATimerListResponse(
        items=items,
        total=int(total),
        page=page,
        page_size=page_size,
    )


@router.get("/summary", response_model=SLASummaryOut)
async def sla_summary(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLASummaryOut:
    scope = access_control.get_user_scope(db, current_user)

    base = (
        select(SLATimer.id)
        .select_from(SLATimer)
        .join(Ticket, Ticket.id == SLATimer.ticket_id)
        .where(Ticket.workspace_id == workspace.id)
    )
    base = access_control.apply_scope_to_query(base, scope, required=ScopeLevel.READ)

    def _count(filter_name: str) -> int:
        stmt = _apply_status_filter(base, filter_name)
        return int(
            db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
        )

    total = int(
        db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    )
    return SLASummaryOut(
        active=_count("active"),
        warning=_count("warning"),
        breached=_count("breached"),
        satisfied=_count("satisfied"),
        total=total,
    )
