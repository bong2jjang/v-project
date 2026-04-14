---
id: development-readiness
title: 프로덕션 준비도 체크리스트
sidebar_position: 2
tags: [production, readiness, tech-portfolio, platform]
---

# 프로덕션 준비도 체크리스트

이 문서는 v-project의 프로덕션 투입 가능 수준을 기능 완성도, 운영 인프라, 보안, 성능/안정성, 잔여 과제 다섯 축으로 점검한다. 각 항목은 실제 코드 경로와 설정 파일을 근거로 하며, 상태를 "완료 / 부분 / 미착수"로 구분한다.

---

## 1. 기능 완성도

### 1.1 플랫폼 핵심 기능

| 영역 | 상태 | 근거 (파일/경로) |
|------|------|-----------------|
| 인증 (로그인/JWT/비밀번호 재설정) | 완료 | `platform/backend/v_platform/api/auth.py`, `services/token_service.py`, `services/password_reset_service.py` |
| RBAC (3단계 역할 + 권한 그룹 + 사용자 오버라이드) | 완료 | `api/permissions.py`, `api/permission_groups.py`, `services/permission_service.py`, `models/user_permission.py` |
| SSO (Microsoft Azure AD + 범용 OIDC) | 완료 | `api/auth_microsoft.py`, `api/auth_sso.py`, `sso/microsoft.py`, `sso/generic_oidc.py`, `sso/registry.py` |
| 감사 로그 (27+ 액션 타입, app_id 격리) | 완료 | `api/audit_logs.py`, `models/audit_log.py`, `utils/audit_logger.py` |
| 사용자/조직 관리 | 완료 | `api/users.py`, `api/organizations.py`, `models/user.py`, `models/company.py`, `models/department.py` |
| 메뉴 관리 (app_id 기반 필터링) | 완료 | `api/menus.py`, `models/menu_item.py`, 마이그레이션 `p015_multi_app_isolation.py` |
| 알림 시스템 (시스템/앱 알림 + 배너 + WebSocket 푸시) | 완료 | `api/notifications.py`, `api/persistent_notifications.py`, `services/notification_service.py`, `models/notification.py` |
| 시스템 설정 (브랜딩/SMTP/보안) | 완료 | `api/system_settings.py`, `models/system_settings.py`, 마이그레이션 `p016_app_branding_settings.py` |
| OAuth 연동 (Microsoft/Google/GitHub) | 완료 | `api/user_oauth.py`, `models/user_oauth_token.py` |
| 세션/디바이스 관리 | 완료 | `models/refresh_token.py`, `services/token_service.py` |
| 파일 업로드 | 완료 | `api/uploads.py` |
| WebSocket 실시간 통신 | 완료 | `api/websocket.py`, `services/websocket_manager.py`, `services/event_broadcaster.py` |

### 1.2 앱 기능 -- v-channel-bridge

| 영역 | 상태 | 근거 |
|------|------|------|
| Slack Provider (Socket Mode) | 완료 | `apps/v-channel-bridge/backend/app/adapters/slack_provider.py` |
| Teams Provider (Bot Framework + Graph API) | 완료 (코드) | `adapters/teams_provider.py` -- Azure Bot 등록 후 실 테스트 필요 |
| Redis 동적 라우팅 | 완료 | `services/route_manager.py` |
| 양방향 메시지 브리지 | 완료 | `services/websocket_bridge.py` |
| 메시지 검색/내보내기 | 완료 | `api/messages.py` |
| 첨부파일 처리 | 완료 | `services/attachment_handler.py` |
| 커맨드 프로세서 (/vms) | 완료 | `services/command_processor.py` |
| 메시지 큐 (재시도/배치) | 완료 | `services/message_queue.py` |

### 1.3 앱 기능 -- v-platform-portal

| 영역 | 상태 | 근거 |
|------|------|------|
| AppRegistry CRUD | 완료 | `apps/v-platform-portal/backend/app/api/portal.py`, `services/app_registry.py` |
| Token Relay SSO (포털 -> 앱 JWT 인계) | 완료 | 공유 SECRET_KEY 기반, 1회성 relay_token (Redis TTL) |
| 앱 런처 UI (타일 그리드) | 완료 | `apps/v-platform-portal/frontend/src/pages/Portal.tsx` |
| 앱 관리 Admin UI | 완료 | `pages/admin/AppManagement.tsx` |

