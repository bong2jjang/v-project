---
id: development-readiness
title: 개발 수준 및 생산성 평가
sidebar_position: 2
tags: [development, tech-portfolio]
---

# 개발 수준 및 생산성 평가

VMS Chat Ops 프로젝트의 개발 자동화 수준, 코드 품질 관리 체계, 시스템 모니터링 역량을 수치화하여 평가합니다.

---

## Vibe Coding & Productivity

### AI Agent 활용 개발 자동화

VMS Chat Ops는 **Claude Code**(Anthropic의 AI 코딩 에이전트)를 핵심 개발 도구로 활용하여, 전체 개발 프로세스를 AI-Human 협업 워크플로우로 구축했습니다.

#### AI Agent 구성

| Agent | 모델 | 역할 | 활용 영역 |
|-------|------|------|----------|
| **Claude Code (Main)** | Claude Opus 4 | 메인 개발 에이전트 | 코드 작성, 아키텍처 설계, 디버깅 |
| **search-optimizer** | Claude Haiku | 빠른 파일 검색/분석 | 코드베이스 탐색, 로그 분석 |
| **docker-expert** | Claude Sonnet | Docker 인프라 전문 | 컨테이너 디버깅, 설정 문제 해결 |
| **code-standards-enforcer** | Claude Sonnet | 코딩 표준 감사 | 변경 파일 컨벤션 준수 검사 |
| **agent-coach** | Claude Sonnet | Agent 성능 분석 | 워크플로우 효율성 개선 |
| **migration-helper** | Claude Sonnet | 아키텍처 전문 | Provider/Route/Schema 관련 코드 |
| **pr-update-expert** | Claude Sonnet | PR 관리 | diff 분석, PR 설명 자동 생성 |

#### MCP (Model Context Protocol) 통합

프로젝트 설정 파일(`.claude/settings.json`)에서 MCP 서버를 통해 외부 도구와 연동합니다.

```
Claude Code
  ├── MCP: GitHub          → PR/이슈 관리
  ├── MCP: Slack           → 작업 알림
  ├── MCP: Notion          → 문서 동기화
  └── MCP: Microsoft 365   → Teams 연동 테스트
```

#### AI 기반 개발 자동화 수준

| 영역 | 자동화 수준 | 구체적 활용 |
|------|------------|------------|
| **코드 작성** | 🟢 높음 | Provider 어댑터, API 라우터, 컴포넌트 구현 |
| **아키텍처 설계** | 🟢 높음 | Light-Zowe 패턴 설계, CommonMessage 스키마 |
| **코드 리뷰** | 🟢 높음 | code-standards-enforcer 자동 감사 |
| **디버깅** | 🟢 높음 | Docker 로그 분석, 에러 추적 |
| **문서 작성** | 🟢 높음 | Docusaurus 기술 문서, API 레퍼런스 |
| **테스트 작성** | 🟡 중간 | 단위 테스트 생성, 테스트 케이스 설계 |
| **인프라 관리** | 🟡 중간 | docker-compose 구성, 모니터링 설정 |
| **배포** | 🟡 중간 | 빌드 검증, 배포 체크리스트 |

#### 휴먼 에러 감소 전략

| 에러 유형 | AI Agent 방어 메커니즘 |
|----------|----------------------|
| 타입 오류 | TypeScript strict 모드 + AI 코드 검증 |
| API 불일치 | Pydantic v2 자동 검증 + 스키마 기반 생성 |
| 보안 취약점 | OWASP Top 10 체크, 자격증명 하드코딩 감지 |
| 스타일 불일치 | ruff (Python) + ESLint/Prettier (TS) 자동 수정 |
| Docker 설정 오류 | docker-expert Agent 진단 |
| 의존성 충돌 | Docker 전용 개발 규칙 (로컬 npm 금지) |

#### Claude Code 프로젝트 설정

`CLAUDE.md`에 정의된 프로젝트 규칙으로 AI Agent의 일관성을 보장합니다:

```markdown
# 핵심 규칙 (CLAUDE.md에서 발췌)
- Docker 전용 개발: 로컬 npm/Python 실행 금지
- Provider: BasePlatformProvider 상속 필수
- 메시지: CommonMessage로 변환 필수
- 린트: Python 수정 후 ruff, TypeScript 수정 후 eslint+prettier
- Git push: 사용자 명시적 요청 시에만
```

