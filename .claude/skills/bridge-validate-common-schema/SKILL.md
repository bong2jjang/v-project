---
name: bridge-validate-common-schema
description: CommonMessage 스키마 변환 검증 - Pydantic 모델 유효성, 변환 로직 정확성 확인 (v-channel-bridge 앱 전용)
---

# CommonMessage 스키마 검증 스킬

Provider의 CommonMessage 변환 로직이 올바르게 작동하는지 검증합니다.

## 검증 항목

### 1. 필수 필드 검증
- `message_id` - 고유 ID 존재
- `timestamp` - datetime 타입
- `type` - MessageType enum 값
- `platform` - Platform enum 값
- `user` - User 객체 (user_id, username 필수)
- `channel` - Channel 객체 (channel_id 필수)

### 2. 선택 필드 검증
- `text` - Optional[str], 텍스트 메시지
- `attachments` - List[Attachment], 첨부파일
- `mentions` - List[str], 멘션된 사용자
- `reactions` - List[Reaction], 리액션
- `thread_id` - Optional[str], 스레드 ID

### 3. 양방향 변환 검증
- Platform Message → CommonMessage → Platform Message
- 원본과 변환 결과 동일성 확인

## 검증 워크플로우

### 1. Pydantic 모델 검증

```python
# apps/v-channel-bridge/backend/tests/schemas/test_common_message.py

import pytest
from datetime import datetime
from app.schemas.common_message import (
    CommonMessage,
    MessageType,
    Platform,
    User,
    Channel,
    Attachment
)


def test_common_message_required_fields():
    """필수 필드만으로 CommonMessage 생성"""
    message = CommonMessage(
        message_id="msg-123",
        timestamp=datetime.now(),
        type=MessageType.TEXT,
        platform=Platform.SLACK,
        user=User(
            user_id="U123",
            username="testuser"
        ),
        channel=Channel(
            channel_id="C123"
        ),
        raw_message={}
    )

    assert message.message_id == "msg-123"
    assert message.type == MessageType.TEXT
    assert message.platform == Platform.SLACK
    assert message.user.user_id == "U123"
    assert message.channel.channel_id == "C123"


def test_common_message_optional_fields():
    """선택 필드 포함 CommonMessage 생성"""
    message = CommonMessage(
        message_id="msg-123",
        timestamp=datetime.now(),
        type=MessageType.TEXT,
        platform=Platform.SLACK,
        text="Hello, World!",
        user=User(
            user_id="U123",
            username="testuser",
            display_name="Test User"
        ),
        channel=Channel(
            channel_id="C123",
            channel_name="general"
        ),
        attachments=[
            Attachment(
                type="image",
                url="https://example.com/image.png",
                title="Example Image"
            )
        ],
        mentions=["U456", "U789"],
        raw_message={}
    )

    assert message.text == "Hello, World!"
    assert message.user.display_name == "Test User"
    assert message.channel.channel_name == "general"
    assert len(message.attachments) == 1
    assert len(message.mentions) == 2


def test_common_message_validation_error():
    """필수 필드 누락 시 ValidationError"""
    with pytest.raises(ValueError):
        CommonMessage(
            # message_id 누락
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=User(user_id="U123", username="testuser"),
            channel=Channel(channel_id="C123"),
            raw_message={}
        )
```

### 2. Provider 변환 검증

