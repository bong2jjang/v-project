"""PortalApp — DB-backed registered app model for the portal."""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
)
from v_platform.models.base import Base


class PortalApp(Base):
    __tablename__ = "portal_apps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_id = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    icon = Column(String(50), default="Box")  # Lucide icon name
    frontend_url = Column(String(500), nullable=False)
    api_url = Column(String(500), nullable=False)
    health_endpoint = Column(String(200), default="/api/health")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
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
