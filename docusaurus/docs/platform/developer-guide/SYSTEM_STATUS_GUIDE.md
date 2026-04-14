---
id: system-status-guide
title: 시스템 상태 및 모니터링 가이드
sidebar_position: 8
tags: [guide, developer]
---

# 시스템 상태 및 모니터링 가이드

v-platform은 HealthRegistry, Prometheus 메트릭, 구조화 로깅을 통해 시스템 상태를 모니터링합니다. 이 가이드에서는 헬스 체크 등록, 메트릭 수집, 로깅 설정, 디버깅 방법을 설명합니다.

---

## 1. 헬스 체크 시스템

### 1.1 HealthRegistry 개요

`HealthRegistry`는 헬스 체크 함수를 등록하고 일괄 실행하는 레지스트리입니다. 플랫폼이 DB/Redis 체크를 기본 등록하고, 앱은 커스텀 체크를 추가할 수 있습니다.

```python
# platform/backend/v_platform/api/health.py

class HealthRegistry:
    """Registry for health-check functions."""

    def __init__(self):
        self._checks: dict[str, Callable[[], ServiceHealth]] = {}

    def register(self, name: str, check_fn: Callable):
        """Register a named health check.

        Args:
            name: Unique service name shown in the health response.
            check_fn: Sync or async callable returning ServiceHealth.
        """
        self._checks[name] = check_fn

    async def run_all(self) -> dict[str, ServiceHealth]:
        """Execute every registered check and return the results dict."""
        results: dict[str, ServiceHealth] = {}
        for name, fn in self._checks.items():
            try:
                result = fn()
                if inspect.isawaitable(result):
                    result = await result
                results[name] = result
            except Exception as exc:
                logger.warning("Health check %s failed: %s", name, exc)
                results[name] = ServiceHealth(
                    status="unhealthy", error=str(exc)[:120]
                )
        return results

# Module-level singleton
health_registry = HealthRegistry()
```

### 1.2 ServiceHealth 모델

```python
class ServiceHealth(BaseModel):
    """개별 서비스 상태"""
    status: str                          # "healthy" | "unhealthy" | "unknown"
    response_time_ms: float | None = None  # 응답 시간 (밀리초)
    error: str | None = None               # 오류 메시지 (unhealthy인 경우)
```

### 1.3 플랫폼 기본 체크

플랫폼이 자동으로 등록하는 2가지 헬스 체크입니다.

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

health_registry.register("database", _check_db)
```

#### Redis 체크

```python
async def _check_redis() -> ServiceHealth:
    t = time.monotonic()
    try:
        redis_url = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")
        client = await aioredis.from_url(redis_url, decode_responses=True)
        await client.ping()
        await client.aclose()
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

health_registry.register("redis", _check_redis)
```

### 1.4 앱에서 커스텀 체크 등록

앱은 `health_registry.register()`로 커스텀 서비스 체크를 추가합니다.

```python
# apps/v-channel-bridge/backend/app/main.py

from v_platform.api.health import health_registry, ServiceHealth

async def _check_slack_connection() -> ServiceHealth:
    """Slack 봇 연결 상태 확인"""
    t = time.monotonic()
    try:
        # Slack API 호출
        response = await slack_client.auth_test()
        if response["ok"]:
            return ServiceHealth(
                status="healthy",
                response_time_ms=round((time.monotonic() - t) * 1000, 1),
            )
        return ServiceHealth(
            status="unhealthy",
            error=response.get("error", "Unknown error"),
        )
    except Exception as e:
        return ServiceHealth(
            status="unhealthy",
            response_time_ms=round((time.monotonic() - t) * 1000, 1),
            error=str(e)[:120],
        )

# 앱 시작 시 등록
health_registry.register("slack", _check_slack_connection)
health_registry.register("teams", _check_teams_connection)
```

:::tip sync/async 모두 지원
`register()`에 전달하는 `check_fn`은 동기(sync) 함수여도, 비동기(async) 함수여도 됩니다. `run_all()`이 `inspect.isawaitable()`로 자동 판별합니다.
:::

### 1.5 /health 엔드포인트

```python
@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """시스템 헬스 체크 — 등록된 모든 서비스 상태 포함"""
    services = await health_registry.run_all()

    overall = (
        "healthy"
        if all(s.status == "healthy" for s in services.values())
        else "degraded"
    )

    return HealthResponse(
        status=overall,
        version="1.0.0",
        services=services,
    )
