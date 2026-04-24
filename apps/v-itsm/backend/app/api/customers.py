"""v-itsm 고객사 / 고객 담당자 API — 설계 §4.1.8·§4.1.9.

엔드포인트:
  GET    /api/ws/{wid}/customers                        - 목록 (검색/필터)
  POST   /api/ws/{wid}/customers                        - 생성 (SYSTEM_ADMIN)
  GET    /api/ws/{wid}/customers/{id}                   - 단건
  PATCH  /api/ws/{wid}/customers/{id}                   - 수정 (SYSTEM_ADMIN)
  DELETE /api/ws/{wid}/customers/{id}                   - 삭제 (SYSTEM_ADMIN)
  GET    /api/ws/{wid}/customers/{id}/contacts          - 담당자 목록
  POST   /api/ws/{wid}/customers/{id}/contacts          - 담당자 생성 (SYSTEM_ADMIN)
  PATCH  /api/ws/{wid}/customers/contacts/{contact_id}  - 담당자 수정 (SYSTEM_ADMIN)
  DELETE /api/ws/{wid}/customers/contacts/{contact_id}  - 담당자 삭제 (SYSTEM_ADMIN)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.deps.workspace import get_current_workspace
from app.models.workspace import Workspace
from app.schemas.customer import (
    CustomerContactCreate,
    CustomerContactOut,
    CustomerContactUpdate,
    CustomerCreate,
    CustomerListResponse,
    CustomerOut,
    CustomerUpdate,
)
from app.services import customer_service

router = APIRouter(prefix="/api/ws/{workspace_id}/customers", tags=["customers"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


# ─── Customer ────────────────────────────────────────────────
@router.get("", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CustomerListResponse:
    items, total = customer_service.list_customers(
        db,
        workspace_id=workspace.id,
        page=page,
        page_size=page_size,
        service_type=service_type,
        status=status_filter,
        search=search,
    )
    return CustomerListResponse(
        items=[CustomerOut.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CustomerOut:
    _require_admin(current_user)
    customer = customer_service.create_customer(db, payload, workspace_id=workspace.id)
    return CustomerOut.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CustomerOut:
    customer = customer_service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    return CustomerOut.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CustomerOut:
    _require_admin(current_user)
    customer = customer_service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    updated = customer_service.update_customer(db, customer, payload)
    return CustomerOut.model_validate(updated)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> None:
    _require_admin(current_user)
    customer = customer_service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    customer_service.delete_customer(db, customer)


# ─── CustomerContact ─────────────────────────────────────────
@router.get("/{customer_id}/contacts", response_model=list[CustomerContactOut])
async def list_contacts(
    customer_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> list[CustomerContactOut]:
    if not customer_service.get_customer(db, customer_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    items = customer_service.list_contacts(db, customer_id)
    return [CustomerContactOut.model_validate(c) for c in items]


@router.post(
    "/{customer_id}/contacts",
    response_model=CustomerContactOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    customer_id: str,
    payload: CustomerContactCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CustomerContactOut:
    _require_admin(current_user)
    if not customer_service.get_customer(db, customer_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "customer not found")
    contact = customer_service.create_contact(db, customer_id, payload)
    return CustomerContactOut.model_validate(contact)


@router.patch("/contacts/{contact_id}", response_model=CustomerContactOut)
async def update_contact(
    contact_id: str,
    payload: CustomerContactUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> CustomerContactOut:
    _require_admin(current_user)
    contact = customer_service.get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contact not found")
    updated = customer_service.update_contact(db, contact, payload)
    return CustomerContactOut.model_validate(updated)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
) -> None:
    _require_admin(current_user)
    contact = customer_service.get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contact not found")
    customer_service.delete_contact(db, contact)
