# v-platform — Claude Code 플랫폼 스코프 설정
<!-- scope: platform -->

이 문서는 `platform/` 하위 작업(플랫폼 프레임워크 자체 수정)에만 적용됩니다. 루트 `CLAUDE.md`를 상위 컨텍스트로 함께 참조하세요.

**중요**: 플랫폼은 모든 앱이 공유하는 프레임워크입니다. 플랫폼 변경은 **모든 앱에 영향**을 주므로, 앱 기능으로 해결 가능한 경우 앱 스코프에서 먼저 시도하고, 정말 필요한 경우에만 플랫폼을 수정하세요.

## 1. 앱 정체성

- **역할**: v-project 생태계의 공통 프레임워크. 인증·RBAC·감사로그·조직도·설정·UI Kit 등 모든 앱이 재사용하는 범용 기능을 제공합니다. **자기 자신은 앱이 아니며**, 다른 앱이 `PlatformApp`을 생성해 사용합니다.
- **주요 기능**:
  - `PlatformApp` — FastAPI 앱 팩토리 (`init_platform()`, `register_app_routers()`)
  - 인증: JWT (python-jose) + bcrypt + SSO (Microsoft, Generic OIDC)
  - RBAC: PermissionGroup 기반 권한 모델
  - 감사로그: audit_logger / filters / export
  - 공유 서비스: websocket_manager, event_broadcaster, log_buffer, notification_service
  - 공유 UI Kit (`@v-platform/core`): 18개 페이지, 6개 스토어, 12개 훅, 65+ 컴포넌트
  - 멀티앱 분리: `app_id` 기반 메뉴/감사로그/설정
- **도메인 용어**:
  - **PlatformApp**: 앱 진입점 래퍼 클래스
  - **app_id**: 멀티앱 데이터 격리 키
  - **Platform page**: `@v-platform/core/pages/*` — 모든 앱이 공유하는 페이지
  - **app_menu_keys**: 앱이 사이드바에 표시할 플랫폼 메뉴 카테고리
- **아키텍처 패턴**:
  - Framework 패턴 — 앱이 플랫폼을 상속하지 않고 합성(composition)
  - HealthRegistry / 미들웨어 레지스트리 / 라우터 레지스트리로 확장
  - 플랫폼 마이그레이션은 `p*.py`, 앱 마이그레이션은 `a*.py`로 네임스페이스 분리

## 2. 기술 스택 특이사항

- **Python**: FastAPI, Pydantic v2, SQLAlchemy 2, python-jose, bcrypt, structlog, Prometheus client
- **TypeScript**: React 18 + Vite 라이브러리 빌드 (`@v-platform/core` npm 패키지로 배포)
- **DB**: PostgreSQL 전용 기능 의존 가능 (JSON, array 등)

## 3. 엔드포인트 및 포트

플랫폼 자체는 서비스를 기동하지 않음. 앱이 PlatformApp을 임베드하여 포트를 결정합니다. 플랫폼이 제공하는 공통 엔드포인트:

| 엔드포인트 | 용도 |
|---|---|
| `/api/auth/*` | JWT 로그인/갱신/로그아웃 |
| `/api/users/*` | 사용자 CRUD |
| `/api/permissions/*` | RBAC |
| `/api/audit/*` | 감사로그 |
| `/api/uploads/{purpose}/{id}` | DB BLOB 업로드 서빙 |
| `/api/health` | 헬스체크 (HealthRegistry) |
| `/api/ws` | WebSocket (websocket_manager) |
| `/api/notifications/*` | 시스템·앱 알림 |

## 4. 디렉터리 맵

```
platform/
├── backend/v_platform/              # Python 패키지 (앱이 import)
│   ├── app.py                       # ★ PlatformApp (프레임워크 진입점)
│   ├── core/                        # database, logging, exceptions
│   ├── models/                      # 14개 모델 (User, Permission, AuditLog, UploadedFile...)
│   ├── api/                         # 18개 라우터 + HealthRegistry
│   ├── services/                    # 14개 공통 서비스
│   ├── monitoring/                  # Prometheus 메트릭
│   ├── middleware/                  # CSRF, metrics
│   ├── sso/                         # Microsoft, Generic OIDC
│   ├── utils/                       # auth, audit_logger, encryption, filters
│   ├── schemas/                     # Pydantic 스키마
│   ├── seeds/                       # 초기 데이터 시드
│   └── migrations/                  # p001~pNNN 플랫폼 마이그레이션
└── frontend/v-platform-core/        # @v-platform/core npm 패키지
    └── src/
        ├── pages/                   # 18개 플랫폼 페이지
        ├── providers/PlatformProvider.tsx
        ├── api/, stores/, hooks/, components/, lib/
        └── index.ts                 # public export
```

