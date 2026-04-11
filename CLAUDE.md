# v-project - Claude Code 프로젝트 설정

## 프로젝트 개요

v-project는 **v-platform**(재사용 가능한 플랫폼 프레임워크)과 **3개 앱**으로 구성된 멀티 앱 시스템입니다.

**핵심 목표**: 인증/RBAC/감사로그 등 범용 기능(v-platform)을 앱 고유 기능과 분리하여, 플랫폼을 다른 프로젝트에서 재사용 가능하게 함.

### 아키텍처

| 레이어 | 이름 | 역할 |
|--------|------|------|
| **플랫폼** | v-platform | 인증, SSO, RBAC, 사용자 관리, 조직도, 감사로그, UI Kit |
| **앱** | v-channel-bridge | Slack/Teams 메시지 브리지, 채널 라우팅, 프로바이더 어댑터 |
| **앱** | v-platform-template | 새 앱 시작 템플릿 (PlatformApp 최소 구성) |
| **앱** | v-platform-portal | 통합 앱 포털 (AppRegistry, SSO Relay, App Launcher) |

### 현재 시스템 상태

모든 개발 Phase 완료. Platform/App 분리, 포털 구현 완료.

| 컴포넌트 | 상태 | 비고 |
|---|---|---|
| v-platform Backend | ✅ 완성 | PlatformApp, 15 라우터, 12 서비스, 11 모델 |
| v-platform Frontend | ✅ 완성 | 17 페이지, 6 스토어, 11 훅, 60+ 컴포넌트 |
| v-channel-bridge | ✅ 완성 | Slack/Teams 양방향 브리지 |
| v-platform-template | ✅ 완성 | 새 앱 스캐폴딩 템플릿 |
| v-platform-portal | ✅ 완성 | 앱 런처, SSO Relay, 사이트맵 |
| Multi-app 데이터 격리 | ✅ 완성 | app_id 기반 메뉴/감사로그/설정 분리 |
| Token Relay SSO | ✅ 완성 | 포털 → 앱 JWT 자동 인증 |

**마이그레이션 계획**: `docusaurus/docs/design/V_PROJECT_MIGRATION_PLAN.md`  
**분리 아키텍처 설계**: `docusaurus/docs/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`

---

## ⚠️ 개발 환경 필수 규칙: Docker 전용

**로컬 npm/Python 실행 금지. 모든 작업은 Docker 내에서.**

```bash
# 기본 서비스 (v-channel-bridge) 전체 재시작
docker compose up -d --build

# Template 앱 포함
docker compose --profile template up -d --build

# Portal 앱 포함
docker compose --profile portal up -d --build

# 모든 앱 포함
docker compose --profile template --profile portal up -d --build

# 특정 서비스만 재빌드
docker compose up -d --build v-channel-bridge-backend
docker compose up -d --build v-channel-bridge-frontend
```

**이유**: 로컬 Node.js v24 vs Docker v18 버전 불일치, npm 충돌 방지.

---

## 기술 스택

- **Backend**: Python 3.11 / FastAPI / Pydantic / Structlog / Uvicorn
- **Frontend**: React 18 / TypeScript 5 / Vite / Tailwind CSS / Zustand / TanStack Query
- **Infrastructure**: Docker Compose
- **Database**: PostgreSQL 16 — `postgresql://vmsuser:vmspassword@postgres:5432/v_project`
- **Cache/Routing**: Redis 7 — `redis://:redispassword@redis:6379/0`
- **Mail**: MailHog (개발용)
- **인증**: JWT (python-jose) / bcrypt
- **차트**: Recharts / **아이콘**: Lucide React / **폰트**: Pretendard

---

## 프로젝트 구조

