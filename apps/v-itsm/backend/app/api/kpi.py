"""v-itsm KPI Dashboard API — 라이브 계산 요약.

엔드포인트:
  GET /api/kpi/summary - 대시보드 상단 카드 + 분포 (스코프 적용)

ACL: 티켓 스코프(`access_control`)를 KPI 집계에도 적용하여,
사용자가 접근 가능한 티켓만 합산한다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.enums import ScopeLevel
from app.models.sla import SLATimer
from app.models.ticket import Ticket
from app.models.workspace import Workspace
from app.schemas.kpi import (
    KPISummaryOut,
    PriorityCount,
    ServiceTypeCount,
    StageCount,
)
from app.services import access_control

router = APIRouter(prefix="/api/ws/{workspace_id}/kpi", tags=["kpi"])


@router.get("/summary", response_model=KPISummaryOut)
async def kpi_summary(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> KPISummaryOut:
    scope = access_control.get_user_scope(db, current_user)
    now = datetime.now(timezone.utc)
    since_30d = now - timedelta(days=30)

    # ── 스코프 적용 공용 WHERE (Ticket 에 직접 붙음) ──
    def scoped_ticket_select(*cols):
        stmt = (
            select(*cols)
            .select_from(Ticket)
            .where(Ticket.workspace_id == workspace.id)
        )
        return access_control.apply_scope_to_query(
            stmt, scope, required=ScopeLevel.READ
        )

    # ── 티켓 집계 ──
    total_tickets = int(
        db.execute(scoped_ticket_select(func.count(Ticket.id))).scalar_one()
    )
    open_tickets = int(
        db.execute(
            scoped_ticket_select(func.count(Ticket.id)).where(
                Ticket.current_stage != "closed"
            )
        ).scalar_one()
    )
    closed_tickets = int(
        db.execute(
            scoped_ticket_select(func.count(Ticket.id)).where(
                Ticket.current_stage == "closed"
            )
        ).scalar_one()
    )

    opened_last_30d = int(
        db.execute(
            scoped_ticket_select(func.count(Ticket.id)).where(
                Ticket.opened_at >= since_30d
            )
        ).scalar_one()
    )
    closed_last_30d = int(
        db.execute(
            scoped_ticket_select(func.count(Ticket.id)).where(
                Ticket.closed_at.is_not(None),
                Ticket.closed_at >= since_30d,
            )
        ).scalar_one()
    )

    # Re-open Ratio
    reopened_count = int(
        db.execute(
            scoped_ticket_select(func.count(Ticket.id)).where(
                Ticket.reopened_count > 0
            )
        ).scalar_one()
    )
    reopen_ratio = (reopened_count / total_tickets) if total_tickets > 0 else 0.0

    # MTTR (closed 티켓 평균 처리시간, 분)
    mttr_value = db.execute(
        scoped_ticket_select(
            func.avg(
                func.extract("epoch", Ticket.closed_at - Ticket.opened_at) / 60.0
            )
        ).where(Ticket.closed_at.is_not(None))
    ).scalar_one_or_none()
    mttr_minutes: float | None = float(mttr_value) if mttr_value is not None else None

    # ── 분포 ──
    by_stage_rows = db.execute(
        scoped_ticket_select(Ticket.current_stage, func.count(Ticket.id)).group_by(
            Ticket.current_stage
        )
    ).all()
    by_stage = [StageCount(stage=row[0], count=int(row[1])) for row in by_stage_rows]

    by_priority_rows = db.execute(
        scoped_ticket_select(Ticket.priority, func.count(Ticket.id)).group_by(
            Ticket.priority
        )
    ).all()
    by_priority = [
        PriorityCount(priority=row[0], count=int(row[1])) for row in by_priority_rows
    ]

    by_service_rows = db.execute(
        scoped_ticket_select(Ticket.service_type, func.count(Ticket.id)).group_by(
            Ticket.service_type
        )
    ).all()
    by_service_type = [
        ServiceTypeCount(service_type=row[0], count=int(row[1]))
        for row in by_service_rows
    ]

    # ── SLA 지표 (타이머 + 티켓 조인, 스코프는 티켓 컬럼에 적용) ──
    sla_base_cte = (
        select(
            SLATimer.satisfied_at.label("satisfied_at"),
            SLATimer.breached_at.label("breached_at"),
            SLATimer.warning_sent_at.label("warning_sent_at"),
        )
        .select_from(SLATimer)
        .join(Ticket, Ticket.id == SLATimer.ticket_id)
        .where(Ticket.workspace_id == workspace.id)
    )
    sla_base_cte = access_control.apply_scope_to_query(
        sla_base_cte, scope, required=ScopeLevel.READ
    )
    sla_sub = sla_base_cte.subquery()

    sla_row = db.execute(
        select(
            func.count(),
            func.sum(case((sla_sub.c.satisfied_at.is_not(None), 1), else_=0)),
            func.sum(
                case(
                    (
                        (sla_sub.c.breached_at.is_not(None))
                        & (sla_sub.c.satisfied_at.is_(None)),
                        1,
                    ),
                    else_=0,
                )
            ),
            func.sum(
                case(
                    (
                        (sla_sub.c.warning_sent_at.is_not(None))
                        & (sla_sub.c.breached_at.is_(None))
                        & (sla_sub.c.satisfied_at.is_(None)),
                        1,
                    ),
                    else_=0,
                )
            ),
        ).select_from(sla_sub)
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
