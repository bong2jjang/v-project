---
id: monitoring-setup
title: 모니터링 설정 가이드
sidebar_position: 3
tags: [guide, admin, monitoring, prometheus, grafana]
---

# 모니터링 설정 가이드

## 개요

v-project는 Prometheus, Grafana, Promtail, Loki를 사용하여 메트릭 수집, 시각화, 로그 관리를 수행합니다. 이 문서에서는 각 모니터링 컴포넌트의 설정 방법과 알림 규칙을 설명합니다.

### 모니터링 아키텍처

```
┌──────────────┐   scrape    ┌────────────┐   query    ┌──────────┐
│ Backend Apps │ ──────────→ │ Prometheus │ ←───────── │ Grafana  │
│ /api/metrics │   (15s)     │  :9090     │            │  :3001   │
└──────────────┘             └────────────┘            └──────────┘
                                                            ↑
┌──────────────┐   push      ┌────────────┐   query         │
│ Docker Logs  │ ──────────→ │   Loki     │ ────────────────┘
│ (JSON)       │  Promtail   │  :3100     │
└──────────────┘             └────────────┘
```

| 컴포넌트 | 역할 | 포트 |
|----------|------|------|
| Prometheus | 메트릭 수집 및 저장, 알림 규칙 평가 | 9090 |
| Grafana | 대시보드 시각화 | 3001 |
| Loki | 로그 저장소 | 3100 |
| Promtail | Docker 컨테이너 로그 수집 → Loki 전송 | 9080 |
| cAdvisor | 컨테이너 리소스 메트릭 수집 | 8080 |
| Node Exporter | 호스트 시스템 메트릭 수집 | 9100 |

---

## Prometheus 메트릭

### 애플리케이션 메트릭 엔드포인트

각 백엔드 앱은 `GET /api/metrics` 엔드포인트를 통해 Prometheus 형식의 메트릭을 노출합니다.

```bash
# v-channel-bridge 메트릭 확인
curl http://127.0.0.1:8000/api/metrics

# v-platform-template 메트릭 확인
curl http://127.0.0.1:8002/api/metrics
```

### 등록된 메트릭 목록

v-platform이 기본 제공하는 메트릭은 다음과 같습니다.

#### HTTP 메트릭

| 메트릭 | 타입 | 레이블 | 설명 |
|--------|------|--------|------|
| `http_requests_total` | Counter | `method`, `endpoint`, `status` | 전체 HTTP 요청 수 |
| `http_request_duration_seconds` | Histogram | `method`, `endpoint` | HTTP 요청 처리 시간 (초) |

#### WebSocket 메트릭

| 메트릭 | 타입 | 설명 |
|--------|------|------|
| `websocket_connections` | Gauge | 현재 활성 WebSocket 연결 수 |

#### 메시지 메트릭

| 메트릭 | 타입 | 레이블 | 설명 |
|--------|------|--------|------|
| `message_count_total` | Counter | `channel`, `direction` | 처리된 전체 메시지 수 |

#### 채널 메트릭

| 메트릭 | 타입 | 레이블 | 설명 |
|--------|------|--------|------|
| `channel_status` | Gauge | `slack_channel`, `teams_channel` | 채널 활성 상태 (1=활성, 0=비활성) |

#### 사용자 메트릭

| 메트릭 | 타입 | 레이블 | 설명 |
|--------|------|--------|------|
| `user_login_total` | Counter | `role` | 전체 로그인 횟수 (역할별) |
| `user_active` | Gauge | - | 현재 활성 사용자 수 |

### Prometheus 설정 (`prometheus.yml`)

설정 파일 위치: `monitoring/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    project: 'v-project'
    environment: 'development'

rule_files:
  - '/etc/prometheus/alerts.yml'

scrape_configs:
  # Prometheus 자체 모니터링
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # v-platform 앱 메트릭 (멀티앱 지원)
  - job_name: 'v-platform-apps'
    static_configs:
      - targets:
          - 'backend:8000'            # v-channel-bridge
          - 'template-backend:8000'   # v-platform-template
          # 새 앱 추가 시 여기에 target 추가
    metrics_path: '/api/metrics'
    scrape_interval: 15s

  # cAdvisor - 컨테이너 리소스 메트릭
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  # Node Exporter - 호스트 시스템 메트릭
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['node_exporter:9100']
```

