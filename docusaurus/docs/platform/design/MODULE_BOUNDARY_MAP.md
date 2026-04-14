# 모듈 경계 맵

> v-platform(플랫폼)과 앱 간의 코드/리소스 소유권 분류 -- 의존 방향, 임포트 규칙, 확장 포인트

---

## 1. 개요

v-project는 **v-platform**(재사용 가능한 플랫폼 프레임워크)과 **앱**(비즈니스 로직)으로 구성된다. 이 문서는 각 모듈이 플랫폼에 속하는지 앱에 속하는지, 그리고 둘 사이의 의존 방향과 임포트 규칙을 정의한다.

### 핵심 원칙

```
앱 --> 플랫폼   (앱은 플랫폼을 임포트한다)
플랫폼 -/-> 앱  (플랫폼은 앱을 임포트하지 않는다)
```

이 단방향 의존 관계를 지키면, 플랫폼을 다른 프로젝트에서 그대로 재사용할 수 있다.

---

## 2. 분류 기준

| 분류 | 설명 | 위치 |
|------|------|------|
| **P** (Platform) | 플랫폼 소유. 모든 앱이 공유하는 범용 기능 | `platform/` |
| **A** (App) | 앱 소유. 특정 앱의 비즈니스 로직 | `apps/{app-name}/` |
| **S** (Shared) | 플랫폼이 제공하되 앱이 확장하는 인터페이스 | `platform/` (확장 포인트) |

---

## 3. 백엔드 모듈 분류

### 3.1 플랫폼 백엔드 (`platform/backend/v_platform/`)

| 디렉토리 | 분류 | 내용 |
|----------|------|------|
| `app.py` | P | `PlatformApp` 클래스 -- 프레임워크 진입점 |
| `core/database.py` | P | DB 엔진, SessionLocal, init_db, get_db_session |
| `core/logging.py` | P | structlog JSON 로깅 + app_name 인젝션 |
| `core/exceptions.py` | P | 공통 예외 클래스 |
| `models/user.py` | P | User 모델 (인증/RBAC) |
| `models/menu_item.py` | P | MenuItem 모델 (동적 메뉴) |
| `models/audit_log.py` | P | AuditLog 모델 (감사 로그) |
| `models/notification.py` | P | Notification, NotificationAppOverride, NotificationRead |
| `models/permission_group.py` | P | PermissionGroup, PermissionGroupGrant, UserGroupMembership |
| `models/system_settings.py` | P | SystemSettings (브랜딩, app_id별) |
| `models/user_permission.py` | P | UserPermission (메뉴-사용자 권한) |
| `models/company.py` | P | Company (조직) |
| `models/department.py` | P | Department (부서) |
| `models/refresh_token.py` | P | RefreshToken (JWT 갱신) |
| `models/password_reset_token.py` | P | PasswordResetToken |
| `models/user_oauth_token.py` | P | UserOAuthToken (SSO 토큰) |
| `api/auth.py` | P | 로그인/로그아웃/토큰 갱신 |
| `api/auth_sso.py` | P | Generic OIDC SSO |
| `api/auth_microsoft.py` | P | Microsoft SSO |
| `api/users.py` | P | 사용자 CRUD |
| `api/user_oauth.py` | P | OAuth 연결 관리 |
| `api/permissions.py` | P | 메뉴별 권한 관리 |
| `api/permission_groups.py` | P | 권한 그룹 관리 |
| `api/menus.py` | P | 메뉴 CRUD + 순서 변경 |
| `api/organizations.py` | P | 조직도 관리 |
| `api/audit_logs.py` | P | 감사 로그 조회 |
| `api/system_settings.py` | P | 시스템 설정 (브랜딩) |
| `api/health.py` | S | HealthRegistry -- 앱이 체크 함수 등록 |
| `api/notifications.py` | P | 실시간 WebSocket 알림 |
| `api/persistent_notifications.py` | P | 영속 알림 CRUD |
| `api/metrics.py` | P | Prometheus 메트릭 정의 + `/metrics` 엔드포인트 |
| `api/websocket.py` | P | WebSocket 연결 관리 |
| `api/uploads.py` | P | 파일 업로드 |
| `services/notification_service.py` | P | WebSocket 알림 생성/브로드캐스트 |
| `services/persistent_notification.py` | P | 영속 알림 서비스 (scope 필터) |
| `services/permission_service.py` | P | 권한 조회/체크 |
| `services/websocket_manager.py` | P | WebSocket 연결 관리자 |
| `services/event_broadcaster.py` | P | 이벤트 브로드캐스터 |
| `services/export_service.py` | P | 데이터 내보내기 |
| `services/stats_service.py` | P | 통계 서비스 |
| `services/log_buffer.py` | P | 로그 버퍼링 |
| `services/feature_checker.py` | P | 기능 플래그 체크 |
| `services/cache_service.py` | P | Redis 캐시 |
| `middleware/csrf.py` | P | CSRF 보호 |
| `middleware/metrics.py` | P | MetricsMiddleware (HTTP 요청 측정) |
| `sso/` | P | SSO 프로바이더 초기화 |
| `utils/auth.py` | P | JWT 검증, get_current_user, require_* |
| `utils/audit_logger.py` | P | 감사 로그 기록 유틸리티 |
| `utils/encryption.py` | P | 암호화 유틸리티 |
| `utils/filters.py` | P | 쿼리 필터 유틸리티 |
| `schemas/` | P | Pydantic 스키마 (user, audit_log, system_settings) |
| `migrations/` | P | 플랫폼 마이그레이션 (p001~p026) |

