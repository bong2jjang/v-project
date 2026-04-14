---
id: technical-architecture
title: 시스템 아키텍처
sidebar_position: 1
tags: [architecture, tech-portfolio, platform]
---

# 시스템 아키텍처

v-project는 재사용 가능한 플랫폼 프레임워크(v-platform) 위에 복수의 비즈니스 앱을 구동시키는 멀티 앱 시스템이다. 이 문서는 시스템의 계층 분리, 데이터 격리, 인증/인가, 메시지 브리지, 모니터링, 확장성을 엔지니어링 관점에서 기술한다.

---

## 1. 전체 구성도

```
+---------------------------------------------------------------------------+
|                          Infrastructure Layer                              |
|   Docker Compose (profiles: default, portal, template, docs)              |
+---------------------------------------------------------------------------+
|                           Application Tier                                 |
|                                                                            |
|   +------------------+  +------------------+  +--------------------+      |
|   | v-channel-bridge |  | v-platform-portal|  | v-platform-template|      |
|   |   :8000 / :5173  |  |   :8080 / :5180  |  |   :8002 / :5174   |      |
|   |                  |  |                  |  |                    |      |
|   | Bridge Engine    |  | App Registry     |  | Minimal Base       |      |
|   | Slack/Teams      |  | SSO Relay        |  | Scaffolding        |      |
|   | Provider         |  | App Launcher     |  |                    |      |
|   | Route Manager    |  | Sitemap          |  |                    |      |
|   +--------+---------+  +--------+---------+  +---------+----------+      |
|            |                      |                       |                |
|            +----------+-----------+-----------+-----------+                |
|                       |                       |                            |
|   +-------------------v-----------------------v------------------------+  |
|   |                    Platform Framework                               |  |
|   |  v_platform (Python pkg)  +  @v-platform/core (npm pkg)            |  |
|   |                                                                     |  |
|   |  PlatformApp        -- app.py: FastAPI bootstrap + router 등록      |  |
|   |  17 Routers         -- auth, users, perms, menus, orgs, audit, ... |  |
|   |  13 Services        -- notification, email, token, permission, ... |  |
|   |  12 Models          -- user, audit_log, menu_item, notification ...|  |
|   |  26 Migrations      -- p001~p026 (RBAC/SSO/multi-app/branding)    |  |
|   |  SSO Providers      -- base, microsoft, generic_oidc, registry    |  |
|   |  PlatformProvider   -- React Config + QueryClient + Theme          |  |
|   +--------------------------------------------------------------------+  |
+---------------------------------------------------------------------------+
|                          Data & Cache Tier                                  |
|                                                                            |
|   PostgreSQL 16           Redis 7               MailHog (dev)             |
|   ----------------        --------              -----------               |
|   공유 DB                 라우팅 규칙            로컬 SMTP                 |
|   app_id 격리             스레드 매핑            이메일 미리보기            |
|   26개 마이그레이션       세션 캐시                                        |
|                                                                            |
+---------------------------------------------------------------------------+
|                          Observability Tier                                 |
|                                                                            |
|   Prometheus <-- /metrics          Loki <-- Promtail <-- structlog JSON   |
|        |                             |           |                         |
|        +-------> Grafana <-----------+           |                         |
|                                                  |                         |
|   Alerts (alerts.yml)                Labels: {app, service, level}        |
+---------------------------------------------------------------------------+
```

### 계층 분리 원칙

| 계층 | 모듈 | 경로 | 책임 |
|------|------|------|------|
| Platform Backend | `v_platform` (Python 패키지) | `platform/backend/v_platform/` | 인증, SSO, RBAC, 사용자/조직 관리, 감사 로그, 알림, 시스템 설정, 메뉴, 메트릭 수집 |
| Platform Frontend | `@v-platform/core` (npm 패키지) | `platform/frontend/v-platform-core/` | 18개 플랫폼 페이지, 68개 공용 컴포넌트, 6개 전역 스토어, 13개 커스텀 훅 |
| App: v-channel-bridge | Slack/Teams 메시지 브리지 | `apps/v-channel-bridge/` | 채널 라우팅, Provider 어댑터, 메시지 이력, 통계 |
| App: v-platform-template | 새 앱 부트스트랩 템플릿 | `apps/v-platform-template/` | 최소 구성 스캐폴딩 |
| App: v-platform-portal | 통합 앱 포털 | `apps/v-platform-portal/` | AppRegistry, SSO Relay, App Launcher |

