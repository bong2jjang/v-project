# 문서 저장 규칙

v-project의 모든 문서는 Docusaurus 기반으로 관리합니다.

> **최종 업데이트**: 2026-04-13 · **버전**: 3.0

## 기본 원칙

1. **작업 이력은 시간순으로 기록** — 변경할 수 없는 기록
2. **설계 문서는 주제별로 구성** — 필요 시 업데이트 가능
3. **Docusaurus 프론트매터 필수** — `title`, `sidebar_position` 등
4. **블로그 루트에 직접 파일 생성 금지** — 반드시 `work-history/` 하위에 작성

---

## 문서 디렉토리 구조

```
docusaurus/
├── blog/
│   └── work-history/                # 작업 이력 (날짜순)
├── docs/
│   ├── intro.md                     # 문서 사이트 랜딩
│   ├── platform/                    # 플랫폼(v-platform) 문서
│   │   ├── admin-guide/             #   관리자 가이드
│   │   ├── developer-guide/         #   개발자 가이드
│   │   └── design/                  #   플랫폼 설계 문서
│   ├── apps/                        # 앱별 문서
│   │   ├── v-channel-bridge/        #   채널 브리지 앱
│   │   │   ├── admin-guide/
│   │   │   ├── developer-guide/
│   │   │   └── design/
│   │   └── v-platform-template/     #   템플릿 앱
│   ├── design/                      # 공유 설계 문서
│   ├── api/                         # API 레퍼런스
│   ├── user-guide/                  # 사용자 가이드
│   └── tech-portfolio/              # 기술 포트폴리오
```

---

## 1. 작업 이력 (Work History)

**위치**: `docusaurus/blog/work-history/`

**용도**: 일일 작업 내역, 기능 구현 완료, 버그 수정, 성능 개선 등 모든 개발 활동 기록

**파일명 규칙**: `YYYY-MM-DD-{kebab-case-title}.md`

**현재 파일 목록**: `docusaurus/blog/work-history/` 하위 (날짜순 블로그 포스트)

**프론트매터 템플릿**:
```markdown
---
title: {작업 제목}
date: YYYY-MM-DD
authors: [vms-team]
tags: [{태그1}, {태그2}, ...]
---

## 작업 요약

{1-2문장 요약}

<!-- truncate -->

## 주요 작업 내역

### 1. {작업 1}
...

## 파일 변경 사항
- `path/to/file.py` — 변경 설명
...
```

**태그 가이드**:

| 태그 | 용도 |
|------|------|
| `v-platform` | 플랫폼 분리 관련 |
| `provider` | Slack/Teams Provider 개발 |
| `frontend` | 프론트엔드 UI/UX 작업 |
| `backend` | 백엔드 API/서비스 작업 |
| `optimization` | 성능 최적화 |
| `bugfix` | 버그 수정 |
| `security` | 인증, 보안, 암호화 |
| `migration` | 마이그레이션 작업 |
| `docker` | Docker/인프라 관련 |
| `docs` | 문서 작업 |
| `ux` | UX 개선 |
| `claude-code` | Claude Code 관련 |

---

## 2. 설계 문서 (Design Documents)

**위치**: 범위에 따라 3곳에 분리

| 범위 | 위치 |
|------|------|
| 플랫폼 공통 | `docusaurus/docs/platform/design/` |
| 앱 전용 (v-channel-bridge) | `docusaurus/docs/apps/v-channel-bridge/design/` |
| 공유/크로스커팅 | `docusaurus/docs/design/` |

**용도**: 기능 설계, 개선 계획, 기술 검토, 아키텍처 결정

**파일명 규칙**: `{UPPER_SNAKE_CASE_TOPIC}.md`

**현재 파일 목록**:
```
platform/design/               # 플랫폼 설계 (16개)
├── APP_BRANDING_AND_CONTENT_SEPARATION.md
├── AUDIT_LOG_UX_IMPROVEMENT.md
├── CLAUDE_CODE_TOKEN_OPTIMIZATION.md
├── HYBRID_SSO_LOGIN_PLAN.md
├── MENU_GROUP_AND_TAB_LAYOUT.md
├── MODULE_BOUNDARY_MAP.md
├── MULTI_APP_DATA_ISOLATION.md
├── NOTIFICATION_AND_MESSAGING_SYSTEM.md
├── PLATFORM_APP_SEPARATION_ARCHITECTURE.md
├── PLATFORM_CONSOLIDATION_PLAN.md
├── PLATFORM_FEATURE_PERMISSIONS_PLAN.md
├── PLATFORM_MONITORING_CENTRALIZATION.md
├── RBAC_AND_CUSTOM_MENU_PLAN.md
├── SELF_CORRECTION_LOOP_REVIEW.md
├── V_PLATFORM_PORTAL_DESIGN.md
└── V_PROJECT_MIGRATION_PLAN.md

apps/v-channel-bridge/design/  # 앱 설계 (9개)
├── ADVANCED_MESSAGE_FEATURES.md
├── CHAT_EXPERIENCE_IMPROVEMENT_PLAN.md
├── CHAT_SUPPORT.md
├── ENV_VS_DATABASE_PROVIDERS.md
├── MESSAGE_HISTORY_IMPROVEMENT.md
├── MESSAGE_LATENCY_OPTIMIZATION.md
├── MONITORING_IMPROVEMENT.md
├── PHASE1_PROVIDER_UI_PLAN.md
└── REMAINING_TASKS_ROADMAP.md

design/                        # 공유 설계 (5개)
├── PNPM_WORKSPACE_MIGRATION_PLAN.md
├── STATISTICS_DASHBOARD_IMPROVEMENT.md
├── TEAMS_DELEGATED_AUTH.md
├── USER_PERMISSION_REDESIGN_PLAN.md
└── USER_PROVIDER_MANAGEMENT.md
```

