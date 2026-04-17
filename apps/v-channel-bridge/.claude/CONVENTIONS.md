# v-channel-bridge 고유 컨벤션

Slack ↔ Teams 메시지 브리지 앱의 고유 아키텍처 규칙입니다. 공통 규칙은 `.claude/shared/coding_conventions.md`, 플랫폼 규칙은 `.claude/platform/CONVENTIONS.md` 참조.

## Provider Pattern (메시징 플랫폼 어댑터)

모든 메시징 플랫폼 (Slack, Teams 등)은 `BasePlatformProvider` 인터페이스를 구현해야 합니다.

### Provider 구현 규칙

```python
# apps/v-channel-bridge/backend/app/adapters/base.py
from abc import ABC, abstractmethod
from typing import AsyncIterator
from app.schemas.common_message import CommonMessage

class BasePlatformProvider(ABC):
    """플랫폼 제공자 인터페이스"""

    @abstractmethod
    async def connect(self) -> bool:
        """플랫폼에 연결"""
        pass

    @abstractmethod
    async def send_message(self, message: CommonMessage) -> bool:
        """Common Schema → 플랫폼 메시지로 변환하여 전송"""
        pass

    @abstractmethod
    def transform_to_common(self, raw_message: dict) -> CommonMessage:
        """플랫폼 메시지 → Common Schema 변환"""
        pass
```

### Provider 구현 체크리스트

- [ ] `BasePlatformProvider` 상속
- [ ] 모든 추상 메서드 구현 (`connect`, `disconnect`, `send_message` 등)
- [ ] 비동기 메서드에 `async def` 사용
- [ ] `transform_to_common`, `transform_from_common` 구현 필수
- [ ] 에러 처리: Provider 내부 에러는 독립적으로 처리, 상위로 전파하지 않음
- [ ] 로깅: `structlog` 사용
- [ ] 타입 힌트: 모든 메서드에 타입 어노테이션

### 예시: Slack Provider

```python
# apps/v-channel-bridge/backend/app/adapters/slack_provider.py
from slack_bolt.async_app import AsyncApp
from app.adapters.base import BasePlatformProvider
from app.schemas.common_message import CommonMessage, Platform, MessageType

class SlackProvider(BasePlatformProvider):
    """Slack Socket Mode 제공자"""

    def __init__(self, bot_token: str, app_token: str):
        self.app = AsyncApp(token=bot_token)
        self.app_token = app_token

    async def connect(self) -> bool:
        """Socket Mode 연결"""
        try:
            await self.socket_handler.start_async()
            return True
        except Exception as e:
            logger.error("slack_connection_failed", error=str(e))
            return False

    async def send_message(self, message: CommonMessage) -> bool:
        """Common Schema → Slack 메시지 전송"""
        slack_msg = self.transform_from_common(message)
        result = await self.app.client.chat_postMessage(**slack_msg)
        return result["ok"]

    def transform_to_common(self, slack_event: dict) -> CommonMessage:
        """Slack 이벤트 → Common Schema 변환"""
        return CommonMessage(
            message_id=slack_event["ts"],
            platform=Platform.SLACK,
            type=MessageType.TEXT,
            text=slack_event.get("text", ""),
            # ... 나머지 필드 매핑
        )
```

## Common Message Schema

모든 메시지는 내부적으로 `CommonMessage` 스키마로 변환합니다.

### Common Schema 규칙

```python
# apps/v-channel-bridge/backend/app/schemas/common_message.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class CommonMessage(BaseModel):
    """통합 메시지 스키마"""
    # 필수 필드
    message_id: str
    timestamp: datetime
    type: MessageType
    platform: Platform

    # 사용자/채널 정보
    user: User
    channel: Channel

    # 메시지 내용
    text: Optional[str] = None
    attachments: List[Attachment] = []

    # 원본 메시지 (디버깅용)
    raw_message: dict[str, Any] = {}
```

### Common Schema 사용 규칙

- [ ] 플랫폼별 메시지는 반드시 `CommonMessage`로 변환
- [ ] `raw_message` 필드에 원본 메시지 보존 (디버깅/로깅용)
- [ ] 필수 필드 누락 시 기본값 설정 또는 예외 발생
- [ ] `Optional` 필드는 명시적으로 `None` 허용
- [ ] Pydantic validation 활용 (자동 타입 검증)

## Command Processor (커맨드 처리)

사용자가 `/vms status`, `/bridge list` 같은 커맨드를 입력하면 처리합니다.

### Command Processor 규칙

```python
# apps/v-channel-bridge/backend/app/services/command_processor.py
class CommandProcessor:
    """커맨드 처리기"""

    def __init__(self):
        self.commands = {
            "/vms": self._handle_vms_command,
            "/bridge": self._handle_bridge_command,
        }

    async def process(self, message: CommonMessage) -> Optional[CommonMessage]:
        """메시지가 커맨드인지 확인하고 처리"""
        if not message.text or not message.text.startswith("/"):
            return None

        parts = message.text.split()
        command = parts[0].lower()
        args = parts[1:] if len(parts) > 1 else []

        handler = self.commands.get(command)
        if not handler:
            return self._create_error_response(message, "알 수 없는 커맨드")

        return await handler(message, args)
```

### Command Processor 체크리스트

- [ ] 커맨드 핸들러는 `async def` 함수
- [ ] 모든 핸들러는 `CommonMessage` 반환
- [ ] 에러 메시지도 `CommonMessage`로 반환
- [ ] 인증/권한 체크 (필요시)
- [ ] 로깅: 커맨드 실행 로그 기록

