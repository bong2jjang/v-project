---
title: v-channel-bridge 테스트 가이드
sidebar_position: 2
---

# v-channel-bridge 테스트 가이드

pytest 기반 백엔드 테스트와 vitest 기반 프론트엔드 테스트의 구조, 실행 방법, 주요 패턴을 안내합니다.

---

## 테스트 스택

| 영역 | 도구 | 설명 |
|------|------|------|
| Backend 단위 테스트 | pytest + pytest-asyncio | Docker 컨테이너에서 실행 |
| Frontend 컴포넌트 테스트 | vitest | Vite 네이티브 테스트 러너 |
| Mock | unittest.mock (AsyncMock) | Provider, Redis 등 외부 의존성 격리 |
| DB | SQLite in-memory | 테스트용 인메모리 데이터베이스 |

---

## Backend 테스트

### 디렉토리 구조

```
apps/v-channel-bridge/backend/tests/
├── conftest.py                            # 공통 fixture (DB, TestClient, 인증)
├── adapters/
│   ├── test_slack_provider.py             # Slack Provider 변환 테스트
│   └── test_teams_provider.py             # Teams Provider 변환 테스트
├── services/
│   ├── test_route_manager.py              # RouteManager 양방향 라우팅 테스트
│   ├── test_message_queue.py              # MessageQueue 배치 저장 테스트
│   └── test_bridge_attachment_flow.py     # 첨부 파일 전달 플로우 테스트
├── schemas/
│   └── test_common_message.py             # CommonMessage 스키마 검증
├── integration/
│   └── test_bridge_integration.py         # 브리지 전체 플로우 통합 테스트
├── utils/
│   ├── test_attachment_handler.py         # 첨부 파일 핸들러 테스트
│   └── test_encryption.py                # 암호화/복호화 테스트
├── api/
│   └── test_bridge.py                     # Bridge API 엔드포인트 테스트
├── test_api_auth.py                       # 인증 API 테스트
├── test_api_users.py                      # 사용자 API 테스트
└── test_api_audit_logs.py                 # 감사 로그 API 테스트
```

### 실행 방법

```bash
# Docker 컨테이너에서 전체 테스트 실행
docker exec v-channel-bridge-backend python -m pytest tests/ -v

# 특정 테스트 파일 실행
docker exec v-channel-bridge-backend python -m pytest tests/services/test_route_manager.py -v

# 특정 테스트 클래스 실행
docker exec v-channel-bridge-backend python -m pytest tests/adapters/test_slack_provider.py::TestSlackProviderTransformations -v

# 커버리지 포함
docker exec v-channel-bridge-backend python -m pytest tests/ -v --cov=app --cov-report=term-missing
```

### 공통 Fixture (conftest.py)

`apps/v-channel-bridge/backend/tests/conftest.py`에 정의된 주요 fixture:

- **`db_session`**: SQLite in-memory 기반 테스트용 DB 세션. 각 테스트 후 테이블을 drop합니다.
- **`client`**: FastAPI TestClient. DB 의존성을 테스트 세션으로 오버라이드합니다.

테스트 환경에서는 `TESTING=true`와 `DATABASE_URL=sqlite:///:memory:`가 자동 설정됩니다.

---

## Provider Mock 패턴

외부 플랫폼(Slack API, Teams Graph API)에 의존하는 Provider 테스트에서는 AsyncMock을 사용합니다.

### Slack Provider 변환 테스트 예시

```python
from app.adapters.slack_provider import SlackProvider
from app.schemas.common_message import Platform, MessageType

def test_transform_to_common_text_message():
    """Slack 텍스트 메시지 -> CommonMessage 변환 테스트"""
    slack_event = {
        "type": "message",
        "user": "U123456",
        "text": "Hello World",
        "channel": "C789012",
        "ts": "1234567890.123456",
    }

    provider = SlackProvider(bot_token="xoxb-test", app_token="xapp-test")
    common_msg = provider.transform_to_common(slack_event)

    assert common_msg.platform == Platform.SLACK
    assert common_msg.text == "Hello World"
    assert common_msg.user.id == "U123456"
    assert common_msg.channel.id == "C789012"
    assert common_msg.type == MessageType.TEXT
```

### Provider 연결을 Mock하는 통합 테스트 예시

```python
from unittest.mock import AsyncMock
from app.services.websocket_bridge import WebSocketBridge
from app.services.route_manager import RouteManager

async def test_slack_to_teams_flow(mock_redis):
    route_manager = RouteManager(mock_redis)
    bridge = WebSocketBridge(route_manager)

    # Provider의 connect와 send_message를 Mock
    slack_provider.connect = AsyncMock(return_value=True)
    teams_provider.connect = AsyncMock(return_value=True)
    teams_provider.send_message = AsyncMock(return_value=True)

    await bridge.add_provider(slack_provider)
    await bridge.add_provider(teams_provider)
    # ...
```

