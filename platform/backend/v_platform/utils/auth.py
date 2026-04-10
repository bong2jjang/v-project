"""
Authentication Utilities

JWT 토큰 생성, 검증, 비밀번호 해싱 등 인증 관련 유틸리티

NOTE: JWT 토큰 생성/검증은 TokenService를 사용합니다.
이 파일의 create_access_token/verify_token은 하위 호환성을 위해 남겨둡니다.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.schemas.user import TokenData

# JWT 설정 (레거시 - 하위 호환성)
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# 비밀번호 해싱
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 스키마 (토큰 엔드포인트)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_password_hash(password: str) -> str:
    """
    비밀번호 해싱

    Args:
        password: 평문 비밀번호

    Returns:
        해시된 비밀번호
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    비밀번호 검증

    Args:
        plain_password: 평문 비밀번호
        hashed_password: 해시된 비밀번호

    Returns:
        비밀번호 일치 여부
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT 액세스 토큰 생성

    Args:
        data: 토큰에 포함할 데이터 (user_id, email, role 등)
        expires_delta: 토큰 만료 시간 (기본: 24시간)

    Returns:
        JWT 토큰 문자열
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """
    JWT 토큰 검증 및 디코딩 (레거시)

    NOTE: 이 함수는 하위 호환성을 위해 남겨둡니다.
    새 코드는 TokenService.verify_access_token()을 사용하세요.

    Args:
        token: JWT 토큰 문자열

    Returns:
        TokenData: 디코딩된 토큰 데이터

    Raises:
        HTTPException: 토큰이 유효하지 않은 경우
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        role: str = payload.get("role")

        if user_id is None or email is None:
            raise credentials_exception

        token_data = TokenData(user_id=user_id, email=email, role=role)
        return token_data
    except JWTError:
        raise credentials_exception


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db_session),
) -> User:
    """
    현재 로그인한 사용자 조회 (Dependency)

    TokenService를 사용하여 JWT 토큰을 검증합니다.

    Args:
        token: JWT 토큰 (자동으로 헤더에서 추출)
        db: 데이터베이스 세션

    Returns:
        User: 현재 사용자 객체

    Raises:
        HTTPException: 토큰이 유효하지 않거나 사용자를 찾을 수 없는 경우
    """
    # TokenService를 사용하여 토큰 검증
    from v_platform.services.token_service import TokenService

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = TokenService.verify_access_token(token)
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")

        if user_id is None or email is None:
            raise credentials_exception

    except ValueError as e:
        # TokenService가 ValueError를 던지면 401로 변환
        raise credentials_exception from e

    # 사용자 조회
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


async def get_current_active_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    현재 로그인한 관리자 조회 (Dependency) — 레거시 호환

    system_admin + org_admin 모두 통과.
    새 코드는 require_permission()을 사용하세요.
    """
    from v_platform.models.user import UserRole

    if current_user.role not in (
        UserRole.SYSTEM_ADMIN,
        UserRole.ORG_ADMIN,
        "admin",  # 마이그레이션 전 하위 호환
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin role required.",
        )
    return current_user


def require_permission(permission_key: str, level: str = "read"):
    """
    페이지별 권한 체크 의존성 팩토리

    Usage:
        @router.get("/api/channels")
        async def list_channels(user=Depends(require_permission("channels", "read"))):
            ...
    """

    async def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db_session),
    ) -> User:
        from v_platform.models.user import UserRole
        from v_platform.services.permission_service import PermissionService

        # system_admin → 무조건 패스
        if current_user.role == UserRole.SYSTEM_ADMIN:
            return current_user

        if not PermissionService.check_permission(
            db, current_user, permission_key, level
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"'{permission_key}' 메뉴에 대한 '{level}' 권한이 없습니다.",
            )

        return current_user

    return checker


def require_system_admin():
    """system_admin 전용 의존성"""

    async def checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        from v_platform.models.user import UserRole

        if current_user.role != UserRole.SYSTEM_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="시스템 관리자 권한이 필요합니다.",
            )
        return current_user

    return checker


def require_admin_or_above():
    """system_admin + org_admin 의존성"""

    async def checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        from v_platform.models.user import UserRole

        if current_user.role not in (UserRole.SYSTEM_ADMIN, UserRole.ORG_ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="관리자 권한이 필요합니다.",
            )
        return current_user

    return checker
