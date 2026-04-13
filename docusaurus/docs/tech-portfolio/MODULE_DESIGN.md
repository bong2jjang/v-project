---
id: module-design
title: 모듈별 상세 설계 및 기술 특성
sidebar_position: 3
tags: [frontend, backend, design, tech-portfolio, platform]
---

# 모듈별 상세 설계 및 기술 특성

v-project는 **v-platform (플랫폼 공통 모듈)** + **3개 앱 (v-channel-bridge, v-platform-template, v-platform-portal)** 구조로 모듈을 분리 설계합니다. 본 문서는 계층별 구성, 재사용 전략, 앱별 고유 모듈의 기술적 특성을 상세히 기술합니다.

> **설계 원칙**
> - 플랫폼 모듈은 **100% 범용** — 앱 고유 코드가 단 한 줄도 섞이지 않음
> - 앱 모듈은 **플랫폼 기반 위에만** 구축 — auth/RBAC/audit 재구현 금지
> - 모든 앱 간 데이터는 **`app_id` 기반 격리** (p015 마이그레이션)

---

## 1. 모듈 계층 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  [Layer 3] 앱 고유 모듈 (App-specific)                            │
│  ├─ v-channel-bridge: Provider / Route / Message / Stats         │
│  ├─ v-platform-template: 최소 Dashboard                          │
│  └─ v-platform-portal: AppRegistry / SSO Relay / AppLauncher    │
├─────────────────────────────────────────────────────────────────┤
│  [Layer 2] 플랫폼 공통 모듈 (Platform Framework)                  │
│  Backend: v_platform (Python 패키지)                             │
│    ├─ PlatformApp (프레임워크 진입점)                            │
│    ├─ 18 라우터 (auth, users, roles, audit, sso, notify ...)     │
│    ├─ 14 서비스 (export, stats, notification, permission ...)    │
│    ├─ 14 모델 (User, Role, AuditLog, Menu, Notification ...)     │
│    └─ 24 마이그레이션 (p001~p024)                                │
│  Frontend: @v-platform/core (npm 패키지)                         │
│    ├─ 18 페이지 (Login/Profile/Users/Settings/Admin ...)         │
│    ├─ 6 스토어 (auth, permission, notification, settings ...)    │
│    ├─ 12 훅 (useTheme, useWebSocket, useNotifications ...)       │
│    └─ 65+ 컴포넌트 (ui, layout, settings, admin, auth ...)       │
├─────────────────────────────────────────────────────────────────┤
│  [Layer 1] 인프라 & 외부 의존 (Infrastructure)                    │
│  PostgreSQL 16 / Redis 7 / MailHog / Prometheus / Loki / Grafana │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Platform Frontend — `@v-platform/core`

### 2.1 기술 스택

| 계층 | 기술 | 버전 | 역할 |
|-----|------|------|------|
| **UI 프레임워크** | React | 18.2 | 컴포넌트 기반 선언적 UI |
| **빌드 도구** | Vite | 5.0 | ESBuild 기반 HMR |
| **언어** | TypeScript | 5.3 | 정적 타입 안전성 (strict) |
| **라우팅** | react-router-dom | 6.21 | SPA 라우팅 |
| **서버 상태** | TanStack Query | 5.17 | API 캐싱 + 갱신 |
| **클라이언트 상태** | Zustand | 4.4 | 경량 구독 상태 관리 |
| **HTTP 클라이언트** | Axios | 1.6 | 인터셉터 (JWT/CSRF 자동) |
| **CSS** | Tailwind CSS | 3.4 | 유틸리티 + 시맨틱 토큰 |
| **차트** | Recharts | 2.15 | SVG 반응형 차트 |
| **아이콘** | Lucide React | 0.309 | 트리셰이킹 SVG |
| **폰트** | Pretendard Variable | — | 한글 최적화 가변 |
| **디바이스 FP** | FingerprintJS | 4.2 | 브라우저 핑거프린팅 |
| **가이드 투어** | Driver.js | 1.3 | 앱별 맞춤 온보딩 |

### 2.2 플랫폼 페이지 (18개)

모든 앱이 `import` 한 줄로 재사용하는 공통 페이지들입니다.

