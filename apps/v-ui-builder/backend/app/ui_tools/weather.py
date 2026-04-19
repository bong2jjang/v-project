"""weather — 현재 날씨 카드를 렌더하는 UI 도구.

P2.3 스캐폴딩 단계에서는 외부 API 연동을 생략하고 결정적 스텁 데이터를 반환한다.
실제 날씨 공급사(OpenWeather 등) 연동은 후속 태스크에서 추가.
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from .base import BaseUiTool, UiChunk, UiContext
from .registry import registry


class WeatherParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    location: str = Field(
        ...,
        description="도시 또는 지역 이름 (예: Seoul, Tokyo, 경기도 화성시)",
        validation_alias=AliasChoices("location", "city", "place", "region"),
    )
    unit: Literal["celsius", "fahrenheit"] = Field(
        default="celsius", description="온도 단위"
    )


_STUB_BY_LOCATION: dict[str, dict[str, Any]] = {
    "seoul": {"temp_c": 14, "condition": "clear", "humidity": 42, "wind_kph": 11},
    "tokyo": {"temp_c": 17, "condition": "clouds", "humidity": 55, "wind_kph": 9},
    "new york": {"temp_c": 9, "condition": "rain", "humidity": 78, "wind_kph": 18},
    "london": {"temp_c": 7, "condition": "fog", "humidity": 86, "wind_kph": 6},
}


class WeatherUiTool(BaseUiTool):
    name = "weather"
    description = (
        "특정 도시의 현재 날씨(온도, 습도, 풍속, 상태)를 카드로 보여준다. "
        "사용자가 날씨/기온/기상 조건을 물을 때 호출."
    )
    Params = WeatherParams

    def summarize_props(self, props: dict[str, Any]) -> str:
        loc = props.get("location") or "?"
        t = props.get("temperature")
        unit = "°C" if props.get("unit") == "celsius" else "°F"
        cond = props.get("condition") or "?"
        return f"{loc} {t}{unit} {cond}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = WeatherParams.model_validate(args)

        yield UiChunk(
            kind="loading",
            call_id=ctx.call_id,
            component="WeatherCard",
        )

        key = params.location.strip().lower()
        stub = _STUB_BY_LOCATION.get(
            key, {"temp_c": 20, "condition": "clear", "humidity": 50, "wind_kph": 10}
        )
        temp_c: int = stub["temp_c"]
        temp = temp_c if params.unit == "celsius" else round(temp_c * 9 / 5 + 32)

        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="WeatherCard",
            props={
                "location": params.location,
                "temperature": temp,
                "unit": params.unit,
                "condition": stub["condition"],
                "humidity": stub["humidity"],
                "wind_kph": stub["wind_kph"],
            },
        )


registry.register(WeatherUiTool())
