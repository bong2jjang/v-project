"""itsm_customer, itsm_customer_contact — 고객사 및 담당자."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from v_platform.models.base import Base


class Customer(Base):
    __tablename__ = "itsm_customer"
    __table_args__ = (
        Index("ix_itsm_customer_service_type", "service_type"),
        Index("ix_itsm_customer_status", "status"),
    )

    id = Column(String(26), primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    service_type = Column(String(20), nullable=False)
    industry = Column(String(100), nullable=True)
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


class CustomerContact(Base):
    __tablename__ = "itsm_customer_contact"
    __table_args__ = (
        Index("ix_itsm_customer_contact_customer", "customer_id"),
    )

    id = Column(String(26), primary_key=True)
    customer_id = Column(
        String(26),
        ForeignKey("itsm_customer.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(100), nullable=False)
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    role_title = Column(String(100), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
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
