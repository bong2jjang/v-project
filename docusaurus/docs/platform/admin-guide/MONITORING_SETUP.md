---
id: monitoring-setup
title: 모니터링 설정 가이드
sidebar_position: 3
tags: [guide, admin]
---

# 모니터링 설정 가이드

## 개요

VMS Chat Ops 프로덕션 환경을 위한 종합 모니터링 시스템 구축 가이드입니다.

이 가이드는 다음 모니터링 스택을 다룹니다:
- **Prometheus**: 메트릭 수집 및 저장
- **Grafana**: 메트릭 시각화 및 대시보드
- **Loki**: 로그 수집 및 분석
- **Promtail**: 로그 수집 에이전트
- **cAdvisor**: 컨테이너 메트릭 수집
- **Node Exporter**: 호스트 메트릭 수집

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Grafana UI                            │
│                    (시각화 및 대시보드)                        │
└────────────────┬────────────────────────────┬────────────────┘
                 │                            │
                 │ 쿼리                       │ 쿼리
                 ↓                            ↓
        ┌────────────────┐          ┌────────────────┐
        │  Prometheus    │          │      Loki      │
        │  (메트릭 DB)    │          │    (로그 DB)    │
        └────────┬───────┘          └────────┬───────┘
                 ↑                            ↑
                 │ 스크레이핑                 │ 푸시
                 │                            │
    ┌────────────┴────────────┐      ┌───────┴────────┐
    ↓            ↓            ↓      ↓                ↓
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│Backend │  │Frontend│  │cAdvisor│  │Promtail│  │  Node  │
│        │  │        │  │        │  │        │  │Exporter│
└────────┘  └────────┘  └────────┘  └────────┘  └────────┘
```

## 1. Docker Compose 설정

### 1.1 모니터링 서비스 추가

`docker-compose.monitoring.yml` 생성:

```yaml
version: '3.8'

services:
  # Prometheus - 메트릭 수집 및 저장
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    restart: unless-stopped
    networks:
      - vms-chat-ops-network

  # Grafana - 시각화 및 대시보드
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
      - GF_SERVER_ROOT_URL=https://your-domain.com/grafana
      - GF_SERVER_SERVE_FROM_SUB_PATH=true
    ports:
      - "3000:3000"
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - vms-chat-ops-network

  # Loki - 로그 수집 및 저장
  loki:
    image: grafana/loki:latest
    container_name: loki
    command: -config.file=/etc/loki/loki-config.yml
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki/loki-config.yml:/etc/loki/loki-config.yml:ro
      - loki_data:/loki
    restart: unless-stopped
    networks:
      - vms-chat-ops-network

  # Promtail - 로그 수집 에이전트
  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    command: -config.file=/etc/promtail/promtail-config.yml
    volumes:
      - ./monitoring/promtail/promtail-config.yml:/etc/promtail/promtail-config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - loki
    restart: unless-stopped
    networks:
      - vms-chat-ops-network

  # cAdvisor - 컨테이너 메트릭 수집
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - "8081:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg
    restart: unless-stopped
    networks:
      - vms-chat-ops-network

  # Node Exporter - 호스트 메트릭 수집
  node_exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    restart: unless-stopped
    networks:
      - vms-chat-ops-network

volumes:
  prometheus_data:
  grafana_data:
  loki_data:

networks:
  vms-chat-ops-network:
    name: vms-chat-ops_vms-chat-ops-network
    external: true
```

## 2. Prometheus 설정

### 2.1 Prometheus 설정 파일

`monitoring/prometheus/prometheus.yml`:

```yaml
# Prometheus 글로벌 설정
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'vms-chat-ops'
    environment: 'production'

# 알림 규칙 파일
rule_files:
  - '/etc/prometheus/alerts.yml'

# Alertmanager 설정 (선택사항)
# alerting:
#   alertmanagers:
#     - static_configs:
#         - targets: ['alertmanager:9093']

# 메트릭 수집 대상
scrape_configs:
  # Prometheus 자체 모니터링
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Backend API 메트릭
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  # cAdvisor - 컨테이너 메트릭
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  # Node Exporter - 호스트 메트릭
  - job_name: 'node_exporter'
    static_configs:
      - targets: ['node_exporter:9100']
