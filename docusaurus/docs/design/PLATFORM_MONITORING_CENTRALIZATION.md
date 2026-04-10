# v-platform Monitoring 중앙화 설계

> **문서 버전**: 1.0  
> **작성일**: 2026-04-11  
> **상태**: 설계 검토 대기  
> **목적**: 메트릭/로그/헬스체크를 v-platform 레벨에서 중앙 제공하여, 앱은 비즈니스 로직에만 집중

---

## 1. 현재 상태 (문제점)

### 1.1 메트릭

| 항목 | 현재 | 문제 |
|------|------|------|
| Prometheus 미들웨어 | v-platform에 존재 | 플랫폼 API만 수집, 앱 API는 자동 포함되나 앱별 커스텀 메트릭은 없음 |
| `/metrics` 엔드포인트 | v-platform에 존재 | 단일 앱 기준 설계 |
| Grafana 대시보드 | `monitoring/grafana/` | v-channel-bridge 전용 하드코딩 |

### 1.2 로그

| 항목 | 현재 | 문제 |
|------|------|------|
| structlog | 앱 main.py에서 설정 | 앱마다 동일한 설정 반복 필요 |
| LogViewer (인메모리) | v-channel-bridge 전용 | 다른 앱에서 재사용 불가 |
| Promtail/Loki | `monitoring/promtail/` | 컨테이너명 하드코딩 |

### 1.3 헬스체크

| 항목 | 현재 | 문제 |
|------|------|------|
| `/api/health` | v-platform에 존재 | `get_bridge()` 앱 참조가 남아있음 |
| 서비스별 체크 | DB + Redis만 | 앱별 커스텀 헬스체크 확장 불가 |

---

## 2. 목표 아키텍처

```
┌──────────────────────────────────────────────────────┐
│                  Monitoring Layer                      │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ Prometheus   │ │    Loki      │ │   Grafana     │  │
│  │ (메트릭 수집) │ │ (로그 수집)   │ │ (시각화)      │  │
│  └──────┬──────┘ └──────┬───────┘ └───────┬───────┘  │
│         │               │                 │           │
├─────────┼───────────────┼─────────────────┼───────────┤
│         │    v-platform (자동 제공)         │           │
│  ┌──────┴───────────────┴─────────────────┴────────┐  │
│  │  MetricsMiddleware    StructlogConfig   Health   │  │
│  │  ┌──────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │ 공통 메트릭 │  │ 중앙 로그설정 │  │ 플러그형     │  │
│  │  │ + 앱 확장  │  │ + 앱 라벨   │  │ 헬스체크     │  │
│  │  └──────────┘  └────────────┘  └────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│         ↑                ↑                ↑           │
├─────────┼────────────────┼────────────────┼───────────┤
│    앱 레이어 (자동 계측)                                │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐    │
│  │v-channel    │ │v-ticket     │ │v-other      │    │
│  │-bridge      │ │-system      │ │-app         │    │
│  │ +커스텀메트릭│ │ +커스텀메트릭│ │ +커스텀메트릭│    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 3. 설계 상세

### 3.1 메트릭 중앙화

#### 3.1.1 Platform 자동 메트릭 (PlatformApp이 기본 제공)

```python
# v_platform/middleware/metrics.py — 이미 존재, 개선

# 자동 수집 메트릭:
# - http_requests_total{app, method, endpoint, status}
# - http_request_duration_seconds{app, method, endpoint}
# - http_requests_in_progress{app}
# - db_query_duration_seconds{app, operation}
# - redis_operation_duration_seconds{app, operation}
# - auth_login_total{app, method, result}  ← 신규
# - auth_token_refresh_total{app, result}  ← 신규
# - active_sessions{app}                   ← 신규
```

#### 3.1.2 앱 커스텀 메트릭 등록 패턴

```python
# 앱 측 사용법
from v_platform.monitoring import register_app_metrics
from prometheus_client import Counter, Histogram

# 앱 전용 메트릭 등록
MESSAGE_SENT = Counter(
    "bridge_messages_sent_total",
    "Messages sent through bridge",
    ["source_platform", "target_platform"],
)
MESSAGE_LATENCY = Histogram(
    "bridge_message_latency_seconds",
    "Message delivery latency",
)

register_app_metrics(MESSAGE_SENT, MESSAGE_LATENCY)
```

#### 3.1.3 멀티앱 Prometheus 설정

```yaml
# monitoring/prometheus/prometheus.yml
scrape_configs:
  # v-platform 공통 메트릭 (모든 앱 자동 수집)
  - job_name: 'v-platform-apps'
    static_configs:
      - targets:
          - 'v-project-backend:8000'           # v-channel-bridge
          - 'v-project-template-backend:8000'   # v-platform-template
          # 새 앱 추가 시 여기에 target 추가
    metrics_path: /metrics
    scrape_interval: 15s
