"""Ticket 서비스 — 접수/조회/갱신/전이 핵심 로직.

설계 문서 §4.1 (엔티티) / §4.2 (FSM) / §4.3 (ACL) / §5 (5단계 상세) 기준.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID
from v_platform.models.user import User

from app.models.contract import Contract
from app.models.customer import Customer
from app.models.enums import LoopAction, LoopStage, RequestServiceType, ScopeLevel
from app.models.loop import LoopTransition
from app.models.product import Product
from app.models.ticket import Ticket
from app.models.workspace import Workspace
from app.schemas.ticket import (
    TicketIntakeRequest,
    TicketTransitionRequest,
    TicketUpdateRequest,
)
from app.services import access_control, loop_fsm, notification_service, sla_timer


def _new_ulid() -> str:
    return str(ULID())


def _issue_ticket_no(db: Session) -> str:
    """`ITSM-YYYY-NNNNNN` 포맷의 사람이 읽는 번호를 PostgreSQL 시퀀스로 발급."""
    seq_val = db.execute(select(func.nextval("itsm_ticket_no_seq"))).scalar_one()
    year = datetime.now(timezone.utc).year
    return f"ITSM-{year}-{int(seq_val):06d}"


def _validate_references(
    db: Session,
    *,
    customer_id: str | None,
    product_id: str | None,
    contract_id: str | None,
) -> None:
    if customer_id is not None and db.get(Customer, customer_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"customer not found: {customer_id}")
    if product_id is not None and db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"product not found: {product_id}")
    if contract_id is not None:
        contract = db.get(Contract, contract_id)
        if contract is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"contract not found: {contract_id}")
        if customer_id is not None and contract.customer_id != customer_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "contract.customer_id mismatch",
            )


def create_from_intake(
    db: Session,
    payload: TicketIntakeRequest,
    current_user: User,
    *,
    workspace_id: str,
) -> Ticket:
    scope = access_control.get_user_scope(db, current_user)
    if not access_control.check_customer_product_access(
        scope,
        payload.service_type.value,
        payload.customer_id,
        payload.product_id,
        ScopeLevel.WRITE,
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied for intake")

    _validate_references(
        db,
        customer_id=payload.customer_id,
        product_id=payload.product_id,
        contract_id=payload.contract_id,
    )

    ticket = Ticket(
        id=_new_ulid(),
        workspace_id=workspace_id,
        ticket_no=_issue_ticket_no(db),
        title=payload.title,
        description=payload.description,
        source_channel=payload.source_channel.value,
        source_ref=payload.source_ref,
        priority=payload.priority.value,
        category_l1=payload.category_l1,
        category_l2=payload.category_l2,
        current_stage=LoopStage.INTAKE.value,
        requester_id=payload.requester_id,
        service_type=payload.service_type.value,
        customer_id=payload.customer_id,
        product_id=payload.product_id,
        contract_id=payload.contract_id,
    )
    db.add(ticket)
    db.flush()

    db.add(
        LoopTransition(
            id=_new_ulid(),
            ticket_id=ticket.id,
            from_stage=None,
            to_stage=LoopStage.INTAKE.value,
            action=LoopAction.ADVANCE.value,
            actor_id=payload.requester_id,
            note="intake",
        )
    )
    db.commit()
    db.refresh(ticket)

    sla_timer.create_timers(db, ticket)
    db.refresh(ticket)
    return ticket


def get(
    db: Session,
    ticket_id: str,
    current_user: User,
    *,
    workspace_id: str,
) -> Ticket | None:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None or ticket.workspace_id != workspace_id:
        return None
    scope = access_control.get_user_scope(db, current_user)
    if not access_control.check_ticket_access(scope, ticket, ScopeLevel.READ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied for ticket")
    return ticket


def list_tickets(
    db: Session,
    *,
    current_user: User,
    workspace_id: str,
    page: int = 1,
    page_size: int = 20,
    stage: LoopStage | None = None,
    owner_id: int | None = None,
    service_type: RequestServiceType | None = None,
    customer_id: str | None = None,
    product_id: str | None = None,
) -> tuple[list[Ticket], int]:
    scope = access_control.get_user_scope(db, current_user)
    stmt = select(Ticket).where(Ticket.workspace_id == workspace_id).order_by(Ticket.opened_at.desc())
    count_stmt = select(func.count()).select_from(Ticket).where(Ticket.workspace_id == workspace_id)

    stmt = access_control.apply_scope_to_query(stmt, scope, required=ScopeLevel.READ)
    count_stmt = access_control.apply_scope_to_query(count_stmt, scope, required=ScopeLevel.READ)

    if stage is not None:
        stmt = stmt.where(Ticket.current_stage == stage.value)
        count_stmt = count_stmt.where(Ticket.current_stage == stage.value)
    if owner_id is not None:
        stmt = stmt.where(Ticket.current_owner_id == owner_id)
        count_stmt = count_stmt.where(Ticket.current_owner_id == owner_id)
    if service_type is not None:
        stmt = stmt.where(Ticket.service_type == service_type.value)
        count_stmt = count_stmt.where(Ticket.service_type == service_type.value)
    if customer_id is not None:
        stmt = stmt.where(Ticket.customer_id == customer_id)
        count_stmt = count_stmt.where(Ticket.customer_id == customer_id)
    if product_id is not None:
        stmt = stmt.where(Ticket.product_id == product_id)
        count_stmt = count_stmt.where(Ticket.product_id == product_id)

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    items = db.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return list(items), int(total)


def list_tickets_cross_workspace(
    db: Session,
    *,
    current_user: User,
    page: int = 1,
    page_size: int = 20,
    stage: LoopStage | None = None,
    owner_id: int | None = None,
    service_type: RequestServiceType | None = None,
    customer_id: str | None = None,
    product_id: str | None = None,
    workspace_id: str | None = None,
) -> tuple[list[tuple[Ticket, str | None]], int]:
    """전 워크스페이스 대상 티켓 조회 (/my-work, /admin/all-work).

    - workspace_id 필터를 강제하지 않고, 필요 시 선택적으로 받음.
    - ScopeGrant 기반 ACL 은 기존 list_tickets 와 동일하게 적용 (SYSTEM_ADMIN 은 전권).
    - 응답에 WS 이름을 붙이기 위해 Workspace 를 LEFT JOIN 하여 (Ticket, ws_name) 을 반환.
    """
    scope = access_control.get_user_scope(db, current_user)
    stmt = (
        select(Ticket, Workspace.name)
        .outerjoin(Workspace, Workspace.id == Ticket.workspace_id)
        .order_by(Ticket.opened_at.desc())
    )
    count_stmt = select(func.count()).select_from(Ticket)

    stmt = access_control.apply_scope_to_query(stmt, scope, required=ScopeLevel.READ)
    count_stmt = access_control.apply_scope_to_query(count_stmt, scope, required=ScopeLevel.READ)

    if workspace_id is not None:
        stmt = stmt.where(Ticket.workspace_id == workspace_id)
        count_stmt = count_stmt.where(Ticket.workspace_id == workspace_id)
    if stage is not None:
        stmt = stmt.where(Ticket.current_stage == stage.value)
        count_stmt = count_stmt.where(Ticket.current_stage == stage.value)
    if owner_id is not None:
        stmt = stmt.where(Ticket.current_owner_id == owner_id)
        count_stmt = count_stmt.where(Ticket.current_owner_id == owner_id)
    if service_type is not None:
        stmt = stmt.where(Ticket.service_type == service_type.value)
        count_stmt = count_stmt.where(Ticket.service_type == service_type.value)
    if customer_id is not None:
        stmt = stmt.where(Ticket.customer_id == customer_id)
        count_stmt = count_stmt.where(Ticket.customer_id == customer_id)
    if product_id is not None:
        stmt = stmt.where(Ticket.product_id == product_id)
        count_stmt = count_stmt.where(Ticket.product_id == product_id)

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    rows = db.execute(stmt.offset(offset).limit(page_size)).all()
    return [(t, name) for t, name in rows], int(total)


def update(
    db: Session,
    ticket: Ticket,
    payload: TicketUpdateRequest,
    current_user: User,
) -> Ticket:
    scope = access_control.get_user_scope(db, current_user)
    if not access_control.check_ticket_access(scope, ticket, ScopeLevel.WRITE):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied for update")

    data = payload.model_dump(exclude_unset=True)

    # 스코프 영향 필드가 바뀌면 새 조합도 WRITE 허용 범위인지 재검증
    touches_scope = any(k in data for k in ("service_type", "customer_id", "product_id"))
    if touches_scope:
        new_service = data.get("service_type")
        new_service_val = (
            new_service.value
            if isinstance(new_service, RequestServiceType)
            else (new_service if new_service is not None else ticket.service_type)
        )
        new_customer = data["customer_id"] if "customer_id" in data else ticket.customer_id
        new_product = data["product_id"] if "product_id" in data else ticket.product_id
        if not access_control.check_customer_product_access(
            scope, new_service_val, new_customer, new_product, ScopeLevel.WRITE
        ):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "scope denied for new customer/product combo"
            )

    # 참조 무결성
    if any(k in data for k in ("customer_id", "product_id", "contract_id")):
        _validate_references(
            db,
            customer_id=data.get("customer_id", ticket.customer_id),
            product_id=data.get("product_id", ticket.product_id),
            contract_id=data.get("contract_id", ticket.contract_id),
        )

    prev_owner_id = ticket.current_owner_id

    for field, value in data.items():
        if field == "priority" and value is not None:
            setattr(ticket, field, value.value)
        elif field == "service_type" and value is not None:
            setattr(ticket, field, value.value if isinstance(value, RequestServiceType) else value)
        else:
            setattr(ticket, field, value)
    db.commit()
    db.refresh(ticket)

    if "current_owner_id" in data and ticket.current_owner_id != prev_owner_id:
        notification_service.notify_assignment(
            ticket,
            old_owner_id=prev_owner_id,
            new_owner_id=ticket.current_owner_id,
        )

    return ticket


def transition(
    db: Session,
    ticket: Ticket,
    payload: TicketTransitionRequest,
    actor_id: int | None,
    current_user: User,
) -> tuple[Ticket, LoopTransition]:
    """Loop FSM 전이 + 이력 기록 + closed_at/reopened_count 부가 처리."""
    scope = access_control.get_user_scope(db, current_user)
    if not access_control.check_ticket_access(scope, ticket, ScopeLevel.WRITE):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied for transition")

    current = LoopStage(ticket.current_stage)
    next_stage = loop_fsm.advance(current, payload.action)

    from_stage = ticket.current_stage
    ticket.current_stage = next_stage.value

    now = datetime.now(timezone.utc)
    if payload.action == LoopAction.REOPEN and current == LoopStage.CLOSED:
        ticket.reopened_count = (ticket.reopened_count or 0) + 1
        ticket.closed_at = None
    if next_stage == LoopStage.CLOSED:
        ticket.closed_at = now

    lt = LoopTransition(
        id=_new_ulid(),
        ticket_id=ticket.id,
        from_stage=from_stage,
        to_stage=next_stage.value,
        action=payload.action.value,
        actor_id=actor_id,
        note=payload.note,
        artifacts=payload.artifacts,
    )
    db.add(lt)
    db.commit()
    db.refresh(ticket)
    db.refresh(lt)

    notification_service.notify_transition(
        ticket,
        from_stage=from_stage,
        to_stage=next_stage.value,
        action=payload.action.value,
        actor_id=actor_id,
        note=payload.note,
    )

    return ticket, lt


def list_transitions(
    db: Session,
    ticket_id: str,
    current_user: User,
) -> list[LoopTransition]:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        return []
    scope = access_control.get_user_scope(db, current_user)
    if not access_control.check_ticket_access(scope, ticket, ScopeLevel.READ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "scope denied for transitions")

    stmt = (
        select(LoopTransition)
        .where(LoopTransition.ticket_id == ticket_id)
        .order_by(LoopTransition.transitioned_at.asc())
    )
    return list(db.execute(stmt).scalars().all())
