---
id: module-design
title: 모듈 설계 원칙
sidebar_position: 3
tags: [module, design, tech-portfolio, platform]
---

# 모듈 설계 원칙

이 문서는 v-project의 Platform/App 경계 규칙, `@v-platform/core` 패키지 구조, `PlatformApp` 사용 프로토콜, 새 모듈 배치 의사결정 기준을 기술한다. 모든 규칙은 실제 코드베이스에서 검증된 패턴이며, 새로운 앱 또는 모듈을 추가할 때 이 문서의 원칙을 따른다.

---

## 1. Platform/App 경계 규칙

### 1.1 계층 구조

```
Layer 3  앱 고유 모듈 (App-specific)
         v-channel-bridge | v-platform-template | v-platform-portal
         ─────────────────────────────────────────────────────────
Layer 2  플랫폼 공통 모듈 (Platform Framework)
         v_platform (Python) | @v-platform/core (npm)
         ─────────────────────────────────────────────────────────
Layer 1  인프라 의존 (Infrastructure)
         PostgreSQL | Redis | MailHog | Prometheus | Loki | Grafana
```

### 1.2 경계 원칙

| 원칙 | 설명 | 위반 사례 |
|------|------|----------|
| 플랫폼에 앱 코드 금지 | `platform/` 디렉토리에 특정 앱의 비즈니스 로직이 존재하면 안 된다 | Slack 메시지 파싱 코드를 `v_platform/services/`에 넣는 것 |
| 앱에서 플랫폼 재구현 금지 | 인증/RBAC/감사로그/SSO 등 플랫폼이 제공하는 기능을 앱이 별도로 구현하면 안 된다 | 앱 내부에 JWT 발급 로직을 직접 작성하는 것 |
| 앱 간 직접 의존 금지 | 앱 A가 앱 B의 내부 코드를 직접 import하면 안 된다 | v-channel-bridge에서 v-platform-portal의 모델을 import하는 것 |
| 데이터 격리 보장 | 앱별 데이터는 `app_id` 컬럼으로 자동 격리된다 | 감사로그 조회 시 다른 앱의 데이터가 노출되는 것 |

### 1.3 의존성 방향

```
앱 ──(import)──> 플랫폼
앱 ──(사용)────> 인프라
플랫폼 ────────> 인프라

앱 ──(X)──> 다른 앱     (금지)
플랫폼 ──(X)──> 앱       (금지)
```

실제 코드에서의 의존 방향:

```python
# apps/v-channel-bridge/backend/app/main.py
from v_platform.app import PlatformApp          # 앱 -> 플랫폼 (허용)

# apps/v-channel-bridge/frontend/src/App.tsx
import { LoginPage, UsersPage } from "@v-platform/core"  # 앱 -> 플랫폼 (허용)
```

### 1.4 플랫폼에 속하는 것 vs 앱에 속하는 것

| 기준 | 플랫폼 | 앱 |
|------|--------|-----|
| 2개 이상의 앱에서 동일하게 필요한가? | 플랫폼 | - |
| 특정 외부 서비스(Slack, Teams)에 종속되는가? | - | 앱 |
| 인증/권한/감사와 관련되는가? | 플랫폼 | - |
| 비즈니스 도메인 데이터를 다루는가? | - | 앱 |
| UI 기본 구조(레이아웃, 내비게이션)인가? | 플랫폼 | - |
| 도메인 고유 UI(대시보드 위젯, 차트)인가? | - | 앱 |

---

## 2. Platform Backend -- `v_platform` Python 패키지

### 2.1 디렉토리 구조

