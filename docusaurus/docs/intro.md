---
sidebar_position: 1
slug: /
---

# v-project 문서

v-project에 오신 것을 환영합니다! 이 문서 사이트에서는 v-project의 모든 기능을 쉽고 빠르게 이해할 수 있도록 안내합니다.

---

## v-project는 무엇인가요?

v-project는 **엔터프라이즈 웹 애플리케이션을 빠르게 만들기 위한 플랫폼 프레임워크**입니다. 사내 시스템을 새로 만들 때마다 로그인, 권한, 감사 로그, 알림 같은 기능을 반복해서 개발하고 계신가요? v-project는 이런 공통 기능을 **v-platform**이라는 재사용 가능한 프레임워크에 모아두고, 각 앱은 고유한 비즈니스 로직에만 집중할 수 있는 구조를 제공합니다.

한마디로 정리하면, v-project = **v-platform(공통 기반)** + **앱(업무별 기능)** 입니다.

```
┌─────────────────────────────────────────────────────────────┐
│                       v-project 모노레포                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              v-platform (공통 프레임워크)                │  │
│  │  인증/JWT/SSO │ RBAC 권한 │ 조직도 │ 감사 로그        │  │
│  │  알림 시스템   │ UI Kit    │ 동적 메뉴 │ Product Tour  │  │
│  └──────────┬──────────┬──────────────┬─────────────────┘  │
│             │          │              │                      │
│  ┌──────────▼──┐ ┌─────▼──────┐ ┌────▼─────────────┐       │
│  │v-channel-   │ │v-platform- │ │v-platform-       │       │
│  │bridge       │ │template    │ │portal            │       │
│  │(메시지 브리지)│ │(앱 템플릿)  │ │(통합 앱 포털)     │       │
│  └─────────────┘ └────────────┘ └──────────────────┘       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              인프라 (Docker Compose)                    │  │
│  │       PostgreSQL 16  │  Redis 7  │  MailHog            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

v-platform이 제공하는 주요 공통 기능은 다음과 같습니다.

| 기능 | 설명 |
|------|------|
| **인증** | 이메일/비밀번호 로그인, JWT(로그인 인증 토큰) 기반 세션, Microsoft SSO, OIDC 연동 |
| **RBAC 권한 관리** | 역할(Role)과 권한 그룹을 통한 세밀한 접근 제어 |
| **조직도** | 부서/팀 구조 관리 및 조회 |
| **감사 로그** | 누가, 언제, 무엇을 했는지 자동 기록 |
| **알림 시스템** | 실시간 토스트 알림, 상단 배너 공지, 시스템/앱 알림 분리 |
| **UI Kit** | 다크/라이트 테마, 반응형 레이아웃, 동적 메뉴 |
| **Product Tour** | Driver.js 기반의 앱별 맞춤 인터랙티브 가이드 |
| **앱별 데이터 격리** | app_id 기반으로 메뉴, 감사 로그, 설정을 앱별로 분리 |

---

## 앱 소개

v-project에는 현재 3개의 앱이 포함되어 있습니다. 각 앱은 v-platform 위에서 동작하며, 플랫폼의 인증/권한/알림 등을 그대로 활용합니다.

### v-channel-bridge --- Slack과 Teams를 잇는 메시지 브리지

Slack과 Microsoft Teams 채널 사이에서 메시지를 **실시간으로 양방향 전달**하는 앱입니다. 조직에서 두 메신저를 동시에 사용할 때, 같은 내용을 양쪽에 수동으로 옮겨야 하는 불편함을 해결합니다.

- 텍스트, 파일, 인라인 이미지를 양방향으로 전송합니다
- 채널 간 라우팅 규칙을 웹 UI에서 즉시 추가하거나 삭제할 수 있습니다
- 메시지 히스토리를 검색하고, CSV/JSON으로 내보낼 수 있습니다
- 전송 현황을 대시보드에서 한눈에 파악할 수 있습니다

> **누가 사용하나요?** Slack과 Teams를 병행하는 조직의 운영팀, 커뮤니케이션 담당자, 그리고 크로스 플랫폼 메시지 흐름을 모니터링해야 하는 관리자가 주로 사용합니다.

| 항목 | 값 |
|------|-----|
| Frontend 주소 | `http://127.0.0.1:5173` |
| Backend 포트 | 8000 |
| 상세 문서 | [Slack 설정](apps/v-channel-bridge/admin-guide/slack-setup), [Teams 설정](apps/v-channel-bridge/admin-guide/teams-setup), [트러블슈팅](apps/v-channel-bridge/admin-guide/troubleshooting) |

### v-platform-template --- 새 앱을 빠르게 만드는 스캐폴딩 템플릿

v-platform 위에 새 앱을 만들 때 사용하는 **출발점 템플릿**입니다. 약 30줄의 최소 코드만으로 인증, 권한, 메뉴, 알림이 모두 연결된 앱이 완성됩니다. 새 비즈니스 앱을 추가할 때 이 템플릿을 복사해서 시작하면 됩니다.