## Dynamic Routing (동적 라우팅)

Redis를 사용하여 재시작 없이 라우팅 룰을 변경합니다. 키 네임스페이스는 **반드시 `route:*`** 로 유지하세요.

### Redis 키 구조

```
route:{platform}:{channel_id}               → SMEMBERS (대상 집합)
route:{platform}:{channel_id}:names         → HGETALL (채널 이름)
route:{platform}:{channel_id}:modes         → HGETALL (sender_info | editable)
route:{platform}:{channel_id}:bidirectional → HGETALL ("1" | "0")
```

### Dynamic Routing 규칙

```python
# apps/v-channel-bridge/backend/app/services/route_manager.py
import redis.asyncio as redis

class RouteManager:
    """Redis 기반 동적 라우팅"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def add_route(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ):
        """라우팅 룰 추가"""
        key = f"route:{source_platform}:{source_channel}"
        value = f"{target_platform}:{target_channel}"
        await self.redis.sadd(key, value)

    async def get_targets(
        self, source_platform: str, source_channel: str
    ) -> list[Channel]:
        """소스 채널의 타겟 채널 목록 조회"""
        key = f"route:{source_platform}:{source_channel}"
        targets = await self.redis.smembers(key)
        return [self._parse_target(t) for t in targets]
```

### Dynamic Routing 체크리스트

- [ ] Redis 키는 `route:*` 네임스페이스 준수 (다른 앱과 충돌 방지)
- [ ] 실시간 룰 변경 지원 (재시작 불필요)
- [ ] 다대다 라우팅 지원 (1개 소스 → N개 타겟)
- [ ] 양방향 Route는 `is_bidirectional=True` 로 자동 역방향 생성
- [ ] UI에서 양방향은 1개로 표시 (dedup, `frozenset` 쌍 추적)
- [ ] Teams 채널 ID는 `{teamId}:{channelId}` 포맷 (`_parse_channel_ref()` 로 파싱)
- [ ] 라우팅 룰 검증 (순환 참조 방지)

## 비동기 프로그래밍 (Async/Await)

Provider의 모든 I/O 작업은 비동기로 처리합니다.

### 비동기 규칙

- [ ] 네트워크 I/O: `async def` 사용
- [ ] Redis 작업: `redis.asyncio` 사용
- [ ] DB 작업: SQLAlchemy async 엔진 사용
- [ ] 동시 작업: `asyncio.gather()` 활용
- [ ] 블로킹 금지: `time.sleep()` 대신 `asyncio.sleep()` 사용

```python
# ✅ 올바른 비동기 사용
async def send_to_multiple_targets(message: CommonMessage, targets: list[Channel]):
    tasks = [provider.send_message(message) for provider in providers]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results

# ❌ 잘못된 사용 (동기 반복)
async def send_to_multiple_targets(message: CommonMessage, targets: list[Channel]):
    for provider in providers:
        await provider.send_message(message)  # 순차 실행 (느림)
```

## 에러 처리 및 로깅

### Provider 에러 격리

각 Provider의 에러는 독립적으로 처리합니다. 한 플랫폼의 에러가 다른 플랫폼 전송을 막으면 안 됩니다.

```python
# ✅ 에러 격리
async def route_message(self, message: CommonMessage):
    """메시지 라우팅 (에러 격리)"""
    targets = await self.route_manager.get_targets(
        message.platform, message.channel.id
    )

    tasks = []
    for target in targets:
        provider = self.providers[target.platform]
        tasks.append(self._safe_send(provider, message))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(
                "message_send_failed",
                target=targets[i],
                error=str(result)
            )

async def _safe_send(self, provider, message):
    """안전한 메시지 전송 (에러 캡처)"""
    try:
        return await provider.send_message(message)
    except Exception as e:
        logger.error("provider_error", provider=provider.__class__.__name__, error=str(e))
        return False
```

### Structlog 사용

```python
import structlog

logger = structlog.get_logger()

# ✅ 구조화된 로깅
logger.info(
    "message_received",
    platform="slack",
    channel_id="C123456",
    message_id="1234567890.123456"
)

logger.error(
    "provider_connection_failed",
    provider="SlackProvider",
    error=str(e),
    retry_count=3
)
```

## 테스트 규칙

### Provider 단위 테스트

```python
# tests/adapters/test_slack_provider.py
import pytest
from app.adapters.slack_provider import SlackProvider
from app.schemas.common_message import CommonMessage, Platform

@pytest.mark.asyncio
async def test_slack_connect():
    """Slack 연결 테스트"""
    provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
    result = await provider.connect()
    assert result is True

@pytest.mark.asyncio
async def test_transform_to_common():
    """Slack → Common Schema 변환 테스트"""
    slack_event = {
        "type": "message",
        "user": "U123456",
        "text": "Hello World",
        "channel": "C789012",
        "ts": "1234567890.123456"
    }

    provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
    common_msg = provider.transform_to_common(slack_event)

    assert common_msg.platform == Platform.SLACK
    assert common_msg.text == "Hello World"
    assert common_msg.user.id == "U123456"
```

### 테스트 체크리스트

- [ ] Provider별 단위 테스트 작성
- [ ] 메시지 변환 로직 테스트
- [ ] 에러 처리 테스트
- [ ] 통합 테스트: Slack → Teams E2E
- [ ] Mock 사용: 외부 API 호출 Mock 처리
