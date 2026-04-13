"""
SSO Authentication API

SSO 인증 관련 API 엔드포인트 (Provider 목록, 로그인 리다이렉트, 콜백)
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.middleware.csrf import generate_csrf_token
from v_platform.models.user import User, UserRole
from v_platform.services.token_service import TokenService
from v_platform.sso.base import SSOUserInfo
from v_platform.sso.registry import sso_registry
from v_platform.utils.audit_logger import create_audit_log, AuditAction

logger = structlog.get_logger()

router = APIRouter(prefix="/api/auth/sso", tags=["SSO Authentication"])

# State 토큰 저장 (MVP: in-memory, 프로덕션: Redis 권장)
_pending_states: dict[str, dict] = {}

# 환경에 따라 쿠키 Secure 플래그 설정
COOKIE_SECURE = os.getenv("ENVIRONMENT", "development") == "production"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")


def _render_sso_popup_result(
    success: bool,
    token: str = "",
    expires_at: str = "",
    error: str = "",
) -> HTMLResponse:
    """SSO 팝업 결과 HTML — opener에 postMessage 후 닫힘 (MS OAuth 패턴)"""
    safe_error = error.replace("'", "\\'")
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SSO Login</title></head>
<body>
<p>{"로그인 처리 중..." if success else safe_error}</p>
<script>
  if (window.opener) {{
    window.opener.postMessage({{
      type: 'sso-login-result',
      success: {str(success).lower()},
      token: '{token}',
      expires_at: '{expires_at}',
      error: '{safe_error}'
    }}, '*');
    window.close();
  }} else {{
    document.body.innerHTML = '<p>{safe_error or "이 창을 닫아주세요."}</p>';
  }}
</script>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/providers")
async def list_sso_providers(request: Request):
    """프론트엔드용: 활성 SSO Provider 목록 반환 (login_url 포함)"""
    backend_base = os.getenv("BACKEND_URL", "").rstrip("/")
    if not backend_base:
        backend_base = str(request.base_url).rstrip("/")

    providers = sso_registry.get_provider_info()
    for p in providers:
        p["login_url"] = f"{backend_base}/api/auth/sso/{p['name']}/login"
    return providers


@router.get("/{provider}/authorize")
async def sso_authorize(provider: str, request: Request):
    """SSO 인증 URL을 JSON으로 반환 (프론트엔드에서 직접 이동)"""
    sso = sso_registry.get(provider)
    if not sso:
        raise HTTPException(
            404,
            f"SSO 제공자 '{provider}'을(를) 찾을 수 없습니다. 설정을 확인해 주세요.",
        )

    state = secrets.token_urlsafe(32)
    backend_base = os.getenv("BACKEND_URL", "").rstrip("/")
    if not backend_base:
        backend_base = str(request.base_url).rstrip("/")
    redirect_uri = backend_base + f"/api/auth/sso/{provider}/callback"

    _pending_states[state] = {
        "provider": provider,
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc),
    }

    auth_url = await sso.get_authorization_url(state, redirect_uri)
    return {"auth_url": auth_url}


@router.get("/{provider}/login")
async def sso_login(provider: str, request: Request):
    """SSO 인증 시작 — Provider 인증 페이지로 리다이렉트 (레거시)"""
    result = await sso_authorize(provider, request)
    return RedirectResponse(result["auth_url"])


@router.get("/{provider}/callback")
async def sso_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
):
    """SSO 인증 콜백 — 내부 JWT 발급 후 프론트엔드로 리다이렉트"""
    # 1. State 검증 (CSRF 보호)
    pending = _pending_states.pop(state, None)
    if not pending or pending["provider"] != provider:
        raise HTTPException(
            400, "SSO 인증 상태가 유효하지 않거나 만료되었습니다. 다시 시도해 주세요."
        )

    if datetime.now(timezone.utc) - pending["created_at"] > timedelta(minutes=10):
        raise HTTPException(400, "SSO 인증이 만료되었습니다. 다시 시도해 주세요.")

    # 2. Provider에서 사용자 정보 획득
    sso = sso_registry.get(provider)
    if not sso:
        raise HTTPException(
            404,
            f"SSO 제공자 '{provider}'을(를) 찾을 수 없습니다. 설정을 확인해 주세요.",
        )

    try:
        sso_user: SSOUserInfo = await sso.handle_callback(
            code, state, pending["redirect_uri"]
        )
    except Exception as e:
        logger.error("sso_callback_failed", provider=provider, error=str(e))
        return _render_sso_popup_result(False, error="SSO 인증에 실패했습니다.")

    if not sso_user.email:
        logger.error("sso_no_email", provider=provider)
        return _render_sso_popup_result(
            False, error="이메일 정보를 가져올 수 없습니다."
        )

    # 3. 내부 사용자 조회 또는 생성
    db: Session = next(get_db_session())
    try:
        user = db.query(User).filter(User.email == sso_user.email).first()

        if user is None:
            # 자동 계정 생성 (SSO 사용자는 비밀번호 없음)
            user = User(
                email=sso_user.email,
                username=sso_user.display_name or sso_user.email.split("@")[0],
                hashed_password="",  # SSO 전용 계정은 비밀번호 비활성
                role=UserRole.USER,
                is_active=True,
                sso_provider=provider,
                sso_provider_id=sso_user.provider_user_id,
                auth_method="sso",
            )
            db.add(user)
            db.flush()
            logger.info(
                "sso_user_auto_created",
                email=sso_user.email,
                provider=provider,
            )
        elif not user.is_active:
            return _render_sso_popup_result(False, error="계정이 비활성화되었습니다.")
        else:
            # 기존 계정 SSO 연동 정보 업데이트
            user.sso_provider = provider
            user.sso_provider_id = sso_user.provider_user_id
            # local 계정이 SSO로 로그인하면 hybrid로 전환
            if user.auth_method == "local" and user.hashed_password:
                user.auth_method = "hybrid"
            elif not user.hashed_password:
                user.auth_method = "sso"

        # 마지막 로그인 시간 업데이트
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

        # 4. 내부 JWT 토큰 발급 (기존 시스템 그대로)
        access_token, expires_at = TokenService.create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role.value if isinstance(user.role, UserRole) else user.role,
        )

        sso_app_id = (
            getattr(request.app.state, "app_id", None)
            if hasattr(request.app, "state")
            else None
        )
        refresh_token = TokenService.create_refresh_token(
            db=db,
            user_id=user.id,
            device_fingerprint=f"sso_{provider}",
            device_name=f"SSO ({sso.get_display_name()})",
            ip_address=request.client.host if request.client else None,
            app_id=sso_app_id,
        )

        # CSRF 토큰 생성
        csrf_token = generate_csrf_token()

        # 5. 감사 로그
        create_audit_log(
            db=db,
            action=AuditAction.USER_LOGIN,
            user=user,
            resource_type="user",
            resource_id=str(user.id),
            description=f"SSO login via {provider} ({sso.get_display_name()})",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

        # 6. 팝업 → opener로 토큰 전달 (MS OAuth와 동일한 postMessage 패턴)
        response = _render_sso_popup_result(
            success=True,
            token=access_token,
            expires_at=expires_at.isoformat(),
        )

        # Refresh Token을 HttpOnly 쿠키로 설정
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite="lax",
            max_age=7 * 24 * 3600,
            path="/api/auth",
        )

        # CSRF 토큰 쿠키
        response.set_cookie(
            key="csrf_token",
            value=csrf_token,
            httponly=False,
            secure=COOKIE_SECURE,
            samesite="lax",
            max_age=7 * 24 * 3600,
            path="/",
        )

        return response

    except Exception as e:
        logger.error("sso_callback_error", provider=provider, error=str(e))
        db.rollback()
        return _render_sso_popup_result(
            False, error="로그인 처리 중 오류가 발생했습니다."
        )
    finally:
        db.close()
