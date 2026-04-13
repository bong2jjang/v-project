"""
BasePlatformProvider: Provider Pattern Interface for Light-Zowe Architecture

Zowe Chat의 Provider Pattern을 VMS Channel Bridge에 적용한 추상 인터페이스.
새로운 플랫폼(Slack, Teams, Mattermost, 카카오워크 등)을 추가할 때
이 인터페이스를 구현하면 됩니다.

작성일: 2026-03-31
영감: Zowe Chat Provider Pattern
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator, List, Dict, Any, Optional
from app.schemas.common_message import CommonMessage, Channel, User


class BasePlatformProvider(ABC):
    """
    플랫폼 제공자 추상 인터페이스 (Zowe Chat Provider Pattern)

    모든 플랫폼 어댑터는 이 인터페이스를 구현해야 합니다.
    이를 통해 플랫폼별 구현을 격리하고 확장성을 보장합니다.

    구현 예시:
        - SlackProvider: Slack Socket Mode 기반 구현
        - TeamsProvider: Microsoft Graph API 기반 구현
        - MattermostProvider: Mattermost API 기반 구현
        - KakaoWorkProvider: 카카오워크 API 기반 구현
    """

    def __init__(self, platform_name: str, config: Dict[str, Any]):
        """
        Provider 초기화

        Args:
            platform_name: 플랫폼 이름 (예: "slack", "teams")
            config: 플랫폼별 설정 딕셔너리
        """
        self.platform_name = platform_name
        self.config = config
        self.is_connected = False
        self.last_error: Optional[str] = None

    @abstractmethod
    async def connect(self) -> bool:
        """
        플랫폼에 연결

        Returns:
            연결 성공 여부

        Raises:
            ConnectionError: 연결 실패 시
        """
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        """
        플랫폼 연결 해제

        Returns:
            연결 해제 성공 여부
        """
        pass

    @abstractmethod
    async def send_message(self, message: CommonMessage) -> bool:
        """
        Common Schema 메시지를 플랫폼 형식으로 변환하여 전송

        Args:
            message: CommonMessage 스키마 메시지

        Returns:
            전송 성공 여부

        Example:
            ```python
            msg = CommonMessage(
                message_id="msg-123",
                timestamp=datetime.now(),
                type=MessageType.TEXT,
                platform=Platform.SLACK,
                user=...,
                channel=...,
                text="Hello World"
            )
            await provider.send_message(msg)
            ```
        """
        pass

    @abstractmethod
    async def receive_messages(self) -> AsyncIterator[CommonMessage]:
        """
        플랫폼 메시지를 Common Schema로 변환하여 수신

        비동기 제너레이터로 실시간 메시지 스트림을 반환합니다.

        Yields:
            CommonMessage: 변환된 메시지

        Example:
            ```python
            async for message in provider.receive_messages():
                await process_message(message)
            ```
        """
        pass

    @abstractmethod
    async def get_channels(self) -> List[Channel]:
        """
        플랫폼의 채널 목록 조회

        Returns:
            Channel 객체 리스트
        """
        pass

    @abstractmethod
    async def get_users(self) -> List[User]:
        """
        플랫폼의 사용자 목록 조회

        Returns:
            User 객체 리스트
        """
        pass

    @abstractmethod
    def transform_to_common(self, raw_message: Dict[str, Any]) -> CommonMessage:
        """
        플랫폼 원본 메시지 → Common Schema 변환

        각 플랫폼의 메시지 포맷을 CommonMessage로 변환합니다.

        Args:
            raw_message: 플랫폼별 원본 메시지 딕셔너리

        Returns:
            CommonMessage: 변환된 메시지

        Example (Slack):
            ```python
            slack_event = {
                "type": "message",
                "user": "U123456",
                "text": "Hello",
                "channel": "C789012",
                "ts": "1234567890.123456"
            }
            common_msg = provider.transform_to_common(slack_event)
            ```
        """
        pass

    @abstractmethod
    def transform_from_common(self, message: CommonMessage) -> Dict[str, Any]:
        """
        Common Schema → 플랫폼 메시지 변환

        CommonMessage를 각 플랫폼의 메시지 포맷으로 변환합니다.

        Args:
            message: CommonMessage 스키마 메시지

        Returns:
            플랫폼별 메시지 딕셔너리

        Example (Slack):
            ```python
            common_msg = CommonMessage(...)
            slack_msg = provider.transform_from_common(common_msg)
            # slack_msg = {
            #     "channel": "C789012",
            #     "text": "Hello",
            #     "thread_ts": "1234567890.123456"
            # }
            ```
        """
        pass

    async def health_check(self) -> bool:
        """
        Provider 헬스체크

        Returns:
            정상 작동 여부
        """
        return self.is_connected

    def get_status(self) -> Dict[str, Any]:
        """
        Provider 상태 조회

        Returns:
            상태 정보 딕셔너리
        """
        return {
            "platform": self.platform_name,
            "connected": self.is_connected,
            "config": {
                # 민감한 정보 제외
                k: ("***" if "token" in k.lower() or "password" in k.lower() else v)
                for k, v in self.config.items()
            },
        }
