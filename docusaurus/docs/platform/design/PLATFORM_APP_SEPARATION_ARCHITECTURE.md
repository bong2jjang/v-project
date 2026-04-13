# Platform / App 분리 아키텍처 설계

> **문서 버전**: 1.0  
> **작성일**: 2026-04-11  
> **상태**: 검토 대기 (Draft)  
> **목적**: 현재 VMS Channel Bridge 코드베이스를 **재사용 가능한 플랫폼 프레임워크**와 **앱별 비즈니스 로직**으로 분리하기 위한 아키텍처 설계

---

## 1. 배경 및 목표

### 1.1 현재 상태

VMS Channel Bridge는 단일 모놀리식 구조로, 인증/RBAC/조직도/감사로그 같은 **범용 플랫폼 기능**과 Slack-Teams 메시지 브리지 같은 **앱 고유 기능**이 같은 디렉토리에 혼재되어 있다.

```
backend/app/
├── api/           ← 플랫폼 API 15개 + 앱 API 8개 혼재
├── models/        ← 플랫폼 모델 10개 + 앱 모델 3개 혼재
├── services/      ← 플랫폼 서비스 7개 + 앱 서비스 10개 혼재
└── main.py        ← 플랫폼 초기화 + 앱 초기화 단일 진입점
```

### 1.2 목표

| # | 목표 | 설명 |
|---|------|------|
| G1 | **재사용성** | 플랫폼 레이어를 다른 프로젝트에서 코드 변경 없이 사용 |
| G2 | **관심사 분리** | 플랫폼 업그레이드가 앱 코드에 영향 없음, 그 역도 성립 |
| G3 | **독립 배포** | 플랫폼은 라이브러리/패키지로 배포 가능 |
| G4 | **확장성** | 새 앱(프로젝트) 추가 시 플랫폼 코드 복사 불필요 |
| G5 | **점진적 마이그레이션** | 한번에 전부 바꾸지 않고 단계적으로 분리 가능 |

---

## 2. 현재 코드베이스 분류

### 2.1 Backend 분류

#### 플랫폼 영역 (재사용 가능)

| 카테고리 | 모듈 | 설명 |
|----------|------|------|
| **인증** | `api/auth.py`, `api/auth_sso.py`, `api/auth_microsoft.py` | JWT 로그인, SSO, OAuth |
| **사용자** | `api/users.py`, `models/user.py` | 사용자 CRUD, 역할 관리 |
| **RBAC** | `api/permissions.py`, `api/permission_groups.py`, `api/menus.py` | 3단계 역할 + 메뉴 기반 권한 |
| **조직도** | `api/organizations.py`, `models/company.py`, `models/department.py` | 회사/부서 계층 |
| **감사** | `api/audit_logs.py`, `models/audit_log.py`, `utils/audit_logger.py` | 감사 로그 |
| **토큰** | `services/token_service.py`, `models/refresh_token.py` | JWT 발급/갱신/폐기, 디바이스 추적 |
| **권한 서비스** | `services/permission_service.py` | MAX(그룹, 개인) 권한 계산 |
| **비밀번호** | `services/password_reset_service.py`, `models/password_reset_token.py` | 비밀번호 재설정 플로우 |
| **이메일** | `services/email_service.py` | SMTP 발송 |
| **캐시** | `services/cache_service.py` | Redis 래퍼 |
| **암호화** | `utils/encryption.py` | Fernet 기반 토큰 암호화 |
| **미들웨어** | `middleware/csrf.py`, `middleware/metrics.py` | CSRF, Prometheus |
| **DB** | `db/database.py` | SQLAlchemy 엔진, 마이그레이션 러너 |
| **SSO** | `sso/base.py`, `sso/registry.py` | SSO 프로바이더 추상화 |
| **알림** | `services/notification_service.py` | 범용 알림 디스패처 |
| **시스템 설정** | `api/system_settings.py`, `models/system_settings.py` | 키-값 설정 저장 |
| **헬스체크** | `api/health.py` | Liveness/Readiness 프로브 |

#### 앱 영역 (Chat Bridge 고유)

