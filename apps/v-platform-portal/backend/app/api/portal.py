"""Portal API — app listing, health checks, sitemap, CRUD"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.utils.auth import get_current_user, require_system_admin
from v_platform.models.user import User

from app.services.app_registry import app_registry, AppHealth

router = APIRouter(prefix="/api/portal", tags=["portal"])


# ── Response / Request schemas ──────────────────────────────────────

class AppResponse(BaseModel):
    id: int | None = None
    app_id: str
    display_name: str
    description: str
    icon: str
    frontend_url: str
    api_url: str
    health_endpoint: str = "/api/health"
    sort_order: int = 0
    is_active: bool = True

    model_config = {"from_attributes": True}


class AppCreateRequest(BaseModel):
    app_id: str
    display_name: str
    description: str = ""
    icon: str = "Box"
    frontend_url: str
    api_url: str
    health_endpoint: str = "/api/health"
    sort_order: int = 0
    is_active: bool = True


class AppUpdateRequest(BaseModel):
    display_name: str | None = None
    description: str | None = None
    icon: str | None = None
    frontend_url: str | None = None
    api_url: str | None = None
    health_endpoint: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class AppHealthResponse(BaseModel):
    app_id: str
    status: str
    services: dict = {}
    response_time_ms: float | None = None


class SitemapEntry(BaseModel):
    app_id: str
    display_name: str
    menus: list[dict] = []


# ── READ endpoints (기존) ───────────────────────────────────────────

@router.get("/apps", response_model=list[AppResponse])
async def list_apps():
    """등록된 앱 목록 (DB 기반)"""
    return [
        AppResponse(
            id=a.get("id"),
            app_id=a["app_id"],
            display_name=a["display_name"],
            description=a["description"],
            icon=a["icon"],
            frontend_url=a["frontend_url"],
            api_url=a["api_url"],
            health_endpoint=a.get("health_endpoint", "/api/health"),
            sort_order=a.get("sort_order", 0),
            is_active=a.get("is_active", True),
        )
        for a in app_registry.get_all_dicts()
    ]


@router.get("/health", response_model=list[AppHealthResponse])
async def check_all_health():
    """전체 앱 헬스 체크"""
    results = await app_registry.check_all_health()
    return [
        AppHealthResponse(
            app_id=h.app_id,
            status=h.status,
            services=h.services,
            response_time_ms=h.response_time_ms,
        )
        for h in results
    ]


@router.get("/health/{app_id}", response_model=AppHealthResponse)
async def check_app_health(app_id: str):
    """특정 앱 헬스 체크"""
    h = await app_registry.check_health(app_id)
    return AppHealthResponse(
        app_id=h.app_id,
        status=h.status,
        services=h.services,
        response_time_ms=h.response_time_ms,
    )


@router.get("/sitemap", response_model=list[SitemapEntry])
async def get_sitemap():
    """전체 앱 사이트맵 (각 앱의 메뉴 통합)"""
    import httpx

    entries = []
    for a in app_registry.get_all_dicts():
        menus = []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{a['api_url']}/api/menus")
                if resp.status_code == 200:
                    menus = resp.json()
        except Exception:
            pass

        entries.append(SitemapEntry(
            app_id=a["app_id"],
            display_name=a["display_name"],
            menus=menus if isinstance(menus, list) else [],
        ))

    return entries


# ── CRUD endpoints (system_admin 전용) ──────────────────────────────

@router.get("/apps/all", response_model=list[AppResponse])
async def list_all_apps(
    _user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """모든 앱 목록 (비활성 포함, 관리용)"""
    from app.models.portal_app import PortalApp

    rows = db.query(PortalApp).order_by(PortalApp.sort_order, PortalApp.id).all()
    return [AppResponse.model_validate(r) for r in rows]


@router.post("/apps", response_model=AppResponse, status_code=status.HTTP_201_CREATED)
async def create_app(
    body: AppCreateRequest,
    user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """앱 등록"""
    from app.models.portal_app import PortalApp

    existing = db.query(PortalApp).filter(PortalApp.app_id == body.app_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"app_id '{body.app_id}' 이(가) 이미 존재합니다.",
        )

    row = PortalApp(
        app_id=body.app_id,
        display_name=body.display_name,
        description=body.description,
        icon=body.icon,
        frontend_url=body.frontend_url,
        api_url=body.api_url,
        health_endpoint=body.health_endpoint,
        sort_order=body.sort_order,
        is_active=body.is_active,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # Sync to in-memory registry
    app_registry.reload_from_db(db)

    return AppResponse.model_validate(row)


@router.put("/apps/{app_id}", response_model=AppResponse)
async def update_app(
    app_id: str,
    body: AppUpdateRequest,
    user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """앱 수정"""
    from app.models.portal_app import PortalApp

    row = db.query(PortalApp).filter(PortalApp.app_id == app_id).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"앱 '{app_id}'을(를) 찾을 수 없습니다.",
        )

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(row, key, value)
    row.updated_by = user.id

    db.commit()
    db.refresh(row)

    app_registry.reload_from_db(db)

    return AppResponse.model_validate(row)


@router.delete("/apps/{app_id}")
async def delete_app(
    app_id: str,
    _user: User = Depends(require_system_admin()),
    db: Session = Depends(get_db_session),
):
    """앱 삭제"""
    from app.models.portal_app import PortalApp

    row = db.query(PortalApp).filter(PortalApp.app_id == app_id).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"앱 '{app_id}'을(를) 찾을 수 없습니다.",
        )

    db.delete(row)
    db.commit()

    app_registry.reload_from_db(db)

    return {"message": f"앱 '{app_id}'이(가) 삭제되었습니다."}