### 3.2 앱 백엔드 (`apps/{app-name}/backend/`)

| 앱 | 주요 모듈 | 분류 |
|----|----------|------|
| v-channel-bridge | `adapters/` (Slack, Teams Provider) | A |
| v-channel-bridge | `api/` (bridge, messages, accounts, teams_webhook) | A |
| v-channel-bridge | `models/` (Message, Account) | A |
| v-channel-bridge | `services/` (websocket_bridge, route_manager, message_queue) | A |
| v-channel-bridge | `main.py` (PlatformApp + register_app_routers) | A |
| v-platform-portal | `api/portal.py` (앱 CRUD, 헬스, 사이트맵) | A |
| v-platform-portal | `services/app_registry.py` (AppRegistry) | A |
| v-platform-portal | `models/portal_app.py` (PortalApp) | A |
| v-platform-template | `main.py` (PlatformApp 최소 구성) | A |

---

## 4. 프론트엔드 모듈 분류

### 4.1 플랫폼 프론트엔드 (`platform/frontend/v-platform-core/src/`)

npm 패키지명: `@v-platform/core`

| 디렉토리 | 분류 | 내용 |
|----------|------|------|
| `pages/` | P | 18개 플랫폼 페이지 |
| `stores/` | P | 6개 상태 스토어 (auth, permission, notification, systemSettings, sessionSettings, user-oauth) |
| `hooks/` | P | 13개 훅 (useTheme, useWebSocket, useNotifications, useRealtimeStatus, useTour...) |
| `components/ui/` | P | 25개 기본 UI 컴포넌트 |
| `components/layout/` | P | 11개 레이아웃 컴포넌트 (Layout, Sidebar, Header...) |
| `components/settings/` | P | 6개 설정 컴포넌트 |
| `components/admin/` | P | 7개 관리자 컴포넌트 |
| `components/auth/` | P | 3개 인증 컴포넌트 |
| `components/notifications/` | P | 6개 알림 컴포넌트 |
| `components/profile/` | P | 2개 프로필 컴포넌트 |
| `components/oauth/` | P | 3개 OAuth 컴포넌트 |
| `components/common/` | P | 3개 공통 컴포넌트 |
| `api/` | P | 11개 API 모듈 (client, auth, users, permissions, persistentNotifications...) |
| `lib/navigation.tsx` | P | 네비게이션 구성 |
| `lib/resolveStartPage.ts` | P | 시작 페이지 결정 |
| `lib/websocket/` | P | WebSocket 클라이언트 |
| `lib/tour/` | S | 투어 프레임워크 (앱이 스텝 정의) |
| `lib/utils/` | P | 유틸리티 함수 |
| `providers/` | P | PlatformProvider (Config, QueryClient) |
| `types/` | P | TypeScript 타입 정의 |
| `styles/` | P | CSS 변수, 시맨틱 토큰 |

### 4.2 앱 프론트엔드 (`apps/{app-name}/frontend/src/`)