| 페이지 | 경로 | 역할 | 접근 제어 |
|-------|------|------|----------|
| `LoginPage` | `/login` | 로그인 + SSO 진입 | Public |
| `RegisterPage` | `/register` | 회원가입 | Public |
| `ForgotPasswordPage` | `/forgot-password` | 비밀번호 재설정 요청 | Public |
| `ResetPasswordPage` | `/reset-password` | 재설정 토큰 검증/변경 | Public |
| `SSOCallbackPage` | `/sso/callback` | SSO 콜백 처리 | Public |
| `ForbiddenPage` | `/forbidden` | 403 권한 부족 | Public |
| `ProfilePage` | `/profile` | 내 프로필 | Auth |
| `PasswordChangePage` | `/password-change` | 비밀번호 변경 | Auth |
| `IntegrationsPage` | `/integrations` | OAuth 연동 관리 | Auth |
| `HelpPage` | `/help` | 도움말 (앱별 투어) | Auth |
| `CustomIframePage` | `/custom-iframe/:id` | 관리자 정의 iframe | Auth |
| `UsersPage` | `/admin/users` | 사용자 관리 | Admin |
| `PermissionsPage` | `/admin/permissions` | 권한/역할 관리 | Admin |
| `OrganizationsPage` | `/admin/organizations` | 조직도 관리 | Admin |
| `MenuManagementPage` | `/admin/menus` | 메뉴/사이드바 관리 | Admin |
| `AuditLogsPage` | `/audit-logs` | 감사 로그 | Admin |
| `MonitoringPage` | `/monitoring` | 서비스 헬스 모니터링 | Admin |
| `NotificationsPage` | `/notifications` | 알림 관리 | Admin |
| `SettingsPage` | `/settings` | 시스템/세션/보안/테마/백업 | Auth + Admin 탭 |

### 2.3 Zustand 스토어 (6개)

```
┌──────────────────────────────────────────────────┐
│           @v-platform/core/stores                  │
├──────────────────────────────────────────────────┤
│  authStore                                         │
│    ├── user, tokens, isAuthenticated               │
│    ├── login(), logout(), refreshToken()           │
│    └── persist: localStorage (tokens)              │
│                                                    │
│  permissionStore                                   │
│    ├── roles, permissions, menuKeys                │
│    ├── hasPermission(key)                          │
│    └── 서버 기반 메뉴 필터링 지원                    │
│                                                    │
│  notificationStore                                 │
│    ├── notifications, unreadCount, banners         │
│    ├── WebSocket 실시간 수신                        │
│    └── 시스템/앱 알림 구분                          │
│                                                    │
│  systemSettingsStore                               │
│    ├── branding, smtp, security, sso               │
│    └── Admin 페이지 전용                            │
│                                                    │
│  sessionSettingsStore                              │
│    ├── idleTimeout, autoExtend, warning            │
│    └── persist: localStorage                        │
│                                                    │
│  userOAuthStore                                    │
│    ├── linkedProviders (MS/Google/GitHub)           │
│    └── 연동/해제 액션                                │
└──────────────────────────────────────────────────┘
```

### 2.4 커스텀 훅 (12개)

| 훅 | 재사용 범위 | 기능 |
|---|------------|------|
| `useTheme` | 전역 | 다크/라이트 모드 토글 + 시스템 설정 연동 |
| `useWebSocket` | 다목적 | 범용 WebSocket 연결 관리 (재연결 포함) |
| `useRealtimeStatus` | Dashboard | 상태 실시간 구독 |
| `useNotifications` | TopBar | 알림 실시간 수신 + 읽음 처리 |
| `useTokenExpiry` | 인증 | 토큰 만료 카운트다운 |
| `useIdleTimeout` | 전역 | 유휴 감지 → 세션 경고 |
| `useActivityDetection` | 전역 | 마우스/키보드 활동 추적 |
| `useKeyboardShortcuts` | 전역 | 단축키 바인딩 |
| `useSidebar` | Layout | 사이드바 접기/펼치기 |
| `useTabSync` | 전역 | 멀티 탭 상태 동기화 (BroadcastChannel) |
| `useBrowserNotification` | 전역 | 네이티브 브라우저 알림 권한/표시 |
| `useApiErrorHandler` | API 호출 | 에러 추상화 + 토스트 |
| `useTour` | 앱별 확장 | Driver.js 기반 앱 맞춤 투어 |

### 2.5 컴포넌트 라이브러리 (65+)

