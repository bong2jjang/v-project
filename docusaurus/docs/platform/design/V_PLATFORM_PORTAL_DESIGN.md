# v-platform-portal 설계

> 통합 앱 포털 -- AppRegistry, SSO Relay (1회용 코드), 앱 헬스 폴링, 사이트맵 통합

---

## 1. 개요

v-platform-portal은 v-platform 위에 구축된 **통합 앱 런처**다. 등록된 모든 앱의 목록, 헬스 상태, 사이트맵을 하나의 대시보드에서 제공하며, **1회용 코드 기반 SSO Relay**로 포털에서 각 앱으로 별도 로그인 없이 자동 인증한다.

포털 자체도 `PlatformApp` 인스턴스이므로 인증, RBAC, 감사 로그, 알림 등 모든 플랫폼 기능을 그대로 사용한다.

```
+--------------------+
|  v-platform-portal |     PlatformApp(app_name="v-platform-portal")
|  (Frontend :5180)  |     18개 플랫폼 라우터 + portal_router
|  (Backend  :8080)  |
+--------+-----------+
         |
         |  SSO Relay (?sso_code=1회용코드)
         |  Redis 기반 1회용 코드 → 서버 간 JWT 교환
         v
+--------+-----------+     +-------------------------+
| v-channel-bridge   |     | v-platform-template     |
| :5173 / :8000      |     | :5174 / :8002           |
+--------------------+     +-------------------------+
```

**SSO Relay 흐름**: 포털에서 앱 카드 클릭 → `POST /api/auth/sso-relay/create`로 1회용 코드 생성(Redis, 30초 TTL) → `{앱URL}?sso_code={코드}`로 새 탭 → 앱 프론트엔드가 `POST /api/auth/sso-relay/exchange`로 코드를 JWT + 사용자 정보로 교환. URL에 JWT가 노출되지 않으며, 코드는 1회 사용 후 즉시 삭제된다.

---

## 2. 아키텍처 구성

### 2.1 백엔드 구조

```
apps/v-platform-portal/backend/
  app/
    main.py                 # PlatformApp 생성 + lifespan
    api/
      portal.py             # Portal REST API (CRUD, health, sitemap)
    services/
      app_registry.py       # AppRegistry 싱글턴 (DB 기반 앱 관리)
    models/
      portal_app.py         # PortalApp SQLAlchemy 모델
    migrations/             # 포털 전용 마이그레이션
```

### 2.2 프론트엔드 구조

```
apps/v-platform-portal/frontend/src/
  pages/
    Portal.tsx              # 앱 런처 대시보드
    AppManagement.tsx       # 앱 CRUD 관리 (system_admin)
    Help.tsx                # 포털 도움말
    NotificationManagement.tsx  # 알림 관리
  hooks/
    useTour.ts              # 포털 전용 Product Tour
  lib/
    portalApi.ts            # 포털 API 클라이언트
    tour/                   # 투어 스텝 정의
```

---

## 3. PlatformApp 초기화

포털의 `main.py`는 `PlatformApp`을 생성하고 포털 전용 라우터를 등록한다.

```python
# apps/v-platform-portal/backend/app/main.py

platform = PlatformApp(
    app_name="v-platform-portal",
    version="1.0.0",
    description="v-platform 통합 포탈 -- 앱 런처, SSO, 사이트맵",
    lifespan=lifespan,
)

platform.register_app_routers(portal_router)
app = platform.fastapi
```

`PlatformApp` 생성 시 자동으로:

| 단계 | 동작 |
|------|------|
| `__init__` | FastAPI 인스턴스 생성, `app.state.app_id = "v-platform-portal"` 설정 |
| `_setup_middleware` | CORS, CSRF, MetricsMiddleware 등록 |
| `_setup_rate_limiter` | slowapi 리미터 등록 |
| `_register_platform_routers` | 18개 플랫폼 라우터 (auth, users, menus...) 등록 |

### 3.1 Lifespan 이벤트

