"""
Generic OIDC Provider

범용 OpenID Connect Provider — 고객사 IdP(Keycloak, Okta, ADFS 등) 대응.
환경 변수만으로 설정 가능하여 코드 변경 없이 SSO 교체 가능.
"""

from urllib.parse import urlencode

import httpx
import structlog

from v_platform.sso.base import BaseSSOProvider, SSOUserInfo

logger = structlog.get_logger()


class GenericOIDCProvider(BaseSSOProvider):
    """범용 OIDC Provider — 고객사 IdP(Keycloak, Okta, ADFS 등) 대응"""

    def __init__(
        self,
        provider_name: str,
        display_name: str,
        icon: str,
        issuer_url: str,
        client_id: str,
        client_secret: str,
        scopes: str = "openid email profile",
        email_claim: str = "email",
        name_claim: str = "name",
        sub_claim: str = "sub",
    ):
        self._provider_name = provider_name
        self._display_name = display_name
        self._icon = icon
        self.issuer_url = issuer_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.scopes = scopes
        self.email_claim = email_claim
        self.name_claim = name_claim
        self.sub_claim = sub_claim
        self._oidc_config: dict | None = None

    def get_provider_name(self) -> str:
        return self._provider_name

    def get_display_name(self) -> str:
        return self._display_name

    def get_icon(self) -> str:
        return self._icon

    def is_configured(self) -> bool:
        return all([self.issuer_url, self.client_id, self.client_secret])

    async def _discover(self) -> dict:
        """OIDC Discovery (.well-known) 자동 조회"""
        if self._oidc_config:
            return self._oidc_config

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.issuer_url}/.well-known/openid-configuration"
            )
            resp.raise_for_status()
            self._oidc_config = resp.json()

        logger.info(
            "oidc_discovery_completed",
            provider=self._provider_name,
            issuer=self.issuer_url,
        )
        return self._oidc_config

    async def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        config = await self._discover()
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": self.scopes,
            "state": state,
        }
        return f"{config['authorization_endpoint']}?{urlencode(params)}"

    async def handle_callback(
        self, code: str, state: str, redirect_uri: str
    ) -> SSOUserInfo:
        config = await self._discover()

        async with httpx.AsyncClient(timeout=30) as client:
            # Token 교환
            token_resp = await client.post(
                config["token_endpoint"],
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            tokens = token_resp.json()

            # UserInfo 조회
            userinfo_resp = await client.get(
                config["userinfo_endpoint"],
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()

        email = userinfo.get(self.email_claim, "")
        logger.info(
            "oidc_sso_user_info",
            provider=self._provider_name,
            email=email,
        )

        return SSOUserInfo(
            email=email,
            display_name=userinfo.get(self.name_claim, ""),
            provider_user_id=userinfo.get(self.sub_claim, ""),
            provider_name=self._provider_name,
            raw_claims=userinfo,
        )
