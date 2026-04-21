"""Customer / CustomerContact CRUD — 설계 §4.1.8·§4.1.9."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.customer import Customer, CustomerContact
from app.schemas.customer import (
    CustomerContactCreate,
    CustomerContactUpdate,
    CustomerCreate,
    CustomerUpdate,
)


def _new_ulid() -> str:
    return str(ULID())


# ─── Customer ────────────────────────────────────────────────
def create_customer(db: Session, payload: CustomerCreate) -> Customer:
    row = Customer(
        id=_new_ulid(),
        code=payload.code,
        name=payload.name,
        service_type=payload.service_type.value,
        industry=payload.industry,
        status=payload.status.value,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_customer(db: Session, customer_id: str) -> Customer | None:
    return db.get(Customer, customer_id)


def list_customers(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    service_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Customer], int]:
    stmt = select(Customer).order_by(Customer.name.asc())
    count_stmt = select(func.count()).select_from(Customer)
    if service_type:
        stmt = stmt.where(Customer.service_type == service_type)
        count_stmt = count_stmt.where(Customer.service_type == service_type)
    if status:
        stmt = stmt.where(Customer.status == status)
        count_stmt = count_stmt.where(Customer.status == status)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where((Customer.name.ilike(pattern)) | (Customer.code.ilike(pattern)))
        count_stmt = count_stmt.where(
            (Customer.name.ilike(pattern)) | (Customer.code.ilike(pattern))
        )

    total = db.execute(count_stmt).scalar_one()
    offset = max(0, (page - 1) * page_size)
    items = db.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return list(items), int(total)


def update_customer(
    db: Session, customer: Customer, payload: CustomerUpdate
) -> Customer:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in {"service_type", "status"} and value is not None:
            setattr(customer, field, value.value)
        else:
            setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer: Customer) -> None:
    db.delete(customer)
    db.commit()


# ─── CustomerContact ─────────────────────────────────────────
def create_contact(
    db: Session, customer_id: str, payload: CustomerContactCreate
) -> CustomerContact:
    row = CustomerContact(
        id=_new_ulid(),
        customer_id=customer_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role_title=payload.role_title,
        is_primary=payload.is_primary,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_contact(db: Session, contact_id: str) -> CustomerContact | None:
    return db.get(CustomerContact, contact_id)


def list_contacts(db: Session, customer_id: str) -> list[CustomerContact]:
    stmt = (
        select(CustomerContact)
        .where(CustomerContact.customer_id == customer_id)
        .order_by(CustomerContact.is_primary.desc(), CustomerContact.name.asc())
    )
    return list(db.execute(stmt).scalars().all())


def update_contact(
    db: Session, contact: CustomerContact, payload: CustomerContactUpdate
) -> CustomerContact:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


def delete_contact(db: Session, contact: CustomerContact) -> None:
    db.delete(contact)
    db.commit()
