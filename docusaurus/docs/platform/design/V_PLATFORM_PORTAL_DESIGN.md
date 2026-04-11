# v-platform-portal 설계

> **작성일**: 2026-04-11  
> **상태**: 설계 검토 대기  
> **목적**: 여러 v-platform 앱을 통합 관리하는 포탈 — 앱 런처, 사이트맵, SSO 통합 로그인

---

## 1. 개요

### 1.1 배경

v-project에는 여러 앱이 독립적으로 운영됩니다:
- `v-channel-bridge` (Slack ↔ Teams 브리지) — :5173
- `v-platform-template` (템플릿) — :5174
- 향후: `v-ticket-system`, `v-dashboard` 등

각 앱은 독립적으로 접속 가능하지만, 사용자 관점에서:
- 여러 URL을 기억해야 함
- 앱마다 별도 로그인 필요
- 전체 앱 현황을 한눈에 볼 수 없음

### 1.2 v-platform-portal의 역할

```
┌───────────────────────────────────────────────────┐
│                v-platform-portal                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 앱 런처   │  │ 사이트맵  │  │ 통합 대시보드     │ │
│  │ (App     │  │ (Sitemap │  │ (System Status)  │ │
│  │  Launcher)│  │  /Nav)   │  │                  │ │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │              │                 │           │
│  ┌────┴──────────────┴─────────────────┴─────────┐ │
│  │          SSO 통합 로그인 (Single Sign-On)       │ │
│  │  포탈에서 한번 로그인 → 모든 앱 자동 인증        │ │
│  └───────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────┤
│          v-platform (공유 인증/RBAC/DB)             │
├───────┬──────────┬──────────┬─────────────────────┤
│ App 1 │  App 2   │  App 3   │      App N          │
│ :5173 │  :5174   │  :5175   │      :XXXX          │
└───────┴──────────┴──────────┴─────────────────────┘
```

---

## 2. 핵심 기능

### 2.1 앱 런처 (App Launcher)

```
┌─────────────────────────────────────┐
│  🚀 v-platform Portal               │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ 📡      │  │ 📋      │          │
│  │ Channel │  │ Ticket  │          │
│  │ Bridge  │  │ System  │          │
│  │ ✅ Online│  │ ✅ Online│          │
│  └─────────┘  └─────────┘          │
│  ┌─────────┐  ┌─────────┐          │
│  │ 📊      │  │ ⚙️      │          │
│  │ Dashboard│  │ Admin   │          │
│  │ ✅ Online│  │ ✅ Online│          │
│  └─────────┘  └─────────┘          │
└─────────────────────────────────────┘
```

- 등록된 앱 목록을 카드 형태로 표시
- 각 앱의 상태 (Online/Offline) 실시간 모니터링
- 클릭 시 해당 앱으로 이동 (토큰 자동 전달)

### 2.2 SSO 통합 로그인

#### 현재 (앱별 독립 로그인)
```
사용자 → v-channel-bridge 로그인 → 사용
사용자 → v-ticket-system 로그인  → 사용 (다시 로그인)
```

#### 목표 (포탈 통합 로그인)
```
사용자 → v-platform-portal 로그인 → 모든 앱 자동 인증
```

#### 구현 방식: 공유 JWT + 쿠키 기반

```
1. 포탈에서 로그인
   POST /api/auth/login → JWT access_token + refresh_token

2. JWT를 공유 도메인 쿠키에 저장
   Set-Cookie: v_platform_token=<JWT>; Domain=.v-project.local; HttpOnly; Secure; SameSite=Lax

3. 앱 접속 시 쿠키에서 토큰 자동 읽기
   v-channel-bridge.v-project.local → 쿠키의 v_platform_token 자동 전송
   v-ticket-system.v-project.local → 동일한 쿠키로 인증
```

#### 대안: Token Relay 방식

개발 환경(localhost)에서는 도메인 쿠키가 동작하지 않으므로:

```
1. 포탈에서 로그인 → JWT 획득
2. 앱 링크 클릭 시 토큰을 URL 파라미터로 전달
   → http://localhost:5173/?auth_token=<JWT>
3. 앱이 토큰을 받아 로컬 스토리지에 저장
4. 이후 일반 인증 플로우 진행
```

### 2.3 사이트맵 / 통합 네비게이션