---

## RouteManager 단위 테스트 패턴

`RouteManager`는 Redis에 의존하므로, Mock Redis 클라이언트를 사용합니다.

```python
from unittest.mock import AsyncMock, MagicMock
from app.services.route_manager import RouteManager

@pytest.fixture
def mock_redis():
    redis = MagicMock()
    redis.sadd = AsyncMock(return_value=1)
    redis.hset = AsyncMock(return_value=1)
    redis.set = AsyncMock(return_value=True)
    redis.get = AsyncMock(return_value=None)
    redis.smembers = AsyncMock(return_value=set())
    redis.hgetall = AsyncMock(return_value={})
    redis.srem = AsyncMock(return_value=1)
    redis.delete = AsyncMock(return_value=1)
    redis.hdel = AsyncMock(return_value=1)
    redis.scan = AsyncMock(return_value=(0, []))
    redis.sismember = AsyncMock(return_value=0)
    return redis

@pytest.fixture
def route_manager(mock_redis):
    return RouteManager(redis_client=mock_redis)
```

이 패턴으로 다음 시나리오를 테스트합니다.

- **양방향 라우트 추가**: `add_route(is_bidirectional=True)` 호출 시 정방향과 역방향 Redis 키가 모두 생성되는지 확인
- **단방향 라우트 추가**: `add_route(is_bidirectional=False)` 호출 시 역방향 키가 생성되지 않는지 확인
- **라우트 제거**: 양방향 라우트 제거 시 역방향도 함께 삭제되는지 확인
- **bidirectional 플래그 저장**: `route:{platform}:{channel}:bidirectional` 해시에 `"1"` 또는 `"0"`이 올바르게 저장되는지 확인

---

## Frontend 테스트

### 실행 방법

```bash
cd apps/v-channel-bridge/frontend && npx vitest --run
```

### 테스트 파일 위치

프론트엔드 컴포넌트 테스트는 `__tests__` 디렉토리에 위치합니다.

```
apps/v-channel-bridge/frontend/src/
├── components/
│   └── channels/
│       └── __tests__/
│           ├── RouteList.test.tsx
│           └── RouteModal.test.tsx
└── test/
    └── setup.ts                 # vitest 설정
```

### 컴포넌트 테스트 예시

```typescript
import { render, screen } from '@testing-library/react';
import { RouteList } from '../RouteList';

describe('RouteList', () => {
  it('라우트 목록을 렌더링한다', () => {
    render(<RouteList routes={mockRoutes} />);
    expect(screen.getByText('slack')).toBeInTheDocument();
  });
});
```

---

## 통합 시나리오 검증

### 시나리오 1: Slack -> Teams 단방향

1. Mock Redis에 단방향 라우트를 등록합니다: `add_route(is_bidirectional=False)`
2. Slack 이벤트를 `transform_to_common()`으로 변환합니다.
3. `WebSocketBridge._route_message()`를 호출합니다.
4. Teams Provider의 `send_message()`가 호출되었는지 확인합니다.
5. 역방향(Teams -> Slack) 라우트가 존재하지 않는지 확인합니다.

### 시나리오 2: 양방향 (Slack ↔ Teams)

1. Mock Redis에 양방향 라우트를 등록합니다: `add_route(is_bidirectional=True)`
2. Slack -> Teams 메시지 전달을 검증합니다.
3. Teams -> Slack 역방향 전달도 검증합니다.
4. `get_all_routes()`에서 양방향 라우트가 1건으로 표시되는지 확인합니다 (frozenset 중복 제거).

### 시나리오 3: 첨부 파일 전달

1. 첨부 파일이 포함된 `CommonMessage`를 생성합니다.
2. `WebSocketBridge._send_message()`에서 소스 Provider의 `download_file()`이 호출되는지 확인합니다.
3. 타겟 Provider의 `send_message()`에 `local_path`가 채워진 Attachment가 전달되는지 확인합니다.

---

## CI 참고사항

CI 환경에서 테스트를 실행할 때는 다음 사항을 고려합니다.

- **환경 변수**: `TESTING=true`가 설정되어야 합니다. `conftest.py`에서 자동으로 설정됩니다.
- **DB**: `DATABASE_URL=sqlite:///:memory:`로 인메모리 DB를 사용합니다.
- **Redis 불필요**: RouteManager 테스트는 Mock Redis를 사용하므로 실제 Redis 인스턴스가 필요하지 않습니다.
- **Slack/Teams API 불필요**: Provider 테스트는 연결을 Mock하므로 실제 API 자격증명이 필요하지 않습니다.

---

## 관련 문서

- [개발 가이드](./DEVELOPMENT.md)
- [양방향 브리지 설계](../design/CHAT_SUPPORT.md)

---

**최종 업데이트**: 2026-04-13
