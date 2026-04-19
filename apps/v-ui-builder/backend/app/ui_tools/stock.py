"""stock — 주가 차트 카드를 렌더하는 UI 도구.

P2.3 스캐폴딩 — 결정적 시드 기반 가짜 시계열을 반환한다.
실 거래소 API 연동은 후속 태스크.

후속 액션:
- `setRange` : 범위 변경 → `patch` UiChunk 로 series / current / change / change_pct 교체.
"""

from __future__ import annotations

import math
from typing import Any, AsyncIterator, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from .base import BaseUiTool, UiChunk, UiContext
from .registry import registry


StockRange = Literal["1d", "5d", "1mo", "3mo", "6mo", "1y"]


_RANGE_ALIASES: dict[str, StockRange] = {
    "1d": "1d",
    "5d": "5d",
    "1w": "5d",
    "1mo": "1mo",
    "1m": "1mo",
    "month": "1mo",
    "3mo": "3mo",
    "3m": "3mo",
    "6mo": "6mo",
    "6m": "6mo",
    "1y": "1y",
    "1yr": "1y",
    "year": "1y",
    "12mo": "1y",
    "12m": "1y",
}


def _normalize_range(value: Any) -> Any:
    if isinstance(value, str):
        key = value.strip().lower()
        if key in _RANGE_ALIASES:
            return _RANGE_ALIASES[key]
    return value


class StockParams(BaseModel):
    """LLM 이 `ticker` 로 호출해도 허용하도록 alias 를 둔다."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(
        ...,
        description="종목 티커 (예: AAPL, MSFT, 005930)",
        validation_alias=AliasChoices("symbol", "ticker"),
    )
    range: StockRange = Field(default="1mo", description="조회 기간")

    @field_validator("range", mode="before")
    @classmethod
    def _coerce_range(cls, v: Any) -> Any:
        return _normalize_range(v)


class StockSetRangeArgs(BaseModel):
    """`setRange` 액션 인자. 프론트가 현재 카드의 심볼과 새 range 를 함께 보낸다."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(
        ...,
        description="현재 카드의 심볼",
        validation_alias=AliasChoices("symbol", "ticker"),
    )
    range: StockRange

    @field_validator("range", mode="before")
    @classmethod
    def _coerce_range(cls, v: Any) -> Any:
        return _normalize_range(v)


_POINTS_BY_RANGE: dict[str, int] = {
    "1d": 12,
    "5d": 20,
    "1mo": 22,
    "3mo": 30,
    "6mo": 45,
    "1y": 60,
}


def _seed(symbol: str) -> float:
    total = sum(ord(c) for c in symbol.upper())
    return 80 + (total % 220)


def _build_stock_props(symbol: str, rng: str) -> dict[str, Any]:
    base = _seed(symbol)
    n = _POINTS_BY_RANGE[rng]
    series: list[dict[str, Any]] = []
    for i in range(n):
        wave = math.sin(i / 2.3) * 4 + math.cos(i / 4.7) * 2.5
        drift = (i - n / 2) * 0.35
        price = round(base + wave + drift, 2)
        series.append({"t": i, "price": price})
    first = series[0]["price"]
    last = series[-1]["price"]
    change = round(last - first, 2)
    change_pct = round((change / first) * 100, 2) if first else 0.0
    return {
        "symbol": symbol.upper(),
        "range": rng,
        "current": last,
        "change": change,
        "change_pct": change_pct,
        "series": series,
    }


class StockUiTool(BaseUiTool):
    name = "stock"
    description = (
        "주식 티커의 최근 가격 시계열을 라인 차트로 표시한다. "
        "사용자가 주가·종목 추이를 물을 때 호출."
    )
    Params = StockParams

    def summarize_props(self, props: dict[str, Any]) -> str:
        sym = props.get("symbol") or "?"
        rng = props.get("range") or "?"
        cur = props.get("current")
        chg = props.get("change_pct")
        return f"{sym} {rng} cur={cur} chg={chg}%"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = StockParams.model_validate(args)

        yield UiChunk(
            kind="loading",
            call_id=ctx.call_id,
            component="StockCard",
        )

        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="StockCard",
            props=_build_stock_props(params.symbol, params.range),
        )

    async def invoke_action(
        self, action: str, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        if action != "setRange":
            yield UiChunk(
                kind="error",
                call_id=ctx.call_id,
                error=f"{self.name}.{action} not supported",
            )
            return

        payload = StockSetRangeArgs.model_validate(args)

        yield UiChunk(
            kind="loading",
            call_id=ctx.call_id,
            component="StockCard",
        )

        yield UiChunk(
            kind="patch",
            call_id=ctx.call_id,
            component="StockCard",
            props=_build_stock_props(payload.symbol, payload.range),
        )


registry.register(StockUiTool())
