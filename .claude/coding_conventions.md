# v-project 코딩 컨벤션

이 문서는 v-project(v-platform + v-channel-bridge)의 코딩 표준을 정의합니다.

**참고**: Provider Pattern 및 Common Schema 관련 규칙을 반드시 준수하세요.

## Python 백엔드 (FastAPI)

### 타입 힌트

- Python 3.9+ 빌트인 제네릭 타입 사용: `list[str]`, `dict[str, Any]`
- `typing.Dict`, `typing.List` 등 레거시 타입 **사용 금지**
- `Optional[X]`와 `Union[X, Y]`는 `typing` 모듈에서 임포트하여 사용 (3.10+ `X | Y` 문법은 사용하지 않음)
- 모든 함수에 파라미터 및 반환 타입 어노테이션 필수

```python
# ✅ 올바른 사용
from typing import Any, Optional

def get_channels() -> list[dict[str, Any]]:
    return []

def find_channel(channel_id: str) -> Optional[dict[str, Any]]:
    return None

# ❌ 잘못된 사용
from typing import Dict, List
def get_channels() -> List[Dict[str, Any]]:  # 사용 금지
    return []
```

### 데이터 구조

- **API 요청/응답 스키마**: `app/schemas/` 폴더에 Pydantic BaseModel 정의
- **DB 모델**: `app/models/` 폴더에 SQLAlchemy 모델 정의
- **내부 데이터 구조**: dataclass 사용
- 딕셔너리 직접 사용 최소화

```python
# app/schemas/user.py — API 스키마
from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

# app/models/user.py — DB 모델
from sqlalchemy import Column, Integer, String
from app.db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
```

### 임포트 구성

- 최상위 레벨 임포트 우선
- 표준 라이브러리 → 서드파티 → 로컬 모듈 순서
- `TYPE_CHECKING`, 순환 참조 해결, 지연 로딩이 필요한 경우에만 함수 내부 임포트

```python
# ✅ 올바른 임포트 순서
import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.channel_service import ChannelService
from app.db import get_db
```

### 예외 처리

- 예외를 제어 흐름으로 사용하지 않음
- 조건을 먼저 확인하고 예외는 진정한 오류 상황에서만 사용
- 적절한 예외 타입과 HTTP 상태 코드 사용

### 인증 패턴

- JWT 토큰 기반 인증 (`python-jose`)
- 비밀번호 해싱: `bcrypt`
- 인증이 필요한 엔드포인트: `Depends(get_current_user)` 사용
- 역할 기반 접근 제어: `admin`, `user`

```python
# ✅ 인증이 필요한 엔드포인트
@router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"user": current_user.username}
```

### 서비스 아키텍처

- 싱글톤 패턴 사용 금지
- FastAPI의 Dependency Injection 활용
- 비즈니스 로직은 `app/services/` 레이어에 분리
- API 엔드포인트는 `app/api/`에, 스키마는 `app/schemas/`에

## TypeScript 프론트엔드 (React)

### 타입 정의

- 모든 컴포넌트 props에 `interface` 정의 필수
- API 응답에 대한 명시적 타입 정의
- `any` 타입 사용 최소화
- 유니온 타입 적극 활용

```typescript
interface ChannelMapping {
  id: string;
  slackChannel: string;
  teamsChannel: string;
  enabled: boolean;
}

type MessageStatus = 'pending' | 'sent' | 'failed';
type ApiResponse<T> = { data: T; error?: string };
```

### 컴포넌트 패턴

- 함수형 컴포넌트만 사용
- Props 타입은 컴포넌트 바로 위에 정의
- 로직 분리를 위해 커스텀 훅 활용

### 상태 관리

- 서버 상태: TanStack Query (`@tanstack/react-query`)
- 클라이언트 상태: Zustand (`store/bridge.ts`, `store/config.ts`, `store/auth.ts`)
- 로컬 상태: useState/useReducer
- 테마 상태: `useTheme` 훅 (ThemeContext)
- 불필요한 전역 상태 최소화

### 스타일링 — 디자인 시스템 토큰

**반드시 시맨틱 토큰을 사용합니다. 하드코딩 색상은 금지입니다.**

```tsx
// ✅ 시맨틱 토큰 사용
<div className="bg-surface-card text-content-primary border-line">
<button className="bg-brand-600 text-content-inverse">
<p className="text-content-secondary">

// ❌ 하드코딩 색상 금지
<div className="bg-white text-gray-900 border-gray-200">
<button className="bg-blue-600 text-white">
<p className="text-gray-500">
```

**토큰 카테고리**:
- `surface-*`: 배경 (page, card, raised)
- `content-*`: 텍스트 (primary, secondary, tertiary, inverse)
- `line-*`: 보더 (DEFAULT, light, heavy)
- `brand-*`: 브랜드 액센트 (50~900)
- `status-*`: 상태 (success, danger, warning, info + light/border 변형)

**유틸리티 클래스**:
- `page-container`: 페이지 콘텐츠 래퍼
- `card-base`: 카드 기본 스타일
- `focus-ring`: 포커스 표시
- `text-truncate`: 말줄임

