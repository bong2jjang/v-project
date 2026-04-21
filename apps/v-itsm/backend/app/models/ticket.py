"""itsm_ticket — Loop 단위 요청 엔티티."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from v_platform.models.base import Base


class Ticket(Base):
    __tablename__ = "itsm_ticket"
    __table_args__ = (
        Index("ix_itsm_ticket_stage", "current_stage"),
        Index("ix_itsm_ticket_priority", "priority"),
        Index("ix_itsm_ticket_owner", "current_owner_id"),
        Index("ix_itsm_ticket_opened_at", "opened_at"),
        Index("ix_itsm_ticket_service_type", "service_type"),
        Index("ix_itsm_ticket_customer", "customer_id"),
        Index("ix_itsm_ticket_product", "product_id"),
    )

    id = Column(String(26), primary_key=True)
    ticket_no = Column(String(32), unique=True, nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    source_channel = Column(String(20), nullable=False)
    source_ref = Column(String(200), nullable=True)

    priority = Column(String(20), nullable=False, default="normal")
    category_l1 = Column(String(100), nullable=True)
    category_l2 = Column(String(100), nullable=True)

    current_stage = Column(String(20), nullable=False, default="intake")

    # 요청 서비스 구분 및 고객/제품/계약 연계 (a004)
    service_type = Column(String(20), nullable=False, default="internal")
    customer_id = Column(String(26), ForeignKey("itsm_customer.id"), nullable=True)
    product_id = Column(String(26), ForeignKey("itsm_product.id"), nullable=True)
    contract_id = Column(String(26), ForeignKey("itsm_contract.id"), nullable=True)

    requester_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    current_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    sla_policy_id = Column(String(26), ForeignKey("itsm_sla_policy.id"), nullable=True)

    opened_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    closed_at = Column(DateTime(timezone=True), nullable=True)
    reopened_count = Column(Integer, nullable=False, default=0)

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