```

### 2.2 알림 규칙

`monitoring/prometheus/alerts.yml`:

```yaml
groups:
  # 컨테이너 상태 알림
  - name: container_alerts
    interval: 30s
    rules:
      - alert: ContainerDown
        expr: up{job=~"backend|frontend|backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "컨테이너 다운: {{ $labels.job }}"
          description: "{{ $labels.job }} 컨테이너가 1분 이상 응답하지 않습니다."

      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total{name=~"vms-.*"}[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "높은 CPU 사용률: {{ $labels.name }}"
          description: "{{ $labels.name }} 컨테이너의 CPU 사용률이 80%를 초과했습니다."

      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes{name=~"vms-.*"} / container_spec_memory_limit_bytes{name=~"vms-.*"}) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "높은 메모리 사용률: {{ $labels.name }}"
          description: "{{ $labels.name }} 컨테이너의 메모리 사용률이 90%를 초과했습니다."

  # 디스크 공간 알림
  - name: disk_alerts
    interval: 1m
    rules:
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "디스크 공간 부족"
          description: "루트 파일시스템의 여유 공간이 10% 미만입니다."

  # API 응답 시간 알림
  - name: api_alerts
    interval: 30s
    rules:
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "느린 API 응답"
          description: "API 응답 시간의 95 percentile이 1초를 초과했습니다."

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "높은 에러율"
          description: "API 에러율이 5%를 초과했습니다."
```

## 3. Loki 설정

### 3.1 Loki 설정 파일

`monitoring/loki/loki-config.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

compactor:
  working_directory: /loki/boltdb-shipper-compactor
  shared_store: filesystem

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  retention_period: 720h  # 30일

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h
```

### 3.2 Promtail 설정

`monitoring/promtail/promtail-config.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker 컨테이너 로그 수집
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
        filters:
          - name: label
            values: ["com.docker.compose.project=vms-chat-ops"]
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
    pipeline_stages:
      - docker: {}
      - json:
          expressions:
            level: level
            message: message
            timestamp: timestamp
      - labels:
          level:
          service:
      - timestamp:
          source: timestamp
          format: RFC3339Nano
```

## 4. Grafana 설정

### 4.1 데이터소스 프로비저닝

`monitoring/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  # Prometheus
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "15s"

  # Loki
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
    jsonData:
      maxLines: 1000
```

### 4.2 대시보드 프로비저닝

`monitoring/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'VMS Chat Ops'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### 4.3 VMS Chat Ops 대시보드

`monitoring/grafana/dashboards/vms-overview.json`:

```json
{
  "dashboard": {
    "title": "VMS Chat Ops Overview",
    "tags": ["vms", "backend"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Container Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=~\"backend|frontend|backend\"}"
          }
        ]
      },
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total{name=~\"vms-.*\"}[5m])"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "container_memory_usage_bytes{name=~\"vms-.*\"}"
          }
        ]
      },
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "API Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Recent Logs",
        "type": "logs",
        "targets": [
          {
            "expr": "{service=~\"backend|frontend|backend\"}"
          }
        ]
      }
    ]
  }
}
```

## 5. Backend 메트릭 구현

### 5.1 Prometheus 클라이언트 추가

`backend/requirements.txt`에 추가:

```
prometheus-client==0.19.0
```

### 5.2 메트릭 엔드포인트 구현

`backend/app/api/metrics.py`:

```python
from fastapi import APIRouter
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from fastapi.responses import Response

router = APIRouter()

# 메트릭 정의
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

websocket_connections = Gauge(
    'websocket_connections',
    'Active WebSocket connections'
)

message_count = Counter(
    'message_count_total',
    'Total messages processed',
    ['channel']
)

@router.get("/metrics")
async def metrics():
    """Prometheus 메트릭 엔드포인트"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

### 5.3 메트릭 미들웨어

`backend/app/middleware/metrics.py`:

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.api.metrics import (
    http_requests_total,
    http_request_duration_seconds
)

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        response = await call_next(request)

        duration = time.time() - start_time

        # 메트릭 기록
        http_requests_total.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        http_request_duration_seconds.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)

        return response
```

### 5.4 Main 애플리케이션에 등록

`backend/app/main.py`:

```python
from app.middleware.metrics import MetricsMiddleware
from app.api import metrics

# 미들웨어 추가
app.add_middleware(MetricsMiddleware)

# 메트릭 엔드포인트 등록
app.include_router(metrics.router)
```

## 6. 모니터링 스택 실행

### 6.1 디렉토리 생성

```bash
# 모니터링 설정 디렉토리 생성
mkdir -p monitoring/{prometheus,grafana/{provisioning/{datasources,dashboards},dashboards},loki,promtail}

# 권한 설정
sudo chown -R 472:472 monitoring/grafana
```

### 6.2 서비스 시작

VMS Chat Ops의 `docker-compose.yml`에는 모니터링 서비스(Prometheus, Grafana, Loki, Promtail)가 이미 포함되어 있습니다.

```bash
# 모든 서비스 시작 (모니터링 포함)
docker compose up -d --build

# 모니터링 서비스만 로그 확인
docker compose logs -f prometheus grafana loki promtail
```

별도 모니터링 스택을 운영하려면 위의 `docker-compose.monitoring.yml`을 사용할 수 있습니다.

### 6.3 접속 확인

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Loki**: http://localhost:3100
- **cAdvisor**: http://localhost:8081 (별도 설정 시)

## 7. Grafana 대시보드 설정

### 7.1 첫 로그인

1. http://localhost:3000 접속
2. 기본 계정: admin / admin
3. 비밀번호 변경 프롬프트 (권장)

### 7.2 데이터소스 확인

1. Configuration → Data Sources
2. Prometheus와 Loki가 자동 추가되었는지 확인
3. "Test" 버튼으로 연결 확인

### 7.3 대시보드 임포트

**Community 대시보드 사용**:

1. Dashboards → Import
2. 다음 대시보드 ID 입력:
   - **Docker Monitoring**: 893
   - **Node Exporter Full**: 1860
   - **Loki Dashboard**: 13639
   - **cAdvisor**: 14282
3. "Load" 클릭 후 데이터소스 선택

### 7.4 커스텀 대시보드 생성

**VMS Chat Ops 전용 대시보드**:

1. Dashboards → New Dashboard
2. Add Panel 클릭
3. 쿼리 예시:

**CPU 사용률**:
```promql
rate(container_cpu_usage_seconds_total{name=~"vms-.*"}[5m]) * 100
```

**메모리 사용량**:
```promql
container_memory_usage_bytes{name=~"vms-.*"} / 1024 / 1024
```

**API 요청 수**:
```promql
rate(http_requests_total[5m])
```

**에러율**:
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

**최근 로그** (Loki):
```logql
{service="backend"} |= "error"
```

## 8. 알림 설정 (Alertmanager)

### 8.1 Alertmanager 추가

`docker-compose.monitoring.yml`에 추가:

```yaml
  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager
    restart: unless-stopped
    networks:
      - vms-chat-ops-network
```

### 8.2 Alertmanager 설정

`monitoring/alertmanager/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@your-domain.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'email'
  routes:
    - match:
        severity: critical
      receiver: 'critical-email'
      continue: true

receivers:
  - name: 'email'
    email_configs:
      - to: 'team@your-domain.com'
        send_resolved: true

  - name: 'critical-email'
    email_configs:
      - to: 'oncall@your-domain.com'
        send_resolved: true
```

### 8.3 Prometheus에 Alertmanager 연동

`prometheus.yml`에 추가:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## 9. 로그 분석 예제

### 9.1 Loki 쿼리 예제

**에러 로그 찾기**:
```logql
{service="backend"} |= "error" or "ERROR"
```

**특정 시간대 로그**:
```logql
{service="backend"} | json | level="error"
```

**로그 집계 (카운트)**:
```logql
sum(count_over_time({service="backend"}[1h]))
```

**패턴 매칭**:
```logql
{service="backend"} |~ "message.*failed"
```

### 9.2 Grafana Explore 사용

1. Grafana → Explore
2. 데이터소스: Loki 선택
3. 쿼리 입력 후 "Run query"
4. 시간 범위 조정
5. "Add to dashboard" 클릭

## 10. 성능 튜닝

### 10.1 Prometheus 데이터 보존 기간

```yaml
# prometheus.yml
global:
  scrape_interval: 15s  # 수집 간격 (기본: 15s)

# docker-compose.monitoring.yml
command:
  - '--storage.tsdb.retention.time=30d'  # 30일 보존
  - '--storage.tsdb.retention.size=10GB'  # 또는 크기 제한
```

### 10.2 Loki 로그 보존

```yaml
# loki-config.yml
limits_config:
  retention_period: 720h  # 30일
```

### 10.3 리소스 제한

```yaml
# docker-compose.monitoring.yml
  prometheus:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

  grafana:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## 11. 백업 및 복구

### 11.1 Prometheus 백업

```bash
# 스냅샷 생성
curl -X POST http://localhost:9090/api/v1/admin/tsdb/snapshot

# 데이터 디렉토리 백업
docker run --rm \
  -v prometheus_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz /data
```

### 11.2 Grafana 백업

```bash
# Grafana 설정 백업
docker exec grafana grafana-cli admin export-dashboard > grafana-backup.json

# 데이터 볼륨 백업
docker run --rm \
  -v grafana_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/grafana-backup-$(date +%Y%m%d).tar.gz /data
```

## 12. 문제 해결

### 12.1 Prometheus가 타겟을 스크레이핑하지 못함

**확인 사항**:
```bash
# Prometheus 타겟 상태 확인
curl http://localhost:9090/api/v1/targets

# 네트워크 연결 확인
docker exec prometheus ping backend
```

**해결**:
- Docker 네트워크가 동일한지 확인
- 서비스 이름이 정확한지 확인

### 12.2 Grafana에서 데이터소스 연결 실패

**해결**:
```bash
# Grafana 로그 확인
docker logs grafana

# 데이터소스 URL 확인 (컨테이너 이름 사용)
http://prometheus:9090
http://loki:3100
```

### 12.3 Loki 로그가 수집되지 않음

**확인**:
```bash
# Promtail 로그 확인
docker logs promtail

# Docker 소켓 권한 확인
ls -la /var/run/docker.sock
```

## 13. 보안 고려사항

### 13.1 Grafana 보안

- 기본 비밀번호 즉시 변경
- HTTPS 사용 (Nginx 리버스 프록시)
- 불필요한 플러그인 비활성화
- 정기적인 업데이트

### 13.2 Prometheus 보안

- 외부 노출 제한 (Nginx로 프록시)
- 인증 추가 (basic auth)
- 민감한 레이블 마스킹

### 13.3 네트워크 격리

```yaml
# 모니터링 전용 네트워크 사용
networks:
  vms-chat-ops-network:
    internal: false  # 외부 접근 필요 시
  monitoring-network:
    internal: true   # 모니터링 내부 통신만
```

## 14. 체크리스트

모니터링 시스템 배포 전 확인:

- [ ] Prometheus 설정 파일 작성
- [ ] 알림 규칙 정의
- [ ] Loki 및 Promtail 설정
- [ ] Grafana 데이터소스 프로비저닝
- [ ] 기본 대시보드 생성
- [ ] Backend 메트릭 엔드포인트 구현
- [ ] 모니터링 스택 시작 확인
- [ ] 각 서비스 접속 테스트
- [ ] 알림 테스트 (선택사항)
- [ ] 백업 스크립트 설정
- [ ] 로그 보존 정책 설정
- [ ] 리소스 제한 설정
- [ ] Grafana 비밀번호 변경
- [ ] HTTPS 리버스 프록시 설정

## 15. 참고 자료

- [Prometheus 문서](https://prometheus.io/docs/)
- [Grafana 문서](https://grafana.com/docs/)
- [Loki 문서](https://grafana.com/docs/loki/latest/)
- [Promtail 문서](https://grafana.com/docs/loki/latest/clients/promtail/)
- [cAdvisor GitHub](https://github.com/google/cadvisor)
- [Node Exporter GitHub](https://github.com/prometheus/node_exporter)
- [Alertmanager 문서](https://prometheus.io/docs/alerting/latest/alertmanager/)

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0
