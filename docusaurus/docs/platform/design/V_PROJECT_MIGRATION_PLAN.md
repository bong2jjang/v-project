# v-project: Platform/App 분리 마이그레이션 계획서

> **문서 버전**: 2.0  
> **작성일**: 2026-04-11  
> **상태**: ✅ 전체 완료 (Phase 0~5 + 포털/알림/투어)  
> **기반 문서**: `PLATFORM_APP_SEPARATION_ARCHITECTURE.md`  
> **프로젝트 이름 매핑**:

| 구분 | 기존 (모놀리스) | 신규 (분리 후) |
|------|----------------|---------------|
| 프로젝트 | VMS Channel Bridge | **v-project** |
| 플랫폼 레이어 | (없음 — 혼재) | **v-platform** |
| 앱 레이어 | (없음 — 혼재) | **v-channel-bridge** |
| GitHub 리포 | bong2jjang/vms-channel-bridge | **bong2jjang/v-project** |
| Python 패키지 | (없음) | **v_platform** |
| npm 패키지 | (없음) | **@v-platform/core** |
| DB 이름 | vms_channel_bridge | **v_project** |

---

## 전체 작업 로드맵

```
Phase 0  컨텍스트 정비 (CLAUDE.md, .claude/)        ✅ 완료
Phase 1  경계 정의 + import 정리                     ✅ 완료
Phase 2  Backend 플랫폼 추출 (v-platform)            ✅ 완료
Phase 3  Frontend 플랫폼 추출 (@v-platform/core)     ✅ 완료
Phase 4  인프라 분리 (Docker, 마이그레이션, CI)       ✅ 완료
Phase 5  검증 및 안정화                               🔄 진행 중
```

---

## Phase 0: 컨텍스트 정비

> **목적**: 이후 모든 작업에서 Claude Code가 올바른 프로젝트 컨텍스트를 참조하도록 기반 정리  
> **범위**: CLAUDE.md, .claude/ 하위 전체, README.md

### 0-1. CLAUDE.md 전면 개편

| 변경 항목 | 상세 |
|-----------|------|
| 프로젝트 개요 | "VMS Channel Bridge" → "v-project" / 플랫폼-앱 분리 아키텍처 설명 추가 |
| 시스템 상태 표 | 현재 Phase 0 상태 반영, 분리 진행도 표시 |
| 프로젝트 구조 | 모놀리스 구조 → `v-platform/` + `v-channel-bridge/` 목표 구조 병기 |
| Docker 명령어 | 컨테이너명 `vms-channel-bridge-*` → `v-project-*` 로 변경 예고 |
| 환경 변수 | DB명 `vms_channel_bridge` → `v_project` 변경 예고 |
| 커밋 규칙 scope | `adapters`, `docs` → `v-platform`, `v-channel-bridge`, `migration` 추가 |

### 0-2. .claude/ 파일 일괄 업데이트

#### Agents (6개 파일)
| 파일 | 변경 내용 |
|------|----------|
| `agent-coach.md` | "VMS Channel Bridge" → "v-project", Light-Zowe 참조 정리 |
| `code-standards-enforcer.md` | 프로젝트명 + 아키텍처명 변경 |
| `docker-expert.md` | 프로젝트명 변경, 컨테이너명 매핑 추가 |
| `migration-helper.md` | Light-Zowe 완성 → v-platform 분리 컨텍스트로 전환 |
| `pr-update-expert.md` | 프로젝트명 + 설명 변경 |
| `search-optimizer.md` | 프로젝트명 변경 |

#### Commands (10개 파일)
| 파일 | 변경 내용 |
|------|----------|
| `check_sync_status.md` | 레거시 브리지 참조 제거, 현재 아키텍처로 정리 |
| `deploy_check.md` | 레거시 브리지 제거 검증 섹션 삭제, 플랫폼/앱 분리 배포 체크로 교체 |
| `docker_troubleshoot.md` | 컨테이너명 업데이트 |
| `enforce_standards.md` | 변경 최소 (규칙 자체는 유지) |
| `gh_issue_solve.md` | 변경 최소 |
| `migration_status.md` | Light-Zowe 마이그레이션 → v-platform 분리 진행도로 전환 |
| `provider_health.md` | Light-Zowe 참조 제거 |
| `test_provider.md` | Light-Zowe 참조 제거 |
| `token_tips.md` | 변경 없음 |
| `write_pr_summary.md` | 변경 없음 |

