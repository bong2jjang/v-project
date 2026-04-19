"""OpenAI Provider — Chat Completions 스트리밍 구현.

응답 스트림은 **원본 그대로** `content` 이벤트로 내보내고, 아래 규약의
코드 펜스가 감지되면 Sandpack 라이브 프리뷰용으로 `artifact_*` 이벤트를
**추가로** 병행 방출한다 (채팅 버블에는 펜스가 그대로 남도록):

    ```tsx file=/src/App.tsx
    ...코드...
    ```

파일 경로가 없는 코드 블록은 `content` 이벤트로만 유지된다.

Generative UI (방안 C): `tools` 인자가 주어지면 OpenAI tool-calling 을
활성화하고, 모델이 tool_call 을 완성할 때마다 `tool_call` LLMChunk 를 방출.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from .base import ArtifactFile, BaseLLMProvider, ChatMessage, LLMChunk

logger = logging.getLogger(__name__)


_FENCE_RE = re.compile(
    r"^```(?P<lang>[a-zA-Z0-9_+-]*)(?:\s+file=(?P<path>\S+))?\s*$"
)


class OpenAIProvider(BaseLLMProvider):
    name = "openai"

    def __init__(self, api_key: str | None = None, default_model: str | None = None):
        self._api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self._default_model = (
            default_model or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
        )
        self._client = AsyncOpenAI(api_key=self._api_key) if self._api_key else None

    async def stream(
        self,
        messages: list[ChatMessage],
        system_prompt: str,
        file_context: list[ArtifactFile],
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[LLMChunk]:
        if self._client is None:
            raise RuntimeError("OpenAI API key is not configured")

        payload: list[dict] = [{"role": "system", "content": system_prompt}]
        if file_context:
            payload.append(
                {
                    "role": "system",
                    "content": _format_file_context(file_context),
                }
            )
        payload.extend({"role": m.role, "content": m.content} for m in messages)

        kwargs: dict[str, Any] = {
            "model": model or self._default_model,
            "messages": payload,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        stream = await self._client.chat.completions.create(**kwargs)

        parser = _FenceParser()
        tool_buf = _ToolCallBuffer()
        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if delta.content:
                for event in parser.feed(delta.content):
                    yield event

            if getattr(delta, "tool_calls", None):
                tool_buf.feed(delta.tool_calls)

            if choice.finish_reason in ("tool_calls", "stop"):
                for event in tool_buf.flush():
                    yield event

        for event in parser.flush():
            yield event
        for event in tool_buf.flush():
            yield event
        yield LLMChunk(kind="done")

    async def validate_credentials(self) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.models.list()
            return True
        except Exception:
            return False


def _format_file_context(files: list[ArtifactFile]) -> str:
    parts = ["현재 프로젝트의 파일:"]
    for f in files:
        parts.append(f"### {f.file_path}\n```\n{f.content}\n```")
    return "\n\n".join(parts)


class _FenceParser:
    """line-buffered parser. 토큰 스트림을 줄 단위로 재조립하며 펜스를 감지."""

    def __init__(self) -> None:
        self._buf = ""
        self._in_artifact = False
        self._artifact_path: str | None = None

    def feed(self, delta: str) -> list[LLMChunk]:
        if not delta:
            return []
        self._buf += delta
        events: list[LLMChunk] = []
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            events.extend(self._process_line(line + "\n"))
        return events

    def flush(self) -> list[LLMChunk]:
        events: list[LLMChunk] = []
        if self._buf:
            events.extend(self._process_line(self._buf))
            self._buf = ""
        if self._in_artifact and self._artifact_path:
            events.append(
                LLMChunk(kind="artifact_end", file_path=self._artifact_path)
            )
            self._in_artifact = False
            self._artifact_path = None
        return events

    def _process_line(self, line: str) -> list[LLMChunk]:
        """원본 텍스트는 항상 content 로, 아트팩트 감지 시 병행 이벤트를 추가.

        채팅 버블은 펜스 포함 원본을 받아 코드블록으로 렌더링하고,
        Sandpack 은 artifact 이벤트로 라이브 프리뷰를 갱신한다.
        """
        events: list[LLMChunk] = [LLMChunk(kind="content", delta=line)]
        stripped = line.strip()
        match = _FENCE_RE.match(stripped)
        if match:
            path = match.group("path")
            if not self._in_artifact and path:
                self._in_artifact = True
                self._artifact_path = path
                events.append(LLMChunk(kind="artifact_start", file_path=path))
            elif self._in_artifact:
                ended = self._artifact_path
                self._in_artifact = False
                self._artifact_path = None
                events.append(LLMChunk(kind="artifact_end", file_path=ended))
        elif self._in_artifact:
            events.append(
                LLMChunk(
                    kind="artifact_delta",
                    file_path=self._artifact_path,
                    delta=line,
                )
            )
        return events


class _ToolCallBuffer:
    """OpenAI 스트리밍 tool_call 조립기.

    `delta.tool_calls` 는 index 단위로 쪼개져 arrivals 가 나뉘며,
    `function.arguments` 는 JSON 문자열이 조각조각 도착한다.
    index 로 슬롯을 확보한 뒤 누적 → flush 시점에 JSON 파싱해 방출.
    """

    def __init__(self) -> None:
        # index → { id, name, args_buf }
        self._slots: dict[int, dict[str, Any]] = {}
        self._emitted: set[int] = set()

    def feed(self, tool_calls: list[Any]) -> None:
        for tc in tool_calls:
            idx = getattr(tc, "index", 0)
            slot = self._slots.setdefault(
                idx, {"id": None, "name": None, "args_buf": ""}
            )
            tc_id = getattr(tc, "id", None)
            if tc_id:
                slot["id"] = tc_id
            fn = getattr(tc, "function", None)
            if fn is not None:
                if getattr(fn, "name", None):
                    slot["name"] = fn.name
                args_delta = getattr(fn, "arguments", None)
                if args_delta:
                    slot["args_buf"] += args_delta

    def flush(self) -> list[LLMChunk]:
        events: list[LLMChunk] = []
        for idx, slot in self._slots.items():
            if idx in self._emitted or not slot.get("name"):
                continue
            raw = slot.get("args_buf") or "{}"
            try:
                parsed = json.loads(raw) if raw.strip() else {}
            except json.JSONDecodeError:
                logger.warning(
                    "tool_call args JSON parse failed: tool=%s raw=%r",
                    slot.get("name"),
                    raw,
                )
                parsed = {}
            events.append(
                LLMChunk(
                    kind="tool_call",
                    tool_call_id=slot.get("id") or f"call_{idx}",
                    tool_name=slot["name"],
                    tool_args=parsed,
                )
            )
            self._emitted.add(idx)
        return events