```
platform/backend/v_platform/
├── app.py                   # PlatformApp 클래스 (프레임워크 진입점)
├── core/
│   ├── database.py          # SQLAlchemy 엔진, init_db(), run_migrations()
│   ├── exceptions.py        # 전역 예외 핸들러
│   └── logging.py           # structlog 설정 (configure_platform_logging)
├── api/                     # 17개 라우터
│   ├── auth.py              # 로그인/로그아웃/토큰 갱신/비밀번호 재설정
│   ├── auth_sso.py          # 범용 OIDC SSO
│   ├── auth_microsoft.py    # Microsoft Azure AD SSO
│   ├── users.py             # 사용자 CRUD + 역할 변경
│   ├── user_oauth.py        # 사용자 OAuth 연동
│   ├── permissions.py       # 권한 키 카탈로그
│   ├── permission_groups.py # 권한 그룹 관리
│   ├── menus.py             # 메뉴/사이드바 (app_id 필터)
│   ├── organizations.py     # 조직 트리 관리
│   ├── audit_logs.py        # 감사로그 조회/통계/내보내기
│   ├── system_settings.py   # 시스템 설정 (브랜딩/SMTP/보안)
│   ├── health.py            # /api/health 인프라 헬스 집계
│   ├── notifications.py     # 알림 CRUD + WebSocket 푸시
│   ├── persistent_notifications.py  # 시스템 공지 관리
│   ├── metrics.py           # /metrics Prometheus 엔드포인트
│   ├── websocket.py         # WebSocket 연결 + 브로드캐스트
│   └── uploads.py           # 파일 업로드
├── services/                # 13개 서비스
│   ├── token_service.py     # JWT 발급/검증/갱신
│   ├── password_reset_service.py  # 비밀번호 재설정 토큰
│   ├── permission_service.py     # RBAC 권한 검증
│   ├── notification_service.py   # 알림 생성/발송/읽음
│   ├── persistent_notification.py # 시스템 공지 서비스
│   ├── export_service.py    # CSV/JSON 스트리밍 내보내기
│   ├── stats_service.py     # 집계 쿼리 + 시계열 통계
│   ├── event_broadcaster.py # WebSocket 이벤트 팬아웃
│   ├── log_buffer.py        # 메모리 로그 버퍼 + WebSocket 전송
│   ├── feature_checker.py   # Provider별 기능 카탈로그 검증
│   ├── cache_service.py     # Redis 래퍼 (TTL 관리)
│   ├── email_service.py     # SMTP 발송 + 템플릿 렌더링
│   └── websocket_manager.py # WebSocket 연결 풀 관리
├── models/                  # 12개 모델
│   ├── user.py              # User (id, email, password_hash, role)
│   ├── user_permission.py   # 사용자별 권한 오버라이드
│   ├── permission_group.py  # 권한 그룹 (app_id 포함)
│   ├── company.py           # 회사 정보
│   ├── department.py        # 부서 (조직 트리)
│   ├── audit_log.py         # 감사로그 (app_id 격리)
│   ├── menu_item.py         # 메뉴 항목 (app_id 격리)
│   ├── notification.py      # 알림 (시스템/앱, app_id 격리)
│   ├── system_settings.py   # 시스템 설정 (app_id 격리)
│   ├── refresh_token.py     # Refresh Token (app_id 포함)
│   ├── user_oauth_token.py  # OAuth 연동 토큰
│   └── password_reset_token.py  # 비밀번호 재설정 토큰
├── middleware/
│   ├── csrf.py              # CSRF 방어 미들웨어
│   └── metrics.py           # Prometheus HTTP 메트릭 수집
├── sso/
│   ├── base.py              # BaseSSOProvider 추상 클래스
│   ├── microsoft.py         # Microsoft Azure AD 구현
│   ├── generic_oidc.py      # 범용 OIDC 구현
│   └── registry.py          # SSO Provider 레지스트리
├── utils/
│   ├── auth.py              # 비밀번호 해싱, JWT 유틸리티
│   ├── audit_logger.py      # @audit_log 데코레이터
│   ├── encryption.py        # 암호화 유틸리티
│   └── filters.py           # 쿼리 필터 헬퍼
├── schemas/                 # Pydantic v2 스키마
└── migrations/              # p001 ~ p026
```

### 2.2 PlatformApp 사용 프로토콜

`PlatformApp`은 플랫폼의 모든 기능을 하나의 진입점으로 제공하는 클래스다. 새 앱을 만들 때 이 클래스를 인스턴스화하고, 앱 고유 라우터를 등록하면 된다.

**최소 부트스트랩 (실제 코드: `apps/v-platform-template/backend/app/main.py`)**:

