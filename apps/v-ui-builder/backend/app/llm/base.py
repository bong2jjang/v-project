"""LLM Provider 추상 인터페이스.

OpenAI/Anthropic/Gemini 등 공급자 교체를 런타임 설정으로 처리하기 위한 베이스.
새 Provider 추가 시 이 클래스를 상속하고 app/llm/registry.py 에 등록.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator, Literal

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ArtifactFile(BaseModel):
    file_path: str
    content: str


class LLMChunk(BaseModel):
    """SSE 스트림 단위 청크."""

    kind: Literal["content", "artifact_start", "artifact_delta", "artifact_end", "done"]
    delta: str | None = None
    file_path: str | None = None


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
    ) -> AsyncIterator[LLMChunk]:
        """프롬프트를 스트리밍으로 응답."""
        raise NotImplementedError

    @abstractmethod
    async def validate_credentials(self) -> bool:
        """API Key 유효성 확인 (관리자 설정 화면용)."""
        raise NotImplementedError
