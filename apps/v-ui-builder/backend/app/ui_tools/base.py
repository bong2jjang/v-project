"""Generative UI 도구의 추상 인터페이스.

방안 C — LLM tool-call 을 받아 클라이언트로 `ui_*` SSE 를 스트리밍하는 공통 계약.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session


UiChunkKind = Literal["loading", "component", "patch", "error"]


class UiChunk(BaseModel):
    """UI 도구가 ChatService 로 돌려보내는 스트림 단위.

    - `loading`   : 호출 시작 신호 (loading skeleton 표시용)
    - `component` : 최초 렌더 — `component` 이름 + `props` 전량
    - `patch`     : 부분 업데이트 — 동일 call_id 의 props 를 병합
    - `error`     : 도구 실패
    """

    kind: UiChunkKind
    call_id: str
    component: str | None = None
    props: dict[str, Any] | None = None
    error: str | None = None


class UiContext(BaseModel):
    """도구 실행에 필요한 런타임 컨텍스트.

    DB 세션은 arbitrary_types_allowed 로 그대로 통과시킨다.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    user_id: int
    project_id: UUID
    db: Session
    call_id: str


class ToolSchema(BaseModel):
    """OpenAI function-calling 호환 스키마.

    `params_schema` 는 JSON Schema (Pydantic 모델의 `.model_json_schema()`).
    """

    name: str
    description: str
    params_schema: dict[str, Any] = Field(default_factory=dict)

    def to_openai(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.params_schema,
            },
        }


class BaseUiTool(ABC):
    """모든 Generative UI 도구가 구현해야 하는 인터페이스.

    하위 클래스 규약:
    - `name`             : LLM 에 노출되는 도구 이름 (snake_case).
    - `description`      : LLM 이 호출 판단에 사용할 문구.
    - `Params`           : pydantic.BaseModel — 도구 인자 타입 (단일 소스).
    - `render(args, ctx)`: Params 에 합치되는 dict 를 받아 UiChunk 를 yield.
    - `invoke_action`    : 후속 인터랙션(/api/ui-action) 진입점 (옵션).
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

    def validate_args(self, args: dict[str, Any]) -> BaseModel:
        return self.Params.model_validate(args)

    @abstractmethod
    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        """도구 실행 — UiChunk 를 비동기로 생성."""
        raise NotImplementedError
        yield  # pragma: no cover — 타입 힌트를 위한 placeholder

    async def invoke_action(
        self, action: str, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        """후속 액션 (예: 버튼 클릭, refresh) 기본 구현은 에러.

        하위 클래스가 필요 시 재정의.
        """
        yield UiChunk(
            kind="error",
            call_id=ctx.call_id,
            error=f"{self.name}.{action} not implemented",
        )
