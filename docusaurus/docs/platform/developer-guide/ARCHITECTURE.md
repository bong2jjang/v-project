---
id: architecture
title: v-platform 아키텍처
sidebar_position: 3
tags: [guide, developer]
---

# v-platform 아키텍처 가이드

v-platform은 인증, RBAC, 감사 로그, 사용자 관리, 조직도, 알림 등 범용 기능을 제공하는 **재사용 가능한 플랫폼 프레임워크**입니다. 앱(v-channel-bridge, v-platform-portal, v-platform-template)은 이 프레임워크 위에서 자체 비즈니스 로직만 구현합니다.

---

## 1. 시스템 레이어 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        앱 레이어                              │
│  v-channel-bridge │ v-platform-portal │ v-platform-template  │
│  (앱 라우터, 모델, 서비스, 페이지)                              │
├─────────────────────────────────────────────────────────────┤
│                    v-platform (프레임워크)                     │
│  PlatformApp │ 18 라우터 │ 14 서비스 │ 14 모델 │ 26 마이그레이션 │
├─────────────────────────────────────────────────────────────┤
│                    인프라 레이어                               │
│  PostgreSQL 16 │ Redis 7 │ Docker Compose │ MailHog          │
└─────────────────────────────────────────────────────────────┘
```

### 레이어별 책임

| 레이어 | 구성 요소 | 책임 |
|--------|----------|------|
| **앱** | 앱 라우터, 모델, 서비스 | 앱 고유 비즈니스 로직 |
| **플랫폼** | PlatformApp, 플랫폼 라우터/서비스/모델 | 인증, RBAC, 감사 로그, 사용자 관리, 조직도, 알림, SSO, WebSocket |
| **인프라** | PostgreSQL, Redis, Docker, MailHog | 데이터 저장, 캐싱, 컨테이너 오케스트레이션, 개발용 메일 |

---

## 2. PlatformApp — 프레임워크 진입점

`PlatformApp`은 v-platform의 핵심 클래스입니다. 앱의 `main.py`에서 인스턴스를 생성하면 인증, RBAC, 미들웨어 등 플랫폼 기능이 자동으로 구성됩니다.

### 2.1 생성자 시그니처

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
```

| 매개변수 | 설명 | 기본값 |
|----------|------|--------|
| `app_name` | 앱 식별자 (`app_id`로 사용) | `"v-platform"` |
| `version` | API 버전 문자열 | `"0.1.0"` |
| `description` | FastAPI 문서 설명 | `""` |
| `lifespan` | FastAPI lifespan 컨텍스트 매니저 | `None` |
| `cors_origins` | CORS 허용 오리진 목록 | `["http://127.0.0.1:3000", "http://127.0.0.1:5173"]` |
| `app_menu_keys` | 이 앱이 소유하는 메뉴 `permission_key` 목록 | `None` |

### 2.2 초기화 흐름

```
PlatformApp.__init__()
 ├── configure_platform_logging(app_name)      # structlog 초기화
 ├── FastAPI(title, description, version, lifespan)
 ├── fastapi.state.app_id = app_name           # 앱 식별자 저장
 ├── _setup_middleware(cors_origins)            # CSRF → CORS → Metrics 순서
 ├── _setup_rate_limiter()                     # slowapi 리미터
 └── _register_platform_routers()              # 18개 플랫폼 라우터 등록
```

### 2.3 앱에서의 사용 예시

```python
# apps/v-channel-bridge/backend/app/main.py
from contextlib import asynccontextmanager
from v_platform.app import PlatformApp

@asynccontextmanager
async def lifespan(app):
    platform.init_platform()
    yield

platform = PlatformApp(
    app_name="v-channel-bridge",
    version="1.1.0",
    description="Slack ↔ Teams 메시지 브리지",
    lifespan=lifespan,
    cors_origins=["http://127.0.0.1:5173"],
    app_menu_keys=["dashboard", "channels", "messages", "statistics"],
)

# 앱 전용 라우터 등록
from app.api import bridge, messages, accounts
platform.register_app_routers(bridge.router, messages.router, accounts.router)

app = platform.fastapi  # Uvicorn이 사용하는 ASGI 앱
```

:::tip 최소 구성
`v-platform-template`처럼 `PlatformApp` 인스턴스 생성과 `init_platform()` 호출만으로 인증/RBAC/감사 로그가 포함된 앱을 만들 수 있습니다. 앱 전용 라우터가 없어도 플랫폼 기능은 완전히 동작합니다.
:::

---

## 3. 미들웨어 스택

`_setup_middleware()`에서 3개의 미들웨어를 등록합니다. FastAPI 미들웨어는 **등록 역순**으로 실행되므로, 실제 요청 처리 순서는 다음과 같습니다:

```
요청 → MetricsMiddleware → CORSMiddleware → CSRFMiddleware → 라우터
응답 ← MetricsMiddleware ← CORSMiddleware ← CSRFMiddleware ← 라우터
```

### 3.1 CSRFMiddleware

```python
# platform/backend/v_platform/middleware/csrf.py
self.fastapi.add_middleware(CSRFMiddleware)
```