### 1.4 프론트엔드 완성도

| 영역 | 수량 | 상태 |
|------|------|------|
| 플랫폼 페이지 (`@v-platform/core`) | 18개 (13 top-level + 5 admin) | 완료 |
| Zustand 스토어 | 6개 (auth, permission, notification, systemSettings, sessionSettings, user-oauth) | 완료 |
| 커스텀 훅 | 13개 (useTheme, useWebSocket, useNotifications 등) | 완료 |
| 공통 컴포넌트 | 63개 .tsx (ui 24, layout 9, settings 5, admin 7, auth 2, notifications 6, profile 2, oauth 3, common 2, root-level 3) | 완료 |
| 디자인 시스템 (시맨틱 토큰 + 다크/라이트) | CSS 변수 체계 | 완료 |
| Product Tour (Driver.js 기반 앱별 맞춤) | 각 앱 useTour 훅 | 완료 |

### 1.5 데이터 마이그레이션

| 범위 | 수량 | 주요 내용 |
|------|------|----------|
| 플랫폼 마이그레이션 | 26개 (p001 ~ p026) | RBAC, SSO, 조직, 알림, app_id 격리(p015), 브랜딩(p016), 권한 그룹 앱별 유니크(p018~p019), 알림 확장(p020~p023), 127.0.0.1 전환(p024), refresh_token app_id(p025), 브랜딩 시드(p026) |
| 실행 방식 | 순차 적용 | `init_db()` 호출 시 자동 실행 (`platform/backend/v_platform/core/database.py`) |

### 1.6 문서 완성도

| 문서 종류 | 위치 | 상태 |
|----------|------|------|
| 기술 포트폴리오 | `docusaurus/docs/tech-portfolio/` | 완료 |
| 관리자 가이드 | `docusaurus/docs/platform/admin-guide/` | 완료 |
| 개발자 가이드 | `docusaurus/docs/platform/developer-guide/` | 완료 |
| 설계 문서 | `docusaurus/docs/platform/design/` | 완료 |
| API 레퍼런스 | `docusaurus/docs/api/` | 완료 |
| 사용자 가이드 | `docusaurus/docs/user-guide/` | 완료 |

---

## 2. 운영 인프라 준비도

### 2.1 컨테이너화

| 항목 | 상태 | 근거 |
|------|------|------|
| Docker Compose 통합 구성 | 완료 | `docker-compose.yml` -- 프로필 지원 (default, template, portal, docs) |
| 멀티 스테이지 빌드 | 완료 | 각 앱/플랫폼 Dockerfile |
| 프로필 기반 선택적 기동 | 완료 | `--profile template`, `--profile portal`, `--profile docs` |
| 서비스 의존성 정의 | 완료 | `depends_on` + healthcheck 조건 |
| 볼륨 영속화 | 완료 | PostgreSQL, Redis 데이터 볼륨 |

프로필별 기동 명령:

| 프로필 | 명령 | 포함 서비스 |
|--------|------|-----------|
| 기본 | `docker compose up -d --build` | v-channel-bridge (backend/frontend), PostgreSQL, Redis, MailHog |
| template | `docker compose --profile template up -d --build` | 기본 + v-platform-template |
| portal | `docker compose --profile portal up -d --build` | 기본 + v-platform-portal |
| 전체 | `docker compose --profile template --profile portal up -d --build` | 모든 앱 |

### 2.2 모니터링

| 항목 | 상태 | 근거 |
|------|------|------|
| Prometheus 메트릭 수집 | 완료 | `monitoring/prometheus/prometheus.yml` -- 15초 주기, 4개 Job |
| Alertmanager 규칙 | 완료 | `monitoring/prometheus/alerts.yml` -- 서비스 5종 + 인프라 5종 알림 규칙 |
| Grafana 대시보드 프로비저닝 | 완료 | `monitoring/grafana/dashboards/`, `provisioning/` |
| 앱 `/metrics` 엔드포인트 | 완료 | `platform/backend/v_platform/api/metrics.py`, `middleware/metrics.py` |
| `/api/health` 헬스 집계 | 완료 | `api/health.py` -- Backend, DB, Redis 상태 통합 리포트 |
| cAdvisor (컨테이너 메트릭) | 완료 | docker-compose 서비스 정의 |
| Node Exporter (호스트 메트릭) | 완료 | docker-compose 서비스 정의 |