| 카테고리 | 모듈 | 설명 |
|----------|------|------|
| **어댑터** | `adapters/base.py`, `slack_provider.py`, `teams_provider.py` | 플랫폼별 메시지 프로바이더 |
| **브리지** | `services/websocket_bridge.py` | 코어 메시지 라우팅 엔진 |
| **라우팅** | `services/route_manager.py` | Redis 기반 동적 채널 라우팅 |
| **메시지** | `api/messages.py`, `models/message.py`, `services/message_service.py` | 메시지 이력/통계/검색 |
| **계정** | `api/accounts_crud.py`, `models/account.py` | Slack/Teams 자격증명 관리 |
| **웹훅** | `api/teams_webhook.py`, `api/teams_notifications.py` | Teams Bot Framework 수신 |
| **큐** | `services/message_queue.py` | 배치 메시지 큐 (50건/5초) |
| **명령어** | `services/command_processor.py` | `/vms`, `/bridge` 커맨드 파싱 |
| **이벤트** | `services/event_broadcaster.py`, `services/websocket_manager.py` | 실시간 이벤트 브로드캐스트 |
| **구독** | `services/teams_subscription_manager.py` | Teams Graph API 구독 |
| **포맷터** | `utils/message_formatter.py`, `utils/emoji_mapper.py` | 크로스 플랫폼 메시지 변환 |
| **스키마** | `schemas/common_message.py` | CommonMessage (Zowe Chat 패턴) |

### 2.2 Frontend 분류

#### 플랫폼 영역

| 카테고리 | 파일/디렉토리 | 설명 |
|----------|-------------|------|
| **API 클라이언트** | `lib/api/client.ts` | Axios + 인터셉터, 토큰 갱신, 에러 처리 |
| **인증 API** | `lib/api/auth.ts`, `users.ts`, `permissions.ts`, `organizations.ts`, `permission-groups.ts` | 플랫폼 API 호출 |
| **상태 관리** | `store/auth.ts`, `permission.ts`, `notification.ts`, `systemSettings.ts`, `sessionSettings.ts` | 인증/권한/알림 Zustand 스토어 |
| **라우트 가드** | `components/ProtectedRoute.tsx` | 인증 + RBAC 라우트 보호 |
| **레이아웃** | `components/layout/*` | Sidebar, TopBar, ContentHeader |
| **UI 라이브러리** | `components/ui/*` (17개 컴포넌트) | Button, Card, Modal, Table, Tabs, Badge 등 |
| **테마** | `hooks/useTheme.ts`, `components/settings/ThemeSettings.tsx` | 다크모드 + 컬러 프리셋 |
| **인증 훅** | `hooks/useTokenExpiry.ts`, `useActivityDetection.ts`, `useIdleTimeout.ts`, `useTabSync.ts` | 토큰/세션 관리 |
| **네비게이션** | `lib/navigation.tsx`, `lib/resolveStartPage.ts` | 메뉴→NavItem 변환, 시작 페이지 결정 |
| **알림** | `components/notifications/*` | Bell, Popover, Toast |
| **타입** | `lib/api/types.ts` (공통 부분) | User, Permission, AuditLog 타입 |

#### 앱 영역

| 카테고리 | 파일/디렉토리 | 설명 |
|----------|-------------|------|
| **페이지** | `pages/Channels.tsx`, `Messages.tsx`, `Statistics.tsx`, `Integrations.tsx` | 앱 고유 페이지 |
| **대시보드** | `components/dashboard/*` | 브리지 상태, 메시지 플로우 위젯 |
| **채널** | `components/channels/*` | 라우트 관리 UI |
| **메시지** | `components/messages/*` | 메시지 검색/필터 |
| **프로바이더** | `components/providers/*` | Slack/Teams 프로바이더 카드 |
| **통계** | `components/statistics/*` | 메시지 차트 |
| **모니터링** | `components/monitoring/*` | 서비스 헬스 |
| **스토어** | `store/routes.ts`, `providers.ts`, `bridge.ts`, `config.ts` | 앱 상태 |
| **API** | `lib/api/messages.ts`, `bridge.ts`, `providers.ts`, `routes.ts`, `config.ts` | 앱 API |
| **유틸** | `lib/utils/platform.ts` | Slack/Teams 플랫폼 설정 |

### 2.3 인프라 분류

| 구분 | 플랫폼 | 앱 |
|------|--------|-----|
| **Docker** | postgres, redis, mailhog, nginx | 앱별 backend/frontend 이미지 |
| **의존성** | FastAPI, SQLAlchemy, jose, passlib, React, Zustand, Tailwind | slack-bolt, botbuilder-core, recharts |
| **마이그레이션** | 17개 (users, RBAC, organizations, menus, audit) | 5개 (messages, accounts, delivery) |
| **환경변수** | DATABASE_URL, REDIS_URL, SECRET_KEY, SMTP_* | SLACK_*, TEAMS_* |

---

## 3. 제안 아키텍처

