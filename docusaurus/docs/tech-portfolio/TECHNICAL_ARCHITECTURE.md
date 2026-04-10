---
id: technical-architecture
title: 시스템 아키텍처 및 기반 기술
sidebar_position: 1
tags: [architecture, tech-portfolio]
---

# 시스템 아키텍처 및 기반 기술

VMS Chat Ops의 기술적 설계 철학, 아키텍처 구조, 데이터 흐름, 인프라 구성을 상세히 기술합니다.

---

## Architecture Overview

### 설계 철학: Light-Zowe Architecture

VMS Chat Ops는 IBM의 **Zowe Chat** 프로젝트에서 검증된 3가지 핵심 설계 패턴을 채택하여, Docker + FastAPI 환경에 최적화한 **Light-Zowe Architecture**를 구현합니다.

| Zowe Chat 원칙 | VMS Chat Ops 구현 |
|---|---|
| Common Message Schema | `CommonMessage` Pydantic 모델 (16개 필드, 4개 서브모델) |
| Provider Pattern | `BasePlatformProvider` ABC → `SlackProvider`, `TeamsProvider` |
| Command Processor | `CommandProcessor` — `/vms`, `/bridge` 명령 처리 |

이 아키텍처의 핵심 이점은 **플랫폼 추상화**입니다. 새로운 메시징 플랫폼(Discord, Telegram 등)을 추가할 때 `BasePlatformProvider`를 상속하는 어댑터 하나만 구현하면 되며, 라우팅 엔진과 메시지 스키마는 변경 없이 재사용됩니다.

### 전체 시스템 구조

```
                    ┌──────────────────────────────────────────────┐
                    │              Frontend (React 18)              │
                    │  Vite + TypeScript 5 + Tailwind CSS          │
                    │  Zustand (State) + TanStack Query (Server)   │
                    │  Port: 5173                                   │
                    └──────────────────┬───────────────────────────┘
                                       │ REST API + WebSocket
                    ┌──────────────────▼───────────────────────────┐
                    │           Backend API (FastAPI)               │
                    │  Python 3.11 + Uvicorn + Pydantic v2         │
                    │  22 Routers / JWT+SSO Auth / CORS+CSRF       │
                    │  Port: 8000                                   │
                    ├──────────────────────────────────────────────┤
                    │         WebSocket Bridge (Core Engine)        │
                    │  ┌─────────────┐  ┌──────────────────────┐  │
                    │  │RouteManager │  │  MessageQueue         │  │
                    │  │(Redis 7)    │  │  batch=50, flush=5s   │  │
                    │  └─────────────┘  └──────────────────────┘  │
                    ├──────────────────────────────────────────────┤
                    │              Provider Layer                   │
                    │  ┌──────────────┐    ┌──────────────────┐   │
                    │  │SlackProvider │    │ TeamsProvider     │   │
                    │  │Socket Mode   │    │ Graph API v1.0   │   │
                    │  │slack-bolt    │    │ Bot Framework    │   │
                    │  │1.20.1        │    │ 4.16.0           │   │
                    │  └──────┬───────┘    └───────┬──────────┘   │
                    └─────────┼────────────────────┼──────────────┘
                              │                    │
                    ┌─────────▼──┐          ┌──────▼───────────┐
                    │  Slack API │          │ Microsoft Graph  │
                    │  (Socket   │          │ API v1.0         │
                    │   Mode)    │          │ + Bot Framework  │
                    └────────────┘          └──────────────────┘
```

### 데이터 흐름: 메시지 라우팅 파이프라인

Slack 채널에서 전송된 메시지가 Teams 채널로 브리지되는 전체 과정입니다.

