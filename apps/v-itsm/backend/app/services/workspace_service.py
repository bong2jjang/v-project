"""워크스페이스 CRUD + 멤버 관리 서비스 — 설계 §4.1."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ulid import ULID
from v_platform.models.user import User

from app.models.ticket import Ticket
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


def _new_ulid() -> str:
    return str(ULID())


# ── Workspace CRUD ────────────────────────────────────────────────────────────

def get_workspace(db: Session, workspace_id: str) -> Workspace | None:
    return db.get(Workspace, workspace_id)


def get_workspace_by_slug(db: Session, slug: str) -> Workspace | None:
    return db.execute(
        select(Workspace).where(Workspace.slug == slug)
    ).scalar_one_or_none()


def list_all_workspaces(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    include_archived: bool = False,
) -> tuple[list[Workspace], int]:
    stmt = select(Workspace)
    count_stmt = select(func.count()).select_from(Workspace)
    if not include_archived:
        stmt = stmt.where(Workspace.archived_at.is_(None))
        count_stmt = count_stmt.where(Workspace.archived_at.is_(None))
    stmt = stmt.order_by(Workspace.created_at.desc())
    total = int(db.execute(count_stmt).scalar_one())
    offset = max(0, (page - 1) * page_size)
    items = list(db.execute(stmt.offset(offset).limit(page_size)).scalars().all())
    return items, total


def create_workspace(
    db: Session,
    payload: WorkspaceCreate,
    *,
    created_by: int,
) -> Workspace:
    ws = Workspace(
        id=_new_ulid(),
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        icon_url=payload.icon_url,
        settings=payload.settings,
        is_default=payload.is_default,
        created_by=created_by,
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return ws


def update_workspace(db: Session, ws: Workspace, payload: WorkspaceUpdate) -> Workspace:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(ws, field, value)
    db.commit()
    db.refresh(ws)
    return ws


def archive_workspace(db: Session, ws: Workspace) -> Workspace:
    ws.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ws)
    return ws


# ── 내 워크스페이스 ────────────────────────────────────────────────────────────

def get_my_workspaces(
    db: Session, user_id: int
) -> list[tuple[WorkspaceMember, Workspace]]:
    """사용자가 멤버인 비아카이빙 WS 목록. is_default 내림차순 → 이름 오름차순."""
    stmt = (
        select(WorkspaceMember, Workspace)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.user_id == user_id,
            Workspace.archived_at.is_(None),
        )
        .order_by(WorkspaceMember.is_default.desc(), Workspace.name.asc())
    )
    return [(m, ws) for m, ws in db.execute(stmt).all()]


def get_ticket_counts(db: Session, workspace_ids: list[str]) -> dict[str, int]:
    if not workspace_ids:
        return {}
    rows = db.execute(
        select(Ticket.workspace_id, func.count(Ticket.id))
        .where(Ticket.workspace_id.in_(workspace_ids))
        .group_by(Ticket.workspace_id)
    ).all()
    return {ws_id: count for ws_id, count in rows}


def get_default_workspace(
    db: Session, user_id: int
) -> tuple[WorkspaceMember, Workspace] | None:
    row = db.execute(
        select(WorkspaceMember, Workspace)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.is_default.is_(True),
            Workspace.archived_at.is_(None),
        )
    ).first()
    if row is None:
        return None
    return row[0], row[1]


# ── 멤버 관리 ─────────────────────────────────────────────────────────────────

def get_member(db: Session, workspace_id: str, user_id: int) -> WorkspaceMember | None:
    return db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    ).scalar_one_or_none()


def list_members(
    db: Session, workspace_id: str
) -> list[tuple[WorkspaceMember, User]]:
    stmt = (
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at.asc())
    )
    return [(m, u) for m, u in db.execute(stmt).all()]


def add_member(
    db: Session,
    workspace_id: str,
    user_id: int,
    role: str = "ws_member",
    is_default: bool = False,
) -> WorkspaceMember:
    member = WorkspaceMember(
        id=_new_ulid(),
        workspace_id=workspace_id,
        user_id=user_id,
        role=role,
        is_default=is_default,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_member_role(
    db: Session, member: WorkspaceMember, role: str
) -> WorkspaceMember:
    member.role = role
    db.commit()
    db.refresh(member)
    return member


def remove_member(db: Session, member: WorkspaceMember) -> None:
    db.delete(member)
    db.commit()