| 카테고리 | 개수 | 대표 컴포넌트 |
|---------|-----|--------------|
| **UI Primitives** | 25 | Button, Input, Select, Card, Table, Modal, Tabs, Badge, Alert, Tooltip, Toggle, DateRangePicker, MultiSelect, Spinner, EmptyState |
| **Layout** | 11 | Layout, Sidebar, TopBar, ContentHeader, UserMenu, Breadcrumb, AppSwitcher, NotificationBell, ThemeToggle, HelpButton, LogoutButton |
| **Settings** | 6 | ConfigEditor, BackupList, SecurityTab, ThemeSettings, SystemSettingsTab, SessionSettings |
| **Profile** | 2 | PasswordChangeForm, SessionDeviceList |
| **OAuth** | 3 | AdminOAuthOverview, UserOAuthList, OAuthProviderCard |
| **Admin** | 7 | UserTable, UserModal, PermissionMatrix, RoleEditor, OrgTree, MenuEditor, AuditLogFilter |
| **Auth** | 3 | LoginForm, SSOButton, TokenExpiryManager |
| **Common** | 3 | ConnectionStatus, StatusDetailPopup, ProtectedRoute |
| **Notifications** | 6 | NotificationBell, NotificationPopover, Toast, Banner, NotificationCard, NotificationSettings |

### 2.6 디자인 시스템 — 시맨틱 토큰

```css
/* 색상 토큰 */
--color-brand-500             /* 브랜드 */
--color-status-success        /* 성공 */
--color-status-danger         /* 에러 */
--color-status-warning        /* 경고 */
--color-status-info           /* 정보 */

/* 표면 계층 */
--color-surface-page          /* 페이지 배경 */
--color-surface-card          /* 카드 배경 */
--color-surface-raised        /* 팝업/드롭다운 */
--color-surface-overlay       /* 모달 오버레이 */

/* 텍스트 계층 */
--color-content-primary       /* 기본 텍스트 */
--color-content-secondary     /* 보조 */
--color-content-tertiary      /* 약한 텍스트 */
--color-content-link          /* 링크 */
```

#### 타이포그래피 스케일

| 토큰 | 크기 | 두께 | 용도 |
|-----|------|------|------|
| `heading-xl` | 28px | 700 | 페이지 제목 |
| `heading-lg` | 22px | 600 | 섹션 제목 |
| `heading-md` | 18px | 600 | 카드 제목 |
| `body-base` | 14px | 400 | 본문 |
| `body-sm` | 12px | 400 | 보조 |
| `caption` | 11px | 400 | 캡션 |
| `overline` | 10px | 600 | 오버라인 |

**폰트**: Pretendard Variable (한글) + Inter (영문) + JetBrains Mono (코드)

#### 페이지 레이아웃 패턴 (모든 앱 공통)

```tsx
// 표준 페이지 구조
export default function PageName() {
  return (
    <>
      <ContentHeader title="제목" description="설명" />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 페이지 콘텐츠 */}
        </div>
      </div>
    </>
  );
}
```

---

## 3. Platform Backend — `v_platform`

### 3.1 PlatformApp 진입점

```python
# v_platform/app.py 핵심 구조
class PlatformApp:
    def __init__(self, app_name, app_menu_keys, lifespan, ...):
        self._app = FastAPI(lifespan=lifespan)
        self._register_middlewares()        # CSRF, Prometheus, 에러 핸들러
        self._register_platform_routers()   # 18개 라우터 일괄 등록
        self._register_health()             # /api/health, /metrics
        self._register_exception_handlers() # HTTPException, ValidationError

    def register_app_routers(self, *routers):
        """앱 고유 라우터 등록"""
        for router in routers:
            self._app.include_router(router)

    def get_app(self) -> FastAPI:
        return self._app
```

### 3.2 플랫폼 라우터 (18개)