**슬래시 커맨드** (AI Agent 도구):

| 커맨드 | 기능 |
|--------|------|
| `/docker-troubleshoot` | Docker 서비스 상태 자동 진단 |
| `/enforce-standards` | 코딩 표준 자동 검사 |
| `/deploy-check` | 배포 전 체크리스트 검증 |
| `/provider-health` | Provider 연결 상태 확인 |
| `/write-pr-summary` | PR 요약 자동 생성 |

---

## Code Quality & Governance

### 린트 및 포맷팅 도구

| 도구 | 대상 | 적용 범위 | 비고 |
|------|------|----------|------|
| **ruff** 0.1.15 | Python | 린트 + 자동 수정 | Flake8/isort/pyflakes 통합, ~10-100x 빠름 |
| **ruff format** | Python | 코드 포맷팅 | Black 호환 포맷터 |
| **mypy** 1.8.0 | Python | 정적 타입 검사 | strict 모드 |
| **ESLint** 8.56.0 | TypeScript | 린트 | @typescript-eslint 플러그인 |
| **Prettier** 3.2.4 | TypeScript/CSS | 포맷팅 | 일관된 코드 스타일 |

**린트 실행 워크플로우**:

```bash
# Python 수정 후 (필수)
cd backend && python -m ruff check --fix . && python -m ruff format .

# TypeScript 수정 후 (필수)
cd frontend && npm run lint:fix && npm run format
```

### 테스트 체계

| 영역 | 도구 | 실행 환경 | 커버리지 목표 |
|------|------|----------|-------------|
| Backend 단위 테스트 | pytest 7.4.4 | Docker 컨테이너 | 80% 이상 |
| Backend 비동기 테스트 | pytest-asyncio 0.23.3 | Docker 컨테이너 | — |
| Backend 커버리지 | pytest-cov 4.1.0 | Docker 컨테이너 | HTML 리포트 |
| Frontend 단위 테스트 | Vitest 1.2.0 | Docker 컨테이너 | — |
| Frontend 컴포넌트 | @testing-library/react 14.1.2 | Docker 컨테이너 | — |
| API 통합 테스트 | httpx 0.26.0 / curl | Docker 네트워크 | — |
| E2E 테스트 | curl / Postman | 실 서비스 대상 | — |

**테스트 구조**:

```
backend/tests/
├── adapters/
│   ├── test_slack_provider.py    # Provider 연결/변환/전송 테스트
│   └── test_teams_provider.py    # Graph API/Bot Framework 테스트
├── services/
│   ├── test_route_manager.py     # Redis 라우팅 규칙 테스트
│   ├── test_websocket_bridge.py  # 메시지 라우팅 흐름 테스트
│   └── test_message_queue.py     # 배치 처리 테스트
└── conftest.py                   # 공통 fixture (DB, Redis mock)
```

### CI/CD 파이프라인 설계 (계획)

현재 로컬 Docker 기반 개발 환경이며, 향후 다음과 같은 CI/CD 파이프라인 구성을 계획합니다.

```
                        CI/CD Pipeline (계획)
┌──────────┐    ┌────────────┐    ┌────────────┐    ┌──────────┐
│  Commit  │───▶│   Build    │───▶│   Test     │───▶│  Deploy  │
│  Push    │    │            │    │            │    │          │
│          │    │ Docker     │    │ pytest     │    │ Staging  │
│  PR Open │    │ multi-     │    │ vitest     │    │ → Prod   │
│          │    │ stage      │    │ ruff check │    │          │
│          │    │ build      │    │ eslint     │    │ Rolling  │
│          │    │            │    │ type check │    │ Update   │
└──────────┘    └────────────┘    └────────────┘    └──────────┘
```

**계획된 파이프라인 단계**:

1. **Build**: Docker 멀티 스테이지 빌드 (Backend + Frontend)
2. **Lint**: ruff check + ESLint + Prettier check
3. **Type Check**: mypy (Python) + tsc (TypeScript)
4. **Unit Test**: pytest + Vitest (병렬 실행)
5. **Integration Test**: Docker Compose 기반 전체 스택 테스트
6. **Security Scan**: 의존성 취약점 검사 (Safety/npm audit)
7. **Image Push**: Docker Registry 업로드
8. **Deploy**: Blue-Green 또는 Rolling Update

### 기술 부채 관리

| 부채 항목 | 현재 상태 | 관리 방법 |
|----------|----------|----------|
| Matterbridge 잔여 코드 | ✅ 완전 제거 | Light-Zowe 전환 완료 |
| SQLite → PostgreSQL | ✅ 완전 전환 | 마이그레이션 완료 |
| TOML 설정 → Redis | ✅ 완전 전환 | Route Manager 완료 |
| Teams Provider 실 테스트 | ⚠️ Azure 등록 필요 | 코드 완성, 인프라 대기 |
| CI/CD 파이프라인 | ⚠️ 미구축 | GitHub Actions 계획 |
| E2E 자동화 테스트 | ⚠️ 수동 | Playwright 도입 검토 |

### 코드 리뷰 체계

```
AI Agent (Claude Code)
  │
  ├── 자동 코딩 표준 검사 (/enforce-standards)
  ├── PR 요약 자동 생성 (/write-pr-summary)
  ├── 보안 취약점 사전 감지
  │
  ▼
Human Review
  │
  ├── 아키텍처 적합성 판단
  ├── 비즈니스 로직 검증
  └── 최종 승인/병합
```

---

## Observability

### 모니터링 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Grafana 10.4.1                             │
│  ┌──────────────────┐     ┌──────────────────────────────┐  │
│  │ vms-overview      │     │ vms-logs                     │  │
│  │ Dashboard         │     │ Dashboard                    │  │
│  │ - API 응답시간    │     │ - 실시간 로그 뷰어          │  │
│  │ - 에러율          │     │ - 서비스별 필터             │  │
│  │ - 컨테이너 리소스 │     │ - 로그 레벨 필터           │  │
│  │ - 메시지 처리량   │     │ - LogQL 쿼리               │  │
│  └────────┬─────────┘     └──────────────┬───────────────┘  │
│           │                               │                   │
│  ┌────────▼─────────┐     ┌──────────────▼───────────────┐  │
│  │ Prometheus        │     │ Loki 3.0                     │  │
│  │ (메트릭 저장)     │     │ (로그 저장)                  │  │
│  │ 30일 보존         │     │ 30일 보존                    │  │
│  └────────┬─────────┘     └──────────────┬───────────────┘  │
└───────────┼──────────────────────────────┼───────────────────┘
            │                               │
   ┌────────┴────────────┐        ┌────────┴────────────┐
   │ Metric Sources      │        │ Log Sources         │
   │ ├── Backend /metrics│        │ └── Promtail 3.0    │
   │ ├── cAdvisor v0.49  │        │     ├── Docker logs │
   │ └── Node Exp v1.8   │        │     ├── JSON parse  │
   └─────────────────────┘        │     └── structlog   │
                                   │         extraction  │
                                   └─────────────────────┘
```

### Prometheus 수집 대상

| Job Name | 대상 | 수집 주기 | 수집 메트릭 |
|----------|------|----------|------------|
| `vms-backend` | backend:8000/metrics | 15초 | HTTP 요청수, 응답시간, 에러율 |
| `prometheus` | localhost:9090/metrics | 15초 | Prometheus 자체 메트릭 |
| `cadvisor` | cadvisor:8080/metrics | 15초 | 컨테이너 CPU/메모리/네트워크/디스크 I/O |
| `node_exporter` | node_exporter:9100/metrics | 15초 | 호스트 CPU/메모리/디스크/네트워크 |

### 알림 규칙 (Alert Rules)

#### 서비스 알림 (30초 평가 주기)

| 알림 | 심각도 | 조건 | 지속 시간 |
|------|--------|------|----------|
| VMSBackendDown | 🔴 CRITICAL | Backend 응답 없음 | 1분 |
| VMSHighErrorRate | 🔴 CRITICAL | 5xx 에러율 > 5% | 5분 |
| VMSSlowResponse | 🟡 WARNING | P95 응답시간 > 2초 | 5분 |
| VMSBridgeHighMessageFailure | 🟡 WARNING | 메시지 에러 > 0.1/s | 2분 |

#### 인프라 알림 (1분 평가 주기)

| 알림 | 심각도 | 조건 | 지속 시간 |
|------|--------|------|----------|
| ContainerHighCPU | 🟡 WARNING | CPU > 80% | 5분 |
| ContainerHighMemory | 🟡 WARNING | Memory > 512MB | 5분 |
| ContainerRestarting | 🟡 WARNING | 재시작 > 3회/1시간 | 즉시 |
| HostDiskSpaceLow | 🔴 CRITICAL | 디스크 여유 < 10% | 5분 |
| HostHighCPU | 🟡 WARNING | CPU > 85% | 10분 |

### 로그 수집 파이프라인

```python
# Backend 로그 출력 (structlog)
import structlog
logger = structlog.get_logger()

