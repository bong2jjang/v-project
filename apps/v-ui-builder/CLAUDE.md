<!-- scope: app:v-ui-builder -->
# v-ui-builder — Claude Code 앱 스코프

**AI UI Builder** — 대화로 UI를 만들고 Sandpack 으로 즉시 미리보기. v-platform 위에서 동작하는 앱입니다.

이 문서는 `apps/v-ui-builder/**` 작업 시 **루트 `CLAUDE.md` + 본 파일**을 병합 적용합니다.

## 1. 앱 정체성

- **무엇**: Bolt.new 의 대화형 UI 생성 경험을 Sandpack(브라우저 번들러)과 결합한 IDE 형 앱
- **왜**: WebContainer 유료 라이선스 회피 + Apache 2.0 Sandpack 으로 무료 상업 이용
- **MVP 범위 (P1.x)**: 3-pane IDE(Chat | Code | Preview) + OpenAI Provider + Sandpack react-ts 템플릿 + 프로젝트 저장/불러오기

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| Backend | Python 3.11 / FastAPI / Pydantic v2 / **SSE** (sse-starlette) |
| LLM | **Provider Pattern** — OpenAI(MVP) → Gemini/Claude 교체 가능 (config 만으로) |
| Frontend | React 18 / Vite / TypeScript 5 / Tailwind / Zustand / TanStack Query |
| Sandbox | **@codesandbox/sandpack-react** (Apache 2.0) + **Monaco Editor** |
| DB | PostgreSQL 공유 `v_project`, 네임스페이스 `ui_builder_*` |
| Cache | Redis 공유, 키 프리픽스 `ui_builder:*` |

**의도적으로 배제**: WebContainer API(상업 유료), Nodebox(EULA 제약).

## 3. 엔드포인트 / 포트

| 서비스 | 컨테이너 | 호스트 포트 |
|---|---|---|
| Backend | `v-ui-builder-backend` | `8004:8000` |
| Frontend | `v-ui-builder-frontend` | `5181:5173` |

- API prefix: `/api/ui-builder/*` (P1.1 에서 라우터 등록)
- SSE 엔드포인트:
  - Sandpack Builder — `POST /api/ui-builder/projects/{id}/chat` (scope=project)
  - Generative UI — `POST /api/ui-builder/projects/{id}/dashboard/chat` (scope=dashboard)
- Docker profile: `ui-builder`

### 프론트엔드 라우트 (메뉴 분리 후)

| 경로 | 페이지 | 메뉴 (permission_key) | 아이콘 |
|---|---|---|---|
| `/` | `Dashboard` (Sandpack 프로젝트 목록) | "Sandpack 프로젝트" (`ui_builder_sandpack`) | `Code2` |
| `/builder/:projectId` | `Builder` (3-pane IDE + SnapshotsPanel) | — (`ui_builder_sandpack` 상속) | — |
| `/genui` | `GenUIProjects` (Generative UI 프로젝트 목록) | "Generative UI 프로젝트" (`ui_builder_genui`) | `Sparkles` |
| `/genui/:projectId` | `GenUIBuilder` (DashboardCanvas + 우측 ChatPane) | — (`ui_builder_genui` 상속) | — |

**메뉴 분리 전략 (DB 기반)**: 앱 마이그레이션 `a006_ui_builder_menus.py` 가 `menu_items` 에 `app_id='v-ui-builder'` 행 3개를 INSERT 한다:
1. `ui_builder_sandpack` (path=`/`, icon=`Code2`) — Sandpack 프로젝트 메뉴
2. `ui_builder_genui` (path=`/genui`, icon=`Sparkles`) — Generative UI 프로젝트 메뉴
3. `menu_type='hide_shared'`, `permission_key='dashboard'` (is_active=FALSE, path=`__hidden__/...`) — 공통 대시보드 숨김 마커

각 페이지는 고유 `permission_key` 를 가져 권한 관리 매트릭스에서 개별 제어 가능. 공통 `dashboard` (app_id=NULL) 메뉴의 기존 RBAC 그룹 grants 는 마이그레이션에서 새 2행에 복사된다.

플랫폼 `permission_service._filter_shared_overridden` 가 두 가지 규칙으로 공통 메뉴를 숨긴다:
1. **오버라이드 규칙**: 같은 `permission_key` 의 app-specific entry 존재 시 공통 entry 제거
2. **hide_shared 마커 규칙**: `menu_type='hide_shared'` 행의 `permission_key` 와 일치하는 공통 entry 제거

v-ui-builder 는 **(2) 마커 규칙**을 사용해 공통 "대시보드" 를 숨긴다. 두 규칙 모두 다른 앱에서 재사용 가능한 패턴.

관련 플랫폼 마이그레이션: `p031_menu_unique_include_path.py` — `uq_menu_items_key_app` 를 path 포함으로 확장하여 같은 permission_key 가 다른 경로에 공존하도록 허용 (hide_shared 마커는 센티넬 path 로 실제 메뉴 행과 공존).

## 4. 디렉터리 맵

