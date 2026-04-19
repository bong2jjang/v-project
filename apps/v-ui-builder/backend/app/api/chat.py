"""Chat SSE 스트리밍 엔드포인트."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.schemas.chat import ChatRequest
from app.services.chat_service import ChatService


router = APIRouter(prefix="/api/chat", tags=["ui-builder:chat"])


@router.post("")
async def chat_stream(
    payload: ChatRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    svc = ChatService(db)
    generator = svc.stream(
        project_id=payload.project_id,
        user_id=current_user.id,
        prompt=payload.prompt,
        model=payload.model,
        context_snapshot_ids=payload.context_snapshot_ids,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