```python
from contextlib import asynccontextmanager
from v_platform.app import PlatformApp
from v_platform.services.event_broadcaster import EventBroadcaster
from app.api import dashboard

@asynccontextmanager
async def lifespan(app):
    platform.init_platform()        # DB 마이그레이션 + SSO 초기화 + 메뉴 분류
    EventBroadcaster.set_app(app)   # WebSocket 브로드캐스터 등록
    yield

platform = PlatformApp(
    app_name="v-platform-template",
    app_menu_keys=["dashboard", "settings"],   # 이 앱이 소유하는 메뉴 키
    lifespan=lifespan,
)
platform.register_app_routers(dashboard.router)  # 앱 고유 라우터 등록
app = platform.get_app()                          # Uvicorn에 전달할 FastAPI 인스턴스
```

**PlatformApp 생성자 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `app_name` | `str` | 필수 | 앱 식별자. `app_id`로 사용되며 데이터 격리 기준이 된다 |
| `version` | `str` | 선택 | API 문서에 표시되는 버전 |
| `description` | `str` | 선택 | API 문서 설명 |
| `lifespan` | `Callable` | 선택 | FastAPI lifespan 컨텍스트 매니저 |
| `cors_origins` | `list[str]` | 선택 | CORS 허용 출처. 미지정 시 `http://127.0.0.1:3000`, `http://127.0.0.1:5173` + `CORS_ORIGINS` 환경변수 |
| `app_menu_keys` | `list[str]` | 선택 | 이 앱이 소유하는 메뉴 항목의 `permission_key` 목록 |

**PlatformApp이 자동 수행하는 작업**:

| 단계 | 메서드 | 등록 내용 |
|------|--------|----------|
| 미들웨어 설치 | `_setup_middleware()` | CORS, CSRF(`csrf.py`), Prometheus 메트릭(`metrics.py`) |
| Rate Limiter 설치 | `_setup_rate_limiter()` | slowapi 기반 IP 단위 제한 |
| 플랫폼 라우터 등록 | `_register_platform_routers()` | 17개 라우터 일괄 등록 (인증, RBAC, 감사, SSO, 알림, 설정, 헬스 등) |
| DB 초기화 | `init_platform()` -> `init_db()` | SQLAlchemy 엔진 생성 + 26개 마이그레이션 순차 적용 |
| SSO 초기화 | `init_platform()` -> `init_sso_providers()` | Microsoft/OIDC Provider 레지스트리 등록 |
| 메뉴 분류 | `init_platform()` -> `_classify_app_menus()` | `app_menu_keys`에 해당하는 `menu_items.app_id` 설정 |

**앱 라우터 등록 예시 (v-channel-bridge)**:

```python
# apps/v-channel-bridge/backend/app/main.py
from app.api import bridge, messages, accounts_crud, accounts_test, auth
from app.api import teams_webhook, teams_notifications, monitoring

platform.register_app_routers(
    bridge.router,
    messages.router,
    accounts_crud.router,
    accounts_test.router,
    auth.router,
    teams_webhook.router,
    teams_notifications.router,
    monitoring.router,
)
```

### 2.3 app_id 격리 메커니즘

`app_id` 격리는 마이그레이션 `p015_multi_app_isolation.py`에서 도입되었다. 다음 테이블에 `app_id VARCHAR` 컬럼이 추가된다:

| 테이블 | 격리 대상 |
|--------|----------|
| `menu_items` | 각 앱의 사이드바 메뉴 |
| `audit_logs` | 각 앱의 감사 이력 |
| `system_settings` | 각 앱의 설정 (브랜딩 포함) |
| `notifications` | 각 앱의 알림 |
| `permission_groups` | 각 앱의 권한 그룹 (p018 유니크 제약) |
| `refresh_tokens` | 각 앱의 리프레시 토큰 (p025) |

API 레벨에서 격리가 적용되는 방식:

```python
# 감사로그 조회 시 app_id 자동 필터링 (개념 코드)
app_id = request.app.state.app_id   # PlatformApp 생성 시 설정됨
query = select(AuditLog).where(AuditLog.app_id == app_id)
```

---

## 3. Platform Frontend -- `@v-platform/core` npm 패키지

### 3.1 디렉토리 구조