### 3.1 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │  Chat Bridge  │ │  Future App  │ │  Another App     │ │
│  │  (VMS Channel Bridge)│ │  (Project B) │ │  (Project C)     │ │
│  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘ │
├─────────┼────────────────┼──────────────────┼───────────┤
│         │       Platform Layer              │           │
│  ┌──────┴───────────────────────────────────┴─────────┐ │
│  │  vms-platform (공유 프레임워크)                       │ │
│  │  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────────┐  │ │
│  │  │  Auth   │ │ RBAC │ │ Audit  │ │ Organization │  │ │
│  │  │  + SSO  │ │      │ │  Log   │ │              │  │ │
│  │  └─────────┘ └──────┘ └────────┘ └──────────────┘  │ │
│  │  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────────┐  │ │
│  │  │  User   │ │ Menu │ │ Theme  │ │   UI Kit     │  │ │
│  │  │  Mgmt   │ │ Mgmt │ │        │ │              │  │ │
│  │  └─────────┘ └──────┘ └────────┘ └──────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                    │
│  ┌──────────┐ ┌───────┐ ┌─────────┐ ┌───────────────┐  │
│  │PostgreSQL│ │ Redis │ │ SMTP    │ │ Docker Compose│  │
│  └──────────┘ └───────┘ └─────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 디렉토리 구조 (제안)

```
vms-channel-bridge/                          # 현재 프로젝트 (앱)
├── platform/                          # ★ 플랫폼 패키지 (추출 대상)
│   ├── backend/
│   │   ├── platform/                  # Python 패키지: vms_platform
│   │   │   ├── __init__.py            # 패키지 진입점 + create_platform_app()
│   │   │   ├── core/
│   │   │   │   ├── config.py          # PlatformConfig (필수/선택 설정)
│   │   │   │   ├── database.py        # DB 엔진, 세션, 마이그레이션 러너
│   │   │   │   ├── security.py        # JWT, bcrypt, Fernet, CSRF
│   │   │   │   └── exceptions.py      # 공통 예외 클래스
│   │   │   │
│   │   │   ├── models/                # 플랫폼 SQLAlchemy 모델
│   │   │   │   ├── base.py            # DeclarativeBase (앱과 공유)
│   │   │   │   ├── user.py
│   │   │   │   ├── audit_log.py
│   │   │   │   ├── refresh_token.py
│   │   │   │   ├── password_reset_token.py
│   │   │   │   ├── menu_item.py
│   │   │   │   ├── user_permission.py
│   │   │   │   ├── permission_group.py
│   │   │   │   ├── company.py
│   │   │   │   ├── department.py
│   │   │   │   └── system_settings.py
│   │   │   │
│   │   │   ├── schemas/               # Pydantic 스키마
│   │   │   │   ├── auth.py
│   │   │   │   ├── user.py
│   │   │   │   ├── permission.py
│   │   │   │   ├── audit_log.py
│   │   │   │   └── organization.py
│   │   │   │
│   │   │   ├── api/                   # FastAPI 라우터
│   │   │   │   ├── auth.py
│   │   │   │   ├── users.py
│   │   │   │   ├── permissions.py
│   │   │   │   ├── permission_groups.py
│   │   │   │   ├── menus.py
│   │   │   │   ├── organizations.py
│   │   │   │   ├── audit_logs.py
│   │   │   │   ├── system_settings.py
│   │   │   │   ├── health.py
│   │   │   │   └── notifications.py
│   │   │   │
│   │   │   ├── services/              # 비즈니스 로직
│   │   │   │   ├── token_service.py
│   │   │   │   ├── permission_service.py
│   │   │   │   ├── password_reset_service.py
│   │   │   │   ├── email_service.py
│   │   │   │   ├── cache_service.py
│   │   │   │   └── notification_service.py
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── csrf.py
│   │   │   │   └── metrics.py
│   │   │   │
│   │   │   ├── sso/                   # SSO 프로바이더
│   │   │   │   ├── base.py
│   │   │   │   ├── registry.py
│   │   │   │   └── microsoft.py
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── auth.py            # get_current_user, require_permission 등
│   │   │   │   ├── audit_logger.py
│   │   │   │   └── encryption.py
│   │   │   │
│   │   │   └── migrations/            # 플랫폼 마이그레이션
│   │   │       ├── 001_users.py
│   │   │       ├── 002_rbac_menus.py
│   │   │       ├── 003_organizations.py
│   │   │       ├── 004_permission_groups.py
│   │   │       └── ...
│   │   │
│   │   ├── pyproject.toml             # 패키지 정의
│   │   └── requirements.txt
│   │
│   └── frontend/
│       └── platform/                  # npm 패키지: @vms/platform
│           ├── package.json
│           ├── src/
│           │   ├── index.ts           # 진입점 — 전체 re-export
│           │   │
│           │   ├── api/               # API 클라이언트
│           │   │   ├── client.ts      # Axios 인스턴스 + 인터셉터
│           │   │   ├── auth.ts
│           │   │   ├── users.ts
│           │   │   ├── permissions.ts
│           │   │   ├── organizations.ts
│           │   │   ├── permission-groups.ts
│           │   │   ├── auditLogs.ts
│           │   │   └── systemSettings.ts
│           │   │
│           │   ├── stores/            # Zustand 스토어
│           │   │   ├── auth.ts
│           │   │   ├── permission.ts
│           │   │   ├── notification.ts
│           │   │   ├── systemSettings.ts
│           │   │   └── sessionSettings.ts
│           │   │
│           │   ├── hooks/             # React 훅
│           │   │   ├── useTheme.ts
│           │   │   ├── useTokenExpiry.ts
│           │   │   ├── useActivityDetection.ts
│           │   │   ├── useIdleTimeout.ts
│           │   │   ├── useKeyboardShortcuts.ts
│           │   │   ├── useSidebar.tsx
│           │   │   └── useTabSync.ts
│           │   │
│           │   ├── components/        # 공통 컴포넌트
│           │   │   ├── ui/            # 디자인 시스템 (17개)
│           │   │   ├── layout/        # Sidebar, TopBar, ContentHeader
│           │   │   ├── auth/          # SSOButton, TokenExpiryManager
│           │   │   ├── notifications/ # Bell, Popover, Toast
│           │   │   └── ProtectedRoute.tsx
│           │   │
│           │   ├── lib/               # 유틸리티
│           │   │   ├── navigation.tsx
│           │   │   ├── resolveStartPage.ts
│           │   │   └── utils/
│           │   │
│           │   ├── types/             # 공통 타입 정의
│           │   │   ├── auth.ts
│           │   │   ├── user.ts
│           │   │   ├── permission.ts
│           │   │   ├── audit.ts
│           │   │   └── common.ts
│           │   │
│           │   └── styles/            # CSS 변수, Tailwind 프리셋
│           │       ├── tokens.css     # 시맨틱 토큰
│           │       └── tailwind-preset.ts
│           │
│           └── tsconfig.json
│
├── backend/                           # 앱 백엔드 (현재 구조 유지)
│   └── app/
│       ├── main.py                    # 앱 진입점 (플랫폼 import + 앱 라우터 등록)
│       ├── adapters/                  # Slack, Teams 프로바이더
│       ├── api/                       # 앱 전용 API (bridge, messages, accounts 등)
│       ├── models/                    # 앱 전용 모델 (Message, Account 등)
│       ├── schemas/                   # 앱 전용 스키마 (CommonMessage 등)
│       ├── services/                  # 앱 전용 서비스 (bridge, queue 등)
│       ├── utils/                     # 앱 전용 유틸 (emoji_mapper 등)
│       └── migrations/               # 앱 전용 마이그레이션
│
├── frontend/                          # 앱 프론트엔드
│   └── src/
│       ├── App.tsx                    # 앱 라우트 등록
│       ├── pages/                     # 앱 전용 페이지
│       ├── components/                # 앱 전용 컴포넌트
│       ├── store/                     # 앱 전용 스토어 (routes, bridge, providers)
│       └── lib/api/                   # 앱 전용 API (messages, bridge 등)
│
├── docker-compose.yml                 # 인프라 + 서비스 정의
└── .env                               # 환경변수
```

