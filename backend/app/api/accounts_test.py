"""Account 연결 테스트 API

Provider 연결 상태를 실시간으로 테스트하고 기능별 권한 상태를 반환합니다.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db import get_db_session
from app.models import Account
from app.models.user import User
from app.schemas.feature_catalog import FeaturePermissionStatus
from app.utils.auth import require_permission

router = APIRouter(prefix="/api/accounts-db", tags=["accounts-db"])
logger = logging.getLogger(__name__)


class ConnectionTestResponse(BaseModel):
    """연결 테스트 응답"""

    success: bool
    message: str
    details: Optional[dict] = None
    feature_permissions: Optional[list[FeaturePermissionStatus]] = None


@router.post("/{account_id}/test", response_model=ConnectionTestResponse)
async def test_account_connection(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
):
    """Account 연결 테스트

    실제 API 호출로 연결 상태 및 기능별 권한 상태를 확인합니다.
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        if account.platform == "slack":
            return await test_slack_connection(account)
        elif account.platform == "teams":
            return await test_teams_connection(account)
        else:
            raise HTTPException(
                status_code=400, detail=f"Unknown platform: {account.platform}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing account {account_id}: {e}", exc_info=True)
        return ConnectionTestResponse(
            success=False,
            message=f"Connection test failed: {str(e)}",
            details={"error": str(e)},
        )


async def test_slack_connection(account: Account) -> ConnectionTestResponse:
    """Slack 연결 테스트 + 기능별 권한 검증"""
    try:
        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError
        from app.services.feature_checker import SlackFeatureChecker

        if not account.token_decrypted:
            return ConnectionTestResponse(
                success=False, message="Bot Token이 설정되지 않았습니다"
            )

        client = WebClient(token=account.token_decrypted)

        # ── 1. 기본 연결 확인 ────────────────────────────────────────────────
        response = client.auth_test()

        if not response.get("ok"):
            return ConnectionTestResponse(
                success=False,
                message=f"❌ Slack API returned: {response.get('error', 'Unknown error')}",
                details={"response": dict(response)},
            )

        user_name = response.get("user", "Unknown")
        team_name = response.get("team", "Unknown")
        bot_id = response.get("bot_id", "Unknown")

        # ── 2. Feature 권한 검증 ─────────────────────────────────────────────
        checker = SlackFeatureChecker(client)
        raw_scopes = await checker.get_raw_scopes()
        feature_permissions = checker.check_features(raw_scopes, platform="slack")

        return ConnectionTestResponse(
            success=True,
            message=f"✅ Connected as @{user_name} in {team_name}",
            details={
                "user": user_name,
                "team": team_name,
                "bot_id": bot_id,
                "url": response.get("url", ""),
                "raw_scopes": sorted(raw_scopes),
            },
            feature_permissions=feature_permissions,
        )

    except SlackApiError as e:
        error_message = e.response.get("error", str(e))
        return ConnectionTestResponse(
            success=False,
            message=f"❌ Slack API Error: {error_message}",
            details={"error": error_message},
        )
    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"❌ Connection failed: {str(e)}",
            details={"error": str(e)},
        )


async def test_teams_connection(account: Account) -> ConnectionTestResponse:
    """Teams 연결 테스트 + 기능별 권한 검증"""
    try:
        import httpx
        from app.services.feature_checker import TeamsFeatureChecker

        tenant_id = account.tenant_id_decrypted
        app_id = account.app_id_decrypted
        app_password = account.app_password_decrypted

        if not all([tenant_id, app_id, app_password]):
            return ConnectionTestResponse(
                success=False, message="Teams credentials가 완전하지 않습니다"
            )

        # ── 1. OAuth 토큰 획득 ───────────────────────────────────────────────
        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": app_id,
            "client_secret": app_password,
            "scope": "https://graph.microsoft.com/.default",
        }

        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(token_url, data=data, timeout=10.0)

        if response.status_code != 200:
            error_data = response.json()
            return ConnectionTestResponse(
                success=False,
                message=f"❌ Teams authentication failed: {error_data.get('error_description', 'Unknown error')}",
                details={"status": response.status_code, "error": error_data},
            )

        token_data = response.json()
        access_token = token_data.get("access_token", "")
        expires_in = token_data.get("expires_in", 0)

        # ── 2. Feature 권한 검증 ─────────────────────────────────────────────
        # teams_provider의 _parse_channel_ref는 여기서 쓸 수 없으므로
        # account의 team_id 직접 사용 (현재 Account 모델에는 team_id가 없음 — None 처리)
        team_id: Optional[str] = account.team_id_decrypted

        checker = TeamsFeatureChecker(access_token=access_token, team_id=team_id)
        feature_permissions = await checker.check_features(platform="teams")

        return ConnectionTestResponse(
            success=True,
            message=f"✅ Connected to Teams (Token expires in {expires_in}s)",
            details={
                "tenant_id": f"{tenant_id[:8]}...{tenant_id[-4:]}"
                if tenant_id
                else None,
                "app_id": f"{app_id[:8]}...{app_id[-4:]}" if app_id else None,
                "expires_in": expires_in,
                "token_type": token_data.get("token_type", "Bearer"),
            },
            feature_permissions=feature_permissions,
        )

    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"❌ Connection failed: {str(e)}",
            details={"error": str(e)},
        )
