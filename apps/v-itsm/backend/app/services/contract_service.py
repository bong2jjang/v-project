"""Contract / ContractProduct CRUD — 설계 §4.1.12·§4.1.13.

계약 생성/수정 시 product_ids 로 contract_product 연계를 동시에 처리한다.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.contract import Contract, ContractProduct
from app.schemas.contract import ContractCreate, ContractUpdate


def _new_ulid() -> str:
    return str(ULID())


def _replace_products(db: Session, contract_id: str, product_ids: list[str]) -> None:
    """계약의 제품 연결을 전량 교체 (차분 동기화 대신 단순 재작성)."""
    db.execute(
        ContractProduct.__table__.delete().where(
            ContractProduct.contract_id == contract_id
        )
    )
    for pid in product_ids:
        db.add(ContractProduct(contract_id=contract_id, product_id=pid))


def get_product_ids(db: Session, contract_id: str) -> list[str]:
    stmt = select(ContractProduct.product_id).where(
        ContractProduct.contract_id == contract_id
    )
    return [row for row in db.execute(stmt).scalars().all()]


def create_contract(
    db: Session, payload: ContractCreate, *, workspace_id: str
) -> Contract:
    row = Contract(
        id=_new_ulid(),
        workspace_id=workspace_id,
        contract_no=payload.contract_no,
        customer_id=payload.customer_id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        sla_tier_id=payload.sla_tier_id,
        status=payload.status.value,
        notes=payload.notes,
    )
    db.add(row)
    db.flush()
    if payload.product_ids:
        _replace_products(db, row.id, payload.product_ids)
    db.commit()
    db.refresh(row)
    return row


def get_contract(db: Session, contract_id: str) -> Contract | None:
    return db.get(Contract, contract_id)


def list_contracts(
    db: Session,
    *,
    workspace_id: str,
    page: int = 1,
    page_size: int = 20,
    customer_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Contract], int]:
    base = Contract.workspace_id == workspace_id
    stmt = select(Contract).where(base).order_by(Contract.created_at.desc())
    count_stmt = select(func.count()).select_from(Contract).where(base)
    if customer_id:
        stmt = stmt.where(Contract.customer_id == customer_id)
        count_stmt = count_stmt.where(Contract.customer_id == customer_id)
    if status:
        stmt = stmt.where(Contract.status == status)
        count_stmt = count_stmt.where(Contract.status == status)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            (Contract.name.ilike(pattern)) | (Contract.contract_no.ilike(pattern))
        )
        count_stmt = count_stmt.where(
            (Contract.name.ilike(pattern)) | (Contract.contract_no.ilike(pattern))
        )

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    items = db.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return list(items), int(total)


def update_contract(
    db: Session, contract: Contract, payload: ContractUpdate
) -> Contract:
    data = payload.model_dump(exclude_unset=True)
    product_ids = data.pop("product_ids", None)
    for field, value in data.items():
        if field == "status" and value is not None:
            setattr(contract, field, value.value)
        else:
            setattr(contract, field, value)
    if product_ids is not None:
        _replace_products(db, contract.id, product_ids)
    db.commit()
    db.refresh(contract)
    return contract


def delete_contract(db: Session, contract: Contract) -> None:
    db.delete(contract)
    db.commit()