| 앱 | 주요 모듈 | 분류 |
|----|----------|------|
| v-channel-bridge | `pages/` (Dashboard, Channels, Messages, Statistics...) | A |
| v-channel-bridge | `components/` (dashboard, channels, messages, providers...) | A |
| v-channel-bridge | `App.tsx` (플랫폼 페이지 import + 앱 라우트) | A |
| v-platform-portal | `pages/` (Portal, AppManagement, Help, NotificationManagement) | A |
| v-platform-portal | `hooks/useTour.ts` (포털 전용 투어) | A |
| v-platform-portal | `lib/` (portalApi, tour steps) | A |
| v-platform-template | `pages/` (Dashboard, NotificationManagement) | A |
| v-platform-template | `hooks/useTour.ts` (템플릿 전용 투어) | A |

---

## 5. 플랫폼 페이지 목록

`@v-platform/core`가 제공하는 18개 페이지를 앱의 `App.tsx`에서 import하여 라우팅한다.

| 페이지 | 파일 | 경로 (일반) | 분류 |
|--------|------|------------|------|
| Login | `Login.tsx` | `/login` | P |
| Register | `Register.tsx` | `/register` | P |
| ForgotPassword | `ForgotPassword.tsx` | `/forgot-password` | P |
| ResetPassword | `ResetPassword.tsx` | `/reset-password` | P |
| SSOCallback | `SSOCallback.tsx` | `/sso/callback` | P |
| Profile | `Profile.tsx` | `/profile` | P |
| PasswordChange | `PasswordChange.tsx` | `/password-change` | P |
| Settings | `Settings.tsx` | `/settings` | P |
| Help | `Help.tsx` | `/help` | P |
| UserManagement | `UserManagement.tsx` | `/admin/users` | P |
| AuditLogs | `AuditLogs.tsx` | `/admin/audit-logs` | P |
| Admin (pages) | `admin/` | `/admin/*` | P |
| CustomIframe | `CustomIframe.tsx` | `/custom/*` | P |
| Forbidden | `Forbidden.tsx` | `/403` | P |

앱은 이 페이지들을 import하여 자신의 라우터에 등록하고, 앱 전용 페이지(Dashboard, Channels 등)를 추가한다.

---

## 6. 의존 방향 규칙

### 6.1 백엔드

```
앱 main.py
  |
  +-- from v_platform.app import PlatformApp       (O) 앱 -> 플랫폼
  +-- from v_platform.utils.auth import get_current_user  (O)
  +-- from v_platform.core.database import get_db_session (O)
  +-- from v_platform.models.user import User       (O)
  +-- from v_platform.api.health import health_registry   (O) 확장 포인트

플랫폼 코드에서:
  +-- from app.models.portal_app import PortalApp   (X) 플랫폼 -> 앱 금지!
  +-- from app.services.bridge import ...           (X)
```

### 6.2 프론트엔드

```
앱 App.tsx
  |
  +-- import { Login, Profile, Settings } from '@v-platform/core'  (O)
  +-- import { useAuth, useTheme } from '@v-platform/core'         (O)
  +-- import { apiClient } from '@v-platform/core'                 (O)

@v-platform/core 내부에서:
  +-- import { Dashboard } from '../../apps/v-channel-bridge'      (X) 금지!
```

### 6.3 예외: 확장 포인트 (S)

플랫폼이 인터페이스를 정의하고 앱이 구현을 등록하는 패턴:

| 확장 포인트 | 플랫폼 제공 | 앱 사용 |
|------------|-----------|---------|
| HealthRegistry | `health_registry.register(name, fn)` | 앱 커스텀 헬스 체크 등록 |
| register_app_routers | `platform.register_app_routers(*routers)` | 앱 전용 라우터 등록 |
| app_menu_keys | `PlatformApp(app_menu_keys=[...])` | 앱 메뉴 분류 키 목록 |
| Tour steps | `useTour()` 훅 프레임워크 | 앱별 투어 스텝 정의 |

이 패턴에서 플랫폼은 앱 코드를 직접 import하지 않는다. 앱이 플랫폼의 레지스트리에 자신을 등록하는 방식이다.

---

## 7. 데이터베이스 테이블 소유권

### 7.1 플랫폼 테이블 (P)

플랫폼 마이그레이션(p001~p026)으로 관리한다. 모든 앱이 공유한다.

