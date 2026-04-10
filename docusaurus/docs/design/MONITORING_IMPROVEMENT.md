# VMS Chat Ops 모니터링 개선 설계 문서

## 1. 개선 목표 및 배경

### 배경

초기 모니터링 설정은 외부 브리지 기반 아키텍처를 전제로 구성되어 있었습니다. VMS Chat Ops가 **v-channel-bridge 아키텍처** (FastAPI + Provider Pattern)로 전환되면서 다음과 같은 불일치 문제가 발생했습니다.

| 문제 | 내용 |
|------|------|
| 네트워크 이름 오류 | 이전 네트워크명 → `vms-chat-ops_vms-chat-ops-network` |
| 잡 이름 불일치 | `alerts.yml`에서 존재하지 않는 레거시 잡 참조 |
| 대시보드 구식 | Grafana 타이틀 및 서비스 로그 필터가 이전 아키텍처 기준 |
| Loki 설정 오류 | 미사용 alertmanager URL 참조 (`ruler.alertmanager_url`) |
| 이미지 버전 미고정 | `latest` 태그 사용으로 재현성 문제 |
| 메트릭 미반영 | VMS 실제 메트릭 (`http_requests_total`, `message_count_total` 등) 미활용 |

### 개선 목표

1. **정확성**: 실제 컨테이너 이름 및 네트워크 이름과 일치하는 설정
2. **관찰 가능성**: VMS Chat Ops 핵심 비즈니스 메트릭(메시지 브리지, API 상태) 시각화
3. **재현성**: 이미지 버전 고정으로 환경 일관성 보장
4. **안정성**: healthcheck 추가 및 서비스 간 의존성 명확화
5. **운영 편의성**: 한글 주석, 알림 규칙, 구조화 로그 파싱

---

## 2. 모니터링 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                    vms-chat-ops_vms-chat-ops-network                  │
│                                                                       │
│  ┌──────────────┐   /metrics    ┌─────────────────┐                  │
│  │   backend    │◄──────────────│   prometheus    │                  │
│  │  :8000       │               │   :9090         │                  │
│  └──────────────┘               └────────┬────────┘                  │
│                                          │ PromQL                    │
│  ┌──────────────┐   metrics     ┌────────▼────────┐                  │
│  │  cadvisor    │◄──────────────│                 │                  │
│  │  :8080       │               │    grafana      │                  │
│  └──────────────┘               │    :3001        │                  │
│                                 │                 │                  │
│  ┌──────────────┐   metrics     └────────┬────────┘                  │
│  │node_exporter │◄──────────────         │ LogQL                    │
│  │  :9100       │               ┌────────▼────────┐                  │
│  └──────────────┘               │      loki       │                  │
│                                 │      :3100      │                  │
│  ┌──────────────┐   push logs   └────────▲────────┘                  │
│  │   promtail   │───────────────          │                          │
│  │  :9080       │                         │                          │
│  └──────┬───────┘               Docker Container Logs               │
│         │ /var/run/docker.sock            │                          │
│         └────────────────────────────────┘                          │
│                                                                       │
│  컨테이너: vms-chatops-backend, vms-chatops-frontend,                │
│           vms-chatops-postgres, vms-chatops-redis                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 각 컴포넌트 역할

| 컴포넌트 | 이미지 | 역할 |
|----------|--------|------|
| **Prometheus** | `prom/prometheus:v2.51.0` | 메트릭 수집 및 시계열 저장, 알림 규칙 평가 |
| **Grafana** | `grafana/grafana:10.4.1` | 메트릭/로그 시각화 대시보드 |
| **Loki** | `grafana/loki:3.0.0` | 로그 수집 및 저장 (30일 보관) |
| **Promtail** | `grafana/promtail:3.0.0` | Docker 컨테이너 로그 수집 에이전트 |
| **cAdvisor** | `gcr.io/cadvisor/cadvisor:v0.49.1` | 컨테이너 CPU/메모리/네트워크 메트릭 |
| **Node Exporter** | `prom/node-exporter:v1.8.0` | 호스트 시스템 메트릭 (디스크, CPU) |

---

## 4. 주요 메트릭 목록

### VMS Backend 메트릭 (`job="vms-backend"`)

| 메트릭 | 타입 | 설명 |
|--------|------|------|
| `http_requests_total{endpoint,method,status}` | Counter | API 요청 총 횟수 |
| `http_request_duration_seconds{endpoint,method}` | Histogram | API 응답 시간 분포 |
| `websocket_connections` | Gauge | 현재 WebSocket 연결 수 |
| `message_count_total{channel,direction}` | Counter | 처리된 메시지 총 횟수 |

### 인프라 메트릭

| 메트릭 | 출처 | 설명 |
|--------|------|------|
| `container_cpu_usage_seconds_total{name=~"vms-chatops.*"}` | cAdvisor | 컨테이너 CPU 사용량 |
| `container_memory_usage_bytes{name=~"vms-chatops.*"}` | cAdvisor | 컨테이너 메모리 사용량 |
| `container_start_time_seconds{name=~"vms-chatops.*"}` | cAdvisor | 컨테이너 재시작 감지용 |
| `node_filesystem_avail_bytes{mountpoint="/"}` | Node Exporter | 디스크 여유 공간 |
| `node_cpu_seconds_total{mode="idle"}` | Node Exporter | 호스트 CPU 유휴 비율 |