- 상태 변경 요청(POST, PUT, DELETE, PATCH)에 대해 CSRF 토큰 검증
- `X-CSRF-Token` 헤더 또는 `csrf_token` 쿠키에서 토큰 추출
- `/api/auth/login`, `/api/auth/register`, SSO 콜백 등 인증 엔드포인트는 예외 처리

### 3.2 CORSMiddleware

```python
default_origins = ["http://127.0.0.1:3000", "http://127.0.0.1:5173"]
extra = os.getenv("CORS_ORIGINS", "")
origins = (cors_origins or default_origins) + [
    o.strip() for o in extra.split(",") if o.strip()
]
self.fastapi.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- `cors_origins` 매개변수로 기본 오리진 오버라이드 가능
- `CORS_ORIGINS` 환경 변수로 추가 오리진 설정 (쉼표 구분)
- `allow_credentials=True`로 쿠키 포함 요청 허용

### 3.3 MetricsMiddleware

```python
# platform/backend/v_platform/middleware/metrics.py
self.fastapi.add_middleware(MetricsMiddleware)
```

- 모든 요청의 메서드, 경로, 상태 코드, 응답 시간을 수집
- `/metrics` 엔드포인트에서 Prometheus 형식으로 노출

### 3.4 Rate Limiter

```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
self.fastapi.state.limiter = limiter
```

- slowapi 기반 IP별 요청 제한
- 라우터에서 `@limiter.limit("10/minute")` 데코레이터로 엔드포인트별 제한 설정

---

## 4. 플랫폼 라우터 (18개)

`_register_platform_routers()`에서 다음 라우터들을 자동 등록합니다:

| 라우터 모듈 | 프리픽스 | 주요 기능 |
|-------------|---------|----------|
| `auth` | `/api/auth` | 로그인, 로그아웃, 토큰 갱신, 비밀번호 변경 |
| `auth_sso` | `/api/auth/sso` | SSO Provider 목록, 인증 URL, 콜백 |
| `auth_microsoft` | `/api/auth/microsoft` | MS OAuth 전용 엔드포인트 |
| `users` | `/api/users` | 사용자 CRUD, 목록 조회, 역할 변경 |
| `user_oauth` | `/api/user-oauth` | 사용자 OAuth 토큰 관리 |
| `permissions` | `/api/permissions` | 권한 조회/수정 |
| `permission_groups` | `/api/permission-groups` | 역할 그룹 CRUD |
| `menus` | `/api/menus` | 메뉴 목록, 순서 변경 |
| `organizations` | `/api/organizations` | 회사/부서 조직도 관리 |
| `audit_logs` | `/api/audit-logs` | 감사 로그 조회, 필터링, 내보내기 |
| `system_settings` | `/api/system-settings` | 시스템 설정, 브랜딩 |
| `health` | `/api/health` | 헬스 체크 |
| `notifications` | `/api/notifications` | 실시간 알림 CRUD |
| `persistent_notifications` | — | 배너/팝업 공지 관리 |
| `metrics` | — | Prometheus 메트릭 |
| `websocket` | `/api/ws` | 실시간 WebSocket 연결 |
| `uploads` | — | 파일 업로드 |

:::note 앱 라우터 등록
앱 전용 라우터는 `register_app_routers()` 메서드로 별도 등록합니다. 플랫폼 라우터와 동일한 FastAPI 앱에 포함되므로 인증/미들웨어가 자동 적용됩니다.
:::

---

## 5. init_platform() — 데이터베이스 및 SSO 초기화

`init_platform()`은 앱 시작 시 lifespan에서 호출합니다:

```python
def init_platform(self):
    init_db()              # 테이블 생성 + 마이그레이션 실행
    init_sso_providers()   # 환경 변수 기반 SSO Provider 등록
    if self.app_menu_keys:
        self._classify_app_menus()  # 앱 메뉴 소유권 태깅
```

### 5.1 init_db()

```python
# platform/backend/v_platform/core/database.py

def init_db():
    # 1. 모든 플랫폼 모델 임포트 → Base.metadata에 등록
    from v_platform.models import user, audit_log, refresh_token, ...

    # 2. 앱 모델 로딩 (ImportError 무시)
    try:
        from app.models import message, account
    except ImportError:
        pass

    # 3. 테이블 생성 (이미 있으면 건너뜀)
    Base.metadata.create_all(bind=engine)

    # 4. 번호순 마이그레이션 실행
    _run_migrations()
```

### 5.2 데이터베이스 엔진 설정

```python
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://vmsuser:vmspassword@postgres:5432/v_project"
)

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,       # 기본 커넥션 풀 크기
    max_overflow=30,    # 최대 추가 커넥션
    pool_timeout=60,    # 풀에서 커넥션 대기 타임아웃
    pool_pre_ping=True, # 커넥션 재사용 전 유효성 검사
)
```

### 5.3 세션 관리 패턴

v-platform은 두 가지 세션 패턴을 제공합니다:

```python
# 패턴 1: FastAPI Depends (라우터에서 사용)
@router.get("/api/users")
async def list_users(db: Session = Depends(get_db_session)):
    return db.query(User).all()