```
platform/frontend/v-platform-core/src/
├── index.ts                  # 패키지 공개 API (re-export)
├── providers/
│   └── PlatformProvider.tsx  # Config + QueryClient + Theme + Sidebar 컨텍스트
├── pages/                    # 18개 플랫폼 페이지
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── SSOCallback.tsx
│   ├── Forbidden.tsx
│   ├── Profile.tsx
│   ├── PasswordChange.tsx
│   ├── CustomIframe.tsx
│   ├── Help.tsx
│   ├── UserManagement.tsx
│   ├── AuditLogs.tsx
│   ├── Settings.tsx
│   └── admin/
│       ├── MenuManagement.tsx
│       ├── Organizations.tsx
│       ├── PermissionMatrix.tsx
│       ├── PermissionGroups.tsx
│       └── NotificationManagement.tsx
├── stores/                   # 6개 Zustand 스토어
│   ├── auth.ts               # user, tokens, isAuthenticated, login(), logout()
│   ├── permission.ts         # roles, permissions, menuKeys, hasPermission()
│   ├── notification.ts       # notifications, unreadCount, banners
│   ├── systemSettings.ts     # branding, smtp, security, sso
│   ├── sessionSettings.ts    # idleTimeout, autoExtend, warning
│   └── user-oauth.ts         # linkedProviders, 연동/해제 액션
├── hooks/                    # 13개 커스텀 훅
│   ├── useTheme.ts           # 다크/라이트 모드 + 시스템 설정 연동
│   ├── useWebSocket.ts       # 범용 WebSocket 연결 (재연결 포함)
│   ├── useNotifications.ts   # 알림 실시간 수신 + 읽음 처리
│   ├── useRealtimeStatus.ts  # 상태 실시간 구독
│   ├── useTokenExpiry.ts     # 토큰 만료 카운트다운
│   ├── useIdleTimeout.ts     # 유휴 감지 -> 세션 경고
│   ├── useActivityDetection.ts  # 마우스/키보드 활동 추적
│   ├── useKeyboardShortcuts.ts  # 단축키 바인딩
│   ├── useSidebar.tsx        # 사이드바 접기/펼치기
│   ├── useTabSync.ts         # 멀티 탭 상태 동기화 (BroadcastChannel)
│   ├── useBrowserNotification.ts  # 네이티브 브라우저 알림
│   ├── useApiErrorHandler.ts  # 에러 추상화 + 토스트
│   └── useTour.ts            # Driver.js 기반 앱 맞춤 투어
├── components/               # 63개 컴포넌트
│   ├── ui/ (24)              # Button, Input, Select, Card, Table, Modal, Tabs,
│   │                         # Badge, Alert, Tooltip, Toggle, DateRangePicker,
│   │                         # MultiSelect, Spinner, EmptyState, Textarea,
│   │                         # SimpleMarkdown, Skeleton, Divider, InfoBox,
│   │                         # InfoTooltip, PlatformIcon, RestartConfirmDialog
│   ├── layout/ (9)           # TopBar, Sidebar, SidebarSection, SidebarNavItem,
│   │                         # SidebarGroupItem, SidebarCollapse, MobileSidebarGroupItem,
│   │                         # ContentHeader, UserMenu
│   ├── settings/ (5)         # SecurityTab, ThemeSettings, SessionSettings,
│   │                         # NotificationSettings, SystemSettingsTab
│   ├── admin/ (7)            # IconPicker, MenuFormModal, AccessLevelRadio,
│   │                         # MenuPermissionView, MenuTreeSelector,
│   │                         # PermissionSourceBadge, UserPermissionView
│   ├── auth/ (2)             # SSOButton, TokenExpiryManager
│   ├── notifications/ (6)    # NotificationBell, NotificationPopover, NotificationItem,
│   │                         # AnnouncementPopup, Toast, ToastContainer
│   ├── profile/ (2)          # PasswordChangeForm, SessionDeviceList
│   ├── oauth/ (3)            # AdminOAuthOverview, UserOAuthList, UserOAuthCard
│   ├── common/ (2)           # ConnectionStatus, StatusDetailPopup
│   ├── Layout.tsx            # 메인 레이아웃 (Sidebar + TopBar + Content)
│   ├── ProtectedRoute.tsx    # 인증 필수 라우트 가드
│   ├── RoleBasedRoute.tsx    # 역할 기반 라우트 가드
│   └── HelpButton.tsx        # 도움말/투어 시작 버튼
├── api/                      # 13개 API 모듈
│   ├── client.ts             # Axios 인스턴스 (JWT/CSRF 인터셉터)
│   ├── auth.ts, users.ts, permissions.ts, menus.ts
│   ├── auditLogs.ts, notifications.ts, systemSettings.ts
│   ├── organizations.ts, monitoring.ts, sso.ts
│   ├── oauth.ts, session.ts, branding.ts
│   └── ...
└── lib/
    ├── navigation.ts         # 내비게이션 유틸리티
    ├── resolveStartPage.ts   # 역할별 시작 페이지 결정
    ├── tour.ts               # 투어 프레임워크 코어
    ├── websocket.ts          # WebSocket 클라이언트 유틸리티
    └── utils.ts              # 범용 유틸리티
```

