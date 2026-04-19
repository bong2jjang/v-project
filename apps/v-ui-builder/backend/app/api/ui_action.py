"""UI action 엔드포인트 — Generative UI 후속 인터랙션 (방안 C).

렌더된 카드(메시지 ui_calls 또는 대시보드 widget)의 버튼/리프레시 등 상호작용을
원래 도구의 `invoke_action()` 으로 라우팅하고, 결과 UiChunk 를 SSE `ui_*`
이벤트로 반환한다.

target 분기:
- `message`: 채팅 메시지의 `ui_calls[].props` 를 갱신.
- `widget`:  대시보드 위젯의 `props` 를 갱신.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.models import (
    UIBuilderDashboard,
    UIBuilderDashboardWidget,
    UIBuilderMessage,
    UIBuilderProject,
)
from app.schemas.ui_action import UiActionRequest
from app.ui_tools import UiContext, registry as ui_tool_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ui-action", tags=["ui-builder:ui-action"])


def _to_sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


def _resolve_message_scope(
    db: Session, payload: UiActionRequest, user_id: int
) -> tuple[UIBuilderProject, UIBuilderMessage, list[dict[str, Any]], dict[str, Any]]:
    message = (
        db.query(UIBuilderMessage)
        .filter(UIBuilderMessage.id == payload.message_id)
        .first()
    )
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="message not found"
        )
    project = (
        db.query(UIBuilderProject)
        .filter(UIBuilderProject.id == message.project_id)
        .first()
    )
    if project is None or project.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="project not found"
        )
    ui_calls: list[dict[str, Any]] = list(message.ui_calls or [])
    record = next(
        (c for c in ui_calls if c.get("call_id") == payload.call_id), None
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="ui call not found"
        )
    return project, message, ui_calls, record


def _resolve_widget_scope(
    db: Session, payload: UiActionRequest, user_id: int
) -> tuple[UIBuilderProject, UIBuilderDashboardWidget]:
    widget = (
        db.query(UIBuilderDashboardWidget)
        .filter(UIBuilderDashboardWidget.id == payload.widget_id)
        .first()
    )
    if widget is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="widget not found"
        )
    if widget.call_id != payload.call_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="call_id does not match widget",
        )
    dashboard = (
        db.query(UIBuilderDashboard)
        .filter(UIBuilderDashboard.id == widget.dashboard_id)
        .first()
    )
    if dashboard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="dashboard not found"
        )
    project = (
        db.query(UIBuilderProject)
        .filter(UIBuilderProject.id == dashboard.project_id)
        .first()
    )
    if project is None or project.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="project not found"
        )
    return project, widget


@router.post("")
async def ui_action(
    payload: UiActionRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    if payload.target == "widget":
        project, widget = _resolve_widget_scope(db, payload, current_user.id)
        tool_name = widget.tool or ""
    else:
        project, message, ui_calls, record = _resolve_message_scope(
            db, payload, current_user.id
        )
        tool_name = record.get("tool") or ""

    if not ui_tool_registry.has(tool_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unknown tool: {tool_name}",
        )

    tool = ui_tool_registry.get(tool_name)
    ctx = UiContext(
        user_id=current_user.id,
        project_id=project.id,
        db=db,
        call_id=payload.call_id,
    )

    async def generator() -> AsyncIterator[bytes]:
        if payload.target == "widget":
            merged_props: dict[str, Any] = dict(widget.props or {})
        else:
            merged_props = dict(record.get("props") or {})

        had_error = False
        error_text: str | None = None

        try:
            async for ui_chunk in tool.invoke_action(
                payload.action, payload.args, ctx
            ):
                event_name = f"ui_{ui_chunk.kind}"
                out: dict[str, Any] = {
                    "call_id": ui_chunk.call_id,
                    "tool": tool_name,
                }
                if ui_chunk.component is not None:
                    out["component"] = ui_chunk.component
                if ui_chunk.props is not None:
                    out["props"] = ui_chunk.props
                if ui_chunk.error is not None:
                    out["error"] = ui_chunk.error
                yield _to_sse(event_name, out)

                if ui_chunk.kind == "component" and ui_chunk.props is not None:
                    merged_props = dict(ui_chunk.props)
                elif ui_chunk.kind == "patch" and ui_chunk.props:
                    merged_props.update(ui_chunk.props)
                elif ui_chunk.kind == "error":
                    had_error = True
                    error_text = ui_chunk.error
        except Exception as exc:  # noqa: BLE001
            logger.exception("ui action %s.%s failed", tool_name, payload.action)
            had_error = True
            error_text = str(exc)
            yield _to_sse(
                "ui_error",
                {
                    "call_id": payload.call_id,
                    "tool": tool_name,
                    "error": error_text,
                },
            )

        if payload.target == "widget":
            widget.props = merged_props
            flag_modified(widget, "props")
            db.commit()
        else:
            record["props"] = merged_props
            record["status"] = "error" if had_error else "ok"
            if had_error and error_text is not None:
                record["error"] = error_text
            message.ui_calls = ui_calls
            flag_modified(message, "ui_calls")
            db.commit()

        yield _to_sse("done", {"call_id": payload.call_id})

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