| 테이블 | 소유 | app_id 분리 |
|--------|------|------------|
| `users` | P | X (전역) |
| `menu_items` | P | O |
| `user_permissions` | P | X (메뉴 기반) |
| `permission_groups` | P | O |
| `permission_group_grants` | P | X (그룹 기반) |
| `user_group_memberships` | P | X (그룹 기반) |
| `audit_logs` | P | O |
| `system_settings` | P | O |
| `notifications` | P | O |
| `notification_app_overrides` | P | O |
| `notification_reads` | P | X (사용자 기반) |
| `companies` | P | X (전역) |
| `departments` | P | X (전역) |
| `refresh_tokens` | P | X (전역) |
| `password_reset_tokens` | P | X (전역) |
| `user_oauth_tokens` | P | X (전역) |

### 7.2 앱 테이블 (A)

각 앱이 자체 마이그레이션으로 관리한다.

| 테이블 | 앱 | 설명 |
|--------|-----|------|
| `portal_apps` | v-platform-portal | 포털 앱 레지스트리 |
| `messages` | v-channel-bridge | 브리지 메시지 |
| `accounts` | v-channel-bridge | 플랫폼 계정 연결 |

---

## 8. 앱 생성 시 모듈 체크리스트

새 앱을 만들 때 다음 구조를 따른다:

### 8.1 백엔드

```python
# apps/{new-app}/backend/app/main.py

from v_platform.app import PlatformApp

platform = PlatformApp(
    app_name="v-{new-app}",
    version="1.0.0",
    description="앱 설명",
    lifespan=lifespan,
    app_menu_keys=["app_dashboard", "app_settings"],  # 앱 전용 메뉴 키
)

# 앱 전용 라우터 등록
from app.api.my_routes import router as my_router
platform.register_app_routers(my_router)

app = platform.fastapi
```

### 8.2 프론트엔드

```tsx
// apps/{new-app}/frontend/src/App.tsx

import { Login, Profile, Settings, Layout } from '@v-platform/core';
import { AppDashboard } from './pages/AppDashboard';

// 플랫폼 페이지 + 앱 전용 페이지 라우팅
```

### 8.3 금지 사항

- 앱 코드에서 다른 앱의 모듈 import 금지
- 플랫폼 모듈에서 앱 모듈 import 금지
- 앱이 플랫폼 DB 마이그레이션 파일 수정 금지
- 앱이 `@v-platform/core` 소스 코드 직접 수정 금지

---

## 9. 공유 인프라

모든 앱이 공유하지만 앱별로 격리되는 인프라:

| 인프라 | 공유 방식 | 격리 수준 |
|--------|----------|----------|
| PostgreSQL | 동일 DB (`v_project`) | 테이블 수준 (app_id 컬럼) |
| Redis | 동일 인스턴스 | 키 네임스페이스 |
| JWT SECRET_KEY | 동일 값 | 앱 간 SSO 가능 |
| Prometheus | 앱별 `/metrics` | `app` 라벨로 구분 |
| structlog | 동일 포맷 | `app` 키로 구분 |

---

## 10. 의존 관계 다이어그램

```
+-----------------------------------------------+
|               v-platform (Platform)            |
|                                                |
|  PlatformApp    Models(14)    API Routers(18)  |
|  Middleware      Services(14)  Utils           |
|  SSO             Schemas       Migrations(26)  |
|                                                |
|  @v-platform/core                              |
|  Pages(18)  Stores(6)  Hooks(13)  Components   |
|  API Client  Providers  Lib       Styles       |
+-------+-------+-------+-------+-------+-------+
        ^       ^       ^       ^       ^
        |       |       |       |       |
  +-----+  +---+---+  +--+--+  +---+  +----+
  |     |  |       |  |     |  |   |  |    |
  | v-  |  | v-    |  | v-  |  |...|  |new |
  | ch. |  | tmpl  |  | ptl |  |   |  |app |
  | br. |  |       |  |     |  |   |  |    |
  +-----+  +-------+  +-----+  +---+  +----+
  (App)     (App)      (App)          (App)

  화살표 방향: 앱 --> 플랫폼 (단방향)
```

---

## 11. 관련 문서

- [플랫폼/앱 분리 아키텍처](./PLATFORM_APP_SEPARATION_ARCHITECTURE.md) -- PlatformApp 상세
- [멀티 앱 데이터 격리](./MULTI_APP_DATA_ISOLATION.md) -- app_id 기반 데이터 격리
- [동적 메뉴 시스템](./MENU_GROUP_AND_TAB_LAYOUT.md) -- MenuItem 모델 상세
- [모니터링 중앙화](./PLATFORM_MONITORING_CENTRALIZATION.md) -- 메트릭/로그 구조