## 5. 의존성

- **Platform 의존**: 없음 (자신이 최하위 프레임워크).
- **공유 인프라**: PostgreSQL, Redis (옵션 — event_broadcaster용), MailHog.
- **외부 서비스**: Microsoft Entra ID / Generic OIDC Provider (SSO 설정 시).

## 6. 작업 범위 가드레일

플랫폼 변경은 앱 변경보다 훨씬 높은 영향을 가지므로 엄격하게 취급합니다.

### ✅ 자유 수정 허용
- 내부 구현 리팩토링 (public API 호환 유지)
- 버그 수정, 타입 힌트 보강, 로깅 개선
- 새 페이지/훅/컴포넌트 **추가** (기존 것 변경이 아닌 addition)
- 플랫폼 마이그레이션 `p*.py` 추가 (멱등 필수)

### ⚠️ 사용자 승인 필요 (모든 앱 영향 가능)
- `PlatformApp` 생성자 시그니처 변경
- `v_platform.models.*` 스키마 breaking change
- `@v-platform/core` public export (`src/index.ts`) 제거/이름 변경
- 인증/JWT payload 구조 변경
- `app_menu_keys` 체계 변경
- `uploaded_files` 테이블 스키마 변경
- `HealthRegistry` / `event_broadcaster` / `websocket_manager` 인터페이스 변경

### ❌ 금지
- 앱 디렉터리(`apps/**`) 파일 수정 — 플랫폼 변경은 앱 코드 수정 없이 완결되어야 함
- 특정 앱에만 맞춘 하드코딩 로직 삽입 (예: `if app_name == 'v-channel-bridge'`)
- 하위 호환 없는 public API 제거 — deprecate 먼저

### 교차 영향 사전 체크리스트
1. 이 변경이 모든 앱(bridge/portal/template)에서 여전히 동작하는가?
2. public API (PlatformApp 시그니처, `@v-platform/core` exports, DB 스키마)의 하위 호환이 유지되는가?
3. 마이그레이션이 멱등(idempotent)이며 여러 번 실행해도 안전한가?
4. 프론트엔드 변경이 npm 패키지 빌드를 통해 앱에 자동 반영되는 경로를 이해하고 있는가?
5. 특정 앱 의존 로직이 누설되지 않았는가? (앱 이름·키에 분기 금지)

## 7. 플랫폼 고유 개발 워크플로우

**Python 수정 후** (모든 앱이 v_platform을 볼륨/이미지로 공유):
```bash
cd platform/backend && python -m ruff check --fix . && python -m ruff format .
# 앱들 전체 재빌드 필요
docker compose up -d --build
```

**TypeScript 수정 후** (`@v-platform/core` 빌드 필요):
```bash
cd platform/frontend/v-platform-core && npm run build
# 앱 프론트엔드 재빌드
docker compose up -d --build v-channel-bridge-frontend v-platform-portal-frontend v-platform-template-frontend
```

**마이그레이션 추가**:
- 파일명: `platform/backend/v_platform/migrations/p{NNN}_{description}.py`
- `def migrate(engine)` 함수 구현, 멱등 필수 (IF NOT EXISTS / 중복 체크)

## 8. 관련 문서 및 참조

- 공통 규칙: 루트 `CLAUDE.md`, `.claude/shared/coding_conventions.md`
- 플랫폼 전용 규칙(신규 앱 작성): `.claude/platform/CONVENTIONS.md`
- 분리 아키텍처 설계: `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`
- 마이그레이션 계획: `docusaurus/docs/platform/design/V_PROJECT_MIGRATION_PLAN.md`
- 플랫폼 API 레퍼런스: `docusaurus/docs/api/`