```python
@asynccontextmanager
async def lifespan(fastapi_app):
    platform.init_platform()           # DB 초기화 + SSO 프로바이더

    db = SessionLocal()
    try:
        app_registry.seed_from_env(db)  # 환경변수 -> DB (초회만)
        app_registry.reload_from_db(db) # DB -> 메모리 로드
    finally:
        db.close()

    broadcaster = EventBroadcaster(manager, None)
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()           # WebSocket 알림 브로드캐스터

    yield

    await broadcaster_module.broadcaster.stop()
```

시작 순서:

1. `init_platform()` -- 데이터베이스 스키마 생성, SSO 프로바이더 초기화
2. `seed_from_env(db)` -- `PORTAL_APPS` 환경변수에서 초기 앱 데이터 삽입 (DB가 비어 있을 때만)
3. `reload_from_db(db)` -- DB에서 앱 목록을 메모리(`AppRegistry._apps`)에 로드
4. `EventBroadcaster.start()` -- WebSocket 기반 실시간 알림 전달

---

## 4. AppRegistry 설계

`AppRegistry`는 등록된 앱 목록을 관리하는 모듈 수준 싱글턴이다. 주 데이터 소스는 DB(`portal_apps` 테이블)이고, 환경변수(`PORTAL_APPS`)는 초기 시드 용도로만 사용한다.

### 4.1 데이터 모델

#### PortalApp (SQLAlchemy)

```
테이블: portal_apps

+------------------+-------------+-------------------------------+
| 컬럼             | 타입        | 설명                          |
+------------------+-------------+-------------------------------+
| id               | Integer PK  | 자동 증가                     |
| app_id           | String(50)  | 고유 앱 식별자 (UNIQUE)       |
| display_name     | String(200) | UI 표시 이름                  |
| description      | Text        | 앱 설명                       |
| icon             | String(100) | Lucide 아이콘명               |
| frontend_url     | String(500) | 프론트엔드 URL                |
| api_url          | String(500) | 백엔드 API URL                |
| health_endpoint  | String(200) | 헬스 체크 경로 (기본 /api/health) |
| sort_order       | Integer     | 정렬 순서                     |
| is_active        | Boolean     | 활성 여부                     |
| created_by       | Integer FK  | 생성자 (users.id)             |
| updated_by       | Integer FK  | 수정자 (users.id)             |
| created_at       | DateTime    | 생성 시각                     |
| updated_at       | DateTime    | 수정 시각                     |
+------------------+-------------+-------------------------------+
```

#### RegisteredApp (dataclass -- 메모리 캐시)

```python
@dataclass
class RegisteredApp:
    app_id: str
    display_name: str
    description: str
    icon: str              # Lucide 아이콘명
    frontend_url: str
    api_url: str
    health_endpoint: str = "/api/health"
    sort_order: int = 0
    is_active: bool = True
    id: Optional[int] = None
```

### 4.2 데이터 흐름

```
환경변수                  DB (portal_apps)          메모리 (_apps dict)
PORTAL_APPS -----------> seed_from_env() ---------> reload_from_db()
(초회만, DB 비어있을 때)    |                          |
                          |  CRUD API               |  get_all()
                          |  (create/update/delete)  |  get_all_dicts()
                          +--------> reload_from_db() -> get(app_id)
```

### 4.3 환경변수 시드 형식

```bash
PORTAL_APPS="app_id|display_name|description|icon|frontend_url|api_url, ..."
```

예시:

```bash
PORTAL_APPS="v-channel-bridge|Channel Bridge|메시지 브리지|Cable|http://127.0.0.1:5173|http://v-channel-bridge-backend:8000,v-platform-template|Template|템플릿 앱|FileText|http://127.0.0.1:5174|http://v-platform-template-backend:8002"
```

`seed_from_env()` 메서드는 `portal_apps` 테이블에 데이터가 0건일 때만 실행된다. 이후에는 포털 Admin UI에서 CRUD로 관리한다.