```python
# apps/v-channel-bridge/backend/tests/providers/test_slack_provider_schema.py

import pytest
from app.adapters.slack_provider import SlackProvider
from app.schemas.common_message import CommonMessage, Platform


@pytest.fixture
def slack_provider():
    return SlackProvider(
        app_token="test-token",
        bot_token="test-bot-token"
    )


@pytest.fixture
def slack_text_message():
    """Slack 텍스트 메시지"""
    return {
        "type": "message",
        "channel": "C12345678",
        "user": "U12345678",
        "text": "Hello, Teams!",
        "ts": "1234567890.123456"
    }


@pytest.fixture
def slack_attachment_message():
    """Slack 첨부파일 메시지"""
    return {
        "type": "message",
        "channel": "C12345678",
        "user": "U12345678",
        "text": "Check this out!",
        "ts": "1234567890.123456",
        "files": [
            {
                "id": "F12345678",
                "name": "example.pdf",
                "mimetype": "application/pdf",
                "url_private": "https://files.slack.com/files-pri/..."
            }
        ]
    }


class TestSlackToCommonTransform:
    """Slack → CommonMessage 변환 테스트"""

    def test_text_message_transform(self, slack_provider, slack_text_message):
        """텍스트 메시지 변환"""
        common = slack_provider.transform_to_common(slack_text_message)

        assert isinstance(common, CommonMessage)
        assert common.platform == Platform.SLACK
        assert common.text == "Hello, Teams!"
        assert common.user.user_id == "U12345678"
        assert common.channel.channel_id == "C12345678"
        assert common.message_id is not None
        assert common.timestamp is not None

    def test_attachment_message_transform(
        self,
        slack_provider,
        slack_attachment_message
    ):
        """첨부파일 메시지 변환"""
        common = slack_provider.transform_to_common(slack_attachment_message)

        assert common.text == "Check this out!"
        assert len(common.attachments) == 1
        assert common.attachments[0].type == "file"
        assert common.attachments[0].title == "example.pdf"

    def test_mention_transform(self, slack_provider):
        """멘션 변환"""
        slack_message = {
            "type": "message",
            "channel": "C12345678",
            "user": "U12345678",
            "text": "Hello <@U87654321>!",
            "ts": "1234567890.123456"
        }

        common = slack_provider.transform_to_common(slack_message)

        assert "U87654321" in common.mentions
        # 멘션 형식 정규화 확인
        assert "<@U87654321>" not in common.text or "@U87654321" in common.text


class TestCommonToSlackTransform:
    """CommonMessage → Slack 변환 테스트"""

    async def test_text_message_send(self, slack_provider, mocker):
        """텍스트 메시지 전송"""
        # Mock Slack API
        mock_client = mocker.patch.object(slack_provider, "client")
        mock_client.chat_postMessage.return_value = {
            "ok": True,
            "ts": "1234567890.123456"
        }

        await slack_provider.connect()

        common = CommonMessage(
            message_id="msg-123",
            timestamp=datetime.now(),
            type=MessageType.TEXT,
            platform=Platform.TEAMS,  # Teams에서 온 메시지
            text="Hello from Teams!",
            user=User(user_id="U123", username="teams_user"),
            channel=Channel(channel_id="C12345678"),
            raw_message={}
        )

        result = await slack_provider.send_message(common)

        assert result is True
        mock_client.chat_postMessage.assert_called_once()

        # 호출 인자 검증
        call_args = mock_client.chat_postMessage.call_args[1]
        assert call_args["channel"] == "C12345678"
        assert call_args["text"] == "Hello from Teams!"
```

### 3. 양방향 변환 무결성 검증

```python
# apps/v-channel-bridge/backend/tests/integration/test_schema_integrity.py

import pytest
from datetime import datetime
from app.adapters.slack_provider import SlackProvider
from app.adapters.teams_provider import TeamsProvider
from app.schemas.common_message import CommonMessage, MessageType, Platform, User, Channel


@pytest.mark.asyncio
async def test_slack_roundtrip():
    """Slack → Common → Slack 양방향 변환"""
    slack_provider = SlackProvider(
        app_token="test-token",
        bot_token="test-bot-token"
    )

    # 원본 Slack 메시지
    original_slack = {
        "type": "message",
        "channel": "C12345678",
        "user": "U12345678",
        "text": "Test message",
        "ts": "1234567890.123456"
    }

    # Slack → Common
    common = slack_provider.transform_to_common(original_slack)

    # Common → Slack (내부 메서드 테스트)
    transformed_slack = slack_provider._transform_from_common(common)

    # 핵심 필드 동일성 검증
    assert transformed_slack["channel"] == original_slack["channel"]
    assert transformed_slack["text"] == original_slack["text"]


@pytest.mark.asyncio
async def test_cross_platform_transform():
    """Slack → Common → Teams 크로스 플랫폼 변환"""
    slack_provider = SlackProvider(
        app_token="test-slack-token",
        bot_token="test-bot-token"
    )
    teams_provider = TeamsProvider(
        app_id="test-teams-id",
        app_password="test-password",
        tenant_id="test-tenant"
    )

    # Slack 메시지
    slack_message = {
        "type": "message",
        "channel": "C12345678",
        "user": "U12345678",
        "text": "Hello from Slack!",
        "ts": "1234567890.123456"
    }

    # Slack → Common
    common = slack_provider.transform_to_common(slack_message)

    # Common → Teams
    teams_message = teams_provider._transform_from_common(common)

    # 핵심 데이터 보존 확인
    assert teams_message["body"]["content"] == "Hello from Slack!"
    assert "channel" in teams_message or "chatId" in teams_message
```

