"""
Permission Group Management API

권한 그룹 CRUD + 그룹별 메뉴 권한 설정
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from v_platform.core.database import get_db_session
from v_platform.models.menu_item import MenuItem
from v_platform.models.permission_group import (
    PermissionGroup,
    PermissionGroupGrant,
    UserGroupMembership,
)
from v_platform.models.user import User
from v_platform.utils.auth import require_admin_or_above, require_system_admin

router = APIRouter(prefix="/api/permission-groups", tags=["permission-groups"])


# ── Schemas ──────────────────────────────────────────────────────────


class GrantItem(BaseModel):
    menu_item_id: int
    access_level: str  # "none" | "read" | "write"


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class SetGrantsRequest(BaseModel):
    grants: list[GrantItem]


class GrantResponse(BaseModel):
    id: int
    menu_item_id: int
    permission_key: Optional[str] = None
    menu_label: Optional[str] = None
    access_level: str

    class Config:
        from_attributes = True


class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    grants: list[GrantResponse] = []

    class Config:
        from_attributes = True


# ── Helper ───────────────────────────────────────────────────────────


def _group_to_response(
    group: PermissionGroup, db: Session, app_id: str | None = None
) -> dict:
    """PermissionGroup → 응답 dict 변환 (현재 앱 범위의 grants만 포함)"""
    member_count = (
        db.query(UserGroupMembership)
        .filter(UserGroupMembership.permission_group_id == group.id)
        .count()
    )
    grants = []
    for g in group.grants:
        menu = (
            db.query(MenuItem)
            .filter(
                MenuItem.id == g.menu_item_id,
                or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id),
            )
            .first()
        )
        if not menu:
            continue  # 다른 앱의 메뉴는 건너뜀
        grants.append(
            {
                "id": g.id,
                "menu_item_id": g.menu_item_id,
                "permission_key": menu.permission_key,
                "menu_label": menu.label,
                "access_level": g.access_level,
            }
        )
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "is_default": group.is_default,
        "is_active": group.is_active,
        "created_by": group.created_by,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "member_count": member_count,
        "grants": grants,
    }


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_admin_or_above()),
):
    """권한 그룹 목록 (grants 포함)"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    groups = (
        db.query(PermissionGroup)
        .options(joinedload(PermissionGroup.grants))
        .filter(or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id))
        .order_by(PermissionGroup.is_default.desc(), PermissionGroup.name)
        .all()
    )
    # joinedload 중복 방지
    seen = set()
    unique_groups = []
    for g in groups:
        if g.id not in seen:
            seen.add(g.id)
            unique_groups.append(g)

    return [_group_to_response(g, db, app_id=app_id) for g in unique_groups]


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    request: Request,
    group_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_admin_or_above()),
):
    """특정 권한 그룹 조회"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .options(joinedload(PermissionGroup.grants))
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")
    return _group_to_response(group, db, app_id=app_id)


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: Request,
    data: GroupCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """커스텀 그룹 생성 (system_admin 전용)"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    # 같은 앱 내에서 중복 이름 체크 (다른 앱에서는 같은 이름 허용)
    existing = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.name == data.name,
            or_(
                PermissionGroup.app_id == app_id,
                PermissionGroup.app_id.is_(None),
            ),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            400,
            "이 앱에 동일한 이름의 권한 그룹이 이미 존재합니다. 다른 이름을 사용해 주세요.",
        )

    group = PermissionGroup(
        name=data.name,
        description=data.description,
        is_default=False,
        app_id=app_id,
        created_by=current_user.id,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return _group_to_response(group, db, app_id=app_id)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    request: Request,
    group_id: int,
    data: GroupUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """그룹 수정 (is_default=true면 403)"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")
    if group.is_default:
        raise HTTPException(403, "디폴트 그룹은 수정할 수 없습니다")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(group, key, val)
    group.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(group)
    return _group_to_response(group, db, app_id=app_id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    request: Request,
    group_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """그룹 삭제 (is_default=true면 403)"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")
    if group.is_default:
        raise HTTPException(403, "디폴트 그룹은 삭제할 수 없습니다")

    db.delete(group)
    db.commit()