---

## 5. 알림 규칙 설계

### 그룹 1: `vms_service_alerts` (평가 주기: 30s)

| 알림명 | 조건 | 지속 | 심각도 | 설명 |
|--------|------|------|--------|------|
| `VMSBackendDown` | `up{job="vms-backend"} == 0` | 1m | critical | 백엔드 다운 |
| `VMSHighErrorRate` | 5xx 에러율 > 5% | 5m | critical | API 에러율 초과 |
| `VMSSlowResponse` | P95 응답시간 > 2s | 5m | warning | 응답 지연 |
| `VMSBridgeHighMessageFailure` | 메시지 API 에러 > 0.1/s | 2m | warning | 브리지 오류 증가 |

### 그룹 2: `container_resource_alerts` (평가 주기: 1m)

| 알림명 | 조건 | 지속 | 심각도 | 설명 |
|--------|------|------|--------|------|
| `ContainerHighCPU` | CPU > 80% | 5m | warning | vms-chatops.* 컨테이너 |
| `ContainerHighMemory` | 메모리 > 512MB | 5m | warning | vms-chatops.* 컨테이너 |
| `ContainerRestarting` | 1시간 내 재시작 > 3회 | 즉시 | warning | 불안정 컨테이너 |

### 그룹 3: `host_alerts` (평가 주기: 1m)

| 알림명 | 조건 | 지속 | 심각도 | 설명 |
|--------|------|------|--------|------|
| `HostDiskSpaceLow` | 디스크 여유 < 10% | 5m | critical | 루트 파티션 |
| `HostHighCPU` | 호스트 CPU > 85% | 10m | warning | 지속적인 과부하 |

---

## 6. 대시보드 패널 설계

대시보드 UID: `vms-chat-ops-overview`, 갱신 주기: 30s

### 상단 행 (Row 1) - 서비스 상태 지표 (y:0)

| 패널 ID | 타입 | 위치 (x,w) | 메트릭 | 제목 |
|---------|------|------------|--------|------|
| 1 | stat | 0, w:4 | `up{job="vms-backend"}` | Backend 상태 |
| 2 | stat | 4, w:4 | `sum(rate(http_requests_total{job="vms-backend"}[1m]))` | API 요청/초 |
| 3 | stat | 8, w:4 | 5xx 에러율 (%) | 에러율 (5xx) |
| 4 | stat | 12, w:4 | P95 응답시간 (ms) | 응답시간 P95 |

### 중단 행 (Row 2) - API 트래픽 분석 (y:4)

| 패널 ID | 타입 | 위치 (x,w) | 메트릭 | 제목 |
|---------|------|------------|--------|------|
| 5 | timeseries | 0, w:12 | 엔드포인트별 요청률 | 주요 API 요청률 |
| 6 | timeseries | 12, w:12 | 상태코드별 응답 분포 | 응답 상태코드 분포 |

### 하단 행 (Row 3) - 인프라 리소스 (y:11)

| 패널 ID | 타입 | 위치 (x,w) | 메트릭 | 제목 |
|---------|------|------------|--------|------|
| 7 | timeseries | 0, w:12 | 컨테이너 CPU (%) | 컨테이너 CPU 사용률 |
| 8 | timeseries | 12, w:12 | 컨테이너 메모리 (bytes) | 컨테이너 메모리 사용량 |

### 로그 행 (Row 4) - 실시간 로그 (y:18)

| 패널 ID | 타입 | 위치 (x,w) | 데이터소스 | 제목 |
|---------|------|------------|------------|------|
| 9 | logs | 0, w:24 | Loki | 서비스 로그 (Backend/Frontend) |

---

## 7. Loki 로그 파이프라인

Promtail은 Docker Socket을 통해 `vms-chat-ops` 컴포즈 프로젝트 컨테이너 로그를 수집합니다.

```
Docker 컨테이너 로그
  → docker stage (JSON 파싱)
  → json stage (level, message, event 추출 - structlog 형식)
  → labels stage (level, service, container 레이블 부착)
  → timestamp stage (RFC3339 파싱, 실패 시 현재 시간)
  → drop stage (/api/health 헬스체크 로그 제거)
  → Loki push (http://loki:3100/loki/api/v1/push)
```

---

## 8. 실행 방법

### 모니터링 스택 시작

```bash
# 메인 스택이 먼저 실행 중이어야 함
docker compose up -d

# 모니터링 스택 시작
docker compose -f docker-compose.monitoring.yml up -d
```

### 접속 주소

| 서비스 | URL | 기본 자격증명 |
|--------|-----|---------------|
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| cAdvisor | http://localhost:8081 | - |
| Node Exporter | http://localhost:9100 | - |
| Loki | http://localhost:3100 | - |

### 모니터링 스택 종료

```bash
docker compose -f docker-compose.monitoring.yml down
```

### 데이터 포함 완전 삭제

```bash
docker compose -f docker-compose.monitoring.yml down -v
```

---

## 9. 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-04-05 | 1.0 | 초기 개선 설계 (외부 브리지 → v-channel-bridge 전환) |

---

**문서 버전**: 1.0  
**작성일**: 2026-04-05  
**담당**: VMS Cloud Infra Team
