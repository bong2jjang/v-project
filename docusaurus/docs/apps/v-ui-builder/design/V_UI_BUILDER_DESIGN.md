# v-ui-builder 설계 문서

**상태**: Draft v0.1  
**작성일**: 2026-04-18  
**작성자**: v-project 팀  
**영향 범위**: 새 앱 추가 (`apps/v-ui-builder/`) — 기존 앱 영향 없음

---

## 1. 목적 & 배경

### 1.1 만들려는 것
- **"대화로 UI를 만들고 즉시 확인하는 환경"**을 v-platform 기반 앱에 내장.
- 참조 경험: **Google Gemini Canvas**, **Claude Artifacts**, **Bolt.new**.
- v-project 사용자가 포털에서 `v-ui-builder`에 진입하여, LLM과 대화하면서 React 컴포넌트/페이지/프로토타입을 즉시 미리보기할 수 있도록 함.

### 1.2 왜 필요한가
- 현재 v-project는 플랫폼(인증/조직/감사) + Slack/Teams 브리지 중심. **"생산성 도구" 축**이 비어있음.
- 디자인/기획 리뷰, 내부 도구 프로토타입, 고객 데모 등 **즉시 돌아가는 UI**가 필요한 시나리오 지속 발생.
- ChatGPT Canvas/Claude Artifacts는 SaaS 외부 의존 → **사내 보안·감사 정책 안에서 같은 경험** 제공 필요.

### 1.3 Bolt.new에서 참고할 포인트
| 요소 | Bolt.new | v-ui-builder 채택 여부 |
|---|---|---|
| AI가 파일 시스템을 직접 조작 | ✅ | ✅ (구조만 모사, 구현은 Sandpack으로) |
| 브라우저 안에서 실행 | ✅ WebContainer | 🔄 Phase 1: Sandpack / Phase 3: WebContainer 검토 |
| 즉시 Preview | ✅ | ✅ |
| Terminal/Node 런타임 | ✅ | ❌ MVP에서는 React 런타임만 |
| 배포(Netlify/Vercel) 버튼 | ✅ | 🔄 Phase 2 이후 (사내 Git 저장만 먼저) |

---

## 2. 범위

### 2.1 MVP 범위 (Phase 1)
- 로그인한 사용자가 "Project"를 생성하고 LLM과 대화하며 **React + TypeScript 컴포넌트**를 생성.
- 생성된 코드는 **Sandpack**(클라이언트 iframe 번들러)으로 즉시 미리보기.
- 대화/파일/프로젝트는 `v_project` DB에 영구 저장.
- LLM 공급자는 **OpenAI**(기본) — 관리자가 설정으로 Gemini/Claude로 교체 가능(Provider Pattern).

### 2.2 MVP 제외
- Node 전체 런타임(Express 서버 등) — Sandpack React 템플릿만 지원.
- 파일 시스템 Terminal.
- 외부 배포(Netlify 등).
- 멀티 파일 드래그앤드롭 업로드.
- 공유 링크로 비로그인 사용자 접근.

### 2.3 성공 지표 (MVP)
- 사용자가 프롬프트 1회로 "버튼 컴포넌트" 생성 → 3초 이내 Preview 반영.
- Project 저장/불러오기/삭제 플로우가 5명 이상 내부 사용자에게서 무결함 확인.
- LLM 공급자 교체를 코드 수정 없이 설정 화면에서 수행 가능.

---

## 3. 아키텍처