### 4.4 AppRegistry 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `seed_from_env(db)` | 환경변수 파싱 -> DB 삽입 (빈 DB일 때만) |
| `reload_from_db(db)` | DB 전체 로드 -> `_apps` dict 갱신 |
| `get_all()` | 활성 앱 `RegisteredApp` 리스트 반환 |
| `get_all_dicts()` | 활성 앱 dict 리스트 반환 (API 직렬화용) |
| `get(app_id)` | 특정 앱 조회 |
| `check_health(app_id)` | httpx로 헬스 체크 (5초 타임아웃) |
| `check_all_health()` | 전체 앱 헬스 체크 |

---

## 5. Portal REST API

모든 엔드포인트는 `/api/portal` 프리픽스를 사용한다.

### 5.1 읽기 엔드포인트 (인증 불필요 또는 일반 사용자)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/portal/apps` | 활성 앱 목록 (메모리 캐시) |
| GET | `/api/portal/health` | 전체 앱 헬스 체크 |
| GET | `/api/portal/health/{app_id}` | 특정 앱 헬스 체크 |
| GET | `/api/portal/sitemap` | 통합 사이트맵 |

### 5.2 관리 엔드포인트 (system_admin 필수)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/portal/apps/all` | 전체 앱 목록 (비활성 포함) |
| POST | `/api/portal/apps` | 앱 등록 (201 Created) |
| PUT | `/api/portal/apps/{app_id}` | 앱 수정 |
| DELETE | `/api/portal/apps/{app_id}` | 앱 삭제 |

### 5.3 요청/응답 스키마

#### AppCreateRequest

```python
class AppCreateRequest(BaseModel):
    app_id: str              # 고유 식별자
    display_name: str        # 표시 이름
    description: str = ""
    icon: str = "Box"        # Lucide 아이콘
    frontend_url: str        # 프론트엔드 URL
    api_url: str             # 백엔드 API URL
    health_endpoint: str = "/api/health"
    sort_order: int = 0
    is_active: bool = True
```

#### AppUpdateRequest

```python
class AppUpdateRequest(BaseModel):
    display_name: str | None = None
    description: str | None = None
    icon: str | None = None
    frontend_url: str | None = None
    api_url: str | None = None
    health_endpoint: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
```

업데이트는 `model_dump(exclude_unset=True)`로 전달된 필드만 변경한다.

#### AppResponse

```python
class AppResponse(BaseModel):
    id: int | None = None
    app_id: str
    display_name: str
    description: str
    icon: str
    frontend_url: str
    api_url: str
    health_endpoint: str = "/api/health"
    sort_order: int = 0
    is_active: bool = True
```

### 5.4 중복 검사

앱 등록 시 `app_id` 중복을 체크한다:

```python
existing = db.query(PortalApp).filter(PortalApp.app_id == body.app_id).first()
if existing:
    raise HTTPException(status_code=409, detail="app_id 이미 존재")
```

### 5.5 메모리 동기화

CRUD 작업 후 반드시 `app_registry.reload_from_db(db)`를 호출하여 메모리 캐시를 갱신한다. 이를 통해 앱 목록 조회(`GET /api/portal/apps`)가 DB 접근 없이 메모리에서 응답한다.

---

## 6. 헬스 체크 시스템

### 6.1 앱별 헬스 폴링

포털은 등록된 각 앱의 `/api/health` 엔드포인트를 `httpx`로 호출하여 상태를 확인한다.

```python
async def check_health(self, app_id: str) -> AppHealth:
    async with httpx.AsyncClient(timeout=5.0) as client:
        t = time.monotonic()
        resp = await client.get(f"{app.api_url}{app.health_endpoint}")
        elapsed = round((time.monotonic() - t) * 1000, 1)

        if resp.status_code == 200:
            data = resp.json()
            return AppHealth(
                app_id=app_id,
                status=data.get("status", "online"),
                services=data.get("services", {}),
                response_time_ms=elapsed,
            )
```

#### AppHealth 응답 구조

