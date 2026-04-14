# 모니터링 중앙화 설계

> Prometheus 메트릭, HealthRegistry, structlog JSON 로깅, MetricsMiddleware -- 앱은 비즈니스 로직에만 집중

---

## 1. 개요

v-platform은 모니터링의 3요소(메트릭, 로그, 헬스 체크)를 플랫폼 레벨에서 중앙 제공한다. 앱은 `PlatformApp`을 사용하는 것만으로 HTTP 메트릭 수집, JSON 구조화 로깅, 인프라 헬스 체크가 자동으로 활성화된다.

### 핵심 구성

| 요소 | 플랫폼 제공 | 앱 확장 |
|------|-----------|---------|
| 메트릭 | MetricsMiddleware + Prometheus Counter/Histogram/Gauge | 앱 커스텀 메트릭 추가 가능 |
| 로그 | structlog JSON + app_name 인젝션 | 동일 포맷 자동 적용 |
| 헬스 체크 | HealthRegistry (database, redis 기본) | 앱 커스텀 체크 등록 |

```
+-------------------+     +-----------+     +-----------+
| Prometheus        |<----| /metrics  |<----| Metrics   |
| (scraper)         |     | endpoint  |     | Middleware |
+-------------------+     +-----------+     +-----------+
                                                  |
+-------------------+     +-----------+     +-----------+
| Grafana           |<----| Prometheus|     | PlatformApp|
| (dashboard)       |     | (storage) |     |            |
+-------------------+     +-----------+     +-----------+
                                                  |
+-------------------+     +-----------+     +-----------+
| Loki              |<----| Promtail  |<----| structlog |
| (log storage)     |     | (shipper) |     | JSON logs |
+-------------------+     +-----------+     +-----------+
```

---

## 2. Prometheus 메트릭

### 2.1 메트릭 정의 (`v_platform/api/metrics.py`)

플랫폼이 정의하는 Prometheus 메트릭:

| 이름 | 타입 | 라벨 | 설명 |
|------|------|------|------|
| `http_requests_total` | Counter | method, endpoint, status | HTTP 요청 총 수 |
| `http_request_duration_seconds` | Histogram | method, endpoint | HTTP 요청 처리 시간 |
| `websocket_connections` | Gauge | - | 활성 WebSocket 연결 수 |
| `message_count_total` | Counter | channel, direction | 처리된 메시지 총 수 |
| `channel_status` | Gauge | slack_channel, teams_channel | 채널 상태 (1=활성, 0=비활성) |
| `user_login_total` | Counter | role | 사용자 로그인 총 수 |
| `user_active` | Gauge | - | 활성 사용자 수 |

### 2.2 메트릭 엔드포인트

```python
@router.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),       # prometheus_client 라이브러리
        media_type=CONTENT_TYPE_LATEST,
    )
```

각 앱은 자신의 `/metrics` 엔드포인트에서 동일한 메트릭 구조를 노출한다. Prometheus가 앱별로 스크래핑한다.

### 2.3 메트릭 미들웨어 (`v_platform/middleware/metrics.py`)

`MetricsMiddleware`는 모든 HTTP 요청을 가로채서 자동으로 메트릭을 기록한다.

```python
class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # /metrics 엔드포인트는 측정 제외
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        # 요청 카운터 증가
        http_requests_total.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()

        # 처리 시간 기록
        http_request_duration_seconds.labels(
            method=request.method,
            endpoint=request.url.path,
        ).observe(duration)

        return response
```

`PlatformApp.__init__()`에서 자동 등록되므로 앱은 별도 설정 없이 HTTP 메트릭을 수집한다.

---

## 3. HealthRegistry

### 3.1 설계

`HealthRegistry`는 플러거블 헬스 체크 패턴을 구현한다. 플랫폼이 기본 체크(database, redis)를 등록하고, 앱은 자체 서비스 체크를 추가 등록한다.

```python
class HealthRegistry:
    def __init__(self):
        self._checks: dict[str, Callable[[], ServiceHealth]] = {}

    def register(self, name: str, check_fn: Callable):
        """체크 함수 등록 (sync 또는 async 모두 지원)"""
        self._checks[name] = check_fn

    async def run_all(self) -> dict[str, ServiceHealth]:
        results = {}
        for name, fn in self._checks.items():
            try:
                result = fn()
                if inspect.isawaitable(result):
                    result = await result
                results[name] = result
            except Exception as exc:
                results[name] = ServiceHealth(
                    status="unhealthy",
                    error=str(exc)[:120],
                )
        return results
```

### 3.2 모듈 수준 싱글턴