#### Skills (5개 파일)
| 파일 | 변경 내용 |
|------|----------|
| `backup-config.md` | 레거시 TOML 설정 참조 제거 |
| `add-route-rule.md` | 변경 최소 |
| `scaffold-provider.md` | 변경 최소 |
| `sync-docs.md` | 변경 최소 |
| `validate-common-schema.md` | 변경 최소 |

#### Root 설정 파일
| 파일 | 변경 내용 |
|------|----------|
| `coding_conventions.md` | "VMS Channel Bridge" → "v-project", Light-Zowe → v-platform 용어 전환 |
| `dev_workflow.md` | 프로젝트명 전환, Docker 명령어 매핑 |
| `documentation-rules.md` | 프로젝트명 변경 |
| `settings.json` | 경로 `vms-channel-bridge` → `v-project` |

### 0-3. README.md 업데이트

- 프로젝트명, 설명, 뱃지 변경
- 아키텍처 개요 (v-platform + v-channel-bridge) 추가
- 환경변수 예시의 DB명 등 변경

### 0-4. .env.example 업데이트

- `DATABASE_URL`의 DB명 `vms_channel_bridge` → `v_project`
- 주석에서 프로젝트명 변경

---

## Phase 1: 경계 정의

> **목적**: 코드 변경 없이 플랫폼/앱 경계를 명확히 정의하고, 이동을 위한 준비 작업

### 1-1. Base 클래스 독립 추출

```
현재: apps/v-channel-bridge/backend/app/models/__init__.py 에 Base 정의 (모든 모델이 참조)
목표: apps/v-channel-bridge/backend/app/models/base.py 로 분리 → 나중에 v-platform으로 이동 용이
```

### 1-2. 순환 의존성 분석 및 제거

- `models/` 간 상호 import 분석
- `services/` → `models/` 참조 방향 정리
- 앱 코드에서 플랫폼 코드로의 직접 참조 식별

### 1-3. Import 경계 문서화

아키텍처 문서의 분류표를 기준으로 각 모듈에 주석 마킹:

```python
# [v-platform] 인증 서비스
class TokenService:
    ...

# [v-channel-bridge] 메시지 브리지
class WebSocketBridge:
    ...
```

### 1-4. 마이그레이션 SQL 분류

```
플랫폼 마이그레이션 (17개): users, RBAC, organizations, menus, audit, ...
앱 마이그레이션 (5개): messages, accounts, delivery, ...
```

파일명에 접두어 부여: `p001_*.sql` (platform), `a001_*.sql` (app)

---

## Phase 2: Backend 플랫폼 추출 (v-platform)

> **목적**: 플랫폼 코드를 `platform/backend/v_platform/` 패키지로 추출

### 2-1. 디렉토리 구조 생성

```
platform/
└── backend/
    ├── v_platform/
    │   ├── __init__.py          # PlatformApp 클래스
    │   ├── core/
    │   │   ├── config.py        # PlatformConfig
    │   │   ├── database.py      # DB 엔진, 세션
    │   │   ├── security.py      # JWT, bcrypt, Fernet
    │   │   └── exceptions.py    # 공통 예외
    │   ├── models/              # 플랫폼 모델 10개
    │   ├── schemas/             # 플랫폼 스키마
    │   ├── api/                 # 플랫폼 라우터 15개
    │   ├── services/            # 플랫폼 서비스 7개
    │   ├── middleware/          # CSRF, Metrics
    │   ├── sso/                 # SSO 프로바이더
    │   ├── utils/               # auth, audit_logger, encryption
    │   └── migrations/          # 플랫폼 마이그레이션
    ├── pyproject.toml
    └── requirements.txt
```

### 2-2. 이동 순서 (의존성 방향 순)

