---
title: v-channel-bridge 개발 가이드
sidebar_position: 1
---

# v-channel-bridge 개발 가이드

v-channel-bridge 코드베이스의 구조를 이해하고, 로컬 개발 환경에서 코드를 수정/테스트하며, 새로운 Provider를 추가하는 방법을 안내합니다.

---

## 로컬 개발 환경 시작

모든 개발은 Docker 환경에서 수행합니다. 로컬 Node.js/Python 직접 실행은 버전 불일치 문제로 권장하지 않습니다.

### 전체 서비스 시작

```bash
# 프로젝트 루트에서 실행
docker compose up -d --build
```

이 명령은 다음 서비스를 시작합니다.
- v-channel-bridge Backend (포트 8000)
- v-channel-bridge Frontend (포트 5173)
- PostgreSQL (포트 5432)
- Redis (포트 6379)
- MailHog (포트 8025)

### 특정 서비스만 재빌드

코드 수정 후 특정 서비스만 재시작하려면 다음 명령을 사용합니다.

```bash
# 백엔드만 재빌드
docker compose up -d --build v-channel-bridge-backend

# 프론트엔드만 재빌드
docker compose up -d --build v-channel-bridge-frontend
```

### Hot Reload

- **백엔드**: Uvicorn이 `--reload` 옵션으로 실행됩니다. `apps/v-channel-bridge/backend/app/` 내부 파일 변경 시 자동 재시작됩니다.
- **프론트엔드**: Vite Dev Server가 HMR(Hot Module Replacement)을 지원합니다. `apps/v-channel-bridge/frontend/src/` 내부 파일 변경 시 브라우저가 자동 갱신됩니다.

### 디버그 모드

debugpy를 사용한 원격 디버깅이 가능합니다. docker-compose.yml에서 debug 프로필을 활성화하면 포트 5678로 디버거를 연결할 수 있습니다.

---

## 프로젝트 구조

```
apps/v-channel-bridge/
├── backend/
│   ├── app/
│   │   ├── main.py                    # 앱 진입점 (PlatformApp + lifespan)
│   │   ├── adapters/                  # Provider 구현
│   │   │   ├── base.py                # BasePlatformProvider (추상 인터페이스)
│   │   │   ├── slack_provider.py      # Slack Socket Mode Provider
│   │   │   └── teams_provider.py      # Teams Graph API Provider
│   │   ├── api/                       # FastAPI 라우터
│   │   │   ├── bridge.py              # 브리지 상태/라우트 API
│   │   │   ├── messages.py            # 메시지 조회/삭제 API
│   │   │   ├── accounts_crud.py       # 계정 CRUD API
│   │   │   ├── accounts_test.py       # 계정 연결 테스트 API
│   │   │   ├── teams_webhook.py       # Teams Bot Framework Webhook
│   │   │   ├── teams_notifications.py # Teams Graph API Change Notifications
│   │   │   └── monitoring.py          # 모니터링 API
│   │   ├── services/                  # 비즈니스 로직
│   │   │   ├── websocket_bridge.py    # 메시지 브리지 엔진
│   │   │   ├── route_manager.py       # Redis 기반 라우팅 관리
│   │   │   ├── message_queue.py       # 메시지 배치 저장 큐
│   │   │   ├── command_processor.py   # 커맨드 처리기
│   │   │   ├── provider_sync.py       # 계정 변경 시 Provider 자동 동기화
│   │   │   └── teams_subscription_manager.py  # Teams Graph 구독 관리
│   │   ├── schemas/                   # Pydantic 스키마
│   │   │   ├── common_message.py      # CommonMessage (통합 메시지 스키마)
│   │   │   ├── account.py             # Account 스키마
│   │   │   └── account_crud.py        # Account CRUD 스키마
│   │   ├── models/                    # SQLAlchemy 모델
│   │   │   ├── account.py             # Account (계정 + 암호화 필드)
│   │   │   └── message.py             # Message (메시지 이력)
│   │   └── utils/                     # 유틸리티
│   │       ├── attachment_handler.py   # 첨부 파일 다운로드/업로드
│   │       ├── message_formatter.py    # Slack ↔ Teams Markdown 변환
│   │       └── emoji_mapper.py         # Teams ↔ Slack 이모지 매핑
│   └── tests/                         # pytest 테스트
├── frontend/
│   └── src/
│       ├── pages/                     # 앱 전용 페이지
│       ├── components/                # 앱 전용 컴포넌트
│       ├── lib/api/                   # API 클라이언트 함수
│       ├── store/                     # Zustand 스토어
│       └── hooks/                     # 커스텀 훅
```

---

## 핵심 흐름 이해

메시지가 브리지되는 전체 흐름은 다음과 같습니다.

