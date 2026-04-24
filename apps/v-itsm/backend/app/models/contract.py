"""itsm_contract, itsm_contract_product — 계약 및 계약-제품 다대다."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from v_platform.models.base import Base


class Contract(Base):
    __tablename__ = "itsm_contract"
    __table_args__ = (
        Index("ix_itsm_contract_customer", "customer_id"),
        Index("ix_itsm_contract_sla_tier", "sla_tier_id"),
        Index("ix_itsm_contract_status", "status"),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    contract_no = Column(String(50), unique=True, nullable=False)
    customer_id = Column(
        String(26),
        ForeignKey("itsm_customer.id"),
        nullable=False,
    )
    name = Column(String(200), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    sla_tier_id = Column(
        String(26),
        ForeignKey("itsm_sla_tier.id"),
        nullable=True,
    )
    status = Column(String(20), nullable=False, default="active")
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ContractProduct(Base):
    __tablename__ = "itsm_contract_product"

    contract_id = Column(
        String(26),
        ForeignKey("itsm_contract.id", ondelete="CASCADE"),
        primary_key=True,
    )
    product_id = Column(
        String(26),
        ForeignKey("itsm_product.id"),
        primary_key=True,
    )
