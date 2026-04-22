<!-- scope: app:v-itsm -->
# v-itsm — Claude Code 앱 스코프 설정
이 문서는 `apps/v-itsm/` 하위 작업에만 적용됩니다. 루트 `CLAUDE.md`와 `platform/CLAUDE.md`를 상위 컨텍스트로 함께 참조하세요.

## 1. 앱 정체성

- **역할**: 업무 루프 관리 시스템. 접수(VOC) → 분석(사업) → 실행(제품) → 검증(운영) → 답변(고객) 5단계 루프를 ITSM 표준 프로세스(요청·문제·변경·지식관리) 위에서 운영하는 앱.
- **주요 기능**:
  - 티켓 접수/분류/할당 (Slack·Teams·이메일 채널)
  - 5단계 Loop FSM 진행 추적 + 재개(reopen)/반려(reject)/보류(on_hold)/롤백
  - SLA 타이머(응답·해결) + 80% 경고/100% 위반 이벤트
  - 부서별/담당자별 Kanban 보드 + 우선순위/긴급도
  - KPI 스냅샷 (SLA 준수율, MTTR, Re-open Rate, 부서별 처리량, AI 채택률)
  - AI 보조: 자동 분류, 답변 초안, 유사 티켓 추천, 지식 요약
- **도메인 용어**:
  - **Ticket**: 업무 루프의 단위 요청. `itsm_ticket` 테이블, ULID PK.
  - **Loop Stage**: `intake` / `analyze` / `execute` / `verify` / `answer` / `closed` — FSM 상태.
  - **SLA Policy/Timer**: 우선순위·카테고리별 응답·해결 시간. Redis ZSET + APScheduler.
  - **Assignment**: 담당자·부서 배정 이력.
  - **Feedback**: 고객 만족도·재개 요청.
  - **AI Suggestion**: LLM 이 생성한 초안/추천. 채택 여부 추적.
- **아키텍처 패턴**:
  - "얇은 앱"을 넘는 도메인 앱. 플랫폼(인증/RBAC/감사/조직도)은 100% 재사용.
  - 알림은 **v-itsm 내장 outbound provider** (`app/providers/slack_provider.py`, `teams_provider.py`) 가 Slack Web API / MS Graph 를 직접 호출. v-channel-bridge HTTP 의존 없음 — bridge 가 꺼져도 알림 경로 동작. 설계 배경: `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` §7.3 (v0.5).
  - AI UI/스트리밍은 v-ui-builder 의 ChatPane + `useChatStream` + `BaseLLMProvider` 를 재사용.

## 2. 기술 스택 특이사항

- **Backend 추가 의존성**:
  - `apscheduler` — SLA 타이머 스케줄러
  - `python-ulid` — 티켓 ID 생성
  - `slack-sdk>=3.27.0` — embedded Slack outbound provider (AsyncWebClient)
  - `aiohttp` — embedded Teams provider (Graph OAuth + webhook fallback), 플랫폼 공용 deps 에 이미 포함
  - v-channel-bridge 의 provider 코드는 **import 하지 않음**. 필요 부분을 `app/providers/` 로 포팅하여 독립 동작. 자세한 내용은 §5 의존성 참조.
- **Frontend 추가 의존성(예정)**:
  - `@dnd-kit/core` — Kanban 드래그앤드롭
  - `recharts` — 이미 포함, KPI 차트 용
- **데이터 격리**: 모든 앱 테이블은 `itsm_` 접두사 (`MULTI_APP_DATA_ISOLATION` 설계 준수).

## 3. 엔드포인트 및 포트

| 서비스 | 내부 포트 | 호스트 포트 | 비고 |
|---|---|---|---|
| Backend | 8000 | 8005 | FastAPI, profile=itsm |
| Frontend | 5173 | 5182 | Vite, profile=itsm |

접속: http://127.0.0.1:5182

## 4. 디렉터리 맵

```
apps/v-itsm/
├── backend/
│   ├── app/
│   │   ├── main.py                  # PlatformApp(app_name="v-itsm")
│   │   ├── models/                  # itsm_* SQLAlchemy 모델 (예정)
│   │   ├── api/                     # tickets / loop / sla / kpi 라우터 (예정)
│   │   └── services/                # loop_fsm / sla_timer / ai_suggester (예정)
│   ├── migrations/
│   │   ├── a001_example.py          # 템플릿 예제 (앱 스키마 생성 시 a003+ 로 교체)
│   │   └── a002_dashboard_help_menus.py  # v-itsm 스코프 기본 메뉴
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # 업무 루프 대시보드
│   │   │   ├── Help.tsx
│   │   │   └── ...                  # tickets / kanban / kpi (예정)
│   │   └── App.tsx                  # PlatformProvider appName="v-itsm"
│   ├── Dockerfile.dev
│   ├── package.json                 # name: v-itsm-frontend
│   └── vite.config.ts
├── CLAUDE.md                        # ← 이 파일
└── .env.example
```

## 5. 의존성

