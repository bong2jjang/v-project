"""KPI & 요약 지표 정적 위젯.

- kpi_card: 큰 숫자 + 변화율 + 추세
- stat_grid: 2~4 개 미니 스탯
- progress_bar: 목표 대비 달성률
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field

from ..base import BaseUiTool, UiChunk, UiContext
from ..registry import registry


# ── kpi_card ──
class KpiCardParams(BaseModel):
    label: str = Field(default="지표", description="카드 라벨")
    value: float | int = Field(default=0, description="표시 숫자")
    unit: str = Field(default="", description="단위 (원/%/명 등)")
    delta: float | None = Field(default=None, description="변화량(±)")
    delta_type: Literal["pct", "abs"] = Field(
        default="pct", description="변화 표기 종류"
    )
    trend: Literal["up", "down", "flat"] = Field(
        default="flat", description="추세 화살표"
    )
    icon: str | None = Field(default=None, description="Lucide 아이콘")
    sparkline: list[float] = Field(
        default_factory=list, description="미니 스파크라인 점 배열(옵션)"
    )


class KpiCardTool(BaseUiTool):
    name = "kpi_card"
    description = "핵심 지표 하나를 큰 숫자/변화율/추세로 보여주는 KPI 카드."
    Params = KpiCardParams
    component = "KpiCard"
    category = "kpi"
    label = "KPI 카드"
    icon = "TrendingUp"
    default_grid = {"w": 3, "h": 2}
    default_args = {
        "label": "매출",
        "value": 128000000,
        "unit": "원",
        "delta": 12.3,
        "delta_type": "pct",
        "trend": "up",
        "sparkline": [5, 7, 6, 9, 12, 11, 14],
    }
    palette_order = 10

    def summarize_props(self, props: dict[str, Any]) -> str:
        return (
            f"[kpi] {(props.get('label') or '')[:20]}: "
            f"{props.get('value')}{props.get('unit','')}"
        )

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = KpiCardParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="KpiCard",
            props=params.model_dump(),
        )


# ── stat_grid ──
class StatItem(BaseModel):
    label: str
    value: float | int | str
    delta: float | None = None
    unit: str = ""


class StatGridParams(BaseModel):
    items: list[StatItem] = Field(
        default_factory=lambda: [
            StatItem(label="A", value=10),
            StatItem(label="B", value=20),
            StatItem(label="C", value=30),
        ],
        description="표시할 미니 스탯 목록",
    )
    columns: int = Field(default=3, ge=2, le=4, description="열 개수")


class StatGridTool(BaseUiTool):
    name = "stat_grid"
    description = "2~4 개의 미니 지표를 격자로 배치."
    Params = StatGridParams
    component = "StatGrid"
    category = "kpi"
    label = "스탯 그리드"
    icon = "LayoutGrid"
    default_grid = {"w": 6, "h": 2}
    default_args = {
        "columns": 3,
        "items": [
            {"label": "신규 고객", "value": 142, "delta": 8.1, "unit": "명"},
            {"label": "이탈률", "value": 3.2, "delta": -0.4, "unit": "%"},
            {"label": "평균 단가", "value": 42300, "delta": 1.1, "unit": "원"},
        ],
    }
    palette_order = 20

    def summarize_props(self, props: dict[str, Any]) -> str:
        items = props.get("items") or []
        return f"[stats] {len(items)}개"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = StatGridParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="StatGrid",
            props=params.model_dump(),
        )


# ── progress_bar ──
class ProgressBarParams(BaseModel):
    label: str = Field(default="진행률", description="라벨")
    current: float = Field(default=35, description="현재 값")
    target: float = Field(default=100, description="목표 값")
    unit: str = Field(default="", description="단위")
    color: Literal["blue", "green", "amber", "rose"] = Field(
        default="blue", description="색상"
    )


class ProgressBarTool(BaseUiTool):
    name = "progress_bar"
    description = "목표 대비 달성률을 막대로 표시."
    Params = ProgressBarParams
    component = "ProgressBar"
    category = "kpi"
    label = "진행률 바"
    icon = "Activity"
    default_grid = {"w": 6, "h": 1}
    default_args = {
        "label": "분기 목표 달성률",
        "current": 68,
        "target": 100,
        "unit": "%",
        "color": "blue",
    }
    palette_order = 30

    def summarize_props(self, props: dict[str, Any]) -> str:
        cur = props.get("current", 0)
        tgt = props.get("target", 100) or 1
        try:
            pct = round(float(cur) / float(tgt) * 100, 1)
        except Exception:  # noqa: BLE001
            pct = 0
        return f"[progress] {props.get('label','')} {pct}%"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = ProgressBarParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="ProgressBar",
            props=params.model_dump(),
        )


registry.register(KpiCardTool())
registry.register(StatGridTool())
registry.register(ProgressBarTool())