### 3.1 전체 구조
```
┌─────────────────────────── 브라우저 (사용자) ───────────────────────────┐
│                                                                        │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────────────┐ │
│  │  Chat Pane  │   │  Code Pane  │   │  Preview Pane (Sandpack)     │ │
│  │  (LLM 대화) │ ↔ │ (Monaco)    │ ↔ │  <iframe bundlerURL=…>      │ │
│  └─────┬───────┘   └──────┬──────┘   └──────────────┬───────────────┘ │
│        │                  │                         │                   │
│        │            Zustand: project/artifacts      │                   │
│        ▼                                            ▼                   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  v-ui-builder Frontend (React + TanStack Query)                 │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                              │ HTTP/SSE                                 │
└──────────────────────────────┼─────────────────────────────────────────┘
                               ▼
┌──────────────────── v-ui-builder Backend (FastAPI) ─────────────────────┐
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ /api/projects   │  │ /api/chat       │  │ /api/artifacts       │   │
│  │ (CRUD)          │  │ (SSE stream)    │  │ (파일 조회/저장)     │   │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘   │
│           │                    │                      │                 │
│           ▼                    ▼                      ▼                 │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  LLM Provider Abstraction (base.py)                             │   │
│  │   ├─ OpenAIProvider (MVP 기본)                                  │   │
│  │   ├─ AnthropicProvider (Phase 2)                                │   │
│  │   └─ GeminiProvider (Phase 2)                                   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ PostgreSQL   │  │ Redis        │  │ v-platform (auth/rbac)    │   │
│  │ ui_builder_* │  │ stream cache │  │ JWT 검증 / 감사 기록      │   │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 레이어 설명
- **Frontend**: 3-pane IDE 유사 레이아웃. Chat에서 프롬프트 → Backend SSE 스트림 → Code/Preview 동시 갱신.
- **Backend**: `PlatformApp` 기반 FastAPI, 앱 전용 라우터를 `register_app_routers()`로 추가.
- **LLM Provider**: `BaseLLMProvider` 추상 클래스 + 환경변수/DB 설정으로 런타임 선택.
- **Sandbox**: Sandpack(React 템플릿)을 프론트 전용 의존으로 포함. 백엔드는 코드 실행 안 함.

### 3.3 주요 시퀀스 (신규 프롬프트)
```
사용자 입력 → POST /api/chat (SSE)
  ↓
Backend: LLMProvider.stream(prompt, history, file_context)
  ↓ (delta)
Backend SSE: {type: "content", delta: "..."}
  ↓
Frontend: 토큰 누적, 코드 블록 감지 시 artifact로 분리
  ↓
코드 블록 완료 시 → Sandpack <Sandpack> files prop 업데이트 → iframe 재번들
  ↓ (after stream end)
Frontend → POST /api/artifacts (현재 파일 스냅샷 저장)
```

---

## 4. 데이터 모델

모든 테이블 prefix: `ui_builder_*`. 공유 DB(`v_project`) 사용, 네임스페이스로 격리.

```sql
-- 프로젝트: 하나의 "대화로 만드는 앱" 단위
CREATE TABLE ui_builder_projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      INTEGER NOT NULL REFERENCES users(id),
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    template     VARCHAR(50) NOT NULL DEFAULT 'react-ts',  -- react-ts | vue | vanilla-ts
    llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',    -- openai | anthropic | gemini
    llm_model    VARCHAR(100),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 대화 메시지 (프롬프트/응답 히스토리)
CREATE TABLE ui_builder_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,   -- user | assistant | system
    content    TEXT NOT NULL,
    tokens_in  INTEGER,
    tokens_out INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 아티팩트: 생성된 파일 스냅샷 (버전별)
CREATE TABLE ui_builder_artifacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
    file_path   VARCHAR(500) NOT NULL,  -- 예: /src/App.tsx
    content     TEXT NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, file_path, version)
);

