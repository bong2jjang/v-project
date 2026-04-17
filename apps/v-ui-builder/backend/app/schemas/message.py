"""Message (대화 히스토리) 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


MessageRole = Literal["user", "assistant", "system"]


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    role: str
    content: str
    tokens_in: int | None
    tokens_out: int | None
    created_at: datetime
