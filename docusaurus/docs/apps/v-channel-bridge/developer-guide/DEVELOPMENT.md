---
id: development
title: VMS Channel Bridge 개발 가이드
sidebar_position: 1
tags: [guide, developer]
---

# VMS Channel Bridge 개발 가이드

이 문서는 VMS Channel Bridge 프로젝트 개발을 위한 환경 설정, 프로젝트 구조, 코딩 컨벤션, 워크플로우를 안내합니다.

---

## 개발 환경 설정

### 필수 도구

- **Docker**: 24.0+
- **Docker Compose**: 2.20+
- **Git**: 2.30+

### ⚠️ 핵심 규칙: Docker 전용 개발

**로컬에서 직접 `npm`, `pip`, `python` 등을 실행하지 마세요.** 모든 빌드와 실행은 Docker 컨테이너 내에서 수행합니다.

**이유**: 로컬 Node.js 버전(v24)과 Docker 내 Node.js 버전(v18)의 불일치, npm 충돌 등을 방지합니다.

### 개발 환경 시작

```bash
# 저장소 클론
git clone https://github.com/bong2jjang/vms-channel-bridge.git
cd vms-channel-bridge

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 실제 값 입력

# 모든 서비스 시작 (개발 모드)
docker compose up -d --build

# 로그 확인
docker compose logs -f
```

### 개별 서비스 재빌드

전체 재빌드 대신 특정 서비스만 빠르게 재빌드할 수 있습니다:

```bash
# 백엔드만 재빌드
docker compose up -d --no-deps --build backend

# 프론트엔드만 재빌드
docker compose up -d --no-deps --build frontend
```

### 서비스 접근

| 서비스 | URL | 비고 |
|--------|-----|------|
| Frontend UI | http://localhost:5173 | React 관리 화면 |
| Backend API | http://localhost:8000 | FastAPI |
| API Docs | http://localhost:8000/docs | Swagger UI |
| PostgreSQL | localhost:5432 | vmsuser / vmspassword |
| Redis | localhost:6379 | |
| Grafana | http://localhost:3000 | admin / admin |
| MailHog | http://localhost:8025 | 개발용 메일 |

---

## 프로젝트 구조

```
vms-channel-bridge/
├── backend/                        # Python 3.11 / FastAPI
│   ├── app/
│   │   ├── adapters/               # Provider Pattern
│   │   │   ├── base.py             # BasePlatformProvider 인터페이스
│   │   │   ├── slack_provider.py   # Slack Socket Mode Provider
│   │   │   └── teams_provider.py   # MS Graph API + Bot Framework Provider
│   │   ├── api/                    # API 라우터 (18개)
│   │   │   ├── auth.py             # JWT 인증
│   │   │   ├── auth_sso.py         # SSO 인증 (Microsoft Entra, OIDC)
│   │   │   ├── bridge.py           # 브리지 제어 + Route CRUD
│   │   │   ├── teams_webhook.py    # Teams Bot Framework webhook
│   │   │   ├── accounts_crud.py    # Provider 계정 CRUD
│   │   │   ├── audit_logs.py       # 감사 로그
│   │   │   ├── health.py           # 헬스체크
│   │   │   ├── menus.py            # 커스텀 메뉴 관리
│   │   │   ├── messages.py         # 메시지 조회
│   │   │   ├── metrics.py          # Prometheus 메트릭
│   │   │   ├── monitoring.py       # 모니터링
│   │   │   ├── permissions.py      # 권한 관리
│   │   │   ├── permission_groups.py # 권한 그룹
│   │   │   ├── organizations.py    # 조직 관리
│   │   │   ├── users.py            # 사용자 관리
│   │   │   ├── user_oauth.py       # 사용자 OAuth 토큰
│   │   │   └── ...
│   │   ├── models/                 # SQLAlchemy 모델
│   │   ├── schemas/
│   │   │   └── common_message.py   # CommonMessage 스키마
│   │   ├── services/
│   │   │   ├── route_manager.py    # Redis 기반 동적 라우팅
│   │   │   ├── websocket_bridge.py # 메시지 브로커
│   │   │   ├── message_queue.py    # 배치 메시지 저장
│   │   │   ├── command_processor.py
│   │   │   └── permission_service.py # RBAC 권한 검증
│   │   ├── sso/                    # SSO 인증 모듈
│   │   │   ├── base.py             # BaseSSOProvider 인터페이스
│   │   │   ├── microsoft.py        # Microsoft Entra ID
│   │   │   ├── generic_oidc.py     # Generic OIDC
│   │   │   └── registry.py         # SSO Provider 레지스트리
│   │   ├── db/                     # 데이터베이스 설정
│   │   └── main.py                 # FastAPI 앱 엔트리포인트
│   ├── tests/
│   │   ├── adapters/               # Provider 단위 테스트
│   │   └── services/               # Service 단위 테스트
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                       # React 18 / TypeScript 5 / Vite
│   ├── src/
│   │   ├── pages/                  # 18개 페이지
│   │   ├── components/
│   │   │   ├── channels/           # RouteList, RouteModal
│   │   │   ├── providers/          # ProviderCard, ProviderModal
│   │   │   ├── ui/                 # 디자인 시스템 컴포넌트
│   │   │   └── ...
│   │   ├── store/                  # Zustand (bridge.ts, routes.ts, auth.ts)
│   │   └── lib/api/                # API 클라이언트
│   ├── package.json
│   └── Dockerfile.dev
├── monitoring/                     # Prometheus / Grafana / Loki 설정
├── docusaurus/                     # 프로젝트 문서 사이트
├── docker-compose.yml              # Docker Compose 설정
├── .env.example                    # 환경 변수 템플릿
└── CLAUDE.md                       # Claude Code 프로젝트 설정
```

