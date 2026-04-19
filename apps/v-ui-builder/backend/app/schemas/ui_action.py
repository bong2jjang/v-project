"""UI action (Generative UI 후속 인터랙션) 요청 스키마."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class UiActionRequest(BaseModel):
    """이미 렌더된 UI 카드의 후속 액션 호출.

    - `message_id` : 카드가 속한 assistant 메시지 id
    - `call_id`    : ui_calls[].call_id (메시지 내 UI tool-call 식별자)
    - `action`     : 도구가 정의한 액션 이름 (예: "refresh", "select")
    - `args`       : 액션 인자
    """

    message_id: UUID
    call_id: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    args: dict[str, Any] = Field(default_factory=dict)
