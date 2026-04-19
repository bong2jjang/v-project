"""data_table — 구조화된 데이터를 표로 렌더하는 UI 도구.

LLM 이 tabular data(비교표·명세표 등)를 보여주고 싶을 때 호출한다.
columns / rows 스펙을 그대로 props 로 통과시켜 프론트 DataTableCard 가 렌더.
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field

from .base import BaseUiTool, UiChunk, UiContext
from .registry import registry


class DataTableColumn(BaseModel):
    key: str = Field(..., description="row 객체의 필드명")
    label: str = Field(..., description="표 헤더에 표시할 문자열")
    align: Literal["left", "right", "center"] = Field(default="left")


class DataTableParams(BaseModel):
    title: str | None = Field(default=None, description="표 위에 표시할 제목")
    columns: list[DataTableColumn] = Field(
        ..., description="컬럼 정의 — 반드시 2개 이상"
    )
    rows: list[dict[str, Any]] = Field(
        ..., description="행 데이터 배열. 각 row 는 column.key 로 접근 가능해야 한다."
    )


class DataTableUiTool(BaseUiTool):
    name = "data_table"
    description = (
        "여러 항목을 비교하거나 목록화된 정보를 제공할 때 표 형태로 렌더한다. "
        "columns(키·라벨·정렬)와 rows(객체 배열)를 함께 전달."
    )
    Params = DataTableParams

    def summarize_props(self, props: dict[str, Any]) -> str:
        cols = props.get("columns") or []
        rows = props.get("rows") or []
        title = props.get("title") or ""
        suffix = f" — {title}" if title else ""
        return f"{len(cols)} cols × {len(rows)} rows{suffix}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = DataTableParams.model_validate(args)

        yield UiChunk(
            kind="loading",
            call_id=ctx.call_id,
            component="DataTableCard",
        )

        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="DataTableCard",
            props={
                "title": params.title,
                "columns": [c.model_dump() for c in params.columns],
                "rows": params.rows,
            },
        )


registry.register(DataTableUiTool())
