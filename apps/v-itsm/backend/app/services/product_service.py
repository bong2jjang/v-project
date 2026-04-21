"""Product CRUD — 설계 §4.1.10."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


def _new_ulid() -> str:
    return str(ULID())


def create_product(db: Session, payload: ProductCreate) -> Product:
    row = Product(
        id=_new_ulid(),
        code=payload.code,
        name=payload.name,
        description=payload.description,
        active=payload.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_product(db: Session, product_id: str) -> Product | None:
    return db.get(Product, product_id)


def list_products(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    active: bool | None = None,
    search: str | None = None,
) -> tuple[list[Product], int]:
    stmt = select(Product).order_by(Product.name.asc())
    count_stmt = select(func.count()).select_from(Product)
    if active is not None:
        stmt = stmt.where(Product.active.is_(active))
        count_stmt = count_stmt.where(Product.active.is_(active))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where((Product.name.ilike(pattern)) | (Product.code.ilike(pattern)))
        count_stmt = count_stmt.where(
            (Product.name.ilike(pattern)) | (Product.code.ilike(pattern))
        )

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    items = db.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return list(items), int(total)


def update_product(db: Session, product: Product, payload: ProductUpdate) -> Product:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()
