"""Message (대화 히스토리) 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


MessageRole = Literal["user", "assistant", "system"]


class UiCallRecord(BaseModel):
    """메시지에 첨부된 Generative UI tool-call 결과 (방안 C).

    ChatService 가 스트림 종료 시 메시지 ui_calls 배열에 누적한다.
    """

    call_id: str
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    status: Literal["ok", "error", "loading"] = "ok"
    component: str | None = None
    props: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime | None = None
    # 대시보드 add/update 프리뷰 제안이 평탄화되어 들어오는 필드. 프론트가 이 값으로
    # `WidgetProposalCard` 를 복원한다. 일반 Generative UI 호출에는 null.
    proposal: dict[str, Any] | None = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    role: str
    content: str
    tokens_in: int | None
    tokens_out: int | None
    ui_calls: list[UiCallRecord] = Field(default_factory=list)
    created_at: datetime
