---
sidebar_position: 8
title: '"Light-Zowe" 아키텍처 마이그레이션 계획'
description: 외부 브리지를 Zowe Chat 영감의 자체 v-channel-bridge로 전환 (4주 완성)
---

# "Light-Zowe" 아키텍처 마이그레이션 계획

## 📋 개요

**핵심 철학**: Zowe Chat의 **"메시지를 표준화된 규격(Common Schema)으로 변환하여 중간에서 중계한다"**는 개념을 Docker + FastAPI로 구현합니다.

**작성일**: 2026-03-30
**프로젝트**: VMS Chat Ops
**목표**: 외부 브리지 의존성 제거 → 자체 v-channel-bridge 구현
**일정**: 4주 완성

---

## 🎯 왜 "Light-Zowe"인가?

### Zowe Chat에서 배울 점

| Zowe Chat 개념 | VMS Chat Ops 적용 |
|----------------|-------------------|
| **Common Message Schema** | 플랫폼별 메시지를 `VMS-Message-Schema`로 통일 |
| **Provider Pattern** | Slack/Teams 어댑터를 인터페이스로 분리 |
| **Command Processor** | `/vms status` 같은 커맨드 해석 및 실행 |
| **z/OS 메인프레임 통합** | (해당 없음, 범용 메시징에 집중) |

### 현재 시스템의 문제점

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 외부 브리지 블랙박스 | Go 바이너리, 커스터마이징 어려움 | FastAPI로 자체 구현 (v-channel-bridge) |
| 설정 변경 시 재시작 필요 | TOML 기반 정적 설정 | Redis 기반 동적 라우팅 |
| 메시지 변환 제한 | 외부 브리지 내장 로직 | Common Schema로 완전 제어 |
| 확장성 부족 | 플랫폼 추가 시 제약 | Provider Pattern으로 플러그인화 |

---

## 🏗️ "Light-Zowe" 시스템 아키텍처

### 1. 전체 구조 (Docker Compose 기반)

```
┌─────────────────────────────────────────────────────┐
│              VMS Chat Ops Platform                  │
│                                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │          Core Engine (FastAPI)                │ │
│  │  ┌────────────────────────────────────────┐  │ │
│  │  │     Message Broker (WebSocket)         │  │ │
│  │  │  - Common Schema Transformer           │  │ │
│  │  │  - Route Manager (Redis)               │  │ │
│  │  │  - Command Processor                   │  │ │
│  │  └────────────────────────────────────────┘  │ │
│  │                                               │ │
│  │  ┌──────────────┐  ┌──────────────┐         │ │
│  │  │   Provider   │  │   Provider   │         │ │
│  │  │    Layer     │  │    Layer     │   ...   │ │
│  │  │              │  │              │         │ │
│  │  │  ┌────────┐  │  │  ┌────────┐  │         │ │
│  │  │  │ Slack  │  │  │  │ Teams  │  │         │ │
│  │  │  │Adapter │  │  │  │Adapter │  │         │ │
│  │  │  └────────┘  │  │  └────────┘  │         │ │
│  │  └──────────────┘  └──────────────┘         │ │
│  └───────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ PostgreSQL │  │   Redis    │  │  Frontend  │   │
│  │   (State)  │  │  (Cache)   │  │   (React)  │   │
│  └────────────┘  └────────────┘  └────────────┘   │
└─────────────────────────────────────────────────────┘
           ↓                ↓
      Slack API        MS Graph API
```

### 2. 핵심 컴포넌트

#### A. Common Message Schema (`VMS-Message-Schema`)

