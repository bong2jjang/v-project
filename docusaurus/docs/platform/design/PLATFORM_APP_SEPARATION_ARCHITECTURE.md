# 플랫폼과 앱의 분리 아키텍처

> **문서 버전**: 2.0  
> **최종 업데이트**: 2026-04-13  
> **범위**: v-platform 프레임워크와 앱 간 분리 구조, 통합 방식, 책임 경계

---

## 1. 개요

v-project는 **v-platform**(재사용 가능한 플랫폼 프레임워크)과 **앱**(비즈니스 로직)을 물리적으로 분리한 구조입니다. 플랫폼은 인증, RBAC, 감사로그, 알림, 메뉴, SSO, UI 컴포넌트 등 범용 기능을 제공하고, 각 앱은 자신의 고유 비즈니스 로직만 구현합니다.

### 1.1 왜 분리했는가

| 동기 | 설명 |
|------|------|
| **재사용성** | 인증/권한/감사 같은 범용 기능을 매 프로젝트마다 재구현하지 않습니다. `v-platform`을 그대로 가져와 새 앱을 시작합니다. |
| **독립 배포** | 플랫폼 업데이트가 앱 코드에 영향을 주지 않고, 앱 변경이 플랫폼을 건드리지 않습니다. |
| **팀 소유권 분리** | 플랫폼 팀과 앱 팀이 각자의 코드베이스를 독립적으로 관리합니다. |
| **확장성** | 새 앱을 추가할 때 플랫폼 코드를 복사하지 않고 의존성으로 사용합니다. |
| **일관성** | 모든 앱이 동일한 인증 체계, 권한 모델, UI 패턴을 공유합니다. |

### 1.2 현재 운영 중인 앱

| 앱 | 역할 | 포트 (Backend/Frontend) |
|----|------|----------------------|
| v-channel-bridge | Slack / Teams 메시지 브리지 | 8000 / 5173 |
| v-platform-template | 새 앱 시작 템플릿 (최소 구성 예시) | 8002 / 5174 |
| v-platform-portal | 통합 앱 포털, SSO Relay, 앱 런처 | 8080 / 5180 |

---

## 2. 레이어 구조

```
┌──────────────────────────────────────────────────────────┐
│                       앱 레이어                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ v-channel-   │  │ v-platform-  │  │ v-platform-  │    │
│  │ bridge       │  │ template     │  │ portal       │    │
│  │              │  │              │  │              │    │
│  │ Slack/Teams  │  │ 최소 구성     │  │ AppRegistry  │    │
│  │ 메시지 브리지 │  │ 스캐폴딩     │  │ SSO Relay    │    │
│  │ 어댑터/큐    │  │ 대시보드     │  │ 앱 런처       │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │             │
├─────────┴─────────────────┴─────────────────┴─────────────┤
│                    v-platform (프레임워크)                   │
│                                                            │
│  인증(JWT/SSO) | RBAC(3단계 권한) | 감사로그 | 알림 시스템    │
│  사용자 관리 | 조직도 | 메뉴 관리 | 시스템 설정 | 헬스체크     │
│  WebSocket | Prometheus 메트릭 | CSRF | Rate Limiting       │
│  UI Kit | 레이아웃 | 테마 | 스토어 | 훅                      │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                    인프라 레이어                             │
│  PostgreSQL 16 | Redis 7 | Docker Compose | MailHog        │
└────────────────────────────────────────────────────────────┘
```

### 2.1 핵심 원칙

- **v-platform은 불변 프레임워크입니다.** 앱이 플랫폼 코드를 직접 수정하지 않습니다.
- **앱은 가변 비즈니스 로직입니다.** 앱별 라우터, 모델, 서비스, 페이지를 자유롭게 추가합니다.
- **의존 방향은 단방향입니다.** 앱 -> 플랫폼 OK, 플랫폼 -> 앱 금지.

---

## 3. 디렉토리 구조

