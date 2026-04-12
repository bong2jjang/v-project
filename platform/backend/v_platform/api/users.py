"""
User Management API

사용자 관리 API 엔드포인트 (관리자 및 일반 사용자)
"""

from datetime import datetime, timezone
from math import ceil
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, selectinload
from typing import Optional

from pydantic import BaseModel, Field

from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.models.permission_group import UserGroupMembership, PermissionGroup
from v_platform.schemas.user import (
    AdminUserCreate,
    UserResponse,
    UserUpdate,
    UserUpdateMe,
    UserPasswordChange,
    UserRoleUpdate,
    UserListResponse,
)
from v_platform.utils.auth import (
    get_current_user,
    require_permission,
    require_system_admin,
    require_admin_or_above,
    get_password_hash,
    verify_password,
)
from v_platform.utils.audit_logger import (
    log_user_register,
    log_user_update,
    log_user_delete,
    log_user_role_change,
    log_user_password_change,
)
from v_platform.services.notification_service import NotificationService

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=UserListResponse)
async def get_users(
    page: int = Query(1, ge=1, description="페이지 번호"),
    per_page: int = Query(20, ge=1, le=1000, description="페이지당 항목 수"),
    role: Optional[str] = Query(None, description="역할 필터 (admin, user)"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    search: Optional[str] = Query(None, description="이메일/사용자명 검색"),
    company_id: Optional[int] = Query(None, description="회사 ID 필터"),
    department_id: Optional[int] = Query(None, description="부서 ID 필터"),
    group_id: Optional[int] = Query(None, description="권한 그룹 ID 필터"),
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("users", "read")),
):
    """
    사용자 목록 조회 (관리자 전용)

    페이징, 필터링, 검색 기능 제공
    """
    # 기본 쿼리
    query = db.query(User)

    # 필터 적용
    if role:
        try:
            role_enum = UserRole(role)
            query = query.filter(User.role == role_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role}. Must be 'admin' or 'user'",
            )

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_pattern)) | (User.username.ilike(search_pattern))
        )

    if company_id is not None:
        query = query.filter(User.company_id == company_id)

    if department_id is not None:
        query = query.filter(User.department_id == department_id)

    if group_id is not None:
        query = query.filter(
            User.id.in_(
                db.query(UserGroupMembership.user_id).filter(
                    UserGroupMembership.permission_group_id == group_id
                )
            )
        )

    # 전체 개수
    total = query.count()

    # 페이징 적용 (eager load company/department/groups)
    offset = (page - 1) * per_page
    users = (
        query.options(
            selectinload(User.company),
            selectinload(User.department),
            selectinload(User.group_memberships),
        )
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    # 총 페이지 수 계산
    total_pages = ceil(total / per_page) if total > 0 else 1

    return UserListResponse(
        users=users,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    user_data: AdminUserCreate,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("users", "write")),
):
    """
    사용자 생성 (관리자 전용)

    관리자가 직접 사용자를 생성합니다. 역할 및 활성 상태를 지정할 수 있습니다.
    """
    # 이메일 중복 확인
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일 주소입니다. 다른 이메일을 사용해 주세요.",
        )

    # 비밀번호 해싱
    hashed_password = get_password_hash(user_data.password)

    # 사용자 생성
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        role=user_data.role,
        is_active=user_data.is_active,
        company_id=user_data.company_id,
        department_id=user_data.department_id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 역할에 맞는 기본 권한 그룹 자동 할당
    from v_platform.services.permission_service import PermissionService

    PermissionService.sync_default_group_for_user(
        db, new_user, assigned_by_id=current_admin.id
    )
    db.refresh(new_user)

    # 감사 로그 생성
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log_user_register(
        db=db,
        user=new_user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        app_id=app_id,
    )

    # 알림 전송
    await NotificationService.notify_info(
        category="user",
        title="새 사용자 생성",
        message=f"관리자 '{current_admin.username}'이(가) 새 사용자 '{new_user.username}' ({new_user.email})을 생성했습니다.",
        source="user_api",
        metadata={
            "user_id": new_user.id,
            "username": new_user.username,
            "created_by": current_admin.username,
        },
        link="/users",
    )

    return new_user


