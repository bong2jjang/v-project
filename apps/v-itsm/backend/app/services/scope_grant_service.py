"""ScopeGrant CRUD — 설계 §4.1.14·§4.3."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.scope_grant import ScopeGrant
from app.schemas.scope_grant import ScopeGrantCreate, ScopeGrantUpdate


def _new_ulid() -> str:
    return str(ULID())


def create_grant(
    db: Session,
    payload: ScopeGrantCreate,
    *,
    workspace_id: str,
    granted_by: int | None = None,
) -> ScopeGrant:
    row = ScopeGrant(
        id=_new_ulid(),
        workspace_id=workspace_id,
        permission_group_id=payload.permission_group_id,
        service_type=payload.service_type.value if payload.service_type else None,
        customer_id=payload.customer_id,
        product_id=payload.product_id,
        scope_level=payload.scope_level.value,
        granted_by=granted_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_grant(db: Session, grant_id: str) -> ScopeGrant | None:
    return db.get(ScopeGrant, grant_id)


def list_grants(
    db: Session,
    *,
    workspace_id: str,
    page: int = 1,
    page_size: int = 50,
    permission_group_id: int | None = None,
    customer_id: str | None = None,
    product_id: str | None = None,
) -> tuple[list[ScopeGrant], int]:
    base = ScopeGrant.workspace_id == workspace_id
    stmt = select(ScopeGrant).where(base).order_by(ScopeGrant.created_at.desc())
    count_stmt = select(func.count()).select_from(ScopeGrant).where(base)
    if permission_group_id is not None:
        stmt = stmt.where(ScopeGrant.permission_group_id == permission_group_id)
        count_stmt = count_stmt.where(
            ScopeGrant.permission_group_id == permission_group_id
        )
    if customer_id:
        stmt = stmt.where(ScopeGrant.customer_id == customer_id)
        count_stmt = count_stmt.where(ScopeGrant.customer_id == customer_id)
    if product_id:
        stmt = stmt.where(ScopeGrant.product_id == product_id)
        count_stmt = count_stmt.where(ScopeGrant.product_id == product_id)

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    items = db.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return list(items), int(total)


def update_grant(
    db: Session, grant: ScopeGrant, payload: ScopeGrantUpdate
) -> ScopeGrant:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "service_type":
            grant.service_type = value.value if value else None
        elif field == "scope_level" and value is not None:
            grant.scope_level = value.value
        else:
            setattr(grant, field, value)
    db.commit()
    db.refresh(grant)
    return grant


def delete_grant(db: Session, grant: ScopeGrant) -> None:
    db.delete(grant)
    db.commit()
