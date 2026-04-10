"""시스템 설정 API 엔드포인트

시스템 전역 설정 관리 API
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.schemas.system_settings import (
    SystemSettingsResponse,
    SystemSettingsUpdate,
)
from app.utils.auth import get_current_user, require_permission

router = APIRouter(prefix="/api/system-settings", tags=["system-settings"])


@router.get("/", response_model=SystemSettingsResponse)
async def get_system_settings(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SystemSettings:
    """시스템 설정 조회 (모든 인증된 사용자)

    Args:
        db: 데이터베이스 세션
        current_user: 현재 사용자

    Returns:
        SystemSettings: 시스템 설정

    Raises:
        HTTPException: 설정 조회 실패 시
    """
    settings = db.query(SystemSettings).first()
    if not settings:
        # 기본 설정 생성
        settings = SystemSettings(
            manual_enabled=True, manual_url="http://localhost:3000"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/", response_model=SystemSettingsResponse)
async def update_system_settings(
    update: SystemSettingsUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("settings", "write")),
) -> SystemSettings:
    """시스템 설정 업데이트 (settings write 권한 필요)

    Args:
        update: 업데이트할 설정
        db: 데이터베이스 세션
        current_user: 현재 사용자

    Returns:
        SystemSettings: 업데이트된 시스템 설정

    Raises:
        HTTPException: 권한 없음 (403) 또는 잘못된 URL 형식 (400)
    """
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)

    # URL 검증
    if update.manual_url is not None:
        if not (
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

    db.commit()
    db.refresh(settings)
    return settings