```
apps/v-ui-builder/
├── backend/
│   ├── app/
│   │   ├── main.py              # PlatformApp 진입점
│   │   ├── api/                 # P1.1: projects, messages, chat/stream 라우터
│   │   ├── models/              # ui_builder_projects/messages/artifacts
│   │   ├── schemas/             # Pydantic v2
│   │   ├── services/            # ProjectService, ChatService
│   │   └── llm/
│   │       ├── base.py          # BaseLLMProvider + LLMChunk
│   │       ├── registry.py      # Provider 선택 (env LLM_PROVIDER)
│   │       └── openai.py        # P1.1: OpenAI 구현
│   ├── migrations/
│   │   └── a001_create_ui_builder_tables.py
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx               # Sandpack 프로젝트 목록 (/)
    │   │   ├── Builder.tsx                 # Sandpack 3-pane IDE (/builder/:id)
    │   │   ├── GenUIProjects.tsx           # Generative UI 목록 (/genui)
    │   │   ├── GenUIBuilder.tsx            # Generative UI 쉘 (/genui/:id)
    │   │   └── Help.tsx
    │   ├── components/builder/
    │   │   ├── ChatPane.tsx                             # 공용 Chat (scope="project" | "dashboard")
    │   │   ├── {CodePane,PreviewPane}.tsx               # Sandpack 2-pane
    │   │   └── dashboard/
    │   │       └── DashboardCanvas.tsx                  # react-grid-layout 위젯 보드
    │   └── (Layout/ProtectedRoute/auth 등은 template 에서 복제)
    ├── Dockerfile.dev
    ├── package.json             # sandpack-react, monaco-editor
    ├── vite.config.ts           # HMR 5181, proxy → ui-builder-backend
    └── index.html
```

## 5. 의존성

**Backend (`requirements.txt`)** — P1.1 에서 주석 해제:
- `openai>=1.50.0` — OpenAI Provider
- `sse-starlette>=2.1.0` — SSE 스트리밍
- (옵션) `anthropic`, `google-generativeai` — Provider 확장

**Frontend (`package.json`)**:
- `@codesandbox/sandpack-react ^2.19.8` — 브라우저 번들러 / 미리보기
- `@monaco-editor/react ^4.6.0` — 코드 에디터
- `eventsource-parser ^1.1.2` — SSE 파서
- 나머지 `@v-platform/core` 공유 (Layout, auth, RBAC, UI Kit)

## 6. 작업 범위 가드레일

### 자유 수정 (app:v-ui-builder 안에서만)
- `apps/v-ui-builder/**` 전체
- `docusaurus/docs/design/V_UI_BUILDER_*.md`

### 사용자 승인 필요
- `docker-compose.yml` 의 `ui-builder-*` 섹션 추가/수정 (타 앱 섹션은 금지)
- `.env` 템플릿(`env.example`) 에 `OPENAI_API_KEY`, `LLM_PROVIDER` 추가
- 마이그레이션 신규 추가 (`a002_*.py` 이상)

### 금지
- `platform/**` 수정 (PlatformApp 개선이 필요하면 별도 PR 로 플랫폼 팀에 제안)
- 타 앱(`apps/v-channel-bridge`, `apps/v-platform-portal`, `apps/v-platform-template`) 파일 수정
- 플랫폼 테이블(`users`, `permissions`, `audit_log`, …) 스키마 변경 (※ `menu_items` 는 `app_id='v-ui-builder'` 범위 내 INSERT 만 허용 — 앱 전용 메뉴 등록 목적)
- `docker-compose.yml` 의 타 앱 / 공용 서비스(postgres, redis, mailhog) 섹션 편집

### 교차 영향 사전 체크리스트
- [ ] 변경이 `ui_builder_*` 테이블 / `ui_builder:*` Redis 키 범위 안인가?
- [ ] 포트 8004 / 5181 외의 포트 건드리지 않는가?
- [ ] PlatformApp 의 공용 인증/RBAC/감사 흐름을 손대지 않고 `register_app_routers()` 만 사용하는가?
- [ ] LLM 호출은 Provider 인터페이스(`BaseLLMProvider`) 를 경유하는가? (하드코딩 금지)

## 7. 개발 워크플로우

### 컨테이너 기동
```bash
# v-ui-builder 만
docker compose --profile ui-builder up -d --build

# 다른 앱과 함께 (예: 브리지 + ui-builder)
docker compose --profile ui-builder up -d --build
```

### 헬스체크 / 로그
```bash
curl -s http://127.0.0.1:8004/api/health | python3 -m json.tool
docker logs v-ui-builder-backend --tail=50
docker logs v-ui-builder-frontend --tail=50
```

### 마이그레이션 실행
```bash
docker exec v-ui-builder-backend python -c "from migrations.a001_create_ui_builder_tables import migrate; from platform_db import engine; migrate(engine)"
```
(실제 명령은 P1.1 PlatformApp startup 훅으로 자동화 예정)

### LLM Provider 교체
```bash
# .env
LLM_PROVIDER=openai        # openai | gemini | claude
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```
코드 변경 없이 Provider 전환.

### Provider Pattern 규칙
- 새 Provider 추가: `app/llm/<name>.py` 에 `BaseLLMProvider` 상속 → `registry.py` 등록
- 절대 `openai.ChatCompletion.create()` 같은 SDK 호출을 라우터/서비스에서 직접 쓰지 말 것
- `stream()` 은 `AsyncIterator[LLMChunk]` 만 반환 (artifact_start/delta/end/content/done)

## 8. 관련 문서

- 설계: `docusaurus/docs/design/V_UI_BUILDER_DESIGN.md`
- 플랫폼 컨벤션: `.claude/platform/CONVENTIONS.md`
- 공통 코딩 규칙: `.claude/shared/coding_conventions.md`
- 앱 분리 아키텍처: `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`
- Sandpack 라이선스 근거: `V_UI_BUILDER_DESIGN.md` §12 "결정 로그" 2026-04-18 항목

---

**문서 버전**: 0.3 (Phase 3 — 고유 permission_key + hide_shared 마커)
**최종 업데이트**: 2026-04-19
