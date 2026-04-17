---
title: 멀티앱 Claude Code 설정 구조 개선안
sidebar_position: 10
---

# 멀티앱 Claude Code 설정 구조 개선안

**버전**: 1.0 초안
**작성일**: 2026-04-18
**상태**: 제안 (Proposed)

## 1. 배경

현재 v-project는 `v-channel-bridge`, `v-platform-template`, `v-platform-portal` 3개 앱이 `v-platform` 프레임워크를 공유하는 구조이며, 앞으로 앱이 더 추가될 예정이다.

그러나 Claude Code 설정은 **단일 루트 CLAUDE.md + 단일 `.claude/`** 에 모든 규칙이 집중되어 있어, 앱이 늘어날수록 다음 문제가 커진다.

### 1.1 현재 구조 요약

```
v-project/
├── CLAUDE.md                          # 플랫폼/앱 규칙 전부 + 아키텍처 설명
└── .claude/
    ├── coding_conventions.md          # 공통 + v-channel-bridge 전용 규칙 혼재
    ├── dev_workflow.md                # 공통 개발 워크플로우
    ├── documentation-rules.md         # 문서 저장 규칙
    ├── token-optimization-workflow.md
    ├── agents/                        # 앱 구분 없이 평면 배치 (6개)
    ├── commands/                      # 앱 구분 없이 평면 배치 (10개)
    └── skills/                        # 앱 구분 없이 평면 배치 (5개)
```

### 1.2 식별된 문제

| # | 문제 | 예시 |
|---|------|------|
| P1 | **규칙 스코프 불분명** | `coding_conventions.md` 345줄 이후는 전부 v-channel-bridge 전용인데 경계가 모호 |
| P2 | **앱별 정체성 부재** | 각 앱의 역할·책임·제약이 문서화되지 않아 Claude가 앱 특성을 구분하지 못함 |
| P3 | **교차 영향 위험** | 앱 A 작업 중 플랫폼 코드를 무심코 수정 → 앱 B/C에 파급 |
| P4 | **확장 비용** | 새 앱 추가 시 루트 CLAUDE.md를 계속 비대하게 수정 (v7.0 → v8, v9...) |
| P5 | **에이전트·커맨드 소유권 불명확** | `provider_health`·`scaffold-provider`는 bridge 전용인데 루트 네임스페이스에 존재 |
| P6 | **토큰 비용** | 루트 CLAUDE.md에 모든 앱의 세부 규칙이 있어 매 세션마다 전부 로드됨 |

## 2. 설계 원칙

1. **계층형 스코프**: 공통 → 플랫폼 → 앱으로 단계적으로 규칙을 상속·특화
2. **명시적 경계**: 각 문서 상단에 "적용 범위(scope)"를 선언
3. **격리 기본값**: 특정 앱 작업 시 타 앱 코드는 기본 변경 금지, 변경이 필요하면 사용자 승인
4. **템플릿 주도 확장**: 새 앱은 정해진 템플릿만 복사하면 Claude 설정이 자동으로 동작
5. **컨텍스트 절약**: 루트는 최소화하고, 작업 경로에 가까운 설정을 우선 로드

## 3. 제안 구조

### 3.1 디렉터리 개편