Prometheus 수집 대상:

| Job | 대상 | 수집 주기 |
|-----|------|----------|
| v-platform-backend | 각 앱 Backend `:8000`, `:8002`, `:8080` `/metrics` | 15초 |
| prometheus | Prometheus 자체 메트릭 | 15초 |
| cadvisor | 컨테이너 CPU/메모리/네트워크 | 15초 |
| node_exporter | 호스트 시스템 메트릭 | 15초 |

알림 규칙 요약:

| 알림 이름 | 심각도 | 조건 | 지속 시간 |
|----------|--------|------|----------|
| VMSBackendDown | CRITICAL | 백엔드 응답 없음 | 1분 |
| VMSHighErrorRate | CRITICAL | 5xx 에러율 > 5% | 5분 |
| VMSSlowResponse | WARNING | P95 응답시간 > 2초 | 5분 |
| VMSBridgeHighMessageFailure | WARNING | 메시지 실패 > 0.1/s | 2분 |
| ContainerHighCPU | WARNING | CPU > 80% | 5분 |
| ContainerHighMemory | WARNING | Memory > 512MB | 5분 |
| ContainerRestarting | WARNING | 재시작 > 3회/h | 즉시 |
| HostDiskSpaceLow | CRITICAL | 디스크 여유 < 10% | 5분 |
| HostHighCPU | WARNING | CPU > 85% | 10분 |

### 2.3 로그 중앙화

| 항목 | 상태 | 근거 |
|------|------|------|
| structlog JSON 로깅 | 완료 | `platform/backend/v_platform/core/logging.py` -- `configure_platform_logging()` |
| Promtail Docker SD 수집 | 완료 | `monitoring/promtail/promtail-config.yml` -- Docker 컨테이너 자동 탐색 |
| Loki 저장 (30일 보존, TSDB) | 완료 | `monitoring/loki/loki-config.yml` |
| Grafana Loki 데이터 소스 | 완료 | `monitoring/grafana/provisioning/` |
| app 라벨 자동 주입 | 완료 | Promtail Docker SD 라벨 매핑 -- 앱별 `app` 라벨 자동 태깅 |
| 크로스 앱 LogQL 쿼리 | 완료 | LogQL `\{app=~"v-.*"\}` 형태로 전 앱 로그 단일 조회 (파이프라인: json → user_id 필터) |

### 2.4 백업/복원

| 항목 | 상태 | 비고 |
|------|------|------|
| PostgreSQL 볼륨 영속화 | 완료 | Docker 명명 볼륨 |
| Redis AOF 영속화 | 완료 | appendonly 설정 |
| 시스템 설정 백업/복원 API | 완료 | Settings 페이지 "백업" 탭 |
| 마이그레이션 멱등성 | 완료 | 각 마이그레이션에 `IF NOT EXISTS` / `IF EXISTS` 가드 |
| 자동 백업 스케줄링 | 미착수 | pg_dump 크론잡 구성 필요 |

### 2.5 마이그레이션 운영

마이그레이션은 `PlatformApp.init_platform()` 호출 시 `init_db()` -> `run_migrations()` 순서로 자동 실행된다.

| 특성 | 설명 |
|------|------|
| 실행 시점 | 앱 startup lifespan 내 `platform.init_platform()` |
| 실행 순서 | p001 ~ p026 파일명 순 |
| 멱등 보장 | SQL 내부 `IF NOT EXISTS` 가드 + `platform_migrations` 테이블 추적 |
| 롤백 | 수동 (역방향 마이그레이션 미구현 -- 잔여 과제) |

---

## 3. 보안 점검

### 3.1 인증/인가

