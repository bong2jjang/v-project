"""v-itsm SLA 알림 정책 API (관리자) — 설계 §7.2.

warning / breach 이벤트별로 notify_channels, notify_assignee 등 수신 대상을
DB 에서 관리한다. 실제 발송은 notification_service 가 resolve_for_event 로 조회.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.enums import Priority, RequestServiceType
from app.models.workspace import Workspace
from app.schemas.sla_notification_policy import (
    SLANotificationPolicyCreate,
    SLANotificationPolicyListResponse,
    SLANotificationPolicyOut,
    SLANotificationPolicyUpdate,
)
from app.services import sla_notification_policy_service

router = APIRouter(
    prefix="/api/ws/{workspace_id}/sla-notification-policies",
    tags=["sla-notification-policies"],
)


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("", response_model=SLANotificationPolicyListResponse)
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    trigger_event: str | None = Query(None, pattern="^(warning|breach)$"),
    priority: Priority | None = Query(None),
    service_type: RequestServiceType | None = Query(None),
    active_only: bool = Query(False),
    search: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLANotificationPolicyListResponse:
    _require_admin(current_user)
    items, total = sla_notification_policy_service.list_policies(
        db,
        workspace_id=workspace.id,
        page=page,
        page_size=page_size,
        trigger_event=trigger_event,
        priority=priority,
        service_type=service_type,
        active_only=active_only,
        search=search,
    )
    return SLANotificationPolicyListResponse(
        items=[SLANotificationPolicyOut.model_validate(p) for p in items],
        total=total,
    )


@router.post(
    "",
    response_model=SLANotificationPolicyOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_policy(
    payload: SLANotificationPolicyCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLANotificationPolicyOut:
    _require_admin(current_user)
    policy = sla_notification_policy_service.create_policy(
        db, payload, workspace_id=workspace.id
    )
    return SLANotificationPolicyOut.model_validate(policy)


@router.get("/{policy_id}", response_model=SLANotificationPolicyOut)
async def get_policy(
    policy_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLANotificationPolicyOut:
    _require_admin(current_user)
    policy = sla_notification_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "sla notification policy not found"
        )
    return SLANotificationPolicyOut.model_validate(policy)


@router.patch("/{policy_id}", response_model=SLANotificationPolicyOut)
async def update_policy(
    policy_id: str,
    payload: SLANotificationPolicyUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> SLANotificationPolicyOut:
    _require_admin(current_user)
    policy = sla_notification_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "sla notification policy not found"
        )
    updated = sla_notification_policy_service.update_policy(db, policy, payload)
    return SLANotificationPolicyOut.model_validate(updated)


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> None:
    _require_admin(current_user)
    policy = sla_notification_policy_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "sla notification policy not found"
        )
    sla_notification_policy_service.delete_policy(db, policy)
