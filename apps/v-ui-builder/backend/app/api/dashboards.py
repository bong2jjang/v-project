"""Dashboard 라우터 — 프로젝트당 1개 캔버스 + 위젯(Pin) CRUD + 대시보드 채팅.

엔드포인트:
- GET    /api/projects/{project_id}/dashboard           → DashboardDetail (widgets 포함)
- GET    /api/projects/{project_id}/dashboard/messages  → 대시보드 scope 메시지 히스토리
- POST   /api/projects/{project_id}/dashboard/widgets   → Pin 드롭: 카드 → 위젯 복제
- DELETE /api/projects/{project_id}/dashboard/widgets/{widget_id} → 고정 해제
- PUT    /api/projects/{project_id}/dashboard/widgets/layout      → bulk layout(P3.2)
- POST   /api/projects/{project_id}/dashboard/chat                → SSE 스트림 (P3.4)
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.schemas.dashboard import (
    DashboardDetail,
    WidgetCreate,
    WidgetLayoutBulkUpdate,
    WidgetRead,
)
from app.schemas.message import MessageResponse
from app.services.dashboard_chat_service import DashboardChatService
from app.services.dashboard_service import DashboardService


class DashboardChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    selected_widget_ids: list[str] = Field(default_factory=list)
    model: str | None = None


router = APIRouter(
    prefix="/api/projects", tags=["ui-builder:dashboards"]
)


@router.get(
    "/{project_id}/dashboard",
    response_model=DashboardDetail,
)
def get_dashboard(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> DashboardDetail:
    svc = DashboardService(db)
    dashboard = svc.get_for_project(project_id, current_user.id)
    widgets = svc.list_widgets(dashboard.id, current_user.id)
    return DashboardDetail(
        **DashboardDetail.model_validate(dashboard).model_dump(exclude={"widgets"}),
        widgets=[WidgetRead.model_validate(w) for w in widgets],
    )


@router.get(
    "/{project_id}/dashboard/messages",
    response_model=list[MessageResponse],
)
def list_dashboard_messages(
    project_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    """대시보드 scope 메시지 히스토리 — genui 프로젝트 전용."""
    svc = DashboardService(db)
    svc.get_for_project(project_id, current_user.id)
    messages = svc.projects.list_messages(
        project_id, current_user.id, scope="dashboard"
    )
    return [MessageResponse.model_validate(m) for m in messages]


@router.post(
    "/{project_id}/dashboard/widgets",
    response_model=WidgetRead,
    status_code=status.HTTP_201_CREATED,
)
def create_widget(
    project_id: UUID,
    data: WidgetCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WidgetRead:
    svc = DashboardService(db)
    dashboard = svc.get_for_project(project_id, current_user.id)
    widget = svc.create_widget(dashboard.id, current_user.id, data)
    return WidgetRead.model_validate(widget)


@router.delete(
    "/{project_id}/dashboard/widgets/{widget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_widget(
    project_id: UUID,
    widget_id: UUID,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    svc = DashboardService(db)
    dashboard = svc.get_for_project(project_id, current_user.id)
    svc.delete_widget(dashboard.id, widget_id, current_user.id)


@router.put(
    "/{project_id}/dashboard/widgets/layout",
    response_model=list[WidgetRead],
)
def update_widget_layout(
    project_id: UUID,
    data: WidgetLayoutBulkUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[WidgetRead]:
    svc = DashboardService(db)
    dashboard = svc.get_for_project(project_id, current_user.id)
    widgets = svc.update_layout_bulk(dashboard.id, current_user.id, data)
    return [WidgetRead.model_validate(w) for w in widgets]


@router.post("/{project_id}/dashboard/chat")
async def dashboard_chat_stream(
    project_id: UUID,
    payload: DashboardChatRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    svc = DashboardChatService(db)
    generator = svc.stream(
        project_id=project_id,
        user_id=current_user.id,
        prompt=payload.prompt,
        selected_widget_ids=payload.selected_widget_ids,
        model=payload.model,
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
