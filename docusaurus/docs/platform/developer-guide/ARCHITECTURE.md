---
id: architecture
title: VMS Chat Ops 아키텍처
sidebar_position: 3
tags: [guide, developer]
---

# VMS Chat Ops 아키텍처

## 시스템 개요

VMS Chat Ops는 **Light-Zowe 아키텍처** 기반 Slack ↔ Microsoft Teams 양방향 메시지 브리지 시스템입니다. Zowe Chat의 핵심 개념(Common Message Schema, Provider Pattern, Command Processor)을 Docker + FastAPI로 직접 구현합니다.

### 핵심 설계 철학

- **Provider Pattern**: 각 플랫폼(Slack, Teams)을 `BasePlatformProvider` 인터페이스로 추상화
- **Common Message Schema**: 모든 플랫폼 메시지를 `CommonMessage`로 정규화하여 라우팅
- **동적 라우팅**: Redis 기반 Route Manager로 런타임에 라우팅 규칙 변경 가능
- **배치 저장**: MessageQueue를 통한 메시지 상태 배치 DB 저장으로 성능 최적화

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     사용자 브라우저 (관리 UI)                      │
│            React 18 + TypeScript + Tailwind CSS + Zustand        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  Backend API (FastAPI + Uvicorn)                 │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────┐ │
│  │  Bridge API  │ │ Messages API│ │  Auth API    │ │ Users API│ │
│  │  /api/bridge │ │/api/messages│ │ /api/auth    │ │/api/users│ │
│  └──────┬──────┘ └──────┬──────┘ └──────────────┘ └──────────┘ │
│         │               │                                        │
│  ┌──────▼───────────────▼──────────────────────────────────────┐│
│  │              WebSocket Bridge (메시지 브로커)                  ││
│  │  CommonMessage 수신 → Route Manager 조회 → Provider 전송      ││
│  └──────┬───────────────────────────────────┬──────────────────┘│
│         │                                   │                    │
│  ┌──────▼──────────┐              ┌─────────▼────────────┐      │
│  │  Slack Provider  │              │  Teams Provider       │      │
│  │  (Socket Mode)   │              │  (Graph API + Bot)    │      │
│  │  slack_provider.py│             │  teams_provider.py    │      │
│  └──────┬──────────┘              └─────────┬────────────┘      │
│         │                                   │                    │
│  ┌──────▼───────────────────────────────────▼──────────────────┐│
│  │                   Route Manager (Redis)                      ││
│  │          동적 라우팅 규칙 관리, 양방향/단방향 지원                ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Message Queue (배치 저장)                    ││
│  │          메시지 상태를 큐에 모아서 DB에 배치 flush               ││
│  └─────────────────────────────────────────────────────────────┘│
└────────┬───────────────────────┬──────────────────┬─────────────┘
         │                       │                  │
    ┌────▼────┐            ┌─────▼─────┐      ┌────▼────┐
    │  Slack  │            │ PostgreSQL│      │  Redis  │
    │   API   │            │    16     │      │    7    │
    └─────────┘            └───────────┘      └─────────┘
         │
    ┌────▼────┐
    │  Teams  │
    │Graph API│
    └─────────┘
```

---

## 핵심 컴포넌트

### 1. Provider Pattern

각 플랫폼은 `BasePlatformProvider` 인터페이스를 구현합니다.

```
backend/app/adapters/
├── base.py              # BasePlatformProvider 추상 클래스
├── slack_provider.py    # Slack Socket Mode Provider
└── teams_provider.py    # MS Graph API + Bot Framework Provider
```

**BasePlatformProvider 인터페이스:**

| 메서드 | 설명 |
|--------|------|
| `connect()` | 플랫폼 연결 |
| `disconnect()` | 연결 해제 |
| `send_message(message)` | CommonMessage → 플랫폼 메시지 전송 |
| `get_channels()` | 채널 목록 조회 |
| `download_file(url)` | 파일 다운로드 (크로스 플랫폼 전달용) |
| `transform_to_common()` | 플랫폼 메시지 → CommonMessage 변환 |
| `transform_from_common()` | CommonMessage → 플랫폼 메시지 변환 |

**Slack Provider** — Socket Mode로 실시간 이벤트 수신, Web API로 메시지 전송. 파일 업로드(`files.upload_v2`), 인라인 이미지 처리 지원.

**Teams Provider** — Azure Bot Framework webhook으로 메시지 수신, Graph API로 메시지 전송. `hostedContents`를 통한 인라인 이미지 전송, SharePoint 파일 업로드 지원.

### 2. CommonMessage Schema

모든 플랫폼 메시지는 `CommonMessage`로 정규화됩니다.

```
backend/app/schemas/common_message.py
```

```python
class CommonMessage(BaseModel):
    message_id: str
    platform: Platform          # slack, teams
    type: MessageType           # text, file, image, ...
    channel: Channel            # id, name, type
    user: Optional[UserInfo]    # id, username, display_name
    text: Optional[str]
    timestamp: datetime
    attachments: list[Attachment]
    thread_id: Optional[str]
    metadata: dict
