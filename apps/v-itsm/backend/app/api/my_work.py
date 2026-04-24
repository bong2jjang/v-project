"""v-itsm 내 업무 통합 조회 API — 설계 §3.5.1 (v0.6).

전 워크스페이스를 대상으로 "내게 할당된" 티켓을 통합 조회한다.
- owner_id 는 서버가 current_user.id 로 고정 (클라이언트 조작 불가).
- ScopeGrant 기반 ACL 은 기존 list_tickets 와 동일하게 적용.
  즉, 내 할당 티켓이라도 스코프 밖이면 제외 (SYSTEM_ADMIN 은 전권).
- 개별 티켓의 상세/전이는 기존 `/api/ws/{wid}/tickets/...` 로 수행.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.models.enums import LoopStage, RequestServiceType
from app.schemas.ticket import TicketListResponse, TicketOut
from app.services import ticket_service

router = APIRouter(prefix="/api/my-work", tags=["my-work"])


@router.get("/tickets", response_model=TicketListResponse)
async def list_my_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stage: LoopStage | None = Query(None),
    service_type: RequestServiceType | None = Query(None),
    customer_id: str | None = Query(None),
    product_id: str | None = Query(None),
    workspace_id: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TicketListResponse:
    rows, total = ticket_service.list_tickets_cross_workspace(
        db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        stage=stage,
        owner_id=current_user.id,
        service_type=service_type,
        customer_id=customer_id,
        product_id=product_id,
        workspace_id=workspace_id,
    )
    items: list[TicketOut] = []
    for ticket, ws_name in rows:
        out = TicketOut.model_validate(ticket)
        out.workspace_name = ws_name
        items.append(out)
    return TicketListResponse(items=items, total=total, page=page, page_size=page_size)