- PlatformApp 최소 구성으로 즉시 동작합니다
- 앱별 맞춤 Product Tour와 도움말이 기본 포함되어 있습니다
- 새로운 앱 개발을 시작하기 위한 표준 출발점입니다

> **누가 사용하나요?** v-platform 위에 새로운 사내 앱을 개발하려는 개발자가 사용합니다. 이 템플릿을 기반으로 비즈니스 로직만 추가하면 됩니다.

| 항목 | 값 |
|------|-----|
| Frontend 주소 | `http://127.0.0.1:5174` |
| Backend 포트 | 8002 |
| 상세 문서 | [시작하기](apps/v-platform-template/getting-started) |

### v-platform-portal --- 모든 앱을 한 곳에서 관리하는 통합 포털

여러 앱을 하나의 포털에서 관리하고, **한 번의 로그인으로 모든 앱에 자동 접속**(Token Relay SSO)할 수 있는 통합 런처입니다. 포털에서 앱 카드를 클릭하면 재로그인 없이 해당 앱으로 바로 이동합니다.

- 등록된 앱들을 카드 UI로 한눈에 확인하고 바로가기할 수 있습니다
- Token Relay SSO로 앱 간 재로그인이 필요 없습니다
- 관리자는 앱 등록/수정/삭제를 포털 UI에서 직접 관리합니다
- 사이트맵과 앱별 상태 모니터링 기능을 제공합니다

> **누가 사용하나요?** 여러 v-project 앱을 사용하는 모든 직원이 포털을 통해 앱에 접근합니다. 앱 등록/관리는 시스템 관리자가 담당합니다.

| 항목 | 값 |
|------|-----|
| Frontend 주소 | `http://127.0.0.1:5180` |
| Backend 포트 | 8080 |
| 상세 문서 | [포털 설계](platform/design/V_PLATFORM_PORTAL_DESIGN) |

---

## 문서 탐색 가이드

어떤 역할이냐에 따라 시작하면 좋은 문서가 다릅니다. 아래 안내를 참고하여 본인에게 맞는 문서부터 읽어보세요.

### 일반 사용자라면

시스템에 처음 접속하셨거나, 로그인/프로필/알림 같은 일상 기능을 알고 싶다면 사용자 가이드부터 시작하세요.

- **[사용자 가이드](user-guide/user-guide)** --- 로그인, 프로필 관리, 알림 확인, 앱 전환, Product Tour 등 일상 업무에 필요한 모든 것을 시나리오 기반으로 안내합니다.

### 시스템 관리자라면

사용자 관리, 권한 설정, 시스템 설정, 배포, 모니터링을 담당하신다면 관리자 가이드를 참고하세요.

- **[관리자 가이드](platform/admin-guide/admin-guide)** --- 사용자/권한 그룹/역할 관리 전체 가이드
- **[배포 가이드](platform/admin-guide/deployment)** --- Docker Compose 기반 설치 및 운영
- **[모니터링 설정](platform/admin-guide/monitoring-setup)** --- Prometheus / Grafana / Loki 구성
- **[이메일 설정](platform/admin-guide/email-setup)** --- SMTP 설정 (비밀번호 재설정 메일 발송용)
- **[SSL/TLS 설정](platform/admin-guide/ssl-tls-setup)** --- HTTPS 인증서 구성

### 개발자라면

새 앱을 만들거나, 기존 앱을 수정하거나, API를 연동하려면 개발자 가이드를 참고하세요.

- **[개발 가이드](apps/v-channel-bridge/developer-guide/development)** --- 개발 환경 설정 및 워크플로우
- **[아키텍처](platform/developer-guide/architecture)** --- 시스템 구조와 PlatformApp 패턴 이해
- **[API 문서](api/api)** --- REST API 레퍼런스 (18개 라우터)
- **[디자인 시스템](platform/developer-guide/design-system)** --- UI/UX 디자인 시스템 가이드 (다크/라이트 테마, CSS 변수)
- **[페이지 레이아웃 가이드](platform/developer-guide/page-layout-guide)** --- 프론트엔드 페이지 레이아웃 규칙
- **[테스트 가이드](apps/v-channel-bridge/developer-guide/testing-guide)** --- 테스트 작성 및 실행

### 설계 문서를 찾으신다면

시스템의 설계 배경과 구조적 결정을 이해하고 싶을 때 참고하세요.

| 문서 | 설명 |
|------|------|
| [플랫폼/앱 분리 아키텍처](platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE) | v-platform과 앱의 분리 설계 원칙 |
| [멀티앱 데이터 격리](platform/design/MULTI_APP_DATA_ISOLATION) | app_id 기반 데이터 격리 설계 |
| [포털 설계](platform/design/V_PLATFORM_PORTAL_DESIGN) | 앱 포털, SSO Relay, 앱 관리 CRUD |
| [알림 시스템](platform/design/NOTIFICATION_AND_MESSAGING_SYSTEM) | 알림 및 메시징 시스템 설계 |
| [모니터링 중앙화](platform/design/PLATFORM_MONITORING_CENTRALIZATION) | 플랫폼 모니터링 통합 설계 |

