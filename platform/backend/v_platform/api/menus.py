"""
Menu Management API

메뉴 CRUD + 순서 변경
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from typing import Optional
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.models.menu_item import MenuItem
from v_platform.utils.auth import (
    get_current_user,
    require_system_admin,
    require_admin_or_above,
)
from v_platform.utils.audit_logger import log_menu_action
from v_platform.models.audit_log import AuditAction

router = APIRouter(prefix="/api/menus", tags=["menus"])


# ── Schemas ──────────────────────────────────────────────────────────
class MenuCreateRequest(BaseModel):
    permission_key: str
    label: str
    icon: Optional[str] = None
    path: str
    menu_type: str = "custom_iframe"  # custom_iframe | custom_link
    iframe_url: Optional[str] = None
    iframe_fullscreen: bool = False
    open_in_new_tab: bool = False
    parent_key: Optional[str] = None
    sort_order: int = 0
    section: str = "custom"  # basic | admin | custom

    @field_validator("menu_type")
    @classmethod
    def validate_menu_type(cls, v: str) -> str:
        if v not in ("custom_iframe", "custom_link", "menu_group"):
            raise ValueError(
                "커스텀 메뉴만 생성할 수 있습니다 (custom_iframe, custom_link, menu_group)"
            )
        return v

    @field_validator("iframe_url")
    @classmethod
    def validate_iframe_url(cls, v: Optional[str], info) -> Optional[str]:
        if v and v.startswith("javascript:"):
            raise ValueError("javascript: URL은 허용되지 않습니다")
        return v


class MenuUpdateRequest(BaseModel):
    label: Optional[str] = None
    icon: Optional[str] = None
    path: Optional[str] = None
    iframe_url: Optional[str] = None
    iframe_fullscreen: Optional[bool] = None
    open_in_new_tab: Optional[bool] = None
    parent_key: Optional[str] = None
    sort_order: Optional[int] = None
    section: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("iframe_url")
    @classmethod
    def validate_iframe_url(cls, v: Optional[str]) -> Optional[str]:
        if v and v.startswith("javascript:"):
            raise ValueError("javascript: URL은 허용되지 않습니다")
        return v


class MenuReorderRequest(BaseModel):
    orders: list[dict]  # [{"id": 1, "sort_order": 100}, ...]


# ── Endpoints ────────────────────────────────────────────────────────
@router.get("")
async def get_my_menus(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """현재 사용자가 접근 가능한 메뉴 목록"""
    from v_platform.services.permission_service import PermissionService

    menus = PermissionService.get_accessible_menus(db, current_user)
    return {"menus": menus}


@router.get("/all")
async def get_all_menus(
    current_user: User = Depends(require_admin_or_above()),
    db: Session = Depends(get_db_session),
):
    """전체 메뉴 목록 (관리용, system_admin + org_admin)"""
    menus = db.query(MenuItem).order_by(MenuItem.sort_order).all()
    return {"menus": [m.to_dict() for m in menus]}


@router.post("")
async def create_menu(
    request: Request,
    req: MenuCreateRequest,
    current_user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """커스텀 메뉴 등록 (system_admin 전용)"""
    # 중복 체크
    existing = (
        db.query(MenuItem).filter(MenuItem.permission_key == req.permission_key).first()
    )
    if existing:
        raise HTTPException(
            400, f"permission_key '{req.permission_key}' 가 이미 존재합니다"
        )

    menu = MenuItem(
        permission_key=req.permission_key,
        label=req.label,
        icon=req.icon,
        path=req.path,
        menu_type=req.menu_type,
        iframe_url=req.iframe_url,
        iframe_fullscreen=req.iframe_fullscreen,
        open_in_new_tab=req.open_in_new_tab,
        parent_key=req.parent_key,
        sort_order=req.sort_order,
        section=req.section,
        created_by=current_user.id,
    )
    db.add(menu)
    db.commit()
    db.refresh(menu)

    log_menu_action(
        db=db,
        action=AuditAction.MENU_CREATE,
        actor=current_user,
        menu_label=menu.label,
        menu_id=menu.id,
        details={
            "menu_type": menu.menu_type,
            "permission_key": menu.permission_key,
            "path": menu.path,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return menu.to_dict()


@router.put("/reorder")
async def reorder_menus(
    request: Request,
    req: MenuReorderRequest,
    current_user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """메뉴 순서 변경 (system_admin 전용)"""
    for item in req.orders:
        menu = db.query(MenuItem).filter(MenuItem.id == item["id"]).first()
        if menu:
            menu.sort_order = item["sort_order"]
            menu.updated_by = current_user.id
    db.commit()

    log_menu_action(
        db=db,
        action=AuditAction.MENU_REORDER,
        actor=current_user,
        menu_label="(bulk reorder)",
        details={"orders": req.orders},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "순서 변경 완료"}


@router.put("/{menu_id}")
async def update_menu(
    request: Request,
    menu_id: int,
    req: MenuUpdateRequest,
    current_user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """메뉴 수정 (system_admin 전용)"""
    menu = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not menu:
        raise HTTPException(404, "메뉴를 찾을 수 없습니다")

    changes = req.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(menu, field, value)
    menu.updated_by = current_user.id

    db.commit()
    db.refresh(menu)

    log_menu_action(
        db=db,
        action=AuditAction.MENU_UPDATE,
        actor=current_user,
        menu_label=menu.label,
        menu_id=menu.id,
        details={"changes": changes},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return menu.to_dict()


@router.delete("/{menu_id}")
async def delete_menu(
    request: Request,
    menu_id: int,
    current_user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """커스텀 메뉴 삭제 (built_in 삭제 불가)"""
    menu = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not menu:
        raise HTTPException(404, "메뉴를 찾을 수 없습니다")
    if menu.menu_type == "built_in":
        raise HTTPException(
            400, "기본 메뉴는 삭제할 수 없습니다. 비활성화를 사용하세요."
        )

    menu_label = menu.label
    menu_key = menu.permission_key

    # 메뉴 그룹 삭제 시 하위 메뉴의 parent_key를 null로 리셋
    if menu.menu_type == "menu_group":
        children = (
            db.query(MenuItem).filter(MenuItem.parent_key == menu.permission_key).all()
        )
        for child in children:
            child.parent_key = None

    db.delete(menu)
    db.commit()

    log_menu_action(
        db=db,
        action=AuditAction.MENU_DELETE,
        actor=current_user,
        menu_label=menu_label,
        menu_id=menu_id,
        details={"permission_key": menu_key},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": f"메뉴 '{menu_label}' 삭제 완료"}
