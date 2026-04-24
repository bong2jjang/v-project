"""v-itsm 워크스페이스 관리 API (멤버 전용) — 설계 §4.1.

엔드포인트:
  GET    /api/workspaces/me                           - 내 WS 목록
  GET    /api/workspaces/me/default                   - 내 기본 WS
  POST   /api/workspaces/{id}/switch                  - WS 전환
  GET    /api/workspaces/{id}                         - WS 상세
  GET    /api/workspaces/{id}/members                 - 멤버 목록
  POST   /api/workspaces/{id}/members                 - 멤버 추가 (ws_admin)
  PUT    /api/workspaces/{id}/members/{uid}/role      - 역할 변경 (ws_admin)
  DELETE /api/workspaces/{id}/members/{uid}           - 멤버 제거 (ws_admin)

ACL:
  - 내 WS 목록/기본: 로그인 사용자 누구나
  - 단건/멤버 목록: 멤버이거나 SYSTEM_ADMIN
  - 멤버 추가/역할 변경/제거: ws_admin 또는 SYSTEM_ADMIN
  - 전환: 대상 WS 멤버이거나 SYSTEM_ADMIN

감사로그: 플랫폼 AuditAction 확장(workspace_switched 등) 승인 대기 — 현재 미기록.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.utils.auth import get_current_user

from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import (
    WorkspaceMemberAdd,
    WorkspaceMemberOut,
    WorkspaceMemberRoleUpdate,
    WorkspaceOut,
    WorkspaceSummaryOut,
    WorkspaceSwitchOut,
)
from app.services import workspace_service

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_ws_or_404(db: Session, workspace_id: str) -> Workspace:
    ws = workspace_service.get_workspace(db, workspace_id)
    if ws is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "워크스페이스를 찾을 수 없습니다.")
    if ws.archived_at is not None:
        raise HTTPException(status.HTTP_410_GONE, "아카이빙된 워크스페이스입니다.")
    return ws


def _check_member_or_admin(
    db: Session, ws: Workspace, current_user: User
) -> WorkspaceMember | None:
    """SYSTEM_ADMIN은 패스, 아니면 멤버 확인 후 반환. 비멤버 → 403."""
    if current_user.role == UserRole.SYSTEM_ADMIN:
        return None
    member = workspace_service.get_member(db, ws.id, current_user.id)
    if member is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "해당 워크스페이스에 접근 권한이 없습니다.")
    return member


def _check_ws_admin(
    db: Session, ws: Workspace, current_user: User
) -> None:
    """ws_admin 또는 SYSTEM_ADMIN 만 허용."""
    if current_user.role == UserRole.SYSTEM_ADMIN:
        return
    member = workspace_service.get_member(db, ws.id, current_user.id)
    if member is None or member.role != "ws_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "ws_admin 또는 SYSTEM_ADMIN 권한이 필요합니다.")


def _member_out(member: WorkspaceMember, user: User) -> WorkspaceMemberOut:
    return WorkspaceMemberOut(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        email=user.email,
        username=user.username,
        role=member.role,
        is_default=member.is_default,
        joined_at=member.joined_at,
    )


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/me", response_model=list[WorkspaceSummaryOut])
async def list_my_workspaces(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[WorkspaceSummaryOut]:
    rows = workspace_service.get_my_workspaces(db, current_user.id)

    if current_user.role == UserRole.SYSTEM_ADMIN:
        # SYSTEM_ADMIN 은 멤버십 유무와 무관하게 전체 비아카이빙 WS 에 접근 가능해야 함.
        # 멤버십이 있으면 실제 role/is_default 반영, 없으면 가상 ws_admin 으로 채움.
        all_ws, _ = workspace_service.list_all_workspaces(db, page_size=200)
        my_by_id = {ws.id: member for member, ws in rows}
        counts = workspace_service.get_ticket_counts(db, [ws.id for ws in all_ws])
        return [
            WorkspaceSummaryOut(
                id=ws.id, name=ws.name, slug=ws.slug,
                description=ws.description, icon_url=ws.icon_url,
                is_default=ws.is_default,
                my_role=(my_by_id[ws.id].role if ws.id in my_by_id else "ws_admin"),
                is_my_default=(my_by_id[ws.id].is_default if ws.id in my_by_id else False),
                ticket_count=counts.get(ws.id, 0),
                created_at=ws.created_at,
            )
            for ws in all_ws
        ]

    if not rows:
        return []

    counts = workspace_service.get_ticket_counts(db, [ws.id for _, ws in rows])
    return [
        WorkspaceSummaryOut(
            id=ws.id, name=ws.name, slug=ws.slug,
            description=ws.description, icon_url=ws.icon_url,
            is_default=ws.is_default, my_role=member.role,
            is_my_default=member.is_default,
            ticket_count=counts.get(ws.id, 0),
            created_at=ws.created_at,
        )
        for member, ws in rows
    ]


@router.get("/me/default", response_model=WorkspaceSummaryOut)
async def get_my_default_workspace(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceSummaryOut:
    result = workspace_service.get_default_workspace(db, current_user.id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "기본 워크스페이스가 설정되지 않았습니다.")
    member, ws = result
    counts = workspace_service.get_ticket_counts(db, [ws.id])
    return WorkspaceSummaryOut(
        id=ws.id, name=ws.name, slug=ws.slug,
        description=ws.description, icon_url=ws.icon_url,
        is_default=ws.is_default, my_role=member.role,
        is_my_default=member.is_default,
        ticket_count=counts.get(ws.id, 0),
        created_at=ws.created_at,
    )


@router.post("/{id}/switch", response_model=WorkspaceSwitchOut)
async def switch_workspace(
    id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceSwitchOut:
    ws = _get_ws_or_404(db, id)
    _check_member_or_admin(db, ws, current_user)
    # TODO: 플랫폼 AuditAction.workspace_switched 감사로그 (승인 후 추가)
    return WorkspaceSwitchOut(
        current_workspace_id=ws.id,
        workspace=WorkspaceOut.model_validate(ws),
    )


@router.get("/{id}", response_model=WorkspaceOut)
async def get_workspace(
    id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceOut:
    ws = _get_ws_or_404(db, id)
    _check_member_or_admin(db, ws, current_user)
    return WorkspaceOut.model_validate(ws)


@router.get("/{id}/members", response_model=list[WorkspaceMemberOut])
async def list_members(
    id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[WorkspaceMemberOut]:
    ws = _get_ws_or_404(db, id)
    _check_member_or_admin(db, ws, current_user)
    rows = workspace_service.list_members(db, ws.id)
    return [_member_out(m, u) for m, u in rows]


@router.post(
    "/{id}/members",
    response_model=WorkspaceMemberOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    id: str,
    payload: WorkspaceMemberAdd,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceMemberOut:
    ws = _get_ws_or_404(db, id)
    _check_ws_admin(db, ws, current_user)

    existing = workspace_service.get_member(db, ws.id, payload.user_id)
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 워크스페이스 멤버입니다.")

    try:
        member = workspace_service.add_member(
            db, ws.id, payload.user_id, role=payload.role, is_default=payload.is_default
        )
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "멤버 추가에 실패했습니다.")

    rows = workspace_service.list_members(db, ws.id)
    for m, u in rows:
        if m.id == member.id:
            return _member_out(m, u)

    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "멤버 조회 실패")


@router.put("/{id}/members/{uid}/role", response_model=WorkspaceMemberOut)
async def update_member_role(
    id: str,
    uid: int,
    payload: WorkspaceMemberRoleUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> WorkspaceMemberOut:
    ws = _get_ws_or_404(db, id)
    _check_ws_admin(db, ws, current_user)

    member = workspace_service.get_member(db, ws.id, uid)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "멤버를 찾을 수 없습니다.")

    updated = workspace_service.update_member_role(db, member, payload.role)
    rows = workspace_service.list_members(db, ws.id)
    for m, u in rows:
        if m.id == updated.id:
            return _member_out(m, u)

    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "멤버 조회 실패")


@router.delete("/{id}/members/{uid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    id: str,
    uid: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> None:
    ws = _get_ws_or_404(db, id)
    _check_ws_admin(db, ws, current_user)

    member = workspace_service.get_member(db, ws.id, uid)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "멤버를 찾을 수 없습니다.")

    workspace_service.remove_member(db, member)