# 패턴 2: 컨텍스트 매니저 (서비스/유틸리티에서 사용)
with get_db() as db:
    db.query(User).filter(User.id == 1).first()
    # 정상 종료 시 자동 commit, 예외 시 자동 rollback
```

:::warning 세션 차이
`get_db_session()`은 자동 commit하지 않습니다. 라우터에서 직접 `db.commit()`을 호출해야 합니다. `get_db()`는 컨텍스트 종료 시 자동 commit되며, 예외 발생 시 자동 rollback합니다.
:::

### 5.4 마이그레이션 시스템

```python
def _run_migrations():
    # 1) 플랫폼 마이그레이션: v_platform/migrations/p[0-9]*.py
    platform_dir = pathlib.Path(__file__).resolve().parent.parent / "migrations"
    # 2) 앱 마이그레이션: /app/migrations/a[0-9]*.py (Docker 컨테이너 기준)
    app_dir = pathlib.Path("/app/migrations")

    files = sorted(glob(str(platform_dir / "p[0-9]*.py")))
    files += sorted(glob(str(app_dir / "a[0-9]*.py")))

    for fpath in files:
        mod.migrate(engine)
```

**실행 순서**: 플랫폼(`p001`, `p002`, ..., `p026`) 먼저, 앱(`a001`, `a002`, ...) 나중

각 마이그레이션 파일은 `migrate(engine)` 함수를 내보내야 합니다. 작성법은 [시드 데이터 가이드](./SEED_DATA_GUIDE.md)를 참조하세요.

---

## 6. 인증 시스템

### 6.1 JWT 토큰 구조

v-platform은 **Access Token + Refresh Token** 이중 토큰 체계를 사용합니다.

```
TokenService (platform/backend/v_platform/services/token_service.py)
├── Access Token (JWT, HS256)
│   ├── 만료: 15분 (ACCESS_TOKEN_EXPIRE_MINUTES)
│   ├── Payload: user_id, email, role, exp, iat, jti
│   └── 저장: 프론트엔드 메모리 (Zustand useAuthStore)
└── Refresh Token (secrets.token_urlsafe(64))
    ├── 만료: 7일 / remember_me: 30일
    ├── 저장: DB (SHA-256 해시), HttpOnly 쿠키
    └── Token Rotation + 재사용 감지
```

### 6.2 TokenService 주요 메서드

```python
# platform/backend/v_platform/services/token_service.py

class TokenService:
    @staticmethod
    def create_access_token(user_id, email, role) -> Tuple[str, datetime]:
        """JWT Access Token 생성. (token_string, expires_at) 반환"""

    @staticmethod
    def verify_access_token(token: str) -> dict:
        """JWT 검증. 실패 시 ValueError 발생"""

    @staticmethod
    def create_refresh_token(db, user_id, device_fingerprint,
                             device_name, ip_address,
                             remember_me=False, app_id=None) -> str:
        """64바이트 랜덤 토큰 생성, SHA-256 해시를 DB에 저장"""

    @staticmethod
    def refresh_tokens(db, old_refresh_token, ip_address) -> Tuple[str, str]:
        """Token Rotation: 기존 토큰 무효화 → 새 access/refresh 토큰 쌍 발급"""

    @staticmethod
    def revoke_all_tokens(db, user_id) -> int:
        """사용자의 모든 Refresh Token 무효화"""

    @staticmethod
    def get_active_devices(db, user_id) -> list[dict]:
        """사용자의 활성 디바이스(세션) 목록 조회"""

    @staticmethod
    def revoke_device(db, user_id, device_id) -> bool:
        """특정 디바이스의 세션 무효화"""
```

### 6.3 Token Rotation과 재사용 감지

```
정상 갱신 흐름:
Client → /api/auth/refresh (old_refresh_token 쿠키)
Server → verify_refresh_token(old) → 유효
       → old_token.is_revoked = True
       → 새 access_token + 새 refresh_token 발급

재사용 공격 감지:
Client → /api/auth/refresh (이미 무효화된 refresh_token)
Server → verify_refresh_token(old) → is_revoked == True!
       → revoke_all_tokens(user_id)  ← 모든 세션 강제 로그아웃
       → ValueError("Token reuse detected - all tokens revoked")
```

:::warning 보안 메커니즘
Refresh Token이 재사용되면 해당 사용자의 **모든 활성 세션이 즉시 무효화**됩니다. 이는 토큰 탈취 공격 탐지 시 피해를 최소화하기 위한 방어 메커니즘입니다.
:::

### 6.4 인증 Dependency

```python
# platform/backend/v_platform/utils/auth.py

async def get_current_user(
    token: str = Depends(oauth2_scheme),  # Authorization: Bearer <token>
    db: Session = Depends(get_db_session),
) -> User:
    """
    1. OAuth2PasswordBearer로 Authorization 헤더에서 토큰 추출
    2. TokenService.verify_access_token()으로 JWT 검증
    3. payload에서 user_id 추출 → DB에서 User 조회
    4. is_active 확인 (비활성 계정은 403)
    """