---

## 2. 데이터 격리 전략 (app_id)

하나의 PostgreSQL 인스턴스를 여러 앱이 공유하면서도 앱 경계 데이터를 엄격히 분리한다. 마이그레이션 `p015_multi_app_isolation.py`에서 도입되었으며, 이후 `p017`, `p018`, `p019`에서 권한/유니크 제약 단위로 확장되었다.

### 2.1 격리 대상 테이블

```sql
-- p015_multi_app_isolation.py
ALTER TABLE menu_items       ADD COLUMN app_id VARCHAR(50) NULL;
ALTER TABLE audit_logs       ADD COLUMN app_id VARCHAR(50) NULL;
ALTER TABLE system_settings  ADD COLUMN app_id VARCHAR(50) NULL;

CREATE INDEX idx_menu_items_app_id ON menu_items(app_id);
CREATE INDEX idx_audit_logs_app_id ON audit_logs(app_id);
```

| 테이블 | `app_id = NULL` (공통) | `app_id = "v-channel-bridge"` (앱 전용) |
|--------|------------------------|----------------------------------------|
| `menu_items` | 프로필, 설정, 사용자 관리 | 채널, 메시지, 통계 |
| `audit_logs` | 로그인, 사용자 CRUD | Route 변경, Bridge 제어 |
| `system_settings` | 플랫폼 기본 브랜딩 | 앱 고유 로고, 타이틀, 설명 |
| `notifications` | 시스템 알림 | 앱별 알림 (p022) |

### 2.2 자동 분류 메커니즘

`PlatformApp.init_platform()` 호출 시 `_classify_app_menus()`가 실행된다. 앱 개발자는 `app_menu_keys` 리스트만 선언하면, 해당 `permission_key`를 가진 `menu_items` 행에 `app_id`가 자동 부여된다.

```python
# platform/backend/v_platform/app.py (lines 135-152)
def _classify_app_menus(self):
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE menu_items SET app_id = :app_id "
                 "WHERE permission_key IN (...) AND app_id IS NULL"),
            params,
        )
        conn.commit()
```

이 메커니즘으로 인해 앱마다 메뉴/감사로그/설정이 자동으로 분리되며, 프론트엔드의 `GET /api/menus/sidebar?app_id=xxx` 요청에서도 해당 앱 소속 메뉴만 반환된다.

---

## 3. 인증/인가 흐름

### 3.1 JWT 기반 인증

```
[사용자]
   |
   v
POST /api/auth/login  (email + password + device_fingerprint)
   |
   +-- bcrypt 해싱 검증 (passlib)
   +-- Access Token 발급 (python-jose HS256, 짧은 수명)
   +-- Refresh Token 발급 (SHA-256 해싱 후 DB 저장, 디바이스별)
   +-- 감사 로그: action="login", status="success"
   |
   v
[클라이언트]
   |  Authorization: Bearer {access_token}
   |  X-CSRF-Token: {csrf_token}
   v
[API 호출]
   |
   +-- 토큰 만료 시: POST /api/auth/refresh (refresh_token)
   +-- 3회 실패: 강제 로그아웃
```

관련 코드:
- 인증 라우터: `platform/backend/v_platform/api/auth.py`
- 토큰 서비스: `platform/backend/v_platform/services/token_service.py`
- CSRF 미들웨어: `platform/backend/v_platform/middleware/csrf.py`
- Refresh Token 모델: `platform/backend/v_platform/models/refresh_token.py`

### 3.2 SSO (Microsoft Entra / Generic OIDC)

```
[사용자] --> GET /api/sso/microsoft/authorize
                |
                v
          Microsoft Entra ID (OAuth 2.0 Authorization Code)
                |
                v
          GET /sso/callback?code=xxx&state=yyy
                |
                +-- SSOState 검증 (nonce + state, Redis TTL)
                +-- authorization_code --> access_token 교환
                +-- 사용자 매핑 (email 기준)
                +-- JWT 발급 + 세션 생성
```

SSO 관련 모듈:
- `platform/backend/v_platform/sso/base.py` -- 추상 SSO Provider
- `platform/backend/v_platform/sso/microsoft.py` -- Microsoft Entra
- `platform/backend/v_platform/sso/generic_oidc.py` -- 범용 OIDC
- `platform/backend/v_platform/sso/registry.py` -- Provider 등록/조회

