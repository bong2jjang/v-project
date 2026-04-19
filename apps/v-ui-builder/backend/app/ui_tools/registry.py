"""Generative UI 도구 싱글톤 레지스트리.

- `register(tool)`  : 인스턴스 등록 (중복 name 은 덮어씀 — 개발 편의)
- `get(name)`       : 이름으로 조회, 없으면 KeyError
- `has(name)`       : 존재 여부
- `all_schemas()`   : LLM tools 파라미터로 넘길 스키마 목록
- `all_openai()`    : OpenAI function-calling 포맷 리스트
"""

from __future__ import annotations

from typing import Any

from .base import BaseUiTool, ToolSchema


class _UiToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, BaseUiTool] = {}

    def register(self, tool: BaseUiTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseUiTool:
        if name not in self._tools:
            raise KeyError(f"ui tool not found: {name}")
        return self._tools[name]

    def has(self, name: str) -> bool:
        return name in self._tools

    def names(self) -> list[str]:
        return list(self._tools.keys())

    def all_schemas(self) -> list[ToolSchema]:
        return [tool.schema() for tool in self._tools.values()]

    def all_openai(self) -> list[dict[str, Any]]:
        return [tool.schema().to_openai() for tool in self._tools.values()]


registry = _UiToolRegistry()