| 라우터 | 경로 | 역할 |
|-------|------|------|
| `auth` | `/api/auth/*` | 로그인/로그아웃/토큰 갱신/비밀번호 재설정 |
| `users` | `/api/users/*` | 사용자 CRUD + 역할 변경 |
| `roles` | `/api/roles/*` | 역할 정의 + 권한 매핑 |
| `permissions` | `/api/permissions/*` | 권한 키 카탈로그 |
| `organizations` | `/api/organizations/*` | 조직 트리 (3레벨) |
| `menus` | `/api/menus/*` | 메뉴 관리 + 사이드바 (app_id 필터) |
| `audit_logs` | `/api/audit-logs/*` | 감사로그 조회/통계/내보내기 |
| `sso` | `/api/sso/*` | MS Azure AD / 범용 OIDC |
| `oauth` | `/api/oauth/*` | 사용자 OAuth 연동 |
| `notifications` | `/api/notifications/*` | 시스템/앱 알림 + 배너 |
| `system_settings` | `/api/system-settings` | 시스템 설정 (브랜딩/SMTP/보안) |
| `session` | `/api/session/*` | 세션 관리 + 디바이스 |
| `health` | `/api/health` | 인프라 헬스 집계 |
| `monitoring` | `/api/monitoring/*` | 서비스별 헬스 상태 |
| `export` | `/api/export/*` | CSV/JSON 내보내기 공통 |
| `websocket` | `/ws/*` | WebSocket 연결 + 브로드캐스트 |
| `config` | `/api/config/*` | 앱 설정 백업/복원 |
| `branding` | `/api/branding/*` | 로고/색상/폰트 동적 |

### 3.3 플랫폼 서비스 (14개)

| 서비스 | 책임 |
|-------|------|
| `NotificationService` | 알림 생성/발송/읽음 처리, WebSocket 푸시 |
| `PermissionService` | RBAC 검증, 권한 키 해석 |
| `AuditLogService` | 감사로그 작성 (`@audit_log` 데코레이터) |
| `ExportService` | CSV/JSON 스트리밍 내보내기 |
| `StatsService` | 집계 쿼리 + 시계열 통계 |
| `EventBroadcaster` | WebSocket 이벤트 팬아웃 |
| `LogBufferService` | 메모리 로그 버퍼링 + WebSocket 전송 |
| `FeatureChecker` | Provider별 기능 카탈로그 검증 |
| `CacheService` | Redis 래퍼 (TTL 관리) |
| `EmailService` | SMTP 발송 + 템플릿 렌더링 |
| `SSOService` | SSO 상태 관리 + 토큰 교환 |
| `OAuthService` | OAuth 연동 상태 관리 |
| `SessionService` | 세션 + 디바이스 추적 |
| `HealthRegistry` | 서비스별 헬스체크 등록 |

### 3.4 플랫폼 데이터 모델 (14개)

| 모델 | 주요 컬럼 | 용도 |
|-----|----------|------|
| `User` | id, email, password_hash, role_id | 사용자 |
| `Role` | id, name, permissions (JSONB) | 역할 |
| `Organization` | id, name, parent_id, level | 조직 트리 |
| `AuditLog` | id, app_id, user_id, action, resource, status, meta | 감사로그 (app_id 격리) |
| `MenuItem` | id, app_id, key, path, parent_id, order | 메뉴 (app_id 격리) |
| `Notification` | id, app_id, user_id, type, title, body, read_at | 알림 (app_id 격리) |
| `NotificationBanner` | id, app_id, message, active, expires_at | 상단 배너 |
| `SystemSetting` | app_id, key, value (JSONB) | 설정 (app_id 격리) |
| `Session` | id, user_id, device_id, expires_at | 세션 |
| `Device` | id, user_id, fingerprint, user_agent | 디바이스 |
| `OAuthConnection` | id, user_id, provider, provider_user_id | OAuth 연동 |
| `SSOState` | state, nonce, redirect_uri, expires_at | SSO 교환 상태 |
| `PasswordResetToken` | token_hash, user_id, expires_at | 재설정 토큰 |
| `EmailTemplate` | id, key, subject, body | 이메일 템플릿 |

### 3.5 마이그레이션 체계 (p001~p024)

| 번호 | 내용 |
|-----|------|
| p001 | 초기 스키마 (User, Role, Session) |
| p005 | Organization 트리 |
| p008 | AuditLog |
| p011 | Notification + Banner |
| p013 | OAuth + SSO |
| **p015** | **Multi-App isolation — menu/audit/settings에 `app_id` 컬럼** |
| p018 | MenuItem 확장 (custom iframe) |
| p021 | SystemSetting (branding) |
| p024 | Notification active 토글 |

---

## 4. 앱별 모듈 — v-channel-bridge

### 4.1 역할

Slack ↔ Teams 양방향 메시지 브리지. 네이티브 Provider 어댑터와 Redis 기반 라우팅 엔진으로 실시간 메시지 라우팅.

