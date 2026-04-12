"""
Authentication API

사용자 인증 관련 API 엔드포인트 (로그인, 회원가입, 토큰 갱신)
"""

import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from v_platform.core.database import get_db_session
from v_platform.models.user import User, UserRole
from v_platform.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    DeviceInfo,
    PasswordResetRequest,
    PasswordResetVerifyResponse,
    PasswordResetConfirm,
    MessageResponse,
)
from v_platform.utils.auth import (
    get_password_hash,
    verify_password,
    get_current_user,
)
from v_platform.services.token_service import TokenService
from v_platform.services.password_reset_service import PasswordResetService
from v_platform.utils.audit_logger import log_user_login, log_user_register
from v_platform.middleware.csrf import generate_csrf_token

router = APIRouter(prefix="/api/auth", tags=["authentication"])
limiter = Limiter(key_func=get_remote_address)

# 환경에 따라 쿠키 Secure 플래그 설정 (개발: False, 프로덕션: True)
COOKIE_SECURE = os.getenv("ENVIRONMENT", "development") == "production"


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("3/minute")  # 분당 3회 제한
async def register(
    request: Request, user_data: UserCreate, db: Session = Depends(get_db_session)
):
    """
    회원가입

    새로운 사용자를 생성합니다. 이메일은 고유해야 합니다.
    """
    # 이메일 중복 확인
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일 주소입니다. 다른 이메일을 사용하거나 로그인해 주세요.",
        )

    # 비밀번호 해싱
    hashed_password = get_password_hash(user_data.password)

    # 사용자 생성
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        role=UserRole.USER,  # 기본 역할은 일반 사용자
        is_active=True,
    )

    db.add(new_user)
    db.commit()
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

    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # 분당 5회 제한 (무차별 대입 공격 방지)
async def login(
    request: Request,
    response: Response,
    user_data: UserLogin,
    db: Session = Depends(get_db_session),
):
    """
    로그인

    이메일과 비밀번호로 로그인하고 JWT 토큰을 발급합니다.
    Access Token은 응답 본문으로, Refresh Token은 HttpOnly 쿠키로 전달됩니다.
    """
    # 사용자 조회
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # SSO 전용 계정은 비밀번호 로그인 불가
    if getattr(user, "auth_method", "local") == "sso":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account uses SSO login only. Please use the SSO button to sign in.",
        )

    # 비밀번호 검증
    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # 비활성 계정 확인
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    # 마지막 로그인 시간 업데이트
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # 감사 로그 생성
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log_user_login(
        db=db,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        app_id=app_id,
    )

    # Access Token 생성 (15분)
    access_token, expires_at = TokenService.create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
    )

    # Refresh Token 생성 (7일 or 30일)
    refresh_token = TokenService.create_refresh_token(
        db=db,
        user_id=user.id,
        device_fingerprint=user_data.device_fingerprint,
        device_name=user_data.device_name,
        ip_address=request.client.host if request.client else None,
        remember_me=user_data.remember_me,
    )

    # CSRF 토큰 생성
    csrf_token = generate_csrf_token()

    # Refresh Token을 HttpOnly 쿠키로 설정
    max_age = 30 * 24 * 60 * 60 if user_data.remember_me else 7 * 24 * 60 * 60
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,  # 개발: HTTP OK, 프로덕션: HTTPS만
        samesite="lax",
        max_age=max_age,
        path="/api/auth",  # auth 엔드포인트에서만 전송
    )

    # CSRF 토큰을 쿠키로 설정 (검증용)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # JavaScript에서 읽을 수 있어야 함
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=max_age,
        path="/",
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserResponse.model_validate(user),
        csrf_token=csrf_token,  # 응답에도 포함
    )


