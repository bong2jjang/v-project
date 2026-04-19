"""echo — 프로토콜 검증용 샘플 UI 도구.

P2.4 에서 실제 도구(weather/stock/…)로 대체될 때까지 end-to-end 테스트용.
LLM 이 `echo` 를 호출하면 전달한 `text` 를 그대로 component props 로 돌려보낸다.
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from pydantic import BaseModel, Field

from .base import BaseUiTool, UiChunk, UiContext
from .registry import registry


class EchoParams(BaseModel):
    text: str = Field(..., description="미리보기 카드에 표시할 문자열")


class EchoUiTool(BaseUiTool):
    name = "echo"
    description = (
        "사용자가 입력한 문자열을 그대로 되돌려 보여주는 미리보기용 샘플 도구. "
        "프로토콜 검증 외 실제 UX 용도로 쓰지 말 것."
    )
    Params = EchoParams

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = EchoParams.model_validate(args)

        yield UiChunk(
            kind="loading",
            call_id=ctx.call_id,
            component="EchoCard",
        )

        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="EchoCard",
            props={"text": params.text},
        )


registry.register(EchoUiTool())
