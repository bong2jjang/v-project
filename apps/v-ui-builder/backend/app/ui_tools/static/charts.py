"""차트 정적 위젯 (Recharts 래핑 props).

- line_chart: 시계열 추세
- bar_chart: 범주형 비교(세로)
- horizontal_bar_chart: 랭킹 Top N (가로)
- pie_chart: 구성비
- donut_chart: 중앙 강조 구성비
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field

from ..base import BaseUiTool, UiChunk, UiContext
from ..registry import registry


def _sample_series() -> list[dict[str, Any]]:
    """라인/바 차트 기본 시리즈 — 도메인 사용자가 바로 모양 확인할 수 있게."""
    return [
        {
            "name": "A",
            "data": [
                {"x": "1월", "y": 120},
                {"x": "2월", "y": 150},
                {"x": "3월", "y": 170},
                {"x": "4월", "y": 140},
                {"x": "5월", "y": 190},
                {"x": "6월", "y": 210},
            ],
        },
        {
            "name": "B",
            "data": [
                {"x": "1월", "y": 80},
                {"x": "2월", "y": 110},
                {"x": "3월", "y": 130},
                {"x": "4월", "y": 150},
                {"x": "5월", "y": 160},
                {"x": "6월", "y": 180},
            ],
        },
    ]


# ── line_chart ──
class LineChartSeries(BaseModel):
    name: str
    data: list[dict[str, Any]]  # [{x, y}, ...]


class LineChartParams(BaseModel):
    title: str = Field(default="추세", description="차트 제목")
    series: list[LineChartSeries] = Field(
        default_factory=lambda: [
            LineChartSeries(**s) for s in _sample_series()
        ],
        description="시리즈 배열 (각 시리즈는 name + data[{x,y}])",
    )
    x_label: str = Field(default="", description="X축 라벨")
    y_label: str = Field(default="", description="Y축 라벨")
    show_legend: bool = Field(default=True, description="범례 표시 여부")
    smooth: bool = Field(default=False, description="곡선 부드럽게 처리")


class LineChartTool(BaseUiTool):
    name = "line_chart"
    description = "시계열 추세를 보여주는 라인 차트."
    Params = LineChartParams
    component = "LineChart"
    category = "chart"
    label = "라인 차트"
    icon = "LineChart"
    default_grid = {"w": 6, "h": 4}
    default_args = {
        "title": "월별 매출 추세",
        "series": _sample_series(),
        "x_label": "월",
        "y_label": "매출",
        "show_legend": True,
    }
    palette_order = 10

    def summarize_props(self, props: dict[str, Any]) -> str:
        series = props.get("series") or []
        return f"[line] {(props.get('title') or '')[:30]} · {len(series)} series"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = LineChartParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="LineChart",
            props=params.model_dump(),
        )


# ── bar_chart ──
class BarChartParams(BaseModel):
    title: str = Field(default="범주 비교", description="차트 제목")
    categories: list[str] = Field(
        default_factory=lambda: ["1월", "2월", "3월", "4월", "5월", "6월"],
        description="X축 카테고리",
    )
    series: list[dict[str, Any]] = Field(
        default_factory=lambda: [
            {"name": "A", "data": [120, 150, 170, 140, 190, 210]},
            {"name": "B", "data": [80, 110, 130, 150, 160, 180]},
        ],
        description="시리즈 (각 시리즈: name + data[])",
    )
    stacked: bool = Field(default=False, description="누적 바")
    show_legend: bool = Field(default=True, description="범례 표시")


class BarChartTool(BaseUiTool):
    name = "bar_chart"
    description = "범주형 값 비교를 보여주는 세로 바 차트."
    Params = BarChartParams
    component = "BarChart"
    category = "chart"
    label = "바 차트"
    icon = "BarChart3"
    default_grid = {"w": 6, "h": 4}
    default_args = {
        "title": "월별 비교",
        "categories": ["1월", "2월", "3월", "4월", "5월", "6월"],
        "series": [
            {"name": "A", "data": [120, 150, 170, 140, 190, 210]},
            {"name": "B", "data": [80, 110, 130, 150, 160, 180]},
        ],
    }
    palette_order = 20

    def summarize_props(self, props: dict[str, Any]) -> str:
        s = props.get("series") or []
        c = props.get("categories") or []
        return f"[bar] {(props.get('title') or '')[:30]} · {len(s)}s × {len(c)}c"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = BarChartParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="BarChart",
            props=params.model_dump(),
        )


# ── horizontal_bar_chart ──
class HbarItem(BaseModel):
    label: str
    value: float


class HorizontalBarChartParams(BaseModel):
    title: str = Field(default="랭킹", description="차트 제목")
    items: list[HbarItem] = Field(
        default_factory=lambda: [
            HbarItem(label="서울", value=320),
            HbarItem(label="경기", value=240),
            HbarItem(label="부산", value=180),
            HbarItem(label="대구", value=120),
            HbarItem(label="인천", value=90),
        ],
        description="막대 항목 목록",
    )
    sort: Literal["desc", "asc", "none"] = Field(
        default="desc", description="정렬"
    )
    top_n: int | None = Field(
        default=None, ge=1, le=50, description="상위 N 개만 표시"
    )
    color: str = Field(default="#4f46e5", description="막대 색상")


class HorizontalBarChartTool(BaseUiTool):
    name = "horizontal_bar_chart"
    description = "상위 N 항목을 가로 막대로 보여주는 랭킹 차트."
    Params = HorizontalBarChartParams
    component = "HorizontalBarChart"
    category = "chart"
    label = "가로 바 차트"
    icon = "BarChartHorizontal"
    default_grid = {"w": 6, "h": 4}
    default_args = {
        "title": "지역별 Top 5",
        "items": [
            {"label": "서울", "value": 320},
            {"label": "경기", "value": 240},
            {"label": "부산", "value": 180},
            {"label": "대구", "value": 120},
            {"label": "인천", "value": 90},
        ],
        "sort": "desc",
        "top_n": 5,
    }
    palette_order = 30

    def summarize_props(self, props: dict[str, Any]) -> str:
        items = props.get("items") or []
        return f"[hbar] {(props.get('title') or '')[:30]} · {len(items)}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = HorizontalBarChartParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="HorizontalBarChart",
            props=params.model_dump(),
        )


# ── pie_chart ──
class PieItem(BaseModel):
    label: str
    value: float
    color: str | None = None


class PieChartParams(BaseModel):
    title: str = Field(default="구성비", description="차트 제목")
    items: list[PieItem] = Field(
        default_factory=lambda: [
            PieItem(label="A", value=40),
            PieItem(label="B", value=30),
            PieItem(label="C", value=20),
            PieItem(label="D", value=10),
        ],
        description="파이 조각",
    )
    show_legend: bool = Field(default=True)
    show_labels: bool = Field(default=True)


class PieChartTool(BaseUiTool):
    name = "pie_chart"
    description = "전체 대비 구성비를 파이로 보여주는 차트."
    Params = PieChartParams
    component = "PieChart"
    category = "chart"
    label = "파이 차트"
    icon = "PieChart"
    default_grid = {"w": 4, "h": 4}
    default_args = {
        "title": "채널별 매출 비중",
        "items": [
            {"label": "Web", "value": 45},
            {"label": "App", "value": 30},
            {"label": "Store", "value": 15},
            {"label": "Others", "value": 10},
        ],
    }
    palette_order = 40

    def summarize_props(self, props: dict[str, Any]) -> str:
        return (
            f"[pie] {(props.get('title') or '')[:30]} · "
            f"{len(props.get('items') or [])}"
        )

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = PieChartParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="PieChart",
            props=params.model_dump(),
        )


# ── donut_chart ──
class DonutChartParams(BaseModel):
    title: str = Field(default="구성비", description="차트 제목")
    items: list[PieItem] = Field(
        default_factory=lambda: [
            PieItem(label="A", value=40),
            PieItem(label="B", value=30),
            PieItem(label="C", value=20),
            PieItem(label="D", value=10),
        ],
    )
    center_label: str = Field(default="총합", description="중앙 라벨")
    center_value: str | None = Field(
        default=None, description="중앙 값(없으면 합계 자동계산)"
    )
    show_legend: bool = Field(default=True)


class DonutChartTool(BaseUiTool):
    name = "donut_chart"
    description = "중앙에 요약값을 보여주는 도넛 차트."
    Params = DonutChartParams
    component = "DonutChart"
    category = "chart"
    label = "도넛 차트"
    icon = "CircleDotDashed"
    default_grid = {"w": 4, "h": 4}
    default_args = {
        "title": "카테고리 비중",
        "items": [
            {"label": "식품", "value": 42},
            {"label": "의류", "value": 28},
            {"label": "가전", "value": 20},
            {"label": "기타", "value": 10},
        ],
        "center_label": "전체",
    }
    palette_order = 50

    def summarize_props(self, props: dict[str, Any]) -> str:
        return (
            f"[donut] {(props.get('title') or '')[:30]} · "
            f"{len(props.get('items') or [])}"
        )

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = DonutChartParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="DonutChart",
            props=params.model_dump(),
        )


registry.register(LineChartTool())
registry.register(BarChartTool())
registry.register(HorizontalBarChartTool())
registry.register(PieChartTool())
registry.register(DonutChartTool())
