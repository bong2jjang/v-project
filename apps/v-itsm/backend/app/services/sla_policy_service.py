"""SLAPolicy CRUD + 재계산 트리거 — 설계 §6.1.

정책이 변경되면 해당 (priority, category) 조합을 쓰고 있는 활성 티켓의 타이머 due_at
을 재계산해야 고객이 기대하는 최신 SLA 가 반영된다. 여기서는 CRUD 만 담당하고, 재계산은
`sla_timer.recalculate_active_timers()` 로 위임한다. 재계산은 별도 플래그로 명시적
호출하는 방식(무분별한 쓰기 폭증 방지)이다.
"""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.enums import Priority
from app.models.sla import SLAPolicy
from app.schemas.sla_policy import SLAPolicyCreate, SLAPolicyUpdate


def _new_ulid() -> str:
    return str(ULID())


def create_policy(
    db: Session, payload: SLAPolicyCreate, *, workspace_id: str
) -> SLAPolicy:
    row = SLAPolicy(
        id=_new_ulid(),
        workspace_id=workspace_id,
        name=payload.name,
        priority=payload.priority.value,
        category=payload.category,
        response_minutes=payload.response_minutes,
        resolution_minutes=payload.resolution_minutes,
        business_hours=payload.business_hours,
        active=payload.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_policy(db: Session, policy_id: str) -> SLAPolicy | None:
    return db.get(SLAPolicy, policy_id)


def list_policies(
    db: Session,
    *,
    workspace_id: str,
    page: int = 1,
    page_size: int = 50,
    priority: Priority | None = None,
    category: str | None = None,
    active_only: bool = False,
    search: str | None = None,
) -> tuple[list[SLAPolicy], int]:
    base = SLAPolicy.workspace_id == workspace_id
    stmt = select(SLAPolicy).where(base)
    count_stmt = select(func.count()).select_from(SLAPolicy).where(base)
    if priority is not None:
        stmt = stmt.where(SLAPolicy.priority == priority.value)
        count_stmt = count_stmt.where(SLAPolicy.priority == priority.value)
    if category is not None:
        stmt = stmt.where(SLAPolicy.category == category)
        count_stmt = count_stmt.where(SLAPolicy.category == category)
    if active_only:
        stmt = stmt.where(SLAPolicy.active.is_(True))
        count_stmt = count_stmt.where(SLAPolicy.active.is_(True))
    if search:
        pattern = f"%{search}%"
        cond = or_(SLAPolicy.name.ilike(pattern), SLAPolicy.category.ilike(pattern))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = int(db.execute(count_stmt).scalar_one() or 0)
    offset = max(page - 1, 0) * page_size
    stmt = stmt.order_by(
        SLAPolicy.priority.asc(), SLAPolicy.category.asc().nullsfirst()
    ).offset(offset).limit(page_size)
    rows = list(db.execute(stmt).scalars().all())
    return rows, total


def update_policy(
    db: Session, policy: SLAPolicy, payload: SLAPolicyUpdate
) -> SLAPolicy:
    data = payload.model_dump(exclude_unset=True)
    if "priority" in data and data["priority"] is not None:
        data["priority"] = data["priority"].value
    for field, value in data.items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    return policy


def delete_policy(db: Session, policy: SLAPolicy) -> None:
    db.delete(policy)
    db.commit()
