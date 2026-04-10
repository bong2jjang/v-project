"""
Microsoft SSO Provider

Microsoft Entra ID (Azure AD) OpenID Connect 기반 SSO 구현.
"""

from urllib.parse import urlencode

import httpx
import structlog

from app.sso.base import BaseSSOProvider, SSOUserInfo

logger = structlog.get_logger()


class MicrosoftSSOProvider(BaseSSOProvider):
    """Microsoft Entra ID (Azure AD) — OpenID Connect 기반"""

    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.authority = f"https://login.microsoftonline.com/{tenant_id}"

    def get_provider_name(self) -> str:
        return "microsoft"

    def get_display_name(self) -> str:
        return "Microsoft 365"

    def get_icon(self) -> str:
        return "microsoft"

    def is_configured(self) -> bool:
        return all([self.tenant_id, self.client_id, self.client_secret])

    async def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": "openid email profile User.Read",
            "state": state,
        }
        return f"{self.authority}/oauth2/v2.0/authorize?{urlencode(params)}"

    async def handle_callback(
        self, code: str, state: str, redirect_uri: str
    ) -> SSOUserInfo:
        token_url = f"{self.authority}/oauth2/v2.0/token"

        async with httpx.AsyncClient(timeout=30) as client:
            # 1. Authorization Code → Token 교환
            token_resp = await client.post(
                token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                    "scope": "openid email profile User.Read",
                },
            )
            token_resp.raise_for_status()
            tokens = token_resp.json()

            # 2. Access Token으로 사용자 정보 조회
            me_resp = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            me_resp.raise_for_status()
            me = me_resp.json()

        email = me.get("mail") or me.get("userPrincipalName", "")
        logger.info(
            "microsoft_sso_user_info",
            email=email,
            display_name=me.get("displayName"),
        )

        return SSOUserInfo(
            email=email,
            display_name=me.get("displayName", ""),
            provider_user_id=me["id"],
            provider_name="microsoft",
            avatar_url=None,
            raw_claims=me,
        )
