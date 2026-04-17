# v-channel-bridge — Claude Code 앱 스코프 설정
<!-- scope: app:v-channel-bridge -->

이 문서는 `apps/v-channel-bridge/` 하위 작업에만 적용됩니다. 루트 `CLAUDE.md`(공통 규칙)와 `platform/CLAUDE.md`(플랫폼 규칙)를 상위 컨텍스트로 함께 참조하세요.

## 1. 앱 정체성

- **역할**: Slack ↔ Microsoft Teams 간 양방향 메시지 브리지. 채널 매핑·라우팅·메시지 변환·편집·삭제 동기화를 담당합니다.
- **주요 기능**:
  - Provider Pattern 기반 Slack/Teams 어댑터
  - Redis 기반 라우팅 테이블 (`route:{platform}:{channel_id}`)
  - WebSocket Bridge (`WebSocketBridge`) — 플랫폼 간 실시간 메시지 전달
  - CommonMessage 스키마 변환 (플랫폼 중립 메시지 표현)
  - Teams Subscription/Webhook 처리, Route Health Monitor
  - 크로스 플랫폼 멘션 보존 (Phase 0 — 멘션 텍스트 유지)
- **도메인 용어**:
  - **Route**: 한 채널(source)에서 다른 채널(target)로의 메시지 전달 규칙
  - **Bidirectional Route**: 역방향 Route를 자동 생성하는 양방향 매핑
  - **CommonMessage**: 플랫폼 독립 메시지 스키마 (sender/text/attachments/mentions)
  - **Account**: Slack/Teams 자격증명 저장 엔티티 (platform + token)
  - **Provider**: `BasePlatformProvider`를 상속한 플랫폼 어댑터 인스턴스
- **아키텍처 패턴**:
  - Provider Pattern — 각 플랫폼별 Provider가 공통 인터페이스 구현
  - Pub-Sub via Redis — 라우팅 테이블 공유 + 메시지 큐잉
  - Command Processor — 슬래시 커맨드 처리 파이프라인
  - Message Queue 배치 플러시 (batch_size=50, 5s)

## 2. 기술 스택 특이사항

- **Python**: slack-bolt (Socket Mode), slack_sdk, aiohttp (Teams), msal (Graph API 인증)
- **TypeScript**: 플랫폼 공통 스택만 사용 (React 18 / Vite / Zustand / TanStack Query / Tailwind)
- **Redis**: 라우팅 테이블 저장 + Pub-Sub 메시지 전달에 필수 (미기동 시 Bridge 시작 실패)
- **비동기 I/O**: Slack Socket Mode와 Teams Webhook 모두 async로 처리 — 동기 I/O 금지

## 3. 엔드포인트 및 포트

| 서비스 | 내부 포트 | 호스트 포트 | 비고 |
|---|---|---|---|
| Backend | 8000 | 8000 | FastAPI (`uvicorn app.main:app`) |
| Frontend | 5173 | 5173 | Vite dev server |
| WebSocket | 8000 | 8000 | `/api/ws` (토큰 인증) |
| Teams Webhook | 8000 | 8000 | `/api/teams/webhook` |
| debugpy | 5678 | 5678 | debug profile |

## 4. 디렉터리 맵

```
apps/v-channel-bridge/
├── backend/app/
│   ├── main.py                      # PlatformApp + register_app_routers()
│   ├── adapters/                    # ★ Provider 구현 (Slack/Teams)
│   │   ├── base.py                  # BasePlatformProvider (상속 필수)
│   │   ├── slack_provider.py
│   │   └── teams_provider.py
│   ├── api/                         # bridge, messages, accounts_crud, teams_webhook, monitoring
│   ├── services/                    # ★ 핵심 로직
│   │   ├── websocket_bridge.py      # 메시지 플로우 허브
│   │   ├── route_manager.py         # Redis 라우팅 테이블 CRUD
│   │   ├── command_processor.py     # 슬래시 커맨드
│   │   ├── message_queue.py         # 배치 플러시
│   │   ├── route_health.py          # Route 헬스체크
│   │   └── teams_subscription_manager.py
│   ├── models/                      # Account, Message (앱 전용 DB 모델)
│   └── middleware/, schemas/, utils/
└── frontend/src/
    ├── pages/                       # Dashboard, Channels, Messages, Statistics, Monitoring, Integrations...
    ├── components/                  # dashboard, channels, messages, providers
    ├── hooks/useRealtimeStatus.ts   # 앱 전용 (플랫폼 useWebSocket 기반)
    ├── store/                       # 앱 전용 Zustand 스토어
    └── App.tsx                      # 플랫폼 페이지 import + 앱 라우트
```

