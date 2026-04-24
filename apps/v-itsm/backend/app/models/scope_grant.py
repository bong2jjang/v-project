"""itsm_scope_grant — 권한그룹별 접근 범위(service_type/customer/product + read/write)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from v_platform.models.base import Base


class ScopeGrant(Base):
    __tablename__ = "itsm_scope_grant"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "permission_group_id",
            "service_type",
            "customer_id",
            "product_id",
            name="uq_itsm_scope_grant_ws_tuple",
        ),
        Index("ix_itsm_scope_grant_group", "permission_group_id"),
        Index("ix_itsm_scope_grant_customer", "customer_id"),
        Index("ix_itsm_scope_grant_product", "product_id"),
    )

    id = Column(String(26), primary_key=True)
    workspace_id = Column(
        String(26),
        ForeignKey("itsm_workspaces.id", ondelete="RESTRICT"),
        nullable=False,
    )
    permission_group_id = Column(
        Integer,
        ForeignKey("permission_groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    # NULL = 와일드카드(모든 값 매칭)
    service_type = Column(String(20), nullable=True)
    customer_id = Column(
        String(26),
        ForeignKey("itsm_customer.id"),
        nullable=True,
    )
    product_id = Column(
        String(26),
        ForeignKey("itsm_product.id"),
        nullable=True,
    )

    scope_level = Column(String(10), nullable=False, default="read")

    granted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

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