### 3.2 앱에서 사용하는 방식

앱 프론트엔드는 `@v-platform/core`에서 필요한 페이지, 컴포넌트, 스토어, 훅을 import하고, 앱 고유 페이지를 추가로 정의한다.

**앱 App.tsx 구조 (v-platform-template 기준)**:

```tsx
// apps/v-platform-template/frontend/src/App.tsx
import {
  LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage,
  ProfilePage, PasswordChangePage, SSOCallbackPage, ForbiddenPage,
  UserManagementPage, AuditLogsPage, SettingsPage, HelpPage,
  PlatformProvider, ProtectedRoute, RoleBasedRoute, Layout,
} from "@v-platform/core";

// 앱 고유 페이지
import DashboardPage from "./pages/Dashboard";

function App() {
  return (
    <PlatformProvider config={appConfig}>
      <Routes>
        {/* 공개 라우트 -- 플랫폼 페이지 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/sso/callback" element={<SSOCallbackPage />} />

        {/* 인증 필수 -- 레이아웃 내부 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />          {/* 앱 고유 */}
            <Route path="/profile" element={<ProfilePage />} />      {/* 플랫폼 */}
            <Route path="/settings" element={<SettingsPage />} />    {/* 플랫폼 */}
            <Route path="/help" element={<HelpPage />} />            {/* 플랫폼 */}

            {/* 관리자 전용 */}
            <Route element={<RoleBasedRoute requiredRole="admin" />}>
              <Route path="/admin/users" element={<UserManagementPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </PlatformProvider>
  );
}
```

### 3.3 PlatformProvider 역할

`PlatformProvider`는 앱 루트에서 한 번 감싸는 컨텍스트 프로바이더로, 다음을 자동으로 설정한다:

| 기능 | 설명 |
|------|------|
| QueryClient | TanStack Query 클라이언트 초기화 + 기본 stale/cache 시간 설정 |
| Theme 컨텍스트 | 시스템 설정 기반 다크/라이트 모드 자동 적용 |
| Sidebar 컨텍스트 | 사이드바 상태 (접기/펼치기) 관리 |
| 앱 설정 주입 | `appConfig` 객체를 통해 앱 이름, API URL 등 주입 |

### 3.4 접근 제어 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | `authStore.isAuthenticated` 체크 -> 미인증 시 `/login` 리다이렉트 |
| `RoleBasedRoute` | `components/RoleBasedRoute.tsx` | `requiredRole` 체크 -> 권한 부족 시 `/forbidden` 리다이렉트 |
| 서버 기반 메뉴 필터링 | `api/menus.ts` -> `GET /api/menus/sidebar?app_id=xxx` | 서버에서 RBAC 결과만 반환 -> 사이드바 동적 구성 |

---

## 4. 앱 고유 모듈 설계

### 4.1 v-channel-bridge

Slack/Teams 양방향 메시지 브리지. 14개 서비스, 8개 API 라우터, Provider 어댑터 패턴을 사용한다.

**백엔드 구조**:

```
apps/v-channel-bridge/backend/app/
├── main.py                      # PlatformApp + 앱 라우터 등록
├── adapters/                    # Provider 어댑터
│   ├── base.py                  # BasePlatformProvider (ABC)
│   ├── slack_provider.py        # Slack Socket Mode
│   └── teams_provider.py        # Teams Bot Framework + Graph API
├── schemas/
│   └── common_message.py        # CommonMessage, Attachment, User, Channel
├── api/                         # 8개 앱 고유 라우터
│   ├── bridge.py                # 브리지 제어, Route CRUD
│   ├── messages.py              # 메시지 검색/내보내기
│   ├── accounts_crud.py         # Provider 계정 CRUD
│   ├── accounts_test.py         # Provider 연결 테스트
│   ├── auth.py                  # 앱별 인증 확장
│   ├── teams_webhook.py         # Teams 웹훅 수신 엔드포인트
│   ├── teams_notifications.py   # Teams 구독 알림
│   └── monitoring.py            # 앱별 모니터링 확장
├── models/
│   ├── message.py               # Message (발신자/경로/상태/첨부)
│   └── account.py               # ProviderAccount (플랫폼/토큰/상태)
└── services/                    # 14개 앱 고유 서비스
    ├── websocket_bridge.py      # Provider 수신 -> Route 매칭 -> 전송
    ├── route_manager.py         # Redis 라우팅 엔진 (SMEMBERS/HGETALL)
    ├── message_queue.py         # 배치 처리 + 재시도
    ├── message_service.py       # Message 테이블 CRUD
    ├── websocket_manager.py     # WebSocket 연결 풀
    ├── notification_service.py  # 앱 고유 알림 생성
    ├── cache_service.py         # 앱 고유 캐시 레이어
    ├── event_broadcaster.py     # WebSocket 이벤트 배포
    ├── log_buffer.py            # 실시간 로그 버퍼
    ├── feature_checker.py       # Provider 기능 카탈로그
    ├── provider_sync.py         # Provider 상태 동기화
    ├── attachment_handler.py    # 첨부파일 다운로드/업로드
    ├── command_processor.py     # /vms 커맨드 파싱/처리
    └── teams_subscription_manager.py  # Teams 구독 관리
```

**Provider 어댑터 패턴**:

모든 메시지 플랫폼 어댑터는 `BasePlatformProvider` (ABC)를 상속하며, 다음 메서드를 구현해야 한다:

| 메서드 | 반환 | 역할 |
|--------|------|------|
| `connect()` | `bool` | 플랫폼 연결 |
| `disconnect()` | `bool` | 연결 해제 |
| `send_message(CommonMessage)` | `bool` | 메시지 전송 (Common -> 플랫폼 형식 변환) |
| `receive_messages()` | `AsyncIterator[CommonMessage]` | 메시지 수신 (플랫폼 -> Common 변환) |
| `get_channels()` | `list[Channel]` | 채널 목록 조회 |
| `get_users()` | `list[User]` | 사용자 목록 조회 |
| `transform_to_common(raw)` | `CommonMessage` | 플랫폼 원본 -> Common 변환 |
| `transform_from_common(msg)` | `dict` | Common -> 플랫폼 형식 변환 |

**CommonMessage 스키마** (`schemas/common_message.py`):

```python
class CommonMessage(BaseModel):
    message_id: str
    timestamp: datetime
    type: MessageType          # text, file, image, reaction, command, system
    platform: Platform         # slack, teams, vms
    user: User                 # 발신자 정보
    channel: Channel           # 채널 정보
    text: Optional[str]
    attachments: list[Attachment] = []
    thread_id: Optional[str]
    raw_message: dict          # 원본 페이로드 (디버깅용)
    target_channels: list[Channel] = []  # 라우팅 대상
```

**Redis 라우팅 구조** (`services/route_manager.py`):

```
route:{platform}:{channel_id}               -> SMEMBERS (대상 채널 집합)
route:{platform}:{channel_id}:names         -> HGETALL  (대상 채널 이름)
route:{platform}:{channel_id}:modes         -> HGETALL  (sender_info | editable)
route:{platform}:{channel_id}:bidirectional -> HGETALL  ("1" | "0")
route:{platform}:{channel_id}:enabled       -> HGETALL  ("1" | "0")
```

양방향 Route: `add_route(is_bidirectional=True)` 호출 시 역방향 키도 자동 생성. UI에서는 `frozenset` 쌍 중복 제거로 1건으로 표시.

### 4.2 v-platform-portal