```

**라우터에서의 사용:**

```python
@router.get("/api/profile")
async def get_profile(user: User = Depends(get_current_user)):
    return {"username": user.username, "email": user.email}
```

---

## 7. RBAC 권한 시스템

### 7.1 역할 체계

| 역할 | 코드 | 권한 범위 |
|------|------|----------|
| **시스템 관리자** | `system_admin` | 모든 권한 자동 통과 (bypass) |
| **조직 관리자** | `org_admin` | 조직 내 관리 권한 |
| **매니저** | `manager` | 부서 내 관리 권한 |
| **일반 사용자** | `user` | 할당된 권한만 |

### 7.2 권한 검사 Dependency

```python
# platform/backend/v_platform/utils/auth.py

def require_permission(permission_key: str, level: str = "read"):
    """
    권한 검사 Dependency Factory
    - system_admin → 무조건 통과
    - 다른 역할 → PermissionService.check_permission(db, user, key, level)
    - 권한 없음 → HTTP 403: "'{key}' 메뉴에 대한 '{level}' 권한이 없습니다."
    """

def require_system_admin():
    """system_admin 전용. 다른 역할은 HTTP 403"""

def require_admin_or_above():
    """system_admin + org_admin만 통과. 다른 역할은 HTTP 403"""
```

**사용 시나리오:**

```python
# 읽기 권한 필요
@router.get("/api/channels")
async def list_channels(
    user=Depends(require_permission("channels", "read"))
):
    ...

# 쓰기 권한 필요
@router.post("/api/channels")
async def create_channel(
    user=Depends(require_permission("channels", "write"))
):
    ...

# 시스템 관리자 전용
@router.delete("/api/users/{user_id}")
async def delete_user(
    user=Depends(require_system_admin())
):
    ...

# 관리자급 이상
@router.get("/api/audit-logs")
async def list_audit_logs(
    user=Depends(require_admin_or_above())
):
    ...
```

### 7.3 프론트엔드 ProtectedRoute

```tsx
// platform/frontend/v-platform-core/src/components/ProtectedRoute.tsx

<ProtectedRoute permissionKey="dashboard">
  <DashboardPage />
</ProtectedRoute>
```

`ProtectedRoute` 검사 흐름:

```
1. isInitialized 확인 → 미초기화 시 로딩 스피너
2. isAuthenticated 확인 → 미인증 시 /login 리다이렉트
3. isLoaded 확인 (permissionKey가 있을 때) → 권한 데이터 로딩 대기
4. canAccess(permissionKey) 확인 → system_admin은 항상 통과
   → 권한 없음:
     - 루트 경로(/) → menus에서 첫 접근 가능 페이지로 자동 이동
     - 비루트 경로 → resolveStartPage() fallback → /forbidden
5. requiredRole 확인 (deprecated, permissionKey 사용 권장)
```

자세한 내용은 [페이지 레이아웃 가이드](./PAGE_LAYOUT_GUIDE.md)를 참조하세요.

---

## 8. app_id 기반 데이터 격리

멀티 앱 환경에서 각 앱의 데이터를 격리하기 위해 `app_id` 컬럼을 사용합니다.

### 8.1 격리 대상 테이블

| 테이블 | app_id 용도 | NULL 의미 |
|--------|------------|----------|
| `menu_items` | 앱별 메뉴 구성 | 전역 (플랫폼 공통) 메뉴 |
| `system_settings` | 앱별 브랜딩 (타이틀, 설명, 시작 페이지) | 전역 기본 설정 |
| `notifications` | 앱별 알림 발송 | 전역 알림 |
| `refresh_tokens` | 로그인 출처 앱 추적 | 추적 안 함 |

### 8.2 앱 메뉴 소유권 태깅

`PlatformApp(app_menu_keys=[...])` 설정 후, `init_platform()` 호출 시 `_classify_app_menus()`가 실행됩니다:

```python
def _classify_app_menus(self):
    """app_id가 NULL인 메뉴 중 app_menu_keys에 해당하는 것에 app_id 태깅"""
    with engine.connect() as conn:
        conn.execute(
            text(
                "UPDATE menu_items SET app_id = :app_id "
                "WHERE permission_key IN (:k0, :k1, ...) AND app_id IS NULL"
            ),
            {"app_id": self.app_name, "k0": keys[0], ...},
        )
        conn.commit()
