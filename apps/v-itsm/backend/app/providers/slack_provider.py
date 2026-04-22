"""Slack outbound provider — AsyncWebClient 기반 chat.postMessage 송출.

v-channel-bridge 의 SlackProvider 에서 outbound 에 필요한 최소 로직만 포팅했다.
차이점
  * slack_bolt / SocketMode / receive_messages 제거 — bot token 만 있으면 동작
  * 첨부 업로드/파일 전송/리액션 제거 (Phase 1 알림은 text + optional blocks)
  * Teams → Slack markdown 변환 제거 — ITSM 은 Slack-native 메시지만 조립
"""

from typing import Any

import structlog
from slack_sdk.errors import SlackApiError
from slack_sdk.web.async_client import AsyncWebClient

from app.providers.base import BaseOutboundProvider
from app.schemas.common_message import CommonMessage

logger = structlog.get_logger(__name__)


class SlackOutboundProvider(BaseOutboundProvider):
    """Slack Bot Token 기반 알림 송출 provider.

    Config
        bot_token : xoxb-... (필수)
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(platform_name="slack", config=config)
        self.bot_token: str = config.get("bot_token", "")
        self.client: AsyncWebClient | None = None
        self.bot_user_id: str | None = None

    async def connect(self) -> bool:
        if not self.bot_token:
            self.last_error = "bot_token missing"
            logger.warning("SlackOutboundProvider: bot_token missing")
            return False

        try:
            self.client = AsyncWebClient(token=self.bot_token)
            resp = await self.client.auth_test()
            if not resp.get("ok"):
                self.last_error = str(resp.get("error", "auth_test failed"))
                logger.warning("Slack auth_test failed", error=self.last_error)
                return False
            self.bot_user_id = resp.get("user_id")
            self.is_connected = True
            self.last_error = None
            logger.info(
                "Slack provider connected",
                bot_user_id=self.bot_user_id,
                team=resp.get("team"),
            )
            return True
        except SlackApiError as e:
            self.last_error = str(e)
            logger.error("Slack auth_test error", error=str(e))
            return False
        except Exception as e:
            self.last_error = str(e)
            logger.error("Slack connect error", error=str(e))
            return False

    async def disconnect(self) -> bool:
        self.client = None
        self.is_connected = False
        return True

    async def send_message(self, message: CommonMessage) -> bool:
        if not self.client or not self.is_connected:
            logger.warning("Slack provider not connected; drop message")
            return False
        try:
            payload = self.transform_from_common(message)
            result = await self.client.chat_postMessage(**payload)
            if result.get("ok"):
                logger.debug(
                    "Slack message sent",
                    channel=payload.get("channel"),
                    ts=result.get("ts"),
                )
                return True
            self.last_error = str(result.get("error", "unknown"))
            logger.warning("Slack send failed", error=self.last_error)
            return False
        except SlackApiError as e:
            self.last_error = str(e)
            logger.error("Slack API error on send", error=str(e))
            return False
        except Exception as e:
            self.last_error = str(e)
            logger.error("Slack send exception", error=str(e))
            return False

    def transform_from_common(self, message: CommonMessage) -> dict[str, Any]:
        """CommonMessage → chat.postMessage payload.

        지원 필드
            * channel = message.channel.id
            * text    = message.text
            * thread_ts = message.thread_id (선택)
            * blocks  = message.raw_message["blocks"] (선택, 호출자가 직접 조립)
        """
        payload: dict[str, Any] = {
            "channel": message.channel.id,
            "text": message.text or "",
        }
        if message.thread_id:
            payload["thread_ts"] = message.thread_id
        blocks = message.raw_message.get("blocks") if message.raw_message else None
        if blocks:
            payload["blocks"] = blocks
        return payload