### 4.2 백엔드 모듈 구조

```
apps/v-channel-bridge/backend/app/
├── main.py                    # PlatformApp + register_app_routers() (30~50줄)
├── adapters/                  # Provider 어댑터 (앱 고유)
│   ├── base.py                # BasePlatformProvider 재노출
│   ├── slack_provider.py      # Slack Socket Mode
│   └── teams_provider.py      # Teams Bot Framework + Graph API
├── api/                       # 앱 고유 API
│   ├── bridge.py              # 브리지 제어, Route CRUD
│   ├── messages.py            # 메시지 조회/검색/내보내기
│   ├── accounts.py            # Provider 계정 관리
│   └── teams_webhook.py       # Teams 웹훅 수신
├── models/                    # 앱 고유 모델
│   ├── message.py             # Message (발신자/경로/상태)
│   └── account.py             # ProviderAccount
└── services/                  # 앱 고유 서비스
    ├── websocket_bridge.py    # Provider 수신 → 라우팅 → 전송
    ├── route_manager.py       # Redis 라우팅 엔진
    ├── message_queue.py       # 배치 처리/재시도
    ├── provider_registry.py   # Provider 인스턴스 관리
    └── message_store.py       # Message 테이블 저장
```

### 4.3 Provider 어댑터 패턴

```python
class BasePlatformProvider(ABC):
    """모든 메시지 플랫폼 어댑터의 베이스"""

    @abstractmethod
    async def connect(self) -> None: ...
    @abstractmethod
    async def disconnect(self) -> None: ...
    @abstractmethod
    async def send_message(self, channel_id: str, msg: CommonMessage) -> str: ...
    @abstractmethod
    async def get_channels(self) -> list[Channel]: ...
    @abstractmethod
    async def test_connection(self) -> TestResult: ...

    def normalize(self, raw) -> CommonMessage:
        """플랫폼 고유 메시지 → CommonMessage 변환"""
```

#### SlackProvider 특성

| 항목 | 구현 |
|-----|------|
| 연결 방식 | Socket Mode (`SLACK_APP_TOKEN` xapp-) |
| 수신 이벤트 | `message`, `message.channels` |
| 사용자 조회 | `users.info` → `real_name` 캐싱 |
| 채널 목록 | `conversations.list` |
| 메시지 전송 | `chat.postMessage` (block kit 지원) |

#### TeamsProvider 특성

| 항목 | 구현 |
|-----|------|
| 연결 방식 | Bot Framework + Microsoft Graph |
| 인증 | Azure AD 앱 (Tenant ID + App ID + Secret) |
| 수신 | 웹훅 (`/api/teams/webhook`) |
| 채널 ID 형식 | `{teamId}:{channelId}` (파싱 필요) |
| 메시지 전송 | Graph `POST /teams/{id}/channels/{id}/messages` |
| 필수 권한 | `ChannelMessage.Read.All`, `ChannelMessage.Send`, `Team.ReadBasic.All` |

### 4.4 CommonMessage 스키마

```python
class CommonMessage(BaseModel):
    """플랫폼 중립 메시지 표현"""
    message_id: str
    platform: Literal["slack", "teams"]
    source_channel_id: str
    source_channel_name: str
    sender_name: str
    sender_id: str
    text: str
    attachments: list[Attachment] = []
    timestamp: datetime
    thread_id: str | None = None
    original_raw: dict  # 원본 페이로드 (디버깅용)
```

### 4.5 Redis 라우팅 구조

```
route:{platform}:{channel_id}               → SMEMBERS (대상 집합)
route:{platform}:{channel_id}:names         → HGETALL (채널 이름)
route:{platform}:{channel_id}:modes         → HGETALL (sender_info | editable)
route:{platform}:{channel_id}:bidirectional → HGETALL ("1" | "0")
route:{platform}:{channel_id}:enabled       → HGETALL ("1" | "0")
```

**양방향 Route**: `add_route(is_bidirectional=True)` → 역방향 키 자동 생성. UI에선 `frozenset` 쌍 중복 제거로 1개 표시.

### 4.6 프론트엔드 페이지 (앱 고유 + 플랫폼)