- **Platform 의존**: PlatformApp 전체 (인증/RBAC/감사/조직도/설정/알림 관리).
- **앱 간 의존** — **런타임 HTTP 의존 없음**:
  - **v-channel-bridge** — 런타임 의존 제거됨. Outbound provider 코드(`BasePlatformProvider`/Slack/Teams/CommonMessage) 를 **소스 포팅(copy-not-import)** 하여 `app/providers/` 로 편입. bridge 가 중지되어도 v-itsm 알림은 정상 동작.
  - **v-ui-builder** — AI 기능용 `BaseLLMProvider` 코드 재사용 (복사 아닌 import 선호).
- **공유 인프라**:
  - PostgreSQL: `itsm_*` 테이블
  - Redis: SLA 타이머 ZSET (`itsm:sla:timers`) + 일반 캐시
  - APScheduler: 백엔드 프로세스 내 스케줄러
- **외부 서비스(직접 연동)**:
  - Slack Web API (`chat.postMessage`) via `slack_sdk.web.async_client.AsyncWebClient`
  - Microsoft Graph (`/teams/{team}/channels/{channel}/messages`) via `aiohttp` + OAuth 2.0 client_credentials
  - Power Automate webhook (Graph 미승인 환경 fallback) via `aiohttp`

## 6. 작업 범위 가드레일

### 자유 수정 허용
- `apps/v-itsm/**` 전체 (단, 아래 금지 사항 제외)
- `docker-compose.yml` 의 **itsm-backend / itsm-frontend / itsm_backend_data 볼륨** 섹션
- 루트 `.env.example` 에 v-itsm 고유 변수(선택 기능) 주석 추가
- 설계 문서 `docusaurus/docs/apps/v-itsm/design/**` 업데이트

### 사용자 승인 필요
- 루트 `.env.example` 스키마 변경 (공용 변수 추가/제거)
- v-channel-bridge / v-ui-builder 공개 API 의존 방식 변경
- `docker-compose.yml` 의 타 앱 서비스 수정 (CORS_ORIGINS 리스트 확장은 예외 — 필요 시 승인 후 진행)
- 신규 백엔드 의존성 추가 (APScheduler, dnd-kit 등 설계 §12 에 명시된 것은 선승인)

### 금지
- `platform/**` 직접 수정
- 다른 앱(`apps/v-channel-bridge/**`, `apps/v-platform-portal/**`, `apps/v-ui-builder/**`, `apps/v-platform-template/**`) 수정
- 플랫폼 공통 테이블(`users`, `permissions`, `audit_log`, `menu_items` 등) 스키마 직접 변경
- `itsm_` 접두사 없는 앱 테이블 추가 (다중 앱 격리 위반)
- 하드코딩된 시크릿/토큰 커밋

### 교차 영향 사전 체크리스트
1. 새 테이블이 `itsm_` 접두사를 따르는가?
2. 알림 경로 변경 시 **v-itsm 내장 provider** (`app/providers/`) 만 수정하고, v-channel-bridge 코드·스키마는 건드리지 않는가? (bridge 로 HTTP 호출을 되살리지 않는가?)
3. AI 기능 추가 시 v-ui-builder 의 provider 계약을 바꾸지 않는가?
4. 공용 변수(`TEAMS_TENANT_ID/APP_ID/APP_PASSWORD`, DB/Redis URL, SMTP 등)는 루트 `.env` 에, 앱 고유 값(`SLACK_BOT_TOKEN`, `TEAMS_TEAM_ID`, `TEAMS_NOTIFICATION_URL`, `ITSM_*`, `SLA_*`, `LLM_*`)은 `apps/v-itsm/.env` 에 두었는가?
5. 포털(`v-platform-portal`) AppRegistry 에 등록할 때 메타데이터가 일관적인가?
6. 설계 문서(§7.3 알림 경로, §11 포트, §12 재사용 매트릭스) 와 실제 구현이 일치하는가?

## 7. 앱 고유 개발 워크플로우

```bash
# itsm 프로필 기동
docker compose --profile itsm up -d --build

# 다른 앱과 동시 기동 (예: portal + itsm)
docker compose --profile portal --profile itsm up -d --build

# 백엔드 로그
docker compose logs -f itsm-backend --tail=50

# 프런트엔드 로그
docker compose logs -f itsm-frontend --tail=50

# 마이그레이션 실행 (v-platform 공통 러너가 a*.py 자동 감지)
docker compose exec itsm-backend python -m v_platform.migrations.run_app_migrations --app v-itsm
```

**접속**: http://127.0.0.1:5182 (Frontend) / http://127.0.0.1:8005/docs (API)

## 8. 관련 문서 및 참조

- **설계 문서(v-itsm)**: `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` — 전체 아키텍처·FSM·데이터 모델·Phase 계획
- **상위 문서**: 루트 `CLAUDE.md`, `platform/CLAUDE.md`
- **공통 규칙**: `.claude/shared/coding_conventions.md`, `.claude/shared/documentation-rules.md`
- **재사용 앱**:
  - `apps/v-channel-bridge/CLAUDE.md` — 알림 채널 provider 인터페이스
  - `apps/v-ui-builder/CLAUDE.md` — AI Chat UI / LLM Provider
- **다중 앱 격리**: `docusaurus/docs/platform/design/MULTI_APP_DATA_ISOLATION.md`