### 3.3 패키지화 방식 비교

| 방식 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| **A. 모노레포 로컬 패키지** | 단일 저장소, 즉시 반영, 별도 배포 불필요 | 버전 관리 어려움 | **권장** |
| **B. 별도 Git 저장소 + npm/PyPI** | 완전한 독립 배포, 시맨틱 버전 관리 | 개발 속도 저하, 디버깅 불편 | 성숙 단계에 적합 |
| **C. Git Submodule** | 저장소 분리 가능 | 관리 복잡, 충돌 발생 가능 | 비권장 |

**권장: 방식 A → B 순차 전환**

1단계: 모노레포 내 `platform/` 디렉토리로 분리 (로컬 참조)
2단계: 안정화 후 별도 패키지로 배포

---

## 4. 핵심 설계 결정

### 4.1 플랫폼 초기화 패턴 (Backend)

플랫폼이 FastAPI 앱을 생성하되, 앱이 자신의 라우터와 이벤트를 등록하는 구조.

```python
# platform/backend/platform/__init__.py

class PlatformApp:
    """플랫폼 프레임워크 인스턴스"""

    def __init__(self, config: PlatformConfig):
        self.config = config
        self.fastapi = FastAPI(
            title=config.app_name,
            lifespan=self._lifespan,
        )
        self._setup_middleware()
        self._register_platform_routers()

    def _setup_middleware(self):
        """CORS, CSRF, Rate Limiting, Metrics"""
        ...

    def _register_platform_routers(self):
        """인증, 사용자, RBAC, 감사 등 플랫폼 라우터 자동 등록"""
        self.fastapi.include_router(auth_router, prefix="/api/auth")
        self.fastapi.include_router(users_router, prefix="/api/users")
        self.fastapi.include_router(permissions_router, prefix="/api/permissions")
        # ... 플랫폼 라우터 15개

    def register_app_routers(self, *routers):
        """앱 전용 라우터 등록"""
        for router in routers:
            self.fastapi.include_router(router)

    def on_startup(self, callback):
        """앱 초기화 훅 등록"""
        self._startup_hooks.append(callback)

    def on_shutdown(self, callback):
        """앱 종료 훅 등록"""
        self._shutdown_hooks.append(callback)


# ─── 앱 측 사용 예시 ───

# backend/app/main.py
from platform import PlatformApp, PlatformConfig

config = PlatformConfig(
    app_name="VMS Channel Bridge",
    database_url=os.getenv("DATABASE_URL"),
    redis_url=os.getenv("REDIS_URL"),
    secret_key=os.getenv("SECRET_KEY"),
    cors_origins=["http://localhost:5173"],
    # 플랫폼 기능 토글
    features=PlatformFeatures(
        sso_enabled=True,
        audit_log_enabled=True,
        organizations_enabled=True,
    ),
)

platform = PlatformApp(config)

# 앱 라우터 등록
from app.api import bridge, messages, accounts_crud, teams_webhook
platform.register_app_routers(
    bridge.router,
    messages.router,
    accounts_crud.router,
    teams_webhook.router,
)

# 앱 수명주기 이벤트
@platform.on_startup
async def init_bridge():
    """Chat Bridge 초기화"""
    route_manager = RouteManager(platform.redis)
    bridge = WebSocketBridge(route_manager)
    await bridge.start()

app = platform.fastapi  # uvicorn이 사용할 ASGI 앱
```