| 항목 | 상태 | 구현 |
|------|------|------|
| JWT 서명 (python-jose + HS256) | 완료 | `platform/backend/v_platform/utils/auth.py` -- SECRET_KEY 환경변수 기반 |
| Access Token + Refresh Token 이중 체계 | 완료 | Access 15분, Refresh 7일, `models/refresh_token.py` |
| 토큰 자동 갱신 (프론트엔드) | 완료 | Axios 인터셉터 401 감지 -> 갱신 큐잉 (race condition 방지) |
| RBAC 3단계 | 완료 | SYSTEM_ADMIN / ORG_ADMIN / USER + 권한 그룹 + 사용자별 오버라이드 |
| 서버 기반 메뉴 필터링 | 완료 | `GET /api/menus/sidebar?app_id=xxx` -- 역할/권한 결과만 반환 |
| 비밀번호 해싱 (bcrypt) | 완료 | `utils/auth.py` -- bcrypt.hashpw() |
| 비밀번호 재설정 (토큰 + 이메일) | 완료 | `services/password_reset_service.py`, `models/password_reset_token.py` |

### 3.2 CSRF 방어

| 항목 | 상태 | 구현 |
|------|------|------|
| CSRF 미들웨어 | 완료 | `platform/backend/v_platform/middleware/csrf.py` |
| X-CSRF-Token 헤더 자동 첨부 | 완료 | 프론트엔드 Axios 인터셉터에서 요청마다 헤더 삽입 |
| Safe Method 면제 | 완료 | GET, HEAD, OPTIONS 면제 |

### 3.3 데이터 격리

| 항목 | 상태 | 구현 |
|------|------|------|
| app_id 기반 멀티 앱 격리 | 완료 | 마이그레이션 `p015_multi_app_isolation.py` -- menu_items, audit_logs, system_settings, notifications 테이블에 `app_id` 컬럼 추가 |
| API 레벨 app_id 필터링 | 완료 | `request.app.state.app_id` 기반 쿼리 필터 자동 적용 |
| 크로스 앱 데이터 접근 차단 | 완료 | 각 앱은 자신의 app_id 데이터만 조회/수정 가능 |

### 3.4 감사 추적

| 항목 | 상태 | 구현 |
|------|------|------|
| 감사 로그 자동 기록 | 완료 | `utils/audit_logger.py` -- `@audit_log` 데코레이터 |
| 27+ 감사 액션 타입 | 완료 | 로그인, 로그아웃, 권한 변경, 사용자 생성/수정/삭제, 설정 변경 등 |
| 감사 로그 app_id 격리 | 완료 | `models/audit_log.py` -- `app_id` 컬럼 |
| 감사 로그 내보내기 (CSV/JSON) | 완료 | `services/export_service.py` |
| 감사 로그 필터링 UI | 완료 | AuditLogs 페이지 -- 날짜/사용자/액션/앱 필터 |

### 3.5 암호화/민감 정보

| 항목 | 상태 | 구현 |
|------|------|------|
| 암호화 유틸리티 | 완료 | `platform/backend/v_platform/utils/encryption.py` |
| 환경변수 기반 비밀 관리 | 완료 | `.env` 파일 (Git 미추적), SECRET_KEY, DB URL, API 키 |
| Provider 상태 조회 시 토큰 마스킹 | 완료 | `BasePlatformProvider.get_status()` -- token/password 키 `***` 치환 |

### 3.6 보안 잔여 과제

| 항목 | 상태 | 설명 |
|------|------|------|
| pip-audit 자동화 | 미착수 | Python 의존성 CVE 스캔 |
| npm audit 자동화 | 미착수 | Node.js 의존성 CVE 스캔 |
| Trivy 컨테이너 이미지 스캔 | 미착수 | Docker 이미지 취약점 분석 |
| Rate Limiting 세분화 | 부분 | slowapi 글로벌 적용 완료, 엔드포인트별 세밀 조정 가능 |
| HTTPS 강제 | 미착수 | 프로덕션 배포 시 리버스 프록시(Nginx/Traefik) 필요 |
| Content Security Policy | 미착수 | CSP 헤더 설정 필요 |

---

## 4. 성능/안정성

### 4.1 캐싱

| 항목 | 상태 | 구현 |
|------|------|------|
| Redis 캐시 서비스 | 완료 | `platform/backend/v_platform/services/cache_service.py` -- TTL 기반 키-값 캐시 |
| Route Manager Redis 저장 | 완료 | `apps/v-channel-bridge/backend/app/services/route_manager.py` -- SMEMBERS/HGETALL 기반 라우팅 테이블 |
| Slack 사용자 이름 캐싱 | 완료 | SlackProvider 내 `users.info` 결과 메모리 캐시 |
| TanStack Query 클라이언트 캐싱 | 완료 | 프론트엔드 API 응답 자동 캐시 + stale-while-revalidate |

