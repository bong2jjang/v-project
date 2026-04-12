"""사용자별 OAuth 연동 API

사용자가 자신의 플랫폼 계정을 독립적으로 연결/관리하는 엔드포인트와
관리자가 전체 사용자 연동 현황을 조회/관리하는 엔드포인트를 제공합니다.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from v_platform.core.database import get_db_session
from v_platform.models.user import User
from v_platform.models.user_oauth_token import UserOAuthToken
from v_platform.utils.auth import get_current_user, require_permission

try:
    from app.models.account import Account
except ImportError:
    Account = None  # type: ignore

router = APIRouter(tags=["user-oauth"])
logger = logging.getLogger(__name__)


# ─── 응답 스키마 ────────────────────────────────────────────────────────────────


class OAuthStatusResponse(BaseModel):
    """사용자 OAuth 연동 상태"""

    id: int | None = None
    account_id: int
    account_name: str
    platform: str
    is_connected: bool
    platform_user_name: str | None = None
    platform_email: str | None = None
    token_expires_at: str | None = None
    last_used_at: str | None = None
    is_active: bool = False
    token_status: str = (
        "not_connected"  # active | expired_refreshable | inactive | not_connected
    )


class AdminOAuthEntry(BaseModel):
    """관리자용 개별 OAuth 연동 정보"""

    id: int
    user_id: int
    user_email: str
    user_name: str
    account_id: int
    account_name: str
    platform: str
    platform_email: str | None = None
    is_active: bool
    token_status: str = "active"  # active | expired_refreshable | inactive
    token_expires_at: str | None = None
    created_at: str | None = None
    last_used_at: str | None = None


class AdminOAuthStats(BaseModel):
    """관리자용 OAuth 통계"""

    total: int
    active: int
    inactive: int
    by_platform: dict[str, int]


# ─── 토큰 상태 계산 ──────────────────────────────────────────────────────────


def _compute_token_status(token: UserOAuthToken | None) -> str:
    """토큰 상태를 계산합니다.

    Returns:
        - "not_connected": 토큰 레코드 없음
        - "inactive": refresh_token 만료 → 재연동 필요
        - "expired_refreshable": access_token 만료, refresh_token 유효 → 자동 갱신 예정
        - "active": access_token 유효
    """
    if not token:
        return "not_connected"
    if not token.is_active:
        return "inactive"
    if token.token_expires_at and token.token_expires_at <= datetime.now(timezone.utc):
        return "expired_refreshable"
    return "active"


# ─── OAuth State 관리 (사용자용) ────────────────────────────────────────────────

_user_oauth_states: dict[str, dict] = {}


def _cleanup_stale_user_states():
    """10분 이상 된 사용자 OAuth state 정리"""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale = [
        k
        for k, v in _user_oauth_states.items()
        if datetime.fromisoformat(v["created_at"]) < cutoff
    ]
    for k in stale:
        del _user_oauth_states[k]


# ═══════════════════════════════════════════════════════════════════════════════
# 사용자 API: /api/users/me/oauth/*
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/api/users/me/oauth")
async def list_my_oauth(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[OAuthStatusResponse]:
    """내 OAuth 연동 목록 조회

    시스템에 등록된 모든 Account에 대해 연동 상태를 반환합니다.
    """
    # 활성화된 Account 목록 조회
    accounts = (
        db.query(Account)
        .filter(Account.enabled.is_(True), Account.is_valid.is_(True))
        .order_by(Account.id)
        .all()
    )

    # 사용자의 OAuth 토큰 조회
    user_tokens = (
        db.query(UserOAuthToken).filter(UserOAuthToken.user_id == current_user.id).all()
    )
    token_map = {t.account_id: t for t in user_tokens}

    result = []
    for account in accounts:
        token = token_map.get(account.id)
        result.append(
            OAuthStatusResponse(
                id=token.id if token else None,
                account_id=account.id,
                account_name=account.name,
                platform=account.platform,
                is_connected=bool(token and token.is_active),
                platform_user_name=token.platform_user_name if token else None,
                platform_email=token.platform_email if token else None,
                token_expires_at=(
                    token.token_expires_at.isoformat()
                    if token and token.token_expires_at
                    else None
                ),
                last_used_at=(
                    token.last_used_at.isoformat()
                    if token and token.last_used_at
                    else None
                ),
                is_active=bool(token and token.is_active),
                token_status=_compute_token_status(token),
            )
        )

    return result


@router.get("/api/users/me/oauth/{account_id}/connect")
async def start_user_oauth(
    account_id: int,
    auth_token: str | None = None,
    db: Session = Depends(get_db_session),
):
    """사용자 OAuth 인증 시작 (Microsoft 로그인으로 리다이렉트)

    브라우저 팝업에서 호출됩니다.
    auth_token은 팝업에서 JWT를 전달받기 위한 쿼리 파라미터입니다.
    """
    import os
    from urllib.parse import urlencode

    # JWT 토큰 검증
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

    # Account 조회
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.platform != "teams":
        raise HTTPException(
            status_code=400,
            detail="현재 사용자 OAuth는 Teams만 지원합니다.",
        )

    tenant_id = account.tenant_id_decrypted
    app_id = account.app_id_decrypted

    if not tenant_id or not app_id:
        raise HTTPException(
            status_code=400,
            detail="Teams account에 tenant_id 또는 app_id가 설정되지 않았습니다.",
        )

    # State 생성 (CSRF 방지)
    state_token = secrets.token_urlsafe(32)
    _user_oauth_states[state_token] = {
        "account_id": account_id,
        "user_id": current_user.id,
        "target": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _cleanup_stale_user_states()

    # Redirect URI — auth_microsoft.py의 기존 callback을 재사용
    override = os.getenv("MS_OAUTH_REDIRECT_URI")
    if override:
        redirect_uri = override
    else:
        backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
        redirect_uri = f"{backend_url}/api/auth/microsoft/callback"

    params = {
        "client_id": app_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": "Chat.Read Chat.ReadWrite Files.ReadWrite User.Read offline_access",
        "state": state_token,
        "prompt": "consent",
    }
    authorize_url = (
        f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"
        f"?{urlencode(params)}"
    )

    logger.info(
        "User OAuth login initiated",
        extra={
            "account_id": account_id,
            "user": current_user.username,
            "target": "user",
        },
    )

    return RedirectResponse(url=authorize_url)


@router.post("/api/users/me/oauth/{account_id}/disconnect")
async def disconnect_user_oauth(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """사용자 OAuth 연동 해제"""
    token = (
        db.query(UserOAuthToken)
        .filter(
            UserOAuthToken.user_id == current_user.id,
            UserOAuthToken.account_id == account_id,
        )
        .first()
    )

    if not token:
        raise HTTPException(status_code=404, detail="연동 정보를 찾을 수 없습니다.")

    db.delete(token)
    db.commit()

    logger.info(
        "User OAuth disconnected",
        extra={
            "user": current_user.username,
            "account_id": account_id,
            "platform": token.platform,
        },
    )

    return {"message": "연동이 해제되었습니다."}


@router.get("/api/users/me/oauth/{account_id}/status")
async def get_user_oauth_status(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> OAuthStatusResponse:
    """특정 Account에 대한 내 연동 상태 조회"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    token = (
        db.query(UserOAuthToken)
        .filter(
            UserOAuthToken.user_id == current_user.id,
            UserOAuthToken.account_id == account_id,
        )
        .first()
    )

    return OAuthStatusResponse(
        id=token.id if token else None,
        account_id=account.id,
        account_name=account.name,
        platform=account.platform,
        is_connected=bool(token and token.is_active),
        platform_user_name=token.platform_user_name if token else None,
        platform_email=token.platform_email if token else None,
        token_expires_at=(
            token.token_expires_at.isoformat()
            if token and token.token_expires_at
            else None
        ),
        last_used_at=(
            token.last_used_at.isoformat() if token and token.last_used_at else None
        ),
        is_active=bool(token and token.is_active),
        token_status=_compute_token_status(token),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 관리자 API: /api/admin/oauth/*
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/api/admin/oauth")
async def admin_list_all_oauth(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
) -> list[AdminOAuthEntry]:
    """전체 사용자 OAuth 연동 현황 (관리자)"""
    tokens = (
        db.query(UserOAuthToken)
        .join(User, UserOAuthToken.user_id == User.id)
        .join(Account, UserOAuthToken.account_id == Account.id)
        .order_by(UserOAuthToken.id)
        .all()
    )

    result = []
    for t in tokens:
        result.append(
            AdminOAuthEntry(
                id=t.id,
                user_id=t.user_id,
                user_email=t.user.email,
                user_name=t.user.username,
                account_id=t.account_id,
                account_name=t.account.name,
                platform=t.platform,
                platform_email=t.platform_email,
                is_active=t.is_active,
                token_status=_compute_token_status(t),
                token_expires_at=(
                    t.token_expires_at.isoformat() if t.token_expires_at else None
                ),
                created_at=t.created_at.isoformat() if t.created_at else None,
                last_used_at=t.last_used_at.isoformat() if t.last_used_at else None,
            )
        )

    return result


@router.delete("/api/admin/oauth/{token_id}")
async def admin_revoke_oauth(
    token_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
):
    """특정 사용자 OAuth 연동 강제 해제 (관리자)"""
    token = db.query(UserOAuthToken).filter(UserOAuthToken.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="OAuth 토큰을 찾을 수 없습니다.")

    user = db.query(User).filter(User.id == token.user_id).first()
    db.delete(token)
    db.commit()

    logger.info(
        "Admin revoked user OAuth",
        extra={
            "admin": current_user.username,
            "target_user": user.email if user else token.user_id,
            "token_id": token_id,
            "platform": token.platform,
        },
    )

    return {"message": "사용자 연동이 해제되었습니다."}


@router.get("/api/admin/oauth/stats")
async def admin_oauth_stats(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
) -> AdminOAuthStats:
    """OAuth 연동 통계 (관리자)"""
    tokens = db.query(UserOAuthToken).all()

    total = len(tokens)
    active = sum(1 for t in tokens if t.is_active)
    inactive = total - active

    by_platform: dict[str, int] = {}
    for t in tokens:
        by_platform[t.platform] = by_platform.get(t.platform, 0) + 1

    return AdminOAuthStats(
        total=total,
        active=active,
        inactive=inactive,
        by_platform=by_platform,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 사용자 토큰 갱신 유틸
# ═══════════════════════════════════════════════════════════════════════════════


async def get_user_delegated_token(
    user_id: int, account: Account, db: Session
) -> str | None:
    """사용자별 Delegated access token 반환 (필요 시 자동 갱신)

    Args:
        user_id: VMS 사용자 ID
        account: Teams Account 객체
        db: DB 세션

    Returns:
        유효한 access token 또는 None
    """
    token_record = (
        db.query(UserOAuthToken)
        .filter(
            UserOAuthToken.user_id == user_id,
            UserOAuthToken.account_id == account.id,
            UserOAuthToken.is_active.is_(True),
        )
        .first()
    )

    if not token_record:
        return None

    # 캐시된 access token이 있고 유효하면 반환
    if token_record.access_token and token_record.token_expires_at:
        if token_record.token_expires_at > datetime.now(timezone.utc) + timedelta(
            minutes=5
        ):
            token_record.last_used_at = datetime.now(timezone.utc)
            db.commit()
            return token_record.access_token_decrypted

    # Refresh token으로 갱신
    refresh_token = token_record.refresh_token_decrypted
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
        "scope": "Chat.Read Chat.ReadWrite Files.ReadWrite User.Read offline_access",
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
                        "User token refresh failed",
                        extra={
                            "user_id": user_id,
                            "account_id": account.id,
                            "error": error_msg,
                        },
                    )
                    # Refresh token 만료 시 비활성화
                    if result.get("error") in (
                        "invalid_grant",
                        "interaction_required",
                    ):
                        token_record.is_active = False
                        db.commit()
                        logger.warning(
                            "User refresh token expired, deactivated",
                            extra={
                                "user_id": user_id,
                                "account_id": account.id,
                            },
                        )
                    return None

                access_token = result["access_token"]
                new_refresh_token = result.get("refresh_token")
                expires_in = result.get("expires_in", 3600)
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

                # 토큰 업데이트
                token_record.access_token_decrypted = access_token
                token_record.token_expires_at = expires_at
                token_record.last_used_at = datetime.now(timezone.utc)

                # Refresh token rotation
                if new_refresh_token and new_refresh_token != refresh_token:
                    token_record.refresh_token_decrypted = new_refresh_token

                db.commit()
                return access_token

    except Exception as e:
        logger.warning(
            "User token refresh error",
            extra={
                "user_id": user_id,
                "account_id": account.id,
                "error": str(e),
            },
        )
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# OAuth State 공유 — auth_microsoft.py callback에서 조회
# ═══════════════════════════════════════════════════════════════════════════════


def pop_user_oauth_state(state: str) -> dict | None:
    """사용자 OAuth state를 가져오고 제거 (callback에서 사용)"""
    return _user_oauth_states.pop(state, None)
