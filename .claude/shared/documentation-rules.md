# 문서 저장 규칙

v-project의 모든 문서는 Docusaurus 기반으로 관리합니다. 스코프별 `CLAUDE.md` 규약은 섹션 8 참조.

> **최종 업데이트**: 2026-04-21 · **버전**: 4.3 (v-ui-builder 앱 문서 스코프 분리 — `docs/apps/v-ui-builder/` 하위로 설계 문서 5건 이관)

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
│   ├── apps/                        # 앱별 문서 (각 앱은 apps/{app}/ 하위 고정)
│   │   ├── v-channel-bridge/        #   채널 브리지 앱
│   │   │   ├── admin-guide/
│   │   │   ├── developer-guide/
│   │   │   └── design/
│   │   ├── v-platform-portal/       #   통합 포탈 앱
│   │   │   ├── admin-guide/
│   │   │   ├── user-guide/
│   │   │   └── getting-started.md
│   │   ├── v-platform-template/     #   템플릿 앱
│   │   │   └── getting-started.md
│   │   └── v-ui-builder/            #   AI UI Builder 앱
│   │       └── design/              #     (admin-guide/developer-guide 는 필요 시 추가)
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
| 앱 전용 | `docusaurus/docs/apps/{app}/design/` (예: `v-channel-bridge`, `v-ui-builder`) |
| 공유/크로스커팅 | `docusaurus/docs/design/` |

> **배치 규칙**: 특정 앱 하나에만 적용되는 설계 문서는 반드시 해당 앱 폴더 아래 `design/` 에 둡니다. 신규 앱이 생기면 `docs/apps/{app}/design/` 폴더와 `_category_.json` (`{"label": "설계 문서", "position": 1}`) 을 먼저 만들고, `docusaurus/sidebars.ts` 에 앱 섹션을 추가합니다. **공유 설계 (`docs/design/`) 에는 앱 전용 문서를 두지 않습니다.**

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

apps/v-ui-builder/design/      # 앱 설계 (5개)
├── V_UI_BUILDER_DESIGN.md                     # P1.x 베이스 설계
├── V_UI_BUILDER_EDITOR_AND_UI_KIT_DESIGN.md   # 에디터/UI Kit 전략 (방안 C)
├── V_UI_BUILDER_GENERATIVE_UI_DESIGN.md       # Generative UI (P2.x)
├── V_UI_BUILDER_DASHBOARD_CANVAS_DESIGN.md    # 대시보드 캔버스 v0.2
└── V_UI_BUILDER_MANUAL_WIDGETS_DESIGN.md      # 수동 위젯 v0.2

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

## 8. 스코프별 CLAUDE.md 유지보수

Claude Code는 작업 디렉터리와 상위 경로의 `CLAUDE.md` 파일을 자동 병합하여 컨텍스트로 로드합니다. v-project는 멀티앱 구조를 지원하기 위해 **스코프별로 `CLAUDE.md`를 분산**합니다.

### 스코프 구조

| 파일 | 스코프 마커 | 적용 범위 |
|------|------------|-----------|
| `CLAUDE.md` | `<!-- scope: root -->` | 프로젝트 전체 (루트) |
| `platform/CLAUDE.md` | `<!-- scope: platform -->` | 플랫폼 프레임워크 수정 |
| `apps/v-channel-bridge/CLAUDE.md` | `<!-- scope: app:v-channel-bridge -->` | 채널 브리지 앱 |
| `apps/v-platform-portal/CLAUDE.md` | `<!-- scope: app:v-platform-portal -->` | 포털 앱 |
| `apps/v-platform-template/CLAUDE.md` | `<!-- scope: app:v-platform-template -->` | 템플릿 앱 |

각 하위 스코프는 **자신의 규칙만 중복 없이 선언**하며, 공통 규칙은 루트 `CLAUDE.md` / `.claude/shared/*` 를 참조합니다.

### 새 앱 추가 시 CLAUDE.md 생성