```
[1] Slack Event (Socket Mode)
     │
     ▼
[2] SlackProvider.handle_message()
     │  - 봇 자신의 메시지 필터링 (bot_user_id 비교)
     │  - 서브타입 필터링 (file_share, thread_broadcast만 허용)
     │  - 사용자 프로필 조회 (캐시 우선, API 폴백)
     │
     ▼
[3] SlackProvider.transform_to_common()
     │  - Slack 이벤트 → CommonMessage 변환
     │  - User/Channel/Attachment 객체 생성
     │  - 파일 공유 시 Attachment 메타데이터 추출
     │
     ▼
[4] WebSocketBridge._route_message()
     │  - CommandProcessor: /vms, /bridge 명령 감지 → 처리 후 응답
     │  - RouteManager.get_targets(): Redis에서 대상 채널 조회
     │  - 대상이 없으면 "no_route" 상태로 DB 저장 후 종료
     │
     ▼
[5] WebSocketBridge._send_message() (대상별 반복)
     │  - 메시지 모드 조회 (sender_info / editable)
     │  - 첨부파일 다운로드: source_provider.download_file()
     │  - 스레드 매핑 조회: RouteManager.get_thread_mapping()
     │  - 편집된 메시지 처리 (editable 모드일 때)
     │
     ▼
[6] TeamsProvider.send_message()
     │  - CommonMessage → Teams Activity 변환
     │  - Markdown → Teams HTML 변환
     │  - 이미지: Base64 hostedContents / 기타: SharePoint 업로드
     │  - Graph API POST /teams/{teamId}/channels/{channelId}/messages
     │
     ▼
[7] MessageQueue.enqueue_from_common_message()
     │  - MessageStatus 객체 생성 (전송 결과 포함)
     │  - asyncio.Queue에 적재
     │  - 배치 조건 충족 시 (50개 또는 5초) DB 플러시
     │
     ▼
[8] PostgreSQL messages 테이블에 저장
```

---

## Modern Data Stack

### 데이터 저장 계층

| 계층 | 기술 | 용도 | 데이터 특성 |
|------|------|------|-------------|
| **관계형 DB** | PostgreSQL 16 Alpine | 사용자, 계정, 메시지, 감사 로그 | 영구 저장, ACID 트랜잭션 |
| **캐시/라우팅** | Redis 7 Alpine | 라우팅 규칙, 스레드 매핑, 세션 | 인메모리, TTL 기반 만료 |
| **시계열 DB** | Prometheus TSDB | 메트릭 수집 (CPU, 응답시간 등) | 30일 보존, 15초 수집 주기 |
| **로그 저장소** | Grafana Loki 3.0 | 구조화 로그 수집 및 검색 | 30일 보존, TSDB 형식 |

### PostgreSQL 스키마: 14개 모델

```sql
-- 핵심 비즈니스 모델
users              -- 사용자 (JWT+SSO 인증, 3단계 역할: SYSTEM_ADMIN/ORG_ADMIN/USER)
accounts           -- Provider 계정 (Slack/Teams 자격증명, Fernet 암호화)
messages           -- 브리지 메시지 (18+ 필드, 8개 인덱스)
message_stats      -- 일별 집계 (gateway/channel/hourly JSON 통계)
audit_logs         -- 감사 로그 (27개 액션 타입, 4개 복합 인덱스)

-- 인증/보안 모델
refresh_tokens       -- JWT 리프레시 토큰 (디바이스 핑거프린팅)
password_reset_tokens -- 비밀번호 재설정 (30분 만료, UUID 토큰)
user_oauth_tokens    -- 사용자별 OAuth 토큰 (Microsoft 위임 등)
system_settings      -- 시스템 설정 (싱글턴 패턴, id=1)

-- RBAC/조직 모델
menu_items           -- 커스텀 메뉴 (built_in/custom_iframe/custom_link/menu_group)
user_permissions     -- 사용자별 권한 오버라이드
permission_groups    -- 명명된 권한 그룹 (역할 기반 기본 할당)
companies            -- 회사 (조직 계층 최상위)
departments          -- 부서 (회사 하위 조직)
```