@router.post("/login/form", response_model=Token)
async def login_form(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db_session),
):
    """
    로그인 (OAuth2 폼 형식)

    OAuth2PasswordRequestForm을 사용한 로그인 (Swagger UI 호환)
    username 필드에 이메일을 입력합니다.
    """
    # 사용자 조회 (username에 이메일 사용)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 비밀번호 검증
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 비활성 계정 확인
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    # 마지막 로그인 시간 업데이트
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # 감사 로그 생성
    app_id = (
        getattr(request.app.state, "app_id", None)
        if hasattr(request.app, "state")
        else None
    )
    log_user_login(
        db=db,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        app_id=app_id,
    )

    # Access Token 생성 (15분)
    access_token, expires_at = TokenService.create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
    )

    # Refresh Token 생성 (기본 7일, form에서는 remember_me 없음)
    refresh_token = TokenService.create_refresh_token(
        db=db,
        user_id=user.id,
        device_fingerprint=None,
        device_name="Swagger UI",
        ip_address=request.client.host if request.client else None,
        remember_me=False,
    )

    # Refresh Token을 HttpOnly 쿠키로 설정
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
        path="/api/auth",
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    현재 사용자 정보 조회

    로그인한 사용자의 정보를 반환합니다.
    """
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db_session),
):
    """
    토큰 갱신

    Refresh Token을 사용하여 새로운 Access Token과 Refresh Token을 발급합니다.
    Token Rotation 방식으로 기존 Refresh Token은 무효화됩니다.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
        )

    try:
        # 토큰 갱신 및 회전 (Token Rotation)
        new_access_token, new_refresh_token = TokenService.refresh_tokens(
            db=db,
            old_refresh_token=refresh_token,
            ip_address=request.client.host if request.client else None,
        )

        # 사용자 정보 조회 (Access Token 페이로드에서 추출)
        payload = TokenService.verify_access_token(new_access_token)
        user = db.query(User).filter(User.id == payload["user_id"]).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        # CSRF 토큰 생성
        csrf_token = generate_csrf_token()

        # 새 Refresh Token을 HttpOnly 쿠키로 설정
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite="lax",
            max_age=30 * 24 * 60 * 60,  # 최대 30일
            path="/api/auth",
        )

        # CSRF 토큰 쿠키 설정
        response.set_cookie(
            key="csrf_token",
            value=csrf_token,
            httponly=False,
            secure=COOKIE_SECURE,
            samesite="lax",
            max_age=30 * 24 * 60 * 60,
            path="/",
        )

        # expires_at을 payload에서 추출 (UTC timezone-aware)
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

        return Token(
            access_token=new_access_token,
            token_type="bearer",
            expires_at=expires_at,
            user=UserResponse.model_validate(user),
            csrf_token=csrf_token,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db_session),
):
    """
    로그아웃

    현재 디바이스의 Refresh Token을 무효화합니다.
    """
    if refresh_token:
        try:
            TokenService.revoke_token(db=db, token=refresh_token)
        except Exception:
            pass  # 토큰이 이미 무효화되었거나 존재하지 않아도 로그아웃 진행

    # 쿠키 삭제
    response.delete_cookie(key="refresh_token", path="/api/auth")

    return {"message": "Logged out successfully"}


@router.post("/logout-all")
async def logout_all_devices(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    모든 디바이스에서 로그아웃

    사용자의 모든 Refresh Token을 무효화합니다.
    """
    count = TokenService.revoke_all_tokens(db=db, user_id=current_user.id)

    # 쿠키 삭제
    response.delete_cookie(key="refresh_token", path="/api/auth")

    return {"message": f"Logged out from {count} device(s)"}


@router.get("/devices", response_model=list[DeviceInfo])
async def get_active_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    활성 디바이스 목록 조회

    현재 사용자가 로그인한 모든 디바이스 목록을 반환합니다.
    """
    devices = TokenService.get_active_devices(db=db, user_id=current_user.id)
    return devices


@router.delete("/devices/{device_id}")
async def revoke_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    특정 디바이스 로그아웃

    특정 디바이스의 Refresh Token을 무효화합니다.
    """
    success = TokenService.revoke_device(
        db=db, user_id=current_user.id, device_id=device_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    return {"message": "Device logged out successfully"}


# ========================================
# 비밀번호 재설정 엔드포인트
# ========================================


@router.post("/password-reset/request", response_model=MessageResponse)
@limiter.limit("3/hour")  # 시간당 3회 제한 (악용 방지)
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db_session),
):
    """
    비밀번호 재설정 요청

    사용자 이메일로 재설정 링크를 발송합니다.
    보안상 사용자 존재 여부와 관계없이 항상 성공 응답을 반환합니다.
    """
    await PasswordResetService.request_reset(
        db=db,
        email=reset_request.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return MessageResponse(
        message="If the email exists, a password reset link has been sent"
    )


@router.get("/password-reset/verify", response_model=PasswordResetVerifyResponse)
@limiter.limit("5/minute")  # 분당 5회 제한
async def verify_reset_token(
    request: Request,
    token: str,
    db: Session = Depends(get_db_session),
):
    """
    비밀번호 재설정 토큰 검증

    재설정 토큰의 유효성을 확인합니다.
    """
    result = PasswordResetService.verify_token(db=db, token=token)

    return PasswordResetVerifyResponse(
        valid=result["valid"],
        email=result["email"],
    )


@router.post("/password-reset/confirm", response_model=MessageResponse)
@limiter.limit("5/minute")  # 분당 5회 제한
async def confirm_password_reset(
    request: Request,
    confirm_data: PasswordResetConfirm,
    db: Session = Depends(get_db_session),
):
    """
    비밀번호 재설정 확인

    토큰을 검증하고 새 비밀번호로 변경합니다.
    """
    success, message = await PasswordResetService.confirm_reset(
        db=db,
        token=confirm_data.token,
        new_password=confirm_data.new_password,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    return MessageResponse(message=message)
