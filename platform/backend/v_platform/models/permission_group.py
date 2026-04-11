"""
Permission Group Models

권한(역할) 그룹, 그룹별 메뉴 권한, 사용자↔그룹 매핑
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from v_platform.models.base import Base


class PermissionGroup(Base):
    __tablename__ = "permission_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    app_id = Column(String(50), nullable=True, index=True)  # NULL = platform common
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    grants = relationship(
        "PermissionGroupGrant",
        back_populates="group",
        cascade="all, delete-orphan",
    )
    memberships = relationship(
        "UserGroupMembership",
        back_populates="group",
        cascade="all, delete-orphan",
    )
    creator = relationship("User", foreign_keys=[created_by])


class PermissionGroupGrant(Base):
    __tablename__ = "permission_group_grants"
    __table_args__ = (
        UniqueConstraint("permission_group_id", "menu_item_id", name="uq_group_menu"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    permission_group_id = Column(
        Integer,
        ForeignKey("permission_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    menu_item_id = Column(
        Integer,
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    access_level = Column(String(10), nullable=False, default="none")

    # Relationships
    group = relationship("PermissionGroup", back_populates="grants")
    menu_item = relationship("MenuItem")


class UserGroupMembership(Base):
    __tablename__ = "user_group_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "permission_group_id", name="uq_user_group"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    permission_group_id = Column(
        Integer,
        ForeignKey("permission_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship(
        "User", foreign_keys=[user_id], back_populates="group_memberships"
    )
    group = relationship("PermissionGroup", back_populates="memberships")
    assigner = relationship("User", foreign_keys=[assigned_by])
