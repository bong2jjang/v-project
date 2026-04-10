"""시스템 설정 스키마

시스템 전역 설정 API 요청/응답 스키마
"""

from pydantic import BaseModel, Field


class SystemSettingsBase(BaseModel):
    """시스템 설정 기본 스키마"""

    manual_enabled: bool = Field(default=True, description="메뉴얼 링크 표시 여부")
    manual_url: str = Field(default="http://localhost:3000", description="메뉴얼 URL")
    default_start_page: str = Field(
        default="/", description="시스템 기본 시작 페이지 경로"
    )


class SystemSettingsUpdate(BaseModel):
    """시스템 설정 업데이트 스키마"""

    manual_enabled: bool | None = None
    manual_url: str | None = None
    default_start_page: str | None = None


class SystemSettingsResponse(SystemSettingsBase):
    """시스템 설정 응답 스키마"""

    id: int

    class Config:
        """Pydantic 설정"""

        from_attributes = True