새 앱(`apps/v-my-new-app/`)을 스캐폴딩할 때 반드시 `apps/v-my-new-app/CLAUDE.md` 를 생성합니다. 생성이 누락되면 Claude Code가 해당 앱의 경계·의존성·가드레일을 인식하지 못합니다.

**파일 선두**: 스코프 마커(`<!-- scope: app:v-my-new-app -->`) 필수.

### 앱 CLAUDE.md 8섹션 템플릿

```markdown
# v-my-new-app — Claude Code 앱 스코프 설정
<!-- scope: app:v-my-new-app -->

이 문서는 `apps/v-my-new-app/` 하위 작업에만 적용됩니다. 루트 `CLAUDE.md`와 `platform/CLAUDE.md`를 상위 컨텍스트로 함께 참조하세요.

## 1. 앱 정체성
- **역할**: {한 문장으로 이 앱이 하는 일}
- **주요 기능**: {bullet list — 핵심 기능 3~6개}
- **도메인 용어**: {앱 고유 용어 정의}
- **아키텍처 패턴**: {이 앱이 따르는 설계 패턴}

## 2. 기술 스택 특이사항
{플랫폼 공통 스택 외에 이 앱만 쓰는 라이브러리/프로토콜}

## 3. 엔드포인트 및 포트
{표 — 서비스/내부 포트/호스트 포트/비고}

## 4. 디렉터리 맵
{code fence — 주요 디렉터리 구조}

## 5. 의존성
- **Platform 의존**: {사용하는 v_platform 모듈}
- **공유 인프라**: {DB/Redis/외부 서비스}
- **외부 서비스**: {Slack/Teams/Azure 등}

## 6. 작업 범위 가드레일
### ✅ 자유 수정 허용
### ⚠️ 사용자 승인 필요
### ❌ 금지
### 교차 영향 사전 체크리스트

## 7. 앱 고유 개발 워크플로우
{Backend/Frontend 재빌드·테스트·헬스체크 명령}

## 8. 관련 문서 및 참조
```

### 앱 CLAUDE.md 작성 체크리스트

- [ ] 파일 선두에 스코프 마커 존재 (`<!-- scope: app:{name} -->`)
- [ ] 8개 섹션 모두 작성 (빈 섹션 지양, 없으면 "없음" 명시)
- [ ] 가드레일 3단계(✅/⚠️/❌)로 분류
- [ ] 교차 영향 체크리스트 5개 이상
- [ ] 공통 규칙은 중복 기재하지 않고 `.claude/shared/*` 를 참조
- [ ] 앱 고유 아키텍처 규칙(예: Provider Pattern)은 `apps/{app}/.claude/CONVENTIONS.md` 에 분리

### 앱별 `.claude/` 디렉터리 (하이브리드 배치 — 실측 기반)

Claude Code의 `.claude/` 하위 자원은 종류별로 discovery 동작이 다릅니다. 아래는 2026-04 기준 실측 결과입니다.

| 자원 | 중첩 경로 인식 | 실제 배치 전략 |
|------|---------------|-----------------|
| **Agents** | ✅ 인식됨 | `apps/{app}/.claude/agents/{name}.md` — 앱 스코프 유지 |
| **Slash Commands** | ⚠️ 공식 문서상 monorepo discovery 명시되나 현 세션 cwd 기준으로만 적용 (실측: mid-session `cd`·파일 read로는 갱신 안 됨) | 루트 `.claude/commands/{app-prefix}_{name}.md` — **현재 prefix 방식 유지** (`bridge_provider_health` 등). 서브폴더(`<sub>/<cmd>.md` → `/<sub>:<cmd>`)도 로드되지만 혼용 금지 |
| **Skills** | ❌ 플랫 파일 미인식 | 루트 `.claude/skills/{prefix}-{name}/SKILL.md` — **디렉터리 구조 + `{app-prefix}-` prefix 필수** |
| **CONVENTIONS.md** | ✅ 명시적 참조 방식 | `apps/{app}/.claude/CONVENTIONS.md` — 앱 `CLAUDE.md`에서 경로로 참조 |

