"""Teams outbound provider — Microsoft Graph (app-only) 기반 채널 메시지 송출.

v-channel-bridge 의 TeamsProvider 에서 outbound 경로만 골라서 포팅했다.
제거한 것
  * Bot Framework (botbuilder) — Activity/Conversation 수신 경로, ITSM 미사용
  * Delegated token / OneDrive 업로드 / Subscription / 리액션 수신
  * Slack ↔ Teams markdown 상호 변환 — ITSM 은 Teams 용 HTML 을 직접 조립

유지한 것
  * OAuth 2.0 client_credentials → Graph access token 캐싱 (만료 60초 전 갱신)
  * POST /teams/{team}/channels/{channel}/messages — 기본 송출
  * (선택) Power Automate incoming webhook 폴백 — 팀 없이 채널 웹훅만 있을 때
"""

import time
from typing import Any

import aiohttp
import structlog

from app.providers.base import BaseOutboundProvider
from app.schemas.common_message import CommonMessage

logger = structlog.get_logger(__name__)

_TOKEN_REFRESH_MARGIN = 60  # 초


class TeamsOutboundProvider(BaseOutboundProvider):
    """Microsoft Graph app-only 권한 기반 Teams 채널 알림 provider.

    Config
        tenant_id      : Azure AD Tenant ID (app-only 필수)
        app_id         : Azure AD App (client) ID
        app_password   : Azure AD App Secret
        team_id        : 기본 Team ID (채널 id 만 주어질 때 fallback)
        webhook_url    : (선택) Power Automate incoming webhook. Graph 호출 실패 시 사용.
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(platform_name="teams", config=config)
        self.tenant_id: str = config.get("tenant_id", "")
        self.app_id: str = config.get("app_id", "")
        self.app_password: str = config.get("app_password", "")
        self.default_team_id: str = config.get("team_id", "")
        self.webhook_url: str = config.get("webhook_url", "")

        self.session: aiohttp.ClientSession | None = None
        self.access_token: str | None = None
        self._token_expires_at: float | None = None

    async def connect(self) -> bool:
        if not (self.tenant_id and self.app_id and self.app_password):
            # webhook 만 있어도 송출 가능
            if self.webhook_url:
                self.session = aiohttp.ClientSession()
                self.is_connected = True
                self.last_error = None
                logger.info("Teams provider connected (webhook-only mode)")
                return True
            self.last_error = "tenant_id/app_id/app_password missing"
            logger.warning("TeamsOutboundProvider: graph credentials missing")
            return False

        try:
            self.session = aiohttp.ClientSession()
            await self._get_access_token()
            self.is_connected = True
            self.last_error = None
            logger.info("Teams provider connected (graph app-only)")
            return True
        except Exception as e:
            self.last_error = str(e)
            logger.error("Teams connect failed", error=str(e))
            return False

    async def disconnect(self) -> bool:
        try:
            if self.session:
                await self.session.close()
                self.session = None
            self.access_token = None
            self._token_expires_at = None
            self.is_connected = False
            return True
        except Exception as e:
            logger.error("Teams disconnect error", error=str(e))
            return False

    async def _get_access_token(self) -> str:
        if self.access_token and self._token_expires_at:
            if time.time() < self._token_expires_at - _TOKEN_REFRESH_MARGIN:
                return self.access_token

        if not self.session:
            self.session = aiohttp.ClientSession()

        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = {
            "client_id": self.app_id,
            "client_secret": self.app_password,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
        async with self.session.post(token_url, data=data) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise RuntimeError(f"Graph token fetch failed: {error_text}")
            result = await resp.json()
            self.access_token = result.get("access_token") or ""
            expires_in = int(result.get("expires_in", 3599))
            self._token_expires_at = time.time() + expires_in
            return self.access_token

    def _resolve_team_channel(self, channel_id: str) -> tuple[str, str]:
        """channel.id 포맷 해석 → (team_id, channel_id)."""
        if ":" in channel_id and not channel_id.startswith("19:"):
            team_part, chan_part = channel_id.split(":", 1)
            return team_part, chan_part
        return self.default_team_id, channel_id

    async def send_message(self, message: CommonMessage) -> bool:
        if not self.is_connected or not self.session:
            logger.warning("Teams provider not connected; drop message")
            return False

        payload = self.transform_from_common(message)

        # Graph API 경로 (우선)
        if self.access_token or (self.tenant_id and self.app_id and self.app_password):
            try:
                return await self._send_via_graph(message.channel.id, payload)
            except Exception as e:
                logger.warning(
                    "Teams graph send failed, will try webhook fallback",
                    error=str(e),
                )

        # webhook fallback
        if self.webhook_url:
            return await self._send_via_webhook(payload)

        self.last_error = "No transport available"
        return False

    async def _send_via_graph(self, channel_id: str, payload: dict[str, Any]) -> bool:
        token = await self._get_access_token()
        team_id, chan = self._resolve_team_channel(channel_id)
        if not team_id:
            self.last_error = "team_id missing"
            logger.warning("Teams send skipped — team_id not resolved", channel=channel_id)
            return False

        url = (
            f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels/{chan}/messages"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        assert self.session is not None
        async with self.session.post(url, headers=headers, json=payload) as resp:
            if resp.status in (200, 201):
                logger.debug("Teams message sent via Graph", channel=chan)
                return True
            error_text = await resp.text()
            self.last_error = f"{resp.status}: {error_text[:200]}"
            logger.warning(
                "Teams Graph send failed",
                status=resp.status,
                error=error_text[:200],
            )
            return False

    async def _send_via_webhook(self, payload: dict[str, Any]) -> bool:
        assert self.session is not None
        body = payload.get("body", {})
        text = body.get("content", "") if isinstance(body, dict) else ""
        hook_payload = {"text": text}
        async with self.session.post(self.webhook_url, json=hook_payload) as resp:
            if resp.status in (200, 202):
                logger.debug("Teams message sent via webhook")
                return True
            error_text = await resp.text()
            self.last_error = f"webhook {resp.status}: {error_text[:200]}"
            logger.warning("Teams webhook send failed", status=resp.status)
            return False

    def transform_from_common(self, message: CommonMessage) -> dict[str, Any]:
        """CommonMessage → Graph `chatMessage` payload.

        지원 필드
            * body.content = message.text (HTML 허용)
            * body.contentType = message.raw_message["contentType"] (기본 "html")
            * 호출자가 pre-rendered HTML 을 `text` 로 넘긴다고 가정 (ITSM 쪽에서 조립)
        """
        content_type = "html"
        if message.raw_message and message.raw_message.get("contentType"):
            content_type = message.raw_message["contentType"]

        return {
            "body": {
                "contentType": content_type,
                "content": message.text or "",
            },
        }
