"""LLM Provider Registry.

이름 → Provider 클래스 매핑. 새 Provider 추가 시 여기에 등록.
API Key 등 자격증명은 v-platform system_settings 테이블에서 로드.
"""

from __future__ import annotations

from .base import BaseLLMProvider

# P1.1 에서 OpenAIProvider 추가
# from .openai_provider import OpenAIProvider

_providers: dict[str, type[BaseLLMProvider]] = {
    # "openai": OpenAIProvider,
    # "anthropic": AnthropicProvider,   # P2
    # "gemini": GeminiProvider,         # P2
}


def get_provider(name: str) -> BaseLLMProvider:
    if name not in _providers:
        raise ValueError(f"Unknown LLM provider: {name}")
    # 실제 구현에서는 system_settings 에서 API Key 조회 후 주입
    return _providers[name]()


def list_providers() -> list[str]:
    return sorted(_providers.keys())