### 4.2 비동기 처리

| 항목 | 상태 | 구현 |
|------|------|------|
| FastAPI async/await 전면 적용 | 완료 | 모든 I/O 바운드 엔드포인트 비동기 |
| asyncio 기반 메시지 큐 | 완료 | `services/message_queue.py` -- 배치 처리 + 재시도 |
| WebSocket 비동기 브로드캐스트 | 완료 | `services/event_broadcaster.py` -- 이벤트 팬아웃 |
| Slack Socket Mode 비동기 수신 | 완료 | `adapters/slack_provider.py` |

### 4.3 WebSocket 안정성

| 항목 | 상태 | 구현 |
|------|------|------|
| WebSocket 연결 관리 | 완료 | `services/websocket_manager.py` (플랫폼), `services/websocket_manager.py` (앱) |
| 자동 재연결 (프론트엔드) | 완료 | `useWebSocket` 훅 -- 지수 백오프 재연결 |
| 연결 상태 UI 표시 | 완료 | `ConnectionStatus` 컴포넌트 |

### 4.4 에러 처리

| 항목 | 상태 | 구현 |
|------|------|------|
| 전역 예외 핸들러 | 완료 | `platform/backend/v_platform/core/exceptions.py` |
| 구조화 에러 응답 | 완료 | HTTP 상태 코드 + JSON 에러 본문 |
| 프론트엔드 에러 추상화 | 완료 | `useApiErrorHandler` 훅 -- 에러 분류 + 토스트 알림 |
| Docker 컨테이너 자동 재시작 | 완료 | `restart: unless-stopped` 정책 |

### 4.5 Rate Limiting

| 항목 | 상태 | 구현 |
|------|------|------|
| 글로벌 Rate Limiter | 완료 | `PlatformApp._setup_rate_limiter()` -- slowapi 기반, IP 단위 |
| 429 응답 자동 처리 | 완료 | `_rate_limit_exceeded_handler` 등록 |

---

## 5. 코드 품질 거버넌스

### 5.1 린트/포맷팅 도구

| 도구 | 대상 | 역할 |
|------|------|------|
| ruff (check + format) | Python | 린트 + 자동수정 + Black 호환 포맷팅 |
| ESLint + @typescript-eslint | TypeScript | 정적 분석 |
| Prettier | TypeScript/CSS/JSON | 코드 포맷팅 |
| Pydantic v2 | Python 런타임 | API 요청/응답 스키마 검증 |
| TypeScript strict mode | TypeScript 컴파일 | 정적 타입 검사 |

필수 워크플로우 (`CLAUDE.md` 강제):

```bash
# Python 수정 후
cd apps/{app-name}/backend && python -m ruff check --fix . && python -m ruff format .

# TypeScript 수정 후
cd apps/{app-name}/frontend && npm run lint:fix && npm run format
```

### 5.2 테스트 체계

| 영역 | 도구 | 위치 |
|------|------|------|
| Backend 단위 테스트 | pytest + pytest-asyncio | `platform/backend/tests/`, `apps/*/backend/tests/` |
| Frontend 컴포넌트 테스트 | Vitest + React Testing Library | `*/frontend/src/**/*.test.tsx` |
| API 통합 테스트 | httpx (Docker 네트워크) | 테스트 컨테이너 내 실행 |
| E2E 테스트 | 수동 (curl / Postman) | 자동화 미착수 |

### 5.3 CLAUDE.md 거버넌스

`CLAUDE.md`는 AI Agent와 인간 개발자 모두에게 적용되는 프로젝트 규칙 파일이다.

| 규칙 | 목적 |
|------|------|
| Docker 전용 실행 (로컬 npm/pip 금지) | Node.js v24(로컬) vs v18(Docker) 버전 불일치 방지 |
| Provider는 `BasePlatformProvider` 상속 필수 | 어댑터 계약 일관성 |
| 메시지는 `CommonMessage`로 변환 필수 | 플랫폼 중립 메시지 표준 유지 |
| `git push`는 명시적 요청 시에만 | 의도치 않은 원격 변경 방지 |
| 커밋 메시지 `<type>(<scope>): <subject>` | 이력 추적 일관성 |