## 자동 검증 스크립트

```bash
#!/bin/bash
# backend/scripts/validate_schema.sh

echo "=== CommonMessage 스키마 검증 시작 ==="

# 1. 스키마 정의 테스트
echo "1. Pydantic 모델 검증..."
pytest apps/v-channel-bridge/backend/tests/schemas/test_common_message.py -v

# 2. Provider 변환 테스트
echo "2. Slack Provider 변환 검증..."
pytest apps/v-channel-bridge/backend/tests/providers/test_slack_provider_schema.py -v

echo "3. Teams Provider 변환 검증..."
pytest apps/v-channel-bridge/backend/tests/providers/test_teams_provider_schema.py -v

# 3. 양방향 변환 무결성 테스트
echo "4. 양방향 변환 무결성 검증..."
pytest apps/v-channel-bridge/backend/tests/integration/test_schema_integrity.py -v

echo ""
echo "=== 검증 완료 ==="
```

## 검증 실패 시 해결 방법

### 문제 1: 필수 필드 누락

**증상:**
```
ValidationError: 1 validation error for CommonMessage
message_id
  field required (type=value_error.missing)
```

**해결:**
```python
# Provider의 transform_to_common() 메서드 확인
def transform_to_common(self, raw_message: Dict[str, Any]) -> CommonMessage:
    return CommonMessage(
        message_id=raw_message.get("id") or raw_message.get("ts"),  # ✓ Fallback 추가
        # ...
    )
```

### 문제 2: 타입 불일치

**증상:**
```
ValidationError: timestamp
  invalid datetime format (type=value_error.datetime)
```

**해결:**
```python
from datetime import datetime

def transform_to_common(self, raw_message: Dict[str, Any]) -> CommonMessage:
    # 문자열 timestamp를 datetime으로 변환
    timestamp_str = raw_message.get("timestamp")
    timestamp = datetime.fromisoformat(timestamp_str) if timestamp_str else datetime.now()

    return CommonMessage(
        timestamp=timestamp,  # ✓ 올바른 타입
        # ...
    )
```

### 문제 3: 양방향 변환 데이터 손실

**증상:**
```
AssertionError: assert 'Hello <@U123>' == 'Hello @U123'
```

**해결:**
```python
# 멘션 형식 정규화
def _normalize_mention(self, text: str, platform: Platform) -> str:
    if platform == Platform.SLACK:
        # Slack 형식: <@U123>
        return re.sub(r'<@([A-Z0-9]+)>', r'@\1', text)
    elif platform == Platform.TEAMS:
        # Teams 형식: <at>@user</at>
        return re.sub(r'<at>@(\w+)</at>', r'@\1', text)
```

## 검증 통과 기준

- [ ] 모든 필수 필드 테스트 통과
- [ ] 선택 필드 테스트 통과
- [ ] Platform → Common 변환 테스트 통과 (100%)
- [ ] Common → Platform 변환 테스트 통과 (100%)
- [ ] 양방향 변환 무결성 테스트 통과
- [ ] 크로스 플랫폼 변환 테스트 통과

## 관련 스킬
- `scaffold-provider` - Provider 생성 후 이 스킬로 검증
- `test-socket-mode` - Slack Provider 실제 연결 테스트

## 사용 예시

```bash
# /test-provider 명령어에서 자동 호출
/test-provider slack
→ validate-common-schema skill 호출
→ Slack Provider의 CommonMessage 변환 검증
```