```

응답 예시:

```json
GET /health

{
  "status": "healthy",
  "bridge_running": false,
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
    "slack": {
      "status": "healthy",
      "response_time_ms": 145.2,
      "error": null
    },
    "teams": {
      "status": "unhealthy",
      "response_time_ms": 5002.0,
      "error": "Connection timeout"
    }
  }
}
```

상태 판정 규칙:
- **healthy**: 모든 서비스가 `healthy`
- **degraded**: 하나 이상의 서비스가 `unhealthy`

---

## 2. Prometheus 메트릭

### 2.1 MetricsMiddleware

모든 HTTP 요청의 메트릭을 자동 수집하는 미들웨어입니다.

```python
# platform/backend/v_platform/middleware/metrics.py

class MetricsMiddleware(BaseHTTPMiddleware):
    """HTTP 요청 메트릭을 수집하는 미들웨어"""

    async def dispatch(self, request: Request, call_next):
        # /metrics 엔드포인트는 측정 제외
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        # 요청 수 카운터
        http_requests_total.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()

        # 응답 시간 히스토그램
        http_request_duration_seconds.labels(
            method=request.method,
            endpoint=request.url.path,
        ).observe(duration)

        return response
```

`PlatformApp._setup_middleware()`에서 자동 등록됩니다.

### 2.2 메트릭 정의

```python
# platform/backend/v_platform/api/metrics.py

# HTTP 요청 메트릭
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
)

# WebSocket 연결 메트릭
websocket_connections = Gauge(
    "websocket_connections",
    "Active WebSocket connections",
)

# 메시지 카운트 메트릭
message_count_total = Counter(
    "message_count_total",
    "Total messages processed",
    ["channel", "direction"],
)

# 채널 상태 메트릭
channel_status = Gauge(
    "channel_status",
    "Channel active status (1=active, 0=inactive)",
    ["slack_channel", "teams_channel"],
)

# 사용자 활동 메트릭
user_login_total = Counter(
    "user_login_total",
    "Total user logins",
    ["role"],
)

