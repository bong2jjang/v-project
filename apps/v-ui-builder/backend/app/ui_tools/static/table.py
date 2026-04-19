"""표 정적 위젯.

- data_table: 컬럼·행 수동 입력 표 (CSV 붙여넣기 Inspector 고급 탭)
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field

from ..base import BaseUiTool, UiChunk, UiContext
from ..registry import registry


class DataTableColumn(BaseModel):
    key: str = Field(..., description="row 객체 필드명")
    label: str = Field(..., description="표 헤더 텍스트")
    align: Literal["left", "right", "center"] = Field(default="left")
    type: Literal["text", "number", "date", "badge"] = Field(
        default="text", description="셀 타입 (포맷/정렬 힌트)"
    )


class DataTableParams(BaseModel):
    title: str | None = Field(default=None, description="표 제목")
    columns: list[DataTableColumn] = Field(
        default_factory=lambda: [
            DataTableColumn(key="name", label="이름"),
            DataTableColumn(key="value", label="값", align="right", type="number"),
        ],
        description="컬럼 정의 (2개 이상 권장)",
    )
    rows: list[dict[str, Any]] = Field(
        default_factory=lambda: [
            {"name": "A", "value": 120},
            {"name": "B", "value": 85},
            {"name": "C", "value": 64},
        ],
        description="행 데이터 (각 row 는 column.key 로 접근)",
    )
    sortable: bool = Field(default=True, description="컬럼 클릭 정렬 허용")
    page_size: int | None = Field(
        default=None, ge=5, le=200, description="페이지당 행 수 (없으면 페이징 없음)"
    )
    striped: bool = Field(default=True, description="줄무늬 스타일")


class DataTableManualTool(BaseUiTool):
    name = "data_table_manual"
    description = "컬럼·행을 수동으로 지정하는 표 위젯 (Inspector 고급 탭 CSV 붙여넣기 지원)."
    Params = DataTableParams
    component = "DataTableManual"
    category = "table"
    label = "데이터 테이블"
    icon = "Table"
    default_grid = {"w": 12, "h": 5}
    default_args = {
        "title": "데이터 테이블",
        "columns": [
            {"key": "region", "label": "지역"},
            {"key": "sales", "label": "매출", "align": "right", "type": "number"},
            {"key": "growth", "label": "성장률", "align": "right", "type": "number"},
        ],
        "rows": [
            {"region": "서울", "sales": 1280, "growth": 12.3},
            {"region": "경기", "sales": 980, "growth": 8.4},
            {"region": "부산", "sales": 620, "growth": 4.1},
        ],
        "sortable": True,
        "striped": True,
    }
    palette_order = 10

    def summarize_props(self, props: dict[str, Any]) -> str:
        cols = props.get("columns") or []
        rows = props.get("rows") or []
        return f"[table] {len(cols)}c × {len(rows)}r"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = DataTableParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="DataTableManual",
            props=params.model_dump(),
        )


registry.register(DataTableManualTool())
