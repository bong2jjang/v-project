"""LLM Provider 추상 인터페이스.

OpenAI/Anthropic/Gemini 등 공급자 교체를 런타임 설정으로 처리하기 위한 베이스.
새 Provider 추가 시 이 클래스를 상속하고 app/llm/registry.py 에 등록.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ArtifactFile(BaseModel):
    file_path: str
    content: str


LLMChunkKind = Literal[
    "content",
    "artifact_start",
    "artifact_delta",
    "artifact_end",
    "tool_call",
    "done",
]


class LLMChunk(BaseModel):
    """SSE 스트림 단위 청크.

    - content / artifact_* : 텍스트 + Sandpack 아트팩트 (기존)
    - tool_call            : Generative UI tool-call 완성 시점에 1회 방출
    - done                 : 스트림 종료 신호
    """

    kind: LLMChunkKind
    delta: str | None = None
    file_path: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    tool_args: dict[str, Any] | None = None


class BaseLLMProvider(ABC):
    """모든 LLM Provider가 구현해야 하는 인터페이스."""

    name: str = "base"

    @abstractmethod
    async def stream(
        self,
        messages: list[ChatMessage],
        system_prompt: str,
        file_context: list[ArtifactFile],
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[LLMChunk]:
        """프롬프트를 스트리밍으로 응답.

        `tools` 는 OpenAI function-calling 호환 스키마 리스트 (registry.all_openai()).
        Provider 가 tool-calling 을 지원하지 않으면 무시해도 된다.
        """
        raise NotImplementedError

    @abstractmethod
    async def validate_credentials(self) -> bool:
        """API Key 유효성 확인 (관리자 설정 화면용)."""
        raise NotImplementedError