# /me 엔드포인트는 /{user_id}보다 먼저 정의되어야 함 (더 구체적인 경로)
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    본인 정보 조회

    현재 로그인한 사용자의 정보를 반환합니다.
    """
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    request: Request,
    user_data: UserUpdateMe,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    본인 정보 수정

    일반 사용자가 자신의 정보를 수정합니다.
    """
    # 사용자 조회 (DB에서 최신 정보 가져오기)
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 변경 사항 추적
    changes = {}
    if user_data.username is not None and user_data.username != user.username:
        changes["username"] = {"old": user.username, "new": user_data.username}
        user.username = user_data.username
    if user_data.start_page is not None and user_data.start_page != user.start_page:
        changes["start_page"] = {"old": user.start_page, "new": user_data.start_page}
        user.start_page = user_data.start_page
    if user_data.theme is not None and user_data.theme != user.theme:
        changes["theme"] = {"old": user.theme, "new": user_data.theme}
        user.theme = user_data.theme
    if (
        user_data.color_preset is not None
        and user_data.color_preset != user.color_preset
    ):
        changes["color_preset"] = {
            "old": user.color_preset,
            "new": user_data.color_preset,
        }
        user.color_preset = user_data.color_preset

    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    # 감사 로그 생성 (변경 사항이 있는 경우에만)
    if changes:
        app_id = (
            getattr(request.app.state, "app_id", None)
            if hasattr(request.app, "state")
            else None
        )
        log_user_update(
            db=db,
            user=user,
            updated_by=current_user,
            changes=changes,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            app_id=app_id,
        )

    return user


@router.put("/me/password", status_code=status.HTTP_200_OK)
async def change_password(
    request: Request,
    password_data: UserPasswordChange,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    비밀번호 변경

    현재 비밀번호를 확인하고 새 비밀번호로 변경합니다.
    """
    # 사용자 조회 (DB에서 최신 정보 가져오기)
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 현재 비밀번호 확인
    if not verify_password(password_data.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # 새 비밀번호가 현재 비밀번호와 같은지 확인
    if verify_password(password_data.new_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    # 비밀번호 변경
    user.hashed_password = get_password_hash(password_data.new_password)
    user.updated_at = datetime.now(timezone.utc)

    db.commit()

    # 감사 로그 생성
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log_user_password_change(
        db=db,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        app_id=app_id,
    )

    return {"message": "Password changed successfully"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("users", "read")),
):
    """
    특정 사용자 조회 (관리자 전용)

    Args:
        user_id: 사용자 ID

    Returns:
        UserResponse: 사용자 정보

    Raises:
        HTTPException: 사용자를 찾을 수 없는 경우 (404)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    request: Request,
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("users", "write")),
):
    """
    사용자 정보 수정 (관리자 전용)

    Args:
        user_id: 사용자 ID
        user_data: 수정할 정보

    Returns:
        UserResponse: 수정된 사용자 정보

    Raises:
        HTTPException: 사용자를 찾을 수 없거나 이메일이 중복된 경우
    """
    # 사용자 조회
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 이메일 중복 확인
    if user_data.email and user_data.email != user.email:
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일 주소입니다. 다른 이메일을 사용해 주세요.",
            )

    # 변경 사항 추적
    changes = {}
    if user_data.username is not None and user_data.username != user.username:
        changes["username"] = {"old": user.username, "new": user_data.username}
        user.username = user_data.username
    if user_data.email is not None and user_data.email != user.email:
        changes["email"] = {"old": user.email, "new": user_data.email}
        user.email = user_data.email
    if user_data.is_active is not None and user_data.is_active != user.is_active:
        changes["is_active"] = {"old": user.is_active, "new": user_data.is_active}
        user.is_active = user_data.is_active
    if user_data.company_id is not None and user_data.company_id != user.company_id:
        changes["company_id"] = {"old": user.company_id, "new": user_data.company_id}
        user.company_id = user_data.company_id
    if (
        user_data.department_id is not None
        and user_data.department_id != user.department_id
    ):
        changes["department_id"] = {
            "old": user.department_id,
            "new": user_data.department_id,
        }
        user.department_id = user_data.department_id

    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    # 감사 로그 생성 (변경 사항이 있는 경우에만)
    if changes:
        app_id = (
            getattr(request.app.state, "app_id", None)
            if hasattr(request.app, "state")
            else None
        )
        log_user_update(
            db=db,
            user=user,
            updated_by=current_admin,
            changes=changes,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            app_id=app_id,
        )

    return user


# ── Group Membership Endpoints ──────────────────────────────────────


class SetUserGroupsRequest(BaseModel):
    group_ids: list[int] = Field(..., description="할당할 그룹 ID 목록")


