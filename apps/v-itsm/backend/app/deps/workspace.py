"""워크스페이스 FastAPI 의존성.

`get_current_workspace` — URL 경로 파라미터 `workspace_id` 에서 WS를 추출하고
현재 사용자의 멤버십을 검증한다. SYSTEM_ADMIN은 멤버십 검사를 우회한다.

사용 예:
    @router.get("")
    async def list_tickets(
        workspace: Workspace = Depends(get_current_workspace),
        ...
    ):
        # workspace.id 로 필터
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.models.workspace import Workspace, WorkspaceMember


def get_current_workspace(
    workspace_id: str = Path(..., description="워크스페이스 ULID"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> Workspace:
    """URL workspace_id 검증 + 멤버십 확인 후 Workspace 반환.

    - 존재하지 않는 WS → 404
    - 아카이빙된 WS → 410 Gone
    - 멤버가 아닌 경우 → 403 (SYSTEM_ADMIN 제외)
    """
    ws = db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    ).scalar_one_or_none()

    if ws is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="워크스페이스를 찾을 수 없습니다.")

    if ws.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="아카이빙된 워크스페이스입니다.")

    if current_user.role == UserRole.SYSTEM_ADMIN:
        return ws

    member = db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="해당 워크스페이스에 접근 권한이 없습니다.")

    return ws