**프론트매터 템플릿**:
```markdown
---
sidebar_position: {순서}
title: {제목}
---

# {제목}

**작성일**: YYYY-MM-DD
**상태**: {초안|검토중|구현중|완료|폐기}

## 개요

{문서 목적 및 배경}
...
```

**상태 관리**: 문서 상단의 `상태` 필드를 작업 진행에 따라 업데이트합니다.

---

## 3. 개발자 가이드 (Developer Guide)

**위치**: 플랫폼/앱별 분리

**용도**: 개발 환경 설정, 아키텍처 설명, 코딩 규칙, 테스트 가이드

**현재 파일 목록**:
```
platform/developer-guide/         # 플랫폼 (6개)
├── ARCHITECTURE.md               # 시스템 아키텍처
├── DESIGN_SYSTEM.md              # 프론트엔드 디자인 시스템
├── PAGE_LAYOUT_GUIDE.md          # 페이지 레이아웃 규칙
├── SEED_DATA_GUIDE.md            # 시드 데이터 가이드
├── SSO_USAGE_AND_TESTING.md      # SSO 사용 및 테스트
└── SYSTEM_STATUS_GUIDE.md        # 시스템 상태 가이드

apps/v-channel-bridge/developer-guide/  # 앱 (5개)
├── DEVELOPMENT.md                # 개발 환경 설정
├── EXECUTION_PLAN.md             # 실행 계획
├── MIGRATION_PLAN.md             # 마이그레이션 계획
├── TESTING_GUIDE.md              # 테스트 작성 가이드
└── ZOWE_CHAT_MIGRATION_PLAN.md   # Zowe Chat 마이그레이션
```

---

## 4. 관리자 가이드 (Admin Guide)

**위치**: 플랫폼/앱별 분리

**용도**: 배포, 플랫폼 연동, 모니터링, 보안, 트러블슈팅

**현재 파일 목록**:
```
platform/admin-guide/             # 플랫폼 (5개)
├── ADMIN_GUIDE.md                # 관리자 종합 가이드
├── DEPLOYMENT.md                 # 배포 가이드
├── EMAIL_SETUP.md                # 이메일 설정
├── MONITORING_SETUP.md           # 모니터링 설정
└── SSL_TLS_SETUP.md              # SSL/TLS 설정

apps/v-channel-bridge/admin-guide/  # 앱 (3개)
├── SLACK_SETUP.md                # Slack 연동 설정
├── TEAMS_SETUP.md                # Teams 연동 설정
└── TROUBLESHOOTING.md            # 트러블슈팅
```

---

## 5. API 문서 (API Documentation)

**위치**: `docusaurus/docs/api/`

**용도**: REST API 레퍼런스, WebSocket API, 스키마 정의

**현재 파일 목록**:
```
api/
└── API.md                 # API 레퍼런스
```

---

## 6. 사용자 가이드 (User Guide)

**위치**: `docusaurus/docs/user-guide/`

**용도**: 기능 사용법, 대시보드 안내, FAQ

**현재 파일 목록**:
```
user-guide/
└── USER_GUIDE.md          # 사용자 종합 가이드
```

---

## 7. 기술 포트폴리오 (Tech Portfolio)

**위치**: `docusaurus/docs/tech-portfolio/`

**용도**: 기술 아키텍처 소개, 모듈 설계, 로드맵 등 프로젝트의 기술적 가치를 정리한 문서

**현재 파일 목록**:
```
tech-portfolio/
├── DEVELOPMENT_READINESS.md     # 개발 준비도
├── MODULE_DESIGN.md             # 모듈 설계
├── PLATFORM_VALUE_ROADMAP.md    # 플랫폼 가치 로드맵
└── TECHNICAL_ARCHITECTURE.md    # 기술 아키텍처
```

---

## Claude Code 작업 시 규칙

### 문서 생성 기준

| 조건 | 생성할 문서 | 위치 |
|------|------------|------|
| 주요 기능 구현/개선 완료 | 작업 이력 | `blog/work-history/` |
| 새 기능 설계 시작 | 설계 문서 | `docs/design/` |
| 사용자 요청으로 문서 작성 | 해당 카테고리에 맞게 | `docs/{category}/` |

### 문서 작성 체크리스트

**작업 이력 (블로그)**:
- [ ] 프론트매터: `title`, `date`, `authors`, `tags`
- [ ] `<!-- truncate -->` 태그 포함
- [ ] 파일 변경 사항 목록

**설계/가이드 문서**:
- [ ] 프론트매터: `sidebar_position`, `title`
- [ ] 작성일, 상태 명시
- [ ] 개요 섹션 포함

### 주의사항

- `docusaurus/blog/` 루트에 직접 `.md` 파일을 생성하지 않습니다. 반드시 `work-history/` 하위에 작성합니다.
- 설계 문서의 `상태` 필드는 구현 완료 시 반드시 업데이트합니다.
- 더 이상 유효하지 않은 문서는 상태를 `폐기`로 변경하고, 필요 시 `docs/archive/`로 이동합니다.

---

## 참고 자료

- [Docusaurus 공식 문서](https://docusaurus.io/docs)
- [블로그 프론트매터](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter)
- [문서 프론트매터](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs#markdown-front-matter)

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-03-30 | 1.0 | 초기 작성 |
| 2026-04-08 | 2.0 | 실제 구조 기준 전면 갱신: tech-portfolio 추가, 파일 목록 현행화, 마이그레이션 섹션 제거, 태그 가이드 확장 |
| 2026-04-13 | 3.0 | 멀티앱 구조 반영: platform/, apps/ 분리된 디렉토리 구조 갱신, 전체 파일 목록 현행화 |