```python
# backend/app/schemas/common_message.py
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class MessageType(str, Enum):
    """메시지 타입"""
    TEXT = "text"
    FILE = "file"
    IMAGE = "image"
    REACTION = "reaction"
    COMMAND = "command"
    SYSTEM = "system"

class Platform(str, Enum):
    """지원 플랫폼"""
    SLACK = "slack"
    TEAMS = "teams"
    VMS = "vms"  # 향후 확장

class Attachment(BaseModel):
    """첨부파일 표준 스키마"""
    id: str
    name: str
    mime_type: str
    size: int
    url: str

class User(BaseModel):
    """사용자 표준 스키마"""
    id: str
    username: str
    display_name: str
    platform: Platform
    avatar_url: Optional[str] = None

class Channel(BaseModel):
    """채널 표준 스키마"""
    id: str
    name: str
    platform: Platform

class CommonMessage(BaseModel):
    """통합 메시지 스키마 (Zowe Chat Common Schema 개념)"""
    # 메시지 메타데이터
    message_id: str
    timestamp: datetime
    type: MessageType
    platform: Platform

    # 발신자/채널 정보
    user: User
    channel: Channel

    # 메시지 내용
    text: Optional[str] = None
    attachments: List[Attachment] = []
    reactions: List[str] = []

    # 스레드/답글
    thread_id: Optional[str] = None
    parent_id: Optional[str] = None

    # 원본 메시지 (디버깅/로깅용)
    raw_message: Dict[str, Any] = {}

    # 라우팅 정보
    target_channels: List[Channel] = []

    # 커맨드 정보 (Command Processor용)
    command: Optional[str] = None
    command_args: List[str] = []
```

#### B. Provider Pattern (어댑터 인터페이스)

```python
# backend/app/adapters/base.py
from abc import ABC, abstractmethod
from typing import AsyncIterator
from app.schemas.common_message import CommonMessage

class BasePlatformProvider(ABC):
    """
    플랫폼 제공자 인터페이스 (Zowe Chat Provider Pattern)

    새로운 플랫폼을 추가할 때 이 인터페이스를 구현하면 됩니다.
    예: Slack, Teams, Mattermost, 카카오워크, VMS 등
    """

    @abstractmethod
    async def connect(self) -> bool:
        """플랫폼에 연결"""
        pass

    @abstractmethod
    async def disconnect(self) -> bool:
        """플랫폼 연결 해제"""
        pass

    @abstractmethod
    async def send_message(self, message: CommonMessage) -> bool:
        """Common Schema 메시지를 플랫폼 형식으로 변환하여 전송"""
        pass

    @abstractmethod
    async def receive_messages(self) -> AsyncIterator[CommonMessage]:
        """플랫폼 메시지를 Common Schema로 변환하여 수신"""
        pass

    @abstractmethod
    async def get_channels(self) -> list:
        """플랫폼의 채널 목록 조회"""
        pass

    @abstractmethod
    async def get_users(self) -> list:
        """플랫폼의 사용자 목록 조회"""
        pass

    @abstractmethod
    def transform_to_common(self, raw_message: dict) -> CommonMessage:
        """플랫폼 메시지 → Common Schema 변환"""
        pass

    @abstractmethod
    def transform_from_common(self, message: CommonMessage) -> dict:
        """Common Schema → 플랫폼 메시지 변환"""
        pass
```

#### C. Command Processor

