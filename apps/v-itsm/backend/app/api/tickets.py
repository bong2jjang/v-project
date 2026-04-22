"""v-itsm 티켓 CRUD + Loop FSM 전이 API.

엔드포인트:
  POST   /api/tickets/intake            - 채널/웹폼 최초 접수
  GET    /api/tickets                   - 목록 (stage/owner/service_type/customer/product 필터)
  GET    /api/tickets/{id}              - 단건 조회
  PATCH  /api/tickets/{id}              - 필드 갱신 (전이 제외)
  POST   /api/tickets/{id}/transition   - Loop FSM 전이
  GET    /api/tickets/{id}/transitions  - 전이 이력
  GET    /api/tickets/{id}/allowed-actions - 현재 단계에서 가능한 액션

모든 엔드포인트는 `access_control` 의 스코프 가드를 통과한 사용자만 접근 가능.
SYSTEM_ADMIN 은 전권, 그 외는 권한그룹 경유 `itsm_scope_grant` 에 매칭되어야 함.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.models.enums import LoopStage, RequestServiceType
from app.schemas.ticket import (
    AllowedActionsOut,
    LoopTransitionOut,
    TicketIntakeRequest,
    TicketListResponse,
    TicketOut,
    TicketTransitionRequest,
    TicketUpdateRequest,
)
from app.schemas.transition import (
    LoopTransitionDetailOut,
    LoopTransitionRevisionOut,
)
from app.services import loop_fsm, ticket_service, transition_service

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.post(
    "/intake",
    response_model=TicketOut,
    status_code=status.HTTP_201_CREATED,
)
async def intake_ticket(
    payload: TicketIntakeRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TicketOut:
    if payload.requester_id is None:
        payload.requester_id = current_user.id
    ticket = ticket_service.create_from_intake(db, payload, current_user=current_user)
    return TicketOut.model_validate(ticket)


@router.get("", response_model=TicketListResponse)
async def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stage: LoopStage | None = Query(None),
    owner_id: int | None = Query(None),
    service_type: RequestServiceType | None = Query(None),
    customer_id: str | None = Query(None),
    product_id: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TicketListResponse:
    items, total = ticket_service.list_tickets(
        db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        stage=stage,
        owner_id=owner_id,
        service_type=service_type,
        customer_id=customer_id,
        product_id=product_id,
    )
    return TicketListResponse(
        items=[TicketOut.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TicketOut:
    ticket = ticket_service.get(db, ticket_id, current_user=current_user)
    if not ticket:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")
    return TicketOut.model_validate(ticket)


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: str,
    payload: TicketUpdateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TicketOut:
    ticket = ticket_service.get(db, ticket_id, current_user=current_user)
    if not ticket:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")
    updated = ticket_service.update(db, ticket, payload, current_user=current_user)
    return TicketOut.model_validate(updated)


@router.post("/{ticket_id}/transition", response_model=LoopTransitionOut)
async def transition_ticket(
    ticket_id: str,
    payload: TicketTransitionRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> LoopTransitionOut:
    ticket = ticket_service.get(db, ticket_id, current_user=current_user)
    if not ticket:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")
    try:
        _, lt = ticket_service.transition(
            db, ticket, payload, actor_id=current_user.id, current_user=current_user
        )
    except loop_fsm.LoopTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return LoopTransitionOut.model_validate(lt)


@router.get(
    "/{ticket_id}/transitions",
    response_model=list[LoopTransitionDetailOut],
)
async def get_transitions(
    ticket_id: str,
    include_deleted: bool = Query(False),
    with_latest_revision: bool = Query(False),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[LoopTransitionDetailOut]:
    """전이 이력.

    - `include_deleted=true` 면 소프트 삭제된 이력도 반환(복원 UI 용).
    - `with_latest_revision=true` 면 각 전이의 최신 리비전 요약 포함.
    - 응답은 편집 버튼 활성화 플래그(can_edit/delete/restore)를 서버가 계산.
    """
    # 티켓 read 권한은 ticket_service.get 이 담당
    ticket = ticket_service.get(db, ticket_id, current_user=current_user)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")

    items = transition_service.list_transitions_with_meta(
        db,
        ticket_id=ticket_id,
        include_deleted=include_deleted,
        current_user=current_user,
    )
    results: list[LoopTransitionDetailOut] = []
    for lt in items:
        detail = LoopTransitionDetailOut.model_validate(lt)
        detail.can_edit = transition_service.compute_can_edit(current_user, lt)
        detail.can_delete = detail.can_edit and lt.deleted_at is None
        detail.can_restore = transition_service.compute_can_restore(current_user, lt)
        if with_latest_revision:
            rev = transition_service.get_latest_revision(db, lt.id)
            if rev is not None:
                detail.latest_revision = LoopTransitionRevisionOut.model_validate(rev)
        results.append(detail)
    return results


@router.get("/{ticket_id}/allowed-actions", response_model=AllowedActionsOut)
async def get_allowed_actions(
    ticket_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AllowedActionsOut:
    ticket = ticket_service.get(db, ticket_id, current_user=current_user)
    if not ticket:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ticket not found")
    current = LoopStage(ticket.current_stage)
    return AllowedActionsOut(
        current_stage=current,
        allowed=loop_fsm.allowed_actions(current),
    )