```

:::note app_id = NULL
`app_id`가 NULL인 레코드는 **전역(global)** 데이터입니다. 모든 앱에서 공유됩니다. 예: 플랫폼 기본 메뉴(Settings, Profile), 전역 시스템 설정.
:::

### 8.3 시나리오: 포털에서 앱 전환

```
1. 사용자가 Portal에서 "v-channel-bridge" 카드 클릭
2. 포털 → POST /api/auth/sso-relay/create → 1회용 코드 발급 (Redis, 30초 TTL)
3. 새 탭: http://127.0.0.1:5173?sso_code={1회용코드}
4. v-channel-bridge 프론트엔드 → sso_code 감지 → URL에서 즉시 제거
5. POST /api/auth/sso-relay/exchange → 코드를 JWT + 사용자 정보로 교환 (코드 즉시 삭제)
6. 인증 완료 → 메뉴 API 호출 → app_id="v-channel-bridge" 메뉴만 반환
7. 시스템 설정 API → app_id="v-channel-bridge" 브랜딩 적용
8. 알림 API → app_id="v-channel-bridge" + NULL(전역) 알림 반환
```

---

## 9. WebSocket 실시간 통신

### 9.1 ConnectionManager

```python
# platform/backend/v_platform/services/websocket_manager.py

class ConnectionManager:
    active_connections: Dict[str, WebSocket]  # client_id → WebSocket
    subscriptions: Dict[str, Set[str]]        # client_id → {channel names}

    async def connect(websocket) -> str:
        """WebSocket accept, UUID client_id 생성, 기본 4채널 전체 구독"""

    def disconnect(client_id):
        """연결 해제 및 구독 정리"""

    async def broadcast(message, channel=None):
        """채널 구독자에게만 메시지 전송. channel=None이면 전체"""

    async def send_personal_message(message, client_id):
        """특정 클라이언트에게 개인 메시지"""

    def update_subscription(client_id, channels, action="subscribe"):
        """클라이언트의 채널 구독 추가/제거"""

    def get_connection_count() -> int:
        """활성 연결 수 반환"""

manager = ConnectionManager()  # 글로벌 싱글톤
```

### 9.2 WebSocket 인증

```python
# platform/backend/v_platform/api/websocket.py

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db_session),
):
    # 1. token 파라미터 필수 검증
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    # 2. JWT 토큰 검증 → user_id, email 추출
    token_data = verify_token(token)

    # 3. DB에서 사용자 조회 + is_active 확인
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if not user or not user.is_active:
        await websocket.close(code=1008)
        return

    # 4. 연결 수락 + 메시지 루프
    client_id = await manager.connect(websocket)
```

**연결 URL**: `ws://127.0.0.1:8000/api/ws?token=<JWT_ACCESS_TOKEN>`

### 9.3 채널 시스템과 프로토콜

**4개 채널:**

| 채널 | 서버 메시지 타입 | 용도 |
|------|---------------|------|
| `status` | `status_update` | 서비스 상태 변경 (healthy/degraded) |
| `logs` | `log_update` | 실시간 로그 스트림 |
| `config` | `config_update` | 시스템 설정 변경 알림 |
| `notifications` | `notification` | 사용자 알림 (배너, 공지) |

**클라이언트 → 서버:**

```json
{"type": "subscribe", "data": {"channels": ["status", "notifications"]}}
{"type": "unsubscribe", "data": {"channels": ["logs"]}}
{"type": "ping"}
```

**서버 → 클라이언트:**

```json
{"type": "connection", "data": {"status": "connected", "client_id": "uuid"}, "timestamp": "..."}
{"type": "status_update", "data": {...}, "timestamp": "..."}
{"type": "subscription_updated", "data": {"action": "subscribed", "channels": ["status"]}}
{"type": "pong"}
{"type": "error", "data": {"message": "...", "code": "INVALID_CHANNELS"}}
```

### 9.4 프론트엔드 WebSocket 훅

```tsx
// 연결 상태 및 메시지 수신
import { useWebSocket } from "@v-platform/core";
const { isConnected, lastMessage } = useWebSocket();

// 서비스 상태 실시간 모니터링
import { useRealtimeStatus } from "@v-platform/core";
const { status, services } = useRealtimeStatus();
```

---

## 10. 알림 시스템

### 10.1 NotificationService

```python
# platform/backend/v_platform/services/notification_service.py

class NotificationService:
    # Severity: critical, error, warning, info, success
    # Category: service, message, config, user, system

    @staticmethod
    def create_notification(
        severity, category, title, message, source,
        metadata=None, actions=None, link=None,
        dismissible=True, persistent=False,
    ) -> dict:
        """알림 생성. WebSocket으로 실시간 전달 + DB 저장 가능"""
```

### 10.2 알림 전달 경로

```
Backend NotificationService.create_notification()
    ├── DB 저장 (persistent=True인 경우, persistent_notifications 테이블)
    ├── WebSocket broadcast (channel="notifications")
    └── 프론트엔드 수신
        ├── NotificationBell (Footer의 알림 뱃지 + 드롭다운)
        ├── ToastContainer (화면 우측 하단 토스트 메시지)
        └── AnnouncementPopup (미읽은 공지 팝업)
```

### 10.3 프론트엔드 알림 컴포넌트

| 컴포넌트 | 위치 | 역할 |
|---------|------|------|
| `NotificationBell` | Layout Footer | 알림 개수 뱃지, 클릭 시 드롭다운 |
| `ToastContainer` | 화면 우측 하단 (z-60) | 실시간 토스트 메시지 자동 표시/소멸 |
| `AnnouncementPopup` | 모달 오버레이 | 미읽은 공지사항 자동 팝업 |