| 페이지 | 경로 | 출처 |
|-------|------|------|
| `Dashboard` | `/` | 앱 고유 (Provider 상태 + 메시지 흐름) |
| `Channels` (Routes) | `/channels` | 앱 고유 (Route CRUD) |
| `Messages` | `/messages` | 앱 고유 (이력 검색) |
| `Statistics` | `/statistics` | 앱 고유 (5종 차트) |
| `Settings` | `/settings` | **플랫폼** + 앱 Provider 탭 확장 |
| 기타 18개 | 다양 | **플랫폼 (@v-platform/core)** |

### 4.7 Dashboard 구조

```
Dashboard.tsx (앱 고유)
├── ProvidersStatusCard     ← Slack/Teams 연결 상태
├── RealtimeMetricsChart    ← Recharts 실시간 메시지 처리량
├── MessageFlowWidget       ← Source → Target 방향 시각화
├── RecentActivityStream    ← 시간순 이벤트 스트림
└── LogViewer               ← WebSocket 기반 로그 스트리밍
```

### 4.8 Routes 페이지 데이터 흐름

```
User: Route 추가 클릭
  → RouteModal 오픈
  → 플랫폼 선택 시 GET /api/bridge/channels/{platform}
  → 채널 목록 Zustand routes 스토어 캐시
  → Source/Target 선택, 모드/양방향 설정
  → POST /api/bridge/routes (양방향 시 역방향 자동)
  → RouteList 자동 갱신 (TanStack Query invalidate)
```

**메시지 모드**:

| 모드 | 표시 | 편집 | 사용 시나리오 |
|-----|------|------|-------------|
| `sender_info` | `[발신자] 메시지` (아바타) | ❌ | 발신자 식별 우선 |
| `editable` | 봇 명의 | ✅ | 수정/삭제 동기화 우선 |

### 4.9 Messages 페이지 — 고급 검색

```typescript
interface MessageSearchParams {
  search?: string;               // 전문 검색
  page: number;
  per_page: number;              // 기본 20
  gateway?: string;              // slack→teams 등
  source_channel?: string;
  destination_channel?: string;
  source_user?: string;
  status?: "pending" | "sent" | "failed" | "retrying";
  start_date?: string;
  end_date?: string;
}
```

내보내기: `POST /api/messages/export/csv` / `/json`

### 4.10 Statistics 페이지 — 5종 차트

| 차트 | 종류 | 내용 |
|-----|------|------|
| `MessageTrendChart` | AreaChart | 일/시간별 메시지 추이 |
| `PlatformDirectionChart` | BarChart | slack→teams vs teams→slack |
| `ChannelDistributionChart` | PieChart | 채널별 비율 |
| `DeliveryStatusChart` | BarChart | sent/failed/retrying |
| `HourlyDistributionChart` | BarChart | 0~23시 밀도 |

데이터: `GET /api/messages/stats/summary` → 집계 테이블 `MessageStats`

---

## 5. 앱별 모듈 — v-platform-template

### 5.1 역할

새 앱 시작을 위한 **최소 스캐폴딩 템플릿**. PlatformApp + 1개 Dashboard 페이지 + 앱별 투어.

### 5.2 백엔드 구조

```python
# apps/v-platform-template/backend/app/main.py (~30줄)
from v_platform.app import PlatformApp

platform = PlatformApp(
    app_name="v-platform-template",
    app_menu_keys=["dashboard", "settings"],
    lifespan=lifespan,
)
app = platform.get_app()
```

### 5.3 프론트엔드 구조

```
apps/v-platform-template/frontend/src/
├── App.tsx                    # 플랫폼 페이지 import + 앱 라우트
├── pages/
│   ├── Dashboard.tsx          # 앱 고유 대시보드
│   └── NotificationManagement.tsx
├── hooks/useTour.ts           # 앱별 맞춤 투어
└── lib/tour/                  # 앱별 투어 스텝
```

### 5.4 새 앱 복제 가이드

```bash
# 1. 템플릿 복제
cp -r apps/v-platform-template apps/my-new-app

# 2. app_name 수정 (backend + frontend config)
# 3. docker-compose.yml에 서비스 추가 (profile 지정)
# 4. 앱 고유 페이지 pages/ 에 추가
# 5. 메뉴 키 등록 (app_menu_keys 배열)

docker compose --profile my-app up -d --build
```

**총 소요 시간**: ~10분 (파일 수정 + 빌드)

---

## 6. 앱별 모듈 — v-platform-portal

### 6.1 역할