## 5. 의존성

- **Platform 의존**: `v_platform.app.PlatformApp`, `v_platform.api.health`, `v_platform.services.websocket_manager`, `v_platform.core.database`, 인증/RBAC/감사로그 전체. **플랫폼 모듈 변경 시 루트 승인 필요**.
- **공유 인프라**: PostgreSQL `v_project` DB (uploaded_files/users/audit 등 플랫폼 테이블 공유), Redis DB 0 (라우팅 전용 네임스페이스 `route:*`), MailHog.
- **외부 서비스**: Slack Bot/App 토큰 (Socket Mode), Microsoft Graph API (Azure AD 앱 등록 + Bot Service).

## 6. 작업 범위 가드레일

### ✅ 자유 수정 허용
- `apps/v-channel-bridge/backend/app/**` 내부 파일 추가/수정
- `apps/v-channel-bridge/frontend/src/**` 내부 (단, 플랫폼 페이지 import 경로는 유지)
- `apps/v-channel-bridge/backend/migrations/a*.py` 앱 전용 마이그레이션 추가
- 앱 전용 의존성 (`requirements.txt` 내 slack-bolt/aiohttp/msal 계열)

### ⚠️ 사용자 승인 필요
- `docker-compose.yml` 의 `v-channel-bridge-*` 서비스 설정 변경 (포트·볼륨·환경변수)
- Redis 키 네임스페이스 변경 (`route:*` 스키마) — 기존 데이터 마이그레이션 동반
- Provider Pattern 공통 인터페이스 변경 (`BasePlatformProvider`) — 신규 플랫폼 추가 시 영향
- CommonMessage 스키마 필드 추가/제거

### ❌ 금지
- `platform/**` 파일 직접 수정 (플랫폼 기능 필요 시 별도 논의 후 `platform/CLAUDE.md` 스코프에서 작업)
- 타 앱 (`apps/v-platform-portal/`, `apps/v-platform-template/`) 파일 수정
- `.env`/`docker-compose.yml` 의 다른 앱 섹션 수정
- 플랫폼 테이블 스키마 변경 (`users`, `uploaded_files`, `audit_log` 등) — 플랫폼 마이그레이션 경로로만

### 교차 영향 사전 체크리스트
작업을 시작하기 전/끝난 후 확인:
1. 플랫폼 모듈(`v_platform.*`)을 import만 하고 수정은 하지 않았는가?
2. Redis 키가 `route:*` 네임스페이스 안에 있는가? (다른 앱과 충돌 없음)
3. DB 마이그레이션이 `apps/v-channel-bridge/backend/migrations/a*.py` 네임스페이스인가?
4. Frontend의 플랫폼 페이지 import 경로(`@v-platform/core/pages/*`)를 유지했는가?
5. `docker-compose.yml`의 다른 서비스(portal/template) 설정을 건드리지 않았는가?

## 7. 앱 고유 개발 워크플로우

**Backend 변경 후**:
```bash
cd apps/v-channel-bridge/backend && python -m ruff check --fix . && python -m ruff format .
docker compose up -d --build v-channel-bridge-backend
```

**Frontend 변경 후**:
```bash
cd apps/v-channel-bridge/frontend && npm run lint:fix && npm run format
docker compose up -d --build v-channel-bridge-frontend
```

**테스트**:
```bash
docker exec v-channel-bridge-backend python -m pytest tests/ -v
cd apps/v-channel-bridge/frontend && npx vitest --run
```

**Provider 헬스체크**: `/provider-health` 슬래시 커맨드 또는 `GET /api/bridge/status`

## 8. 관련 문서 및 참조

- 공통 규칙: 루트 `CLAUDE.md`, `.claude/shared/coding_conventions.md`
- 플랫폼 규칙: `platform/CLAUDE.md`
- 앱 전용 규칙: `apps/v-channel-bridge/.claude/CONVENTIONS.md` (Provider Pattern / CommonMessage / Route 상세)
- 아키텍처: `docusaurus/docs/apps/v-channel-bridge/`
- 마이그레이션 히스토리: `docusaurus/docs/platform/design/V_PROJECT_MIGRATION_PLAN.md`
