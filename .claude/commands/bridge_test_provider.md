# Provider 단위 테스트 및 검증

특정 Provider의 단위 테스트를 실행하고 CommonMessage 변환을 검증합니다.

**참고**: v-channel-bridge Provider 개발 시 지속적인 검증을 위한 명령어입니다.

## 사용법

```bash
# Slack Provider 테스트
/test-provider slack

# Teams Provider 테스트
/test-provider teams

# 모든 Provider 테스트
/test-provider all
```

## 워크플로우

### 1. 테스트 대상 확인

```bash
# Provider 구현 파일 확인
ls -la apps/v-channel-bridge/backend/app/adapters/*_provider.py

# 테스트 파일 확인
ls -la apps/v-channel-bridge/backend/tests/providers/
```

### 2. Slack Provider 테스트

```bash
# 단위 테스트 실행
cd apps/v-channel-bridge/backend && pytest tests/providers/test_slack_provider.py -v

# 테스트 항목:
# - Provider 초기화
# - Socket Mode 연결
# - 메시지 수신 → CommonMessage 변환
# - CommonMessage → Slack 메시지 전송
# - 에러 처리
```

### 3. Teams Provider 테스트

```bash
# 단위 테스트 실행
cd apps/v-channel-bridge/backend && pytest tests/providers/test_teams_provider.py -v

# 테스트 항목:
# - Provider 초기화
# - Graph API 인증
# - 메시지 수신 → CommonMessage 변환
# - CommonMessage → Teams 메시지 전송
# - 토큰 갱신
# - 에러 처리
```

### 4. CommonMessage 변환 검증

```bash
# 변환 로직 테스트
cd apps/v-channel-bridge/backend && pytest tests/schemas/test_common_message.py -v

# 테스트 항목:
# - Slack 메시지 → CommonMessage
# - Teams 메시지 → CommonMessage
# - CommonMessage → Slack 메시지
# - CommonMessage → Teams 메시지
# - 첨부파일 변환
# - 멘션 변환
# - 리액션 변환
```

### 5. 통합 테스트 (E2E)

```bash
# 전체 메시지 흐름 테스트
cd apps/v-channel-bridge/backend && pytest tests/integration/test_message_flow.py -v

# 테스트 시나리오:
# 1. Slack 메시지 발송
# 2. SlackProvider가 CommonMessage로 변환
# 3. RouteManager가 라우팅 룰 조회
# 4. TeamsProvider가 Teams 메시지로 변환
# 5. Teams에 메시지 전송
```

## 출력 형식

### Slack Provider 테스트 결과

```
## Slack Provider 테스트

### 단위 테스트
✅ test_slack_provider_init - Provider 초기화 성공
✅ test_socket_mode_connect - Socket Mode 연결 성공
✅ test_receive_message - 메시지 수신 및 CommonMessage 변환
✅ test_send_message - CommonMessage → Slack 메시지 전송
✅ test_error_handling - 에러 처리 (Token 만료)
✅ test_heartbeat - Socket Mode Heartbeat

### CommonMessage 변환 검증
✅ Slack → CommonMessage
  - 텍스트 메시지: ✓
  - 첨부파일: ✓
  - 멘션 (@user): ✓
  - 채널 정보: ✓
  - 타임스탬프: ✓

✅ CommonMessage → Slack
  - 텍스트 메시지: ✓
  - 첨부파일: ✓
  - 멘션 변환: ✓
  - 블록 구성: ✓

### 연결 테스트
✅ Socket Mode 실제 연결 (3초 이내)
✅ 샘플 메시지 송수신

### 성능
- 평균 변환 시간: 2.3ms
- 평균 전송 시간: 45ms

### 결과: 모든 테스트 통과 (12/12)
```

### 테스트 실패 예시

```
## Teams Provider 테스트

### 단위 테스트
✅ test_teams_provider_init
✅ test_graph_api_auth
❌ test_receive_message
  - 오류: KeyError: 'channelIdentity'
  - 파일: apps/v-channel-bridge/backend/app/adapters/teams_provider.py:127
  - 원인: Teams Webhook 페이로드 구조 변경
  - 조치: transform_to_common() 메서드 업데이트 필요

❌ test_send_message
  - 오류: 403 Forbidden - Insufficient permissions
  - 원인: ChannelMessage.Send 권한 부족
  - 조치: Azure Portal에서 API 권한 추가

⚠️  test_token_refresh
  - 경고: 토큰 갱신 시간 초과 (5.2초 > 5초 임계값)
  - 조치: 갱신 로직 최적화 권장

### 결과: 4/6 통과, 2 실패, 1 경고
```

## 일반적인 문제

### 테스트 환경 설정

**원인: 환경 변수 미설정**
```bash
# .env.test 파일 생성
cat > backend/.env.test <<EOF
SLACK_APP_TOKEN=xapp-test-mock-token
TEAMS_APP_ID=test-app-id
TEAMS_APP_PASSWORD=test-password
TEAMS_TENANT_ID=test-tenant-id
SECRET_KEY=test-secret-key
DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/v_project_test
REDIS_URL=redis://:redispassword@redis:6379/1
EOF

# 테스트 실행 시 환境 변수 로드
cd apps/v-channel-bridge/backend && pytest --envfile=.env.test
```

### Mock 데이터 준비

**원인: 샘플 메시지 데이터 부족**
```bash
# Mock 데이터 생성
cat > apps/v-channel-bridge/backend/tests/fixtures/slack_message.json <<EOF
{
  "type": "message",
  "channel": "C12345678",
  "user": "U12345678",
  "text": "Hello, Teams!",
  "ts": "1234567890.123456"
}
EOF

# 테스트에서 사용
# with open("tests/fixtures/slack_message.json") as f:
#     mock_message = json.load(f)
```