1. **Provider가 메시지 수신**: `SlackProvider.receive_messages()` 또는 `TeamsProvider.handle_activity()`
2. **CommonMessage로 변환**: `provider.transform_to_common(raw_event)` -- 플랫폼별 원본 메시지를 통합 스키마로 정규화
3. **WebSocketBridge가 라우팅**: `_route_message()` 에서 `RouteManager.get_targets()`로 타겟 조회
4. **타겟 Provider로 전송**: `provider.send_message(common_msg)` -- CommonMessage를 타겟 플랫폼 형식으로 변환하여 발송
5. **메시지 기록**: `MessageQueue`가 DB에 배치 저장

---

## 새 Provider 추가 방법

Mattermost, 카카오워크 등 새 플랫폼을 추가하려면 다음 단계를 따릅니다.

### 1단계: BasePlatformProvider 상속

`apps/v-channel-bridge/backend/app/adapters/` 디렉토리에 새 파일을 생성합니다.

```python
# apps/v-channel-bridge/backend/app/adapters/mattermost_provider.py

from app.adapters.base import BasePlatformProvider
from app.schemas.common_message import CommonMessage, User, Channel, Platform

class MattermostProvider(BasePlatformProvider):
    def __init__(self, server_url: str, token: str):
        config = {"server_url": server_url, "token": token}
        super().__init__("mattermost", config)

    async def connect(self) -> bool:
        # 플랫폼에 연결하는 로직 구현
        ...

    async def disconnect(self) -> bool:
        # 연결 해제 로직
        ...

    async def send_message(self, message: CommonMessage) -> bool:
        # CommonMessage를 플랫폼 형식으로 변환하여 전송
        ...

    async def receive_messages(self):
        # 플랫폼에서 메시지를 수신하여 CommonMessage로 변환
        ...

    async def get_channels(self):
        # 채널 목록 조회
        ...

    async def get_users(self):
        # 사용자 목록 조회
        ...

    def transform_to_common(self, raw_message):
        # 원본 메시지 -> CommonMessage 변환
        ...

    def transform_from_common(self, message):
        # CommonMessage -> 플랫폼 메시지 변환
        ...
```

`BasePlatformProvider`(`apps/v-channel-bridge/backend/app/adapters/base.py`)에 정의된 모든 추상 메서드를 구현해야 합니다.

### 2단계: __init__.py에 등록

```python
# apps/v-channel-bridge/backend/app/adapters/__init__.py
from .mattermost_provider import MattermostProvider
```

### 3단계: main.py에서 초기화

`apps/v-channel-bridge/backend/app/main.py`의 `init_bridge()` 함수에서 새 Provider를 생성하고 `bridge.add_provider()`로 등록합니다. `Account` 모델에 새 플랫폼을 지원하도록 확장이 필요할 수 있습니다.

### 4단계: WebSocketBridge와의 관계

`WebSocketBridge`(`apps/v-channel-bridge/backend/app/services/websocket_bridge.py`)는 등록된 모든 Provider의 `receive_messages()`를 비동기 태스크로 실행합니다. 수신된 메시지는 `RouteManager`의 라우팅 룰에 따라 타겟 Provider의 `send_message()`로 전달됩니다. 새 Provider를 추가하면 자동으로 이 흐름에 포함됩니다.

---

## 새 API 라우터 등록

1. `apps/v-channel-bridge/backend/app/api/` 디렉토리에 라우터 파일을 생성합니다.

```python
# apps/v-channel-bridge/backend/app/api/my_feature.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/my-feature", tags=["my-feature"])

@router.get("/")
async def get_my_feature():
    return {"status": "ok"}
```

2. `apps/v-channel-bridge/backend/app/main.py`에서 라우터를 등록합니다.

```python
from app.api import my_feature

platform.register_app_routers(
    # 기존 라우터들...
    my_feature.router,
)
```

`PlatformApp.register_app_routers()`는 v-platform이 제공하는 플랫폼 라우터(auth, users, permissions 등)와 앱 전용 라우터를 함께 관리합니다.

---

## 디버그 로그 활용

v-channel-bridge는 `structlog`를 사용합니다. 로그 레벨은 `LOG_LEVEL` 환경 변수로 제어합니다.

```bash
# docker-compose.yml에서 환경 변수 설정
LOG_LEVEL=DEBUG
```

주요 로거 이름:
- `app.adapters.slack_provider`: Slack 이벤트 수신/전송
- `app.adapters.teams_provider`: Teams 메시지 수신/전송
- `app.services.websocket_bridge`: 메시지 라우팅
- `app.services.route_manager`: 라우트 추가/제거/조회

`slack_bolt`, `slack_sdk`, `aiohttp`, `asyncio` 로거는 기본적으로 WARNING 레벨로 억제됩니다(`apps/v-channel-bridge/backend/app/main.py`).

---

## 코드 품질 검사

### Python (Backend)

```bash
cd apps/v-channel-bridge/backend && python -m ruff check --fix . && python -m ruff format .
```

### TypeScript (Frontend)

```bash
cd apps/v-channel-bridge/frontend && npm run lint:fix && npm run format
```

---

## 관련 문서

- [테스트 가이드](./TESTING_GUIDE.md)
- [양방향 브리지 설계](../design/CHAT_SUPPORT.md)

---

**최종 업데이트**: 2026-04-13