---

## 6. 잔여 과제

아래는 프로덕션 배포 전 완료가 필요하거나 권장되는 항목이다.

### 6.1 필수 (프로덕션 배포 전)

| 항목 | 현재 상태 | 필요 작업 | 우선순위 |
|------|----------|----------|---------|
| Teams Provider Azure 등록 | 코드 완성, Azure Bot 미등록 | Azure Portal에서 Bot Services 등록 -> App ID/Password 설정 -> `ChannelMessage.Read.All`, `ChannelMessage.Send`, `Team.ReadBasic.All` 권한 부여 | 높음 |
| HTTPS 구성 | 미착수 | 리버스 프록시 (Nginx 또는 Traefik) + TLS 인증서 | 높음 |
| 자동 백업 | 미착수 | pg_dump 크론잡 + S3/NFS 저장소 | 높음 |
| 마이그레이션 롤백 체계 | 순방향만 구현 | 역방향 마이그레이션 스크립트 작성 또는 스냅샷 기반 복원 | 중간 |

### 6.2 권장 (운영 품질 향상)

| 항목 | 현재 상태 | 필요 작업 | 우선순위 |
|------|----------|----------|---------|
| CI/CD 파이프라인 | 미착수 | GitHub Actions: build -> lint -> type-check -> test -> security scan -> image push | 높음 |
| E2E 테스트 자동화 | 수동 | Playwright 도입 | 중간 |
| 테스트 커버리지 80%+ | 단위 테스트 존재, 커버리지 미측정 | pytest-cov + Vitest coverage 리포트 | 중간 |
| 보안 스캔 자동화 | 수동 | pip-audit + npm audit + Trivy CI 단계 추가 | 중간 |
| CSP 헤더 | 미착수 | Content-Security-Policy 미들웨어 | 낮음 |
| Rate Limiting 세분화 | 글로벌만 적용 | 엔드포인트별 (로그인, API 키 발급 등) 차등 제한 | 낮음 |

### 6.3 장기 개선

| 항목 | 설명 |
|------|------|
| Kubernetes 전환 | Docker Compose -> Helm Chart + HPA 수평 확장 |
| 메시지 브로커 분리 | asyncio 내장 큐 -> RabbitMQ 또는 Kafka |
| Read Replica | PostgreSQL Streaming Replication + PgBouncer |
| Loki 분산 모드 | 단일 인스턴스 -> S3 백엔드 + Compactor |

---

## 7. 준비도 요약

| 영역 | 상태 | 점수 |
|------|------|------|
| 플랫폼 핵심 기능 (인증/RBAC/감사/SSO/알림) | 완료 | 10/10 |
| 앱 기능 (v-channel-bridge, v-platform-portal) | 완료 (Teams 실 테스트 제외) | 9/10 |
| 프론트엔드 (18 페이지, 63 컴포넌트, 13 훅) | 완료 | 10/10 |
| 데이터 격리 (app_id, 26 마이그레이션) | 완료 | 10/10 |
| 모니터링 (Prometheus + Loki + Grafana + 알림 규칙) | 완료 | 9/10 |
| 보안 (JWT, CSRF, bcrypt, 감사로그, 마스킹) | 완료 (스캔 자동화 제외) | 8/10 |
| 성능/안정성 (캐시, 비동기, WebSocket, Rate Limit) | 완료 | 8/10 |
| 코드 품질 (린트, 타입, 테스트 존재) | 완료 (커버리지 목표 미달) | 7/10 |
| 운영 자동화 (CI/CD, E2E, 백업) | 미착수~부분 | 4/10 |
| **종합** | **코어 기능 프로덕션 준비 완료, 운영 자동화 과제 잔존** | **85/100** |

핵심 기능과 보안/모니터링은 프로덕션 수준에 도달해 있다. 남은 과제는 CI/CD 파이프라인, E2E 테스트 자동화, 보안 스캔 자동화, HTTPS 구성 등 운영 자동화 영역에 집중되어 있으며, 이는 배포 환경 확정 후 단계적으로 해결 가능하다.

---

**최종 업데이트**: 2026-04-13
**문서 버전**: 3.0 (프로덕션 준비도 체크리스트 체계로 전면 재구성)
