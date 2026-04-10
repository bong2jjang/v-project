"""Microsoft OAuth2 인증 API

Teams Provider의 Delegated Auth를 위한 OAuth2 Authorization Code Flow 구현.
관리자가 Microsoft 계정으로 로그인하여 refresh token을 획득,
이후 /chats 등 delegated-only Graph API 호출에 사용합니다.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.models.user_oauth_token import UserOAuthToken
from v_platform.utils.auth import get_current_user

try:
    from app.models.account import Account
except ImportError:
    Account = None  # type: ignore

router = APIRouter(prefix="/api/auth/microsoft", tags=["auth-microsoft"])
logger = logging.getLogger(__name__)

# OAuth state를 임시 저장 (서버 재시작 시 초기화됨)
# 프로덕션에서는 Redis 등 사용 권장
_oauth_states: dict[str, dict] = {}


def _get_redirect_uri() -> str:
    """OAuth2 Redirect URI 반환"""
    override = os.getenv("MS_OAUTH_REDIRECT_URI")
    if override:
        return override

    # 백엔드 URL 기반 생성
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    return f"{backend_url}/api/auth/microsoft/callback"


def _get_authorize_url(tenant_id: str, app_id: str, state: str) -> str:
    """Microsoft OAuth2 authorize URL 생성"""
    params = {
        "client_id": app_id,
        "response_type": "code",
        "redirect_uri": _get_redirect_uri(),
        "scope": "Chat.Read Chat.ReadWrite ChannelMessage.Send Files.ReadWrite User.Read offline_access",
        "state": state,
        "prompt": "consent",
    }
    base = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"
    return f"{base}?{urlencode(params)}"


@router.get("/login")
async def microsoft_login(
    account_id: int,
    auth_token: str | None = None,
    db: Session = Depends(get_db_session),
):
    """Microsoft OAuth2 로그인 시작

    Teams Account에 대해 Microsoft 로그인 페이지로 리다이렉트합니다.
    브라우저 팝업에서 호출됩니다.
    auth_token은 팝업에서 JWT를 전달받기 위한 쿼리 파라미터입니다.
    """
    # 팝업에서 전달된 JWT 토큰 검증
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from v_platform.services.token_service import TokenService

    try:
        token_data = TokenService.verify_access_token(auth_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    current_user = db.query(User).filter(User.id == token_data.get("user_id")).first()
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")

    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.platform != "teams":
        raise HTTPException(
            status_code=400, detail="Microsoft auth is only for Teams accounts"
        )

    tenant_id = account.tenant_id_decrypted
    app_id = account.app_id_decrypted

    if not tenant_id or not app_id:
        raise HTTPException(
            status_code=400,
            detail="Teams account missing tenant_id or app_id",
        )

    # State 생성 (CSRF 방지 + account_id 전달)
    state_token = secrets.token_urlsafe(32)
    _oauth_states[state_token] = {
        "account_id": account_id,
        "user_id": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # 오래된 state 정리 (10분 이상)
    _cleanup_stale_states()

    authorize_url = _get_authorize_url(tenant_id, app_id, state_token)

    logger.info(
        "Microsoft OAuth2 login initiated",
        extra={"account_id": account_id, "user": current_user.username},
    )

    return RedirectResponse(url=authorize_url)


@router.get("/callback")
async def microsoft_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db_session),
):
    """Microsoft OAuth2 콜백

    Microsoft 로그인 완료 후 호출됩니다.
    Authorization code를 token으로 교환하고 DB에 저장합니다.
    """
    # 에러 처리
    if error:
        logger.warning(
            "Microsoft OAuth2 error", extra={"error": error, "desc": error_description}
        )
        return _render_popup_result(
            success=False,
            message=f"Microsoft 인증 실패: {error_description or error}",
        )

    if not code or not state:
        return _render_popup_result(
            success=False,
            message="잘못된 요청입니다 (code 또는 state 누락)",
        )

    # State 검증 — 시스템 OAuth 또는 사용자 OAuth
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        # 사용자 OAuth state 확인
        from v_platform.api.user_oauth import pop_user_oauth_state

        state_data = pop_user_oauth_state(state)

    if not state_data:
        return _render_popup_result(
            success=False,
            message="인증 세션이 만료되었습니다. 다시 시도해주세요.",
        )

    account_id = state_data["account_id"]
    oauth_target = state_data.get("target", "system")  # "system" | "user"

    # Account 조회
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return _render_popup_result(success=False, message="계정을 찾을 수 없습니다.")

    tenant_id = account.tenant_id_decrypted
    app_id = account.app_id_decrypted
    app_password = account.app_password_decrypted

    if not tenant_id or not app_id or not app_password:
        return _render_popup_result(
            success=False, message="Teams 계정 설정이 불완전합니다."
        )

    # Authorization code → token 교환
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _get_redirect_uri(),
        "client_id": app_id,
        "client_secret": app_password,
        "scope": "Chat.Read Chat.ReadWrite ChannelMessage.Send Files.ReadWrite User.Read offline_access",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                data=token_data,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                result = await resp.json()

                if resp.status != 200 or "error" in result:
                    error_msg = result.get(
                        "error_description", result.get("error", "Unknown error")
                    )
                    logger.error(
                        "Microsoft token exchange failed",
                        extra={"status": resp.status, "error": error_msg},
                    )
                    return _render_popup_result(
                        success=False,
                        message=f"토큰 교환 실패: {error_msg}",
                    )

                access_token = result["access_token"]
                refresh_token = result.get("refresh_token")
                expires_in = result.get("expires_in", 3600)

                if not refresh_token:
                    return _render_popup_result(
                        success=False,
                        message="Refresh token이 발급되지 않았습니다. offline_access 스코프를 확인해주세요.",
                    )

            # /me 호출로 사용자 정보 가져오기
            ms_user_id = None
            ms_user_email = None
            async with session.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as me_resp:
                if me_resp.status == 200:
                    me_data = await me_resp.json()
                    ms_user_id = me_data.get("id")
                    ms_user_email = (
                        me_data.get("mail")
                        or me_data.get("userPrincipalName")
                        or ms_user_id
                    )

        # DB에 저장 — target에 따라 분기
        if oauth_target == "user":
            # 사용자별 토큰 저장
            user_id = state_data["user_id"]
            existing = (
                db.query(UserOAuthToken)
                .filter(
                    UserOAuthToken.user_id == user_id,
                    UserOAuthToken.account_id == account_id,
                )
                .first()
            )

            if existing:
                # 기존 레코드 업데이트
                existing.refresh_token_decrypted = refresh_token
                existing.access_token_decrypted = access_token
                existing.token_expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=expires_in
                )
                existing.platform_user_id = ms_user_id
                existing.platform_email = ms_user_email
                existing.platform_user_name = ms_user_email
                existing.is_active = True
                existing.updated_at = datetime.now(timezone.utc)
            else:
                # 새 레코드 생성
                new_token = UserOAuthToken(
                    user_id=user_id,
                    account_id=account_id,
                    platform="teams",
                    scopes="Chat.Read Chat.ReadWrite User.Read offline_access",
                    platform_user_id=ms_user_id,
                    platform_email=ms_user_email,
                    platform_user_name=ms_user_email,
                    is_active=True,
                )
                new_token.refresh_token_decrypted = refresh_token
                new_token.access_token_decrypted = access_token
                new_token.token_expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=expires_in
                )
                new_token.scopes = (
                    "Chat.Read Chat.ReadWrite Files.ReadWrite User.Read offline_access"
                )
                db.add(new_token)

            db.commit()

            logger.info(
                "User OAuth connected",
                extra={
                    "user_id": user_id,
                    "account_id": account_id,
                    "ms_user": ms_user_email,
                },
            )
        else:
            # 기존: 시스템 레벨 Account에 저장
            account.ms_refresh_token_decrypted = refresh_token
            account.ms_token_expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=expires_in
            )
            account.ms_user_id = ms_user_email or ms_user_id

            db.commit()

            logger.info(
                "Microsoft delegated auth connected",
                extra={
                    "account_id": account_id,
                    "ms_user": ms_user_email,
                },
            )

        return _render_popup_result(
            success=True,
            message=f"Microsoft 계정 연결 완료: {ms_user_email or '사용자'}",
        )

    except aiohttp.ClientError as e:
        logger.error("Microsoft OAuth2 network error", extra={"error": str(e)})
        return _render_popup_result(
            success=False,
            message=f"네트워크 오류: {str(e)}",
        )
    except Exception as e:
        logger.error("Microsoft OAuth2 unexpected error", extra={"error": str(e)})
        db.rollback()
        return _render_popup_result(
            success=False,
            message=f"예기치 않은 오류: {str(e)}",
        )


@router.post("/{account_id}/disconnect")
async def microsoft_disconnect(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Microsoft Delegated Auth 연결 해제"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.platform != "teams":
        raise HTTPException(
            status_code=400, detail="Microsoft auth is only for Teams accounts"
        )

    account.ms_refresh_token = None
    account.ms_token_expires_at = None
    account.ms_user_id = None
    db.commit()

    logger.info(
        "Microsoft delegated auth disconnected",
        extra={"account_id": account_id, "user": current_user.username},
    )

    return {"message": "Microsoft 계정 연결이 해제되었습니다."}


@router.get("/{account_id}/status")
async def microsoft_auth_status(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Microsoft Delegated Auth 연결 상태 조회"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    has_delegated_auth = bool(account.ms_refresh_token)

    return {
        "account_id": account_id,
        "has_delegated_auth": has_delegated_auth,
        "ms_user_id": account.ms_user_id if has_delegated_auth else None,
        "token_expires_at": (
            account.ms_token_expires_at.isoformat()
            if account.ms_token_expires_at
            else None
        ),
    }


# ─── Delegated Token 유틸 ────────────────────────────────────────────────────

# 메모리 캐시: account_id → (access_token, expires_at)
_token_cache: dict[int, tuple[str, datetime]] = {}


async def get_delegated_token(account: Account, db: Session) -> str | None:
    """Delegated access token 반환 (필요 시 자동 갱신)

    Args:
        account: Teams Account 객체 (ms_refresh_token 포함)
        db: DB 세션 (refresh token 갱신 시 커밋용)

    Returns:
        유효한 access token 또는 None (delegated auth 미설정 시)
    """
    if not account.ms_refresh_token:
        return None

    # 캐시 확인 (만료 5분 전까지 유효)
    cached = _token_cache.get(account.id)
    if cached:
        cached_token, cached_expires = cached
        if cached_expires > datetime.now(timezone.utc) + timedelta(minutes=5):
            return cached_token

    # Token 갱신
    refresh_token = account.ms_refresh_token_decrypted
    if not refresh_token:
        return None

    tenant_id = account.tenant_id_decrypted
    app_id = account.app_id_decrypted
    app_password = account.app_password_decrypted

    if not tenant_id or not app_id or not app_password:
        return None

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": app_id,
        "client_secret": app_password,
        "scope": "Chat.Read Chat.ReadWrite ChannelMessage.Send Files.ReadWrite User.Read offline_access",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                token_url,
                data=token_data,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                result = await resp.json()

                if resp.status != 200 or "error" in result:
                    error_msg = result.get("error_description", result.get("error"))
                    logger.warning(
                        "Microsoft token refresh failed",
                        extra={
                            "account_id": account.id,
                            "error": error_msg,
                        },
                    )
                    # Refresh token 만료 시 연결 해제
                    if result.get("error") in (
                        "invalid_grant",
                        "interaction_required",
                    ):
                        account.ms_refresh_token = None
                        account.ms_token_expires_at = None
                        account.ms_user_id = None
                        db.commit()
                        logger.warning(
                            "Microsoft refresh token expired, "
                            "delegated auth disconnected",
                            extra={"account_id": account.id},
                        )
                    return None

                access_token = result["access_token"]
                new_refresh_token = result.get("refresh_token")
                expires_in = result.get("expires_in", 3600)
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

                # Refresh token rotation
                if new_refresh_token and new_refresh_token != refresh_token:
                    account.ms_refresh_token_decrypted = new_refresh_token

                account.ms_token_expires_at = expires_at
                db.commit()

                # 캐시 업데이트
                _token_cache[account.id] = (access_token, expires_at)

                return access_token

    except Exception as e:
        logger.warning(
            "Microsoft token refresh error",
            extra={"account_id": account.id, "error": str(e)},
        )
        return None


# ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────


def _cleanup_stale_states():
    """10분 이상 된 OAuth state 정리"""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale = [
        k
        for k, v in _oauth_states.items()
        if datetime.fromisoformat(v["created_at"]) < cutoff
    ]
    for k in stale:
        del _oauth_states[k]


def _render_popup_result(success: bool, message: str) -> HTMLResponse:
    """OAuth 팝업 결과 HTML (부모 창에 메시지 전달 후 닫힘)"""
    status = "success" if success else "error"
    safe_message = message.replace("'", "\\'")
    html = f"""<!DOCTYPE html>
<html>
<head><title>Microsoft Auth</title></head>
<body>
<script>
  if (window.opener) {{
    window.opener.postMessage({{
      type: 'ms-oauth-result',
      status: '{status}',
      message: '{safe_message}'
    }}, '*');
    window.close();
  }} else {{
    document.body.innerHTML = '<p>{safe_message}</p><p>이 창을 닫아주세요.</p>';
  }}
</script>
</body>
</html>"""
    return HTMLResponse(content=html)