```

**메시지 흐름:**

```
Slack 이벤트 → SlackProvider.transform_to_common()
    → CommonMessage
    → WebSocket Bridge
    → Route Manager (대상 조회)
    → TeamsProvider.transform_from_common()
    → Teams Graph API 전송
```

### 3. Route Manager (Redis)

동적 라우팅 규칙을 Redis에 저장합니다.

```
backend/app/services/route_manager.py
```

**Redis 키 구조:**

```
route:{platform}:{channel_id}               → SET (대상 채널 집합)
route:{platform}:{channel_id}:names         → HASH (채널 이름)
route:{platform}:{channel_id}:modes         → HASH (전송 모드)
route:{platform}:{channel_id}:bidirectional → HASH (양방향 여부)
```

**양방향 Route**: `add_route(is_bidirectional=True)` 호출 시 역방향 키도 자동 생성. UI에서는 1개로 표시됩니다 (`get_all_routes()`의 `frozenset` 쌍 중복 제거).

**Teams 채널 ID 형식**: `{teamId}:{channelId}` — `_parse_channel_ref()`로 파싱.

### 4. WebSocket Bridge

메시지 라우팅의 중심입니다.

```
backend/app/services/websocket_bridge.py
```

**역할:**
- Provider로부터 CommonMessage 수신
- Route Manager에서 대상 채널 조회
- 대상 Provider로 메시지 전달
- 파일 다운로드 → 크로스 플랫폼 업로드 처리
- MessageQueue를 통한 메시지 상태 기록

### 5. Message Queue (배치 저장)

DB 부하를 최소화하기 위해 메시지 상태를 큐에 모아 배치 저장합니다.

```
backend/app/services/message_queue.py
```

- **batch_size**: 50개 도달 시 즉시 flush
- **flush_interval**: 5초마다 주기적 flush
- 첨부파일 메타데이터(파일명, MIME 타입, 크기) 함께 저장

---

## 프로젝트 구조

```
backend/
├── app/
│   ├── adapters/              # Provider Pattern
│   │   ├── base.py            # BasePlatformProvider 인터페이스
│   │   ├── slack_provider.py  # Slack Socket Mode
│   │   └── teams_provider.py  # MS Graph API + Bot Framework
│   ├── api/                   # API 엔드포인트 (22개 라우터)
│   │   ├── auth.py            # JWT 인증
│   │   ├── auth_microsoft.py  # Microsoft OAuth2
│   │   ├── auth_sso.py        # SSO 인증 (Microsoft Entra ID, OIDC)
│   │   ├── users.py           # 사용자 관리
│   │   ├── user_oauth.py      # 사용자별 OAuth 토큰 관리
│   │   ├── bridge.py          # 브리지 제어 + Route CRUD
│   │   ├── messages.py        # 메시지 히스토리
│   │   ├── audit_logs.py      # 감사 로그
│   │   ├── accounts_crud.py   # Provider 계정 CRUD
│   │   ├── menus.py           # 커스텀 메뉴 관리
│   │   ├── permissions.py     # 권한 관리
│   │   ├── permission_groups.py # 권한 그룹 관리
│   │   ├── organizations.py   # 조직(회사/부서) 관리
│   │   ├── health.py          # 헬스체크
│   │   ├── monitoring.py      # 시스템 모니터링
│   │   ├── notifications.py   # 알림
│   │   ├── teams_webhook.py   # Teams Bot Framework webhook
│   │   ├── teams_notifications.py  # Teams Graph 변경 알림
│   │   ├── system_settings.py # 시스템 설정
│   │   ├── metrics.py         # Prometheus 메트릭
│   │   └── websocket.py       # WebSocket 연결
│   ├── models/                # SQLAlchemy 모델 (13개)
│   │   ├── message.py         # 메시지 (첨부파일 메타데이터 포함)
│   │   ├── user.py            # 사용자 (SSO 필드, 3단계 역할)
│   │   ├── account.py         # Provider 계정
│   │   ├── audit_log.py       # 감사 로그
│   │   ├── system_setting.py  # 시스템 설정
│   │   ├── menu_item.py       # 커스텀 메뉴 항목
│   │   ├── user_permission.py # 사용자 권한
│   │   ├── permission_group.py # 권한 그룹
│   │   ├── company.py         # 회사 (조직)
│   │   ├── department.py      # 부서
│   │   ├── user_oauth_token.py # 사용자 OAuth 토큰
│   │   └── password_reset_token.py # 비밀번호 재설정 토큰
│   ├── schemas/
│   │   └── common_message.py  # CommonMessage 스키마
│   ├── services/
│   │   ├── route_manager.py   # Redis 기반 동적 라우팅
│   │   ├── websocket_bridge.py # 메시지 브로커
│   │   ├── message_queue.py   # 배치 메시지 저장
│   │   ├── message_service.py # 메시지 조회/검색
│   │   ├── command_processor.py # 명령어 처리
│   │   ├── feature_checker.py # 플랫폼 기능 검증
│   │   └── permission_service.py # RBAC 권한 검증
│   ├── sso/                   # SSO 인증 모듈
│   │   ├── base.py            # BaseSSOProvider 인터페이스
│   │   ├── microsoft.py       # Microsoft Entra ID
│   │   ├── generic_oidc.py    # Generic OIDC Provider
│   │   └── registry.py        # SSO Provider 레지스트리
│   ├── middleware/             # 미들웨어
│   │   └── csrf.py            # CSRF 보호 (state 기반 SSO 지원)
│   ├── db/                    # 데이터베이스 설정
│   └── main.py                # FastAPI 앱 초기화
├── tests/
│   ├── adapters/              # Provider 단위 테스트
│   └── services/              # Service 단위 테스트
└── requirements.txt