### 3.3 Token Relay SSO (Portal --> App)

v-platform-portal에서 앱 런처 클릭 시, 포털의 JWT를 앱에 릴레이하여 재인증 없이 진입한다.

```
User --(포털 로그인)--> Portal:8080
         |
         | JWT 발급 (v-platform-portal 서명)
         v
User --(앱 카드 클릭)--> /relay?target=bridge&token={jwt}
         |
         v
Bridge:8000 --(JWT 검증, 공통 SECRET_KEY)--> 세션 생성 --> /
```

핵심 전제: 모든 앱이 동일한 `SECRET_KEY` 환경변수를 공유한다. 관련 서비스: `apps/v-platform-portal/backend/app/services/app_registry.py`.

### 3.4 RBAC (역할 기반 접근 제어)

3단계 역할 체계:

| 역할 | 수준 | 접근 범위 |
|------|------|----------|
| `SYSTEM_ADMIN` | 최고 관리자 | 모든 관리 기능 + 시스템 설정 |
| `ORG_ADMIN` | 조직 관리자 | 소속 조직 사용자 관리 |
| `USER` | 일반 사용자 | 개인 프로필 + 앱 기능 |

역할 위에 권한 그룹(`permission_group`)과 개별 사용자 권한 오버라이드(`user_permission`)가 겹쳐진다. 프론트엔드에서는 `permissionStore.hasPermission(key)`로 UI 요소를 분기하고, 서버는 `GET /api/menus/sidebar`에서 RBAC 결과에 맞는 메뉴만 반환한다.

관련 마이그레이션: `p006_permission_groups.py`, `p009_align_group_names_with_roles.py`, `p017_app_id_permissions.py`, `p018_permission_group_unique_per_app.py`.

---

## 4. 메시지 브리지 흐름 (v-channel-bridge)

Slack 채널 메시지가 Teams 채널로 브리지되는 전체 경로:

```
[1] Slack Socket Mode Event
     |
     v
[2] SlackProvider.handle_message()
     |  +-- 봇 자신의 메시지 필터링
     |  +-- 서브타입 필터링
     |  +-- 사용자 프로필 조회 (캐시 우선)
     v
[3] transform_to_common() -- Slack 이벤트 --> CommonMessage (Pydantic)
     |
     v
[4] WebSocketBridge._route_message()
     |  +-- CommandProcessor (/vms, /bridge)
     |  +-- RouteManager.get_targets() -- Redis SMEMBERS
     v
[5] WebSocketBridge._send_message() (대상별 반복)
     |  +-- 메시지 모드 조회 (sender_info | editable)
     |  +-- 첨부파일 다운로드
     |  +-- 스레드 매핑 조회 (TTL 7일)
     v
[6] TeamsProvider.send_message()
     |  +-- CommonMessage --> Teams Activity
     |  +-- Markdown --> Teams HTML 변환
     |  +-- Graph API POST
     v
[7] MessageQueue.enqueue() -- asyncio.Queue 적재
     |  +-- 배치 조건: 50개 또는 5초
     |  +-- 단일 트랜잭션 bulk INSERT/UPDATE
     v
[8] PostgreSQL messages 테이블 영속화
     |
     +-- structlog.info("message_routed", app="v-channel-bridge", ...)
            +-- Promtail 수집 --> Loki 저장 --> Grafana 시각화
```

### CommonMessage 스키마

`apps/v-channel-bridge/backend/app/schemas/common_message.py`에 정의된 플랫폼 중립 메시지 표현이다. 모든 Provider는 수신한 플랫폼 고유 메시지를 이 스키마로 변환한 뒤 라우팅 엔진에 전달한다.

```python
class CommonMessage(BaseModel):
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

### Redis 라우팅 구조

```
route:{platform}:{channel_id}               --> SMEMBERS (대상 집합)
route:{platform}:{channel_id}:names         --> HGETALL  (채널 이름)
route:{platform}:{channel_id}:modes         --> HGETALL  (sender_info | editable)
route:{platform}:{channel_id}:bidirectional --> HGETALL  ("1" | "0")
route:{platform}:{channel_id}:enabled       --> HGETALL  ("1" | "0")