---

## 아키텍처 핵심 개념

### Provider Pattern

모든 플랫폼 연동은 `BasePlatformProvider` 인터페이스를 상속합니다:

```python
class BasePlatformProvider:
    async def connect(self) -> bool: ...
    async def disconnect(self) -> None: ...
    async def send_message(self, channel_id: str, message: CommonMessage) -> bool: ...
    async def get_channels(self) -> list[Channel]: ...
    def transform_to_common(self, raw_event: dict) -> CommonMessage: ...
```

현재 구현:
- **SlackProvider**: Slack Socket Mode (실시간 이벤트 수신)
- **TeamsProvider**: MS Graph API + Bot Framework (Webhook 수신)

### CommonMessage Schema

모든 플랫폼 메시지는 `CommonMessage`로 변환됩니다:

```python
class CommonMessage(BaseModel):
    id: str
    platform: str           # "slack" | "msteams"
    channel: Channel
    sender: Sender
    content: MessageContent
    timestamp: datetime
    thread_id: Optional[str]
    attachments: list[Attachment]
```

### Route Manager

Redis 기반 동적 라우팅:

```
route:{platform}:{channel_id}               → SET (대상 채널 집합)
route:{platform}:{channel_id}:names         → HASH (채널 이름)
route:{platform}:{channel_id}:modes         → HASH (전송 모드)
route:{platform}:{channel_id}:bidirectional → HASH (양방향 여부)
```

---

## 코딩 컨벤션

### Python 백엔드

#### 타입 힌트

```python
# ✅ Python 3.9+ 빌트인 제네릭 사용
def get_channels() -> list[dict[str, Any]]:
    return []

# ✅ Optional은 typing에서 임포트
from typing import Any, Optional

def get_user(user_id: str) -> Optional[User]:
    ...

# ❌ typing.Dict, typing.List 사용 금지
from typing import Dict, List  # 사용하지 말 것
```

#### Provider 구현

```python
# ✅ BasePlatformProvider 상속 필수
class NewProvider(BasePlatformProvider):
    async def connect(self) -> bool:
        ...

# ✅ 모든 플랫폼 메시지는 CommonMessage로 변환
def transform_to_common(self, raw_event: dict) -> CommonMessage:
    ...
```

#### 비동기 I/O

```python
# ✅ I/O 작업은 async/await 필수
async def send_message(channel_id: str, message: CommonMessage) -> bool:
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.status_code == 200
```

#### 로깅

```python
# ✅ structlog 사용
import structlog
logger = structlog.get_logger()

logger.info("message_sent", channel=channel_id, platform="slack")
```

#### 데이터 모델

```python
# ✅ Pydantic 모델 사용
from pydantic import BaseModel

class MessageRequest(BaseModel):
    content: str
    channel_id: str
    attachments: list[str] = []
```

### TypeScript 프론트엔드

#### 타입 정의

```typescript
// ✅ 모든 props에 interface 정의
interface ChannelListProps {
  channels: Channel[];
  onSelect: (channel: Channel) => void;
}

// ❌ any 사용 금지
const data: any = fetchData(); // 사용하지 말 것
```

#### 상태 관리

```typescript
// ✅ 서버 상태: TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['channels', platform],
  queryFn: () => fetchChannels(platform),
});

// ✅ 클라이언트 상태: Zustand
const useBridgeStore = create<BridgeState>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));
```

#### 스타일링

```typescript
// ✅ CSS 변수 시맨틱 토큰 사용
<div className="bg-surface-card text-content-primary">

// ✅ 페이지 레이아웃 패턴
<>
  <ContentHeader title="Routes" />
  <div className="page-container">
    <div className="space-y-section-gap">
      {/* 페이지 내용 */}
    </div>
  </div>
</>
```