:::tip 새 앱 추가 시
새로운 v-platform 앱을 추가할 때는 `v-platform-apps` job의 `targets` 목록에 해당 앱의 백엔드 서비스명과 포트를 추가하세요. Docker Compose 네트워크 내부에서는 서비스 이름으로 접근합니다.
:::

---

## 알림 규칙

설정 파일 위치: `monitoring/prometheus/alerts.yml`

Prometheus는 30초 간격으로 알림 규칙을 평가합니다.

### 서비스 알림 (`vms_service_alerts`)

| 알림 | 조건 | 지속 시간 | 심각도 |
|------|------|----------|--------|
| `VMSBackendDown` | `up{job="vms-backend"} == 0` | 1분 | critical |
| `VMSHighErrorRate` | 5xx 에러율 > 5% | 5분 | critical |
| `VMSSlowResponse` | P95 응답시간 > 2초 | 5분 | warning |
| `VMSBridgeHighMessageFailure` | 메시지 처리 에러 > 0.1/s | 2분 | warning |

#### VMSBackendDown

백엔드 서비스가 1분 이상 응답하지 않으면 발생합니다.

```yaml
- alert: VMSBackendDown
  expr: up{job="vms-backend"} == 0
  for: 1m
  labels:
    severity: critical
    service: backend
  annotations:
    summary: "VMS 백엔드 다운"
    description: "v-channel-bridge 백엔드가 다운되었습니다. (1분 이상 응답 없음)"
```

#### VMSHighErrorRate

5분간 5xx 에러 비율이 전체 요청의 5%를 초과하면 발생합니다.

```yaml
- alert: VMSHighErrorRate
  expr: >
    sum(rate(http_requests_total{job="vms-backend",status=~"5.."}[5m]))
    /
    sum(rate(http_requests_total{job="vms-backend"}[5m]))
    * 100 > 5
  for: 5m
  labels:
    severity: critical
```

#### VMSSlowResponse

P95 응답시간이 2초를 초과하면 발생합니다.

```yaml
- alert: VMSSlowResponse
  expr: >
    histogram_quantile(0.95,
      sum(rate(http_request_duration_seconds_bucket{job="vms-backend"}[5m])) by (le)
    ) > 2
  for: 5m
  labels:
    severity: warning
```

### 컨테이너 리소스 알림 (`container_resource_alerts`)

| 알림 | 조건 | 지속 시간 | 심각도 |
|------|------|----------|--------|
| `ContainerHighCPU` | CPU 사용률 > 80% | 5분 | warning |
| `ContainerHighMemory` | 메모리 > 512MB | 5분 | warning |
| `ContainerRestarting` | 1시간 내 3회 초과 재시작 | 즉시 | warning |

### 호스트 시스템 알림 (`host_alerts`)

| 알림 | 조건 | 지속 시간 | 심각도 |
|------|------|----------|--------|
| `HostDiskSpaceLow` | 루트 디스크 여유 < 10% | 5분 | critical |
| `HostHighCPU` | 호스트 CPU > 85% | 10분 | warning |

---

## 헬스 체크 엔드포인트

### GET /api/health

등록된 모든 서비스의 상태를 확인합니다.

```bash
curl -s http://127.0.0.1:8000/api/health | python -m json.tool
```

응답 구조:

```json
{
  "status": "healthy",
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
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `status` | 전체 상태: `"healthy"` (모두 정상) 또는 `"degraded"` (하나 이상 비정상) |
| `version` | 애플리케이션 버전 |
| `services` | 개별 서비스 상태 딕셔너리 |
| `services.*.status` | `"healthy"`, `"unhealthy"`, `"unknown"` |
| `services.*.response_time_ms` | 응답 시간 (밀리초) |
| `services.*.error` | 에러 메시지 (정상이면 `null`) |

플랫폼은 기본으로 `database`와 `redis` 체크를 등록합니다. 앱은 `HealthRegistry`를 통해 추가 체크를 등록할 수 있습니다.

### GET /api/metrics

Prometheus 형식의 메트릭 데이터를 반환합니다. `prometheus_client` 라이브러리의 `generate_latest()`를 사용합니다.

```bash
curl http://127.0.0.1:8000/api/metrics
```

응답 예시 (일부):

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/api/health",status="200"} 42.0
http_requests_total{method="POST",endpoint="/api/auth/login",status="200"} 15.0

# HELP user_active Active users count
# TYPE user_active gauge
user_active 3.0
```

---

## Grafana 대시보드

### 데이터소스 설정

Grafana에는 Prometheus와 Loki 데이터소스가 자동 프로비저닝됩니다.

설정 파일 위치: `monitoring/grafana/provisioning/datasources/datasources.yml`

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

### 프로비저닝된 대시보드

대시보드는 JSON 파일로 관리되며, Grafana 시작 시 자동 로드됩니다.

| 대시보드 | 파일 | 내용 |
|----------|------|------|
| Platform Overview | `monitoring/grafana/dashboards/platform-overview.json` | 플랫폼 전체 상태 |
| v-channel-bridge Overview | `monitoring/grafana/dashboards/app-specific/v-channel-bridge-overview.json` | 채널 브리지 앱 상태 |
| v-channel-bridge Logs | `monitoring/grafana/dashboards/app-specific/v-channel-bridge-logs.json` | 채널 브리지 로그 뷰 |

대시보드 프로비저닝 설정: `monitoring/grafana/provisioning/dashboards/dashboards.yml`

```yaml
providers:
  - name: 'VMS Channel Bridge'
    orgId: 1
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

:::note 대시보드 수정
`allowUiUpdates: true`로 설정되어 있으므로, Grafana UI에서 직접 대시보드를 수정할 수 있습니다. 다만, 컨테이너를 재시작하면 파일에 저장된 원본으로 되돌아갑니다. 변경사항을 영구 보존하려면 JSON 파일을 직접 수정하세요.
:::

### 유용한 Grafana 쿼리 예시

#### HTTP 요청률 (초당)

```promql
sum(rate(http_requests_total[5m])) by (endpoint)
```

#### 5xx 에러율

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
* 100
```

#### P95 응답시간

```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

#### 활성 WebSocket 연결

```promql
websocket_connections
```

#### 역할별 로그인 추이

```promql
sum(rate(user_login_total[1h])) by (role)
```

---

## Promtail + Loki 로그 관리

### Promtail 설정

설정 파일 위치: `monitoring/promtail/promtail-config.yml`

Promtail은 Docker 소켓을 통해 `v-project` 프로젝트의 모든 컨테이너 로그를 자동으로 수집합니다.

```yaml
scrape_configs:
  - job_name: v-project
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
        filters:
          - name: label
            values: ["com.docker.compose.project=v-project"]
```

#### 라벨 매핑

Promtail은 Docker 메타데이터와 structlog JSON 필드에서 라벨을 추출합니다.

| Loki 라벨 | 소스 | 설명 |
|-----------|------|------|
| `container` | Docker 컨테이너 이름 | 예: `v-channel-bridge-backend` |
| `service` | Docker Compose 서비스명 | 예: `backend` |
| `stream` | 로그 스트림 | `stdout` 또는 `stderr` |
| `level` | structlog JSON `level` 필드 | `info`, `warning`, `error` 등 |
| `app` | structlog JSON `app` 필드 | 앱 식별자 |

#### 헬스 체크 로그 필터링

`/api/health` 요청 로그는 자동으로 필터링(드롭)됩니다. 60초 간격으로 반복되는 헬스 체크 로그가 Loki 저장소를 불필요하게 차지하지 않도록 합니다.

```yaml
pipeline_stages:
  - drop:
      expression: '.*/api/health.*'
      drop_counter_reason: health_check_filtered