thread:{platform}:{channel_id}:{ts}        --> STRING   (TTL 7일, 스레드 매핑)
```

양방향 Route: `add_route(is_bidirectional=True)` 호출 시 역방향 키가 자동 생성된다. UI에서는 `frozenset` 쌍 추적으로 중복을 제거하여 1개로 표시한다. `route_manager.py`가 SCAN 커서 기반 키 순회를 사용하므로 Redis 블로킹이 발생하지 않는다.

---

## 5. 모니터링 파이프라인

### 5.1 3축 관측 체계

| 축 | 도구 | 데이터 소스 | 수집 방식 |
|----|------|-----------|----------|
| 메트릭 | Prometheus v2.51.0 | Backend `/metrics`, cAdvisor, Node Exporter | Pull (15초 주기) |
| 로그 | Loki 3.0 + Promtail 3.0 | structlog JSON (Docker stdout) | Push (HTTP :3100) |
| 시각화/알림 | Grafana 10.4.1 | Prometheus + Loki 데이터소스 | 대시보드 + Alert Rules |

설정 파일: `monitoring/prometheus/prometheus.yml`, `monitoring/promtail/promtail-config.yml`, `monitoring/loki/loki-config.yml`, `monitoring/prometheus/alerts.yml`.

### 5.2 로그 중앙화 파이프라인

모든 앱의 structlog JSON 로그가 Docker stdout으로 출력되면, Promtail이 Docker Service Discovery로 자동 수집하여 Loki에 적재한다.

```
App Containers (structlog JSON --> stdout)
         |
         v
Promtail 3.0
  +-- docker_sd: com.docker.compose.project=v-project 필터
  +-- pipeline: docker JSON 파싱 --> structlog 필드 추출 --> 레이블 부착 {level, app, service}
  +-- /api/health 요청 로그 자동 드롭 (노이즈 제거)
         |
         v
Loki 3.0 (TSDB v13 인덱스, 단일 바이너리 모드)
         |
         v