```
Step 1: models/base.py (Base 클래스)
Step 2: core/ (config, database, security, exceptions)
Step 3: models/ (플랫폼 모델 10개)
Step 4: utils/ (auth, audit_logger, encryption)
Step 5: services/ (플랫폼 서비스 7개)
Step 6: schemas/ (플랫폼 스키마)
Step 7: api/ (플랫폼 라우터 15개)
Step 8: middleware/, sso/
```

### 2-3. PlatformApp 클래스 구현

```python
# platform/backend/v_platform/__init__.py
from v_platform.core.config import PlatformConfig, PlatformFeatures

class PlatformApp:
    def __init__(self, config: PlatformConfig):
        self.config = config
        self.fastapi = FastAPI(title=config.app_name, lifespan=self._lifespan)
        self._setup_middleware()
        self._register_platform_routers()

    def register_app_routers(self, *routers):
        for router in routers:
            self.fastapi.include_router(router)
```

### 2-4. 앱 main.py 리팩토링

```python
# apps/v-channel-bridge/apps/v-channel-bridge/backend/app/main.py (v-channel-bridge 진입점)
from v_platform import PlatformApp, PlatformConfig

config = PlatformConfig(
    app_name="v-channel-bridge",
    database_url=os.getenv("DATABASE_URL"),
    redis_url=os.getenv("REDIS_URL"),
    secret_key=os.getenv("SECRET_KEY"),
)

platform = PlatformApp(config)

from app.api import bridge, messages, accounts_crud, teams_webhook
platform.register_app_routers(
    bridge.router, messages.router,
    accounts_crud.router, teams_webhook.router,
)

app = platform.fastapi
```

---

## Phase 3: Frontend 플랫폼 추출 (@v-platform/core)

> **목적**: 플랫폼 UI 코드를 `platform/frontend/` 패키지로 추출

### 3-1. 디렉토리 구조 생성

```
platform/
└── frontend/
    └── v-platform-core/
        ├── package.json           # @v-platform/core
        ├── src/
        │   ├── index.ts           # 전체 re-export
        │   ├── api/               # API 클라이언트 + 플랫폼 API
        │   ├── stores/            # auth, permission, notification, ...
        │   ├── hooks/             # useTheme, useTokenExpiry, ...
        │   ├── components/
        │   │   ├── ui/            # 디자인 시스템 (17개)
        │   │   ├── layout/        # Sidebar, TopBar, ContentHeader
        │   │   ├── auth/          # SSO, TokenExpiry
        │   │   └── notifications/
        │   ├── lib/               # navigation, utils
        │   ├── types/             # 공통 타입
        │   └── styles/            # CSS 변수, Tailwind 프리셋
        └── tsconfig.json
```

### 3-2. 이동 순서

```
Step 1: types/ (공통 타입 정의)
Step 2: api/client.ts (Axios 인스턴스 + 인터셉터)
Step 3: api/ (플랫폼 API 모듈 8개)
Step 4: stores/ (플랫폼 Zustand 스토어 5개)
Step 5: hooks/ (플랫폼 훅)
Step 6: components/ui/ (디자인 시스템 17개)
Step 7: components/layout/ (레이아웃 8개)
Step 8: PlatformProvider 구현
```

### 3-3. PlatformProvider 구현

```tsx
// platform/frontend/v-platform-core/src/providers/PlatformProvider.tsx
export function PlatformProvider({ config, children }) {
  return (
    <PlatformConfigContext.Provider value={config}>
      <ThemeProvider>
        <AuthProvider>
          <PermissionProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </PermissionProvider>
        </AuthProvider>
      </ThemeProvider>
    </PlatformConfigContext.Provider>
  );
}
```

### 3-4. 앱 App.tsx 리팩토링

```tsx
// apps/v-channel-bridge/frontend/src/App.tsx (v-channel-bridge)
import { PlatformProvider, ProtectedRoute, Layout } from '@v-platform/core';
import { Channels } from './pages/Channels';
import { Messages } from './pages/Messages';

function App() {
  return (
    <PlatformProvider config={{ apiBaseUrl: '...', appName: 'v-channel-bridge' }}>
      <Layout>
        <Routes>
          <Route path="/channels" element={<ProtectedRoute><Channels /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        </Routes>
      </Layout>
    </PlatformProvider>
  );
}
```

