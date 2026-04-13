"""시스템 설정 API 엔드포인트

시스템 전역 설정 관리 API
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.system_settings import SystemSettings
from v_platform.models.user import User
from v_platform.schemas.system_settings import (
    SystemSettingsResponse,
    SystemSettingsUpdate,
)
from v_platform.utils.auth import get_current_user, require_permission

router = APIRouter(prefix="/api/system-settings", tags=["system-settings"])


class PublicBrandingResponse(BaseModel):
    """인증 불필요한 브랜딩 정보 (로그인 페이지용)"""

    app_title: str | None = None
    app_description: str | None = None
    app_logo_url: str | None = None


@router.get("/branding", response_model=PublicBrandingResponse)
async def get_public_branding(
    request: Request,
    db: Session = Depends(get_db_session),
) -> PublicBrandingResponse:
    """공개 브랜딩 정보 조회 (인증 불필요)

    로그인/회원가입 페이지에서 앱 타이틀·설명·로고를 표시하기 위해 사용합니다.
    """
    app_id = request.app.state.app_id if hasattr(request.app.state, "app_id") else None

    settings = None
    if app_id:
        settings = (
            db.query(SystemSettings).filter(SystemSettings.app_id == app_id).first()
        )
    if not settings:
        settings = (
            db.query(SystemSettings).filter(SystemSettings.app_id.is_(None)).first()
        )
    if not settings:
        return PublicBrandingResponse()

    return PublicBrandingResponse(
        app_title=settings.app_title,
        app_description=settings.app_description,
        app_logo_url=settings.app_logo_url,
    )


@router.get("/", response_model=SystemSettingsResponse)
async def get_system_settings(
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SystemSettings:
    """시스템 설정 조회 (모든 인증된 사용자)

    Args:
        request: HTTP 요청
        db: 데이터베이스 세션
        current_user: 현재 사용자

    Returns:
        SystemSettings: 시스템 설정

    Raises:
        HTTPException: 설정 조회 실패 시
    """
    app_id = request.app.state.app_id if hasattr(request.app.state, "app_id") else None

    # Try app-specific settings first, then fall back to global
    settings = None
    if app_id:
        settings = (
            db.query(SystemSettings).filter(SystemSettings.app_id == app_id).first()
        )
    if not settings:
        settings = (
            db.query(SystemSettings).filter(SystemSettings.app_id.is_(None)).first()
        )
    if not settings:
        # 기본 설정 생성
        settings = SystemSettings(
            manual_enabled=True, manual_url="http://127.0.0.1:3000"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/", response_model=SystemSettingsResponse)
async def update_system_settings(
    request: Request,
    update: SystemSettingsUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("settings", "write")),
) -> SystemSettings:
    """시스템 설정 업데이트 (settings write 권한 필요)

    Args:
        request: HTTP 요청
        update: 업데이트할 설정
        db: 데이터베이스 세션
        current_user: 현재 사용자

    Returns:
        SystemSettings: 업데이트된 시스템 설정

    Raises:
        HTTPException: 권한 없음 (403) 또는 잘못된 URL 형식 (400)
    """
    app_id = request.app.state.app_id if hasattr(request.app.state, "app_id") else None

    # 앱 격리: 앱 컨텍스트라면 앱별 레코드만 사용. 없으면 생성(전역으로 폴백 금지)
    # 전역 컨텍스트(app_id 없음)에서만 전역 레코드(app_id IS NULL) 수정
    if app_id:
        settings = (
            db.query(SystemSettings).filter(SystemSettings.app_id == app_id).first()
        )
        if not settings:
            # 전역 레코드를 템플릿 삼아 앱별 레코드 생성 (상속)
            global_settings = (
                db.query(SystemSettings)
                .filter(SystemSettings.app_id.is_(None))
                .first()
            )
            settings = SystemSettings(
                app_id=app_id,
                manual_enabled=(
                    global_settings.manual_enabled if global_settings else True
                ),
                manual_url=(
                    global_settings.manual_url
                    if global_settings
                    else "http://127.0.0.1:3000"
                ),
                default_start_page=(
                    global_settings.default_start_page if global_settings else "/"
                ),
                app_title=global_settings.app_title if global_settings else None,
                app_description=(
                    global_settings.app_description if global_settings else None
                ),
                app_logo_url=(
                    global_settings.app_logo_url if global_settings else None
                ),
            )
            db.add(settings)
    else:
        settings = (
            db.query(SystemSettings).filter(SystemSettings.app_id.is_(None)).first()
        )
        if not settings:
            settings = SystemSettings()
            db.add(settings)

    # URL 검증 (빈 문자열은 "미설정"으로 허용)
    if update.manual_url is not None:
        if update.manual_url and not (
            update.manual_url.startswith("http://")
            or update.manual_url.startswith("https://")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid URL format. Must start with http:// or https://",
            )
        settings.manual_url = update.manual_url

    if update.manual_enabled is not None:
        settings.manual_enabled = update.manual_enabled

    if update.default_start_page is not None:
        settings.default_start_page = update.default_start_page

    # 앱 브랜딩
    if update.app_title is not None:
        settings.app_title = update.app_title or None
    if update.app_description is not None:
        settings.app_description = update.app_description or None
    if update.app_logo_url is not None:
        settings.app_logo_url = update.app_logo_url or None

    db.commit()
    db.refresh(settings)
    return settings
