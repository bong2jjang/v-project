"""
User Schemas

사용자 인증 및 관리를 위한 Pydantic 스키마
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, model_validator
from v_platform.models.user import UserRole


class UserCreate(BaseModel):
    """사용자 생성 스키마 (회원가입)"""

    email: EmailStr = Field(..., description="이메일 주소")
    username: str = Field(..., min_length=2, max_length=100, description="사용자 이름")
    password: str = Field(
        ..., min_length=8, max_length=100, description="비밀번호 (최소 8자)"
    )


class AdminUserCreate(BaseModel):
    """관리자가 사용자를 직접 생성하는 스키마"""

    email: EmailStr = Field(..., description="이메일 주소")
    username: str = Field(..., min_length=2, max_length=100, description="사용자 이름")
    password: str = Field(
        ..., min_length=8, max_length=100, description="비밀번호 (최소 8자)"
    )
    role: UserRole = Field(default=UserRole.USER, description="역할")
    is_active: bool = Field(default=True, description="활성 상태")
    company_id: Optional[int] = Field(None, description="소속 회사 ID")
    department_id: Optional[int] = Field(None, description="소속 부서 ID")


class UserLogin(BaseModel):
    """사용자 로그인 스키마"""

    email: EmailStr = Field(..., description="이메일 주소")
    password: str = Field(..., description="비밀번호")
    remember_me: bool = Field(default=False, description="로그인 유지 (30일)")
    device_name: Optional[str] = Field(None, description="디바이스 이름")
    device_fingerprint: Optional[str] = Field(None, description="디바이스 핑거프린트")


class GroupBriefResponse(BaseModel):
    """그룹 간략 정보 (UserResponse 내 사용)"""

    id: int
    name: str
    is_default: bool = False

    class Config:
        from_attributes = True


class CompanyBriefResponse(BaseModel):
    """회사 간략 정보"""

    id: int
    name: str
    code: str

    class Config:
        from_attributes = True


class DepartmentBriefResponse(BaseModel):
    """부서 간략 정보"""

    id: int
    name: str
    code: Optional[str] = None

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """사용자 응답 스키마 (비밀번호 제외)"""

    id: int
    email: str
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    auth_method: Optional[str] = "local"
    sso_provider: Optional[str] = None
    avatar_url: Optional[str] = None
    start_page: str = ""
    theme: str = "system"
    color_preset: str = "blue"
    company_id: Optional[int] = None
    department_id: Optional[int] = None
    company: Optional[CompanyBriefResponse] = None
    department: Optional[DepartmentBriefResponse] = None
    groups: list[GroupBriefResponse] = []

    @model_validator(mode="before")
    @classmethod
    def extract_groups(cls, data):
        """ORM의 group_memberships → groups 변환"""
        if hasattr(data, "group_memberships"):
            memberships = data.group_memberships or []
            data.__dict__["groups"] = [
                {
                    "id": m.group.id,
                    "name": m.group.name,
                    "is_default": m.group.is_default,
                }
                for m in memberships
                if m.group is not None
            ]
        return data

    class Config:
        from_attributes = True  # Pydantic v2


class Token(BaseModel):
    """JWT 토큰 응답"""

    access_token: str = Field(..., description="JWT 액세스 토큰")
    token_type: str = Field(default="bearer", description="토큰 타입")
    expires_at: datetime = Field(..., description="토큰 만료 시간")
    user: UserResponse = Field(..., description="사용자 정보")
    csrf_token: Optional[str] = Field(None, description="CSRF 토큰")


class TokenData(BaseModel):
    """JWT 토큰 데이터 (디코딩된 페이로드)"""

    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[str] = None


class UserUpdate(BaseModel):
    """사용자 정보 수정 스키마 (관리자용)"""

    username: Optional[str] = Field(
        None, min_length=2, max_length=100, description="사용자 이름"
    )
    email: Optional[EmailStr] = Field(None, description="이메일 주소")
    is_active: Optional[bool] = Field(None, description="활성 상태")
    company_id: Optional[int] = Field(None, description="소속 회사 ID")
    department_id: Optional[int] = Field(None, description="소속 부서 ID")


class UserUpdateMe(BaseModel):
    """본인 정보 수정 스키마"""

    username: Optional[str] = Field(
        None, min_length=2, max_length=100, description="사용자 이름"
    )
    start_page: Optional[str] = Field(
        None, max_length=255, description="시작 페이지 경로"
    )
    theme: Optional[str] = Field(
        None, pattern=r"^(light|dark|system)$", description="테마 (light/dark/system)"
    )
    color_preset: Optional[str] = Field(
        None, pattern=r"^(blue|indigo|rose)$", description="브랜드 색상 프리셋"
    )


class UserPasswordChange(BaseModel):
    """비밀번호 변경 스키마"""

    current_password: str = Field(..., description="현재 비밀번호")
    new_password: str = Field(
        ..., min_length=8, max_length=100, description="새 비밀번호 (최소 8자)"
    )


class UserRoleUpdate(BaseModel):
    """사용자 역할 변경 스키마 (관리자 전용)"""

    role: UserRole = Field(..., description="새로운 역할 (admin 또는 user)")


class UserListResponse(BaseModel):
    """사용자 목록 응답 스키마 (페이징)"""

    users: list[UserResponse] = Field(..., description="사용자 목록")
    total: int = Field(..., description="전체 사용자 수")
    page: int = Field(..., description="현재 페이지")
    per_page: int = Field(..., description="페이지당 항목 수")
    total_pages: int = Field(..., description="전체 페이지 수")


class RefreshTokenRequest(BaseModel):
    """Refresh Token 요청 스키마"""

    refresh_token: str = Field(..., description="Refresh Token")


class DeviceInfo(BaseModel):
    """디바이스 정보 스키마"""

    id: int = Field(..., description="디바이스 ID")
    device_name: str = Field(..., description="디바이스 이름")
    device_fingerprint: Optional[str] = Field(None, description="디바이스 핑거프린트")
    ip_address: Optional[str] = Field(None, description="IP 주소")
    app_id: Optional[str] = Field(None, description="로그인 출처 앱")
    last_used_at: Optional[datetime] = Field(None, description="마지막 사용 시간")
    created_at: Optional[datetime] = Field(None, description="생성 시간")
    expires_at: Optional[datetime] = Field(None, description="만료 시간")


# 비밀번호 재설정 스키마


class PasswordResetRequest(BaseModel):
    """비밀번호 재설정 요청 스키마"""

    email: EmailStr = Field(..., description="이메일 주소")


class PasswordResetVerifyResponse(BaseModel):
    """비밀번호 재설정 토큰 검증 응답 스키마"""

    valid: bool = Field(..., description="토큰 유효 여부")
    email: str = Field(..., description="사용자 이메일")


class PasswordResetConfirm(BaseModel):
    """비밀번호 재설정 확인 스키마"""

    token: str = Field(..., description="재설정 토큰")
    new_password: str = Field(
        ..., min_length=8, max_length=100, description="새 비밀번호 (최소 8자)"
    )


class MessageResponse(BaseModel):
    """메시지 응답 스키마"""

    message: str = Field(..., description="응답 메시지")