### 4.2 모델 공유 패턴 (DeclarativeBase)

플랫폼과 앱이 같은 DB를 사용하므로, `Base` 클래스를 플랫폼에서 제공하고 앱이 이를 상속.

```python
# platform/backend/platform/models/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """플랫폼 + 앱 공유 Base 클래스"""
    pass


# platform/backend/platform/models/user.py
from .base import Base

class User(Base):
    __tablename__ = "users"
    ...


# backend/app/models/message.py (앱 측)
from platform.models.base import Base  # 같은 Base 사용

class Message(Base):
    __tablename__ = "messages"
    ...
```

### 4.3 마이그레이션 분리

플랫폼과 앱의 마이그레이션을 별도 디렉토리에 관리하되, 실행 순서를 보장.

```
platform/backend/platform/migrations/
  p001_users.py
  p002_rbac_menus.py
  p003_organizations.py
  ...

backend/migrations/
  a001_messages.py
  a002_accounts.py
  ...
```

**실행 순서**: 플랫폼 마이그레이션 → 앱 마이그레이션 (접두어로 구분)

```python
# database.py
def run_migrations(engine):
    run_directory(engine, "platform/migrations/", prefix="p")  # 플랫폼 먼저
    run_directory(engine, "app/migrations/", prefix="a")       # 앱 이후
```

### 4.4 프론트엔드 플랫폼 패키지 구조

```typescript
// platform/frontend/platform/src/index.ts

// ── 컴포넌트 ──
export { PlatformProvider } from './providers/PlatformProvider';
export { ProtectedRoute } from './components/ProtectedRoute';
export { Layout, Sidebar, TopBar, ContentHeader } from './components/layout';
export { ThemeProvider, useTheme } from './hooks/useTheme';
export * from './components/ui';  // Button, Card, Modal, Table ...

// ── 스토어 ──
export { useAuthStore } from './stores/auth';
export { usePermissionStore } from './stores/permission';
export { useNotificationStore } from './stores/notification';

// ── API ──
export { createApiClient } from './api/client';

// ── 타입 ──
export type { User, UserRole, Permission, AuditLog } from './types';

// ── 훅 ──
export { useTokenExpiry, useIdleTimeout, useTabSync } from './hooks';
```

앱에서의 사용:

```tsx
// frontend/src/App.tsx
import {
  PlatformProvider,
  ProtectedRoute,
  Layout,
  useAuthStore,
} from '@vms/platform';

// 앱 전용 페이지
import { Channels } from './pages/Channels';
import { Messages } from './pages/Messages';

function App() {
  return (
    <PlatformProvider config={{
      apiBaseUrl: import.meta.env.VITE_API_URL,
      appName: 'VMS Channel Bridge',
      // 앱별 네비게이션 아이템
      navItems: [...platformNavItems, ...appNavItems],
    }}>
      <Layout>
        <Routes>
          {/* 플랫폼 라우트는 PlatformProvider가 자동 등록 */}
          {/* 앱 전용 라우트만 여기에 */}
          <Route path="/channels" element={
            <ProtectedRoute permissionKey="channels">
              <Channels />
            </ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute permissionKey="messages">
              <Messages />
            </ProtectedRoute>
          } />
        </Routes>
      </Layout>
    </PlatformProvider>
  );
}
```