---

## 11. 프론트엔드 아키텍처

### 11.1 패키지 구조

```
platform/frontend/v-platform-core/     # npm 패키지: @v-platform/core
├── src/
│   ├── providers/PlatformProvider.tsx  # 최상위 Provider (Config, Query, Sidebar)
│   ├── pages/                         # 18개 플랫폼 페이지
│   ├── stores/                        # 6개 Zustand 스토어 (auth, permission, ...)
│   ├── hooks/                         # 12개 커스텀 훅 (useTheme, useWebSocket, ...)
│   ├── components/                    # 65+ UI 컴포넌트
│   │   ├── Layout.tsx                 # VS Code 스타일 메인 레이아웃
│   │   ├── ProtectedRoute.tsx         # RBAC 라우트 보호
│   │   ├── layout/                    # Sidebar, TopBar, ContentHeader
│   │   ├── ui/                        # Button, Card, Modal, Table, Badge, ...
│   │   └── notifications/             # Bell, Toast, AnnouncementPopup
│   ├── api/                           # Axios 기반 API 클라이언트
│   └── lib/                           # navigation, resolveStartPage, tour, websocket
```

### 11.2 PlatformProvider 구조

```tsx
// platform/frontend/v-platform-core/src/providers/PlatformProvider.tsx

export interface PlatformConfig {
  apiBaseUrl?: string;       // API 기본 URL (기본: "" — 동일 오리진)
  appName: string;           // 앱 식별자 (필수)
  appTitle?: string;         // TopBar, Login 페이지 표시 제목
  appDescription?: string;   // Login 페이지 설명
  appLogo?: React.ReactNode; // 커스텀 로고 (기본: V 아이콘)
  features?: {
    sso?: boolean;           // SSO 기능 활성화 (기본: true)
    organizations?: boolean;  // 조직도 기능 (기본: true)
    auditLog?: boolean;       // 감사 로그 (기본: true)
    notifications?: boolean;  // 알림 기능 (기본: true)
  };
  theme?: {
    defaultTheme?: "light" | "dark" | "system";
  };
}
```

앱에서의 사용:

```tsx
// apps/v-channel-bridge/frontend/src/App.tsx
import { PlatformProvider } from "@v-platform/core";

<PlatformProvider config={{
  appName: "v-channel-bridge",
  appTitle: "Channel Bridge",
  appDescription: "Slack ↔ Teams 메시지 브리지",
  features: { sso: true, notifications: true },
}}>
  <RouterProvider router={router} />
</PlatformProvider>
```

### 11.3 Zustand 스토어 목록

| 스토어 | 주요 상태 | 용도 |
|--------|----------|------|
| `useAuthStore` | `user`, `isAuthenticated`, `isInitialized` | 인증 상태, login/logout 액션 |
| `usePermissionStore` | `menus`, `isLoaded`, `canAccess()` | RBAC 권한 데이터 |
| `useNotificationStore` | 알림 목록, 읽음 상태 | 실시간 알림 관리 |
| `useSystemSettingsStore` | `settings` (app_title, branding) | 시스템 설정 상태 |
| `useSessionSettingsStore` | 세션별 설정 | 임시 설정 관리 |
| `useUserOAuthStore` | OAuth 연동 상태 | SSO 연동 관리 |

### 11.4 Layout 구조

```
┌──────────────────────────────────────────────────┐
│                    TopBar                         │
│  [Logo] [Title]              [Theme] [UserMenu]  │
├──────┬───────────────────────────────────────────┤
│      │                                           │
│ Side │              Content Area                 │
│ bar  │    <main className="flex-1 overflow-y-    │
│      │           auto">{children}</main>         │
│      │                                           │
├──────┴───────────────────────────────────────────┤
│                    Footer                         │
│     [App v1.1.0]              [NotificationBell] │
└──────────────────────────────────────────────────┘
```

- **TopBar**: 앱 로고/타이틀, 테마 토글, 사용자 드롭다운 메뉴
- **Sidebar**: VS Code 스타일 (collapsed/expanded 모드), 서버 메뉴 기반 렌더링
- **Content Area**: `<main>` 태그, 세로 스크롤 가능
- **Footer**: 버전 정보, `NotificationBell` 컴포넌트
- **모바일**: Sidebar가 오버레이(w-60, z-50) + backdrop으로 전환

---

## 12. 요청 처리 흐름 (종합)

### 12.1 인증된 API 요청

```
프론트엔드
  │ GET /api/channels
  │ Authorization: Bearer <access_token>
  │ X-CSRF-Token: <csrf_token>
  ▼
MetricsMiddleware → 요청 시작 시간 기록
  ▼
CORSMiddleware → Origin 헤더 검증
  ▼
CSRFMiddleware → GET 요청이므로 통과
  ▼
FastAPI Router (/api/channels)
  ▼
get_current_user(token)
  → TokenService.verify_access_token(token)  → payload 디코딩
  → db.query(User).filter(User.id == payload.user_id)
  → user.is_active 확인
  ▼
require_permission("channels", "read")
  → system_admin → 바로 통과
  → 다른 역할 → PermissionService.check_permission(db, user, "channels", "read")
  ▼
비즈니스 로직 실행 → JSON 응답
  ▼
MetricsMiddleware → 응답 시간, 상태 코드 기록
```