포탈은 모든 앱의 메뉴를 통합하여 트리 형태로 표시:

```
v-platform Portal
├── 공통 관리
│   ├── 사용자 관리
│   ├── 권한 관리
│   ├── 감사 로그
│   └── 시스템 설정
├── v-channel-bridge
│   ├── 채널 관리
│   ├── 메시지 히스토리
│   └── 통계
└── v-ticket-system (향후)
    ├── 티켓 목록
    └── 스프린트 관리
```

### 2.4 통합 대시보드

모든 앱의 상태를 한눈에:

| 앱 | 상태 | API | DB | Redis | 사용자 | 마지막 활동 |
|----|------|-----|----|-------|--------|-----------|
| v-channel-bridge | ✅ | ✅ | ✅ | ✅ | 5 online | 2분 전 |
| v-ticket-system | ✅ | ✅ | ✅ | ✅ | 3 online | 5분 전 |

---

## 3. 기술 설계

### 3.1 앱 레지스트리

포탈이 어떤 앱이 존재하는지 알기 위한 레지스트리:

```python
# v_platform/portal/app_registry.py

@dataclass
class RegisteredApp:
    app_id: str               # "v-channel-bridge"
    display_name: str          # "Channel Bridge"
    description: str           # "Slack ↔ Teams 메시지 브리지"
    icon: str                  # Lucide 아이콘명
    base_url: str              # "http://localhost:5173"
    api_url: str               # "http://localhost:8000"
    health_endpoint: str       # "/api/health"
    is_active: bool            # True

class AppRegistry:
    _apps: dict[str, RegisteredApp] = {}

    def register(self, app: RegisteredApp):
        self._apps[app.app_id] = app

    def get_all(self) -> list[RegisteredApp]:
        return list(self._apps.values())

    async def check_health(self, app_id: str) -> dict:
        app = self._apps.get(app_id)
        if not app:
            return {"status": "unknown"}
        # HTTP GET app.api_url + app.health_endpoint
        ...
```

### 3.2 앱 등록 방식

#### 방식 A: docker-compose 환경변수 (권장)

```yaml
# docker-compose.yml
portal:
  environment:
    - PORTAL_APPS=v-channel-bridge|Channel Bridge|http://localhost:5173|http://localhost:8000,v-ticket-system|Ticket|http://localhost:5175|http://localhost:8003
```

#### 방식 B: DB 테이블

```sql
CREATE TABLE portal_apps (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    frontend_url VARCHAR(500) NOT NULL,
    api_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);
```

#### 방식 C: 자동 발견 (향후)

각 앱이 부팅 시 포탈에 자신을 등록:
```python
# 앱 시작 시
platform.register_with_portal(
    portal_url="http://localhost:8080",
    app_info={...}
)
```

### 3.3 통합 로그인 플로우 (개발 환경)

```
[Portal :5180]              [App :5173]              [Backend :8000]
     │                          │                         │
     │  1. 로그인                │                         │
     │──── POST /api/auth/login ─────────────────────────>│
     │<──── JWT token ───────────────────────────────────│
     │                          │                         │
     │  2. 앱 카드 클릭          │                         │
     │── redirect ─────────────>│                         │
     │  ?auth_token=<JWT>       │                         │
     │                          │  3. 토큰 저장             │
     │                          │── localStorage.set ──>  │
     │                          │                         │
     │                          │  4. API 호출             │
     │                          │── Authorization: Bearer ─>│
     │                          │<──── 200 OK ────────────│
```

### 3.4 통합 로그인 플로우 (프로덕션 — 도메인 기반)

```
[Portal portal.v-project.com]  [App bridge.v-project.com]  [Backend api.v-project.com]
     │                              │                            │
     │  1. 로그인                    │                            │
     │── POST /api/auth/login ──────────────────────────────────>│
     │<── Set-Cookie: Domain=.v-project.com ─────────────────────│
     │                              │                            │
     │  2. 앱 카드 클릭              │                            │
     │── redirect ─────────────────>│                            │
     │                              │  3. 쿠키 자동 전송          │
     │                              │── Cookie: v_platform_token ─>│
     │                              │<── 200 OK ─────────────────│
```

---

## 4. 포탈 앱 구조