---

## 설계 문서 작성

### 기본 원칙

**새로운 기능 개발 전에 설계 문서를 먼저 작성합니다.**

### 설계 문서 위치

- **설계 문서**: `docusaurus/docs/design/{TOPIC}_{TYPE}.md`
- **작업 이력**: `docusaurus/blog/work-history/YYYY-MM-DD-{title}.md`

### 설계 문서 필수 포함 사항

- **개요**: 무엇을, 왜 만드는가?
- **요구사항**: 기능/비기능 요구사항
- **기술 설계**: 아키텍처, 컴포넌트, 시퀀스
- **API 명세**: 엔드포인트, Request/Response
- **데이터 모델**: 스키마 변경사항
- **구현 계획**: 작업 분해
- **테스트 계획**: 검증 방법

---

## 린트 및 포맷팅

### Python

```bash
# Docker 컨테이너에서 실행하거나 로컬에 ruff가 있다면:
cd backend && python -m ruff check --fix . && python -m ruff format .
```

### TypeScript

```bash
cd frontend && npm run lint:fix && npm run format
```

---

## 테스트

### Backend 테스트

```bash
# Docker 컨테이너에서 실행
docker exec vms-channel-bridge-backend python -m pytest tests/ -v

# 커버리지 포함
docker exec vms-channel-bridge-backend python -m pytest tests/ -v --cov=app --cov-report=term
```

### Frontend 테스트

```bash
# Docker 컨테이너에서 실행
docker exec vms-channel-bridge-frontend npx vitest --run
```

자세한 테스트 가이드는 [테스트 가이드](testing-guide)를 참조하세요.

---

## 커밋 및 PR 가이드

### 커밋 메시지 형식

```
<type>(<scope>): <subject>
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **scope**: `backend`, `frontend`, `docker`, `adapters`, `docs`, `auth`

**예시**:

```
feat(adapters): Add Slack DM channel support
fix(frontend): Fix route modal validation error
docs(admin-guide): Update deployment guide for v3.0
```

### PR 워크플로우

1. `main` 브랜치에서 feature 브랜치 생성
2. 설계 문서 작성 (필요 시)
3. 구현 및 테스트
4. 린트/포맷팅 확인
5. PR 생성 (설계 문서 링크 포함)

---

## 환경 변수 (.env)

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...         # Socket Mode 필수

# Microsoft Teams
TEAMS_TENANT_ID=...
TEAMS_APP_ID=...
TEAMS_APP_PASSWORD=...

# Database
DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/vms_channel_bridge

# Redis
REDIS_URL=redis://:redispassword@redis:6379/0

# JWT
SECRET_KEY=your-secret-key-32chars-min

# Bridge
BRIDGE_TYPE=native               # Light-Zowe 사용

# Frontend
FRONTEND_URL=http://localhost:5173

# SMTP (비밀번호 재설정용)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM_EMAIL=noreply@vms.local

# SSO - Microsoft Entra ID (선택)
SSO_MICROSOFT_ENABLED=false
SSO_MICROSOFT_TENANT_ID=...
SSO_MICROSOFT_CLIENT_ID=...
SSO_MICROSOFT_CLIENT_SECRET=...

# SSO - Generic OIDC (선택)
SSO_OIDC_ENABLED=false
SSO_OIDC_ISSUER_URL=...
SSO_OIDC_CLIENT_ID=...
SSO_OIDC_CLIENT_SECRET=...
```

> **주의**: `.env` 파일은 절대 Git에 커밋하지 마세요.

---

## 디버깅

### VS Code Remote Debug

`docker-compose.yml`에서 debugpy 포트(5678) 활성화 후:

```bash
docker compose up -d --build backend
# VS Code에서 localhost:5678로 attach
```

### Backend 로그 확인

```bash
docker logs vms-channel-bridge-backend -f --tail=100
docker logs vms-channel-bridge-backend --tail=200 | grep -i "error\|route\|message"
```

### Redis 직접 확인

```bash
# Route 키 조회
docker exec vms-channel-bridge-redis redis-cli KEYS "route:*"

# 특정 Route의 대상 목록
docker exec vms-channel-bridge-redis redis-cli SMEMBERS "route:slack:C1234567890"
```

---

## 관련 문서

- [아키텍처](architecture) — Light-Zowe 아키텍처 상세
- [테스트 가이드](testing-guide) — 테스트 전략 및 실행
- [API 문서](../api/api) — REST API 레퍼런스
- [디자인 시스템](design-system) — UI 컴포넌트 가이드
- [배포 가이드](../admin-guide/deployment) — 설치 및 운영

---

**최종 업데이트**: 2026-04-10
**문서 버전**: 3.1