```python
# backend/app/services/command_processor.py
from typing import Optional, List
from app.schemas.common_message import CommonMessage, MessageType

class CommandProcessor:
    """
    Zowe Chat의 Command Processor 개념 구현

    예: /vms status → VMS 서버 상태 조회
         /bridge list → 활성 브리지 목록
         /help → 도움말
    """

    def __init__(self):
        self.commands = {
            "/vms": self._handle_vms_command,
            "/bridge": self._handle_bridge_command,
            "/help": self._handle_help_command,
            "/status": self._handle_status_command,
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
            return self._create_error_response(
                message,
                f"알 수 없는 커맨드: {command}"
            )

        return await handler(message, args)

    async def _handle_vms_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """VMS 관련 커맨드 처리"""
        if not args:
            return self._create_response(
                message,
                "사용법: /vms <status|info|restart>"
            )

        action = args[0].lower()
        if action == "status":
            # VMS 서버 상태 조회 로직
            return self._create_response(
                message,
                "VMS 서버 상태: ✅ 정상 작동 중"
            )
        elif action == "info":
            return self._create_response(
                message,
                "VMS Chat Ops v1.1.0\n"
                "- Slack ↔ Teams 브리지 활성\n"
                "- 처리된 메시지: 1,234개\n"
                "- 가동 시간: 3일 5시간"
            )
        # ... 더 많은 액션

    async def _handle_bridge_command(
        self, message: CommonMessage, args: List[str]
    ) -> CommonMessage:
        """브리지 관련 커맨드 처리"""
        # 브리지 목록, 추가, 제거 등
        pass

    def _create_response(
        self, original: CommonMessage, text: str
    ) -> CommonMessage:
        """응답 메시지 생성"""
        return CommonMessage(
            message_id=f"cmd-{original.message_id}",
            timestamp=datetime.now(),
            type=MessageType.SYSTEM,
            platform=original.platform,
            user=original.user,
            channel=original.channel,
            text=text,
            thread_id=original.thread_id,
            parent_id=original.message_id,
        )
```

---

## 📅 4주 마이그레이션 로드맵

### Week 1: 기반 설계 및 Core 구축

#### Day 1-2: Common Schema 정의
- [ ] `CommonMessage` 스키마 설계 및 구현
- [ ] `User`, `Channel`, `Attachment` 모델 정의
- [ ] Provider 인터페이스 정의
- [ ] 테스트 케이스 작성

```python
# tests/schemas/test_common_message.py
def test_slack_to_common_transformation():
    """Slack 메시지 → Common Schema 변환 테스트"""
    slack_msg = {
        "type": "message",
        "user": "U123456",
        "text": "Hello World",
        "channel": "C789012",
        "ts": "1234567890.123456"
    }
    common_msg = slack_provider.transform_to_common(slack_msg)
    assert common_msg.platform == Platform.SLACK
    assert common_msg.text == "Hello World"
```

#### Day 3-4: FastAPI Core Engine
- [ ] Docker 기반 FastAPI 스켈레톤 생성
- [ ] 비동기 WebSocket 매니저 구현
- [ ] Redis 연결 설정 (라우팅 룰 저장)
- [ ] PostgreSQL 모델 업데이트 (Provider 설정 저장)

```python
# backend/app/core/websocket_manager.py
class WebSocketManager:
    """비동기 메시지 라우팅"""

    def __init__(self):
        self.providers: Dict[str, BasePlatformProvider] = {}
        self.route_rules = RouteManager()

    async def route_message(self, message: CommonMessage):
        """Common Schema 메시지를 라우팅 룰에 따라 전송"""
        targets = await self.route_rules.get_targets(
            message.platform,
            message.channel.id
        )

        for target in targets:
            provider = self.providers[target.platform]
            await provider.send_message(message)
```

#### Day 5-7: Command Processor 구현
- [ ] 커맨드 파서 구현
- [ ] 기본 커맨드 핸들러 (`/help`, `/status`)
- [ ] VMS 커맨드 스켈레톤
- [ ] 단위 테스트

---

### Week 2: Slack Socket Mode 어댑터 구현

#### Day 8-10: Slack Provider

**자체 브리지 구현의 핵심**: `slack_sdk.bolt`를 사용하여 Socket Mode 활성화
- 방화벽 인바운드 설정 없이 실시간 수신 가능
- 웹훅보다 안정적이고 빠른 메시지 수신