### 의존성 문제

**원인: 테스트 라이브러리 누락**
```bash
# 테스트 의존성 설치
cd apps/v-channel-bridge/backend && pip install pytest pytest-asyncio pytest-mock pytest-cov

# requirements.txt에 추가
cat >> backend/requirements.txt <<EOF
# Testing
pytest==7.4.0
pytest-asyncio==0.21.0
pytest-mock==3.11.0
pytest-cov==4.1.0
EOF
```

## 테스트 작성 가이드

### Slack Provider 테스트 템플릿

```python
# apps/v-channel-bridge/backend/tests/providers/test_slack_provider.py

import pytest
from app.adapters.slack_provider import SlackProvider
from app.schemas.common_message import CommonMessage, MessageType, Platform

@pytest.fixture
def slack_provider():
    """SlackProvider 인스턴스 생성"""
    return SlackProvider(
        app_token="xapp-test-token",
        bot_token="xoxb-test-token"
    )

@pytest.mark.asyncio
async def test_slack_provider_init(slack_provider):
    """Provider 초기화 테스트"""
    assert slack_provider.platform == Platform.SLACK
    assert slack_provider.app_token == "xapp-test-token"

@pytest.mark.asyncio
async def test_transform_to_common(slack_provider):
    """Slack 메시지 → CommonMessage 변환 테스트"""
    # Mock Slack 메시지
    slack_message = {
        "type": "message",
        "channel": "C12345678",
        "user": "U12345678",
        "text": "Hello, Teams!",
        "ts": "1234567890.123456"
    }

    # 변환
    common_message = slack_provider.transform_to_common(slack_message)

    # 검증
    assert isinstance(common_message, CommonMessage)
    assert common_message.platform == Platform.SLACK
    assert common_message.text == "Hello, Teams!"
    assert common_message.channel.channel_id == "C12345678"
    assert common_message.user.user_id == "U12345678"

@pytest.mark.asyncio
async def test_send_message(slack_provider, mocker):
    """CommonMessage → Slack 메시지 전송 테스트"""
    # Mock Slack API 클라이언트
    mock_client = mocker.patch.object(slack_provider, "client")
    mock_client.chat_postMessage.return_value = {
        "ok": True,
        "ts": "1234567890.123456"
    }

    # CommonMessage 생성
    common_message = CommonMessage(
        message_id="msg-123",
        timestamp=datetime.now(),
        type=MessageType.TEXT,
        platform=Platform.TEAMS,
        text="Hello from Teams!",
        # ... 기타 필드
    )

    # 전송
    result = await slack_provider.send_message(common_message)

    # 검증
    assert result is True
    mock_client.chat_postMessage.assert_called_once()
```

### Teams Provider 테스트 템플릿

```python
# apps/v-channel-bridge/backend/tests/providers/test_teams_provider.py

import pytest
from app.adapters.teams_provider import TeamsProvider
from app.schemas.common_message import CommonMessage, Platform

@pytest.fixture
def teams_provider():
    """TeamsProvider 인스턴스 생성"""
    return TeamsProvider(
        app_id="test-app-id",
        app_password="test-password",
        tenant_id="test-tenant-id"
    )

@pytest.mark.asyncio
async def test_graph_api_auth(teams_provider, mocker):
    """Graph API 인증 테스트"""
    # Mock MSAL 인증
    mock_acquire_token = mocker.patch.object(
        teams_provider.auth_app,
        "acquire_token_for_client"
    )
    mock_acquire_token.return_value = {
        "access_token": "test-access-token",
        "expires_in": 3600
    }

    # 인증
    token = await teams_provider.get_access_token()

    # 검증
    assert token == "test-access-token"
    mock_acquire_token.assert_called_once()

@pytest.mark.asyncio
async def test_transform_to_common(teams_provider):
    """Teams 메시지 → CommonMessage 변환 테스트"""
    # Mock Teams 메시지
    teams_message = {
        "id": "msg-123",
        "createdDateTime": "2024-01-01T00:00:00Z",
        "from": {
            "user": {
                "id": "user-123",
                "displayName": "John Doe"
            }
        },
        "body": {
            "content": "Hello, Slack!"
        },
        "channelIdentity": {
            "teamId": "team-123",
            "channelId": "channel-123"
        }
    }

    # 변환
    common_message = teams_provider.transform_to_common(teams_message)

    # 검증
    assert isinstance(common_message, CommonMessage)
    assert common_message.platform == Platform.TEAMS
    assert common_message.text == "Hello, Slack!"
    assert common_message.channel.channel_id == "channel-123"
```

## 커버리지 측정

```bash
# 테스트 커버리지 측정
cd apps/v-channel-bridge/backend && pytest --cov=app/adapters --cov-report=html tests/providers/

# 결과 확인
open backend/htmlcov/index.html

# 목표 커버리지: 80% 이상
```

## CI/CD 통합

```yaml
# .github/workflows/test.yml

name: Provider Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov

      - name: Run Provider tests
        run: |
          cd backend
          pytest tests/providers/ -v --cov=app/adapters

      - name: Check coverage
        run: |
          cd backend
          pytest --cov=app/adapters --cov-fail-under=80
```

## 관련 명령어

- `/provider-health` - Provider 연결 상태 확인
- `/migration_status` - 시스템 상태 확인
- `/deploy-check` - 배포 전 체크리스트
- `/enforce_standards` - 코드 표준 강제 적용