**보안 설계**:
- 모든 Provider 자격증명(토큰, 비밀번호)은 **Fernet 대칭 암호화**로 DB에 저장
- `Account` 모델에 11개의 암/복호화 프로퍼티 (`token_decrypted`, `app_password_decrypted` 등)
- 비밀번호 해싱: **bcrypt** (passlib)
- JWT 서명: **python-jose** (HS256)

### Redis 라우팅 구조

```
# 라우트 규칙 (Set)
route:slack:C789012                   → {"teams:teamId:channelId", ...}

# 메타데이터 (Hash)
route:slack:C789012:names             → {target: "display_name"}
route:slack:C789012:source_name       → "general"
route:slack:C789012:modes             → {target: "sender_info"|"editable"}
route:slack:C789012:bidirectional     → {target: "1"|"0"}
route:slack:C789012:enabled           → {target: "1"|"0"}

# 스레드 매핑 (String, TTL 7일)
thread:slack:C789012:1234567890.123   → "teams:teamId:channelId:msgId"
```

**설계 특징**:
- `SCAN` 커서 기반 키 순회 — 대규모 라우트에서도 Redis 블로킹 없음
- 양방향 Route 생성 시 역방향 키 자동 생성/삭제
- `frozenset` 쌍 추적으로 양방향 Route UI 중복 제거

---

## Data Pipeline

### 메시지 처리 파이프라인

```
수집 (Ingestion)     →    변환 (Transform)    →    라우팅 (Route)    →    저장 (Persist)
┌────────────────┐    ┌──────────────────┐    ┌────────────────┐    ┌────────────────┐
│ Socket Mode    │    │ transform_to_    │    │ RouteManager   │    │ MessageQueue   │
│ (Slack)        │───▶│ common()         │───▶│ .get_targets() │───▶│ batch=50       │
│                │    │                  │    │                │    │ flush=5s       │
│ Bot Framework  │    │ CommonMessage    │    │ Redis SMEMBERS │    │                │
│ Webhook        │    │ 정규화           │    │                │    │ PostgreSQL     │
│ (Teams)        │    │                  │    │                │    │ bulk INSERT    │
└────────────────┘    └──────────────────┘    └────────────────┘    └────────────────┘
```

### 배치 메시지 큐 (MessageQueue)

데이터베이스 부하를 줄이기 위한 **배치 쓰기 패턴**을 구현합니다.

```python
# 동작 원리
Worker Loop:
  1. asyncio.Queue에서 메시지 대기 (1초 타임아웃)
  2. 메시지 수신 → 배치 버퍼에 추가
  3. 버퍼 크기 ≥ 50개 → flush_batch()
  4. 타임아웃 && (현재시간 - 마지막플러시) > 5초 → flush_batch()

flush_batch():
  - 기존 메시지 존재 → UPDATE (status, error, retry_count)
  - 신규 메시지 → INSERT
  - 단일 트랜잭션으로 커밋
```

### 첨부파일 브리지 파이프라인

```
Source Platform          Bridge               Target Platform
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ 파일 URL     │───▶│ download_    │───▶│ 이미지:          │
│ (Slack       │    │ file()       │    │  Base64 inline   │
│  permalink)  │    │              │    │  (hostedContents)│
│              │    │ local_path   │    │                  │
│ 파일 URL     │    │ 임시 저장    │    │ 기타 파일:       │
│ (Teams       │    │              │    │  SharePoint 업로드│
│  driveItem)  │    │              │    │  + 링크 첨부     │
└──────────────┘    └──────────────┘    └──────────────────┘
```

### Observability 데이터 파이프라인

```
Application Logs (structlog JSON)
     │
     ▼
Promtail (Docker log 수집)
  - Docker JSON 파싱
  - structlog 필드 추출 (level, message, event)
  - /api/health 로그 필터링 (노이즈 제거)
     │
     ▼
Loki 3.0 (로그 저장)
  - TSDB 형식, 24시간 인덱스 주기
  - 30일 보존, 4MB/s 수집 제한
     │
     ▼
Grafana 10.4 (시각화)
  - LogQL 쿼리
  - 대시보드: vms-overview, vms-logs
```