@router.put("/{group_id}/grants")
async def set_group_grants(
    request: Request,
    group_id: int,
    req: SetGrantsRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """그룹 메뉴 권한 일괄 설정 (system_admin은 디폴트 그룹도 수정 가능)"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")

    # 현재 앱 범위의 메뉴 ID 목록 조회
    app_menu_ids = {
        m.id
        for m in db.query(MenuItem.id)
        .filter(or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id))
        .all()
    }

    # 입력 검증을 INSERT 전에 먼저 수행
    for item in req.grants:
        if item.access_level not in ("none", "read", "write"):
            raise HTTPException(400, f"잘못된 권한 수준입니다: {item.access_level}")
        if item.menu_item_id not in app_menu_ids:
            raise HTTPException(
                400,
                f"메뉴 ID {item.menu_item_id}은(는) 현재 앱에서 접근할 수 없습니다",
            )

    # 현재 앱 범위의 기존 grants만 일괄 삭제 (다른 앱의 grants는 유지)
    # bulk delete + flush로 INSERT 전에 DELETE가 DB에 반영되도록 보장
    # (UNIQUE(permission_group_id, menu_item_id) 충돌 방지)
    db.query(PermissionGroupGrant).filter(
        PermissionGroupGrant.permission_group_id == group_id,
        PermissionGroupGrant.menu_item_id.in_(app_menu_ids),
    ).delete(synchronize_session=False)
    db.flush()

    for item in req.grants:
        grant = PermissionGroupGrant(
            permission_group_id=group_id,
            menu_item_id=item.menu_item_id,
            access_level=item.access_level,
        )
        db.add(grant)

    group.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "그룹 권한이 설정되었습니다", "count": len(req.grants)}


@router.get("/{group_id}/members")
async def get_group_members(
    request: Request,
    group_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_admin_or_above()),
):
    """그룹 소속 사용자 목록"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")

    memberships = (
        db.query(UserGroupMembership)
        .filter(UserGroupMembership.permission_group_id == group_id)
        .all()
    )

    members = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            members.append(
                {
                    "user_id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "role": user.role.value
                    if hasattr(user.role, "value")
                    else user.role,
                    "assigned_by": m.assigned_by,
                    "created_at": m.created_at,
                }
            )

    return {"group_id": group_id, "group_name": group.name, "members": members}


class AddMemberRequest(BaseModel):
    user_id: int = Field(..., description="추가할 사용자 ID")


@router.post("/{group_id}/members")
async def add_group_member(
    request: Request,
    group_id: int,
    req: AddMemberRequest,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """그룹에 사용자 추가"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")

    target = db.query(User).filter(User.id == req.user_id).first()
    if not target:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    # 이미 소속 여부 확인
    existing = (
        db.query(UserGroupMembership)
        .filter(
            UserGroupMembership.user_id == req.user_id,
            UserGroupMembership.permission_group_id == group_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "이미 해당 그룹에 소속된 사용자입니다")

    membership = UserGroupMembership(
        user_id=req.user_id,
        permission_group_id=group_id,
        assigned_by=current_admin.id,
    )
    db.add(membership)
    db.commit()

    return {"message": f"{target.username}이(가) {group.name} 그룹에 추가되었습니다"}


@router.delete("/{group_id}/members/{user_id}")
async def remove_group_member(
    request: Request,
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """그룹에서 사용자 제거"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    group = (
        db.query(PermissionGroup)
        .filter(
            PermissionGroup.id == group_id,
            or_(PermissionGroup.app_id.is_(None), PermissionGroup.app_id == app_id),
        )
        .first()
    )
    if not group:
        raise HTTPException(404, "권한 그룹을 찾을 수 없습니다")

    membership = (
        db.query(UserGroupMembership)
        .filter(
            UserGroupMembership.user_id == user_id,
            UserGroupMembership.permission_group_id == group_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(404, "해당 그룹에 소속되지 않은 사용자입니다")

    db.delete(membership)
    db.commit()

    return {"message": "사용자가 그룹에서 제거되었습니다"}


@router.get("/user/{user_id}/groups")
async def get_user_groups(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """특정 사용자가 소속된 그룹 목록"""
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    memberships = (
        db.query(UserGroupMembership)
        .filter(UserGroupMembership.user_id == user_id)
        .all()
    )

    groups = []
    for m in memberships:
        group = (
            db.query(PermissionGroup)
            .filter(
                PermissionGroup.id == m.permission_group_id,
                or_(
                    PermissionGroup.app_id.is_(None),
                    PermissionGroup.app_id == app_id,
                ),
            )
            .first()
        )
        if group:
            groups.append(
                {
                    "id": group.id,
                    "name": group.name,
                    "description": group.description,
                    "is_default": group.is_default,
                    "assigned_at": m.created_at,
                }
            )

    return {
        "user_id": user_id,
        "username": target.username,
        "groups": groups,
    }


@router.get("/members/search")
async def search_users_for_group(
    q: str = "",
    group_id: Optional[int] = None,
    limit: int = 20,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """그룹 멤버 추가를 위한 사용자 검색 (이미 소속된 사용자 제외)"""
    query = db.query(User).filter(User.is_active.is_(True))

    if q:
        query = query.filter(
            or_(
                User.username.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )

    # 이미 해당 그룹에 소속된 사용자 제외
    if group_id:
        existing_ids = {
            m.user_id
            for m in db.query(UserGroupMembership.user_id)
            .filter(UserGroupMembership.permission_group_id == group_id)
            .all()
        }
        if existing_ids:
            query = query.filter(User.id.notin_(existing_ids))

    users = query.order_by(User.username).limit(limit).all()

    return {
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
            }
            for u in users
        ]
    }