```python
# backend/app/adapters/slack_provider.py
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from slack_bolt.async_app import AsyncApp
from app.adapters.base import BasePlatformProvider
from app.schemas.common_message import CommonMessage, Platform

class SlackProvider(BasePlatformProvider):
    """Slack Socket Mode 제공자"""

    def __init__(self, bot_token: str, app_token: str):
        self.app = AsyncApp(token=bot_token)
        self.socket_handler = AsyncSocketModeHandler(self.app, app_token)
        self._setup_event_handlers()

    def _setup_event_handlers(self):
        """Slack 이벤트 핸들러 설정"""
        @self.app.event("message")
        async def handle_message(event, say):
            # Slack 메시지 → Common Schema 변환
            common_msg = self.transform_to_common(event)
            # WebSocket Manager로 전달
            await websocket_manager.route_message(common_msg)

    async def connect(self) -> bool:
        """Socket Mode 연결"""
        await self.socket_handler.start_async()
        return True

    async def send_message(self, message: CommonMessage) -> bool:
        """Common Schema → Slack 메시지 전송"""
        slack_msg = self.transform_from_common(message)
        result = await self.app.client.chat_postMessage(**slack_msg)
        return result["ok"]

    def transform_to_common(self, slack_event: dict) -> CommonMessage:
        """Slack 이벤트 → Common Schema"""
        return CommonMessage(
            message_id=slack_event["ts"],
            timestamp=datetime.fromtimestamp(float(slack_event["ts"])),
            type=MessageType.TEXT,
            platform=Platform.SLACK,
            user=User(
                id=slack_event["user"],
                username=slack_event.get("username", ""),
                display_name=slack_event.get("user_profile", {}).get("real_name", ""),
                platform=Platform.SLACK,
            ),
            channel=Channel(
                id=slack_event["channel"],
                name="",  # 채널 정보는 별도 조회
                platform=Platform.SLACK,
            ),
            text=slack_event.get("text", ""),
            raw_message=slack_event,
        )

    def transform_from_common(self, message: CommonMessage) -> dict:
        """Common Schema → Slack 메시지"""
        return {
            "channel": message.channel.id,
            "text": message.text,
            "attachments": [
                {
                    "fallback": att.name,
                    "image_url": att.url if att.mime_type.startswith("image/") else None,
                }
                for att in message.attachments
            ],
            "thread_ts": message.thread_id,
        }
```

#### Day 11-14: 기존 기능 이관
- [ ] 기존 메시지 수집기 로직 이관
- [ ] 파일 업로드/다운로드 처리
- [ ] 사용자 매핑 로직
- [ ] 통합 테스트

---

### Week 3: Teams Provider 및 라우팅 엔진

#### Day 15-17: Teams Provider

```python
# backend/app/adapters/teams_provider.py
from botbuilder.core import BotFrameworkAdapter, TurnContext
from app.adapters.base import BasePlatformProvider

class TeamsProvider(BasePlatformProvider):
    """Microsoft Teams 제공자"""

    def __init__(self, app_id: str, app_password: str, tenant_id: str):
        self.adapter = BotFrameworkAdapter(
            settings={"app_id": app_id, "app_password": app_password}
        )
        self.tenant_id = tenant_id

    async def send_message(self, message: CommonMessage) -> bool:
        """Common Schema → Teams 메시지 전송"""
        teams_msg = self.transform_from_common(message)
        # MS Graph API 호출
        result = await self._send_via_graph_api(teams_msg)
        return result

    def transform_to_common(self, teams_activity: dict) -> CommonMessage:
        """Teams Activity → Common Schema"""
        return CommonMessage(
            message_id=teams_activity["id"],
            timestamp=datetime.fromisoformat(teams_activity["timestamp"]),
            type=MessageType.TEXT,
            platform=Platform.TEAMS,
            user=User(
                id=teams_activity["from"]["id"],
                username=teams_activity["from"]["name"],
                display_name=teams_activity["from"]["name"],
                platform=Platform.TEAMS,
            ),
            channel=Channel(
                id=teams_activity["channelId"],
                name="",
                platform=Platform.TEAMS,
            ),
            text=teams_activity.get("text", ""),
            raw_message=teams_activity,
        )
```

#### Day 18-19: 동적 라우팅 엔진

