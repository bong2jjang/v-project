"""v-itsm 계약 API — 설계 §4.1.12·§4.1.13.

엔드포인트:
  GET    /api/contracts        - 목록 (customer/status/search)
  POST   /api/contracts        - 생성 (SYSTEM_ADMIN) + product_ids 연계
  GET    /api/contracts/{id}   - 단건 (product_ids 포함)
  PATCH  /api/contracts/{id}   - 수정 (SYSTEM_ADMIN)
  DELETE /api/contracts/{id}   - 삭제 (SYSTEM_ADMIN)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.models.contract import Contract
from app.schemas.contract import (
    ContractCreate,
    ContractListResponse,
    ContractOut,
    ContractUpdate,
)
from app.services import contract_service

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


def _to_out(db: Session, contract: Contract) -> ContractOut:
    product_ids = contract_service.get_product_ids(db, contract.id)
    return ContractOut.model_validate(
        {
            "id": contract.id,
            "contract_no": contract.contract_no,
            "customer_id": contract.customer_id,
            "name": contract.name,
            "start_date": contract.start_date,
            "end_date": contract.end_date,
            "sla_tier_id": contract.sla_tier_id,
            "status": contract.status,
            "notes": contract.notes,
            "product_ids": product_ids,
            "created_at": contract.created_at,
            "updated_at": contract.updated_at,
        }
    )


@router.get("", response_model=ContractListResponse)
async def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    customer_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ContractListResponse:
    items, total = contract_service.list_contracts(
        db,
        page=page,
        page_size=page_size,
        customer_id=customer_id,
        status=status_filter,
        search=search,
    )
    return ContractListResponse(
        items=[_to_out(db, c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ContractOut:
    _require_admin(current_user)
    contract = contract_service.create_contract(db, payload)
    return _to_out(db, contract)


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(
    contract_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ContractOut:
    contract = contract_service.get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    return _to_out(db, contract)


@router.patch("/{contract_id}", response_model=ContractOut)
async def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ContractOut:
    _require_admin(current_user)
    contract = contract_service.get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    updated = contract_service.update_contract(db, contract, payload)
    return _to_out(db, updated)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_admin(current_user)
    contract = contract_service.get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "contract not found")
    contract_service.delete_contract(db, contract)