```

### 3.2 로그 중앙화

#### 3.2.1 Platform 로그 설정 자동화

```python
# v_platform/core/logging.py — 신규

import structlog
import logging

def configure_platform_logging(
    app_name: str,
    log_level: str = "INFO",
    json_format: bool = True,
):
    """플랫폼 표준 로그 설정
    
    모든 앱에서 동일한 로그 포맷 보장:
    - app_name 라벨 자동 추가
    - JSON 포맷 (Loki 파싱 용이)
    - 타임스탬프, 로그 레벨, 모듈명 표준화
    """
    
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        # 앱 이름 자동 주입
        _add_app_name(app_name),
    ]
    
    if json_format:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())
    
    structlog.configure(processors=processors)
    logging.basicConfig(level=getattr(logging, log_level.upper()))


def _add_app_name(app_name: str):
    def processor(logger, method_name, event_dict):
        event_dict["app"] = app_name
        return event_dict
    return processor
```

#### 3.2.2 앱 사용법

```python
# apps/v-channel-bridge/backend/app/main.py
from v_platform.core.logging import configure_platform_logging

configure_platform_logging(app_name="v-channel-bridge")
```

#### 3.2.3 멀티앱 Promtail 설정

```yaml
# monitoring/promtail/promtail-config.yml
scrape_configs:
  - job_name: v-platform-apps
    static_configs:
      - targets: [localhost]
        labels:
          __path__: /var/log/containers/v-project-*.log
    pipeline_stages:
      - json:
          expressions:
            app: app
            level: level
            event: event
      - labels:
          app:
          level:
```

### 3.3 헬스체크 플러그형 설계

#### 3.3.1 Platform 기본 헬스체크 (자동)

```python
# v_platform/api/health.py — 개선

class HealthRegistry:
    """앱이 커스텀 헬스체크를 등록할 수 있는 레지스트리"""
    
    _checks: dict[str, Callable] = {}
    
    @classmethod
    def register(cls, name: str, check_fn: Callable[[], Awaitable[ServiceHealth]]):
        cls._checks[name] = check_fn
    
    @classmethod
    async def run_all(cls) -> dict[str, ServiceHealth]:
        results = {}
        # 플랫폼 기본 체크
        results["database"] = await _check_database()
        results["redis"] = await _check_redis()
        # 앱 커스텀 체크
        for name, fn in cls._checks.items():
            results[name] = await fn()
        return results
```

#### 3.3.2 앱 커스텀 헬스체크 등록

```python
# apps/v-channel-bridge/backend/app/main.py
from v_platform.api.health import HealthRegistry

async def check_bridge_health():
    bridge = get_bridge()
    return ServiceHealth(
        status="healthy" if bridge and bridge.is_running else "unhealthy",
        response_time_ms=0,
    )

async def check_slack_provider():
    bridge = get_bridge()
    slack = bridge.providers.get("slack") if bridge else None
    return ServiceHealth(
        status="healthy" if slack and slack.connected else "unhealthy",
    )

HealthRegistry.register("bridge", check_bridge_health)
HealthRegistry.register("slack_provider", check_slack_provider)
```

#### 3.3.3 헬스 응답 예시 (멀티앱)

```json
// v-channel-bridge (:8000/api/health)
{
  "status": "healthy",
  "app": "v-channel-bridge",
  "services": {
    "database": {"status": "healthy", "response_time_ms": 4.1},
    "redis": {"status": "healthy", "response_time_ms": 15.0},
    "bridge": {"status": "healthy"},
    "slack_provider": {"status": "healthy"},
    "teams_provider": {"status": "healthy"}
  }
}