---

## Phase 4: 인프라 분리

### 4-1. Docker Compose

| 변경 항목 | Before | After |
|-----------|--------|-------|
| 컨테이너명 | `vms-channel-bridge-backend` | `v-project-backend` |
| 컨테이너명 | `vms-channel-bridge-frontend` | `v-project-frontend` |
| 네트워크 | `vms-channel-bridge-network` | `v-project-network` |
| DB 이름 | `vms_channel_bridge` | `v_project` |
| DB 사용자 | `vmsuser` | 유지 또는 변경 |
| 빌드 경로 | `backend/` 단일 | `platform/backend/` + `backend/` |

### 4-2. 마이그레이션 러너 이원화

```python
def run_migrations(engine):
    run_directory(engine, "v_platform/migrations/", prefix="p")  # 플랫폼 먼저
    run_directory(engine, "app/migrations/", prefix="a")          # 앱 이후
```

### 4-3. 환경 변수 분류

```bash
# 플랫폼 (v-platform)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=...
SMTP_HOST=...

# 앱 (v-channel-bridge)
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
TEAMS_TENANT_ID=...
TEAMS_APP_ID=...
TEAMS_APP_PASSWORD=...
```

---

## Phase 5: 검증 및 안정화

### 5-1. 테스트 검증

- [ ] 플랫폼 단위 테스트 통과 (인증, RBAC, 감사)
- [ ] 앱 단위 테스트 통과 (브리지, 프로바이더, 라우팅)
- [ ] 통합 테스트 통과 (플랫폼 + 앱 조합)
- [ ] Frontend 빌드 + 테스트 통과

### 5-2. 독립 사용 검증

- [ ] v-platform만 import하여 빈 앱 부팅 테스트
- [ ] v-platform + 새 더미 앱으로 라우터 등록 테스트

### 5-3. 문서 최종 업데이트

- [ ] CLAUDE.md 최종 버전 (분리 완료 상태 반영)
- [ ] README.md (설치/실행 가이드 업데이트)
- [ ] Docusaurus 문서 동기화

---

## 수량 요약 (계획 → 최종)

> 아래는 마이그레이션 계획 시점의 예상치입니다. 최종 실제 수량은 CLAUDE.md를 참조하세요.
> **최종 상태 (2026-04-13)**: v-platform 18 라우터, 14 모델, 14 서비스, 24 마이그레이션

| 항목 | v-platform으로 이동 | v-channel-bridge에 잔류 | 계획 합계 |
|------|---------------------|------------------------|----------|
| Backend API 라우터 | 15개 | 8개 | 23개 |
| Backend 모델 | 10개 | 3개 | 13개 |
| Backend 서비스 | 7개 | 10개 | 17개 |
| DB 마이그레이션 | 17개 | 5개 | 22개 |
| Frontend 스토어 | 5개 | 5개 | 10개 |
| Frontend API 모듈 | 8개 | 5개 | 13개 |
| Frontend UI 컴포넌트 | 17개 | 0개 | 17개 |
| Frontend 레이아웃 | 8개 | 0개 | 8개 |
| Frontend 앱 컴포넌트 | 0개 | ~40개 | ~40개 |

**v-platform = 전체 코드의 ~55-60%**

---

## 작업 순서 요약

```
[Phase 0] 컨텍스트 정비 ──→ 커밋
    ↓
[Phase 1] 경계 정의 ──→ 커밋
    ↓
[Phase 2] Backend v-platform 추출 ──→ 커밋 (Step별)
    ↓
[Phase 3] Frontend @v-platform/core 추출 ──→ 커밋 (Step별)
    ↓
[Phase 4] 인프라 분리 ──→ 커밋
    ↓
[Phase 5] 검증 + 문서 ──→ 최종 커밋
```

**다음 액션**: Phase 0 착수 (CLAUDE.md + .claude/ 업데이트)