```

### Loki 설정

설정 파일 위치: `monitoring/loki/loki-config.yml`

| 설정 | 값 | 설명 |
|------|-----|------|
| 로그 보관 기간 | 720h (30일) | `limits_config.retention_period` |
| 오래된 샘플 거부 | 7일 초과 | `reject_old_samples_max_age: 168h` |
| 수집 속도 제한 | 4MB/s | `ingestion_rate_mb: 4` |
| 버스트 허용량 | 6MB | `ingestion_burst_size_mb: 6` |
| 스키마 | TSDB v13 | `schema_config.configs[0].schema: v13` |
| 스토리지 | 로컬 파일시스템 | `storage_config.filesystem` |
| 인증 | 비활성화 (개발용) | `auth_enabled: false` |

:::warning 프로덕션 주의
개발 환경에서는 `auth_enabled: false`로 설정되어 있습니다. 프로덕션에서는 인증을 활성화하거나, Loki를 외부 네트워크에 노출하지 않도록 하세요.
:::

### 유용한 Loki 쿼리 예시 (LogQL)

Grafana의 Explore 탭에서 Loki 데이터소스를 선택한 후 LogQL을 사용합니다.

#### 백엔드 에러 로그

```logql
{service="backend"} |= "error"
```

#### 특정 앱의 로그

```logql
{app="v-channel-bridge"} | json | level="error"
```

#### 로그인 관련 로그

```logql
{service="backend"} |= "login" | json
```

#### 최근 1시간 에러 카운트

```logql
count_over_time({service="backend"} |= "error" [1h])
```

---

## Docker Compose로 모니터링 스택 실행

모니터링 서비스는 별도의 Docker Compose 파일이나 기존 `docker-compose.yml`에 추가하여 실행합니다.

```yaml
# docker-compose.monitoring.yml (예시)
services:
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: v-project-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - v-project-network

  grafana:
    image: grafana/grafana:10.4.0
    container_name: v-project-grafana
    ports:
      - "3001:3000"
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - v-project-network

  loki:
    image: grafana/loki:2.9.0
    container_name: v-project-loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki:/etc/loki
      - loki_data:/loki
    command: -config.file=/etc/loki/loki-config.yml
    networks:
      - v-project-network

  promtail:
    image: grafana/promtail:2.9.0
    container_name: v-project-promtail
    volumes:
      - ./monitoring/promtail:/etc/promtail
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: -config.file=/etc/promtail/promtail-config.yml
    networks:
      - v-project-network
```

실행:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

---

## 모니터링 운영 팁

### 디스크 공간 관리

- **Prometheus**: `--storage.tsdb.retention.time=30d`로 30일간 메트릭 보관
- **Loki**: `retention_period: 720h`로 30일간 로그 보관
- 디스크 사용량을 주기적으로 확인하세요

```bash
# 모니터링 볼륨 사용량 확인
docker system df -v | grep -E "prometheus|loki|grafana"
```

### Alertmanager 연동 (선택)

Prometheus 알림 규칙은 정의되어 있지만, Alertmanager가 없으면 알림이 발송되지 않습니다. Slack이나 이메일 알림이 필요하면 Alertmanager를 추가하세요.

```yaml
# prometheus.yml에 추가
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### 커스텀 메트릭 추가

앱에서 커스텀 Prometheus 메트릭을 추가하려면 `prometheus_client` 라이브러리를 사용합니다.

```python
from prometheus_client import Counter

# 커스텀 카운터 정의
my_custom_counter = Counter(
    "my_app_events_total",
    "Total custom events",
    ["event_type"],
)

# 이벤트 발생 시 카운트 증가
my_custom_counter.labels(event_type="order_created").inc()
```

등록된 메트릭은 자동으로 `/api/metrics` 엔드포인트에 노출됩니다.

---

## 참고 문서

- [배포 가이드](./DEPLOYMENT.md) -- Docker Compose 실행 및 환경 변수 설정
- [Prometheus 공식 문서](https://prometheus.io/docs/)
- [Grafana 공식 문서](https://grafana.com/docs/)
- [Loki 공식 문서](https://grafana.com/docs/loki/)
- [LogQL 쿼리 가이드](https://grafana.com/docs/loki/latest/logql/)