@router.put("/{user_id}/groups")
async def set_user_groups(
    user_id: int,
    req: SetUserGroupsRequest,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """사용자의 그룹 소속 일괄 설정"""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    # org_admin 위임 검증
    if current_admin.role == UserRole.ORG_ADMIN and target.role != UserRole.USER:
        raise HTTPException(
            403, "운영관리자는 일반사용자에게만 그룹을 할당할 수 있습니다"
        )

    # 기존 멤버십 삭제
    db.query(UserGroupMembership).filter(
        UserGroupMembership.user_id == user_id
    ).delete()

    # 새 멤버십 추가
    for gid in req.group_ids:
        group = db.query(PermissionGroup).filter(PermissionGroup.id == gid).first()
        if not group:
            continue
        membership = UserGroupMembership(
            user_id=user_id,
            permission_group_id=gid,
            assigned_by=current_admin.id,
        )
        db.add(membership)

    db.commit()
    return {"message": "그룹 소속이 설정되었습니다", "group_ids": req.group_ids}


@router.get("/{user_id}/groups")
async def get_user_groups(
    user_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """사용자의 소속 그룹 목록"""
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
            .filter(PermissionGroup.id == m.permission_group_id)
            .first()
        )
        if group:
            groups.append(
                {
                    "id": group.id,
                    "name": group.name,
                    "description": group.description,
                    "is_default": group.is_default,
                    "assigned_by": m.assigned_by,
                    "created_at": m.created_at,
                }
            )

    return {"user_id": user_id, "groups": groups}


@router.get("/{user_id}/effective-permissions")
async def get_user_effective_permissions(
    user_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_admin_or_above()),
):
    """사용자의 유효 권한 (그룹 + 개인 MAX) 조회"""
    from v_platform.services.permission_service import PermissionService

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    if target.role == UserRole.SYSTEM_ADMIN:
        # system_admin은 모든 메뉴에 write 권한
        from v_platform.models.menu_item import MenuItem

        all_menus = db.query(MenuItem).filter(MenuItem.is_active.is_(True)).all()
        return {
            "user_id": user_id,
            "role": "system_admin",
            "effective_permissions": [
                {
                    "menu_item_id": m.id,
                    "permission_key": m.permission_key,
                    "access_level": "write",
                    "source": "personal",
                    "group_names": [],
                }
                for m in all_menus
            ],
        }

    effective = PermissionService.get_effective_permissions_for_user(db, user_id)

    # menu 정보 보강 → 배열로 변환
    from v_platform.models.menu_item import MenuItem

    effective_permissions = []
    for menu_id, info in effective.items():
        menu = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
        effective_permissions.append(
            {
                "menu_item_id": menu_id,
                "permission_key": menu.permission_key if menu else None,
                "access_level": info.get("level", "none"),
                "source": info.get("source", "personal"),
                "group_names": info.get("group_names", []),
            }
        )

    return {
        "user_id": user_id,
        "role": target.role.value if hasattr(target.role, "value") else target.role,
        "effective_permissions": effective_permissions,
    }


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_permission("users", "write")),
):
    """
    사용자 삭제 (관리자 전용)

    Args:
        user_id: 사용자 ID

    Raises:
        HTTPException: 사용자를 찾을 수 없거나 자기 자신을 삭제하려는 경우
    """
    # 자기 자신 삭제 방지
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    # 사용자 조회
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 감사 로그 생성 (삭제 전에 정보 저장)
    user_email = user.email
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log_user_delete(
        db=db,
        user_email=user_email,
        user_id=user.id,
        deleted_by=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        app_id=app_id,
    )

    # 사용자 삭제
    db.delete(user)
    db.commit()

    # 성공 알림 전송
    await NotificationService.notify_warning(
        category="user",
        title="사용자 삭제됨",
        message=f"사용자 '{user_email}'가 삭제되었습니다.",
        source="user_api",
        metadata={"user_email": user_email, "deleted_by": current_admin.username},
    )


@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    request: Request,
    user_id: int,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db_session),
    current_admin: User = Depends(require_system_admin()),
):
    """
    사용자 역할 변경 (system_admin 전용)

    Args:
        user_id: 사용자 ID
        role_data: 새로운 역할

    Returns:
        UserResponse: 수정된 사용자 정보

    Raises:
        HTTPException: 사용자를 찾을 수 없거나 자기 자신의 역할을 변경하려는 경우
    """
    # 자기 자신의 역할 변경 방지
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    # 사용자 조회
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # 역할 변경 및 로그 생성
    old_role = user.role.value if isinstance(user.role, UserRole) else user.role
    new_role = (
        role_data.role.value if isinstance(role_data.role, UserRole) else role_data.role
    )

    user.role = role_data.role
    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    # 역할 변경에 맞는 기본 권한 그룹 자동 동기화
    from v_platform.services.permission_service import PermissionService

    PermissionService.sync_default_group_for_user(
        db, user, assigned_by_id=current_admin.id
    )
    db.refresh(user)

    # 감사 로그 생성
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log_user_role_change(
        db=db,
        user=user,
        old_role=old_role,
        new_role=new_role,
        changed_by=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        app_id=app_id,
    )

    # 성공 알림 전송
    await NotificationService.notify_warning(
        category="user",
        title="사용자 권한 변경됨",
        message=f"사용자 '{user.username}'의 권한이 {old_role}에서 {new_role}(으)로 변경되었습니다.",
        source="user_api",
        metadata={
            "user_id": user.id,
            "username": user.username,
            "old_role": old_role,
            "new_role": new_role,
            "changed_by": current_admin.username,
        },
        link="/users",
    )

    return user