```python
# backend/app/services/route_manager.py
import redis.asyncio as redis
from typing import List

class RouteManager:
    """
    Redis 기반 동적 라우팅 (재시작 불필요)

    설정 변경 시 즉시 반영:
    - Slack #general → Teams General
    - Slack #dev → Teams Development
    """

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
    ) -> List[Channel]:
        """소스 채널의 타겟 채널 목록 조회"""
        key = f"route:{source_platform}:{source_channel}"
        targets = await self.redis.smembers(key)
        return [self._parse_target(t) for t in targets]

    async def remove_route(
        self,
        source_platform: str,
        source_channel: str,
        target_platform: str,
        target_channel: str,
    ):
        """라우팅 룰 제거"""
        key = f"route:{source_platform}:{source_channel}"
        value = f"{target_platform}:{target_channel}"
        await self.redis.srem(key, value)
```

#### Day 20-21: 통합 테스트
- [ ] Slack → Teams 메시지 전송 테스트
- [ ] Teams → Slack 메시지 전송 테스트
- [ ] 파일 첨부 전송 테스트
- [ ] 성능 테스트 (목표: 100 msg/s)

---

### Week 4: 배포 및 모니터링

#### Day 22-23: Docker 최적화

```dockerfile
# backend/Dockerfile (Multi-Stage Build)
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - BRIDGE_TYPE=native  # v-channel-bridge
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_APP_TOKEN=${SLACK_APP_TOKEN}  # Socket Mode
      - TEAMS_APP_ID=${TEAMS_APP_ID}
    depends_on:
      - postgres
      - redis
    # 외부 브리지 서비스 제거 완료
```

#### Day 24-25: 대시보드 연결
- [ ] Frontend API 클라이언트 업데이트
- [ ] 실시간 상태 모니터링 UI
- [ ] 라우팅 룰 관리 UI
- [ ] 메시지 히스토리 시각화

```typescript
// frontend/src/lib/api/bridge.ts
export const bridgeApi = {
  async getStatus(): Promise<BridgeStatus> {
    const res = await fetch('/api/bridge/status');
    return res.json();
  },

  async addRoute(route: RouteConfig): Promise<void> {
    await fetch('/api/bridge/routes', {
      method: 'POST',
      body: JSON.stringify(route),
    });
  },

  async sendCommand(command: string): Promise<CommandResponse> {
    const res = await fetch('/api/bridge/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    return res.json();
  },
};
```

#### Day 26-28: 프로덕션 준비
- [ ] 로깅 및 모니터링 (Structlog)
- [ ] 에러 핸들링 강화
- [ ] Rate Limiting
- [ ] 보안 점검 (JWT, HTTPS)
- [ ] 문서 업데이트 (README, API Docs)
- [ ] 배포 및 검증

---

## 🎨 외부 브리지 의존성 제거 체크리스트 (완료)

### 코드 변경 (완료)

- [x] **Backend Services** — v-channel-bridge로 전환 완료
  ```
  이전 서비스들 → WebSocketBridge, Provider Pattern으로 대체
  이전 ConfigManager (TOML) → Redis Route Manager로 대체
  ```

- [x] **API Endpoints** — `/api/bridge/*` 엔드포인트 사용 중
  ```
  POST /api/bridge/start
  GET /api/bridge/status
  ```

- [ ] **Data Models**
  ```sql
  ALTER TABLE gateways RENAME TO bridges;
  ALTER TABLE gateway_channels RENAME TO bridge_routes;

  -- Provider 설정 테이블 추가
  CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active'
  );
  ```

- [x] **Frontend** — bridge 기반으로 전환 완료
  ```typescript
  src/store/bridge.ts
  src/lib/api/bridge.ts
  // UI 텍스트: "브리지" 사용 중
  ```

- [x] **Docker Compose** — 외부 브리지 서비스 제거 완료, backend 서비스만 유지

### 문서 업데이트 (완료)