```
v-project/
├── platform/                              # v-platform 프레임워크
│   ├── backend/v_platform/                # Python 패키지
│   │   ├── app.py                         # PlatformApp 클래스 (진입점)
│   │   ├── core/                          # database, logging, exceptions
│   │   ├── models/                        # 플랫폼 모델 13개
│   │   ├── api/                           # 플랫폼 라우터 18개
│   │   ├── services/                      # 14개 서비스
│   │   ├── middleware/                    # CSRF, Prometheus metrics
│   │   ├── sso/                           # Microsoft, Generic OIDC
│   │   ├── utils/                         # auth, audit_logger, encryption, filters
│   │   ├── schemas/                       # Pydantic 스키마
│   │   ├── monitoring/                    # 메트릭 레지스트리
│   │   └── migrations/                    # p001 ~ p026
│   │
│   └── frontend/v-platform-core/          # npm 패키지: @v-platform/core
│       └── src/
│           ├── pages/                     # 18개 플랫폼 페이지
│           ├── providers/                 # PlatformProvider
│           ├── api/                       # API 클라이언트
│           ├── stores/                    # 6개 Zustand 스토어
│           ├── hooks/                     # 12개 훅
│           ├── components/                # 65+ 컴포넌트
│           └── lib/                       # navigation, tour, websocket, utils
│
├── apps/
│   ├── v-channel-bridge/                  # 앱: 메시지 브리지
│   │   ├── backend/app/                   # 앱 전용 API, 모델, 서비스, 어댑터
│   │   └── frontend/src/                  # 앱 전용 페이지, 컴포넌트
│   │
│   ├── v-platform-template/               # 앱: 템플릿
│   │   ├── backend/app/main.py            # PlatformApp만 (~30줄)
│   │   └── frontend/src/                  # 최소 앱 전용 UI
│   │
│   └── v-platform-portal/                 # 앱: 포털
│       ├── backend/app/                   # 포털 API, AppRegistry, 모델
│       └── frontend/src/                  # 포털 전용 UI
│
└── docker-compose.yml                     # 전체 서비스 (프로필 지원)
```

---

## 4. 백엔드 통합 방식

### 4.1 PlatformApp 클래스

모든 앱의 백엔드 진입점은 `PlatformApp` 인스턴스를 생성하는 것으로 시작합니다. `PlatformApp`은 FastAPI 애플리케이션을 내부에 감싸고, 플랫폼의 모든 미들웨어와 라우터를 자동으로 등록합니다.

```python
# platform/backend/v_platform/app.py

class PlatformApp:
    def __init__(
        self,
        app_name: str = "v-platform",
        version: str = "0.1.0",
        description: str = "",
        lifespan: Optional[Callable] = None,
        cors_origins: Optional[list[str]] = None,
        app_menu_keys: Optional[list[str]] = None,
    ):
        self.app_name = app_name
        self.app_menu_keys = app_menu_keys

        # 구조화 로깅 설정 (app_name 라벨 자동 주입)
        configure_platform_logging(app_name=app_name)

        self.fastapi = FastAPI(
            title=f"{app_name} API",
            description=description,
            version=version,
            lifespan=lifespan,
        )
        self.fastapi.state.app_id = app_name  # 모든 request에서 접근 가능

        self._setup_middleware(cors_origins)
        self._setup_rate_limiter()
        self._register_platform_routers()

    def register_app_routers(self, *routers):
        """앱 전용 라우터 등록"""
        for router in routers:
            self.fastapi.include_router(router)

    def init_platform(self):
        """DB 초기화, SSO 프로바이더 설정, 앱 메뉴 분류"""
        init_db()
        init_sso_providers()
        if self.app_menu_keys:
            self._classify_app_menus()
```

### 4.2 PlatformApp 생성자 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `app_name` | `str` | 앱 식별자. `request.app.state.app_id`에 설정됩니다. |
| `version` | `str` | FastAPI 문서에 표시되는 버전 |
| `description` | `str` | FastAPI 문서 설명 |
| `lifespan` | `Callable` | FastAPI lifespan 컨텍스트 매니저 (startup/shutdown) |
| `cors_origins` | `list[str]` | CORS 허용 오리진. 기본값은 `127.0.0.1:3000`, `127.0.0.1:5173` |
| `app_menu_keys` | `list[str]` | 이 앱에 속하는 메뉴의 `permission_key` 목록. 해당 메뉴의 `app_id`를 자동 설정합니다. |