**타이포그래피 토큰**:
- `text-heading-xl/lg/md/sm`: 제목
- `text-body-base/sm`: 본문
- `text-caption`: 캡션

자세한 규칙은 `docs/DESIGN_SYSTEM.md` 참조

### 페이지 구조 패턴

모든 페이지는 이 패턴을 따릅니다:

```tsx
import { ContentHeader } from "../components/Layout";

const MyPage = () => (
  <>
    <ContentHeader title="페이지 제목" description="설명" actions={...} />
    <div className="page-container space-y-section-gap">
      {/* 콘텐츠 */}
    </div>
  </>
);
```

**금지 사항**:
- 페이지에 `min-h-screen` 사용 금지 (Layout이 관리)
- 페이지에 자체 `<header>`, `<footer>` 금지 (Layout이 관리)

## 공통 규칙

### 파일 명명

- Python: `snake_case.py`
- TypeScript 컴포넌트: `PascalCase.tsx`
- TypeScript 유틸리티/훅: `camelCase.ts`
- 테스트: `*.test.ts(x)` 또는 `test_*.py`

### 라인 길이

- Python: 100자 제한 (Ruff 설정)
- TypeScript: Prettier 기본 설정 (80자)

### 문서화

- 공개 API 함수에 docstring/JSDoc 필수
- 복잡한 비즈니스 로직에 인라인 주석
- 자명한 코드에는 불필요한 주석 금지

### UI 텍스트 규칙

- 버튼/라벨 (1~2단어): 영어 유지 (`Start`, `Stop`, `Edit`, `Delete`, `Search`)
- 설명 문장, 에러 메시지, 도움말: 한국어
- 상태 표시: 영어 대문자 (`RUNNING`, `STOPPED`, `OFFLINE`)

---

## v-channel-bridge 아키텍처 규칙

### Provider Pattern (메시징 플랫폼 어댑터)

모든 메시징 플랫폼 (Slack, Teams 등)은 `BasePlatformProvider` 인터페이스를 구현해야 합니다.

#### Provider 구현 규칙

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

#### ✅ Provider 구현 체크리스트

- [ ] `BasePlatformProvider` 상속
- [ ] 모든 추상 메서드 구현 (`connect`, `disconnect`, `send_message` 등)
- [ ] 비동기 메서드에 `async def` 사용
- [ ] `transform_to_common`, `transform_from_common` 구현 필수
- [ ] 에러 처리: Provider 내부 에러는 독립적으로 처리, 상위로 전파하지 않음
- [ ] 로깅: `structlog` 사용
- [ ] 타입 힌트: 모든 메서드에 타입 어노테이션

#### 예시: Slack Provider

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

### Common Message Schema

모든 메시지는 내부적으로 `CommonMessage` 스키마로 변환합니다.

#### Common Schema 규칙

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

#### ✅ Common Schema 사용 규칙

- [ ] 플랫폼별 메시지는 반드시 `CommonMessage`로 변환
- [ ] `raw_message` 필드에 원본 메시지 보존 (디버깅/로깅용)
- [ ] 필수 필드 누락 시 기본값 설정 또는 예외 발생
- [ ] `Optional` 필드는 명시적으로 `None` 허용
- [ ] Pydantic validation 활용 (자동 타입 검증)

### Command Processor (커맨드 처리)

사용자가 `/vms status`, `/bridge list` 같은 커맨드를 입력하면 처리합니다.

#### Command Processor 규칙

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

#### ✅ Command Processor 체크리스트

- [ ] 커맨드 핸들러는 `async def` 함수
- [ ] 모든 핸들러는 `CommonMessage` 반환
- [ ] 에러 메시지도 `CommonMessage`로 반환
- [ ] 인증/권한 체크 (필요시)
- [ ] 로깅: 커맨드 실행 로그 기록

### Dynamic Routing (동적 라우팅)

Redis를 사용하여 재시작 없이 라우팅 룰을 변경합니다.

#### Dynamic Routing 규칙

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

#### ✅ Dynamic Routing 체크리스트

- [ ] Redis를 통한 라우팅 룰 저장
- [ ] 실시간 룰 변경 지원 (재시작 불필요)
- [ ] 다대다 라우팅 지원 (1개 소스 → N개 타겟)
- [ ] 라우팅 룰 검증 (순환 참조 방지)
- [ ] 에러 처리: Redis 연결 실패 시 fallback

### 비동기 프로그래밍 (Async/Await)

Provider의 모든 I/O 작업은 비동기로 처리합니다.

#### ✅ 비동기 규칙

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

### 에러 처리 및 로깅

#### Provider 에러 격리

각 Provider의 에러는 독립적으로 처리합니다.

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

#### Structlog 사용

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

### 테스트 규칙

#### Provider 단위 테스트

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

#### ✅ 테스트 체크리스트

- [ ] Provider별 단위 테스트 작성
- [ ] 메시지 변환 로직 테스트
- [ ] 에러 처리 테스트
- [ ] 통합 테스트: Slack → Teams E2E
- [ ] Mock 사용: 외부 API 호출 Mock 처리