- [x] **README.md** — v-channel-bridge 아키텍처 설명 + Provider 추가 방법
- [x] **ARCHITECTURE.md** — Common Schema, Provider Pattern, Command Processor 문서화
- [x] **API.md** — `/api/bridge/*` 엔드포인트 + WebSocket API 문서화

---

## 🚀 배포 전략

### Phase 1: 개발 환경 (Day 1-21)
```bash
git checkout -b feature/light-zowe
docker-compose -f docker-compose.dev.yml up --build
```

### Phase 2: 스테이징 환경 (Day 22-25)
```bash
git checkout staging
docker-compose -f docker-compose.staging.yml up -d
# 스테이징 환경 검증
```

### Phase 3: 카나리 배포 (Day 26-27)
```bash
# 10% 트래픽을 새 브리지로 라우팅
# 모니터링 및 성능 비교
```

### Phase 4: 전체 전환 (Day 28) -- 완료
```bash
# v-channel-bridge로 완전 전환 완료
git checkout main
docker-compose up -d
```

---

## 📊 성공 기준

### 기능적 요구사항
- ✅ Slack ↔ Teams 양방향 메시지 전송
- ✅ 파일 첨부 지원 (이미지, 문서)
- ✅ 사용자 매핑 정확성 100%
- ✅ 실시간 메시지 전달 (< 1초 지연)
- ✅ Command Processor 작동 (`/vms`, `/bridge` 등)

### 비기능적 요구사항
- ✅ 메시지 처리 속도: > 100 msg/s
- ✅ 시스템 가용성: > 99.9%
- ✅ 메모리 사용량: < 512MB
- ✅ CPU 사용률: < 30%

### 확장성 요구사항
- ✅ 새 플랫폼 추가: Provider 구현만으로 가능 (< 1일)
- ✅ 동적 라우팅: 재시작 없이 설정 변경
- ✅ 수평 확장: 다중 백엔드 인스턴스 지원

---

## ⚠️ 리스크 관리

| 리스크 | 완화 전략 |
|--------|-----------|
| Slack Socket Mode 불안정 | 재연결 로직, Fallback to Webhook |
| Common Schema 누락 | 철저한 단위 테스트, 버전 관리 |
| 성능 저하 | Redis 캐싱, 비동기 처리, 성능 프로파일링 |
| Provider 버그 | 각 Provider별 독립 테스트, 에러 격리 |

### 롤백 계획
```bash
# 문제 발생 시 이전 버전으로 복구
docker-compose -f docker-compose.backup.yml up -d
```

---

## 📚 Zowe Chat 벤치마킹 요약

| Zowe Chat 개념 | VMS Chat Ops 구현 |
|----------------|-------------------|
| Common Message Schema | `CommonMessage` 스키마 (Pydantic) |
| Provider Pattern | `BasePlatformProvider` 인터페이스 |
| Command Processor | `/vms`, `/bridge` 커맨드 |
| z/OSMF Integration | (해당 없음) |
| Plugin System | Provider 기반 플러그인 아키텍처 |

---

## 🎯 다음 단계

### 즉시 시작
1. **Common Schema 구현** (Day 1-2)
   ```bash
   cd backend
   touch app/schemas/common_message.py
   # CommonMessage, User, Channel 정의
   ```

2. **Provider 인터페이스 정의** (Day 2-3)
   ```bash
   mkdir app/adapters
   touch app/adapters/base.py
   # BasePlatformProvider 추상 클래스
   ```

3. **Slack Provider 프로토타입** (Day 3-5)
   ```bash
   pip install slack_bolt
   touch app/adapters/slack_provider.py
   ```

---

**문서 버전**: 2.0 (Light-Zowe 아키텍처)
**최종 업데이트**: 2026-03-30
**작성자**: VMS Chat Ops Team
**영감**: [Zowe Chat Architecture](https://docs.zowe.org/stable/getting-started/zowe-architecture/)
