"""v-itsm 제품 카탈로그 API — 설계 §4.1.10.

엔드포인트:
  GET    /api/products        - 목록 (active/search 필터)
  POST   /api/products        - 생성 (SYSTEM_ADMIN)
  GET    /api/products/{id}   - 단건
  PATCH  /api/products/{id}   - 수정 (SYSTEM_ADMIN)
  DELETE /api/products/{id}   - 삭제 (SYSTEM_ADMIN)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductOut,
    ProductUpdate,
)
from app.services import product_service

router = APIRouter(prefix="/api/products", tags=["products"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.SYSTEM_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "SYSTEM_ADMIN required")


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    active: bool | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProductListResponse:
    items, total = product_service.list_products(
        db, page=page, page_size=page_size, active=active, search=search
    )
    return ProductListResponse(
        items=[ProductOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    _require_admin(current_user)
    product = product_service.create_product(db, payload)
    return ProductOut.model_validate(product)


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    return ProductOut.model_validate(product)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    _require_admin(current_user)
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    updated = product_service.update_product(db, product, payload)
    return ProductOut.model_validate(updated)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_admin(current_user)
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    product_service.delete_product(db, product)