```
v-project/
├── CLAUDE.md                          # [공통·얇게] 프로젝트 오버뷰 + 공통 규칙 + 앱 목록 포인터
├── .claude/
│   ├── shared/                        # [공통] 모든 앱·플랫폼에 적용
│   │   ├── coding_conventions.md       #   Python/TypeScript 공통 문법·타입·임포트
│   │   ├── dev_workflow.md             #   Docker 전용 규칙, lint/format, 테스트
│   │   ├── documentation-rules.md      #   문서 저장 규칙
│   │   └── token-optimization.md       #   컨텍스트 최적화 워크플로우
│   ├── platform/                      # [플랫폼 전용]
│   │   ├── CONVENTIONS.md              #   플랫폼 아키텍처, 페이지 레이아웃, 디자인 토큰
│   │   └── MIGRATION_RULES.md          #   마이그레이션 규칙 (p### / a### 네이밍)
│   ├── agents/                        # 공통 에이전트
│   ├── commands/                      # 공통 슬래시 커맨드
│   └── skills/                        # 공통 스킬
│
├── platform/
│   └── CLAUDE.md                      # [플랫폼 스코프] `.claude/platform/*` 자동 로드 지시
│
└── apps/
    ├── v-channel-bridge/
    │   ├── CLAUDE.md                  # [앱 스코프] 앱 역할·책임·제약·금지사항
    │   └── .claude/                    # 앱 전용 에이전트·커맨드·스킬
    │       ├── CONVENTIONS.md          #   Provider Pattern, Common Schema, Routing
    │       ├── agents/                 #   migration-helper (bridge 전용)
    │       ├── commands/               #   provider_health, test_provider
    │       └── skills/                 #   add-route-rule, scaffold-provider, validate-common-schema
    │
    ├── v-platform-template/
    │   ├── CLAUDE.md                  # [앱 스코프] 템플릿 앱 역할 정의
    │   └── .claude/
    │
    └── v-platform-portal/
        ├── CLAUDE.md                  # [앱 스코프] 포털 앱 역할·AppRegistry·SSO Relay
        └── .claude/
```

**핵심 포인트**
- Claude Code는 `cwd`와 조상 디렉터리의 `CLAUDE.md`를 자동 병합 로드한다. 앱 디렉터리 안에서 작업하면 `apps/{app}/CLAUDE.md` → `CLAUDE.md`(루트) 순으로 계층 로드되어, **앱 규칙이 공통 규칙을 덮어쓸 수 있다**.
- 루트 `CLAUDE.md`에는 각 앱 CLAUDE.md의 위치를 포인터로만 나열하고, 세부 규칙은 앱 디렉터리로 이동 → 루트 토큰 예산 절감.

### 3.2 앱별 CLAUDE.md 표준 템플릿 (보강판)

각 앱 루트에 아래 8개 섹션 구조로 고정한다. 새 앱을 만들 때 이 템플릿을 복사하여 괄호 항목만 채우면 Claude가 해당 앱의 정체성·경계·워크플로우를 즉시 파악할 수 있다.

```markdown
# {app-name} — Claude Code 앱 스코프 설정

<!-- scope: app:{app-name} -->
> **적용 범위**: 이 파일은 `apps/{app-name}/**` 경로에서 작업할 때 자동 로드됩니다.
> 공통/플랫폼 규칙과 충돌 시 **앱 규칙이 우선**합니다.

## 1. 앱 정체성
- **역할 (한 문장)**: (이 앱이 담당하는 도메인)
- **주요 기능**: (3~5개 bullet — 최종 사용자 관점)
- **핵심 도메인 개념**: 용어집 형식으로 정리
  - `용어A`: 설명
  - `용어B`: 설명
- **앱 고유 아키텍처 패턴**: (해당 시 기재, 예: Provider Pattern, AppRegistry)

## 2. 기술 스택 특이사항
공통 스택(Python 3.11/FastAPI, React 18/TS/Vite) 외에 이 앱만 쓰는 라이브러리·외부 시스템만 기재.
- (예: `slack-bolt`, `botbuilder-core`, Redis 라우팅 키, 외부 Webhook)

## 3. 엔드포인트 및 포트
| 항목 | 값 |
|---|---|
| Backend Port | (예: 8000) |
| Frontend Port | (예: 5173) |
| 컨테이너명 | (예: v-project-bridge-backend) |
| Compose 서비스명 | (예: backend) |
| 주요 API Prefix | (예: `/api/bridge`, `/api/messages`) |
| 외부 Webhook | (있으면 기재, 예: Teams `/api/teams/webhook`) |

## 4. 디렉터리 맵
```
apps/{app-name}/
├── backend/app/
│   ├── adapters/      # (앱 고유 역할)
│   ├── api/           # 앱 전용 라우터
│   ├── services/      # 도메인 서비스
│   └── main.py        # PlatformApp + register_app_routers()
└── frontend/src/
    ├── pages/         # 앱 전용 페이지
    └── components/    # 앱 전용 컴포넌트
```

## 5. 의존성
- **플랫폼 의존성**: PlatformApp, 사용하는 v-platform 모듈 목록
- **공유 인프라 사용**: 공통 DB 테이블(users, apps, notifications 등)에 대한 읽기/쓰기 여부, Redis 키 네임스페이스
- **외부 시스템**: (예: Slack API, Azure Bot Service, OAuth Provider)

## 6. 작업 범위 가드레일 (교차 영향 방지)

### ✅ 자유 수정 허용
- `apps/{app-name}/**` 전 경로

### ⚠️ 사용자 승인 필요
- `platform/**` — 모든 앱에 파급. 수정 전 영향받는 앱 목록을 고지.
- 공통 DB 테이블 스키마(users, apps, permissions 등) 변경
- `docker-compose.yml` 전역 설정, 루트 `.env` 구조 변경
- 공유 마이그레이션 번호(p###) 추가

### ❌ 금지
- 타 앱 디렉터리(`apps/{다른앱}/**`) 수정 — 요청 범위 초과
- 타 앱의 전용 Redis 키 네임스페이스, 컨테이너, 포트 침범
- 공통 테이블에 이 앱만 아는 컬럼 단독 추가

### 교차 영향 사전 체크리스트
작업 착수 전 아래를 자체 점검한다. 하나라도 해당하면 사용자 승인 필요.
1. [ ] 이 변경이 `platform/**`를 건드리는가?
2. [ ] DB 마이그레이션 번호를 새로 할당하는가? (`grep -r "p0" platform/backend/v_platform/migrations/` 로 최고 번호 확인)
3. [ ] `docker-compose.yml`의 공유 서비스(postgres, redis) 설정을 변경하는가?
4. [ ] 공통 환경변수 추가 → 타 앱 `.env.example` 동기화 필요?
5. [ ] 공통 테이블 컬럼 추가/삭제?

## 7. 앱 고유 개발 워크플로우
```bash
# Lint/Format (이 앱 디렉터리에서)
cd apps/{app-name}/backend && python -m ruff check --fix . && python -m ruff format .
cd apps/{app-name}/frontend && npm run lint:fix && npm run format

# 테스트
docker exec {container-name} python -m pytest tests/ -v
cd apps/{app-name}/frontend && npx vitest --run

# 재빌드
docker compose up -d --build {compose-service-name}
```

## 8. 관련 문서 및 참조
- 앱 상세 규칙(앱 고유 아키텍처 패턴): `@apps/{app-name}/.claude/CONVENTIONS.md`
- 공통 코딩 규칙: `@.claude/shared/coding_conventions.md`
- 플랫폼 규칙: `@.claude/platform/CONVENTIONS.md`
- 앱 설계 문서: `@docusaurus/docs/apps/{app-name}/design/`
- 앱 개발자 가이드: `@docusaurus/docs/apps/{app-name}/developer-guide/`
```

**템플릿 설계 원칙**
- **1~5절**: 앱 "정체성 카드" — Claude가 "이 앱은 무엇인가"를 즉시 파악
- **6절**: 경계 선언 — 타 앱/플랫폼에 대한 영향 격리
- **7절**: 실행 가능한 명령어 — 커밋 전 자체 검증을 위한 재현 가능 레시피
- **8절**: 상세 정보는 링크로 위임 — 루트 CLAUDE.md 비대화 방지

### 3.3 루트 CLAUDE.md 슬림화 (Before → After)

**Before (현재, ~330줄)**: 아키텍처·기술스택·포트·환경변수·Teams 봇 설정·Redis 라우팅·코딩 규칙·커밋 규칙 등 전부 포함.

**After (~100줄 목표)**: 아래 구성만 유지.
1. 프로젝트 오버뷰 + 아키텍처 표 (앱 목록)
2. 컨텍스트 최적화 5원칙 (이미 존재)
3. Docker 전용 환경 규칙 (이미 존재, 공통)
4. 공통 포트·DB 커넥션 문자열 (앱 수와 무관한 것만)
5. 커밋 메시지 규칙, Git 워크플로우
6. **앱별 상세 규칙 포인터**:
   ```
   - v-channel-bridge: @apps/v-channel-bridge/CLAUDE.md
   - v-platform-template: @apps/v-platform-template/CLAUDE.md
   - v-platform-portal: @apps/v-platform-portal/CLAUDE.md
   ```

앱별 세부 스택·포트·환경변수·라우팅 구조 등은 **해당 앱 CLAUDE.md로 이동**한다. 이를 통해 포털만 건드리는 세션에서는 bridge의 Redis 라우팅 설명이 로드되지 않는다.

### 3.4 에이전트·커맨드·스킬 재배치 (실측 기반 하이브리드)

2026-04-18 실측 결과: Claude Code는 자원 종류별로 `.claude/` discovery 동작이 다르다. 이 차이에 맞춰 **하이브리드 배치** 전략을 사용한다.

| 기존 | 분류 | 실측 결과 | 최종 배치 |
|---|---|---|---|
| `.claude/agents/docker-expert.md` | 공통 | N/A | `.claude/agents/` 유지 |
| `.claude/agents/code-standards-enforcer.md` | 공통 | N/A | `.claude/agents/` 유지 |
| `.claude/agents/migration-helper.md` | bridge 전용 | ✅ 중첩 경로 인식 | `apps/v-channel-bridge/.claude/agents/migration-helper.md` |
| `.claude/commands/provider_health.md` | bridge 전용 | ⚠️ 문서상 monorepo discovery 명시되나 실측상 현 세션 cwd로는 로드 안 됨. 서브폴더 네임스페이스(`/<sub>:<cmd>`)는 동작 | `.claude/commands/bridge_provider_health.md` (루트 + prefix 유지. 앱 중첩 배치 시 미로딩 실측 확인) |
| `.claude/commands/test_provider.md` | bridge 전용 | ⚠️ 동일 | `.claude/commands/bridge_test_provider.md` (루트 + prefix 유지) |
| `.claude/skills/add-route-rule.md` | bridge 전용 | ❌ 플랫 파일 + 중첩 경로 모두 미인식 | `.claude/skills/bridge-add-route-rule/SKILL.md` (루트 + `bridge-` prefix + 디렉터리 구조) |
| `.claude/skills/scaffold-provider.md` | bridge 전용 | ❌ 플랫 파일 + 중첩 경로 모두 미인식 | `.claude/skills/bridge-scaffold-provider/SKILL.md` |
| `.claude/skills/validate-common-schema.md` | bridge 전용 | ❌ 플랫 파일 + 중첩 경로 모두 미인식 | `.claude/skills/bridge-validate-common-schema/SKILL.md` |

**핵심 실측 발견**:
1. **Agents**: `apps/{app}/.claude/agents/` 에서 자동 로드됨 → 앱 스코프 격리 가능
2. **Commands**: Custom Commands는 Skills에 통합되었고(공식 문서 명시), monorepo 서브디렉터리의 `.claude/commands/`가 자동 discovery됨. 서브폴더 네임스페이스(`/<sub>:<cmd>`)도 지원. **2026-04-18 정책 결정**: Agents와 동일하게 `apps/{app}/.claude/commands/` 하위에 배치하여 cwd 기반 노출로 통일 (prefix 불필요)
3. **Skills**: 루트만 인식 + **`<name>/SKILL.md` 디렉터리 구조 필수** (플랫 `.md` 파일은 로드되지 않음) → prefix는 `{app}-` 하이픈. 문서상 monorepo 중첩 discovery가 명시되나 현 버전에서는 플랫 파일·중첩 경로 모두 실측 미인식 → 루트 + prefix 유지

**효과**: Agents + Commands가 동일 레이아웃(`apps/{app}/.claude/{agents,commands}/`)으로 통일되어 앱 cwd에서만 노출되고 scope 혼동이 제거됨. Skills는 discovery 제약으로 루트 + prefix 배치가 남지만, 향후 Claude Code가 중첩 Skills를 지원하면 동일 구조로 이관 예정.

### 3.5 격리 가드레일 (교차 영향 방지)

각 앱 CLAUDE.md에 고정 문구로 삽입한다.

```markdown
## 교차 영향 방지 규칙

1. **타 앱 코드 수정 금지**: 현재 작업이 `apps/{이 앱}/**` 범위일 때,
   다른 앱 디렉터리의 파일을 수정하려면 **반드시 사용자에게 사전 확인**.
2. **플랫폼 코드 수정 시 영향 범위 고지**: `platform/**` 수정은 모든 앱에
   영향. 수정 전 "이 변경이 v-channel-bridge, v-platform-template,
   v-platform-portal 모두에 영향을 미칩니다"를 사용자에게 고지.
3. **DB 마이그레이션 번호 충돌 확인**: 플랫폼 마이그레이션(p###) 추가 시
   기존 최고 번호를 grep으로 확인 후 다음 번호 사용.
4. **공통 테이블 스키마 변경 금지 (단독)**: users, apps 등 공통 테이블은
   앱 단독으로 컬럼 추가/삭제 금지. 플랫폼 레벨 변경으로 승격.
5. **환경변수·Docker Compose 전역 변경 시 영향 고지**: `docker-compose.yml`,
   루트 `.env`는 전역 자원. 수정 시 타 앱 영향 명시.
```

### 3.6 공통 규칙 문서의 스코프 명시

모든 규칙 문서 상단에 프론트매터 또는 배너로 스코프를 선언한다.

```markdown
<!-- scope: shared | platform | app:v-channel-bridge -->

> **적용 범위**: 모든 앱 및 플랫폼 (shared)
```

Claude가 문서를 참조할 때 스코프 라벨로 관련성을 빠르게 판단한다.

## 4. 마이그레이션 전략 (단계적 적용)

큰 변경을 한 번에 하면 위험하므로 4단계로 나눈다. 각 단계는 독립적으로 커밋·롤백 가능하다.

### Phase 1 — 앱별 CLAUDE.md 생성 (Low Risk)

- `apps/v-channel-bridge/CLAUDE.md`, `apps/v-platform-portal/CLAUDE.md`, `apps/v-platform-template/CLAUDE.md` 신규 생성
- 3.2 템플릿 기반, 앱별 역할·가드레일·참조 포인터만 포함 (40~60줄)
- 루트 CLAUDE.md는 **건드리지 않음** → 기존 동작 보장
- 검증: 각 앱 디렉터리에서 세션 시작 시 앱 CLAUDE.md가 로드되는지 확인

### Phase 2 — 공통 규칙 분리 (Medium Risk)

- `.claude/shared/` 생성, 기존 `coding_conventions.md` 등 이동
- `coding_conventions.md`에서 **v-channel-bridge 섹션(345줄~)** 을 잘라내어 `apps/v-channel-bridge/.claude/CONVENTIONS.md`로 이동
- 루트 CLAUDE.md의 "자세한 규칙" 참조 경로 업데이트

### Phase 3 — 에이전트·커맨드·스킬 재배치 (Medium Risk) — **완료 (하이브리드)**

실측 결과 자원별로 discovery 방식이 달라 하이브리드 배치를 채택:

- **Agents**: `apps/{app}/.claude/agents/` 에서 로드 확인 → 앱 스코프 유지
- **Commands**: `apps/{app}/.claude/commands/` 에서 monorepo 자동 discovery — **Agents와 동일 레이아웃**, prefix 불필요 (2026-04-18 정책 변경)
- **Skills**: 루트 `.claude/skills/<name>/SKILL.md` 디렉터리 구조만 로드 → `{app}-` prefix + 디렉터리 포맷 필수

검증 방법: 세션 시스템 리마인더 `skills` 목록에 등록된 이름이 나타나는지 확인, `Skill` 도구로 직접 호출 시도 시 `Unknown skill` 에러 부재로 확인.

### Phase 4 — 루트 CLAUDE.md 슬림화 (High Risk, 최종)

- 3.3 구조로 루트 CLAUDE.md 재작성 (~100줄)
- 제거된 세부 내용이 앱 CLAUDE.md 또는 shared로 전부 이관됐는지 역추적 체크리스트 수행
- `.claude/documentation-rules.md`에 "앱별 CLAUDE.md 작성 지침" 섹션 추가

## 5. 새 앱 추가 워크플로우 (After)

```bash
# 1. 앱 디렉터리 생성
cp -r apps/v-platform-template apps/v-new-app

# 2. 앱 CLAUDE.md 템플릿 복사 및 커스터마이즈
cp apps/v-platform-template/CLAUDE.md apps/v-new-app/CLAUDE.md
# → 역할, 주요 기능, 도메인 용어만 수정

# 3. 앱 전용 .claude/ 디렉터리 생성 (빈 디렉터리도 OK)
mkdir -p apps/v-new-app/.claude/{agents,commands,skills}

# 4. 루트 CLAUDE.md 아키텍처 표에 한 줄 추가
# 5. 루트 CLAUDE.md "앱별 상세 규칙 포인터"에 한 줄 추가
```

루트 문서 수정은 **최소 2줄**. 대부분의 앱 특화 지식은 앱 디렉터리 안에서 관리된다.

## 6. 측정 지표 (개선 효과 검증)

| 지표 | 현재 | 목표 (Phase 4 이후) |
|------|------|---------------------|
| 루트 CLAUDE.md 라인 수 | ~330 | ~100 |
| 세션 시작 시 로드되는 공통 컨텍스트 토큰 | 전체 | 공통 + 해당 앱만 |
| 앱 추가 시 루트 수정 라인 | N/A | 2줄 |
| 앱별 슬래시 커맨드 격리 | 없음 | 있음 |

## 7. 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| Claude Code가 앱 디렉터리 하위 `.claude/`를 자동 인식하지 않을 수 있음 | **실측 완료 (2026-04-18)**: Agents는 인식, Commands/Skills는 미인식. 하이브리드 배치로 해결 (§3.4 참조) |
| Skills 플랫 파일(`.claude/skills/*.md`) 비로딩 | **실측 완료**: 반드시 `.claude/skills/<name>/SKILL.md` 디렉터리 구조 사용 |
| 기존 세션 사용자가 새 구조를 모름 | `.claude/documentation-rules.md`에 이관 완료 후 "새 구조 가이드" 추가 |
| 공통 규칙과 앱 규칙 충돌 시 우선순위 | "앱 규칙이 공통 규칙을 덮어쓴다"를 루트 CLAUDE.md에 명시 |
| 점진 마이그레이션 중 중간 상태 혼란 | Phase 단위로 PR 분리, 각 Phase 완료 후 1~2일 안정화 기간 |

## 8. 결정 요청

- [ ] 이 설계를 기반으로 **Phase 1**(앱별 CLAUDE.md 신규 생성)을 먼저 진행할지
- [ ] 3.2 템플릿 필드(역할·주요 기능·가드레일)를 그대로 사용할지 추가·수정할지
- [ ] 에이전트·커맨드 재배치(Phase 3)를 실제 수행할지, 평면 구조 + prefix 방식을 선택할지

---

**참고**
- 공식 Claude Code 문서: 계층형 CLAUDE.md 지원 (`cwd` + 조상 디렉터리 자동 병합)
- 관련 기존 문서: `.claude/coding_conventions.md`, `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`