통합 앱 포털. AppRegistry로 앱 메타데이터를 관리하고, Token Relay SSO로 앱 간 자동 인증을 수행한다.

**백엔드 구조**:

```
apps/v-platform-portal/backend/app/
├── main.py                    # PlatformApp + 포털 라우터 등록
├── api/
│   └── portal.py              # AppRegistry CRUD + Token Relay
├── services/
│   └── app_registry.py        # 앱 메타데이터 관리
└── models/                    # (신규 추가 중)
```

**Token Relay SSO 흐름**:

```
사용자 -> Portal (로그인 상태)
  -> 앱 타일 클릭
  -> Portal: relay_token 생성 (1회성, Redis 10초 TTL)
  -> Browser: {app_url}/sso/relay?token=xxx 리다이렉트
  -> App: relay_token 소비 (Redis에서 1회성 검증)
  -> App: 동일 SECRET_KEY로 JWT 서명 검증
  -> App: 앱 JWT 발급 + 세션 생성
  -> 앱 대시보드로 리다이렉트
```

핵심: 모든 앱이 동일한 `SECRET_KEY` 환경변수를 공유하므로 JWT 서명 상호 검증이 가능하다. relay_token의 1회성 소비로 재생 공격을 방지한다.

### 4.3 v-platform-template

새 앱 시작을 위한 최소 스캐폴딩 템플릿. PlatformApp + Dashboard 페이지 1개 + 앱별 투어로 구성된다.

```
apps/v-platform-template/
├── backend/app/
│   ├── main.py                # PlatformApp (~30줄 유효 코드)
│   └── api/
│       └── dashboard.py       # 앱 고유 API 1개
└── frontend/src/
    ├── App.tsx                # 플랫폼 페이지 import + 앱 라우트
    ├── pages/
    │   ├── Dashboard.tsx      # 앱 고유 대시보드
    │   └── Help.tsx           # 앱 고유 도움말
    ├── hooks/useTour.ts       # 앱별 맞춤 투어
    └── lib/tour/              # 앱별 투어 스텝 정의
```

---

## 5. 새 모듈 배치 의사결정

### 5.1 의사결정 트리

새로운 기능이나 모듈을 추가할 때 다음 순서로 판단한다:

```
새 기능 요구사항
  |
  +--> 2개 이상의 앱에서 필요한가?
  |       |
  |       +--> YES --> 플랫폼에 추가
  |       |            (platform/backend/v_platform/ 또는
  |       |             platform/frontend/v-platform-core/src/)
  |       |
  |       +--> NO  --> 특정 앱에 추가
  |                     (apps/{app-name}/)
  |
  +--> 기존 플랫폼 기능을 확장하는가?
  |       |
  |       +--> YES --> 플랫폼에 추가
  |       |
  |       +--> NO  --> 아래 계속
  |
  +--> 인프라/보안/인증 관련인가?
          |
          +--> YES --> 플랫폼에 추가
          |
          +--> NO  --> 해당 앱에 추가
```

### 5.2 모듈 유형별 배치 기준

| 모듈 유형 | 배치 위치 | 예시 |
|----------|----------|------|
| 새 인증 방식 | `platform/backend/v_platform/sso/` | SAML Provider |
| 새 관리 페이지 | `platform/frontend/v-platform-core/src/pages/admin/` | IP 화이트리스트 관리 |
| 새 UI 컴포넌트 (범용) | `platform/frontend/v-platform-core/src/components/ui/` | Accordion, Stepper |
| 새 메시지 플랫폼 | `apps/v-channel-bridge/backend/app/adapters/` | DiscordProvider |
| 새 비즈니스 앱 | `apps/{new-app-name}/` | v-hr-management |
| 새 플랫폼 서비스 | `platform/backend/v_platform/services/` | SchedulerService |
| 새 마이그레이션 | `platform/backend/v_platform/migrations/` | p027_xxx.py |

### 5.3 새 앱 생성 절차