// v-platform-template (:8002/api/health)
{
  "status": "healthy",
  "app": "v-platform-template",
  "services": {
    "database": {"status": "healthy", "response_time_ms": 3.8},
    "redis": {"status": "healthy", "response_time_ms": 12.0}
  }
}
```

---

## 4. Frontend Monitoring 컴포넌트

### 4.1 Platform 제공 (공통)

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| `StatusDetailPopup` | @v-platform/core | 서비스별 상태 팝업 (이미 이동 완료) |
| `ConnectionStatus` | @v-platform/core | WebSocket 연결 상태 배지 |
| `HealthDashboardWidget` | @v-platform/core (신규) | 기본 시스템 상태 카드 |
| `MetricsChart` | @v-platform/core (신규) | Prometheus 메트릭 차트 (범용) |

### 4.2 앱 제공 (전용)

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| `ProvidersStatusCard` | v-channel-bridge | Slack/Teams Provider 상태 |
| `MessageFlowWidget` | v-channel-bridge | 메시지 흐름 시각화 |
| `RealtimeMetricsChart` | v-channel-bridge | 브리지 메트릭 차트 |

---

## 5. Grafana 대시보드 중앙화

### 5.1 Platform 공통 대시보드

```
monitoring/grafana/dashboards/
├── platform-overview.json      ← 신규: 전체 앱 통합 뷰
├── platform-auth.json          ← 신규: 인증/세션 메트릭
├── platform-performance.json   ← 신규: API 성능 (모든 앱)
└── app-specific/
    ├── v-channel-bridge.json   ← 기존 브리지 전용
    └── v-ticket-system.json    ← 향후 앱별 추가
```

### 5.2 Platform Overview 대시보드 패널

| 패널 | 메트릭 | 설명 |
|------|--------|------|
| 앱별 요청량 | `http_requests_total{app}` | 앱별 API 호출 추이 |
| 응답 시간 분포 | `http_request_duration_seconds{app}` | P50/P95/P99 |
| 에러율 | `http_requests_total{status=~"5.."}` | 앱별 5xx 비율 |
| 활성 세션 | `active_sessions{app}` | 앱별 로그인 사용자 |
| DB 쿼리 성능 | `db_query_duration_seconds{app}` | 앱별 DB 부하 |
| 서비스 상태 | `/api/health` 결과 | 앱별 헬스 상태 |

---

## 6. 구현 로드맵

### Phase M1: 메트릭 라벨링 (1주)

- [ ] MetricsMiddleware에 `app` 라벨 추가
- [ ] PlatformApp 생성 시 app_name 자동 주입
- [ ] 인증 메트릭 추가 (login, refresh, session)
- [ ] Prometheus 설정에 멀티앱 target 지원

### Phase M2: 로그 중앙화 (1주)

- [ ] `v_platform/core/logging.py` 구현
- [ ] PlatformApp에서 자동 호출
- [ ] JSON 포맷 + app 라벨 표준화
- [ ] Promtail 설정 멀티앱 지원

### Phase M3: 헬스체크 플러그형 (1주)

- [ ] HealthRegistry 구현
- [ ] `/api/health`에서 앱 커스텀 체크 자동 포함
- [ ] `get_bridge()` 직접 참조 제거
- [ ] v-channel-bridge에서 HealthRegistry 사용하도록 전환

### Phase M4: Grafana 대시보드 (1주)

- [ ] platform-overview.json 생성
- [ ] platform-auth.json 생성
- [ ] 기존 앱 대시보드를 app-specific/ 하위로 이동
- [ ] Frontend HealthDashboardWidget 구현

---

## 7. 앱 개발자 관점 (최종 목표)

### Before (현재)

```python
# 앱마다 반복 설정
import logging
import structlog
logging.basicConfig(...)
structlog.configure(...)

# 앱마다 /metrics, /health 직접 구현
# 앱마다 Grafana 대시보드 수동 생성
```

### After (목표)

```python
# 앱 main.py — 이것만 하면 끝
platform = PlatformApp(app_name="my-new-app")

# 자동으로:
# ✅ 메트릭 수집 (/metrics + app 라벨)
# ✅ 로그 포맷 (JSON + app 라벨)
# ✅ 헬스체크 (/api/health — DB, Redis 자동)
# ✅ Grafana 대시보드 (platform-overview에 자동 표시)

# 앱 전용 메트릭만 추가
HealthRegistry.register("my_service", check_my_service)
register_app_metrics(MY_CUSTOM_COUNTER)
```

**앱 개발자는 모니터링 인프라를 신경 쓸 필요 없이 비즈니스 로직에만 집중.**

---

## 8. 요약

| 영역 | 현재 | 목표 |
|------|------|------|
| **메트릭** | 단일 앱, 앱별 설정 | 자동 수집 + app 라벨 + 앱 확장 |
| **로그** | 앱마다 반복 설정 | PlatformApp이 자동 설정 + JSON 표준화 |
| **헬스체크** | 앱 코드 직접 참조 | HealthRegistry 플러그형 |
| **Grafana** | 앱별 하드코딩 | 플랫폼 공통 + 앱별 분리 |
| **앱 부담** | 모니터링 전체 구현 | 커스텀 메트릭/헬스만 등록 |