### 12.2 토큰 갱신 흐름

```
프론트엔드 (Axios 인터셉터에서 401 감지)
  │ POST /api/auth/refresh
  │ Cookie: refresh_token=<token>
  ▼
TokenService.refresh_tokens(db, old_token, ip_address)
  ├── verify_refresh_token(old) → 유효성/만료/재사용 확인
  ├── old_token.is_revoked = True  (Token Rotation)
  ├── create_access_token(user)   → 새 JWT (15분)
  └── create_refresh_token(...)   → 새 랜덤 토큰 → DB 저장
  ▼
응답:
  Body: { access_token, expires_at }
  Set-Cookie: refresh_token=<new>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth
```

### 12.3 SSO 로그인 흐름

```
프론트엔드 (로그인 페이지)
  │ window.open("/api/auth/sso/microsoft/login")
  ▼
auth_sso → state 토큰 생성 → Provider 인증 페이지 리다이렉트
  ▼
사용자 → Provider에서 인증 → 콜백 URL로 리다이렉트
  ▼
/api/auth/sso/microsoft/callback
  ├── state 검증 (CSRF 보호, 10분 만료)
  ├── Provider에서 사용자 정보 획득 (SSOUserInfo)
  ├── DB에서 사용자 조회 또는 자동 생성
  ├── TokenService로 JWT + Refresh Token 발급
  └── _render_sso_popup_result() → postMessage로 토큰 전달
  ▼
프론트엔드 (window.addEventListener("message"))
  → access_token 수신 → useAuthStore에 저장 → 메인 페이지 이동
```

### 12.4 SSO Relay 흐름 (포털 → 앱 자동 인증)

포털에서 앱 카드를 클릭하면 **1회용 코드 기반 SSO Relay**로 별도 로그인 없이 자동 인증됩니다. URL에 JWT가 노출되지 않습니다.

```
포털 프론트엔드 (Portal.tsx → AppCard 클릭)
  │ POST /api/auth/sso-relay/create (Authorization: Bearer <포털JWT>)
  ▼
포털 백엔드 (auth.py)
  ├── secrets.token_urlsafe(32) → 1회용 코드 생성
  ├── cache_service.set("sso:relay:{code}", {user_id, email, role}, ttl=30)
  └── 응답: { code: "u-KmtixZE0..." }
  ▼
포털 프론트엔드
  │ window.open("{앱URL}?sso_code={code}", "_blank")
  ▼
앱 프론트엔드 (auth store → loadUserFromStorage)
  ├── URL에서 sso_code 파라미터 감지
  ├── window.history.replaceState() → URL에서 코드 즉시 제거
  │ POST /api/auth/sso-relay/exchange { code: "u-KmtixZE0..." }
  ▼
앱 백엔드 (auth.py)
  ├── cache_service.get("sso:relay:{code}") → 사용자 정보 조회
  ├── cache_service.delete("sso:relay:{code}") → 즉시 삭제 (1회용)
  ├── DB에서 사용자 조회 (user_id)
  └── TokenService.create_access_token() → 새 JWT 발급
  ▼
앱 프론트엔드
  → JWT + 사용자 정보 수신 → localStorage 저장 → 인증 완료
```

**보안 특성**: 코드는 30초 TTL, 1회 사용 후 삭제, JWT는 URL에 노출되지 않음. 포털과 앱은 동일한 Redis와 `SECRET_KEY`를 공유해야 합니다.

---

## 13. 디렉토리 구조 상세

### 13.1 Backend (v-platform)

```
platform/backend/v_platform/
├── app.py                    # PlatformApp 클래스
├── core/
│   ├── database.py           # engine, init_db, _run_migrations, get_db_session, get_db
│   ├── logging.py            # configure_platform_logging (structlog)
│   └── exceptions.py         # 공통 예외 클래스
├── models/                   # SQLAlchemy 모델 14개
│   ├── base.py               # Base = declarative_base()
│   ├── user.py               # User, UserRole enum
│   ├── audit_log.py          # AuditLog
│   ├── refresh_token.py      # RefreshToken (app_id 포함)
│   ├── menu_item.py          # MenuItem (app_id 포함)
│   ├── notification.py       # Notification (app_id 포함)
│   ├── system_settings.py    # SystemSettings (app_id 포함)
│   ├── user_permission.py
│   ├── permission_group.py
│   ├── password_reset_token.py
│   ├── company.py
│   ├── department.py
│   └── user_oauth_token.py
├── api/                      # FastAPI 라우터 18개
├── services/                 # 비즈니스 서비스 14개
│   ├── token_service.py      # TokenService (Access/Refresh Token 관리)
│   ├── permission_service.py # PermissionService (RBAC 체크)
│   ├── notification_service.py
│   ├── websocket_manager.py  # ConnectionManager 싱글톤
│   ├── event_broadcaster.py
│   ├── log_buffer.py
│   ├── cache_service.py
│   └── ...
├── middleware/
│   ├── csrf.py               # CSRFMiddleware
│   └── metrics.py            # MetricsMiddleware (Prometheus)
├── sso/
│   ├── __init__.py           # init_sso_providers() — 환경 변수 기반 자동 등록
│   ├── base.py               # BaseSSOProvider (ABC), SSOUserInfo
│   ├── registry.py           # SSOProviderRegistry, sso_registry 싱글톤
│   ├── microsoft.py          # MicrosoftSSOProvider
│   └── generic_oidc.py       # GenericOIDCProvider
├── utils/
│   ├── auth.py               # get_current_user, require_permission, ...
│   ├── audit_logger.py       # create_audit_log, AuditAction enum
│   ├── encryption.py
│   └── filters.py
├── schemas/                  # Pydantic 스키마
└── migrations/               # p001 ~ p026 (플랫폼 마이그레이션)
```