Grafana Explore (LogQL)
```

`v_platform/core/logging.py`에서 structlog를 설정하며, `app` 레이블이 모든 로그에 자동 주입된다.

### 5.3 Prometheus 수집 대상

| Job | 대상 | 주요 메트릭 |
|-----|------|------------|
| `v-channel-bridge` | backend:8000/metrics | http_requests_total, http_request_duration_seconds, bridge_messages_total |
| `v-platform-portal` | portal-backend:8080/metrics | http_requests_total, app_launches_total |
| `cadvisor` | cadvisor:8080/metrics | 컨테이너 CPU/메모리/네트워크/디스크 I/O |
| `node_exporter` | node-exporter:9100 | 호스트 CPU/메모리/디스크/네트워크 |

### 5.4 알림 규칙

`monitoring/prometheus/alerts.yml`에 정의:

| 알림 | 심각도 | 조건 |
|------|--------|------|
| VMSBackendDown | CRITICAL | `up{job="v-channel-bridge"} == 0` (1분 지속) |
| VMSHighErrorRate | CRITICAL | 5xx 에러율 > 5% (5분 윈도) |
| VMSSlowResponse | WARNING | P95 응답시간 > 2초 |
| VMSBridgeHighMessageFailure | WARNING | 메시지 에러 > 0.1/s |
| ContainerHighCPU | WARNING | CPU > 80% (5분 지속) |
| ContainerHighMemory | WARNING | Memory > 512MB |
| ContainerRestarting | WARNING | 재시작 > 3회/h |
| HostDiskSpaceLow | CRITICAL | 디스크 여유 < 10% |
| HostHighCPU | WARNING | CPU > 85% (10분 지속) |

### 5.5 실시간 이벤트 브로드캐스터

로그 파이프라인 외에 사용자 대면 실시간 모니터링을 위한 두 가지 서비스가 가동된다.

- `services/log_buffer.py` -- 최근 N개 로그를 링 버퍼에 보관, Dashboard에서 실시간 로그 뷰어로 확인
- `services/event_broadcaster.py` -- 도메인 이벤트(bridge_started, route_added, provider_disconnected)를 WebSocket으로 팬아웃

---

## 6. 보안 아키텍처

6계층 보안 설계:

| 계층 | 구현 | 관련 코드 |
|------|------|----------|
| L1 네트워크 | Docker Bridge Network, 앱별 포트 격리 | `docker-compose.yml` |
| L2 전송 | TLS 1.2/1.3 (프로덕션), HSTS | Nginx 설정 |
| L3 인증 | JWT(python-jose) + SSO(Entra/OIDC) + Rate Limiting(slowapi) | `v_platform/api/auth.py`, `v_platform/sso/` |
| L4 인가 | RBAC 3단계 + 권한 그룹 + 개인 오버라이드 + app_id 격리 | `v_platform/services/permission_service.py` |
| L5 데이터 보호 | Fernet 대칭 암호화(Provider 토큰), bcrypt 해싱(비밀번호), CSRF Double-submit | `v_platform/utils/encryption.py`, `v_platform/middleware/csrf.py` |
| L6 감사 | 27+ 액션 타입, app_id 분리, IP/User-Agent 기록 | `v_platform/utils/audit_logger.py`, `v_platform/models/audit_log.py` |

---

## 7. 인프라 구성

### 7.1 Docker Compose 서비스 토폴로지

| 서비스 | 이미지 | 포트 | 프로필 | 헬스체크 |
|--------|--------|------|--------|----------|
| postgres | postgres:16-alpine | 5432 | default | `pg_isready` |
| redis | redis:7-alpine | 6379 | default | `redis-cli ping` |
| mailhog | mailhog/mailhog | 1025/8025 | default | -- |
| v-channel-bridge-backend | python:3.11-slim | 8000 | default | `curl /api/health` |
| v-channel-bridge-frontend | node:18-alpine | 5173 | default | `wget /` |
| v-platform-portal-backend | python:3.11-slim | 8080 | portal | `curl /api/health` |
| v-platform-portal-frontend | node:18-alpine | 5180 | portal | `wget /` |
| v-platform-template-backend | python:3.11-slim | 8002 | template | `curl /api/health` |
| v-platform-template-frontend | node:18-alpine | 5174 | template | `wget /` |
| docusaurus | node:18-alpine | 3000 | docs | -- |
| prometheus | prom/prometheus:v2.51.0 | 9090 | default | HTTP |
| grafana | grafana/grafana:10.4.1 | 3001 | default | HTTP |
| loki | grafana/loki:3.0.0 | 3100 | default | `/ready` |
| promtail | grafana/promtail:3.0.0 | 9080 | default | TCP |
| cadvisor | cadvisor:v0.49.1 | 8081 | default | `/healthz` |
| node-exporter | node-exporter:v1.8.0 | 9100 | default | `/metrics` |

### 7.2 프로필별 기동

```bash
docker compose up -d --build                                 # 기본 (bridge)
docker compose --profile portal up -d --build                # + portal
docker compose --profile template --profile portal up -d     # + template + portal
docker compose --profile docs up -d                          # + docusaurus
```

---

## 8. 확장성 포인트

### 8.1 새 앱 추가

1. `apps/v-platform-template/` 복사
2. `main.py`에서 `app_name`, `app_menu_keys` 수정
3. `docker-compose.yml`에 서비스 정의 + 프로필 지정
4. 앱 고유 라우터를 `register_app_routers()`로 등록

이것만으로 인증/RBAC/감사/알림/SSO/관측성이 자동 활성화된다. 플랫폼 코드 수정은 필요 없다.

### 8.2 새 메시지 Provider 추가

`apps/v-channel-bridge/backend/app/adapters/base.py`의 `BasePlatformProvider`를 상속하여 구현한다.

필수 메서드:
- `connect()` / `disconnect()` -- 플랫폼 연결/해제
- `send_message(channel_id, CommonMessage)` -- 메시지 전송
- `get_channels()` -- 채널 목록 조회
- `test_connection()` -- 연결 테스트

현재 구현: `slack_provider.py` (Socket Mode), `teams_provider.py` (Bot Framework + Graph API).

### 8.3 새 SSO Provider 추가

`platform/backend/v_platform/sso/base.py`의 추상 클래스를 상속하고 `registry.py`에 등록한다. 현재 Microsoft Entra와 Generic OIDC가 구현되어 있다.

### 8.4 확장 전략

| 영역 | 현재 | 확장 방향 |
|------|------|----------|
| 메시지 처리 | asyncio 단일 루프 | 다중 인스턴스 + Redis Pub/Sub |
| DB | PostgreSQL 단일 | Read Replica + PgBouncer |
| 라우팅 | Redis 단일 노드 | Redis Cluster (3+ 노드) |
| 파일 전송 | 로컬 임시 디렉토리 | Object Storage (MinIO/S3) |
| 로그/메트릭 | Loki/Prometheus 단일 | Thanos/Mimir 장기 저장 |
| 컨테이너 오케스트레이션 | Docker Compose | Kubernetes (Helm Chart) |

### 8.5 Kubernetes 전환 준비도

| 요건 | 충족 여부 | 근거 |
|------|----------|------|
| 컨테이너화 | 충족 | 모든 서비스가 Docker 이미지로 패키징 |
| 헬스체크 내장 | 충족 | Liveness/Readiness 직접 매핑 가능 (`/api/health`) |
| 환경 변수 주입 | 충족 | ConfigMap/Secret 매핑 가능 |
| Stateless Backend | 충족 | 상태는 PostgreSQL/Redis에 위임 |
| 리소스 제한 | 충족 | docker-compose에 limits/reservations 정의 |
| 12-Factor App | 충족 | 설정 외부화, 프로세스 무상태 |

---

## 9. 기술 스택 종합

### Backend

| 카테고리 | 패키지 | 버전 | 용도 |
|---------|--------|------|------|
| Web Framework | FastAPI | 0.109.0 | 비동기 REST API |
| ASGI Server | Uvicorn | 0.27.0 | 프로덕션 서버 |
| Validation | Pydantic | 2.5.3 | 데이터 검증/직렬화 |
| ORM | SQLAlchemy | 2.0.25 | PostgreSQL ORM |
| DB Driver | psycopg2-binary | 2.9.9 | PostgreSQL 드라이버 |
| Cache | redis-py | 5.0.1 | Redis 클라이언트 |
| Auth | python-jose | 3.3.0 | JWT 생성/검증 |
| Encryption | cryptography | 42.0.5 | Fernet 대칭 암호화 |
| Hashing | bcrypt / passlib | 4.1.2 | 비밀번호 해싱 |
| Rate Limiting | slowapi | 0.1.9 | API 요청 제한 |
| Logging | structlog | 24.1.0 | 구조화 JSON 로깅 |
| Metrics | prometheus-client | 0.19.0 | Prometheus 메트릭 |
| Slack | slack-bolt / slack-sdk | 1.20.1 / 3.33.4 | Socket Mode, Web API |
| Teams | botbuilder-core / aiohttp | 4.16.0 / 3.9+ | Bot Framework, Graph API |
| Email | aiosmtplib / Jinja2 | 3.0.1 / 3.1.3 | 비동기 SMTP, 템플릿 |
| Testing | pytest / pytest-asyncio | 7.4.4 / 0.23.3 | 테스트 프레임워크 |
| Lint | ruff | 0.1.15 | 린트 + 포맷팅 |

### Frontend

| 카테고리 | 패키지 | 버전 | 용도 |
|---------|--------|------|------|
| UI Framework | React | 18.2.0 | 컴포넌트 기반 UI |
| Build | Vite | 5.0.11 | ESBuild 기반 HMR |
| Language | TypeScript | 5.3.3 | 정적 타입 안전성 (strict) |
| Routing | react-router-dom | 6.21.0 | SPA 라우팅 |
| Client State | Zustand | 4.4.7 | 경량 구독 기반 상태 |
| Server State | TanStack Query | 5.17.0 | API 캐싱 + 자동 갱신 |
| HTTP | Axios | 1.6.5 | 인터셉터 기반 클라이언트 |
| CSS | Tailwind CSS | 3.4.1 | 유틸리티 + 시맨틱 토큰 |
| Charts | Recharts | 2.15.4 | SVG 반응형 차트 |
| Icons | Lucide React | 0.309.0 | 트리셰이킹 아이콘 |
| Fingerprint | FingerprintJS | 4.2.2 | 디바이스 식별 |
| Tour | Driver.js | 1.3.1 | 앱별 맞춤 온보딩 |
| Testing | Vitest | 1.2.0 | 테스트 러너 |
| Lint | ESLint / Prettier | 8.56.0 / 3.2.4 | 코드 품질 |

### Infrastructure

| 컴포넌트 | 기술 | 버전 |
|---------|------|------|
| Container Orchestration | Docker Compose | v2 |
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

**최종 업데이트**: 2026-04-13
**문서 버전**: 3.0
