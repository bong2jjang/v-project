---
name: scaffold-provider
description: Provider 스캐폴딩 - 기본 구조, 템플릿 코드, 테스트 파일 자동 생성
---

# Provider 스캐폴딩 스킬

Provider 기본 구조를 자동으로 생성합니다. SlackProvider, TeamsProvider 등 새로운 Provider 개발 시 사용합니다.

## 입력 파라미터

- `provider_name`: Provider 이름 (예: Slack, Teams, Discord)
- `platform_type`: 플랫폼 타입 (socket_mode, webhook, api)

## 생성되는 파일

```
backend/app/adapters/
├── {provider_name.lower()}_provider.py  # Provider 구현
backend/tests/providers/
├── test_{provider_name.lower()}_provider.py  # 단위 테스트
backend/tests/fixtures/
├── {provider_name.lower()}_message.json  # Mock 데이터
```

## Provider 템플릿 구조

```python
# backend/app/adapters/{provider_name.lower()}_provider.py

from abc import ABC
from typing import Optional, Dict, Any
import structlog
from app.schemas.common_message import CommonMessage, MessageType, Platform, User, Channel
from app.adapters.base_provider import BasePlatformProvider

logger = structlog.get_logger()


class {provider_name}Provider(BasePlatformProvider):
    """
    {provider_name} 플랫폼 Provider

    {platform_type} 방식으로 메시지를 수신하고 전송합니다.
    """

    def __init__(
        self,
        app_token: str,
        bot_token: Optional[str] = None,
        **kwargs
    ):
        """Provider 초기화"""
        self.app_token = app_token
        self.bot_token = bot_token
        self.platform = Platform.{provider_name.upper()}
        self.client = None
        self.connected = False

        logger.info(
            "{provider_name}_provider_init",
            platform=self.platform.value
        )

    async def connect(self) -> bool:
        """
        {provider_name} 플랫폼에 연결

        Returns:
            bool: 연결 성공 여부
        """
        try:
            # TODO: 플랫폼별 연결 로직 구현
            # 예: Socket Mode 연결, Webhook 등록, API 클라이언트 초기화

            logger.info(
                "{provider_name.lower()}_connected",
                platform=self.platform.value
            )
            self.connected = True
            return True

        except Exception as e:
            logger.error(
                "{provider_name.lower()}_connect_failed",
                error=str(e),
                platform=self.platform.value
            )
            self.connected = False
            return False

    async def disconnect(self) -> bool:
        """플랫폼 연결 해제"""
        try:
            # TODO: 연결 해제 로직 구현

            self.connected = False
            logger.info(
                "{provider_name.lower()}_disconnected",
                platform=self.platform.value
            )
            return True

        except Exception as e:
            logger.error(
                "{provider_name.lower()}_disconnect_failed",
                error=str(e)
            )
            return False

    async def send_message(self, message: CommonMessage) -> bool:
        """
        CommonMessage를 {provider_name} 메시지로 변환하여 전송

        Args:
            message: 전송할 CommonMessage

        Returns:
            bool: 전송 성공 여부
        """
        if not self.connected:
            logger.error(
                "send_message_not_connected",
                platform=self.platform.value
            )
            return False

        try:
            # CommonMessage → {provider_name} 메시지 변환
            platform_message = self._transform_from_common(message)

            # TODO: 플랫폼 API를 통해 메시지 전송
            # 예: self.client.chat_postMessage(...)

            logger.info(
                "{provider_name.lower()}_message_sent",
                message_id=message.message_id,
                channel=message.channel.channel_id,
                platform=self.platform.value
            )
            return True

        except Exception as e:
            logger.error(
                "{provider_name.lower()}_send_failed",
                error=str(e),
                message_id=message.message_id
            )
            return False

    def transform_to_common(self, raw_message: Dict[str, Any]) -> CommonMessage:
        """
        {provider_name} 메시지를 CommonMessage로 변환

        Args:
            raw_message: 플랫폼 원본 메시지

        Returns:
            CommonMessage: 변환된 공통 메시지
        """
        try:
            # TODO: 플랫폼별 메시지 구조에 맞게 변환
            common_message = CommonMessage(
                message_id=raw_message.get("id", ""),
                timestamp=raw_message.get("timestamp"),
                type=MessageType.TEXT,
                platform=self.platform,
                text=raw_message.get("text", ""),
                user=User(
                    user_id=raw_message.get("user_id", ""),
                    username=raw_message.get("username", ""),
                    display_name=raw_message.get("display_name", "")
                ),
                channel=Channel(
                    channel_id=raw_message.get("channel_id", ""),
                    channel_name=raw_message.get("channel_name", "")
                ),
                raw_message=raw_message
            )

            logger.debug(
                "{provider_name.lower()}_message_transformed",
                message_id=common_message.message_id,
                platform=self.platform.value
            )
            return common_message

        except Exception as e:
            logger.error(
                "{provider_name.lower()}_transform_failed",
                error=str(e),
                raw_message=raw_message
            )
            raise

    def _transform_from_common(self, message: CommonMessage) -> Dict[str, Any]:
        """
        CommonMessage를 {provider_name} 메시지 형식으로 변환 (내부용)

        Args:
            message: CommonMessage

        Returns:
            Dict: {provider_name} 플랫폼 메시지 형식
        """
        # TODO: CommonMessage → 플랫폼 메시지 변환
        platform_message = {
            "channel": message.channel.channel_id,
            "text": message.text,
            # ... 플랫폼별 추가 필드
        }

        return platform_message

    async def health_check(self) -> Dict[str, Any]:
        """Provider 헬스체크"""
        return {
            "platform": self.platform.value,
            "connected": self.connected,
            "status": "healthy" if self.connected else "disconnected"
        }
```

