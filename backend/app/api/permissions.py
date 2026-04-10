"""
Permission Management API

권한 조회·부여·매트릭스
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.models.user import User, UserRole
from app.utils.auth import get_current_user, require_admin_or_above
from app.utils.audit_logger import log_permission_update

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


# ── Schemas ──────────────────────────────────────────────────────────
class PermissionGrant(BaseModel):
    menu_item_id: int
    access_level: str  # "none" | "read" | "write"


class SetPermissionsRequest(BaseModel):
    permissions: list[PermissionGrant]


# ── Endpoints ────────────────────────────────────────────────────────
@router.get("/me")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """내 권한 목록"""
    from app.services.permission_service import PermissionService

    perms = PermissionService.get_user_permissions(db, current_user)
    return {
        "role": current_user.role.value
        if hasattr(current_user.role, "value")
        else current_user.role,
        "permissions": perms,
    }


@router.get("/user/{user_id}")
async def get_user_permissions(
    user_id: int,
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """특정 사용자의 권한 목록 (system_admin, org_admin)"""
    from app.services.permission_service import PermissionService

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    # org_admin은 일반 사용자만 조회 가능
    if current_user.role == UserRole.ORG_ADMIN and target_user.role != UserRole.USER:
        raise HTTPException(403, "운영관리자는 일반사용자의 권한만 조회할 수 있습니다")

    perms = PermissionService.get_permissions_for_user(db, user_id)
    return {
        "user_id": user_id,
        "role": target_user.role.value
        if hasattr(target_user.role, "value")
        else target_user.role,
        "permissions": perms,
    }


@router.put("/user/{user_id}")
async def set_user_permissions(
    request: Request,
    user_id: int,
    req: SetPermissionsRequest,
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """사용자 권한 일괄 설정 (위임 검증 포함)"""
    from app.services.permission_service import PermissionService

    grants = [g.model_dump() for g in req.permissions]

    # 대상 사용자 조회 (감사 로그용)
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    try:
        results = PermissionService.set_user_permissions(
            db, user_id, grants, current_user
        )

        log_permission_update(
            db=db,
            actor=current_user,
            target_user_id=user_id,
            target_user_email=target_user.email,
            grants=grants,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

        return {"message": "권한 설정 완료", "permissions": results}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.get("/matrix")
async def get_permission_matrix(
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """전체 사용자×메뉴 권한 매트릭스 (개인 권한만)"""
    from app.services.permission_service import PermissionService

    matrix = PermissionService.get_permission_matrix(db, current_user)
    return matrix


@router.get("/effective-matrix")
async def get_effective_matrix(
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """유효 권한 매트릭스 (그룹+개인 통합, source 포함)"""
    from app.services.permission_service import PermissionService

    return PermissionService.get_effective_matrix(db, current_user)


@router.get("/by-menu/{menu_item_id}")
async def get_permissions_by_menu(
    menu_item_id: int,
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """특정 메뉴에 대한 모든 사용자 권한 조회"""
    from app.services.permission_service import PermissionService
    from app.models.menu_item import MenuItem

    menu = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if not menu:
        raise HTTPException(404, "메뉴를 찾을 수 없습니다")

    users_perms = PermissionService.get_users_by_menu(db, menu_item_id)
    return {
        "menu_item_id": menu_item_id,
        "menu_label": menu.label,
        "permission_key": menu.permission_key,
        "users": users_perms,
    }


@router.put("/by-menu/{menu_item_id}")
async def set_permissions_by_menu(
    request: Request,
    menu_item_id: int,
    req: SetPermissionsRequest,
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """특정 메뉴에 대한 여러 사용자 개인 권한 일괄 설정"""
    from app.models.menu_item import MenuItem
    from app.models.user_permission import UserPermission

    menu = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if not menu:
        raise HTTPException(404, "메뉴를 찾을 수 없습니다")

    # req.permissions 의 각 항목은 {"menu_item_id": user_id, "access_level": level} 형태가 아님
    # 메뉴별 설정이므로 별도 스키마가 필요하지만, 기존 스키마 재사용하여 menu_item_id를 user_id로 활용
    # → 별도 request body 정의
    results = []
    for grant in req.permissions:
        user_id = grant.menu_item_id  # 메뉴별 뷰에서는 user_id로 사용
        access_level = grant.access_level

        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            continue

        # 위임 검증
        if current_user.role == UserRole.ORG_ADMIN and target.role != UserRole.USER:
            continue

        existing = (
            db.query(UserPermission)
            .filter(
                UserPermission.user_id == user_id,
                UserPermission.menu_item_id == menu_item_id,
            )
            .first()
        )

        if existing:
            existing.access_level = access_level
            existing.granted_by = current_user.id
        else:
            perm = UserPermission(
                user_id=user_id,
                menu_item_id=menu_item_id,
                access_level=access_level,
                granted_by=current_user.id,
            )
            db.add(perm)

        results.append({"user_id": user_id, "access_level": access_level})

    db.commit()
    return {"message": "메뉴별 권한 설정 완료", "count": len(results)}


class BulkGroupAssignRequest(BaseModel):
    user_ids: list[int]


@router.put("/bulk/by-group/{group_id}")
async def bulk_assign_group(
    group_id: int,
    req: BulkGroupAssignRequest,
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """그룹 템플릿을 여러 사용자에게 일괄 적용"""
    from app.services.permission_service import PermissionService

    try:
        PermissionService.apply_group_template(db, group_id, req.user_ids, current_user)
        return {
            "message": "그룹 일괄 할당 완료",
            "group_id": group_id,
            "user_count": len(req.user_ids),
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))