```python
@dataclass
class AppHealth:
    app_id: str
    status: str              # "online" | "offline" | "degraded"
    services: dict = {}      # 서비스별 상세 상태
    response_time_ms: float | None = None
```

### 6.2 상태 판정 로직

| 조건 | 결과 |
|------|------|
| HTTP 200 + JSON 응답 | `status` 필드값 (기본 "online") |
| HTTP 200 외 상태 코드 | "degraded" |
| 연결 실패 / 타임아웃 | "offline" |
| 앱 미등록 | "unknown" |

### 6.3 플랫폼 내장 HealthRegistry와의 관계

각 앱 내부에는 `v_platform.api.health`의 `HealthRegistry`가 동작한다. 이 레지스트리는 database, redis 등 인프라 서비스 상태를 체크하고 `GET /api/health`로 노출한다.

```
포털 AppRegistry              앱 HealthRegistry
check_health("v-channel-bridge")
     |
     |  GET http://v-channel-bridge-backend:8000/api/health
     v
     +-- HealthRegistry.run_all()
         +-- database: _check_db()    -> SELECT 1
         +-- redis:    _check_redis() -> PING
         +-- (앱 커스텀 체크...)
```

포털이 보는 것은 앱 전체의 "online/degraded/offline" 상태이고, 각 앱 내부의 `HealthRegistry`가 세부 서비스 상태(`services` dict)를 구성하여 반환한다.

---

## 7. SSO Relay (1회용 코드 방식)

포털에서 로그인한 사용자가 개별 앱으로 이동할 때, **1회용 코드**를 통해 재인증 없이 앱에 접근한다. URL에 JWT를 직접 노출하지 않고, Redis에 저장된 코드를 서버 간 교환하여 새 JWT를 발급한다.

### 7.1 인증 흐름

```
사용자 ---- (1) 로그인 ----> 포털 (:5180)
                              |
사용자 <--- (2) JWT 발급 ---- |
  |
  |  (3) 앱 런처에서 앱 카드 클릭
  |
  v
포털 백엔드 (:8080)
  POST /api/auth/sso-relay/create → 1회용 코드 생성 (Redis, 30초 TTL)
  |
  v
앱 프론트엔드 (:5173)
  ?sso_code=<1회용코드>
  |
  |  (4) sso_code 감지 → URL에서 즉시 제거 → POST /api/auth/sso-relay/exchange
  v
앱 백엔드 (:8000)
  Redis에서 코드 조회/삭제 → 사용자 확인 → 새 JWT 발급
```

### 7.2 핵심 전제

- 모든 앱이 동일한 `SECRET_KEY` 환경변수를 사용하여 JWT를 서명/검증한다
- 포털과 앱이 동일한 Redis 인스턴스를 공유한다 (코드 저장/조회)
- 포털과 앱의 사용자 DB는 동일한 PostgreSQL 인스턴스의 `users` 테이블을 공유한다

### 7.3 보안 특성

| 특징 | 설명 |
|------|------|
| **1회용 코드** | 코드 사용 즉시 Redis에서 삭제. 재사용 불가 |
| **30초 TTL** | 미사용 시 자동 만료 |
| **JWT 비노출** | URL에 JWT가 노출되지 않음. 코드만 전달 |
| **서버 간 교환** | 앱 프론트엔드가 받은 코드를 백엔드 API로 교환하므로 JWT는 서버에서 생성 |

### 7.4 프론트엔드 처리

포털 프론트엔드(`Portal.tsx`)에서 앱 카드를 클릭하면:

1. `POST /api/auth/sso-relay/create`로 1회용 코드 발급
2. `{frontend_url}?sso_code={code}`로 새 탭 열기

앱 프론트엔드는 `@v-platform/core`의 auth 스토어(`loadUserFromStorage()`)에서 `sso_code` URL 파라미터를 감지하고, URL에서 즉시 제거한 뒤 `POST /api/auth/sso-relay/exchange`로 코드를 JWT + 사용자 정보로 교환한다.

---