---

## Infrastructure & Security

### 컨테이너 오케스트레이션

현재 **Docker Compose** 기반으로 운영되며, 향후 Kubernetes 전환을 고려한 설계입니다.

#### 서비스 토폴로지 (Development)

| 서비스 | 이미지 | 컨테이너 | 포트 | 헬스체크 |
|--------|--------|----------|------|----------|
| PostgreSQL | postgres:16-alpine | vms-chatops-postgres | 5432 | `pg_isready` 10s |
| Redis | redis:7-alpine | vms-chatops-redis | 6379 | `redis-cli ping` 10s |
| Backend API | python:3.11-slim | vms-chatops-backend | 8000 | `curl /api/health` 60s |
| Frontend | node:18-alpine | vms-chatops-frontend | 5173 | `wget /` 30s |
| MailHog | mailhog/mailhog | vms-chatops-mailhog | 1025/8025 | — |
| Prometheus | prom/prometheus:v2.51.0 | vms-prometheus | 9090 | HTTP 30s |
| Grafana | grafana/grafana:10.4.1 | vms-grafana | 3001 | HTTP 30s |
| Loki | grafana/loki:3.0.0 | vms-loki | 3100 | `/ready` 30s |
| Promtail | grafana/promtail:3.0.0 | vms-promtail | 9080 | TCP 30s |
| cAdvisor | cadvisor:v0.49.1 | vms-cadvisor | 8081 | `/healthz` 30s |
| Node Exporter | node-exporter:v1.8.0 | vms-node-exporter | 9100 | `/metrics` 30s |

**네트워크**: `vms-chat-ops-network` (Bridge 드라이버)

#### Production 배포 구성

```yaml
# docker-compose.prod.yml 핵심 차이점
services:
  nginx:           # 리버스 프록시 추가 (80/443)
    deploy:
      resources:
        limits: { memory: 128M, cpus: "0.25" }

  backend:
    deploy:
      resources:
        limits: { memory: 2G, cpus: "2.0" }
        reservations: { memory: 1G, cpus: "1.0" }
      restart_policy:
        condition: on-failure
        max_attempts: 3

  postgres:
    deploy:
      resources:
        limits: { memory: 2G, cpus: "2.0" }
```

#### Nginx 리버스 프록시

```
Client ──▶ Nginx (80/443)
            ├── /api/*     ──▶ Backend (8000)  [WebSocket 지원]
            ├── /ws/*      ──▶ Backend (8000)  [WebSocket upgrade]
            └── /*         ──▶ Frontend (80)   [Static + SPA]
```

**보안 헤더**:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- HTTPS: TLS 1.2/1.3, HSTS max-age=31536000

### 보안 아키텍처

```
┌─────────────────────────────────────────────────┐
│                    보안 계층                      │
├─────────────────────────────────────────────────┤
│ [L1] 네트워크     │ Docker Bridge Network       │
│                    │ Production: 포트 80/443만   │
│                    │ 내부 서비스 포트 비노출      │
├────────────────────┼────────────────────────────┤
│ [L2] 전송 계층     │ TLS 1.2/1.3 (Production)   │
│                    │ HSTS 헤더                   │
├────────────────────┼────────────────────────────┤
│ [L3] 인증          │ JWT (python-jose, HS256)    │
│                    │ SSO (Microsoft Entra/OIDC)  │
│                    │ 리프레시 토큰 + 디바이스 FP  │
│                    │ Rate Limiting (slowapi)     │
├────────────────────┼────────────────────────────┤
│ [L4] 인가          │ RBAC 3단계 역할 체계         │
│                    │ (SYSTEM_ADMIN/ORG_ADMIN/USER)│
│                    │ 권한 그룹 + 개인 오버라이드   │
│                    │ 서버 기반 메뉴 필터링         │
├────────────────────┼────────────────────────────┤
│ [L5] 데이터 보호   │ Fernet 대칭 암호화 (토큰)   │
│                    │ bcrypt 해싱 (비밀번호)       │
│                    │ CSRF 토큰 검증              │
├────────────────────┼────────────────────────────┤
│ [L6] 감사          │ 27개 액션 타입 감사 로그     │
│                    │ IP, User-Agent 기록         │
│                    │ 실패/성공 상태 추적          │
└────────────────────┴────────────────────────────┘
```

