---
id: intro
title: v-project 문서
sidebar_position: 1
slug: /
---

# v-project 문서

v-project는 **v-platform**(재사용 가능한 플랫폼 프레임워크)과 **3개 앱**(v-channel-bridge, v-platform-template, v-platform-portal)으로 구성된 멀티 앱 시스템입니다. 인증/RBAC/감사로그 등 범용 기능을 플랫폼으로 분리하고, 앱별 고유 기능을 독립적으로 관리합니다.

---

## 빠른 시작

### 처음 사용하시나요?

1. **[사용자 가이드](user-guide/user-guide)** — 기본 사용법 및 주요 기능
2. **[아키텍처](platform/developer-guide/architecture)** — 시스템 구조 이해

### 관리자이신가요?

1. **[관리자 가이드](platform/admin-guide/admin-guide)** — 시스템 관리 전체 가이드
2. **[배포 가이드](platform/admin-guide/deployment)** — Docker Compose 설치 및 운영
3. **[Slack 설정](apps/v-channel-bridge/admin-guide/slack-setup)** — Slack App 연동
4. **[Teams 설정](apps/v-channel-bridge/admin-guide/teams-setup)** — Azure Bot 연동
5. **[모니터링 설정](platform/admin-guide/monitoring-setup)** — Prometheus / Grafana / Loki
6. **[트러블슈팅](apps/v-channel-bridge/admin-guide/troubleshooting)** — 문제 해결

### 개발자이신가요?

1. **[개발 가이드](apps/v-channel-bridge/developer-guide/development)** — 개발 환경 설정 및 워크플로우
2. **[API 문서](api/api)** — REST API 레퍼런스 (18개 라우터)
3. **[테스트 가이드](apps/v-channel-bridge/developer-guide/testing-guide)** — 테스트 작성 및 실행

---

## 문서 구조

```
docs/
├── intro.md                          # 이 파일 (문서 인덱스)
├── platform/                         # 플랫폼(v-platform) 문서
│   ├── admin-guide/                  #   관리자 가이드 (5개)
│   ├── developer-guide/              #   개발자 가이드 (6개)
│   └── design/                       #   플랫폼 설계 문서 (16개)
├── apps/                             # 앱별 문서
│   ├── v-channel-bridge/             #   채널 브리지 앱
│   │   ├── admin-guide/              #     연동 설정 (3개)
│   │   ├── developer-guide/          #     개발 가이드 (5개)
│   │   └── design/                   #     앱 설계 문서 (9개)
│   └── v-platform-template/          #   템플릿 앱
│       └── getting-started.md
├── design/                           # 공유 설계 문서 (5개)
├── api/                              # API 레퍼런스
│   └── API.md
├── user-guide/                       # 사용자 가이드
│   └── USER_GUIDE.md
└── tech-portfolio/                   # 기술 포트폴리오 (4개)
```

---

## 주요 문서

### 시스템 이해

| 문서 | 설명 |
|------|------|
| [아키텍처](platform/developer-guide/architecture) | v-platform Provider Pattern 기반 시스템 구조 |
| [API 문서](api/api) | 전체 REST API 및 WebSocket API 레퍼런스 |
| [디자인 시스템](platform/developer-guide/design-system) | UI/UX 디자인 시스템 가이드 |

### 설치 및 운영

| 문서 | 설명 |
|------|------|
| [배포 가이드](platform/admin-guide/deployment) | Docker Compose 기반 설치·배포 |
| [Slack 설정](apps/v-channel-bridge/admin-guide/slack-setup) | Slack App 생성 및 Socket Mode 연동 |
| [Teams 설정](apps/v-channel-bridge/admin-guide/teams-setup) | Azure Bot 등록 및 Graph API 연동 |
| [모니터링 설정](platform/admin-guide/monitoring-setup) | Prometheus, Grafana, Loki 설정 |
| [이메일 설정](platform/admin-guide/email-setup) | SMTP 설정 (비밀번호 재설정용) |
| [SSL/TLS 설정](platform/admin-guide/ssl-tls-setup) | SSL/TLS 인증서 설정 |

### 개발

| 문서 | 설명 |
|------|------|
| [개발 가이드](apps/v-channel-bridge/developer-guide/development) | 개발 환경 설정 및 워크플로우 |
| [테스트 가이드](apps/v-channel-bridge/developer-guide/testing-guide) | 테스트 작성 및 실행 |
| [페이지 레이아웃](platform/developer-guide/page-layout-guide) | 프론트엔드 페이지 레이아웃 규칙 |

### 설계 문서

설계 문서는 `platform/design/`, `apps/*/design/`, `design/` 디렉토리에 분리되어 있습니다. 주요 설계 문서:

| 문서 | 설명 |
|------|------|
| [플랫폼/앱 분리 아키텍처](platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE) | v-platform / v-channel-bridge 분리 설계 |
| [마이그레이션 계획](platform/design/V_PROJECT_MIGRATION_PLAN) | Phase 0~5 마이그레이션 완료 기록 |
| [멀티앱 데이터 격리](platform/design/MULTI_APP_DATA_ISOLATION) | app_id 기반 데이터 격리 설계 |
| [포털 설계](platform/design/V_PLATFORM_PORTAL_DESIGN) | 앱 포털, SSO Relay, 앱 관리 CRUD |
| [알림 시스템](platform/design/NOTIFICATION_AND_MESSAGING_SYSTEM) | 알림 및 메시징 시스템 설계 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Python 3.11 / FastAPI / Pydantic / Structlog |
| Frontend | React 18 / TypeScript 5 / Vite / Tailwind CSS / Zustand / TanStack Query |
| Database | PostgreSQL 16 |
| Cache/Routing | Redis 7 |
| Infrastructure | Docker Compose |
| Monitoring | Prometheus / Grafana / Loki / Promtail |
| Auth | JWT (python-jose) / bcrypt |

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0.0
**아키텍처**: Light-Zowe Provider Pattern
