---
id: intro
title: VMS Chat Ops 문서
sidebar_position: 1
slug: /
---

# VMS Chat Ops 문서

VMS Chat Ops는 **Light-Zowe 아키텍처** 기반 Slack ↔ Microsoft Teams 양방향 메시지 브리지 시스템입니다. Provider Pattern, CommonMessage Schema, Route Manager를 통해 플랫폼 간 메시지를 실시간으로 라우팅합니다.

---

## 빠른 시작

### 처음 사용하시나요?

1. **[사용자 가이드](user-guide/user-guide)** — 기본 사용법 및 주요 기능
2. **[아키텍처](developer-guide/architecture)** — 시스템 구조 이해

### 관리자이신가요?

1. **[관리자 가이드](admin-guide/admin-guide)** — 시스템 관리 전체 가이드
2. **[배포 가이드](admin-guide/deployment)** — Docker Compose 설치 및 운영
3. **[Slack 설정](admin-guide/slack-setup)** — Slack App 연동
4. **[Teams 설정](admin-guide/teams-setup)** — Azure Bot 연동
5. **[모니터링 설정](admin-guide/monitoring-setup)** — Prometheus / Grafana / Loki
6. **[트러블슈팅](admin-guide/troubleshooting)** — 문제 해결

### 개발자이신가요?

1. **[개발 가이드](developer-guide/development)** — 개발 환경 설정 및 워크플로우
2. **[API 문서](api/api)** — REST API 레퍼런스 (16개 라우터)
3. **[테스트 가이드](developer-guide/testing-guide)** — 테스트 작성 및 실행

---

## 문서 구조

```
docs/
├── intro.md                       # 이 파일 (문서 인덱스)
├── user-guide/                    # 사용자 가이드
│   └── USER_GUIDE.md
├── admin-guide/                   # 관리자 가이드
│   ├── ADMIN_GUIDE.md             # 시스템 관리 전체 가이드
│   ├── DEPLOYMENT.md              # 설치·배포·운영
│   ├── SLACK_SETUP.md             # Slack 연동 설정
│   ├── TEAMS_SETUP.md             # Teams 연동 설정
│   ├── MONITORING_SETUP.md        # 모니터링 설정
│   ├── EMAIL_SETUP.md             # 이메일(SMTP) 설정
│   ├── SSL_TLS_SETUP.md           # SSL/TLS 인증서 설정
│   └── TROUBLESHOOTING.md         # 문제 해결
├── developer-guide/               # 개발자 가이드
│   ├── ARCHITECTURE.md            # Light-Zowe 시스템 아키텍처
│   ├── DEVELOPMENT.md             # 개발 환경 설정
│   ├── TESTING_GUIDE.md           # 테스트 가이드
│   ├── DESIGN_SYSTEM.md           # UI/UX 디자인 시스템
│   ├── PAGE_LAYOUT_GUIDE.md       # 페이지 레이아웃 가이드
│   ├── EXECUTION_PLAN.md          # 개발 실행 계획
│   ├── MIGRATION_PLAN.md          # Matterbridge→Light-Zowe 마이그레이션
│   └── ZOWE_CHAT_MIGRATION_PLAN.md
├── api/                           # API 레퍼런스
│   └── API.md
└── design/                        # 설계 문서 (15개)
    ├── ADVANCED_MESSAGE_FEATURES.md
    ├── CHAT_EXPERIENCE_IMPROVEMENT_PLAN.md
    ├── CHAT_SUPPORT.md
    ├── PLATFORM_FEATURE_PERMISSIONS_PLAN.md
    └── ... (최신 설계 문서)
```

---

## 주요 문서

### 시스템 이해

| 문서 | 설명 |
|------|------|
| [아키텍처](developer-guide/architecture) | Light-Zowe Provider Pattern 기반 시스템 구조 |
| [API 문서](api/api) | 전체 REST API 및 WebSocket API 레퍼런스 |
| [디자인 시스템](developer-guide/design-system) | UI/UX 디자인 시스템 가이드 |

### 설치 및 운영

| 문서 | 설명 |
|------|------|
| [배포 가이드](admin-guide/deployment) | Docker Compose 기반 설치·배포 |
| [Slack 설정](admin-guide/slack-setup) | Slack App 생성 및 Socket Mode 연동 |
| [Teams 설정](admin-guide/teams-setup) | Azure Bot 등록 및 Graph API 연동 |
| [모니터링 설정](admin-guide/monitoring-setup) | Prometheus, Grafana, Loki 설정 |
| [이메일 설정](admin-guide/email-setup) | SMTP 설정 (비밀번호 재설정용) |
| [SSL/TLS 설정](admin-guide/ssl-tls-setup) | SSL/TLS 인증서 설정 |

### 개발

| 문서 | 설명 |
|------|------|
| [개발 가이드](developer-guide/development) | 개발 환경 설정 및 워크플로우 |
| [테스트 가이드](developer-guide/testing-guide) | 테스트 작성 및 실행 |
| [페이지 레이아웃](developer-guide/page-layout-guide) | 프론트엔드 페이지 레이아웃 규칙 |

### 설계 문서

설계 문서는 `design/` 디렉토리에서 확인할 수 있습니다. 주요 설계 문서:

| 문서 | 설명 |
|------|------|
| [고급 메시지 기능](../design/ADVANCED_MESSAGE_FEATURES) | 스레드, 편집/삭제 알림, 리액션 전달 |
| [채팅방 지원](../design/CHAT_SUPPORT) | DM/그룹챗 라우팅 지원 |
| [플랫폼 권한 관리](../design/PLATFORM_FEATURE_PERMISSIONS_PLAN) | 플랫폼별 기능 권한 설계 |
| [메시지 레이턴시 최적화](../design/MESSAGE_LATENCY_OPTIMIZATION) | 메시지 전달 지연 최적화 |
| [통계 대시보드 개선](../design/STATISTICS_DASHBOARD_IMPROVEMENT) | 통계 대시보드 기능 개선 |

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