### 멀티 스테이지 Docker 빌드

```dockerfile
# Backend: 2-stage build
Stage 1 (Builder):  python:3.11-slim + gcc → pip install
Stage 2 (Runtime):  python:3.11-slim + curl → copy packages
  - Non-root user (appuser, uid:1000)
  - Health check 내장

# Frontend: 2-stage build
Stage 1 (Builder):  node:18-alpine + pnpm → build
Stage 2 (Runtime):  nginx:alpine → static serve
```

---

## Technical Scalability

### 현재 확장성 설계 포인트

| 영역 | 현재 구현 | 확장 전략 |
|------|----------|----------|
| **메시지 처리** | asyncio 기반 비동기 I/O | 수평 확장: 여러 Bridge 인스턴스 + Redis Pub/Sub |
| **DB 쓰기** | 배치 큐 (50개/5초) | Write replica 분리, 파티셔닝 |
| **라우팅** | Redis 인메모리 SET/HASH | Redis Cluster (샤딩) |
| **파일 전송** | 로컬 임시 저장 → 업로드 | Object Storage (MinIO/S3) 도입 |
| **모니터링** | Prometheus TSDB 로컬 | Thanos/Cortex로 장기 저장 |

### Kubernetes 전환 준비도

현재 아키텍처는 K8s 전환을 위해 다음 요소가 이미 준비되어 있습니다:

1. **컨테이너화 완료**: 모든 서비스가 Docker 이미지로 패키징
2. **헬스체크 내장**: Liveness/Readiness probe로 직접 전환 가능
3. **환경 변수 주입**: 모든 설정이 환경 변수 기반 (→ ConfigMap/Secret)
4. **Stateless 설계**: Backend는 상태를 Redis/PostgreSQL에 위임
5. **리소스 제한 정의**: CPU/Memory limits가 이미 docker-compose에 명시

**K8s 전환 시 추가 필요 사항**:

| 컴포넌트 | 현재 | K8s 전환 |
|----------|------|----------|
| 로드밸런서 | Nginx (단일) | Ingress Controller (nginx/traefik) |
| 인증서 | 수동 발급 | cert-manager + Let's Encrypt |
| 스토리지 | Docker Volume | PVC (StorageClass) |
| 시크릿 | .env 파일 | K8s Secret + External Secrets Operator |
| 스케일링 | 수동 | HPA (CPU/메모리 기반 자동 스케일링) |
| 서비스 디스커버리 | Docker Network DNS | K8s Service + CoreDNS |

### 트래픽 증가 대응 전략

```
현재 (단일 인스턴스)          →          확장 (다중 인스턴스)
┌──────────┐                    ┌──────────────────────────┐
│ Backend  │                    │ Ingress Controller       │
│ (1 Pod)  │                    │     ├── Backend Pod 1    │
│          │                    │     ├── Backend Pod 2    │
│ Redis    │                    │     └── Backend Pod 3    │
│ (1 Pod)  │                    │                          │
│          │                    │ Redis Cluster (3 nodes)  │
│ Postgres │                    │ PostgreSQL (Primary +    │
│ (1 Pod)  │                    │   Read Replica)          │
└──────────┘                    └──────────────────────────┘
```

**예상 처리량**:
- 현재: ~100 msg/s (단일 asyncio 이벤트 루프)
- 확장: ~1,000+ msg/s (3 Backend Pod + Redis Cluster)

