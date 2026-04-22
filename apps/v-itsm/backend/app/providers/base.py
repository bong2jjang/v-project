"""Outbound provider 추상 클래스.

v-channel-bridge 의 `BasePlatformProvider` 를 **outbound 전용**으로 축약.
v-itsm 은 알림 송출만 필요하므로 receive/transform_to_common 등은 제거.
"""

from abc import ABC, abstractmethod
from typing import Any

from app.schemas.common_message import CommonMessage


class BaseOutboundProvider(ABC):
    """알림 송출 전용 provider 추상.

    구현체
        * SlackOutboundProvider — slack_sdk AsyncWebClient
        * TeamsOutboundProvider — aiohttp + Microsoft Graph (app-only)
    """

    def __init__(self, platform_name: str, config: dict[str, Any]):
        self.platform_name = platform_name
        self.config = config
        self.is_connected = False
        self.last_error: str | None = None

    @abstractmethod
    async def connect(self) -> bool:
        """플랫폼 인증·세션 준비. 성공 시 `is_connected=True`."""

    @abstractmethod
    async def disconnect(self) -> bool:
        """세션 정리."""

    @abstractmethod
    async def send_message(self, message: CommonMessage) -> bool:
        """CommonMessage 를 플랫폼 페이로드로 변환해 송출."""

    @abstractmethod
    def transform_from_common(self, message: CommonMessage) -> dict[str, Any]:
        """CommonMessage → 플랫폼별 페이로드."""

    async def health_check(self) -> bool:
        return self.is_connected

    def get_status(self) -> dict[str, Any]:
        return {
            "platform": self.platform_name,
            "connected": self.is_connected,
            "last_error": self.last_error,
            "config": {
                k: ("***" if any(s in k.lower() for s in ("token", "secret", "password")) else v)
                for k, v in self.config.items()
            },
        }