```
v-project/
├── platform/
│   ├── backend/v_platform/            # Python 패키지: v_platform
│   │   ├── app.py                     # PlatformApp (프레임워크 진입점)
│   │   ├── core/                      # database, logging, exceptions
│   │   ├── models/                    # 플랫폼 모델 11개 (app_id 분리 포함)
│   │   ├── api/                       # 플랫폼 라우터 15개 + HealthRegistry
│   │   ├── services/                  # 12개 (export, stats, event_broadcaster, log_buffer, feature_checker...)
│   │   ├── monitoring/                # 메트릭 레지스트리
│   │   ├── middleware/                # CSRF, Prometheus metrics
│   │   ├── sso/                       # Microsoft, Generic OIDC
│   │   ├── utils/                     # auth, audit_logger, encryption, filters
│   │   ├── schemas/                   # user, audit_log, system_settings (with branding)
│   │   └── migrations/                # p001~p016
│   └── frontend/v-platform-core/      # npm 패키지: @v-platform/core
│       └── src/
│           ├── pages/                 # ★ 17개 플랫폼 페이지 (Login, Settings, Admin...)
│           ├── providers/             # PlatformProvider (Config, QueryClient)
│           ├── api/                   # client, auth, users, permissions...
│           ├── stores/                # 6개 (auth, permission, notification, systemSettings, sessionSettings, user-oauth)
│           ├── hooks/                 # 11개 (useTheme, useWebSocket, useNotifications, useApiErrorHandler...)
│           ├── components/            # ui(24), layout(10), settings(5), profile(2), oauth(3), admin(7), auth(2), common(2), notifications(5)
│           └── lib/                   # navigation, resolveStartPage, tour, websocket, utils
│
├── apps/
│   ├── v-channel-bridge/              # 앱: Slack ↔ Teams 메시지 브리지
│   │   ├── backend/app/
│   │   │   ├── adapters/              # Slack, Teams Provider
│   │   │   ├── api/                   # bridge, messages, accounts, teams_webhook
│   │   │   ├── models/               # Message, Account
│   │   │   ├── services/             # websocket_bridge, route_manager, message_queue...
│   │   │   └── main.py               # PlatformApp + register_app_routers()
│   │   └── frontend/src/
│   │       ├── pages/                 # 앱 전용: Dashboard, Channels, Messages, Statistics...
│   │       ├── components/            # 앱 전용: dashboard, channels, messages, providers...
│   │       └── App.tsx                # 플랫폼 페이지 import + 앱 전용 라우트
│   │
│   ├── v-platform-template/           # 새 앱 시작 템플릿
│   │   ├── backend/app/main.py        # PlatformApp만 (~30줄)
│   │   └── frontend/src/
│   │       ├── App.tsx                # 플랫폼 페이지 import (~100줄)
│   │       └── pages/Dashboard.tsx    # 유일한 앱 전용 페이지
│   │
│   └── v-platform-portal/             # 통합 앱 포털
│       ├── backend/                   # AppRegistry, Portal API
│       └── frontend/                  # App Launcher, SSO Relay, Sitemap
│
├── docker-compose.yml                 # 모든 서비스 (프로필 지원)
├── monitoring/                        # Prometheus, Grafana, Promtail
└── docusaurus/docs/
    ├── platform/                      # 플랫폼 문서
    └── apps/                          # 앱별 문서
```

---

## 필수 워크플로우

### Python 파일 수정 후

```bash
cd apps/v-channel-bridge/backend && python -m ruff check --fix . && python -m ruff format .
```

### TypeScript 파일 수정 후

```bash
cd apps/v-channel-bridge/frontend && npm run lint:fix && npm run format
```

### 테스트 실행

```bash
# Backend (Docker 컨테이너에서)
docker exec v-channel-bridge-backend python -m pytest tests/ -v

# Frontend
cd apps/v-channel-bridge/frontend && npx vitest --run
```

---

## Redis 라우팅 구조

Route는 `route:{platform}:{channel_id}` 키에 타겟 목록을 저장합니다.

```
route:slack:C123               → {slack:C456}           (SMEMBERS — 대상 집합)
route:slack:C123:names         → {slack:C456: "이름"}   (HGETALL — 채널 이름)
route:slack:C123:modes         → {slack:C456: "sender_info"|"editable"}
route:slack:C123:bidirectional → {slack:C456: "1"|"0"}
```

**양방향 Route**: `add_route(is_bidirectional=True)` → 역방향 키도 자동 생성.
**UI에서는 1개로 표시** (deduplication, `get_all_routes()`의 `frozenset` 쌍 추적).

Teams 채널 ID는 `{teamId}:{channelId}` 형식으로 저장 (`_parse_channel_ref()`로 파싱).

---

## 주요 서비스 포트

