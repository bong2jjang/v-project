"""v-itsm 관리자 통합 업무 조회 API — 설계 §3.5.2 (v0.6).

전 워크스페이스를 대상으로 "내가 관리하는 제품"의 티켓을 통합 조회한다.
- SYSTEM_ADMIN: 전체 WS/고객/제품의 티켓을 제한 없이 조회.
- 일반 사용자: ScopeGrant 기반 ACL 이 자동 적용되어 권한 있는 제품/고객의 티켓만 반환.
  (팀 관리자는 ScopeGrant 로 자신이 관리하는 제품/고객에 WRITE 를 보유하는 전제)
- owner_id 필터는 제공하지 않음 — "내 업무"가 아니라 "내가 관리하는 업무" 관점이므로,
  할당되지 않은 티켓, 타인에게 할당된 티켓 모두 포함되어야 함.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.models.enums import LoopStage, RequestServiceType
from app.schemas.ticket import TicketListResponse, TicketOut
from app.services import access_control, ticket_service

router = APIRouter(prefix="/api/admin/all-work", tags=["admin-all-work"])


@router.get("/tickets", response_model=TicketListResponse)
async def list_all_work_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stage: LoopStage | None = Query(None),
    owner_id: int | None = Query(None),
    service_type: RequestServiceType | None = Query(None),
    customer_id: str | None = Query(None),
    product_id: str | None = Query(None),
    workspace_id: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TicketListResponse:
    # SYSTEM_ADMIN 이 아니면서 스코프가 전혀 없으면 403 — 관리자 기능임을 명확히.
    if current_user.role != UserRole.SYSTEM_ADMIN:
        scope = access_control.get_user_scope(db, current_user)
        if not scope.has_any_access:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "관리자 통합 조회 권한이 없습니다 (ScopeGrant 미보유).",
            )

    rows, total = ticket_service.list_tickets_cross_workspace(
        db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        stage=stage,
        owner_id=owner_id,
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