CREATE INDEX idx_ui_builder_messages_project ON ui_builder_messages(project_id, created_at);
CREATE INDEX idx_ui_builder_artifacts_project ON ui_builder_artifacts(project_id, file_path, version DESC);
```

**마이그레이션**: `apps/v-ui-builder/backend/migrations/a001_create_tables.py` (멱등).

---

## 5. API 설계

Base: `/api` (v-platform 관례 유지)

| Method | Path | 설명 | 응답 |
|---|---|---|---|
| POST | `/api/projects` | 프로젝트 생성 | `ProjectResponse` |
| GET | `/api/projects` | 내 프로젝트 목록 | `list[ProjectResponse]` |
| GET | `/api/projects/{id}` | 단건 + 최신 아티팩트 | `ProjectDetailResponse` |
| PATCH | `/api/projects/{id}` | 이름/설정 변경 | `ProjectResponse` |
| DELETE | `/api/projects/{id}` | 삭제 | 204 |
| GET | `/api/projects/{id}/messages` | 대화 히스토리 | `list[Message]` |
| POST | `/api/chat` | 프롬프트 전송(SSE 스트림) | `text/event-stream` |
| GET | `/api/projects/{id}/artifacts` | 현재 파일 트리 | `list[Artifact]` |
| POST | `/api/projects/{id}/artifacts` | 파일 저장(덮어쓰기, version+1) | `Artifact` |
| GET | `/api/llm/providers` | 사용 가능한 LLM 공급자 목록 | `list[ProviderInfo]` |
| POST | `/api/llm/test` | API 키 유효성 확인 (관리자) | `{ok: bool}` |

**SSE 이벤트 포맷** (`/api/chat`):
```
event: content
data: {"delta": "텍스트 조각"}

event: artifact_start
data: {"file_path": "/src/Button.tsx"}

event: artifact_delta
data: {"file_path": "/src/Button.tsx", "delta": "export const..."}

event: artifact_end
data: {"file_path": "/src/Button.tsx"}

event: done
data: {"message_id": "uuid"}
```

---

## 6. LLM Provider Pattern

### 6.1 설계 원칙
- **OpenAI 시작 → 다른 공급자 교체를 코드 수정 없이** 가능하도록 설계.
- v-channel-bridge의 `BasePlatformProvider` 패턴을 **LLM 축**으로 재적용.

### 6.2 추상 인터페이스
```python
# apps/v-ui-builder/backend/app/llm/base.py
from abc import ABC, abstractmethod
from typing import AsyncIterator

class LLMChunk(BaseModel):
    kind: Literal["content", "artifact_start", "artifact_delta", "artifact_end"]
    delta: str | None = None
    file_path: str | None = None

class BaseLLMProvider(ABC):
    @abstractmethod
    async def stream(
        self,
        messages: list[ChatMessage],
        system_prompt: str,
        file_context: list[Artifact],
        model: str | None = None,
    ) -> AsyncIterator[LLMChunk]:
        ...

    @abstractmethod
    async def validate_credentials(self) -> bool:
        ...
```

### 6.3 Provider Registry
```python
# apps/v-ui-builder/backend/app/llm/registry.py
_providers: dict[str, type[BaseLLMProvider]] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,  # Phase 2
    "gemini": GeminiProvider,        # Phase 2
}

def get_provider(name: str) -> BaseLLMProvider:
    api_key = SystemSettings.get(f"ui_builder.{name}.api_key")
    return _providers[name](api_key=api_key)