통합 앱 포털. AppRegistry로 앱 메타데이터 관리, **Token Relay SSO**로 앱 간 자동 인증, 사이트맵/런처 UI 제공.

### 6.2 백엔드 구조

```
apps/v-platform-portal/backend/
├── main.py
├── api/
│   ├── apps.py                # AppRegistry CRUD
│   ├── launcher.py            # 앱 런처 메타데이터
│   ├── sitemap.py             # 전 앱 사이트맵 집계
│   └── relay.py               # SSO Relay (JWT 재발급)
├── models/
│   └── app_registry.py        # App (id, name, url, icon, order)
└── services/
    └── relay_service.py       # 상호 신뢰 JWT 검증 + 재발급
```

### 6.3 Token Relay SSO 흐름

```
User → Portal (이미 로그인)
  │
  │ 앱 타일 클릭
  ▼
Portal: POST /api/relay/generate
  ├── 현재 JWT 검증
  ├── 대상 앱 URL + 1회성 relay_token 생성 (10초 TTL, Redis)
  └── redirect_url 반환
  │
  ▼
Browser: 리다이렉트 → {app_url}/sso/relay?token=xxx
  │
  ▼
App: GET /api/auth/relay?token=xxx
  ├── Redis에서 relay_token 소비 (1회성)
  ├── 같은 SECRET_KEY로 JWT 검증
  ├── 앱 JWT 재발급 + 세션 생성
  └── 앱 대시보드로 리다이렉트
```

**핵심**: 모든 앱이 **동일한 `SECRET_KEY`**를 공유 → JWT 서명 상호 검증 가능. 1회성 relay_token으로 재생 공격 방지.

### 6.4 프론트엔드 페이지

| 페이지 | 경로 | 역할 |
|-------|------|------|
| `PortalHome` | `/` | 앱 런처 (타일 그리드) |
| `AppManagement` | `/admin/apps` | 앱 메타데이터 CRUD |
| `Sitemap` | `/sitemap` | 전 앱 메뉴 집계 뷰 |
| `Help` | `/help` | 포털 가이드 + 앱별 투어 |
| `NotificationManagement` | `/admin/notifications` | 전 앱 알림 집계 관리 |

---

## 7. API 클라이언트 아키텍처

### 7.1 단일 Axios 인스턴스 공유

```typescript
// @v-platform/core/api/client.ts
const apiClient = axios.create({ baseURL });

// 요청: JWT + CSRF 자동 첨부
apiClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  config.headers["X-CSRF-Token"] = getCSRF();
  return config;
});

// 응답: 401 시 토큰 자동 갱신 (큐잉으로 race condition 방지)
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      await refreshToken();  // 3회 실패 시 로그아웃
      return apiClient(originalRequest);
    }
    throw error;
  },
);
```

### 7.2 플랫폼 API 모듈

| 모듈 | 엔드포인트 | 기능 |
|-----|----------|------|
| `auth.ts` | `/api/auth/*` | 로그인, 토큰 갱신, 디바이스 |
| `users.ts` | `/api/users/*` | 사용자 CRUD |
| `permissions.ts` | `/api/permissions/*` | 권한/역할 |
| `menus.ts` | `/api/menus/*` | 메뉴 + 사이드바 (app_id) |
| `auditLogs.ts` | `/api/audit-logs/*` | 감사로그 |
| `notifications.ts` | `/api/notifications/*` | 알림 |
| `systemSettings.ts` | `/api/system-settings` | 시스템 설정 |
| `organizations.ts` | `/api/organizations/*` | 조직 |
| `monitoring.ts` | `/api/monitoring/*` | 헬스 |
| `sso.ts` | `/api/sso/*` | SSO |
| `oauth.ts` | `/api/oauth/*` | OAuth 연동 |
| `session.ts` | `/api/session/*` | 세션 |
| `branding.ts` | `/api/branding/*` | 브랜딩 |

### 7.3 앱별 API 모듈 예시 (v-channel-bridge)

| 모듈 | 엔드포인트 | 기능 |
|-----|----------|------|
| `bridge.ts` | `/api/bridge/*` | 브리지 제어, Route CRUD |
| `providers.ts` | `/api/providers/*` | Provider CRUD, 연결 테스트 |
| `messages.ts` | `/api/messages/*` | 메시지 검색/내보내기 |
| `accounts.ts` | `/api/accounts/*` | 계정 관리 |

