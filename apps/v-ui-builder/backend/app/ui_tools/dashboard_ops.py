"""Dashboard Ops — 대시보드 캔버스를 직접 조작하는 LLM 도구 세트.

프로젝트 채팅(`/api/chat`)의 Generative UI 도구와는 **별도 레지스트리**로 관리한다.
- 프로젝트 채팅에서는 이 도구들이 노출되지 않아 LLM 이 의도치 않게 대시보드를
  건드리지 않는다.
- 오직 대시보드 채팅(`/api/projects/{id}/dashboard/chat`) 에서만 노출된다.

네 가지 오퍼레이션 (OpenAI function name 규칙 — dot 불가 → underscore):
- `dashboard_add_widget`    — 새 위젯 프리뷰 제안 (승인 전까지 DB 미반영)
- `dashboard_update_widget` — 기존 위젯 수정 프리뷰 제안 (승인 전까지 DB 미반영)
- `dashboard_remove_widget` — 위젯 삭제 (즉시 반영, Undo 스택으로 되돌릴 수 있음)
- `dashboard_reflow`        — 전체 레이아웃 재배치(프리셋, 즉시 반영)

Add/Update 는 DB 에 쓰지 않고 `dashboard.widget_proposed` 이벤트만 흘린다.
사용자가 ChatPane 프리뷰 카드의 "캔버스에 추가" 버튼을 눌러야 실제 API 호출
(pinWidget/updateWidget) 로 반영된다.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.models import UIBuilderDashboardWidget
from app.schemas.dashboard import WidgetRead
from app.services.dashboard_service import (
    DEFAULT_GRID_H,
    DashboardService,
)

from .base import ToolSchema, UiChunk, UiContext
from .errors import format_tool_error
from .registry import registry as ui_tool_registry


@dataclass
class DashboardOpsContext:
    """dashboard_ops 실행에 필요한 런타임 컨텍스트."""

    user_id: int
    project_id: UUID
    dashboard_id: UUID
    db: Session


class BaseDashboardOpsTool(ABC):
    """대시보드 ops 공통 베이스.

    BaseUiTool 과 다르게 UiChunk 가 아니라 `{event, data}` dict 를 yield 한다.
    LLM 에 노출할 OpenAI function-calling 스키마는 `schema()` 로 얻는다.
    """

    name: str = "base"
    description: str = ""
    Params: type[BaseModel] = BaseModel

    def schema(self) -> ToolSchema:
        return ToolSchema(
            name=self.name,
            description=self.description,
            params_schema=self.Params.model_json_schema(),
        )

    @abstractmethod
    async def execute(
        self, args: dict[str, Any], ctx: DashboardOpsContext
    ) -> AsyncIterator[dict[str, Any]]:
        raise NotImplementedError
        yield  # pragma: no cover


class _DashboardOpsRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, BaseDashboardOpsTool] = {}

    def register(self, tool: BaseDashboardOpsTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseDashboardOpsTool:
        if name not in self._tools:
            raise KeyError(f"dashboard ops tool not found: {name}")
        return self._tools[name]

    def has(self, name: str) -> bool:
        return name in self._tools

    def all_openai(self) -> list[dict[str, Any]]:
        return [t.schema().to_openai() for t in self._tools.values()]


dashboard_ops_registry = _DashboardOpsRegistry()


class _Grid(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: int | None = Field(default=None, ge=0)
    y: int | None = Field(default=None, ge=0)
    w: int | None = Field(default=None, ge=1)
    h: int | None = Field(default=None, ge=1)


async def _render_ui_tool_props(
    tool_name: str,
    args: dict[str, Any],
    ctx: DashboardOpsContext,
    call_id: str,
) -> tuple[str | None, dict[str, Any], str | None]:
    """지정된 ui tool 의 render() 를 소비해 최종 component / props 를 조립.

    LLM 이 "애플 차트 추가" 라고 말했을 때 dashboard.add_widget 가 stock tool 의
    render 를 재사용해 결과 props 를 얻기 위한 헬퍼. 에러가 나면 (None, {}, msg).
    """
    if not ui_tool_registry.has(tool_name):
        return None, {}, f"unknown tool: {tool_name}"
    tool = ui_tool_registry.get(tool_name)
    ui_ctx = UiContext(
        user_id=ctx.user_id,
        project_id=ctx.project_id,
        db=ctx.db,
        call_id=call_id,
    )
    component: str | None = None
    props: dict[str, Any] = {}
    error: str | None = None
    try:
        async for chunk in tool.render(args, ui_ctx):
            if isinstance(chunk, UiChunk):
                if chunk.kind == "component":
                    component = chunk.component or component
                    if chunk.props is not None:
                        props = dict(chunk.props)
                elif chunk.kind == "patch" and chunk.props:
                    if chunk.component is not None:
                        component = chunk.component
                    props.update(chunk.props)
                elif chunk.kind == "error":
                    error = chunk.error or "tool error"
    except Exception as exc:  # noqa: BLE001
        error = format_tool_error(exc)
    return component, props, error


def _widget_to_dict(widget: UIBuilderDashboardWidget) -> dict[str, Any]:
    return WidgetRead.model_validate(widget).model_dump(mode="json")


# ─────────────────────────────────────── add_widget ───────────────────────────


class AddWidgetParams(BaseModel):
    tool: str = Field(
        ...,
        description="재사용할 UI 도구 이름 (예: stock, weather, data_table)",
    )
    args: dict[str, Any] = Field(
        default_factory=dict,
        description="해당 도구의 render() 에 그대로 전달할 인자",
    )
    grid: _Grid | None = Field(
        default=None,
        description="배치 좌표. 생략하면 세로로 쌓는다.",
    )


class AddWidgetTool(BaseDashboardOpsTool):
    name = "dashboard_add_widget"
    description = (
        "대시보드에 새 위젯 추가를 제안한다. tool(재사용할 UI 도구 이름)과 그 args 를 "
        "받아 카드를 렌더한 뒤 프리뷰 카드로 채팅창에 먼저 보여준다. "
        "사용자가 '캔버스에 추가' 버튼을 눌러야 실제 반영된다."
    )
    Params = AddWidgetParams

    async def execute(
        self, args: dict[str, Any], ctx: DashboardOpsContext
    ) -> AsyncIterator[dict[str, Any]]:
        params = AddWidgetParams.model_validate(args)
        call_id = f"dash_{uuid4().hex[:12]}"

        component, props, error = await _render_ui_tool_props(
            params.tool, params.args, ctx, call_id
        )
        if error is not None or component is None:
            yield {
                "event": "dashboard.op_error",
                "data": {
                    "op": self.name,
                    "error": error or "tool did not yield a component",
                },
            }
            return

        grid = params.grid or _Grid()
        proposal = {
            "proposal_id": f"prop_{uuid4().hex[:12]}",
            "kind": "add",
            "call_id": call_id,
            "tool": params.tool,
            "component": component,
            "props": props,
            "grid": {
                "x": grid.x,
                "y": grid.y,
                "w": grid.w,
                "h": grid.h,
            },
        }
        yield {
            "event": "dashboard.widget_proposed",
            "data": {"proposal": proposal},
        }


# ─────────────────────────────────────── update_widget ────────────────────────


class UpdateWidgetParams(BaseModel):
    widget_id: UUID = Field(..., description="수정할 위젯의 id")
    action: str | None = Field(
        default=None,
        description="도구의 invoke_action 이름 (예: stock 의 setRange). "
        "생략하면 props 는 유지하고 grid 만 변경.",
    )
    args: dict[str, Any] = Field(default_factory=dict)
    grid: _Grid | None = None


class UpdateWidgetTool(BaseDashboardOpsTool):
    name = "dashboard_update_widget"
    description = (
        "기존 위젯의 props 또는 위치 수정을 제안한다. action 을 주면 해당 도구의 "
        "invoke_action 을 호출해 갱신된 props 를 계산하고, grid 를 주면 좌표 변경을 "
        "제안한다. 사용자가 '캔버스에 반영' 버튼을 눌러야 실제 DB 에 기록된다."
    )
    Params = UpdateWidgetParams

    async def execute(
        self, args: dict[str, Any], ctx: DashboardOpsContext
    ) -> AsyncIterator[dict[str, Any]]:
        params = UpdateWidgetParams.model_validate(args)
        widget = (
            ctx.db.query(UIBuilderDashboardWidget)
            .filter(
                UIBuilderDashboardWidget.id == params.widget_id,
                UIBuilderDashboardWidget.dashboard_id == ctx.dashboard_id,
            )
            .first()
        )
        if widget is None:
            yield {
                "event": "dashboard.op_error",
                "data": {"op": self.name, "error": "widget not found"},
            }
            return

        next_props: dict[str, Any] | None = None
        if params.action:
            if not ui_tool_registry.has(widget.tool):
                yield {
                    "event": "dashboard.op_error",
                    "data": {
                        "op": self.name,
                        "error": f"unknown tool: {widget.tool}",
                    },
                }
                return
            tool = ui_tool_registry.get(widget.tool)
            ui_ctx = UiContext(
                user_id=ctx.user_id,
                project_id=ctx.project_id,
                db=ctx.db,
                call_id=widget.call_id,
            )
            merged: dict[str, Any] = dict(widget.props or {})
            try:
                async for chunk in tool.invoke_action(
                    params.action, params.args, ui_ctx
                ):
                    if chunk.kind == "component" and chunk.props is not None:
                        merged = dict(chunk.props)
                    elif chunk.kind == "patch" and chunk.props:
                        merged.update(chunk.props)
                    elif chunk.kind == "error":
                        yield {
                            "event": "dashboard.op_error",
                            "data": {
                                "op": self.name,
                                "error": chunk.error or "tool error",
                            },
                        }
                        return
            except Exception as exc:  # noqa: BLE001
                yield {
                    "event": "dashboard.op_error",
                    "data": {"op": self.name, "error": str(exc)},
                }
                return
            next_props = merged

        next_grid: dict[str, int | None] | None = None
        if params.grid is not None:
            g = params.grid
            next_grid = {"x": g.x, "y": g.y, "w": g.w, "h": g.h}

        proposal = {
            "proposal_id": f"prop_{uuid4().hex[:12]}",
            "kind": "update",
            "widget_id": str(widget.id),
            "tool": widget.tool,
            "component": widget.component,
            "next_props": next_props,
            "next_grid": next_grid,
        }
        yield {
            "event": "dashboard.widget_proposed",
            "data": {"proposal": proposal},
        }


# ─────────────────────────────────────── remove_widget ────────────────────────


class RemoveWidgetParams(BaseModel):
    widget_id: UUID = Field(..., description="삭제할 위젯의 id")


class RemoveWidgetTool(BaseDashboardOpsTool):
    name = "dashboard_remove_widget"
    description = "지정된 위젯을 대시보드에서 제거한다."
    Params = RemoveWidgetParams

    async def execute(
        self, args: dict[str, Any], ctx: DashboardOpsContext
    ) -> AsyncIterator[dict[str, Any]]:
        params = RemoveWidgetParams.model_validate(args)
        svc = DashboardService(ctx.db)
        try:
            svc.delete_widget(ctx.dashboard_id, params.widget_id, ctx.user_id)
        except Exception as exc:  # noqa: BLE001
            yield {
                "event": "dashboard.op_error",
                "data": {"op": self.name, "error": str(exc)},
            }
            return
        yield {
            "event": "dashboard.widget_removed",
            "data": {"widget_id": str(params.widget_id)},
        }


# ─────────────────────────────────────── reflow ───────────────────────────────


class ReflowParams(BaseModel):
    strategy: str = Field(
        ...,
        description="배치 전략: stack(1열), 2col(2열 그리드), 3col(3열 그리드)",
    )


_COLS_BY_STRATEGY: dict[str, int] = {"stack": 1, "2col": 2, "3col": 3}


class ReflowTool(BaseDashboardOpsTool):
    name = "dashboard_reflow"
    description = (
        "대시보드의 모든 위젯을 프리셋으로 재배치한다. strategy 는 stack/2col/3col."
    )
    Params = ReflowParams

    async def execute(
        self, args: dict[str, Any], ctx: DashboardOpsContext
    ) -> AsyncIterator[dict[str, Any]]:
        params = ReflowParams.model_validate(args)
        cols = _COLS_BY_STRATEGY.get(params.strategy)
        if cols is None:
            yield {
                "event": "dashboard.op_error",
                "data": {
                    "op": self.name,
                    "error": f"unknown strategy: {params.strategy}",
                },
            }
            return

        rows = (
            ctx.db.query(UIBuilderDashboardWidget)
            .filter(UIBuilderDashboardWidget.dashboard_id == ctx.dashboard_id)
            .order_by(UIBuilderDashboardWidget.created_at.asc())
            .all()
        )
        w = 12 // cols
        h = DEFAULT_GRID_H
        for idx, widget in enumerate(rows):
            widget.grid_x = (idx % cols) * w
            widget.grid_y = (idx // cols) * h
            widget.grid_w = w
            widget.grid_h = h
        ctx.db.commit()

        yield {
            "event": "dashboard.layout_changed",
            "data": {
                "strategy": params.strategy,
                "widgets": [_widget_to_dict(w) for w in rows],
            },
        }


# ─────────────────────────────────────── registration ────────────────────────

dashboard_ops_registry.register(AddWidgetTool())
dashboard_ops_registry.register(UpdateWidgetTool())
dashboard_ops_registry.register(RemoveWidgetTool())
dashboard_ops_registry.register(ReflowTool())


__all__ = [
    "BaseDashboardOpsTool",
    "DashboardOpsContext",
    "dashboard_ops_registry",
]