> **실측 노트 (2026-04-18)**:
> - `.claude/commands/<sub>/<name>.md` 배치 시 `/<sub>:<name>` 형태로 등록되는 것을 확인 (예: `_test_subdir/ping.md` → `_test_subdir:ping`). 즉, Skills와 달리 flat 파일도 로드되고, 서브폴더는 네임스페이스로 매핑됨.
> - `apps/{app}/.claude/commands/` 중첩 배치는 실측상 현 세션에 등록되지 않음(루트 cwd 세션·mid-session `cd` 모두). 반면 `apps/{app}/.claude/agents/` 는 루트 cwd 세션에서도 자동 로드됨 — Agents와 Commands 간 discovery 비대칭 확인.
> - 따라서 기존 `bridge_provider_health` 등 **루트 + prefix 방식을 유지**. 앱 중첩 배치는 Claude Code가 Commands 중첩 discovery를 정식 지원하는 시점에 재검토.

```
# Agents (앱 스코프 — 실측 동작 확인)
apps/v-channel-bridge/.claude/
├── CONVENTIONS.md                    # 앱 고유 아키텍처 규칙
└── agents/
    └── migration-helper.md           # ✅ 루트 cwd에서도 로드됨

# Commands (루트 + prefix — 실측 동작 확인)
.claude/commands/
├── bridge_provider_health.md         # v-channel-bridge 전용 → /bridge_provider_health
└── bridge_test_provider.md
# (선택) 네임스페이스 전환 시:
# .claude/commands/bridge/
# ├── provider_health.md              # → /bridge:provider_health
# └── test_provider.md

# Skills (루트 + prefix + SKILL.md 디렉터리 구조)
.claude/skills/
├── bridge-add-route-rule/
│   └── SKILL.md
├── bridge-scaffold-provider/
│   └── SKILL.md
└── bridge-validate-common-schema/
    └── SKILL.md
```

**네이밍 규칙**:
- 커맨드: `{app-prefix}_{name}` — 언더스코어 (예: `bridge_provider_health`)
- 스킬: `{app-prefix}-{name}` — 하이픈 (예: `bridge-add-route-rule`)
- `{app-prefix}`는 앱명을 단축한 것 (`v-channel-bridge` → `bridge`)

**주의**:
- `.claude/skills/*.md` 플랫 파일 포맷은 Claude Code가 로드하지 않습니다. 반드시 `<name>/SKILL.md` 디렉터리 구조 사용.
- 전체 앱 공용 도구는 prefix 없이 루트에 배치 (예: `docker_troubleshoot`, `enforce_standards`).
- Commands는 flat 파일 / 서브폴더 모두 로드되지만, **prefix 방식과 서브폴더 네임스페이스를 혼용하지 말 것** (혼란 방지). 앱이 많아지면 서브폴더 방식으로 통일 검토.
- `apps/{app}/.claude/commands/` 중첩 배치는 현재 실측상 동작하지 않으므로 **채택하지 않음** — Agents만 중첩, Commands/Skills는 루트 + prefix.

### 설계 참조

멀티앱 CLAUDE.md 구조 설계의 배경·원칙·마이그레이션 계획: `docusaurus/docs/design/MULTI_APP_CLAUDE_CONFIG_DESIGN.md`

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
| 2026-04-17 | 4.0 | 섹션 8 추가 — 스코프별 CLAUDE.md 유지보수 규약 (스코프 마커, 8섹션 템플릿, 새 앱 생성 체크리스트, 앱별 .claude/ 디렉터리 구조) |
| 2026-04-21 | 4.3 | 디렉터리 트리에 `v-platform-portal`·`v-ui-builder` 반영, "앱 전용 문서는 `docs/apps/{app}/` 고정" 규칙 명시, `apps/v-ui-builder/design/` 파일 목록 추가 |