---

## 8. 라우팅 & 접근 제어

### 8.1 라우트 계층

```
/ (App.tsx)
├── Public
│   ├── /login, /register, /forgot-password, /reset-password
│   ├── /sso/callback             (SSO 콜백)
│   └── /forbidden (403)
│
├── Auth (로그인 필요)
│   ├── / (앱별 Dashboard)
│   ├── /profile, /password-change
│   ├── /integrations, /help
│   └── /custom-iframe/:id        (관리자 정의 iframe)
│
├── Admin (관리자 역할)
│   ├── /admin/users, /admin/permissions, /admin/organizations
│   ├── /admin/menus, /admin/apps (포털만)
│   ├── /audit-logs, /monitoring
│   └── /notifications
│
└── App-specific (앱 고유)
    ├── v-channel-bridge: /channels, /messages, /statistics
    └── v-platform-portal: /sitemap
```

### 8.2 접근 제어 3단계

1. **`ProtectedRoute`** — `isAuthenticated` 체크 → 미인증 시 `/login`
2. **`RoleBasedRoute`** — `requiredRole` 체크 → 부족 시 `/forbidden`
3. **서버 기반 메뉴 필터링** — `GET /api/menus/sidebar?app_id=xxx` → RBAC 결과만 반환

---

## 9. 재사용성 종합

### 9.1 컴포넌트 재사용 계층

```
┌──────────────────────────────────────┐
│ Layer 3: Feature Components          │ ← 페이지 단위 조합
│ (RouteList, ProviderCard, ...)       │   (앱 고유)
├──────────────────────────────────────┤
│ Layer 2: Composition Components      │ ← 복합 UI 패턴
│ (ChannelInputField, SearchBar, ...)  │   (앱 or 플랫폼)
├──────────────────────────────────────┤
│ Layer 1: UI Primitives (25개)        │ ← 기본 빌딩 블록
│ (Button, Input, Card, Modal, ...)    │   (@v-platform/core)
└──────────────────────────────────────┘
```

### 9.2 앱별 재사용률

| 영역 | v-channel-bridge | v-platform-template | v-platform-portal |
|-----|-----------------|-------------------|-------------------|
| 인증/JWT/세션 | 100% 재사용 | 100% | 100% |
| RBAC/권한 | 100% | 100% | 100% |
| 감사로그 | 100% | 100% | 100% |
| 사용자/조직 UI | 100% | 100% | 100% |
| 알림 시스템 | 100% | 100% | 100% |
| 관측성 (로그/메트릭) | 100% | 100% | 100% |
| UI Primitives | 100% | 100% | 100% |
| 디자인 토큰 | 100% | 100% | 100% |
| **앱 고유 기능 비중** | ~30% | ~10% | ~40% |

### 9.3 통합 전후 비교 (v-channel-bridge 사례)

| 기존 개별 도구 | v-project 통합 후 |
|---------------|-----------------|
| 외부 브리지 CLI | Dashboard + Bridge 제어 API |
| TOML 설정 편집 | Routes 페이지 UI |
| 별도 Slack Admin | Settings → Provider 관리 |
| 별도 Azure Portal | Settings → Teams Provider |
| SQLite 직접 조회 | Messages 페이지 |
| SSH 로그 조회 | Dashboard LogViewer + Grafana Loki |
| Grafana 별도 접속 | Monitoring 페이지 + 직접 링크 |
| **앱별 인증 재구현** | **v-platform 1회 구현 → 전 앱 공유** |

---

## 10. 앱별 맞춤 투어 (Product Tour)

Driver.js 기반 투어 시스템을 플랫폼이 제공하고, 각 앱은 자신의 스텝만 정의합니다.

```typescript
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

// apps/v-channel-bridge/frontend/src/hooks/useTour.ts
import { usePlatformTour } from "@v-platform/core";
import { dashboardSteps, channelsSteps } from "@/lib/tour";

export const useTour = () => usePlatformTour({
  dashboard: dashboardSteps,
  channels: channelsSteps,
});
```

각 앱이 앱 고유 투어 스텝을 정의하면, `HelpPage`에서 자동으로 "투어 시작" 버튼 노출.

---

**최종 업데이트**: 2026-04-13
**문서 버전**: 2.0 (v-project 멀티 앱 플랫폼 아키텍처 반영)
