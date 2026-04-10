"""
UserPermission Model

사용자별 메뉴 권한 (none / read / write)
"""

from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.models.message import Base


class AccessLevel(str, Enum):
    """권한 수준"""

    NONE = "none"
    READ = "read"
    WRITE = "write"


# 권한 수준 비교용 숫자 매핑
ACCESS_LEVEL_ORDER = {"none": 0, "read": 1, "write": 2}


class UserPermission(Base):
    """사용자별 메뉴 권한 테이블"""

    __tablename__ = "user_permissions"
    __table_args__ = (UniqueConstraint("user_id", "menu_item_id", name="uq_user_menu"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id = Column(
        Integer,
        ForeignKey("menu_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    access_level = Column(String(10), nullable=False, default="none")
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
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
    user = relationship("User", back_populates="permissions", foreign_keys=[user_id])
    menu_item = relationship("MenuItem", back_populates="permissions")
    grantor = relationship("User", foreign_keys=[granted_by])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "menu_item_id": self.menu_item_id,
            "permission_key": self.menu_item.permission_key if self.menu_item else None,
            "access_level": self.access_level,
            "granted_by": self.granted_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return (
            f"<UserPermission(user={self.user_id}, "
            f"menu={self.menu_item_id}, level={self.access_level})>"
        )