### 4.3 PlatformApp이 자동으로 등록하는 라우터 (18개)

| 라우터 | 프리픽스 | 역할 |
|--------|----------|------|
| `auth` | `/api/auth` | JWT 로그인, 회원가입, 토큰 갱신 |
| `auth_sso` | `/api/auth/sso` | SSO 로그인 (Generic OIDC) |
| `auth_microsoft` | `/api/auth/microsoft` | Microsoft OAuth |
| `users` | `/api/users` | 사용자 CRUD |
| `user_oauth` | `/api/users/oauth` | 사용자별 OAuth 토큰 |
| `permissions` | `/api/permissions` | 개인 메뉴 권한 |
| `permission_groups` | `/api/permission-groups` | 권한 그룹 |
| `menus` | `/api/menus` | 동적 메뉴 |
| `organizations` | `/api/organizations` | 회사/부서 조직도 |
| `audit_logs` | `/api/audit-logs` | 감사 로그 |
| `system_settings` | `/api/system-settings` | 시스템 설정 (브랜딩 포함) |
| `health` | `/api/health` | 헬스체크 (DB, Redis + 커스텀) |
| `notifications` | `/api/notifications` | 실시간 알림 (WebSocket 기반) |
| `persistent_notifications` | `/api/notifications-v2` | 영속 알림 CRUD (DB 기반, scope) |
| `metrics` | `/metrics` | Prometheus 메트릭 익스포트 |
| `websocket` | `/api/ws` | WebSocket 연결 관리 |
| `uploads` | `/api/uploads` | 파일 업로드 |

### 4.4 미들웨어 자동 설정

`PlatformApp` 생성 시 다음 미들웨어가 자동으로 등록됩니다:

1. **MetricsMiddleware** -- Prometheus HTTP 요청 카운터 및 응답 시간 히스토그램
2. **CORSMiddleware** -- Cross-Origin Resource Sharing 허용
3. **CSRFMiddleware** -- CSRF 공격 방어

Rate Limiter(SlowAPI)도 자동으로 설정됩니다.

### 4.5 앱에서의 사용법

#### v-channel-bridge (실전 앱)

```python
# apps/v-channel-bridge/backend/app/main.py

from v_platform.app import PlatformApp
from v_platform.api.health import health_registry, ServiceHealth

# PlatformApp 생성 — 플랫폼 전체 기능이 자동 포함됨
platform = PlatformApp(
    app_name="v-channel-bridge",
    version="2.0.0",
    description="Slack / Teams Message Bridge",
    lifespan=lifespan,
    app_menu_keys=[
        "channels", "messages", "statistics",
        "integrations", "monitoring",
    ],
)

# 앱 전용 라우터만 추가 등록
platform.register_app_routers(
    bridge.router,
    messages.router,
    accounts_crud.router,
    accounts_test.router,
    teams_webhook.router,
    teams_notifications.router,
    monitoring.router,
)

# ASGI 앱 노출
app = platform.fastapi
```

#### v-platform-template (최소 앱)

```python
# apps/v-platform-template/backend/app/main.py

from v_platform.app import PlatformApp

platform = PlatformApp(
    app_name="v-platform-template",
    version="1.0.0",
    description="v-platform 새 앱 템플릿",
    lifespan=lifespan,
)

# 앱 전용 라우터 없음 — 플랫폼 기능만으로 동작
app = platform.fastapi
```

### 4.6 커스텀 헬스체크 등록

앱은 `HealthRegistry`를 통해 자체 서비스의 헬스 상태를 플랫폼 `/api/health` 응답에 포함시킬 수 있습니다.