### 4.5 PlatformProvider 설계 (Frontend)

여러 Context를 단일 Provider로 합성하여, 앱 측에서 한 번만 감싸면 되게 함.

```tsx
// platform/frontend/platform/src/providers/PlatformProvider.tsx

export interface PlatformConfig {
  apiBaseUrl: string;
  appName: string;
  features?: {
    sso?: boolean;
    organizations?: boolean;
    auditLog?: boolean;
    notifications?: boolean;
  };
  navItems?: NavItem[];          // 앱이 추가할 네비게이션
  theme?: {
    defaultTheme?: 'light' | 'dark' | 'system';
    colorPresets?: ColorPreset[];
  };
}

export function PlatformProvider({
  config,
  children,
}: {
  config: PlatformConfig;
  children: ReactNode;
}) {
  return (
    <PlatformConfigContext.Provider value={config}>
      <ThemeProvider>
        <AuthProvider>
          <PermissionProvider>
            <NotificationProvider>
              <SidebarProvider>
                {children}
              </SidebarProvider>
            </NotificationProvider>
          </PermissionProvider>
        </AuthProvider>
      </ThemeProvider>
    </PlatformConfigContext.Provider>
  );
}
```

### 4.6 확장 포인트 (Extension Points)

플랫폼이 앱에 제공하는 확장 포인트 목록:

| 확장 포인트 | 위치 | 메커니즘 | 용도 |
|------------|------|---------|------|
| **App Routers** | Backend | `register_app_routers()` | 앱 API 엔드포인트 등록 |
| **App Models** | Backend | 공유 `Base` 상속 | 앱 DB 테이블 정의 |
| **App Migrations** | Backend | 별도 디렉토리 | 앱 스키마 변경 |
| **Startup/Shutdown** | Backend | `on_startup()`, `on_shutdown()` | 앱 초기화/정리 |
| **Audit Actions** | Backend | `AuditAction` enum 확장 | 앱 고유 감사 액션 |
| **Nav Items** | Frontend | `PlatformConfig.navItems` | 앱 메뉴 항목 |
| **App Routes** | Frontend | React Router `<Route>` | 앱 페이지 라우트 |
| **App Stores** | Frontend | Zustand 독립 스토어 | 앱 상태 관리 |
| **Custom Pages** | Both | 메뉴 관리 (iframe/link) | 동적 페이지 추가 |

### 4.7 AuditAction 확장 패턴

```python
# platform 측: 기본 액션
class PlatformAuditAction(str, Enum):
    USER_LOGIN = "user.login"
    USER_CREATE = "user.create"
    PERMISSION_UPDATE = "permission.update"
    ...

# 앱 측: 앱 고유 액션 추가
class AppAuditAction(str, Enum):
    BRIDGE_START = "bridge.start"
    BRIDGE_STOP = "bridge.stop"
    ROUTE_CREATE = "route.create"
    MESSAGE_DELETE = "message.delete"
    ...

# platform이 Union 타입으로 수용
AuditAction = Union[PlatformAuditAction, AppAuditAction]
# 또는 string enum 패턴으로 제약 없이 확장 가능하게
```

---

## 5. 의존성 분리

### 5.1 Backend 의존성

```
# platform/requirements.txt (플랫폼)
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
sqlalchemy>=2.0.25
psycopg2-binary>=2.9.9
redis>=5.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
cryptography>=42.0.0
structlog>=24.1.0
slowapi>=0.1.9
prometheus-client>=0.19.0
aiosmtplib>=3.0.0
jinja2>=3.1.0
python-multipart>=0.0.6
email-validator>=2.1.0

# backend/requirements.txt (앱 — 플랫폼 + 앱 전용)
-e ../platform/backend         # 로컬 플랫폼 패키지 참조
slack-bolt>=1.20.0
slack-sdk>=3.33.0
botbuilder-core>=4.16.0
aiohttp>=3.9.0
aiofiles>=24.1.0
```

### 5.2 Frontend 의존성

```jsonc
// platform/frontend/platform/package.json
{
  "name": "@vms/platform",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "lucide-react": "^0.309.0"
  }
}

// frontend/package.json (앱)
{
  "dependencies": {
    "@vms/platform": "workspace:*",   // 모노레포 로컬 참조
    "recharts": "^2.15.0",            // 앱 전용
    "@fingerprintjs/fingerprintjs": "^4.2.0"
  }
}
```

