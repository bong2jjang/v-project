"""Portal API — app listing, health checks, sitemap"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.app_registry import app_registry, RegisteredApp, AppHealth

router = APIRouter(prefix="/api/portal", tags=["portal"])


class AppResponse(BaseModel):
    app_id: str
    display_name: str
    description: str
    icon: str
    frontend_url: str
    api_url: str


class AppHealthResponse(BaseModel):
    app_id: str
    status: str
    services: dict = {}
    response_time_ms: float | None = None


class SitemapEntry(BaseModel):
    app_id: str
    display_name: str
    menus: list[dict] = []


@router.get("/apps", response_model=list[AppResponse])
async def list_apps():
    """등록된 앱 목록"""
    return [
        AppResponse(
            app_id=a.app_id,
            display_name=a.display_name,
            description=a.description,
            icon=a.icon,
            frontend_url=a.frontend_url,
            api_url=a.api_url,
        )
        for a in app_registry.get_all()
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
    for app in app_registry.get_all():
        menus = []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{app.api_url}/api/menus")
                if resp.status_code == 200:
                    menus = resp.json()
        except Exception:
            pass

        entries.append(SitemapEntry(
            app_id=app.app_id,
            display_name=app.display_name,
            menus=menus if isinstance(menus, list) else [],
        ))

    return entries
