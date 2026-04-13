---
id: technical-architecture
title: 시스템 아키텍처 및 기반 기술
sidebar_position: 1
tags: [architecture, tech-portfolio, platform]
---

# 시스템 아키텍처 및 기반 기술

v-project는 **재사용 가능한 플랫폼 프레임워크(v-platform)** 위에 **복수의 비즈니스 앱**을 동시에 구동시키는 **멀티앱 플랫폼**입니다. 본 문서는 v-project의 설계 철학, 플랫폼/앱 분리 구조, 데이터 파이프라인, 로그 중앙화 체계, 인프라 및 보안 계층을 상세히 기술합니다.

---

## 1. Architecture Overview

### 1.1 핵심 설계 철학: Platform-App Separation

v-project의 설계는 하나의 명제에서 출발합니다.

> **"인증/RBAC/감사로그/알림 같은 범용 기능은 모든 앱이 공유하고, 각 앱은 비즈니스 로직에만 집중한다."**

이를 위해 코드베이스를 **플랫폼 계층(v-platform)** 과 **앱 계층(apps/*)** 으로 완전히 분리했습니다.

| 계층 | 모듈 | 책임 |
|------|------|------|
| **Platform Framework** | `platform/backend/v_platform` (Python 패키지) | 인증, SSO, RBAC, 사용자 관리, 조직/부서, 감사 로그, 알림, 시스템 설정, 메뉴 관리, 메트릭 수집 |
| **Platform UI Kit** | `platform/frontend/v-platform-core` (npm 패키지 `@v-platform/core`) | 18개 플랫폼 페이지, 64개 공용 컴포넌트, 6개 전역 스토어, 13개 커스텀 훅 |
| **Application** | `apps/v-channel-bridge` | Slack ↔ Teams 메시지 브리지 — 채널 라우팅, Provider 어댑터 |
| **Application** | `apps/v-platform-template` | 새 앱 부트스트랩 템플릿 (최소 구성 약 30줄) |
| **Application** | `apps/v-platform-portal` | 통합 앱 포털 — AppRegistry, SSO Relay, App Launcher |

이 분리의 핵심 이점은 **"플랫폼 1회 개발 → N개 앱 공유"** 구조입니다. 신규 앱이 인증/RBAC/감사로그/알림/SSO/사용자 관리를 **전혀 다시 구현할 필요가 없습니다.**

### 1.2 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Infrastructure Layer                              │
│   Docker Compose (profiles: default, portal, template, docs)             │
├─────────────────────────────────────────────────────────────────────────┤
│                           Application Tier                                │
│                                                                           │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│   │ v-channel-bridge │  │ v-platform-portal│  │v-platform-template│    │
│   │  :8000 / :5173   │  │  :8080 / :5180   │  │  :8002 / :5174   │     │
│   │                  │  │                  │  │                  │     │
│   │ • Bridge Engine  │  │ • App Registry   │  │ • Minimal Base   │     │
│   │ • Slack/Teams    │  │ • SSO Relay      │  │ • Scaffolding    │     │
│   │   Provider       │  │ • App Launcher   │  │                  │     │
│   │ • Route Manager  │  │ • Sitemap        │  │                  │     │
│   └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘     │
│            │                      │                      │               │
│            └──────────┬───────────┴──────────┬───────────┘               │
│                       │                      │                            │
│   ┌───────────────────▼──────────────────────▼──────────────────────┐  │
│   │                    Platform Framework                              │  │
│   │  v_platform (Python) + @v-platform/core (npm)                     │  │
│   │                                                                    │  │
│   │  PlatformApp      ── app.py: FastAPI 부트스트랩 + 앱별 라우터 등록 │  │
│   │  18 Routers       ── auth, users, perms, menus, orgs, audit, …   │  │
│   │  14 Services      ── notification, email, token, permission, …   │  │
│   │  13 Models        ── user, audit_log, menu_item, notification, …│  │
│   │  24 Migrations    ── p001~p024 (RBAC/SSO/multi-app/branding)    │  │
│   │  5 SSO Providers  ── base, microsoft, generic_oidc, registry    │  │
│   │  PlatformProvider ── React Config + QueryClient + Theme          │  │
│   └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                           Data & Cache Tier                               │
│                                                                           │
│   PostgreSQL 16         Redis 7             MailHog (dev)                │
│   ─────────────         ───────             ──────────                   │
│   • 공유 DB             • 라우팅 규칙        • 로컬 SMTP                 │
│   • app_id 격리         • 스레드 매핑        • 이메일 미리보기            │
│   • 24개 마이그레이션   • 세션 캐시          • 개발 편의                  │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                          Observability Tier                               │
│                                                                           │
│   Prometheus ◀── /metrics          Loki ◀── Promtail ◀── structlog JSON │
│        │                             │           │                        │
│        └──────► Grafana ◀────────────┘           │                        │
│                                                   │                        │
│   Alerts (alerts.yml)                  Labels: {app, service, level}      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 플랫폼 기반 앱 부트스트랩 시나리오

**신규 앱을 만드는 전체 과정**(v-platform-template 기준)은 다음과 같이 극단적으로 간소합니다.

#### Step 1 — Backend: `main.py` (~30줄)

```python
# apps/my-new-app/backend/app/main.py
from contextlib import asynccontextmanager
from v_platform.app import PlatformApp
from app.api import my_router  # 내가 만든 앱 전용 라우터

@asynccontextmanager
async def lifespan(app):
    # 앱 고유 초기화 (큐, 백그라운드 작업 등)
    yield

platform = PlatformApp(
    app_name="my-new-app",
    app_menu_keys=["my-feature", "my-reports"],  # 이 앱 전용 메뉴 키
    lifespan=lifespan,
)
platform.register_app_routers(my_router.router)
app = platform.fastapi
```

이 30줄만 작성하면 **즉시** 다음이 전부 동작합니다.

- `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` — JWT 인증
- `GET /api/auth/sso/microsoft`, `/api/auth/sso/generic` — Microsoft Entra / OIDC SSO
- `GET /api/users`, `POST /api/users`, … — 사용자 CRUD
- `GET /api/permissions`, `/api/permission-groups`, `/api/menus/sidebar` — RBAC
- `GET /api/organizations`, `/api/departments` — 조직도
- `GET /api/audit-logs`, `/api/audit-logs/export/csv` — 감사 로그
- `GET /api/notifications`, WebSocket `/ws/notifications` — 알림
- `GET /api/system-settings` — 앱별 브랜딩 (로고, 타이틀)
- `GET /api/health`, `/api/metrics` — 헬스체크, Prometheus 메트릭

#### Step 2 — Frontend: `App.tsx`

```tsx
import { PlatformProvider } from "@v-platform/core";
import {
  LoginPage, SettingsPage, ProfilePage, AuditLogsPage,
  UserManagementPage, MenuManagementPage,
} from "@v-platform/core/pages";
import { Layout, ProtectedRoute, RoleBasedRoute } from "@v-platform/core";
import MyDashboard from "./pages/MyDashboard";

export default function App() {
  return (
    <PlatformProvider appName="my-new-app">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<MyDashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<RoleBasedRoute role="SYSTEM_ADMIN" />}>
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="users" element={<UserManagementPage />} />
          </Route>
        </Route>
      </Routes>
    </PlatformProvider>
  );
}
```

**플랫폼이 제공하는 18개 페이지 중 필요한 것만 import.** TopBar / Sidebar / UserMenu / 테마 토글 / 알림 벨 / 토큰 만료 경고 모두 `<Layout>` 안에 이미 포함되어 있습니다.

#### 재사용률 정량 분석

| 영역 | 플랫폼이 제공 | 신규 앱이 작성해야 하는 것 | 재사용률 |
|------|---------------|---------------------------|---------|
| 인증/SSO | 3개 SSO 제공자 + JWT + 리프레시 토큰 + 디바이스 FP | 0줄 | **100%** |
| RBAC | 3단계 역할 + 권한 그룹 + 매트릭스 UI + 메뉴 필터링 | 0줄 | **100%** |
| 감사 로그 | 27+ 액션 타입 + CSV 내보내기 + 필터링 UI | `@audit_log` 데코레이터만 적용 | **~95%** |
| 사용자 관리 | 전체 CRUD + 비밀번호 재설정 + OAuth 연동 | 0줄 | **100%** |
| 알림 | 토스트 + 배너 + 팝업 + WebSocket 실시간 | `create_notification()` 호출 | **~90%** |
| 공용 UI | 64개 React 컴포넌트 + 디자인 시스템 | 앱 고유 화면만 | **~70%** |
| 관찰성 | Prometheus /metrics + structlog JSON + 헬스체크 | 0줄 | **100%** |

**결과**: 신규 앱 개발 시 **플랫폼 범용 기능은 0~5% 코드만** 작성하면 되고, 나머지는 100% 비즈니스 로직에 집중할 수 있습니다.

### 1.4 메시지 라우팅 데이터 흐름 (v-channel-bridge 예)

Slack 채널 메시지가 Teams 채널로 브리지되는 전체 경로:

```
[1] Slack Socket Mode Event
     │
     ▼
[2] SlackProvider.handle_message()
     │  ├─ 봇 자신의 메시지 필터링
     │  ├─ 서브타입 필터링
     │  └─ 사용자 프로필 조회 (캐시 우선)
     ▼
[3] transform_to_common() — Slack 이벤트 → CommonMessage (Pydantic)
     │
     ▼
[4] WebSocketBridge._route_message()
     │  ├─ CommandProcessor (/vms, /bridge)
     │  └─ RouteManager.get_targets() ── Redis SMEMBERS
     ▼
[5] WebSocketBridge._send_message() (대상별 반복)
     │  ├─ 메시지 모드 조회 (sender_info | editable)
     │  ├─ 첨부파일 다운로드
     │  └─ 스레드 매핑 조회 (TTL 7일)
     ▼
[6] TeamsProvider.send_message()
     │  ├─ CommonMessage → Teams Activity
     │  ├─ Markdown → Teams HTML
     │  └─ Graph API POST
     ▼
[7] MessageQueue.enqueue() — asyncio.Queue 적재
     │  ├─ 배치 조건: 50개 또는 5초
     │  └─ 단일 트랜잭션 bulk INSERT/UPDATE
     ▼
[8] PostgreSQL messages 테이블 영속화
     │
     └─ structlog.info("message_routed", app="v-channel-bridge", ...)
            └─ Promtail 수집 → Loki 저장 → Grafana 시각화
```

모든 단계에서 생성되는 로그는 **구조화된 JSON(structlog)** 으로 출력되어, 로그 중앙화 파이프라인(§4)에 자동 편입됩니다.

---

## 2. Multi-App Data Isolation (app_id 기반)

v-project는 하나의 PostgreSQL 인스턴스를 여러 앱이 공유하면서도 **앱 경계 데이터를 엄격히 분리**합니다. 이는 마이그레이션 **p015 (`p015_multi_app_isolation.py`)** 에서 도입된 핵심 설계입니다.

### 2.1 격리 대상 테이블

```sql
ALTER TABLE menu_items       ADD COLUMN app_id VARCHAR(50) NULL;
ALTER TABLE audit_logs       ADD COLUMN app_id VARCHAR(50) NULL;
ALTER TABLE system_settings  ADD COLUMN app_id VARCHAR(50) NULL;

CREATE INDEX idx_menu_items_app_id ON menu_items(app_id);
CREATE INDEX idx_audit_logs_app_id ON audit_logs(app_id);
```

| 테이블 | `app_id = NULL` | `app_id = "v-channel-bridge"` |
|--------|----------------|------------------------------|
| `menu_items` | 공통 메뉴 (프로필, 설정, 사용자 관리) | 앱 전용 메뉴 (채널, 메시지, 통계) |
| `audit_logs` | 플랫폼 공통 감사 (로그인, 사용자 CRUD) | 앱 고유 감사 (Route 변경, Bridge 제어) |
| `system_settings` | 플랫폼 기본 브랜딩 | 앱 고유 브랜딩 오버라이드 (로고, 타이틀, 설명) |

### 2.2 자동 분류 메커니즘

`PlatformApp.init_platform()` 호출 시 `_classify_app_menus()` 가 실행되어, `app_menu_keys` 리스트에 기반해 `menu_items.app_id` 를 자동으로 갱신합니다. 즉, 앱 개발자는 **메뉴 키만 선언**하면 격리가 자동화됩니다.

```python
platform = PlatformApp(
    app_name="v-channel-bridge",
    app_menu_keys=["channels", "messages", "statistics"],  # 이것만 선언
)
# 초기화 시:
#   UPDATE menu_items SET app_id='v-channel-bridge' WHERE key IN (...);
#   UPDATE menu_items SET app_id=NULL WHERE key NOT IN (...);
```

### 2.3 Token Relay SSO (Portal → App 자동 로그인)

v-platform-portal에서 앱 런처 클릭 시, 포털에서 발급한 JWT를 앱에 릴레이하여 **재인증 없이 즉시 진입**합니다.

```
User ──(포털 로그인)──▶ Portal:8080
         │
         │ (JWT 발급 — v-platform-portal 서명)
         ▼
User ──(앱 카드 클릭)──▶ /relay?target=bridge&token={jwt}
         │
         ▼
Bridge:8000 ──(JWT 검증 — 공통 SECRET_KEY)──▶ 세션 생성 → /
```

모든 앱이 동일한 `SECRET_KEY` 를 공유하므로 추가 설정 없이 SSO가 성립합니다.

---

## 3. Modern Data Stack

### 3.1 데이터 저장 계층

| 계층 | 기술 | 용도 | 특성 |
|------|------|------|------|
| **공유 관계형 DB** | PostgreSQL 16 Alpine | 사용자, 권한, 메뉴, 감사 로그, 앱별 도메인 데이터 | ACID, app_id 격리 |
| **캐시/라우팅** | Redis 7 Alpine | 브리지 Route 규칙, 스레드 매핑, 세션 캐시 | 인메모리, TTL |
| **시계열 DB** | Prometheus TSDB | 메트릭 (HTTP 응답시간, 컨테이너 리소스, 알림) | 15초 주기, 30일 보존 |
| **로그 저장소** | Grafana Loki 3.0 | 구조화 로그 (structlog JSON) | TSDB, 앱 레이블 기반 인덱싱 |

### 3.2 v-platform 13개 모델

```
[인증/세션]
  users                   — 사용자 + 3단계 역할 (SYSTEM_ADMIN/ORG_ADMIN/USER)
  refresh_token           — JWT 리프레시 (디바이스 핑거프린팅)
  password_reset_token    — 비밀번호 재설정 (30분 만료)
  user_oauth_token        — 사용자별 OAuth 토큰 (Microsoft 위임 등)

[RBAC / 메뉴]
  permission_group        — 명명된 권한 그룹
  user_permission         — 사용자별 권한 오버라이드
  menu_item               — 메뉴 (built_in/custom_iframe/custom_link/group, app_id 분리)

[조직]
  company                 — 회사 (조직 계층 최상위)
  department              — 부서

[운영/감사/알림]
  audit_log               — 27+ 액션 타입, app_id 분리, 4개 복합 인덱스
  notification            — 실시간 알림
  persistent_notification — 저장 알림 (배너, 팝업)
  system_settings         — 앱별 브랜딩 (로고, 타이틀, 설명)
```

### 3.3 앱 고유 모델 (v-channel-bridge 예)

```
accounts                  — Slack/Teams 자격증명 (Fernet 암호화)
messages                  — 브리지 메시지 (18+ 필드, 8 인덱스)
message_stats             — 일별 집계 (gateway/channel/hourly JSON)
```

### 3.4 Redis 라우팅 구조

```
route:slack:C789012                      → {"teams:teamId:channelId"}      (SET)
route:slack:C789012:names                → {target: "display_name"}         (HASH)
route:slack:C789012:source_name          → "general"                         (STRING)
route:slack:C789012:modes                → {target: "sender_info|editable"} (HASH)
route:slack:C789012:bidirectional        → {target: "1|0"}                  (HASH)
route:slack:C789012:enabled              → {target: "1|0"}                  (HASH)

thread:slack:C789012:1234567890.123      → "teams:teamId:channelId:msgId"  (STRING, TTL 7일)
```

**설계 특징**: SCAN 커서 기반 키 순회 — Redis 블로킹 없음 / 양방향 Route 자동 역방향 생성 / `frozenset` 쌍 추적으로 UI 중복 제거.

### 3.5 보안 설계

| 계층 | 구현 |
|------|------|
| **Provider 자격증명** | Fernet 대칭 암호화 (cryptography 42.0.5) — `Account` 모델 11개 암/복호화 프로퍼티 |
| **비밀번호** | bcrypt 해싱 (passlib) |
| **JWT** | python-jose HS256 — 액세스 토큰(짧은 수명) + 리프레시 토큰(SHA-256 해싱 DB 저장) |
| **CSRF** | `v_platform/middleware/csrf.py` — Double-submit 쿠키 패턴 |
| **CORS** | 앱별 화이트리스트 |
| **Rate Limit** | slowapi — 로그인 5/min, API 100/min |

---

## 4. 로그 중앙화 (Centralized Observability)

v-project의 멀티앱 특성상 **"여러 앱에서 발생하는 로그를 단일 대시보드에서 통합 조회"** 하는 능력이 핵심 경쟁력입니다. 본 절에서는 그 파이프라인 전체를 상세히 기술합니다.

### 4.1 로그 중앙화의 장점

| 기존 방식 (앱별 분산 로그) | v-project 중앙화 방식 |
|--------------------------|---------------------|
| SSH 접속 → `docker logs` → grep | Grafana Explore에서 LogQL 한 줄 |
| 앱별 로그 형식 상이 | 전 앱 **구조화 JSON (structlog)** 통일 |
| 장애 시 여러 서버 넘나들며 추적 | 단일 UI에서 `{app=~"v-.*"}` 질의 |
| 로그 보존 정책 불일치 | Loki TSDB 중앙 관리, 통일된 보존 주기 |
| 운영자 온보딩 비용 높음 | Grafana 대시보드 1개만 익히면 끝 |

### 4.2 전체 파이프라인

```
┌────────────────────────────────────────────────────────────────┐
│  Application Containers                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │v-channel-  │  │v-platform- │  │v-platform- │                │
│  │bridge-     │  │portal-     │  │template-   │                │
│  │backend     │  │backend     │  │backend     │                │
│  │            │  │            │  │            │                │
│  │ structlog  │  │ structlog  │  │ structlog  │                │
│  │ JSON ▼     │  │ JSON ▼     │  │ JSON ▼     │                │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │
│        │               │               │                         │
│        └───────────────┼───────────────┘                         │
│                        │                                          │
│               Docker stdout/stderr                                │
│                        │                                          │
│     com.docker.compose.project=v-project 라벨 부착               │
└────────────────────────┼─────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Promtail 3.0         │
              │  (grafana/promtail)   │
              │                       │
              │  pipeline_stages:     │
              │  1. docker JSON 파싱  │
              │  2. structlog 필드    │
              │     추출 (level,      │
              │     event, app)       │
              │  3. /api/health drop  │
              │  4. Loki 레이블 부착  │
              │     {level, service,  │
              │      app, container}  │
              └──────────┬────────────┘
                         │ HTTP push (:3100)
                         ▼
              ┌──────────────────────┐
              │  Loki 3.0             │
              │  (grafana/loki)       │
              │                       │
              │  TSDB v13 인덱스      │
              │  Single-binary 모드   │
              │  24h compaction       │
              │  자동 삭제 (2h 지연)  │
              │  쿼리 캐시 100MB      │
              └──────────┬────────────┘
                         │ LogQL
                         ▼
              ┌──────────────────────┐
              │  Grafana 10.4.1       │
              │                       │
              │  • Explore View       │
              │  • 3 Dashboards:      │
              │    - platform-overview│
              │    - bridge-overview  │
              │    - bridge-logs      │
              │  • 9 Alert Rules      │
              └───────────────────────┘
```

### 4.3 structlog 구조화 로깅

플랫폼 초기화 시 `v_platform/core/logging.py` 가 structlog를 설정하며, **모든 로그에 `app` 레이블이 자동 주입**됩니다.

```python
# v_platform/core/logging.py
structlog.configure(processors=[
    structlog.contextvars.merge_contextvars,
    structlog.processors.add_log_level,
    structlog.processors.TimeStamper(fmt="iso"),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.format_exc_info,
    structlog.processors.JSONRenderer(),  # 개발시 ConsoleRenderer
])
```

#### 애플리케이션 사용 예

```python
logger.info("message_routed",
    source_platform="slack",
    target_platform="teams",
    message_id="1234567890.123",
    route="C789012→teamId:channelId",
    duration_ms=45,
    user_email="alice@example.com"
)
```

#### 출력되는 JSON (Promtail 입력)

```json
{
  "event": "message_routed",
  "level": "info",
  "timestamp": "2026-04-13T09:30:15.123Z",
  "app": "v-channel-bridge",
  "source_platform": "slack",
  "target_platform": "teams",
  "message_id": "1234567890.123",
  "route": "C789012→teamId:channelId",
  "duration_ms": 45,
  "user_email": "alice@example.com"
}
```

### 4.4 Promtail 파이프라인 설정

`monitoring/promtail/promtail-config.yml`:

```yaml
scrape_configs:
  - job_name: v-project-containers
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        filters:
          - name: label
            values: ["com.docker.compose.project=v-project"]

    pipeline_stages:
      - docker: {}                          # Docker JSON 로그 래퍼 해제
      - json:                               # structlog 필드 추출
          expressions:
            level: level
            event: event
            app: app
            timestamp: timestamp
      - labels:                             # Loki 인덱스 레이블
          level:
          app:
          service:
      - timestamp:
          source: timestamp
          format: RFC3339Nano
      - match:                              # 헬스체크 노이즈 제거
          selector: '{service=~".+"}'
          stages:
            - regex:
                expression: '.*GET /api/health.*'
            - drop:
                source: ""
```

### 4.5 Grafana LogQL 조회 예시

중앙화의 위력은 **단일 쿼리로 모든 앱을 통합 조회**할 수 있다는 점입니다.

```logql
# 전체 앱에서 ERROR 레벨 로그 (최근 1시간)
{app=~"v-.*", level="error"}

# 특정 앱의 메시지 라우팅 이벤트만
{app="v-channel-bridge"} |= "message_routed" | json | duration_ms > 100

# 특정 사용자의 크로스앱 활동
{app=~"v-.*"} | json | user_email="alice@example.com"

# 5xx 에러율 시계열
sum by (app) (count_over_time({app=~"v-.*"} |= "ERROR" [5m]))
```

### 4.6 Prometheus 메트릭

| Job | 대상 | 수집 주기 | 주요 메트릭 |
|-----|------|----------|------------|
| `v-channel-bridge` | backend:8000/metrics | 15s | http_requests_total, http_request_duration_seconds, bridge_messages_total |
| `v-platform-portal` | portal-backend:8080/metrics | 15s | http_requests_total, app_launches_total |
| `cadvisor` | cadvisor:8080/metrics | 15s | 컨테이너 CPU/메모리/네트워크/디스크 I/O |
| `node_exporter` | node-exporter:9100 | 15s | 호스트 CPU/메모리/디스크/네트워크 |

### 4.7 알림 규칙 (`alerts.yml`)

| 알림 | 심각도 | 조건 | 평가 주기 |
|------|--------|------|----------|
| VMSBackendDown | CRITICAL | up{job="v-channel-bridge"} == 0 | 1분 |
| VMSHighErrorRate | CRITICAL | 5xx 에러율 > 5% (5분 윈도) | 30초 |
| VMSSlowResponse | WARNING | P95 응답시간 > 2초 | 30초 |
| VMSBridgeHighMessageFailure | WARNING | 메시지 에러 > 0.1/s | 30초 |
| ContainerHighCPU | WARNING | CPU > 80% (5분 지속) | 1분 |
| ContainerHighMemory | WARNING | Memory > 512MB | 1분 |
| ContainerRestarting | WARNING | 재시작 > 3회 / 1시간 | 즉시 |
| HostDiskSpaceLow | CRITICAL | 디스크 여유 < 10% | 1분 |
| HostHighCPU | WARNING | CPU > 85% (10분 지속) | 1분 |

### 4.8 통합 이벤트 브로드캐스터 (실시간)

로그 외에 **실시간 사용자 피드백**을 위해 두 가지 서비스가 추가로 가동됩니다.

- **`services/log_buffer.py`** — 최근 N개 로그를 링 버퍼에 보관 → 관리자가 Dashboard에서 실시간 뷰어로 확인
- **`services/event_broadcaster.py`** — 도메인 이벤트(bridge_started, route_added, provider_disconnected)를 WebSocket으로 즉시 전파

---

## 5. Infrastructure

### 5.1 Docker Compose 서비스 토폴로지

| 서비스 | 이미지 | 포트 | 프로필 | 헬스체크 |
|--------|--------|------|--------|----------|
| postgres | postgres:16-alpine | 5432 | default | `pg_isready` 10s |
| redis | redis:7-alpine | 6379 | default | `redis-cli ping` 10s |
| mailhog | mailhog/mailhog | 1025/8025 | default | — |
| v-channel-bridge-backend | python:3.11-slim | 8000 | default | `curl /api/health` 60s |
| v-channel-bridge-frontend | node:18-alpine | 5173 | default | `wget /` 30s |
| v-platform-portal-backend | python:3.11-slim | 8080 | portal | `curl /api/health` 60s |
| v-platform-portal-frontend | node:18-alpine | 5180 | portal | `wget /` 30s |
| v-platform-template-backend | python:3.11-slim | 8002 | template | `curl /api/health` 60s |
| v-platform-template-frontend | node:18-alpine | 5174 | template | `wget /` 30s |
| docusaurus | node:18-alpine | 3000 | docs | — |
| prometheus | prom/prometheus:v2.51.0 | 9090 | default | HTTP 30s |
| grafana | grafana/grafana:10.4.1 | 3001 | default | HTTP 30s |
| loki | grafana/loki:3.0.0 | 3100 | default | `/ready` 30s |
| promtail | grafana/promtail:3.0.0 | 9080 | default | TCP 30s |
| cadvisor | cadvisor:v0.49.1 | 8081 | default | `/healthz` 30s |
| node-exporter | node-exporter:v1.8.0 | 9100 | default | `/metrics` 30s |

**프로필별 기동**:

```bash
docker compose up -d --build                                # 기본 (bridge)
docker compose --profile portal up -d                       # + portal
docker compose --profile template --profile portal up -d    # + template + portal
docker compose --profile docs up -d                         # + docusaurus
```

### 5.2 보안 아키텍처 (6계층)

```
┌──────────────────────────────────────────────────────────┐
│ [L1] 네트워크     │ Docker Bridge Network, 앱별 포트 격리 │
│                   │ Production: 80/443만 외부 노출        │
├───────────────────┼─────────────────────────────────────┤
│ [L2] 전송         │ TLS 1.2/1.3, HSTS (max-age=31536000) │
├───────────────────┼─────────────────────────────────────┤
│ [L3] 인증         │ JWT(python-jose) + SSO(Entra/OIDC)   │
│                   │ Refresh Token + Device Fingerprint   │
│                   │ Rate Limiting(slowapi)               │
├───────────────────┼─────────────────────────────────────┤
│ [L4] 인가         │ RBAC 3단계 + 권한 그룹 + 개인 오버라이드│
│                   │ 서버 기반 메뉴 필터링 (/api/menus/sidebar)│
│                   │ app_id 기반 데이터 격리              │
├───────────────────┼─────────────────────────────────────┤
│ [L5] 데이터 보호  │ Fernet 암호화 (Provider 토큰)         │
│                   │ bcrypt 해싱 (비밀번호)                │
│                   │ CSRF Double-submit 쿠키              │
├───────────────────┼─────────────────────────────────────┤
│ [L6] 감사         │ 27+ 액션 타입, app_id 분리            │
│                   │ IP/User-Agent 자동 기록               │
│                   │ 성공/실패/오류 상태 추적              │
└───────────────────┴─────────────────────────────────────┘
```

### 5.3 멀티 스테이지 Docker 빌드

```dockerfile
# Backend
FROM python:3.11-slim AS builder
RUN apt-get update && apt-get install -y gcc
COPY requirements.txt . && pip install --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runtime
COPY --from=builder /install /usr/local
RUN adduser --uid 1000 appuser
USER appuser
HEALTHCHECK CMD curl -f http://localhost:8000/api/health

# Frontend
FROM node:18-alpine AS builder
RUN corepack enable && pnpm install && pnpm build

FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

## 6. Technical Scalability

### 6.1 현재 처리 한계와 확장 전략

| 영역 | 현재 구현 | 단기 확장 | 중장기 확장 |
|------|----------|----------|------------|
| 메시지 처리 | asyncio 단일 루프 (~100 msg/s) | 배치 튜닝 (50→200) | 다중 인스턴스 + Redis Pub/Sub (~1,000+ msg/s) |
| DB 쓰기 | 배치 큐 (50개/5s) | Connection pool 확장 | Read Replica + 파티셔닝 |
| 라우팅 | Redis 인메모리 단일 노드 | AOF 영속화 | Redis Cluster (3+ 노드) |
| 파일 전송 | 로컬 임시 → 업로드 | 임시 디렉토리 분리 | Object Storage (MinIO/S3) |
| 로그/메트릭 | Loki/Prometheus 단일 | 로컬 보존 연장 | Thanos/Cortex 장기 저장 |

### 6.2 Kubernetes 전환 준비도

현재 아키텍처는 K8s 전환을 위한 사전 요건이 **이미 충족**되어 있습니다.

| 요건 | 충족 여부 | 비고 |
|------|----------|------|
| 컨테이너화 | ✅ | 모든 서비스 Docker 이미지 |
| 헬스체크 내장 | ✅ | Liveness/Readiness 직접 매핑 가능 |
| 환경 변수 주입 | ✅ | → ConfigMap/Secret 매핑 |
| Stateless Backend | ✅ | 상태는 Redis/PostgreSQL에 위임 |
| 리소스 제한 명시 | ✅ | docker-compose에 limits/reservations 정의 |
| 헥사고날 설정 | ✅ | 12-factor app 준수 |

---

## 7. 기술 스택 종합

### 7.1 Backend 주요 의존성

| 카테고리 | 패키지 | 버전 | 용도 |
|---------|--------|------|------|
| Web | FastAPI | 0.109.0 | 비동기 REST API |
| ASGI | Uvicorn | 0.27.0 | 프로덕션 서버 |
| Validation | Pydantic | 2.5.3 | 데이터 검증/직렬화 |
| ORM | SQLAlchemy | 2.0.25 | PostgreSQL ORM |
| Migration | Alembic | 1.13.1 | 스키마 마이그레이션 |
| DB Driver | psycopg2-binary | 2.9.9 | PostgreSQL 드라이버 |
| Cache | redis-py | 5.0.1 | Redis 클라이언트 |
| Auth | python-jose | 3.3.0 | JWT |
| Security | cryptography | 42.0.5 | Fernet 암호화 |
| Hash | bcrypt | 4.1.2 | 비밀번호 해싱 |
| Rate Limit | slowapi | 0.1.9 | API 요청 제한 |
| Logging | structlog | 24.1.0 | 구조화 JSON 로깅 |
| Metrics | prometheus-client | 0.19.0 | Prometheus 메트릭 |
| Slack | slack-bolt / slack-sdk | 1.20.1 / 3.33.4 | Socket Mode, Web API |
| Teams | botbuilder-core / aiohttp | 4.16.0 / ≥3.9.0 | Bot Framework, Graph API |
| Email | aiosmtplib / Jinja2 | 3.0.1 / 3.1.3 | 비동기 SMTP, 템플릿 |
| Testing | pytest / pytest-asyncio / pytest-cov | 7.4.4 / 0.23.3 / 4.1.0 | 테스트 프레임워크 |
| Lint | ruff / mypy | 0.1.15 / 1.8.0 | 린트, 타입 검사 |

### 7.2 Frontend 주요 의존성

| 카테고리 | 패키지 | 버전 | 용도 |
|---------|--------|------|------|
| UI | React | 18.2.0 | 컴포넌트 UI |
| Build | Vite | 5.0.11 | 빌드/HMR |
| Lang | TypeScript | 5.3.3 | 타입 안전성 |
| Router | react-router-dom | 6.21.0 | SPA 라우팅 |
| Client State | Zustand | 4.4.7 | 경량 구독 기반 상태 |
| Server State | TanStack Query | 5.17.0 | 서버 상태 캐싱 |
| HTTP | Axios | 1.6.5 | 인터셉터 기반 클라이언트 |
| CSS | Tailwind CSS | 3.4.1 | 유틸리티 CSS |
| Charts | Recharts | 2.15.4 | SVG 차트 |
| Icons | Lucide React | 0.309.0 | 트리셰이킹 아이콘 |
| Fingerprint | FingerprintJS | 4.2.2 | 디바이스 식별 |
| Tour | Driver.js | 1.3.1 | 온보딩 투어 |
| Testing | Vitest | 1.2.0 | 테스트 러너 |
| Lint | ESLint / Prettier | 8.56.0 / 3.2.4 | 코드 품질 |

### 7.3 Infrastructure

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| Container Orchestrator | Docker Compose | v2 |
| Database | PostgreSQL | 16 Alpine |
| Cache | Redis | 7 Alpine |
| Reverse Proxy | Nginx | Alpine |
| Metrics | Prometheus | v2.51.0 |
| Dashboard | Grafana | 10.4.1 |
| Log Aggregation | Loki | 3.0.0 |
| Log Collector | Promtail | 3.0.0 |
| Container Metrics | cAdvisor | v0.49.1 |
| Host Metrics | Node Exporter | v1.8.0 |
| Documentation | Docusaurus | 3.1.0 |

---

**문서 버전**: 2.0 (v-project 멀티앱 플랫폼 기준)
**최종 업데이트**: 2026-04-13