```python
from v_platform.api.health import health_registry, ServiceHealth

def _check_bridge() -> ServiceHealth:
    b = get_bridge()
    if b and b.is_running:
        return ServiceHealth(status="healthy")
    return ServiceHealth(status="unhealthy", error="Bridge not running")

health_registry.register("bridge", _check_bridge)
```

결과 `/api/health` 응답:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "services": {
    "database": {"status": "healthy", "response_time_ms": 4.1},
    "redis": {"status": "healthy", "response_time_ms": 12.0},
    "bridge": {"status": "healthy"}
  }
}
```

### 4.7 app_id의 전파

`PlatformApp` 생성 시 `app_name`이 `request.app.state.app_id`에 설정됩니다. 플랫폼의 모든 API 핸들러는 이 값을 참조하여 앱별 데이터 격리를 수행합니다.

```
PlatformApp(app_name="v-channel-bridge")
    │
    └─> fastapi.state.app_id = "v-channel-bridge"
        │
        └─> 모든 요청에서 request.app.state.app_id 접근 가능
            │
            ├─> 메뉴 조회: 해당 앱 + 플랫폼 공통 메뉴만 반환
            ├─> 감사 로그: app_id 자동 기록
            ├─> 시스템 설정: 앱별 오버라이드 적용
            ├─> 알림: scope 기반 필터링
            └─> 권한 그룹: 앱별 분리
```

---

## 5. 프론트엔드 통합 방식

### 5.1 `@v-platform/core` 패키지

프론트엔드에서 플랫폼 기능은 `@v-platform/core` 패키지로 제공됩니다. 앱은 이 패키지에서 페이지, 컴포넌트, 훅, 스토어를 import하여 사용합니다.

```
platform/frontend/v-platform-core/src/
├── pages/           # 18개 플랫폼 페이지 (Login, Settings, Admin 등)
├── providers/       # PlatformProvider (Config + QueryClient)
├── api/             # API 클라이언트 (client, auth, users, permissions...)
├── stores/          # 6개 Zustand 스토어 (auth, permission, notification...)
├── hooks/           # 12개 훅 (useTheme, useWebSocket, useNotifications...)
├── components/      # 65+ 컴포넌트
│   ├── ui/          # 25개 기본 UI (Button, Card, Modal, Table...)
│   ├── layout/      # 11개 레이아웃 (Sidebar, TopBar, ContentHeader...)
│   ├── settings/    # 6개 설정 (Theme, Account, Session...)
│   ├── notifications/ # 6개 알림 (Bell, Popover, Toast, Banner...)
│   ├── auth/        # 3개 인증 (LoginForm, RegisterForm, ProtectedRoute)
│   ├── admin/       # 7개 관리 (MenuManagement, PermissionMatrix...)
│   └── common/      # 3개 공통
└── lib/             # navigation, resolveStartPage, tour, websocket, utils
```

### 5.2 앱의 App.tsx 구조

```tsx
// apps/v-channel-bridge/frontend/src/App.tsx

import {
  PlatformProvider,
  LoginPage,
  SettingsPage,
  AdminDashboard,
  // ... 18개 플랫폼 페이지
} from '@v-platform/core';

// 앱 전용 페이지
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Messages from './pages/Messages';
import Statistics from './pages/Statistics';

