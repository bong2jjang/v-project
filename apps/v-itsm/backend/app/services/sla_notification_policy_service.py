"""SLANotificationPolicy CRUD — 설계 §7.2.

warning/breach 이벤트별로 알릴 채널·대상(담당자/관리자/custom user/주소)을 DB 에서 관리.
실제 발송은 `notification_service` 가 이 테이블을 조회하여 매칭된 정책을 적용한다.
"""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.enums import Priority, RequestServiceType
from app.models.sla_notification_policy import SLANotificationPolicy
from app.schemas.sla_notification_policy import (
    SLANotificationPolicyCreate,
    SLANotificationPolicyUpdate,
)


def _new_ulid() -> str:
    return str(ULID())


def create_policy(
    db: Session, payload: SLANotificationPolicyCreate
) -> SLANotificationPolicy:
    row = SLANotificationPolicy(
        id=_new_ulid(),
        name=payload.name,
        trigger_event=payload.trigger_event,
        applies_priority=payload.applies_priority.value
        if payload.applies_priority
        else None,
        applies_service_type=payload.applies_service_type.value
        if payload.applies_service_type
        else None,
        notify_channels=list(payload.notify_channels),
        notify_assignee=payload.notify_assignee,
        notify_assignee_manager=payload.notify_assignee_manager,
        notify_custom_user_ids=payload.notify_custom_user_ids,
        notify_custom_addresses=payload.notify_custom_addresses,
        template_key=payload.template_key,
        active=payload.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_policy(db: Session, policy_id: str) -> SLANotificationPolicy | None:
    return db.get(SLANotificationPolicy, policy_id)


def list_policies(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    trigger_event: str | None = None,
    priority: Priority | None = None,
    service_type: RequestServiceType | None = None,
    active_only: bool = False,
    search: str | None = None,
) -> tuple[list[SLANotificationPolicy], int]:
    stmt = select(SLANotificationPolicy)
    count_stmt = select(func.count()).select_from(SLANotificationPolicy)
    if trigger_event is not None:
        stmt = stmt.where(SLANotificationPolicy.trigger_event == trigger_event)
        count_stmt = count_stmt.where(
            SLANotificationPolicy.trigger_event == trigger_event
        )
    if priority is not None:
        stmt = stmt.where(SLANotificationPolicy.applies_priority == priority.value)
        count_stmt = count_stmt.where(
            SLANotificationPolicy.applies_priority == priority.value
        )
    if service_type is not None:
        stmt = stmt.where(
            SLANotificationPolicy.applies_service_type == service_type.value
        )
        count_stmt = count_stmt.where(
            SLANotificationPolicy.applies_service_type == service_type.value
        )
    if active_only:
        stmt = stmt.where(SLANotificationPolicy.active.is_(True))
        count_stmt = count_stmt.where(SLANotificationPolicy.active.is_(True))
    if search:
        pattern = f"%{search}%"
        cond = or_(
            SLANotificationPolicy.name.ilike(pattern),
            SLANotificationPolicy.template_key.ilike(pattern),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = int(db.execute(count_stmt).scalar_one() or 0)
    offset = max(page - 1, 0) * page_size
    stmt = stmt.order_by(
        SLANotificationPolicy.trigger_event.asc(),
        SLANotificationPolicy.applies_priority.asc().nullsfirst(),
    ).offset(offset).limit(page_size)
    rows = list(db.execute(stmt).scalars().all())
    return rows, total


def update_policy(
    db: Session,
    policy: SLANotificationPolicy,
    payload: SLANotificationPolicyUpdate,
) -> SLANotificationPolicy:
    data = payload.model_dump(exclude_unset=True)
    if "applies_priority" in data and data["applies_priority"] is not None:
        data["applies_priority"] = data["applies_priority"].value
    if "applies_service_type" in data and data["applies_service_type"] is not None:
        data["applies_service_type"] = data["applies_service_type"].value
    for field, value in data.items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    return policy


def delete_policy(db: Session, policy: SLANotificationPolicy) -> None:
    db.delete(policy)
    db.commit()


def resolve_for_event(
    db: Session,
    *,
    trigger_event: str,
    priority: str | None,
    service_type: str | None,
) -> list[SLANotificationPolicy]:
    """이벤트·우선순위·서비스구분에 매칭되는 활성 정책 리스트.

    구체화 규칙: applies_* 값이 NULL 이면 와일드카드, 아니면 정확 매칭.
    notification_service 는 여기서 반환된 정책들의 채널/대상을 union 해서 발송한다.
    """
    stmt = select(SLANotificationPolicy).where(
        SLANotificationPolicy.active.is_(True),
        SLANotificationPolicy.trigger_event == trigger_event,
        or_(
            SLANotificationPolicy.applies_priority.is_(None),
            SLANotificationPolicy.applies_priority == priority,
        ),
        or_(
            SLANotificationPolicy.applies_service_type.is_(None),
            SLANotificationPolicy.applies_service_type == service_type,
        ),
    )
    return list(db.execute(stmt).scalars().all())