user_active = Gauge(
    "user_active",
    "Active users count",
)
```

### 2.3 /metrics 엔드포인트

```python
@router.get("/metrics")
async def metrics():
    """Prometheus 메트릭 엔드포인트"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
```

Prometheus가 이 엔드포인트를 스크래핑하여 메트릭을 수집합니다.

### 2.4 Prometheus 설정

```yaml
# monitoring/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'v-channel-bridge-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['v-channel-bridge-backend:8000']
```

### 2.5 앱에서 커스텀 메트릭 사용

```python
from v_platform.api.metrics import message_count_total, channel_status

# 메시지 처리 시 카운터 증가
message_count_total.labels(
    channel="slack:C123",
    direction="incoming",
).inc()

# 채널 상태 업데이트
channel_status.labels(
    slack_channel="C123",
    teams_channel="team1:channel1",
).set(1)  # 1=active, 0=inactive
```

---

## 3. 구조화 로깅 (Structlog)

### 3.1 configure_platform_logging()

```python
# platform/backend/v_platform/core/logging.py

def configure_platform_logging(
    app_name: str,
    log_level: str = "INFO",
):
    """Configure standardized platform logging.

    Args:
        app_name: Application identifier (e.g., "v-channel-bridge")
        log_level: Logging level (default: INFO, override with LOG_LEVEL env var)
    """
    level = os.environ.get("LOG_LEVEL", log_level).upper()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            _add_app_name(app_name),
            structlog.processors.JSONRenderer()
            if os.environ.get("LOG_FORMAT") != "console"
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
```

### 3.2 환경 변수

| 환경 변수 | 기본값 | 설명 |
|-----------|--------|------|
| `LOG_LEVEL` | `INFO` | 로그 레벨 (DEBUG, INFO, WARNING, ERROR) |
| `LOG_FORMAT` | (JSON) | `console`로 설정하면 컬러 콘솔 출력 |

### 3.3 JSON 로그 형식

기본 출력 (Docker 환경):

```json
{
  "event": "sso_provider_registered",
  "provider": "microsoft",
  "level": "info",
  "logger": "v_platform.sso.registry",
  "timestamp": "2026-04-13T08:30:15.123456Z",
  "app": "v-channel-bridge"
}
```

### 3.4 콘솔 로그 형식

`LOG_FORMAT=console` 설정 시:

```
2026-04-13 08:30:15 [info     ] sso_provider_registered    app=v-channel-bridge provider=microsoft
```

### 3.5 로거 사용법

```python
import structlog

logger = structlog.get_logger()

# 기본 로깅
logger.info("user_logged_in", user_id=123, method="sso")
logger.warning("rate_limit_exceeded", ip="192.168.1.1", endpoint="/api/auth/login")
logger.error("database_connection_failed", error="Connection refused", retry_count=3)

# 컨텍스트 바인딩
log = logger.bind(request_id="abc-123", user_id=42)
log.info("processing_request")    # request_id와 user_id가 자동 포함
log.info("request_completed", duration_ms=150)
```

### 3.6 노이즈 제거

서드파티 라이브러리의 불필요한 로그를 자동으로 억제합니다.

```python
# configure_platform_logging() 내부
for noisy in ("slack_bolt", "slack_sdk", "aiohttp", "asyncio", "httpx"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
```

---

## 4. 프론트엔드 상태 표시

### 4.1 TopBar 상태 표시기

TopBar에 시스템 상태 아이콘이 표시됩니다. `/health` 엔드포인트를 주기적으로 폴링하여 상태를 업데이트합니다.

- 초록색 점: 모든 서비스 정상 (`healthy`)
- 노란색 점: 일부 서비스 비정상 (`degraded`)
- 빨간색 점: 연결 불가

### 4.2 StatusDetailPopup

상태 아이콘을 클릭하면 상세 팝업이 표시됩니다. 각 서비스의 이름, 상태, 응답 시간을 표시합니다.

### 4.3 useRealtimeStatus 훅

WebSocket을 통해 실시간 상태 변경을 수신합니다.

```tsx
import { useRealtimeStatus } from "@v-platform/core";

const { services, overallStatus, isConnected } = useRealtimeStatus();
// services: Record<string, { status, response_time_ms, error }>
// overallStatus: "healthy" | "degraded" | "unknown"
// isConnected: WebSocket 연결 상태
```

---

## 5. WebSocket 기반 실시간 모니터링

### 5.1 status 채널

WebSocket의 `status` 채널은 서비스 상태 변경을 실시간으로 브로드캐스트합니다.

```json
{
  "channel": "status",
  "type": "health_update",
  "data": {
    "services": {
      "database": {"status": "healthy", "response_time_ms": 2.1},
      "redis": {"status": "healthy", "response_time_ms": 0.8},
      "slack": {"status": "unhealthy", "error": "Rate limited"}
    },
    "overall": "degraded"
  }
}
```

### 5.2 logs 채널

실시간 로그 스트리밍 채널입니다.

```json
{
  "channel": "logs",
  "type": "log_entry",
  "data": {
    "level": "error",
    "message": "Slack API call failed",
    "app": "v-channel-bridge",
    "timestamp": "2026-04-13T08:30:15Z"
  }
}
```

### 5.3 WebSocket 구독 관리

프론트엔드에서 필요한 채널만 구독할 수 있습니다.

```tsx
// WebSocket 연결 후 특정 채널 구독
ws.send(JSON.stringify({
  type: "subscribe",
  channel: "status"
}));

// 구독 해제
ws.send(JSON.stringify({
  type: "unsubscribe",
  channel: "logs"
}));
```

---

## 6. 디버깅 가이드

### 6.1 Docker 로그 확인

```bash
# 전체 로그
docker logs v-channel-bridge-backend

# 실시간 로그 스트리밍
docker logs -f v-channel-bridge-backend

# 특정 키워드 필터링
docker logs v-channel-bridge-backend 2>&1 | grep -i error
docker logs v-channel-bridge-backend 2>&1 | grep -i migration
docker logs v-channel-bridge-backend 2>&1 | grep -i sso
```

### 6.2 헬스 체크 직접 호출

```bash
# 전체 헬스 체크
curl http://127.0.0.1:8000/health | python -m json.tool

# jq가 있는 경우
curl -s http://127.0.0.1:8000/health | jq '.services'
```

### 6.3 메트릭 확인

```bash
# Prometheus 메트릭 조회
curl http://127.0.0.1:8000/metrics

# 특정 메트릭 필터
curl -s http://127.0.0.1:8000/metrics | grep http_requests_total
curl -s http://127.0.0.1:8000/metrics | grep websocket_connections
```

### 6.4 데이터베이스 연결 확인

```bash
# PostgreSQL 직접 연결
docker exec -it postgres psql -U vmsuser -d v_project

# 테이블 목록
\dt

# 특정 테이블 조회
SELECT * FROM system_settings;
SELECT * FROM menu_items WHERE app_id = 'v-channel-bridge';
```

### 6.5 Redis 연결 확인

```bash
# Redis CLI
docker exec -it redis redis-cli -a redispassword

# 키 목록
KEYS *

# 특정 키 조회
SMEMBERS route:slack:C123
```

### 6.6 debugpy 원격 디버깅

Docker Compose에서 `debug` 프로필을 사용하면 debugpy가 활성화됩니다.

```bash
docker compose --profile debug up -d v-channel-bridge-backend
```

VS Code에서 `launch.json` 설정:

```json
{
  "name": "Docker: Attach",
  "type": "debugpy",
  "request": "attach",
  "connect": {
    "host": "127.0.0.1",
    "port": 5678
  },
  "pathMappings": [
    {
      "localRoot": "${workspaceFolder}/apps/v-channel-bridge/backend",
      "remoteRoot": "/app"
    },
    {
      "localRoot": "${workspaceFolder}/platform/backend",
      "remoteRoot": "/platform/backend"
    }
  ]
}
```

---

## 7. Grafana 대시보드

### 7.1 모니터링 스택

```
Backend → Prometheus → Grafana
                    ↗
Promtail → Loki ──┘
```

### 7.2 주요 패널

| 패널 | 메트릭 | 설명 |
|------|--------|------|
| Request Rate | `rate(http_requests_total[5m])` | 초당 요청 수 |
| Error Rate | `rate(http_requests_total{status=~"5.."}[5m])` | 초당 5xx 오류 수 |
| Response Time (p95) | `histogram_quantile(0.95, http_request_duration_seconds)` | 95% 응답 시간 |
| Active WebSockets | `websocket_connections` | 실시간 WS 연결 수 |
| Message Throughput | `rate(message_count_total[5m])` | 초당 메시지 처리 수 |
| Active Users | `user_active` | 활성 사용자 수 |

### 7.3 접속 정보

| 서비스 | URL | 기본 계정 |
|--------|-----|-----------|
| Grafana | `http://127.0.0.1:3001` | admin / admin |
| Prometheus | `http://127.0.0.1:9090` | - |

---

## 8. 알림 연동

### 8.1 헬스 체크 기반 알림

헬스 체크 결과가 `degraded`로 변경되면 알림 시스템을 통해 관리자에게 통보합니다.

```python
from v_platform.services.notification_service import NotificationService

# 서비스 비정상 시 알림 생성
await NotificationService.create_notification(
    severity="ERROR",
    category="SERVICE",
    title="서비스 비정상 감지",
    message=f"Redis 서비스가 응답하지 않습니다: {error_message}",
    source="health_monitor",
    persistent=True,
)
```

### 8.2 알림 심각도

| 심각도 | 용도 |
|--------|------|
| `CRITICAL` | 전체 시스템 장애 |
| `ERROR` | 개별 서비스 장애 |
| `WARNING` | 성능 저하, 임계값 초과 |
| `INFO` | 정보성 알림 |
| `SUCCESS` | 복구 완료 |

---

## 9. 체크리스트

### 9.1 앱 개발자 체크리스트

- [ ] 앱 고유 서비스에 헬스 체크 등록 (`health_registry.register()`)
- [ ] 커스텀 메트릭 정의 (필요 시)
- [ ] `configure_platform_logging(app_name)` 호출 확인
- [ ] 에러 로그에 충분한 컨텍스트 포함 (user_id, request_id 등)
- [ ] `/health` 엔드포인트 응답 확인

### 9.2 운영자 체크리스트

- [ ] Prometheus 스크래핑 설정 확인
- [ ] Grafana 대시보드 패널 구성
- [ ] 알림 규칙 설정 (서비스 다운 시)
- [ ] 로그 보존 정책 설정
- [ ] Docker 헬스 체크 설정 확인