### 13.2 Frontend (v-platform-core)

```
platform/frontend/v-platform-core/src/
├── providers/PlatformProvider.tsx
├── pages/                           # 18개 플랫폼 페이지
│   ├── LoginPage.tsx, RegisterPage.tsx
│   ├── DashboardPage.tsx, ProfilePage.tsx
│   ├── PasswordChangePage.tsx, SettingsPage.tsx
│   ├── admin/                       # 관리자 전용 8개
│   │   ├── UserManagementPage.tsx
│   │   ├── PermissionPage.tsx, RoleGroupPage.tsx
│   │   ├── AuditLogPage.tsx, SystemSettingsPage.tsx
│   │   ├── OrganizationPage.tsx, MenuManagementPage.tsx
│   │   └── NotificationManagementPage.tsx
│   ├── ForbiddenPage.tsx, NotFoundPage.tsx
│   └── SSOCallbackPage.tsx
├── stores/                          # 6개 Zustand 스토어
├── hooks/                           # 12개 커스텀 훅
├── components/
│   ├── Layout.tsx                   # 메인 레이아웃
│   ├── ProtectedRoute.tsx           # RBAC 라우트 보호
│   ├── layout/                      # Sidebar, TopBar, ContentHeader, SidebarNavItem, ...
│   ├── ui/                          # Button, Card, Modal, Table, Badge, Divider, ...
│   ├── notifications/               # NotificationBell, ToastContainer, AnnouncementPopup
│   ├── settings/, profile/, oauth/, admin/, auth/, common/
│   └── ...
├── api/                             # Axios 기반 API 모듈
│   ├── client.ts                    # 인터셉터 (401 자동 갱신, CSRF 헤더)
│   ├── auth.ts, users.ts, permissions.ts, ...
│   └── types.ts                     # 공통 타입 정의
└── lib/
    ├── navigation.ts                # mainNavItems, adminNavItems, categorizeMenus()
    ├── resolveStartPage.ts          # 시작 페이지 결정 로직
    ├── tour.ts                      # Driver.js 투어 헬퍼
    ├── websocket.ts                 # WebSocket 클라이언트
    └── utils.ts
```

---

## 14. 앱 개발 체크리스트

새 앱을 v-platform 위에 개발할 때의 최소 단계입니다.

### Backend

1. `PlatformApp` 인스턴스 생성 — `app_name`, `app_menu_keys` 설정
2. lifespan 함수에서 `platform.init_platform()` 호출
3. 앱 전용 라우터 작성 후 `platform.register_app_routers()` 등록
4. 앱 전용 마이그레이션 파일을 `a001_*.py` 형식으로 작성

### Frontend

1. `PlatformProvider`로 앱 최상위 감싸기 — `appName`, `appTitle` 설정
2. 플랫폼 페이지(Login, Settings, admin/...)를 라우터에 import
3. `ProtectedRoute`로 각 페이지 보호 — `permissionKey` 지정
4. `Layout` 컴포넌트로 Sidebar/TopBar 자동 적용

### Docker

1. `docker-compose.yml`에 backend/frontend 서비스 추가
2. 프로필 설정으로 선택적 실행 지원 (`--profile myapp`)
3. 네트워크에서 `postgres`, `redis` 서비스 접근 보장

---

## 15. 참고 문서

| 문서 | 내용 |
|------|------|
| [디자인 시스템](./DESIGN_SYSTEM.md) | Tailwind 시맨틱 토큰, 테마, 컴포넌트 카탈로그 |
| [페이지 레이아웃 가이드](./PAGE_LAYOUT_GUIDE.md) | 페이지 구조 패턴, ContentHeader, ProtectedRoute |
| [시드 데이터 가이드](./SEED_DATA_GUIDE.md) | 마이그레이션 작성법, 멱등성 패턴 |
| [SSO 가이드](./SSO_USAGE_AND_TESTING.md) | OIDC/Microsoft SSO 설정, 콜백 흐름 |
| [시스템 상태 가이드](./SYSTEM_STATUS_GUIDE.md) | 헬스 체크, 메트릭, 로깅, 디버깅 |