```

### 6.4 설정 저장
- API Key / 기본 모델은 `system_settings` 테이블에 `ui_builder.openai.api_key` 형태로 저장.
- 암호화: v-platform의 `ENCRYPTION_KEY`를 사용 (기존 Teams 토큰 저장 패턴 동일).

---

## 7. Sandbox 전략 (Phase별)

### 7.1 Phase 1 — Sandpack (MVP)
- 패키지: `@codesandbox/sandpack-react` (Apache 2.0)
- 템플릿: `react-ts` 고정
- 번들러: **기본값 = CodeSandbox 호스팅(`sandpack-bundler.codesandbox.io`)**
- **주의**: 사용자 코드가 외부 서버(CodeSandbox)로 전송됨. 내부 POC/저민감도 환경 한정.
- 비용: 0원

### 7.2 Phase 2 — sandpack-bundler 셀프호스팅
- 트리거: 사내 기밀/고객 데이터가 코드에 포함될 가능성 생긴 시점.
- 작업: `sandpack-bundler` OSS 정적 빌드 → v-project 인프라에서 서빙 → `bundlerURL` prop으로 연결.
- Docker 서비스 추가 예정: `v-ui-builder-sandbox` (nginx 정적 호스팅).
- 비용: 0원 (OSS + 자사 인프라)

### 7.3 Phase 3 — 풀 Node 런타임 (선택)
- 트리거: Express/Next.js SSR, Terminal, 실제 `npm install` 필요 시점.
- 옵션:
  - **Nodebox**: Sandpack 2.0 번들, **EULA 제약** — 상용 사용 주의. 법무 검토 필요.
  - **WebContainer API (StackBlitz)**: 상용 프로덕션 유료 라이선스 필수, Enterprise는 자체 호스팅 가능. 파트너십/가격 협상 필요.
- 결정 기준: 사용자가 실제로 Node 서버를 원하는지 사용 데이터 확인 후 결정.

### 7.4 보안 체크리스트 (Phase 1 배포 전)
- [ ] 생성 코드에 PII/시크릿이 포함될 수 있음을 사용자 고지 (UI 배너).
- [ ] `sandpack-bundler.codesandbox.io`로의 외부 전송을 보안 정책서에 등재.
- [ ] 감사 로그: 프로젝트 생성/삭제/LLM 호출 v-platform `audit_log`에 기록.
- [ ] Rate limit: 사용자당 LLM 호출 시간당 60회 (slowapi).

---

## 8. 프론트엔드 구조

```
apps/v-ui-builder/frontend/src/
├── App.tsx                         # 플랫폼 라우트 + /builder 앱 라우트
├── pages/
│   ├── Dashboard.tsx               # 프로젝트 목록 + 신규 버튼
│   ├── Builder.tsx                 # 3-pane IDE (Chat | Code | Preview)
│   └── Settings.tsx                # LLM 공급자/API Key 설정 (관리자만)
├── components/
│   ├── builder/
│   │   ├── ChatPane.tsx
│   │   ├── CodePane.tsx            # Monaco Editor
│   │   ├── PreviewPane.tsx         # <SandpackProvider> wrapper
│   │   └── FileTree.tsx
│   └── ...플랫폼 UI Kit (템플릿 복사)
├── hooks/
│   ├── useBuilderStream.ts         # SSE 스트림 hook
│   └── useSandpackFiles.ts         # files state ↔ Sandpack 동기화
├── store/
│   └── builder.ts                  # 현재 프로젝트/파일/메시지 상태
└── lib/
    └── llm/sseClient.ts            # SSE 파서
