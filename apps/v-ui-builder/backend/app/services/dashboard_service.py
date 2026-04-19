"""DashboardService — 프로젝트 대시보드 + 위젯(Pin) CRUD.

- 프로젝트당 대시보드는 1개(UniqueConstraint). 없으면 ensure 로 즉시 생성.
- Pin 드롭: `(dashboard_id, call_id)` UNIQUE → 동일 카드 중복 고정 방지.
- 기본 grid 배치: 세로로 쌓기(x=0, w=6, h=4, y=max_y+max_h).
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    UIBuilderDashboard,
    UIBuilderDashboardWidget,
)
from app.schemas.dashboard import (
    WidgetCreate,
    WidgetLayoutBulkUpdate,
    WidgetManualCreate,
    WidgetUpdate,
)
from app.services.project_service import ProjectService
from app.ui_tools import registry as ui_tool_registry


DEFAULT_GRID_W = 6
DEFAULT_GRID_H = 4


def _to_naive_utc(dt: datetime) -> datetime:
    """SQLAlchemy 가 반환하는 datetime 은 tz-aware 일 수도 naive 일 수도 있다.
    비교를 위해 UTC naive 로 통일."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


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
            source=data.source,
            category=data.category,
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

    def create_manual_widget(
        self,
        dashboard_id: UUID,
        user_id: int,
        data: WidgetManualCreate,
    ) -> UIBuilderDashboardWidget:
        """팔레트에서 수동 추가 — tool 이름만 주면 서버가 default_args/grid/component 채움."""
        self._load_owned(dashboard_id, user_id)

        try:
            tool = ui_tool_registry.get(data.tool)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"unknown tool: {data.tool}",
            )
        if not tool.category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"tool not available in palette: {data.tool}",
            )

        props = dict(data.props if data.props is not None else (tool.default_args or {}))
        # Pydantic 검증으로 기본 필드 채움 (missing 필수값은 여기서 422 유발)
        try:
            validated = tool.Params.model_validate(props)
            props = validated.model_dump()
        except Exception as exc:  # noqa: BLE001 — Pydantic ValidationError 포함
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"invalid default props for {data.tool}: {exc}",
            )

        default_grid = tool.default_grid or {"w": DEFAULT_GRID_W, "h": DEFAULT_GRID_H}
        grid_w = data.grid_w or default_grid.get("w", DEFAULT_GRID_W)
        grid_h = data.grid_h or default_grid.get("h", DEFAULT_GRID_H)
        grid_x = data.grid_x if data.grid_x is not None else 0
        grid_y = (
            data.grid_y
            if data.grid_y is not None
            else self._next_row_origin(dashboard_id)
        )

        call_id = f"manual-{uuid4().hex[:16]}"
        component = tool.component or tool.name

        widget = UIBuilderDashboardWidget(
            dashboard_id=dashboard_id,
            call_id=call_id,
            tool=tool.name,
            component=component,
            props=props,
            source_message_id=None,
            source_call_id=None,
            source="manual",
            category=tool.category,
            grid_x=grid_x,
            grid_y=grid_y,
            grid_w=grid_w,
            grid_h=grid_h,
        )
        self.db.add(widget)
        self.db.commit()
        self.db.refresh(widget)
        return widget

    def update_widget(
        self,
        dashboard_id: UUID,
        widget_id: UUID,
        user_id: int,
        data: WidgetUpdate,
    ) -> UIBuilderDashboardWidget:
        """Inspector 편집 — props/grid 변경. `expected_updated_at` 로 낙관적 잠금."""
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

        if data.expected_updated_at is not None:
            expected = _to_naive_utc(data.expected_updated_at)
            current = _to_naive_utc(widget.updated_at)
            if expected != current:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "detail": "widget was modified by another editor",
                        "code": "widget_conflict",
                    },
                )

        if data.props is not None:
            # Inspector 에서 서버 스키마로 2차 검증 — 잘못된 값이 서버에 못 들어가게.
            tool = (
                ui_tool_registry.get(widget.tool)
                if ui_tool_registry.has(widget.tool)
                else None
            )
            props = data.props
            if tool is not None:
                try:
                    props = tool.Params.model_validate(data.props).model_dump()
                except Exception as exc:  # noqa: BLE001
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"invalid props for {widget.tool}: {exc}",
                    )
            widget.props = props

        if data.grid_x is not None:
            widget.grid_x = data.grid_x
        if data.grid_y is not None:
            widget.grid_y = data.grid_y
        if data.grid_w is not None:
            widget.grid_w = data.grid_w
        if data.grid_h is not None:
            widget.grid_h = data.grid_h

        widget.updated_at = datetime.now(timezone.utc)
        self.db.commit()
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