---

## 기술 스택 종합

### Backend Dependencies (35+ 패키지)

| 카테고리 | 패키지 | 버전 | 용도 |
|----------|--------|------|------|
| Web Framework | FastAPI | 0.109.0 | 비동기 REST API |
| ASGI Server | Uvicorn | 0.27.0 | 프로덕션 서버 |
| Validation | Pydantic | 2.5.3 | 데이터 검증/직렬화 |
| ORM | SQLAlchemy | 2.0.25 | PostgreSQL ORM |
| Migration | Alembic | 1.13.1 | DB 스키마 마이그레이션 |
| DB Driver | psycopg2-binary | 2.9.9 | PostgreSQL 드라이버 |
| Cache | redis-py | 5.0.1 | Redis 클라이언트 |
| Auth | python-jose | 3.3.0 | JWT 토큰 |
| Security | cryptography | 42.0.5 | Fernet 암호화 |
| Hashing | bcrypt | 4.1.2 | 비밀번호 해싱 |
| Rate Limit | slowapi | 0.1.9 | API 요청 제한 |
| Slack | slack-bolt | 1.20.1 | Socket Mode 연동 |
| Slack SDK | slack-sdk | 3.33.4 | Web API 클라이언트 |
| Teams | botbuilder-core | 4.16.0 | Bot Framework |
| HTTP | aiohttp | ≥3.9.0 | Graph API 호출 |
| Logging | structlog | 24.1.0 | 구조화 로깅 |
| Metrics | prometheus-client | 0.19.0 | Prometheus 메트릭 |
| Email | aiosmtplib | 3.0.1 | 비동기 SMTP |
| Template | Jinja2 | 3.1.3 | 이메일 템플릿 |
| Testing | pytest | 7.4.4 | 테스트 프레임워크 |
| Lint | ruff | 0.1.15 | 고속 Python 린터 |

### Frontend Dependencies

| 카테고리 | 패키지 | 버전 | 용도 |
|----------|--------|------|------|
| UI Framework | React | 18.2.0 | 컴포넌트 기반 UI |
| Build Tool | Vite | 5.0.11 | 빌드/HMR |
| Language | TypeScript | 5.3.3 | 타입 안전성 |
| Routing | react-router-dom | 6.21.0 | SPA 라우팅 |
| State | Zustand | 4.4.7 | 클라이언트 상태 |
| Server State | TanStack Query | 5.17.0 | 서버 상태/캐싱 |
| HTTP | Axios | 1.6.5 | API 클라이언트 |
| Charts | Recharts | 2.15.4 | 통계 시각화 |
| Icons | Lucide React | 0.309.0 | SVG 아이콘 |
| CSS | Tailwind CSS | 3.4.1 | 유틸리티 CSS |
| Fingerprint | FingerprintJS | 4.2.2 | 디바이스 식별 |
| Tour | Driver.js | 1.3.1 | 온보딩 가이드 |
| Testing | Vitest | 1.2.0 | 테스트 러너 |
| Lint | ESLint | 8.56.0 | 코드 품질 |
| Format | Prettier | 3.2.4 | 코드 포맷팅 |

### Infrastructure

| 컴포넌트 | 기술 | 버전 |
|----------|------|------|
| Container | Docker Compose | v2 |
| Database | PostgreSQL | 16 Alpine |
| Cache | Redis | 7 Alpine |
| Reverse Proxy | Nginx | Alpine |
| Metrics | Prometheus | v2.51.0 |
| Dashboard | Grafana | 10.4.1 |
| Log Aggregation | Loki | 3.0.0 |
| Log Collector | Promtail | 3.0.0 |
| Container Metrics | cAdvisor | v0.49.1 |
| Host Metrics | Node Exporter | v1.8.0 |
| Docs | Docusaurus | 3.1.0 |

---

**최종 업데이트**: 2026-04-10
**문서 버전**: 1.1
