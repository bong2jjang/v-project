"""v-itsm SLA 정책 API (관리자) — 설계 §6.1 + §9.1.

SLAPolicy 는 SLATier 의 예외 오버라이드(category 단위). 변경 시 해당 정책을
쓰는 활성 티켓의 due_at 을 재계산해야 하므로 전용 POST {id}/recalculate 제공.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.enums import Priority
from app.models.workspace import Workspace
from app.schemas.sla_policy import (
    SLAPolicyCreate,
    SLAPolicyListResponse,
    SLAPolicyOut,
    SLAPolicyUpdate,
    SLARecalcResult,
)
from app.services import sla_policy_service, sla_timer

router = APIRouter(prefix="/api/ws/{workspace_id}/sla-policies", tags=["sla-policies"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("", response_model=SLAPolicyListResponse)
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    priority: Priority | None = Query(None),
    category: str | None = Query(None),
    active_only: bool = Query(False),
    search: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLAPolicyListResponse:
    _require_admin(current_user)
    items, total = sla_policy_service.list_policies(
        db,
        workspace_id=workspace.id,
        page=page,
        page_size=page_size,
        priority=priority,
        category=category,
        active_only=active_only,
        search=search,
    )
    return SLAPolicyListResponse(
        items=[SLAPolicyOut.model_validate(p) for p in items],
        total=total,
    )


@router.post("", response_model=SLAPolicyOut, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: SLAPolicyCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLAPolicyOut:
    _require_admin(current_user)
    policy = sla_policy_service.create_policy(db, payload, workspace_id=workspace.id)
    return SLAPolicyOut.model_validate(policy)


@router.get("/{policy_id}", response_model=SLAPolicyOut)
async def get_policy(
    policy_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLAPolicyOut:
    _require_admin(current_user)
    policy = sla_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla policy not found")
    return SLAPolicyOut.model_validate(policy)


@router.patch("/{policy_id}", response_model=SLAPolicyOut)
async def update_policy(
    policy_id: str,
    payload: SLAPolicyUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLAPolicyOut:
    _require_admin(current_user)
    policy = sla_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla policy not found")
    updated = sla_policy_service.update_policy(db, policy, payload)
    return SLAPolicyOut.model_validate(updated)


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> None:
    _require_admin(current_user)
    policy = sla_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla policy not found")
    sla_policy_service.delete_policy(db, policy)


@router.post("/{policy_id}/recalculate", response_model=SLARecalcResult)
async def recalculate_policy(
    policy_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLARecalcResult:
    _require_admin(current_user)
    policy = sla_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla policy not found")
    result = sla_timer.recalculate_active_timers(db, only_policy_id=policy_id)
    return SLARecalcResult(**result)