```python
# v_platform/api/health.py
health_registry = HealthRegistry()

# 플랫폼 기본 체크 자동 등록
health_registry.register("database", _check_db)
health_registry.register("redis", _check_redis)
```

### 3.3 플랫폼 기본 체크

#### Database 체크

```python
async def _check_db() -> ServiceHealth:
    t = time.monotonic()
    try:
        db = next(get_db_session())
        db.execute(text("SELECT 1"))
        return ServiceHealth(
            status="healthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
        )
    except Exception as e:
        return ServiceHealth(
            status="unhealthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
            error=str(e)[:120],
        )
```

#### Redis 체크

```python
async def _check_redis() -> ServiceHealth:
    t = time.monotonic()
    try:
        client = await aioredis.from_url(redis_url, decode_responses=True)
        await client.ping()
        await client.aclose()
        return ServiceHealth(
            status="healthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
        )
    except Exception as e:
        return ServiceHealth(status="unhealthy", error=str(e)[:120])
```

### 3.4 앱 커스텀 체크 등록

앱은 자체 서비스 상태 체크를 추가할 수 있다:

```python
# apps/v-channel-bridge/backend/app/main.py
from v_platform.api.health import health_registry

def check_slack_connection() -> ServiceHealth:
    # Slack API 연결 확인
    ...

health_registry.register("slack_provider", check_slack_connection)
```

### 3.5 헬스 엔드포인트 응답

```
GET /api/health

{
    "status": "healthy",        // "healthy" | "degraded"
    "version": "1.0.0",
    "services": {
        "database": {
            "status": "healthy",
            "response_time_ms": 2.3,
            "error": null
        },
        "redis": {
            "status": "healthy",
            "response_time_ms": 1.1,
            "error": null
        },
        "slack_provider": {
            "status": "healthy",
            "response_time_ms": 45.2,
            "error": null
        }
    }
}
```

### 3.6 전체 상태 판정

모든 서비스가 "healthy"이면 전체 상태도 "healthy". 하나라도 "unhealthy"이면 전체는 "degraded".

```python
overall = (
    "healthy"
    if all(s.status == "healthy" for s in services.values())
    else "degraded"
)
```

---

## 4. 구조화 로깅

### 4.1 configure_platform_logging

`PlatformApp.__init__()`에서 자동 호출된다:

```python
def configure_platform_logging(app_name: str, log_level: str = "INFO"):
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            _add_app_name(app_name),
            structlog.processors.JSONRenderer()      # 기본: JSON
            if os.environ.get("LOG_FORMAT") != "console"
            else structlog.dev.ConsoleRenderer(),    # 개발: 콘솔
        ],
        ...
    )
```

### 4.2 app_name 인젝션

모든 로그 엔트리에 `app` 키가 자동 추가된다:

```python
def _add_app_name(app_name: str):
    def processor(logger, method_name, event_dict):
        event_dict["app"] = app_name
        return event_dict
    return processor
```

#### JSON 로그 출력 예시

```json
{
    "event": "Health check passed",
    "level": "info",
    "logger": "v_platform.api.health",
    "timestamp": "2026-04-13T10:30:00.000000Z",
    "app": "v-channel-bridge"
}
```

### 4.3 노이즈 억제

서드파티 라이브러리의 과다 로그를 WARNING 이상으로 제한한다:

```python
for noisy in ("slack_bolt", "slack_sdk", "aiohttp", "asyncio", "httpx"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
```

### 4.4 로그 레벨 제어

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `LOG_LEVEL` | `INFO` | 전역 로그 레벨 (DEBUG, INFO, WARNING, ERROR) |
| `LOG_FORMAT` | (미설정=JSON) | `console`로 설정하면 개발용 콘솔 출력 |

---

## 5. 로그 수집 파이프라인

### 5.1 Promtail 구성

Docker 컨테이너의 stdout JSON 로그를 Promtail이 수집하여 Loki로 전송한다.

```
Docker Container (stdout)
  |  JSON 로그
  v
Promtail
  |  app 라벨로 분류
  v
Loki (로그 스토리지)
  |
  v
Grafana (검색/대시보드)
```

### 5.2 앱별 필터링

로그의 `app` 키를 Loki 라벨로 변환하면, Grafana에서 앱별로 로그를 필터링할 수 있다:

```
{app="v-channel-bridge"} |= "error"
{app="v-platform-portal"} | json | level="warning"
```

---

## 6. Docker Compose 모니터링 스택

```yaml
# monitoring/ 디렉토리

prometheus:
  image: prom/prometheus
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"

promtail:
  image: grafana/promtail
  volumes:
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
    - ./monitoring/promtail.yml:/etc/promtail/config.yml
```