frontend/
├── src/
│   ├── pages/                 # 페이지 컴포넌트 (20개)
│   │   ├── Dashboard.tsx      # 대시보드 (통계, 상태)
│   │   ├── Routes.tsx         # Route 관리
│   │   ├── Messages.tsx       # 메시지 히스토리
│   │   ├── Statistics.tsx     # 통계 대시보드
│   │   ├── AuditLogs.tsx      # 감사 로그
│   │   ├── Settings.tsx       # 설정
│   │   ├── UserManagement.tsx # 사용자 관리
│   │   ├── Integrations.tsx   # OAuth 연동 관리
│   │   ├── Profile.tsx        # 사용자 프로필
│   │   ├── Login.tsx          # 로그인
│   │   ├── SSOCallback.tsx    # SSO 콜백 처리
│   │   ├── Forbidden.tsx      # 403 접근 거부
│   │   ├── CustomIframe.tsx   # 커스텀 iframe 페이지
│   │   └── admin/             # 관리자 전용 페이지
│   ├── components/
│   │   ├── channels/          # RouteList, RouteModal, ChannelInputField
│   │   ├── messages/          # MessageCard, MessageFilters
│   │   ├── providers/         # ProviderCard, ProviderModal
│   │   ├── ui/                # 디자인 시스템 컴포넌트
│   │   └── layout/            # Sidebar, TopBar
│   ├── store/                 # Zustand 상태 관리
│   │   ├── bridge.ts          # 브리지 상태
│   │   ├── routes.ts          # 라우트 상태
│   │   └── auth.ts            # 인증 상태
│   └── lib/api/               # API 클라이언트
│       ├── messages.ts        # 메시지 API
│       ├── providers.ts       # Provider API
│       ├── auditLogs.ts       # 감사 로그 API
│       └── ...
├── tailwind.config.js         # CSS 변수 시맨틱 토큰
└── vite.config.ts
```

---

## 데이터 흐름

### 메시지 전달 흐름 (Slack → Teams)

```
1. Slack에서 메시지 작성
2. Slack Socket Mode → SlackProvider.on_message()
3. SlackProvider.transform_to_common() → CommonMessage 생성
4. WebSocket Bridge 수신
5. Route Manager에서 대상 채널 조회
6. [파일 있으면] SlackProvider.download_file() → 임시 저장
7. TeamsProvider.send_message(CommonMessage)
8. TeamsProvider.transform_from_common() → Teams 메시지 형식
9. [이미지] hostedContents + base64 인라인 전송
10. [일반 파일] SharePoint 업로드 → 링크 첨부
11. Graph API POST /teams/{teamId}/channels/{channelId}/messages
12. MessageQueue에 상태 기록 (sent/failed)
13. 배치 flush → PostgreSQL 저장
```

### Route 관리 흐름

```
1. UI에서 Route 추가 (소스 채널 → 대상 채널)
2. POST /api/bridge/routes
3. Route Manager → Redis에 라우팅 규칙 저장
4. [양방향이면] 역방향 규칙도 자동 저장
5. 즉시 적용 (재시작 불필요)
```

---

## 배포 구조

### Docker Compose 서비스

| 서비스 | 이미지 | 포트 | 역할 |
|--------|--------|------|------|
| backend | Python 3.11 / FastAPI | 8000 | API 서버 + Provider 연결 |
| frontend | Node 18 / Vite | 5173 | React 관리 UI |
| postgres | PostgreSQL 16 | 5432 | 메시지/사용자/설정 DB |
| redis | Redis 7 | 6379 | 라우팅 규칙 + 캐시 |
| prometheus | Prometheus | 9090 | 메트릭 수집 |
| grafana | Grafana | 3000 | 모니터링 대시보드 |
| loki | Loki | 3100 | 로그 수집 |
| promtail | Promtail | — | 로그 수집 에이전트 |
| mailhog | MailHog | 8025 | 개발용 메일 서버 |

### 네트워크

모든 서비스는 `vms-chat-ops-network` Docker 네트워크에서 통신합니다.

---

## 보안

### 인증 및 권한

- **JWT 토큰 기반 인증**: access_token + refresh_token
- **SSO 인증**: Microsoft Entra ID, Generic OIDC 지원 (하이브리드 auth: local/sso/hybrid)
- **RBAC**: SYSTEM_ADMIN, ORG_ADMIN, USER 3단계 역할 체계
- **권한 그룹**: 명명된 권한 그룹, 역할 기반 기본 할당, 유효 권한 = MAX(그룹 권한, 개인 오버라이드)
- **서버 기반 네비게이션**: RBAC 권한에 따라 필터링된 사이드바 메뉴
- **디바이스 관리**: 다중 디바이스 로그인, 개별 세션 해제
- **비밀번호 재설정**: 이메일 기반 (MailHog 개발환경)

### 데이터 보호

- **환경 변수**: `.env` 파일로 시크릿 관리 (커밋 금지)
- **HTTPS**: 프로덕션 환경에서 SSL/TLS 적용
- **CORS**: 허용된 Origin만 API 접근
- **감사 로그**: 모든 관리 작업 기록

---

## 확장 가능성

- **새 플랫폼 추가**: `BasePlatformProvider` 구현으로 Discord, Telegram 등 추가 가능
- **새 SSO Provider 추가**: `BaseSSOProvider` 구현으로 Google, Okta 등 추가 가능
- **조직 계층 확장**: 회사 → 부서 계층에 팀/프로젝트 레벨 추가 가능
- **고급 메시지 기능**: 스레드, 편집/삭제 알림, 리액션 전달 (설계 완료)

---

**최종 업데이트**: 2026-04-10
**아키텍처 버전**: Light-Zowe 3.1