## 테스트 템플릿 구조

```python
# backend/tests/providers/test_{provider_name.lower()}_provider.py

import pytest
from datetime import datetime
from app.adapters.{provider_name.lower()}_provider import {provider_name}Provider
from app.schemas.common_message import CommonMessage, MessageType, Platform, User, Channel


@pytest.fixture
def {provider_name.lower()}_provider():
    """Provider 인스턴스 생성"""
    return {provider_name}Provider(
        app_token="test-app-token",
        bot_token="test-bot-token"
    )


@pytest.fixture
def mock_{provider_name.lower()}_message():
    """Mock {provider_name} 메시지"""
    return {
        "id": "msg-123",
        "timestamp": "2024-01-01T00:00:00Z",
        "user_id": "U123",
        "username": "testuser",
        "display_name": "Test User",
        "channel_id": "C123",
        "channel_name": "general",
        "text": "Hello, World!"
    }


@pytest.fixture
def mock_common_message():
    """Mock CommonMessage"""
    return CommonMessage(
        message_id="msg-123",
        timestamp=datetime.now(),
        type=MessageType.TEXT,
        platform=Platform.{provider_name.upper()},
        text="Hello from Common Schema!",
        user=User(
            user_id="U123",
            username="testuser",
            display_name="Test User"
        ),
        channel=Channel(
            channel_id="C123",
            channel_name="general"
        ),
        raw_message={}
    )


class Test{provider_name}ProviderInit:
    """Provider 초기화 테스트"""

    def test_init_success(self, {provider_name.lower()}_provider):
        """Provider 초기화 성공"""
        assert {provider_name.lower()}_provider.platform == Platform.{provider_name.upper()}
        assert {provider_name.lower()}_provider.connected is False
        assert {provider_name.lower()}_provider.app_token == "test-app-token"


@pytest.mark.asyncio
class Test{provider_name}ProviderConnection:
    """Provider 연결 테스트"""

    async def test_connect_success(self, {provider_name.lower()}_provider, mocker):
        """연결 성공 테스트"""
        # TODO: Mock 플랫폼 연결
        result = await {provider_name.lower()}_provider.connect()

        assert result is True
        assert {provider_name.lower()}_provider.connected is True

    async def test_disconnect_success(self, {provider_name.lower()}_provider):
        """연결 해제 테스트"""
        await {provider_name.lower()}_provider.connect()
        result = await {provider_name.lower()}_provider.disconnect()

        assert result is True
        assert {provider_name.lower()}_provider.connected is False


@pytest.mark.asyncio
class Test{provider_name}ProviderTransform:
    """메시지 변환 테스트"""

    def test_transform_to_common(
        self,
        {provider_name.lower()}_provider,
        mock_{provider_name.lower()}_message
    ):
        """{provider_name} → CommonMessage 변환"""
        common_message = {provider_name.lower()}_provider.transform_to_common(
            mock_{provider_name.lower()}_message
        )

        assert isinstance(common_message, CommonMessage)
        assert common_message.platform == Platform.{provider_name.upper()}
        assert common_message.message_id == "msg-123"
        assert common_message.text == "Hello, World!"
        assert common_message.user.user_id == "U123"
        assert common_message.channel.channel_id == "C123"

    async def test_send_message(
        self,
        {provider_name.lower()}_provider,
        mock_common_message,
        mocker
    ):
        """CommonMessage → {provider_name} 전송"""
        # Mock 연결
        await {provider_name.lower()}_provider.connect()

        # TODO: Mock 플랫폼 API
        # mock_send = mocker.patch.object(...)

        result = await {provider_name.lower()}_provider.send_message(mock_common_message)

        assert result is True


@pytest.mark.asyncio
class Test{provider_name}ProviderHealthCheck:
    """헬스체크 테스트"""

    async def test_health_check_connected(self, {provider_name.lower()}_provider):
        """연결 상태 헬스체크"""
        await {provider_name.lower()}_provider.connect()
        health = await {provider_name.lower()}_provider.health_check()

        assert health["platform"] == Platform.{provider_name.upper()}.value
        assert health["connected"] is True
        assert health["status"] == "healthy"

    async def test_health_check_disconnected(self, {provider_name.lower()}_provider):
        """연결 해제 상태 헬스체크"""
        health = await {provider_name.lower()}_provider.health_check()

        assert health["connected"] is False
        assert health["status"] == "disconnected"
```

