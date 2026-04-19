"""UI action (Generative UI 후속 인터랙션) 요청 스키마."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class UiActionRequest(BaseModel):
    """이미 렌더된 UI 카드의 후속 액션 호출.

    - `target`     : "message"(채팅 메시지 내 카드) | "widget"(대시보드 위젯)
    - `message_id` : target=message 일 때 카드가 속한 assistant 메시지 id
    - `widget_id`  : target=widget 일 때 대시보드 위젯 id
    - `call_id`    : ui_calls[].call_id 또는 widget.call_id
    - `action`     : 도구가 정의한 액션 이름 (예: "refresh", "select")
    - `args`       : 액션 인자
    """

    target: Literal["message", "widget"] = "message"
    message_id: UUID | None = None
    widget_id: UUID | None = None
    call_id: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    args: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_target(self) -> "UiActionRequest":
        if self.target == "message" and self.message_id is None:
            raise ValueError("message_id is required when target='message'")
        if self.target == "widget" and self.widget_id is None:
            raise ValueError("widget_id is required when target='widget'")
        return self