---

## 6. 기능 토글 (Feature Flags)

플랫폼 기능 중 일부는 프로젝트마다 필요 여부가 다를 수 있으므로, 설정으로 on/off 가능하게 함.

```python
@dataclass
class PlatformFeatures:
    """플랫폼 기능 토글"""
    # 인증
    sso_enabled: bool = True
    microsoft_sso: bool = True
    password_reset: bool = True

    # RBAC
    permission_groups: bool = True
    menu_management: bool = True

    # 조직
    organizations_enabled: bool = True

    # 감사
    audit_log_enabled: bool = True

    # 알림
    notifications_enabled: bool = True
    email_notifications: bool = True

    # 보안
    csrf_enabled: bool = True
    rate_limiting: bool = True
    metrics_enabled: bool = True
```

기능이 비활성화되면 해당 라우터는 등록되지 않고, 관련 마이그레이션은 건너뛴다.

```python
# platform/__init__.py
def _register_platform_routers(self):
    # 항상 등록
    self.fastapi.include_router(auth_router)
    self.fastapi.include_router(users_router)
    self.fastapi.include_router(health_router)

    # 조건부 등록
    if self.config.features.audit_log_enabled:
        self.fastapi.include_router(audit_logs_router)
    if self.config.features.organizations_enabled:
        self.fastapi.include_router(organizations_router)
    if self.config.features.sso_enabled:
        self.fastapi.include_router(sso_router)
    # ...
```

---

## 7. 마이그레이션 전략 (점진적 분리)

### Phase 1: 경계 정의 (1~2주)

현재 코드는 그대로 두고, 내부적으로 import 경계를 정리.

- [ ] `platform/` 디렉토리 생성 (빈 상태)
- [ ] 앱 코드에서 플랫폼 모듈 import 경로를 명시적으로 정리
- [ ] 순환 의존성 제거 (현재 `models/message.py`의 `Base`를 `models/user.py`도 사용)
- [ ] `Base` 클래스를 독립 모듈(`models/base.py`)로 추출

### Phase 2: Backend 플랫폼 추출 (2~3주)

```
이동 순서: Base → Models → Utils → Services → Schemas → API → Middleware
```

1. `platform/backend/platform/models/base.py` 생성, `Base` 이동
2. 플랫폼 모델 10개를 `platform/backend/platform/models/`로 이동
3. 앱 모델이 `from platform.models.base import Base`로 참조하도록 변경
4. 서비스, 스키마, API 순차 이동
5. `PlatformApp` 클래스 구현
6. `main.py`를 앱 진입점으로 리팩토링

### Phase 3: Frontend 플랫폼 추출 (2~3주)

```
이동 순서: Types → API Client → Stores → Hooks → UI Components → Layout → Provider
```

1. `@vms/platform` 패키지 초기 구조 생성
2. 공통 타입(User, Permission 등) 이동
3. API 클라이언트 + 인증/권한 스토어 이동
4. UI 컴포넌트 + 레이아웃 이동
5. `PlatformProvider` 구현
6. 앱 `App.tsx`를 플랫폼 소비자로 리팩토링

### Phase 4: 인프라 분리 (1주)

- [ ] Docker Compose에서 플랫폼 볼륨/빌드 경로 조정
- [ ] 마이그레이션 러너 이원화 (플랫폼 → 앱)
- [ ] 환경변수 분류 (PLATFORM_* vs APP_*)
- [ ] CI/CD 파이프라인 업데이트

### Phase 5: 검증 및 안정화 (1~2주)

- [ ] 전체 테스트 통과 확인
- [ ] 새 프로젝트에서 플랫폼만 import하여 빌드 테스트
- [ ] 문서 업데이트

---

## 8. 새 프로젝트 생성 시나리오

플랫폼 분리 완료 후, 새 프로젝트(예: "VMS Ticket System") 생성 흐름:

```bash
# 1. 새 프로젝트 생성
mkdir vms-ticket-system && cd vms-ticket-system

# 2. 플랫폼 패키지 참조
#    (모노레포라면 symlink 또는 workspace, 별도 패키지라면 pip/npm install)
pip install vms-platform          # Backend
npm install @vms/platform         # Frontend

# 3. 앱 진입점 작성
# backend/app/main.py
from vms_platform import PlatformApp, PlatformConfig

config = PlatformConfig(
    app_name="VMS Ticket System",
    database_url="...",
    features=PlatformFeatures(
        organizations_enabled=False,  # 이 앱에서는 조직도 불필요
    ),
)
platform = PlatformApp(config)

# 앱 고유 라우터만 등록
from app.api import tickets, sprints
platform.register_app_routers(tickets.router, sprints.router)

app = platform.fastapi
```