## Mock 데이터 템플릿

```json
// backend/tests/fixtures/{provider_name.lower()}_message.json
{
  "id": "msg-123",
  "timestamp": "2024-01-01T00:00:00Z",
  "user_id": "U123",
  "username": "testuser",
  "display_name": "Test User",
  "channel_id": "C123",
  "channel_name": "general",
  "text": "Hello, World!",
  "attachments": [],
  "mentions": []
}
```

## 실행 후 TODO 체크리스트

Provider 생성 후 다음 항목들을 구현해야 합니다:

### 필수 구현 항목
- [ ] `connect()` 메서드 - 플랫폼별 연결 로직
- [ ] `send_message()` 메서드 - 실제 API 호출
- [ ] `transform_to_common()` 메서드 - 플랫폼 메시지 파싱
- [ ] `_transform_from_common()` 메서드 - CommonMessage 변환

### 플랫폼별 구현
- [ ] 인증 방식 구현 (OAuth, Token, API Key)
- [ ] 메시지 수신 방식 구현 (WebSocket, Webhook, Polling)
- [ ] 에러 처리 및 재시도 로직
- [ ] Rate Limiting 처리

### 테스트 구현
- [ ] Mock 클라이언트 설정
- [ ] 연결 테스트
- [ ] 메시지 변환 테스트
- [ ] 에러 케이스 테스트

## 관련 스킬
- `validate-common-schema` - 생성된 Provider의 CommonMessage 변환 검증
- `add-route-rule` - Provider 추가 후 라우팅 룰 설정

## 사용 예시

```bash
# migration-helper agent에서 자동 호출
"Slack Provider를 스캐폴딩해주세요"
→ scaffold-provider skill 호출 (provider_name=Slack, platform_type=socket_mode)
```