```

**추가 npm 의존성**:
- `@codesandbox/sandpack-react` (^2.x)
- `@monaco-editor/react` (^4.x)
- `eventsource-parser` (SSE 파싱)

---

## 9. 포트 / 인프라 배정

| 항목 | 값 |
|---|---|
| Backend 호스트 포트 | **8004** (컨테이너 8000) |
| Frontend 호스트 포트 | **5181** (컨테이너 5173) |
| 컨테이너명 | `v-ui-builder-backend`, `v-ui-builder-frontend` |
| Docker Compose profile | `ui-builder` |
| DB | 공유 `v_project`, 테이블 prefix `ui_builder_*` |
| Redis namespace | `ui_builder:*` (세션 캐시/스트림 상태) |
| Migration prefix | `a001_*.py` (앱 로컬 네임스페이스) |
| Portal 등록 | `PORTAL_APPS` 환경변수에 추가 예정 (Phase 1 후반) |

**기동**: `docker compose --profile ui-builder up -d --build`

---

## 10. 로드맵

| Phase | 기간(추정) | 산출물 |
|---|---|---|
| **P1.0 스캐폴드** | 0.5일 | 앱 디렉터리, CLAUDE.md, compose 프로필, 기동 확인 |
| **P1.1 백엔드 핵심** | 2일 | DB 모델/마이그레이션, Projects CRUD, LLM Provider(OpenAI), SSE `/api/chat` |
| **P1.2 프론트 3-pane** | 3일 | Dashboard, Builder 페이지, Sandpack 통합, Monaco, SSE 수신 |
| **P1.3 아티팩트 저장** | 1일 | 파일 버저닝, 불러오기, 감사 로그 |
| **P1.4 LLM 설정 UI** | 1일 | 관리자 설정 화면, API Key 암호화 저장 |
| **P1.5 베타 출시** | 0.5일 | 포털 등록, 사용자 5명 내부 사용 |
| P2 | 추후 | Anthropic/Gemini Provider, sandpack-bundler 셀프호스팅 |
| P3 | 추후 | WebContainer/Nodebox 검토, 배포 통합 |

---

## 11. 리스크 & 완화

| 리스크 | 영향 | 완화책 |
|---|---|---|
| CodeSandbox 공개 번들러 의존 (외부 전송) | 보안/컴플라이언스 | Phase 2 셀프호스팅 조기 진행, MVP는 내부 POC로 한정 |
| LLM API 비용 예측 불가 | 예산 초과 | 사용자당 Rate limit, 월 예산 알림, 관리자 사용량 대시보드 |
| 생성 코드 보안 (악성 패키지 import) | 사용자 브라우저 내 XSS | Sandpack iframe은 기본 샌드박싱, `esm.sh` 화이트리스트 설정 검토 |
| Monaco + Sandpack + React 18 번들 크기 | 초기 로딩 지연 | 코드 스플리팅(`React.lazy`), Builder 페이지는 lazy route |
| LLM Provider 교체 시 프롬프트 호환성 | 품질 회귀 | Provider별 시스템 프롬프트 튜닝, Provider마다 골든 테스트 세트 |
| WebContainer/Nodebox 라이선스 | 상용 비용/제약 | Phase 3 결정 전 법무 검토 + 비용 대비 효과 측정 |

---

## 12. 타 앱 영향 분석

| 영역 | 영향 | 조치 |
|---|---|---|
| `platform/**` | ❌ 수정 없음 | PlatformApp 사용만 |
| `apps/v-channel-bridge/**` | ❌ | 독립 컨테이너 |
| `apps/v-platform-portal/**` | 🔄 `PORTAL_APPS` env에 1줄 추가 (Phase 1.5) | 사용자 승인 필요 |
| `apps/v-platform-template/**` | ❌ | 복사 출발점으로만 사용 |
| `docker-compose.yml` | 🔄 `ui-builder` 프로필 블록 추가 | 사용자 승인 필요 |
| DB 스키마 | ✅ `ui_builder_*` 신규 테이블만 | 공통 테이블 건드리지 않음 |
| Redis | ✅ `ui_builder:*` 네임스페이스만 | 충돌 없음 |

**결론**: 신규 테이블/컨테이너/프로필만 추가. 기본 `docker compose up -d`에는 포함되지 않으므로 기존 앱은 무영향.

---

## 13. 결정 로그

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-04-18 | 앱 이름 `v-ui-builder` 확정 | 사용자 승인 |
| 2026-04-18 | MVP 샌드박스 = Sandpack | Apache 2.0 상용 무료, 즉시 구축 가능 |
| 2026-04-18 | Nodebox 회피 | EULA 상용 제약 |
| 2026-04-18 | WebContainer는 Phase 3 이후 | 상용 유료 라이선스 필요 |
| 2026-04-18 | MVP LLM = OpenAI, Provider Pattern 필수 | 사용자 요구 (교체 가능성) |
| 2026-04-18 | 포트 8004/5181, profile `ui-builder` | 기존 포트 충돌 회피 |

---

## 14. 참고 문서

- `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`
- `docusaurus/docs/design/MULTI_APP_CLAUDE_CONFIG_DESIGN.md`
- `.claude/platform/CONVENTIONS.md` — 새 앱 작성 규칙
- Sandpack: https://sandpack.codesandbox.io/
- Bolt.new 오픈소스: https://github.com/stackblitz/bolt.new
- WebContainer API 라이선스: https://webcontainers.io/