**얻는 것 (무료로)**:
- 로그인/회원가입/SSO
- 사용자 관리 + 역할
- RBAC + 메뉴 권한
- 감사 로그
- 시스템 설정
- 테마 (라이트/다크/컬러 프리셋)
- UI 컴포넌트 라이브러리
- 레이아웃 (사이드바/탑바)

**추가로 만들 것**:
- Ticket 모델 + API
- Sprint 모델 + API
- 티켓 관련 페이지/컴포넌트

---

## 9. 리스크 및 트레이드오프

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| **순환 의존성** | 앱 모델이 플랫폼 모델(User)을 FK 참조 | `Base` 공유 + 지연 import 패턴 |
| **플랫폼 업그레이드 호환성** | 플랫폼 스키마 변경이 앱에 영향 | 시맨틱 버전 관리, 마이그레이션 안전망 |
| **과도한 추상화** | 단순한 것이 복잡해질 수 있음 | "3번 반복되면 추상화" 원칙 적용 |
| **초기 비용** | 분리 작업에 6~10주 소요 | 점진적 마이그레이션으로 기능 개발과 병행 |
| **타입 공유** | 프론트-백 타입 동기화 필요 | OpenAPI 스키마 자동 생성 고려 |
| **테스트 분리** | 플랫폼/앱 테스트 경계 모호 | 플랫폼 단위테스트 + 앱 통합테스트 분리 |

---

## 10. 대안 비교

### 대안 A: 현재 구조 유지 + 복사

새 프로젝트마다 전체 코드를 복사하고 앱 코드만 교체.

- **장점**: 즉시 가능, 추가 설계 불필요
- **단점**: 플랫폼 버그 수정 시 모든 프로젝트에 수동 반영, 시간이 갈수록 드리프트

### 대안 B: 마이크로서비스 분리

인증/RBAC를 독립 서비스로 운영.

- **장점**: 완전한 독립 배포, 언어 무관
- **단점**: 네트워크 호출 오버헤드, 운영 복잡도 대폭 증가, 현재 규모에 과도

### 대안 C: 라이브러리 추출 (제안안)

플랫폼을 패키지로 추출, 앱이 라이브러리로 참조.

- **장점**: 적절한 분리, 공유 DB 유지, 점진적 전환 가능
- **단점**: 패키지 관리 필요, import 경로 변경 작업

**결론: 대안 C 권장** — 현재 프로젝트 규모와 팀 상황에 가장 적합.

---

## 11. 수량 요약

> 아래는 분리 설계 시점의 계획치입니다. 최종 실제 수량은 CLAUDE.md를 참조하세요.
> **최종 상태 (2026-04-13)**: v-platform 18 라우터, 14 모델, 14 서비스, 24 마이그레이션, 18 페이지, 12 훅, 65+ 컴포넌트

| 항목 | 플랫폼 | 앱 (Chat Bridge) | 계획 합계 |
|------|--------|-------------------|----------|
| Backend API 라우터 | 15개 | 8개 | 23개 |
| Backend 모델 | 10개 | 3개 | 13개 |
| Backend 서비스 | 7개 | 10개 | 17개 |
| DB 마이그레이션 | 17개 | 5개 | 22개 |
| Frontend 스토어 | 5개 | 5개 | 10개 |
| Frontend API 모듈 | 8개 | 5개 | 13개 |
| Frontend UI 컴포넌트 | 17개 | 0개 | 17개 |
| Frontend 레이아웃 컴포넌트 | 8개 | 0개 | 8개 |
| Frontend 앱 컴포넌트 | 0개 | ~40개 | ~40개 |
| Python 의존성 | ~16개 | ~5개 | ~21개 |

**플랫폼이 전체 코드의 약 55~60%를 차지** — 재사용 가치가 충분.

---

## 12. 결론

현재 VMS Channel Bridge의 코드베이스는 이미 관심사가 명확히 구분되어 있어, 물리적 분리의 기반이 잘 갖춰져 있다.

**핵심 제안:**
1. 모노레포 내 `platform/` 디렉토리로 시작 (대안 C)
2. Backend는 `PlatformApp` 클래스 + `register_app_routers()` 패턴
3. Frontend는 `PlatformProvider` + `@vms/platform` npm 패키지
4. 기능 토글로 플랫폼 모듈을 프로젝트별 선택적 활성화
5. 점진적 마이그레이션 (Phase 1~5, 총 7~11주)

다음 단계: 이 문서 검토 → Phase 1 (경계 정의) 착수