| 단계 | 작업 | 소요 시간 |
|------|------|----------|
| 1 | `cp -r apps/v-platform-template apps/{new-app-name}` | 1분 |
| 2 | `backend/app/main.py`에서 `app_name` 수정 | 1분 |
| 3 | `frontend/src/` 설정에서 앱 이름, 포트 수정 | 2분 |
| 4 | `docker-compose.yml`에 서비스 정의 추가 (profile 지정) | 3분 |
| 5 | 앱 고유 페이지를 `pages/`에 추가 | 가변 |
| 6 | `app_menu_keys` 배열에 메뉴 키 등록 | 1분 |
| 7 | `docker compose --profile {new-app} up -d --build` | 2분 |

스캐폴딩 총 소요 시간: 약 10분 (앱 고유 로직 작성 제외).

### 5.4 새 Provider 어댑터 추가 절차

| 단계 | 작업 |
|------|------|
| 1 | `apps/v-channel-bridge/backend/app/adapters/{platform}_provider.py` 생성 |
| 2 | `BasePlatformProvider` 상속, 8개 추상 메서드 구현 |
| 3 | `Platform` enum에 새 플랫폼 추가 (`schemas/common_message.py`) |
| 4 | Provider 등록 로직에 새 Provider 추가 |
| 5 | `.env`에 필요한 API 키/토큰 추가 |

### 5.5 새 SSO Provider 추가 절차

| 단계 | 작업 |
|------|------|
| 1 | `platform/backend/v_platform/sso/{provider}_provider.py` 생성 |
| 2 | `BaseSSOProvider` 상속, 인증 흐름 구현 |
| 3 | `sso/registry.py`에 Provider 등록 |
| 4 | 환경변수에 Client ID/Secret 추가 |
| 5 | 프론트엔드 `SSOButton` 컴포넌트에 Provider 표시 추가 |

---

## 6. 앱별 재사용률

### 6.1 플랫폼 재사용 현황

| 영역 | v-channel-bridge | v-platform-template | v-platform-portal |
|------|-----------------|-------------------|-------------------|
| 인증/JWT/세션 | 100% 재사용 | 100% | 100% |
| RBAC/권한 | 100% | 100% | 100% |
| 감사 로그 | 100% | 100% | 100% |
| 사용자/조직 관리 UI | 100% | 100% | 100% |
| 알림 시스템 | 100% | 100% | 100% |
| 관측성 (로그/메트릭) | 100% | 100% | 100% |
| UI 컴포넌트 라이브러리 | 100% | 100% | 100% |
| 디자인 시스템 토큰 | 100% | 100% | 100% |

### 6.2 앱 고유 코드 비중

| 지표 | v-channel-bridge | v-platform-template | v-platform-portal |
|------|-----------------|-------------------|-------------------|
| 앱 Backend 라우터 | 8개 | 0개 | 1개 |
| 앱 Backend 서비스 | 14개 | 0개 | 1개 |
| 앱 Frontend 페이지 | 약 6개 | 약 2개 | 약 4개 |
| 앱 DB 모델 | 2개 (Message, Account) | 0개 | 0개 (포털 앱 DB 추가 중) |
| **앱 고유 코드 비중** | 약 30% | 약 10% | 약 40% |

나머지 70~90%는 플랫폼이 제공하는 인증, RBAC, 감사, SSO, 알림, 관측성, UI를 그대로 사용한다.

### 6.3 Product Tour 확장 패턴

플랫폼이 `usePlatformTour` 훅을 제공하고, 각 앱은 자신의 투어 스텝만 정의한다.

```typescript
// apps/v-channel-bridge/frontend/src/hooks/useTour.ts
import { usePlatformTour } from "@v-platform/core";
import { dashboardSteps, channelsSteps } from "@/lib/tour";

export const useTour = () => usePlatformTour({
  dashboard: dashboardSteps,
  channels: channelsSteps,
});

// apps/v-channel-bridge/frontend/src/lib/tour/dashboardSteps.ts
export const dashboardSteps: DriveStep[] = [
  {
    element: "#providers-status",
    popover: {
      title: "Provider 상태",
      description: "Slack/Teams 연결 상태를 실시간으로 확인합니다.",
    },
  },
  // ...
];
```

`HelpPage`에서 앱이 등록한 투어 스텝을 자동으로 감지하여 "투어 시작" 버튼을 노출한다.

---

**최종 업데이트**: 2026-04-13
**문서 버전**: 3.0 (Platform/App 경계 규칙 + 의사결정 트리 중심으로 전면 재구성)
