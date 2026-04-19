"""ui_builder_dashboard_widgets — 대시보드에 고정된 단일 카드.

채팅 메시지의 `ui_calls[].props` 를 복제해 독립적으로 보관하고,
그리드 좌표(grid_x/y/w/h) 를 함께 저장한다. `invoke_action` 은 이 위젯의
`call_id` 로 target=widget 분기 후 자신의 `props` 를 갱신한다.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from v_platform.models.base import Base


class UIBuilderDashboardWidget(Base):
    __tablename__ = "ui_builder_dashboard_widgets"
    __table_args__ = (
        UniqueConstraint(
            "dashboard_id", "call_id", name="uq_ui_builder_widget_call_id"
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    dashboard_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ui_builder_dashboards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    call_id = Column(String(64), nullable=False)
    tool = Column(String(100), nullable=False)
    component = Column(String(100), nullable=False)
    props = Column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        default=dict,
    )
    source_message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ui_builder_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_call_id = Column(String(64), nullable=True)

    grid_x = Column(Integer, nullable=False, default=0)
    grid_y = Column(Integer, nullable=False, default=0)
    grid_w = Column(Integer, nullable=False, default=6)
    grid_h = Column(Integer, nullable=False, default=4)

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

    dashboard = relationship("UIBuilderDashboard", back_populates="widgets")
