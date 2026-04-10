"""
MenuItem Model

메뉴 마스터 테이블 — built_in / custom_iframe / custom_link
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from v_platform.models.base import Base


class MenuItem(Base):
    """메뉴 항목 테이블"""

    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    permission_key = Column(
        String(100), unique=True, nullable=False, index=True
    )  # 'dashboard', 'channels', 'custom:3'
    label = Column(String(200), nullable=False)
    icon = Column(String(100), nullable=True)  # Lucide 아이콘명
    path = Column(String(500), nullable=False)  # 라우트 경로
    menu_type = Column(
        String(20), nullable=False, default="built_in"
    )  # built_in | custom_iframe | custom_link
    iframe_url = Column(Text, nullable=True)
    iframe_fullscreen = Column(Boolean, default=False)
    open_in_new_tab = Column(Boolean, default=False)
    parent_key = Column(String(100), nullable=True)  # 그룹핑용
    sort_order = Column(Integer, default=0)
    section = Column(String(20), default="custom")  # basic | admin | custom
    is_active = Column(Boolean, default=True, nullable=False)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
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
    permissions = relationship(
        "UserPermission", back_populates="menu_item", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "permission_key": self.permission_key,
            "label": self.label,
            "icon": self.icon,
            "path": self.path,
            "menu_type": self.menu_type,
            "iframe_url": self.iframe_url,
            "iframe_fullscreen": self.iframe_fullscreen,
            "open_in_new_tab": self.open_in_new_tab,
            "parent_key": self.parent_key,
            "sort_order": self.sort_order,
            "section": self.section,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<MenuItem(id={self.id}, key={self.permission_key}, type={self.menu_type})>"