### 6.1 Prometheus 스크래핑 설정

```yaml
# monitoring/prometheus.yml
scrape_configs:
  - job_name: "v-channel-bridge"
    static_configs:
      - targets: ["v-channel-bridge-backend:8000"]

  - job_name: "v-platform-template"
    static_configs:
      - targets: ["v-platform-template-backend:8002"]

  - job_name: "v-platform-portal"
    static_configs:
      - targets: ["v-platform-portal-backend:8080"]
```

각 앱의 `/metrics` 엔드포인트를 개별 job으로 스크래핑한다.

---

## 7. PlatformApp 자동 등록 요약

`PlatformApp.__init__()`에서 다음이 자동으로 설정된다:

| 단계 | 코드 | 효과 |
|------|------|------|
| 1 | `configure_platform_logging(app_name)` | structlog JSON + app_name |
| 2 | `self.fastapi.add_middleware(MetricsMiddleware)` | HTTP 메트릭 자동 수집 |
| 3 | `self.fastapi.include_router(health.router)` | `/api/health` 엔드포인트 |
| 4 | `self.fastapi.include_router(metrics.router)` | `/metrics` 엔드포인트 |

앱은 추가 설정 없이 이 모든 모니터링 기능을 사용한다. 커스텀 확장만 필요할 때 `health_registry.register()`로 체크를 추가하거나, prometheus_client로 앱 전용 메트릭을 정의한다.

---

## 8. Grafana 대시보드 구성 (예시)

### 8.1 HTTP 요청 대시보드

| 패널 | 쿼리 | 시각화 |
|------|------|--------|
| 요청 속도 | `rate(http_requests_total[5m])` | 시계열 그래프 |
| 에러율 | `rate(http_requests_total{status=~"5.."}[5m])` | 게이지 |
| 지연 시간 p99 | `histogram_quantile(0.99, http_request_duration_seconds_bucket)` | 히트맵 |
| 활성 WS 연결 | `websocket_connections` | 숫자 패널 |

### 8.2 앱 헬스 대시보드

| 패널 | 소스 | 시각화 |
|------|------|--------|
| 서비스 상태 | `/api/health` (각 앱) | 상태 표 |
| 응답 시간 추이 | Prometheus | 시계열 |

### 8.3 로그 대시보드

| 패널 | Loki 쿼리 | 시각화 |
|------|-----------|--------|
| 앱별 에러 로그 | `{app="v-channel-bridge"} \|= "error"` | 로그 스트림 |
| 전체 에러 카운트 | `count_over_time({level="error"}[1h])` | 바 그래프 |

---

## 9. ServiceHealth 모델

```python
class ServiceHealth(BaseModel):
    status: str                     # "healthy" | "unhealthy" | "unknown"
    response_time_ms: float | None = None
    error: str | None = None        # 에러 시 메시지 (최대 120자)

class HealthResponse(BaseModel):
    status: str                     # "healthy" | "degraded"
    bridge_running: bool = False    # 하위 호환용
    version: str
    services: dict[str, ServiceHealth]
```

---

## 10. 앱 커스텀 모니터링 확장

### 10.1 커스텀 헬스 체크

```python
from v_platform.api.health import health_registry, ServiceHealth

async def check_teams_bot() -> ServiceHealth:
    try:
        # Teams Bot Framework 연결 확인
        ...
        return ServiceHealth(status="healthy", response_time_ms=elapsed)
    except Exception as e:
        return ServiceHealth(status="unhealthy", error=str(e)[:120])

health_registry.register("teams_bot", check_teams_bot)
```

### 10.2 커스텀 Prometheus 메트릭

```python
from prometheus_client import Counter

bridge_messages = Counter(
    "bridge_messages_total",
    "Total messages bridged",
    ["source_platform", "target_platform"],
)

# 메시지 브리지 시 카운트
bridge_messages.labels(
    source_platform="slack",
    target_platform="teams",
).inc()
```

앱이 정의한 메트릭은 동일한 `/metrics` 엔드포인트에 자동으로 포함된다 (prometheus_client가 프로세스 수준에서 레지스트리를 공유하므로).

---

## 11. 관련 문서

- [플랫폼/앱 분리 아키텍처](./PLATFORM_APP_SEPARATION_ARCHITECTURE.md) -- PlatformApp 미들웨어 설정
- [모듈 경계 맵](./MODULE_BOUNDARY_MAP.md) -- 모니터링 모듈 소유권
- [v-platform-portal 설계](./V_PLATFORM_PORTAL_DESIGN.md) -- 포털 헬스 폴링
