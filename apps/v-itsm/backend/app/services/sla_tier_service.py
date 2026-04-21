"""SLATier CRUD — 설계 §4.1.11·§6."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.sla_tier import SLATier
from app.schemas.sla_tier import SLATierCreate, SLATierUpdate


def _new_ulid() -> str:
    return str(ULID())


def create_tier(db: Session, payload: SLATierCreate) -> SLATier:
    row = SLATier(
        id=_new_ulid(),
        code=payload.code,
        name=payload.name,
        description=payload.description,
        priority_matrix=payload.priority_matrix,
        business_hours=payload.business_hours,
        active=payload.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_tier(db: Session, tier_id: str) -> SLATier | None:
    return db.get(SLATier, tier_id)


def get_tier_by_code(db: Session, code: str) -> SLATier | None:
    stmt = select(SLATier).where(SLATier.code == code)
    return db.execute(stmt).scalar_one_or_none()


def list_tiers(db: Session, *, active_only: bool = False) -> list[SLATier]:
    stmt = select(SLATier).order_by(SLATier.code.asc())
    if active_only:
        stmt = stmt.where(SLATier.active.is_(True))
    return list(db.execute(stmt).scalars().all())


def update_tier(db: Session, tier: SLATier, payload: SLATierUpdate) -> SLATier:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(tier, field, value)
    db.commit()
    db.refresh(tier)
    return tier


def delete_tier(db: Session, tier: SLATier) -> None:
    db.delete(tier)
    db.commit()