```
apps/v-platform-portal/
├── backend/
│   ├── app/
│   │   ├── main.py           # PlatformApp + portal API
│   │   ├── api/
│   │   │   ├── portal.py     # 앱 목록, 헬스 체크, 사이트맵 API
│   │   │   └── auth_relay.py # 토큰 릴레이 (개발 환경)
│   │   └── services/
│   │       └── app_registry.py
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Portal.tsx          # 앱 런처 (메인)
│   │   │   ├── Sitemap.tsx         # 통합 사이트맵
│   │   │   └── SystemStatus.tsx    # 통합 시스템 상태
│   │   ├── components/
│   │   │   ├── AppCard.tsx         # 앱 카드 컴포넌트
│   │   │   ├── AppHealthBadge.tsx  # 앱 상태 배지
│   │   │   └── SitemapTree.tsx     # 사이트맵 트리
│   │   └── store/
│   │       └── portal.ts          # 앱 레지스트리 상태
│   └── Dockerfile.dev
│
└── docker-compose.yml  # 포트 8080/5180
```

---

## 5. 작업 계획

### Phase P1: 기본 포탈 앱 생성 (1주)

| # | 작업 | 설명 |
|---|------|------|
| 1 | template 기반 포탈 앱 생성 | `apps/v-platform-portal/` |
| 2 | AppRegistry 서비스 구현 | 앱 목록 관리 (환경변수 기반) |
| 3 | Portal API (앱 목록, 헬스 체크) | `/api/portal/apps`, `/api/portal/health` |
| 4 | Portal 메인 페이지 (앱 런처) | 카드 UI, 상태 표시 |
| 5 | Docker 서비스 등록 | 포트 8080/5180 |

### Phase P2: SSO 통합 로그인 (1주)

| # | 작업 | 설명 |
|---|------|------|
| 6 | Token Relay 구현 (개발 환경) | URL 파라미터로 토큰 전달 |
| 7 | 앱 측 토큰 수신 로직 | `?auth_token=` 감지 → localStorage 저장 |
| 8 | 공유 쿠키 구현 (프로덕션) | Domain 쿠키 기반 SSO |
| 9 | 포탈 로그인 → 앱 자동 인증 E2E 테스트 | 전체 플로우 검증 |

### Phase P3: 사이트맵 + 통합 대시보드 (1주)

| # | 작업 | 설명 |
|---|------|------|
| 10 | 사이트맵 API (앱별 메뉴 통합 조회) | 앱 API에서 메뉴 수집 |
| 11 | SitemapTree 컴포넌트 | 앱별 메뉴를 트리로 표시 |
| 12 | 통합 시스템 상태 대시보드 | 모든 앱 헬스 + 메트릭 |
| 13 | 앱 자동 발견 (선택) | 앱 부팅 시 포탈에 자동 등록 |

---

## 6. 컨테이너 구성

```yaml
# docker-compose.yml 추가
portal-backend:
  build:
    context: ./apps/v-platform-portal/backend
  container_name: v-platform-portal-backend
  ports:
    - "8080:8000"
  environment:
    - PORTAL_APPS=v-channel-bridge|Channel Bridge|http://v-channel-bridge-frontend:5173|http://v-channel-bridge-backend:8000
  profiles:
    - portal

portal-frontend:
  build:
    context: ./apps/v-platform-portal/frontend
  container_name: v-platform-portal-frontend
  ports:
    - "5180:5173"
  profiles:
    - portal
```

---

## 7. 접속 흐름

### 개발 환경

```
http://localhost:5180          → v-platform-portal (앱 런처)
http://localhost:5173          → v-channel-bridge (직접 접속도 가능)
http://localhost:5174          → v-platform-template
```

### 프로덕션 환경 (향후)

```
https://portal.v-project.com  → v-platform-portal
https://bridge.v-project.com  → v-channel-bridge
https://ticket.v-project.com  → v-ticket-system
```

---

## 8. 기대 효과

| 항목 | Before | After |
|------|--------|-------|
| **앱 접속** | URL 직접 입력 | 포탈에서 카드 클릭 |
| **로그인** | 앱마다 별도 로그인 | 포탈에서 한번 → 전 앱 |
| **전체 현황** | 앱별 개별 확인 | 포탈 대시보드에서 한눈에 |
| **앱 발견** | URL 공유 필요 | 포탈에서 자동 노출 |
| **관리** | 앱별 Settings 접속 | 포탈에서 통합 관리 |