| 서비스 | 포트 |
|--------|------|
| v-channel-bridge Backend | 8000 |
| v-channel-bridge Frontend | 5173 |
| v-platform-template Backend | 8002 |
| v-platform-template Frontend | 5174 |
| v-platform-portal Backend | 8080 |
| v-platform-portal Frontend | 5180 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MailHog Web UI | 8025 |
| debugpy (debug 모드) | 5678 |

---

## 환경 변수 (.env)

```bash
# v-platform (플랫폼)
DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/v_project
REDIS_URL=redis://:redispassword@redis:6379/0
SECRET_KEY=...                   # JWT 서명 키 (32자 이상)
FRONTEND_URL=http://localhost:5173
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM_EMAIL=noreply@v-project.local

# v-channel-bridge (앱)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...         # Socket Mode 필수
TEAMS_TENANT_ID=...              # Azure Tenant ID
TEAMS_APP_ID=...                 # Azure Application ID
TEAMS_APP_PASSWORD=...           # Azure Client Secret
BRIDGE_TYPE=native

# v-platform-portal (포털)
PORTAL_APPS=v-channel-bridge,v-platform-template  # 포털에 등록할 앱 목록
```

**.env 파일은 절대 커밋하지 마세요.**

---

## Teams 봇 설정 (실 테스트 전 필요)

Teams Provider 코드는 완성됐지만, 실제 동작을 위해 Azure에서 Bot 등록이 필요합니다:

1. Azure Portal → Bot Services → 새 Bot 등록
2. Messaging Endpoint: `https://{your-domain}/api/teams/webhook`
3. Microsoft Teams 채널 활성화
4. App ID / Password → `.env`의 `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`
5. API 권한: `ChannelMessage.Read.All`, `ChannelMessage.Send`, `Team.ReadBasic.All`

---

## 코딩 규칙 요약

### Python
- 타입 힌트: 3.9+ 빌트인 제네릭 (`list[str]`), `Optional[X]`는 `typing`에서 임포트
- Provider: `BasePlatformProvider` 상속 필수
- 메시지: 모든 플랫폼 메시지는 `CommonMessage`로 변환
- 비동기: I/O는 `async/await` 필수
- 로깅: `structlog` 사용

### TypeScript
- 모든 props에 `interface` 정의, `any` 금지
- 서버 상태: TanStack Query / 클라이언트 상태: Zustand
- 스타일: CSS 변수 시맨틱 토큰 (`bg-surface-card`, `text-content-primary`)
- 페이지 레이아웃: `<> + ContentHeader + page-container + space-y-section-gap` 패턴

자세한 규칙: `.claude/coding_conventions.md`

---

## 커밋 메시지 규칙

```
<type>(<scope>): <subject>
```

- **type**: feat, fix, docs, style, refactor, test, chore
- **scope**: v-platform, v-channel-bridge, v-platform-template, v-platform-portal, backend, frontend, docker, docs, migration

---

## Git 워크플로우 규칙

**`git push`는 사용자가 명시적으로 요청할 때만 실행합니다.**

---

## Claude Code 슬래시 커맨드

| 커맨드 | 용도 |
|--------|------|
| `/docker-troubleshoot` | Docker 문제 진단 |
| `/enforce-standards` | 코딩 표준 검사 |
| `/deploy-check` | 배포 전 체크리스트 |
| `/provider-health` | Provider 연결 상태 |
| `/write-pr-summary` | PR 요약 작성 |
| `/sync-docs` | 코드 변경 기반 증분 문서 갱신 |

## Agent 활용

| Agent | 모델 | 사용 시기 |
|-------|------|----------|
| **search-optimizer** | Haiku | 파일 찾기, 로그 검색, 키워드 위치 |
| **docker-expert** | Sonnet | Docker 상태 확인, 컨테이너 디버깅 |
| **Explore** | Sonnet | 코드베이스 흐름 파악 |

파일 읽기 최적화: `.claude/token-optimization-workflow.md` 참조

---

## 문서 저장 규칙

- **작업 이력**: `docusaurus/blog/work-history/YYYY-MM-DD-{title}.md`
- **설계 문서**: `docusaurus/docs/design/{TOPIC}_{TYPE}.md`
- **개발자 가이드**: `docusaurus/docs/developer-guide/`

상세 규칙: `.claude/documentation-rules.md`

---

**문서 버전**: 6.0 (v-project — 멀티 앱 포털 완료)
**최종 업데이트**: 2026-04-11