logger.info("message_routed",
    source_platform="slack",
    target_platform="teams",
    message_id="1234567890.123",
    route="C789012→teamId:channelId",
    duration_ms=45
)
```

**Promtail 파이프라인 처리**:

```yaml
pipeline_stages:
  - docker: {}                     # Docker JSON 로그 파싱
  - json:                          # structlog 필드 추출
      expressions:
        level: level
        msg: message
        event: event
  - labels:                        # Loki 라벨 추가
      level:
      service:
  - timestamp:                     # RFC3339Nano 타임스탬프
      source: time
      format: RFC3339Nano
  - match:                         # 헬스체크 로그 필터링
      selector: '{service=~".+"}'
      stages:
        - regex:
            expression: '.*GET /api/health.*'
        - drop:
            source: ""
```

### 장애 조치 역량

| 시나리오 | 감지 방법 | 자동 대응 | 수동 대응 |
|----------|----------|----------|----------|
| Backend 다운 | Prometheus alert | Docker restart policy | 로그 분석 → 원인 수정 |
| DB 연결 실패 | Health check 실패 | 컨테이너 재시작 (3회 제한) | pg_isready 확인 → 복구 |
| Redis 다운 | Health check 실패 | 컨테이너 재시작 | 데이터 복구 (AOF) |
| 메시지 전송 실패 | message.status="failed" | retry_count 기록 | Messages 페이지에서 확인 |
| 디스크 부족 | Node Exporter alert | — | 로그 정리, 볼륨 확장 |
| 메모리 초과 | cAdvisor alert | OOM Kill → restart | 리소스 제한 조정 |

### Frontend 실시간 모니터링

프론트엔드에서도 시스템 상태를 실시간으로 확인할 수 있습니다:

| 페이지 | 모니터링 대상 | 갱신 방식 |
|--------|-------------|----------|
| **Dashboard** | Provider 연결 상태, 메시지 처리량 | WebSocket 실시간 |
| **Monitoring** | 서비스 헬스체크 (Backend, DB, Redis 등) | Polling (30초) |
| **Messages** | 메시지 전송 상태 (sent/failed/retrying) | API 조회 |
| **Audit Logs** | 관리 작업 이력 | API 조회 + 필터링 |
| **Statistics** | 시간별/일별 메시지 통계 | Recharts 시각화 |

---

## 개발 생산성 지표 요약

| 지표 | 현재 수준 | 비고 |
|------|----------|------|
| AI 코딩 활용도 | 🟢 매우 높음 | Claude Code 전 개발 과정 활용 |
| 코드 린트 자동화 | 🟢 높음 | ruff + ESLint + Prettier |
| 타입 안전성 | 🟢 높음 | TypeScript strict + Pydantic v2 |
| 인프라 코드화 | 🟢 높음 | Docker Compose 완전 정의 |
| 모니터링 | 🟢 높음 | 메트릭 + 로그 + 알림 구축 |
| 테스트 자동화 | 🟡 중간 | 단위 테스트 존재, E2E 수동 |
| CI/CD | 🟡 계획 중 | GitHub Actions 도입 예정 |
| 보안 스캔 | 🟡 수동 | 의존성 감사 자동화 계획 |

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 1.0
