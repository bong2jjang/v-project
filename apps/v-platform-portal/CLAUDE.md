# v-platform-portal — Claude Code 앱 스코프 설정
<!-- scope: app:v-platform-portal -->

이 문서는 `apps/v-platform-portal/` 하위 작업에만 적용됩니다. 루트 `CLAUDE.md`와 `platform/CLAUDE.md`를 상위 컨텍스트로 함께 참조하세요.

## 1. 앱 정체성

- **역할**: v-platform 생태계의 통합 포탈. 모든 앱의 런처·SSO 진입점·사이트맵·앱 관리(CRUD)를 제공합니다.
- **주요 기능**:
  - AppRegistry — 앱 메타데이터(name/url/icon/description) 관리 (DB-backed CRUD)
  - Token Relay SSO — 포털 로그인 후 앱별 JWT 자동 발급/전달
  - App Launcher — 권한 기반 앱 타일 그리드
  - 사이트맵 / 통합 검색 / 앱별 대시보드 aggregation
  - 앱별 알림 관리 UI, 앱별 맞춤 투어(Driver.js)
- **도메인 용어**:
  - **PortalApp**: 등록된 앱 레코드 (앱 ID, 런처 URL, 아이콘, 활성 상태)
  - **Token Relay**: 포털 JWT → 앱 JWT로 재서명하여 전달하는 SSO 방식
  - **App Seeding**: `PORTAL_APPS` 환경변수로 초기 DB 시드 (이후 UI 관리)
- **아키텍처 패턴**:
  - Registry 패턴 — `app_registry.reload_from_db()`로 메모리 캐시
  - 얇은 앱 (backend는 PlatformApp + portal 라우터 1개)
  - 프론트엔드가 주력 (런처·관리 UI 중심)

## 2. 기술 스택 특이사항

- 플랫폼 공통 스택 외 추가 없음. (포털은 백엔드가 얇은 구조)
- SSO Relay에서 JWT 재서명 시 `v_platform.utils.auth` 재사용

## 3. 엔드포인트 및 포트

| 서비스 | 내부 포트 | 호스트 포트 | 비고 |
|---|---|---|---|
| Backend | 8000 | 8080 | FastAPI |
| Frontend | 5173 | 5180 | Vite |
| Portal API | 8080 | 8080 | `/api/portal/*` |

## 4. 디렉터리 맵

```
apps/v-platform-portal/
├── backend/
│   ├── app/
│   │   ├── main.py                  # PlatformApp + portal_router
│   │   ├── api/portal.py            # 포털 전용 API (앱 목록, SSO Relay)
│   │   ├── models/portal_app.py     # PortalApp 모델
│   │   └── services/app_registry.py # 시드 + 메모리 캐시
│   └── migrations/                  # a*.py — 포털 전용 마이그레이션
└── frontend/src/
    ├── pages/
    │   ├── Portal.tsx               # 런처 메인
    │   ├── Help.tsx
    │   └── admin/                   # AppManagement, NotificationManagement
    ├── hooks/useTour.ts             # 포털 맞춤 투어
    └── lib/                         # 포털 API 클라이언트, 투어 스텝
```

## 5. 의존성

- **Platform 의존**: PlatformApp 전체, `v_platform.utils.auth` (JWT Relay), `v_platform.services.event_broadcaster`.
- **공유 인프라**: PostgreSQL 동일 DB (`portal_apps` 테이블 소유).
- **다른 앱에 대한 의존**: 앱 실행은 포털이 몰라도 됨 — URL만 참조. 단, Token Relay 대상 앱은 같은 `SECRET_KEY`를 공유해야 JWT 검증 가능.

## 6. 작업 범위 가드레일

### ✅ 자유 수정 허용
- `apps/v-platform-portal/backend/app/**`
- `apps/v-platform-portal/frontend/src/**`
- `apps/v-platform-portal/backend/migrations/a*.py`
- PortalApp 스키마 변경(컬럼 추가) — 단 마이그레이션 동반

### ⚠️ 사용자 승인 필요
- Token Relay JWT payload 구조 변경 — 모든 앱 영향
- `portal_apps` 테이블 스키마의 breaking change
- SSO 콜백 URL 규약 변경
- `docker-compose.yml`의 portal 프로필 설정 변경

### ❌ 금지
- `platform/**` 직접 수정
- 타 앱 디렉터리 (`apps/v-channel-bridge/`, `apps/v-platform-template/`) 수정
- 타 앱의 JWT 서명 키를 공유하지 않는 방식으로 변경 (SSO Relay 중단됨)

### 교차 영향 사전 체크리스트
1. Token Relay payload(`sub`, `email`, `role`, `app_id`) 구조를 유지했는가?
2. `SECRET_KEY` 기반 JWT 검증이 모든 앱에서 동작하는가?
3. 앱 목록 변경이 DB-backed (UI)를 통해 이뤄졌는가? (env 직접 수정 금지)
4. `/api/portal/apps` 응답 스키마가 프론트엔드 계약을 깨지 않았는가?
5. 포털 사이드바/메뉴가 다른 앱의 메뉴 분류(`app_menu_keys`)와 충돌하지 않는가?

## 7. 앱 고유 개발 워크플로우

```bash
# 포털 프로필로 기동
docker compose --profile portal up -d --build

# Backend 개별 재빌드
docker compose --profile portal up -d --build v-platform-portal-backend

# Frontend 개별 재빌드
docker compose --profile portal up -d --build v-platform-portal-frontend

# Lint
cd apps/v-platform-portal/backend && python -m ruff check --fix . && python -m ruff format .
cd apps/v-platform-portal/frontend && npm run lint:fix && npm run format
```

**접속**: http://127.0.0.1:5180 — 로그인 후 런처에서 다른 앱으로 SSO 이동 확인.

## 8. 관련 문서 및 참조

- 공통 규칙: 루트 `CLAUDE.md`, `.claude/shared/coding_conventions.md`
- 플랫폼 규칙: `platform/CLAUDE.md`
- 아키텍처: `docusaurus/docs/apps/` (포털 섹션), `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`