## 8. 사이트맵 통합

`GET /api/portal/sitemap`은 등록된 모든 앱의 메뉴를 통합하여 반환한다.

### 8.1 동작 방식

```python
for a in app_registry.get_all_dicts():
    menus = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{a['api_url']}/api/menus")
            if resp.status_code == 200:
                menus = resp.json()
    except Exception:
        pass   # 앱 다운 시 빈 메뉴

    entries.append(SitemapEntry(
        app_id=a["app_id"],
        display_name=a["display_name"],
        menus=menus if isinstance(menus, list) else [],
    ))
```

### 8.2 SitemapEntry 구조

```python
class SitemapEntry(BaseModel):
    app_id: str
    display_name: str
    menus: list[dict] = []   # 각 앱의 /api/menus 응답
```

각 앱의 `/api/menus` 엔드포인트는 해당 앱의 `app_id`로 필터링된 메뉴 항목을 반환한다. 포털은 이를 수집하여 전체 앱 사이트맵으로 구성한다.

---

## 9. Docker 서비스 구성

포털은 Docker Compose의 `portal` 프로필로 관리한다.

```yaml
# docker-compose.yml (개념)

v-platform-portal-backend:
  profiles: ["portal"]
  build:
    context: ./apps/v-platform-portal/backend
  ports:
    - "8080:8080"
  environment:
    - DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/v_project
    - REDIS_URL=redis://:redispassword@redis:6379/0
    - SECRET_KEY=${SECRET_KEY}
    - PORTAL_APPS=${PORTAL_APPS}
  depends_on:
    - postgres
    - redis

v-platform-portal-frontend:
  profiles: ["portal"]
  build:
    context: ./apps/v-platform-portal/frontend
  ports:
    - "5180:5180"
```

### 9.1 프로필 실행

```bash
# 포털만
docker compose --profile portal up -d --build

# 포털 + 템플릿 앱
docker compose --profile portal --profile template up -d --build

# 모든 앱
docker compose --profile template --profile portal up -d --build
```

### 9.2 서비스 포트 할당

| 서비스 | Backend | Frontend |
|--------|---------|----------|
| v-channel-bridge | 8000 | 5173 |
| v-platform-template | 8002 | 5174 |
| v-platform-portal | 8080 | 5180 |

---

## 10. 관리 UI

### 10.1 앱 런처 (Portal.tsx)

포털 메인 페이지에서 등록된 앱을 카드 형태로 표시한다:

- 앱 아이콘 (Lucide)
- 앱 이름, 설명
- 헬스 상태 뱃지 (online / offline / degraded)
- 클릭 시 SSO Relay(1회용 코드)로 앱 프론트엔드 이동

### 10.2 앱 관리 (AppManagement.tsx)

`system_admin` 역할 전용. 앱 등록/수정/삭제 CRUD를 제공한다.

- 앱 등록: `app_id`, `display_name`, URL, 아이콘 등 입력
- 앱 수정: 부분 업데이트 (전달된 필드만 변경)
- 앱 삭제: 확인 다이얼로그 후 삭제
- 비활성 앱도 목록에 표시 (관리용)

### 10.3 알림 관리 (NotificationManagement.tsx)

포털 내에서 알림을 생성/관리한다. `app_id`는 자동으로 `"v-platform-portal"`이 설정되므로, 포털 사용자에게만 전달되는 알림을 만들 수 있다.

---

## 11. 플랫폼 기능 통합

포털은 `PlatformApp` 인스턴스이므로 다음 플랫폼 기능을 자동으로 사용한다:

| 기능 | 엔드포인트 | 설명 |
|------|-----------|------|
| 인증 | `/api/auth/*` | JWT 로그인/로그아웃 |
| SSO | `/api/auth/sso/*`, `/api/auth/microsoft/*` | OIDC, Microsoft 인증 |
| 사용자 관리 | `/api/users/*` | 사용자 CRUD |
| 권한 관리 | `/api/permissions/*` | 메뉴별 접근 권한 |
| 권한 그룹 | `/api/permission-groups/*` | 역할 그룹 관리 |
| 메뉴 | `/api/menus/*` | 동적 메뉴 관리 |
| 감사 로그 | `/api/audit-logs/*` | 사용자 활동 기록 |
| 알림 | `/api/notifications-v2/*` | 영속 알림 CRUD |
| 시스템 설정 | `/api/system-settings/*` | 브랜딩, 시작 페이지 |
| 헬스 체크 | `/api/health` | 포털 자체 인프라 상태 |
| 메트릭 | `/metrics` | Prometheus 메트릭 |
| WebSocket | `/api/ws` | 실시간 알림 |

포털 고유 라우터(`/api/portal/*`)는 `register_app_routers(portal_router)`로 추가된다.

---

## 12. 데이터 격리

포털의 `app_id`는 `"v-platform-portal"`이다.

- **메뉴**: 포털 전용 메뉴는 `menu_items.app_id = 'v-platform-portal'`로 저장
- **감사 로그**: 포털에서 발생한 활동은 `audit_logs.app_id = 'v-platform-portal'`로 기록
- **시스템 설정**: 포털만의 브랜딩(`app_title`, `app_logo_url` 등)을 `system_settings.app_id = 'v-platform-portal'`로 관리
- **알림**: 포털에서 생성한 알림은 `notifications.app_id = 'v-platform-portal'`

`portal_apps` 테이블은 포털 자체의 기능 데이터이므로 `app_id` 컬럼이 없다. 포털만 이 테이블에 접근한다.

---

## 13. 에러 처리

### 13.1 앱 등록 충돌

```python
# POST /api/portal/apps
# app_id 중복 시 409 Conflict
{"detail": "app_id 'v-channel-bridge' 이(가) 이미 존재합니다."}
```

### 13.2 앱 미발견

```python
# PUT/DELETE /api/portal/apps/{app_id}
# 미존재 시 404 Not Found
{"detail": "앱 'unknown-app'을(를) 찾을 수 없습니다."}
```

### 13.3 헬스 체크 실패

앱 서버가 응답하지 않으면 `status: "offline"`을 반환하고, 경고 로그를 남긴다:

```
WARNING  Health check failed for v-channel-bridge: ConnectError
```

### 13.4 사이트맵 수집 실패

앱의 `/api/menus` 호출이 실패하면 해당 앱의 `menus`를 빈 배열로 처리한다. 전체 사이트맵 응답은 정상 반환된다.

---

## 14. 새 앱 포털 등록 체크리스트

새 앱을 포털에 등록할 때 확인 사항:

1. 앱이 `PlatformApp`으로 생성되어 있는가
2. 앱의 `SECRET_KEY`가 포털과 동일한가 (SSO Relay JWT 서명/검증)
3. 앱의 `REDIS_URL`이 포털과 동일한 Redis를 가리키는가 (SSO 코드 교환)
4. 앱의 `GET /api/health` 엔드포인트가 정상 응답하는가
5. Docker Compose에서 포털 백엔드가 앱 백엔드에 네트워크로 접근 가능한가
6. 포털 Admin UI 또는 API로 앱을 등록했는가:
   - `app_id`: 고유 식별자
   - `frontend_url`: 사용자가 접근하는 프론트엔드 URL
   - `api_url`: 포털 백엔드가 접근하는 앱 API URL (Docker 내부 주소)
7. 프론트엔드에서 `@v-platform/core` auth 스토어를 사용하는가 (`sso_code` URL 파라미터 자동 처리)

---

## 15. 관련 문서

- [플랫폼/앱 분리 아키텍처](./PLATFORM_APP_SEPARATION_ARCHITECTURE.md)
- [멀티 앱 데이터 격리](./MULTI_APP_DATA_ISOLATION.md)
- [알림 시스템 설계](./NOTIFICATION_AND_MESSAGING_SYSTEM.md)
- [모듈 경계 맵](./MODULE_BOUNDARY_MAP.md)
