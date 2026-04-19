"""DashboardService — 프로젝트 대시보드 + 위젯(Pin) CRUD.

- 프로젝트당 대시보드는 1개(UniqueConstraint). 없으면 ensure 로 즉시 생성.
- Pin 드롭: `(dashboard_id, call_id)` UNIQUE → 동일 카드 중복 고정 방지.
- 기본 grid 배치: 세로로 쌓기(x=0, w=6, h=4, y=max_y+max_h).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    UIBuilderDashboard,
    UIBuilderDashboardWidget,
)
from app.schemas.dashboard import WidgetCreate, WidgetLayoutBulkUpdate
from app.services.project_service import ProjectService


DEFAULT_GRID_W = 6
DEFAULT_GRID_H = 4


class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectService(db)

    def get_for_project(
        self, project_id: UUID, user_id: int
    ) -> UIBuilderDashboard:
        """프로젝트의 대시보드 반환(없으면 생성 보장). 소유권 + genui 타입 검사."""
        return self.projects.ensure_dashboard(
            project_id, user_id, expected_type="genui"
        )

    def _load_owned(
        self, dashboard_id: UUID, user_id: int
    ) -> UIBuilderDashboard:
        dashboard = (
            self.db.query(UIBuilderDashboard)
            .filter(UIBuilderDashboard.id == dashboard_id)
            .first()
        )
        if dashboard is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="dashboard not found"
            )
        self.projects.get_owned(
            dashboard.project_id, user_id, expected_type="genui"
        )
        return dashboard

    def get_owned(
        self, dashboard_id: UUID, user_id: int
    ) -> UIBuilderDashboard:
        return self._load_owned(dashboard_id, user_id)

    def list_widgets(
        self, dashboard_id: UUID, user_id: int
    ) -> list[UIBuilderDashboardWidget]:
        self._load_owned(dashboard_id, user_id)
        return (
            self.db.query(UIBuilderDashboardWidget)
            .filter(UIBuilderDashboardWidget.dashboard_id == dashboard_id)
            .order_by(UIBuilderDashboardWidget.created_at.asc())
            .all()
        )

    def _next_row_origin(self, dashboard_id: UUID) -> int:
        """세로로 쌓기 위해 현재 위젯의 (grid_y + grid_h) 최대값을 반환."""
        rows = (
            self.db.query(UIBuilderDashboardWidget)
            .filter(UIBuilderDashboardWidget.dashboard_id == dashboard_id)
            .all()
        )
        if not rows:
            return 0
        return max((w.grid_y + w.grid_h) for w in rows)

    def create_widget(
        self,
        dashboard_id: UUID,
        user_id: int,
        data: WidgetCreate,
    ) -> UIBuilderDashboardWidget:
        self._load_owned(dashboard_id, user_id)

        existing = (
            self.db.query(UIBuilderDashboardWidget)
            .filter(
                UIBuilderDashboardWidget.dashboard_id == dashboard_id,
                UIBuilderDashboardWidget.call_id == data.call_id,
            )
            .first()
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="widget already pinned",
            )

        grid_w = data.grid_w or DEFAULT_GRID_W
        grid_h = data.grid_h or DEFAULT_GRID_H
        grid_x = data.grid_x if data.grid_x is not None else 0
        grid_y = (
            data.grid_y
            if data.grid_y is not None
            else self._next_row_origin(dashboard_id)
        )

        widget = UIBuilderDashboardWidget(
            dashboard_id=dashboard_id,
            call_id=data.call_id,
            tool=data.tool,
            component=data.component,
            props=data.props,
            source_message_id=data.source_message_id,
            source_call_id=data.source_call_id,
            grid_x=grid_x,
            grid_y=grid_y,
            grid_w=grid_w,
            grid_h=grid_h,
        )
        self.db.add(widget)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="widget already pinned",
            )
        self.db.refresh(widget)
        return widget

    def delete_widget(
        self, dashboard_id: UUID, widget_id: UUID, user_id: int
    ) -> None:
        self._load_owned(dashboard_id, user_id)
        widget = (
            self.db.query(UIBuilderDashboardWidget)
            .filter(
                UIBuilderDashboardWidget.id == widget_id,
                UIBuilderDashboardWidget.dashboard_id == dashboard_id,
            )
            .first()
        )
        if widget is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="widget not found"
            )
        self.db.delete(widget)
        self.db.commit()

    def update_layout_bulk(
        self,
        dashboard_id: UUID,
        user_id: int,
        data: WidgetLayoutBulkUpdate,
    ) -> list[UIBuilderDashboardWidget]:
        """P3.2 용: 드래그/리사이즈 종료 시 배열 전체를 한 번에 저장."""
        self._load_owned(dashboard_id, user_id)
        ids = [item.id for item in data.items]
        rows = {
            w.id: w
            for w in self.db.query(UIBuilderDashboardWidget)
            .filter(
                UIBuilderDashboardWidget.dashboard_id == dashboard_id,
                UIBuilderDashboardWidget.id.in_(ids),
            )
            .all()
        }
        for item in data.items:
            w = rows.get(item.id)
            if w is None:
                continue
            w.grid_x = item.grid_x
            w.grid_y = item.grid_y
            w.grid_w = item.grid_w
            w.grid_h = item.grid_h
        self.db.commit()
        return list(rows.values())