function App() {
  return (
    <PlatformProvider config={{ appName: 'v-channel-bridge', apiUrl: '...' }}>
      <Routes>
        {/* 플랫폼 페이지 (코어에서 import) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        {/* ... */}

        {/* 앱 전용 페이지 */}
        <Route path="/channels" element={<Channels />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/statistics" element={<Statistics />} />
      </Routes>
    </PlatformProvider>
  );
}
```

### 5.3 PlatformProvider

`PlatformProvider`는 앱의 최상위에 배치되어 다음을 설정합니다:

- **QueryClient** -- TanStack Query 인스턴스
- **AppConfig** -- API URL, 앱 이름, 기능 플래그
- **인증 상태 초기화** -- localStorage 토큰 복원
- **WebSocket 연결** -- 실시간 이벤트 수신

### 5.4 플랫폼 UI 컴포넌트 사용

앱 전용 페이지에서도 플랫폼의 UI 컴포넌트를 자유롭게 사용합니다:

```tsx
// 앱 전용 페이지에서 플랫폼 UI 사용
import { Card, Button, Table, Badge, ContentHeader } from '@v-platform/core';

function Channels() {
  return (
    <>
      <ContentHeader title="채널 관리" description="브리지 채널을 관리합니다" />
      <div className="page-container">
        <Card>
          <Table data={channels} columns={columns} />
        </Card>
      </div>
    </>
  );
}
```

---

## 6. 앱이 플랫폼에 제공해야 할 것

새 앱을 만들 때 반드시 제공해야 하는 항목입니다.

### 6.1 필수 항목

| 항목 | 설명 | 예시 |
|------|------|------|
| `app_name` | 고유한 앱 식별자 | `"v-channel-bridge"` |
| `main.py` | PlatformApp 인스턴스 생성 + 앱 라우터 등록 | 위 코드 참조 |
| `lifespan` | asynccontextmanager (startup/shutdown) | 브리지 초기화, 정리 |
| `Dockerfile` | Docker 빌드 설정 | `v_platform` 패키지 COPY 포함 |

### 6.2 선택 항목

| 항목 | 설명 |
|------|------|
| `app_menu_keys` | 앱 전용 메뉴의 permission_key 목록 (자동 app_id 태깅) |
| 앱 전용 라우터 | `register_app_routers()`로 등록 |
| 앱 전용 모델 | SQLAlchemy 모델 (v_platform.models.base.Base 상속) |
| 커스텀 헬스체크 | `health_registry.register()` |
| 앱 전용 프론트엔드 페이지 | React 컴포넌트 |
| 앱별 투어 스텝 | Driver.js 기반 가이드 투어 |

### 6.3 새 앱 생성 체크리스트

```
1. apps/{app-name}/ 디렉토리 생성
2. backend/app/main.py — PlatformApp 인스턴스 생성
3. frontend/src/App.tsx — PlatformProvider 래핑 + 플랫폼 페이지 import
4. Dockerfile, Dockerfile.dev 작성
5. docker-compose.yml에 서비스 추가 (프로필 사용 권장)
6. 앱 전용 라우터가 있으면 register_app_routers() 호출
7. 앱 전용 메뉴가 있으면 app_menu_keys 설정
8. 포털에 앱 등록 (Admin UI 또는 PORTAL_APPS 환경변수)
```

---

## 7. 플랫폼이 앱에게 제공하는 것

### 7.1 백엔드 기능

| 기능 | 모듈 | 설명 |
|------|------|------|
| **JWT 인증** | `api/auth.py` | 로그인, 회원가입, 토큰 갱신, 디바이스 추적 |
| **SSO** | `sso/microsoft.py`, `sso/generic_oidc.py` | Microsoft OAuth, Generic OIDC |
| **RBAC** | `api/permissions.py`, `api/permission_groups.py` | 3단계 권한: 개인 + 그룹 + MAX 계산 |
| **메뉴 관리** | `api/menus.py` | 동적 메뉴 CRUD, app_id 기반 격리, 섹션 분류 |
| **감사 로그** | `api/audit_logs.py`, `utils/audit_logger.py` | 모든 관리 액션 자동 기록, app_id 태깅 |
| **사용자 관리** | `api/users.py` | CRUD, 역할, 프로필, 시작 페이지, 테마 설정 |
| **조직도** | `api/organizations.py` | 회사/부서 계층 구조 |
| **시스템 설정** | `api/system_settings.py` | 키-값 설정, 앱별 오버라이드, 브랜딩 |
| **알림** | `api/persistent_notifications.py` | 4단계 scope (global/app/role/user), 3가지 전달 방식 |
| **WebSocket** | `api/websocket.py` | 실시간 이벤트 (상태, 알림, 브로드캐스트) |
| **헬스체크** | `api/health.py` | 플러그형 HealthRegistry, DB/Redis 자동 체크 |
| **메트릭** | `api/metrics.py`, `middleware/metrics.py` | Prometheus 메트릭 자동 수집 |
| **캐시** | `services/cache_service.py` | Redis 래퍼 |
| **이메일** | `services/email_service.py` | SMTP 발송 (비밀번호 재설정 등) |
| **암호화** | `utils/encryption.py` | Fernet 기반 토큰/비밀 암호화 |
| **CSRF** | `middleware/csrf.py` | CSRF 토큰 방어 |
| **Rate Limiting** | SlowAPI | 엔드포인트별 요청 제한 |

### 7.2 프론트엔드 기능

| 카테고리 | 제공 항목 |
|----------|----------|
| **페이지** | Login, Register, Settings, AdminDashboard, UserManagement, PermissionManagement, PermissionGroups, MenuManagement, OrganizationManagement, AuditLogs, SystemSettings, NotificationManagement, Profile, Help 등 18개 |
| **UI 컴포넌트** | Button, Card, Modal, Table, Tabs, Badge, Select, Input, Textarea, Switch, DatePicker, Dropdown, Toast, Tooltip 등 25개 |
| **레이아웃** | Sidebar, TopBar, ContentHeader, PageContainer, Layout, MobileNav 등 |
| **스토어** | auth, permission, notification, systemSettings, sessionSettings, user-oauth |
| **훅** | useTheme, useWebSocket, useNotifications, useBrowserNotification, useRealtimeStatus, useTokenExpiry, useActivityDetection, useIdleTimeout, useTabSync, useKeyboardShortcuts, useSidebar, useTour |
| **API 클라이언트** | Axios 기반, 자동 토큰 갱신, 에러 인터셉터 |
| **테마** | 다크모드, 7개 컬러 프리셋, CSS 변수 시맨틱 토큰 |
| **네비게이션** | 동적 메뉴 -> NavItem 변환, 시작 페이지 결정, 메뉴 그룹 |

---

## 8. 백엔드 의존 관계

### 8.1 정상적인 의존 방향

```
┌─────────────────────────────────────────────────┐
│ 앱 레이어                                        │
│                                                  │
│  apps/v-channel-bridge/backend/app/main.py       │
│      │                                           │
│      ├── from v_platform.app import PlatformApp  │
│      ├── from v_platform.api.health import ...   │
│      ├── from v_platform.core.database import ...│
│      └── from app.api import bridge, messages... │
│                                                  │
│  (앱은 플랫폼을 import한다)                        │
└──────────────────┬──────────────────────────────┘
                   │ 의존
┌──────────────────▼──────────────────────────────┐
│ 플랫폼 레이어                                     │
│                                                  │
│  platform/backend/v_platform/                    │
│      │                                           │
│      ├── app.py (PlatformApp)                    │
│      ├── core/ (database, logging)               │
│      ├── models/ (User, MenuItem, Notification...)│
│      ├── api/ (auth, menus, permissions...)       │
│      └── services/ (token, permission, cache...) │
│                                                  │
│  (플랫폼은 앱을 import하지 않는다)                  │
└─────────────────────────────────────────────────┘
```

### 8.2 금지된 의존 방향

```
# 이것은 금지입니다:
# platform/backend/v_platform/api/menus.py
from apps.v_channel_bridge.backend.app.models import SomeModel  # WRONG!
```

플랫폼은 어떤 상황에서도 특정 앱의 코드를 import하지 않습니다. 앱별 확장이 필요한 경우 HealthRegistry처럼 레지스트리 패턴을 사용합니다.

---

## 9. 플랫폼 모델 목록

v-platform이 관리하는 13개 모델입니다. 모든 앱이 동일한 테이블을 공유합니다.

| 모델 | 테이블 | app_id 격리 | 설명 |
|------|--------|-----------|------|
| `User` | `users` | X | 사용자 (전 앱 공유) |
| `RefreshToken` | `refresh_tokens` | O | JWT 갱신 토큰 |
| `PasswordResetToken` | `password_reset_tokens` | X | 비밀번호 재설정 |
| `MenuItem` | `menu_items` | O | 동적 메뉴 |
| `UserPermission` | `user_permissions` | X (메뉴 경유) | 사용자별 메뉴 권한 |
| `PermissionGroup` | `permission_groups` | O | 권한 그룹 |
| `PermissionGroupGrant` | `permission_group_grants` | X (그룹 경유) | 그룹별 메뉴 권한 |
| `UserGroupMembership` | `user_group_memberships` | X | 사용자-그룹 매핑 |
| `AuditLog` | `audit_logs` | O (자동 태깅) | 감사 로그 |
| `Company` | `companies` | X | 회사 |
| `Department` | `departments` | X | 부서 |
| `SystemSettings` | `system_settings` | O | 키-값 설정 |
| `Notification` | `notifications` | O | 영속 알림 |
| `NotificationRead` | `notification_reads` | X | 읽음 추적 |
| `NotificationAppOverride` | `notification_app_overrides` | O | 앱별 알림 활성화 |
| `UserOAuthToken` | `user_oauth_tokens` | X | OAuth 토큰 |

---

## 10. Docker 서비스 구성

```yaml
# docker-compose.yml (프로필 기반)

# 기본 서비스 (항상 실행)
services:
  postgres:         # PostgreSQL 16
  redis:            # Redis 7
  mailhog:          # 개발용 메일 서버
  v-channel-bridge-backend:   # 포트 8000
  v-channel-bridge-frontend:  # 포트 5173

# template 프로필
  v-platform-template-backend:   # 포트 8002, profiles: [template]
  v-platform-template-frontend:  # 포트 5174, profiles: [template]

# portal 프로필
  v-platform-portal-backend:     # 포트 8080, profiles: [portal]
  v-platform-portal-frontend:    # 포트 5180, profiles: [portal]
```

시작 명령:

```bash
# 기본 (v-channel-bridge만)
docker compose up -d --build

# 모든 앱
docker compose --profile template --profile portal up -d --build
```

---

## 11. 데이터 흐름 예시

### 11.1 사용자 로그인 -> 메뉴 로딩 -> 권한 체크

```
[사용자]
    │
    ├─ POST /api/auth/login ──> [플랫폼 auth 라우터]
    │       └─ JWT 발급 + RefreshToken 저장
    │
    ├─ GET /api/menus ──> [플랫폼 menus 라우터]
    │       └─ app_id=NULL (공통) + app_id="v-channel-bridge" (앱) 메뉴 반환
    │
    ├─ GET /api/permissions/matrix ──> [플랫폼 permissions 라우터]
    │       └─ MAX(개인 권한, 그룹 권한) 매트릭스 반환
    │
    └─ GET /api/bridge/status ──> [앱 bridge 라우터]
            └─ 브리지 연결 상태 반환
```

### 11.2 관리자가 알림을 생성하는 흐름

```
[관리자]
    │
    ├─ POST /api/notifications-v2 ──> [플랫폼 persistent_notifications 라우터]
    │       ├─ DB에 Notification 레코드 저장 (scope=app)
    │       └─ WebSocket으로 해당 앱 사용자에게 실시간 push
    │
    └─ [일반 사용자 브라우저]
            ├─ WebSocket 수신 -> Toast 표시
            └─ GET /api/notifications-v2 -> 알림 벨 목록 갱신
```

---

## 12. 요약

| 항목 | 설명 |
|------|------|
| **분리 단위** | `platform/` (프레임워크) vs `apps/{name}/` (비즈니스 로직) |
| **백엔드 통합** | `PlatformApp` 인스턴스 생성 + `register_app_routers()` |
| **프론트엔드 통합** | `@v-platform/core`에서 import + `PlatformProvider` 래핑 |
| **데이터 격리** | `app_id` 컬럼으로 메뉴/알림/설정/권한/감사로그 분리 |
| **의존 방향** | 앱 -> 플랫폼 (단방향), 플랫폼 -> 앱 금지 |
| **확장 방식** | 레지스트리 패턴 (HealthRegistry, app_menu_keys) |
| **인프라** | Docker Compose 프로필, 동일 PostgreSQL/Redis 공유 |
