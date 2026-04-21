"""v-itsm SLA 티어 API — 설계 §4.1.11·§6.

엔드포인트:
  GET    /api/sla-tiers         - 목록 (active_only 옵션)
  POST   /api/sla-tiers         - 생성 (SYSTEM_ADMIN)
  GET    /api/sla-tiers/{id}    - 단건
  PATCH  /api/sla-tiers/{id}    - 수정 (SYSTEM_ADMIN)
  DELETE /api/sla-tiers/{id}    - 삭제 (SYSTEM_ADMIN)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.schemas.sla_tier import (
    SLATierCreate,
    SLATierListResponse,
    SLATierOut,
    SLATierUpdate,
)
from app.services import sla_tier_service

router = APIRouter(prefix="/api/sla-tiers", tags=["sla-tiers"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("", response_model=SLATierListResponse)
async def list_tiers(
    active_only: bool = Query(False),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SLATierListResponse:
    items = sla_tier_service.list_tiers(db, active_only=active_only)
    return SLATierListResponse(
        items=[SLATierOut.model_validate(t) for t in items],
        total=len(items),
    )


@router.post("", response_model=SLATierOut, status_code=status.HTTP_201_CREATED)
async def create_tier(
    payload: SLATierCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SLATierOut:
    _require_admin(current_user)
    tier = sla_tier_service.create_tier(db, payload)
    return SLATierOut.model_validate(tier)


@router.get("/{tier_id}", response_model=SLATierOut)
async def get_tier(
    tier_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SLATierOut:
    tier = sla_tier_service.get_tier(db, tier_id)
    if not tier:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla tier not found")
    return SLATierOut.model_validate(tier)


@router.patch("/{tier_id}", response_model=SLATierOut)
async def update_tier(
    tier_id: str,
    payload: SLATierUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SLATierOut:
    _require_admin(current_user)
    tier = sla_tier_service.get_tier(db, tier_id)
    if not tier:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla tier not found")
    updated = sla_tier_service.update_tier(db, tier, payload)
    return SLATierOut.model_validate(updated)


@router.delete("/{tier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tier(
    tier_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_admin(current_user)
    tier = sla_tier_service.get_tier(db, tier_id)
    if not tier:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sla tier not found")
    sla_tier_service.delete_tier(db, tier)