---

## 빠른 시작

v-project는 **Docker Compose**로 실행됩니다. 로컬 환경에서 npm이나 Python을 직접 설치하거나 실행할 필요가 없습니다.

:::warning 로컬 실행 금지
Node.js나 Python 패키지를 로컬에서 직접 설치하지 마세요. Docker 컨테이너 내부의 버전과 충돌이 발생할 수 있습니다. 모든 빌드와 실행은 Docker 안에서 이루어집니다.
:::

### 1단계: 기본 서비스 실행 (v-channel-bridge)

```bash
docker compose up -d --build
```

이 명령 하나로 v-platform + v-channel-bridge + PostgreSQL + Redis가 모두 시작됩니다.

### 2단계: 추가 앱 함께 실행

필요에 따라 프로필(profile)을 지정하여 추가 앱을 함께 실행할 수 있습니다.

```bash
# Template 앱 포함
docker compose --profile template up -d --build

# Portal 앱 포함
docker compose --profile portal up -d --build

# 모든 앱을 한꺼번에 실행
docker compose --profile template --profile portal up -d --build
```

### 3단계: 특정 서비스만 재빌드

코드를 수정한 뒤 특정 서비스만 다시 빌드하고 싶을 때는 서비스 이름을 지정합니다.

```bash
docker compose up -d --build v-channel-bridge-backend
docker compose up -d --build v-channel-bridge-frontend
```

### 접속 URL 안내

서비스가 정상적으로 시작되면 아래 주소로 접속할 수 있습니다.

:::note localhost 대신 127.0.0.1을 사용하세요
WSL 환경에서 `localhost`를 사용하면 IPv6 충돌로 접속이 안 될 수 있습니다. 항상 `127.0.0.1`을 사용해 주세요.
:::

| 서비스 | 접속 URL | 용도 |
|--------|----------|------|
| v-channel-bridge Frontend | `http://127.0.0.1:5173` | 메시지 브리지 앱 UI |
| v-channel-bridge Backend | `http://127.0.0.1:8000` | REST API 서버 |
| v-platform-template Frontend | `http://127.0.0.1:5174` | 템플릿 앱 UI |
| v-platform-template Backend | `http://127.0.0.1:8002` | 템플릿 API 서버 |
| v-platform-portal Frontend | `http://127.0.0.1:5180` | 앱 포털 UI |
| v-platform-portal Backend | `http://127.0.0.1:8080` | 포털 API 서버 |
| PostgreSQL | `127.0.0.1:5432` | 데이터베이스 |
| Redis | `127.0.0.1:6379` | 캐시 / 라우팅 |
| MailHog Web UI | `http://127.0.0.1:8025` | 개발용 메일 확인 |
| Docusaurus (문서) | `http://127.0.0.1:3000` | 이 문서 사이트 |

---

## 기술 스택 한눈에 보기

| 영역 | 기술 |
|------|------|
| Backend | Python 3.11 / FastAPI / Pydantic / Structlog / Uvicorn |
| Frontend | React 18 / TypeScript 5 / Vite / Tailwind CSS / Zustand / TanStack Query |
| Database | PostgreSQL 16 |
| Cache / Routing | Redis 7 |
| Infrastructure | Docker Compose |
| Monitoring | Prometheus / Grafana / Loki / Promtail |
| Auth | JWT (python-jose) / bcrypt / Microsoft SSO / OIDC |
| UI | Recharts (차트) / Lucide React (아이콘) / Driver.js (Product Tour) / Pretendard (폰트) |

---

## 지원 및 피드백

문제가 발생하거나 개선 아이디어가 있으신 경우 아래 방법을 이용해 주세요.

- **문서에서 답 찾기**: [사용자 가이드](user-guide/user-guide)의 FAQ 섹션이나 [트러블슈팅 가이드](apps/v-channel-bridge/admin-guide/troubleshooting)에서 흔한 문제의 해결 방법을 확인할 수 있습니다.
- **GitHub Issues**: 버그 리포트나 기능 요청은 프로젝트 GitHub 저장소의 Issues 탭에 등록해 주세요. 재현 절차와 함께 올려주시면 빠르게 확인할 수 있습니다.
- **시스템 관리자에게 문의**: 계정 생성, 권한 변경, SSO 연동 등 조직별 설정이 필요한 경우 소속 조직의 시스템 관리자에게 문의하세요.
- **Product Tour 활용**: 앱 내 우측 상단의 "?" 아이콘을 클릭하면 현재 페이지에 맞는 인터랙티브 가이드를 다시 볼 수 있습니다.

:::tip 문서 개선에 참여해 주세요
이 문서에서 잘못된 내용이나 부족한 설명을 발견하셨다면 GitHub Issue로 알려주세요. 작은 피드백 하나가 모든 사용자의 경험을 개선합니다.
:::

---

**최종 업데이트**: 2026-04-13
**문서 버전**: 5.0.0
