"""v-itsm 스코프 권한 API — 설계 §4.1.14·§4.3.

엔드포인트:
  GET    /api/scope-grants/my    - 현재 사용자 스코프 요약 (인증만)
  GET    /api/scope-grants       - 목록 (SYSTEM_ADMIN)
  POST   /api/scope-grants       - 부여 (SYSTEM_ADMIN)
  GET    /api/scope-grants/{id}  - 단건 (SYSTEM_ADMIN)
  PATCH  /api/scope-grants/{id}  - 수정 (SYSTEM_ADMIN)
  DELETE /api/scope-grants/{id}  - 회수 (SYSTEM_ADMIN)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.schemas.scope_grant import (
    ScopeGrantCreate,
    ScopeGrantListResponse,
    ScopeGrantOut,
    ScopeGrantUpdate,
    UserScopeSummaryOut,
)
from app.services import access_control, scope_grant_service

router = APIRouter(prefix="/api/scope-grants", tags=["scope-grants"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


# ─── 본인 스코프 요약 ─────────────────────────────────────────
@router.get("/my", response_model=UserScopeSummaryOut)
async def my_scope(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> UserScopeSummaryOut:
    scope = access_control.get_user_scope(db, current_user)
    return UserScopeSummaryOut.model_validate(access_control.summarize_scope(scope))


# ─── Admin 관리 ──────────────────────────────────────────────
@router.get("", response_model=ScopeGrantListResponse)
async def list_grants(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    permission_group_id: int | None = Query(None),
    customer_id: str | None = Query(None),
    product_id: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScopeGrantListResponse:
    _require_admin(current_user)
    items, total = scope_grant_service.list_grants(
        db,
        page=page,
        page_size=page_size,
        permission_group_id=permission_group_id,
        customer_id=customer_id,
        product_id=product_id,
    )
    return ScopeGrantListResponse(
        items=[ScopeGrantOut.model_validate(g) for g in items],
        total=total,
    )


@router.post("", response_model=ScopeGrantOut, status_code=status.HTTP_201_CREATED)
async def create_grant(
    payload: ScopeGrantCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScopeGrantOut:
    _require_admin(current_user)
    grant = scope_grant_service.create_grant(db, payload, granted_by=current_user.id)
    return ScopeGrantOut.model_validate(grant)


@router.get("/{grant_id}", response_model=ScopeGrantOut)
async def get_grant(
    grant_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScopeGrantOut:
    _require_admin(current_user)
    grant = scope_grant_service.get_grant(db, grant_id)
    if not grant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "scope grant not found")
    return ScopeGrantOut.model_validate(grant)


@router.patch("/{grant_id}", response_model=ScopeGrantOut)
async def update_grant(
    grant_id: str,
    payload: ScopeGrantUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ScopeGrantOut:
    _require_admin(current_user)
    grant = scope_grant_service.get_grant(db, grant_id)
    if not grant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "scope grant not found")
    updated = scope_grant_service.update_grant(db, grant, payload)
    return ScopeGrantOut.model_validate(updated)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grant(
    grant_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_admin(current_user)
    grant = scope_grant_service.get_grant(db, grant_id)
    if not grant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "scope grant not found")
    scope_grant_service.delete_grant(db, grant)
