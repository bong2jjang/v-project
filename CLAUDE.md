# v-project — Claude Code 루트 설정
<!-- scope: root -->

v-project는 **v-platform**(프레임워크) + **3개 앱**으로 구성된 멀티 앱 시스템입니다. 이 문서는 **전 디렉터리에 공통**으로 적용되는 규칙을 담고, 스코프별 상세는 각 디렉터리의 `CLAUDE.md`가 담당합니다.

## 스코프 구조 (Claude Code가 자동 로드)

| 위치 | 스코프 | 적용 범위 |
|---|---|---|
| `CLAUDE.md` (루트) | **root** | 모든 작업에 공통 |
| `platform/CLAUDE.md` | **platform** | `platform/**` 작업 |
| `apps/v-channel-bridge/CLAUDE.md` | **app:v-channel-bridge** | Slack/Teams 브리지 앱 |
| `apps/v-platform-portal/CLAUDE.md` | **app:v-platform-portal** | 통합 포탈 앱 |
| `apps/v-platform-template/CLAUDE.md` | **app:v-platform-template** | 새 앱 스캐폴딩 템플릿 |

Claude Code는 cwd와 상위 디렉터리의 `CLAUDE.md`를 자동 병합합니다. 앱 하위에서 작업할 때 루트 + 앱 스코프 문서를 모두 참조하세요.

## 아키텍처

| 레이어 | 이름 | 역할 |
|---|---|---|
| **플랫폼** | v-platform | 인증, SSO, RBAC, 사용자, 조직도, 감사로그, UI Kit |
| **앱** | v-channel-bridge | Slack ↔ Teams 메시지 브리지 |
| **앱** | v-platform-portal | 통합 앱 포탈, AppRegistry, SSO Relay |
| **앱** | v-platform-template | 새 앱 시작 템플릿 |

설계 배경: `docusaurus/docs/platform/design/PLATFORM_APP_SEPARATION_ARCHITECTURE.md`, `docusaurus/docs/platform/design/V_PROJECT_MIGRATION_PLAN.md`, `docusaurus/docs/design/MULTI_APP_CLAUDE_CONFIG_DESIGN.md`

## ⚡ 컨텍스트 최적화 필수 규칙

**잦은 compacting 방지. 메인 세션 토큰은 "작업 결정"에만 사용.**

1. **탐색은 서브에이전트로 위임**: 코드베이스 탐색·다회 검색은 `Explore`/`search-optimizer`에 위임하고 **"200자 이내 요약"을 반드시 지시**.
2. **부분 읽기 우선**: 전체 읽기 금지. `Grep`으로 라인 찾고 `Read(offset, limit)` 사용. 동일 파일 재조회 금지.
3. **출력 제한**: `Grep`은 `head_limit` 명시(50 이하 권장), Docker 로그 `--tail=50`, `git log -n 20`. 대량 dump 금지.
4. **툴 결과 재인용 금지**: 응답 본문에 tool output 원문 복사 금지. 요약·결론·다음 행동만.
5. **중간 상태 서술 최소화**: 결과와 결정만 전달.

상세: `.claude/shared/token-optimization-workflow.md`

## ⚠️ 개발 환경: Docker 전용

**로컬 npm/Python 실행 금지.** 모든 작업은 Docker 내에서. 이유: 로컬 Node.js v24 vs Docker v18 버전 불일치.

```bash
docker compose up -d --build                                      # 기본(v-channel-bridge)
docker compose --profile template up -d --build                   # + template
docker compose --profile portal up -d --build                     # + portal
docker compose --profile template --profile portal up -d --build  # 전체
```

앱별 상세 빌드/개발 명령은 각 앱의 `CLAUDE.md` "앱 고유 개발 워크플로우" 섹션 참조.

## 공통 기술 스택

- **Backend**: Python 3.11 / FastAPI / Pydantic v2 / Structlog / Uvicorn
- **Frontend**: React 18 / TypeScript 5 / Vite / Tailwind / Zustand / TanStack Query
- **DB**: PostgreSQL 16 — `postgresql://vmsuser:vmspassword@postgres:5432/v_project`
- **Cache/Routing**: Redis 7 — `redis://:redispassword@redis:6379/0`
- **Mail**: MailHog (개발용) / **인증**: JWT (python-jose) / bcrypt
- **차트**: Recharts / **아이콘**: Lucide React / **폰트**: Pretendard

## 주요 서비스 포트

| 서비스 | 호스트 포트 |
|---|---|
| v-channel-bridge Backend / Frontend | 8000 / 5173 |
| v-platform-template Backend / Frontend | 8002 / 5174 |
| v-platform-portal Backend / Frontend | 8080 / 5180 |
| PostgreSQL / Redis | 5432 / 6379 |
| Docusaurus / MailHog / debugpy | 3000 / 8025 / 5678 |

## 환경 변수 (.env) — 스코프 분리

| 파일 | 스코프 | 포함 변수 |
|---|---|---|
| `.env` (루트) | 공용 + compose interpolation | `DATABASE_URL`, `REDIS_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `SECRET_KEY`, `ENCRYPTION_KEY`, `ENVIRONMENT`, `SMTP_*`, `PUBLIC_HOST`, `CORS_ORIGINS`, `FRONTEND_URL`, `*_BACKEND_URL`, `TEAMS_TENANT_ID/APP_ID/APP_PASSWORD` (SSO 공용) |
| `apps/v-channel-bridge/.env` | bridge 전용 | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `TEAMS_TEAM_ID`, `MS_OAUTH_REDIRECT_URI`, `TEAMS_NOTIFICATION_URL` |
| `apps/v-platform-portal/.env` | portal 전용 | `PORTAL_APPS` |
| `apps/v-platform-template/.env` | template 전용 | (현재 없음, 새 앱 복제 시 추가) |
| `apps/v-ui-builder/.env` | ui-builder 전용 | `LLM_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` |

**원칙**:
- 공용 변수와 compose `${VAR}` 치환에 쓰이는 변수는 루트 `.env`에 유지 (치환은 루트 `.env`만 소스로 사용)
- 앱 고유 비밀·설정은 `apps/{app}/.env`에 분리 → docker-compose의 `env_file: (required: false)`로 주입
- `.env`, `apps/*/.env`는 커밋 금지 (`.gitignore`에 포함)
- 예시 파일은 각 위치에 `.env.example` → `cp .env.example .env` 후 실제 값 채우기

## 코딩 규칙

- **공통 규칙**: `.claude/shared/coding_conventions.md` (Python 타입/임포트/인증, TypeScript 타입/컴포넌트/스타일/레이아웃, 공통 파일명·UI 텍스트)
- **플랫폼/새 앱 작성**: `.claude/platform/CONVENTIONS.md`
- **앱 고유**: `apps/{app}/.claude/CONVENTIONS.md` (예: bridge의 Provider Pattern / CommonMessage / Route 규칙)

핵심 요약:
- Python: 3.9+ 빌트인 제네릭 (`list[str]`), `Optional`은 `typing`에서 임포트, async I/O 필수, structlog
- TypeScript: 모든 props에 `interface`, `any` 금지, 서버상태 TanStack Query, 클라이언트상태 Zustand, 시맨틱 토큰 스타일

## 커밋 메시지 규칙

```
<type>(<scope>): <subject>
```

- **type**: feat, fix, docs, style, refactor, test, chore
- **scope**: v-platform, v-channel-bridge, v-platform-template, v-platform-portal, backend, frontend, docker, docs, migration

## Git 워크플로우

**`git push`는 사용자가 명시적으로 요청할 때만 실행합니다.**

## 스코프 작업 원칙 — 교차 영향 방지

각 스코프에는 **자유 수정 / 사용자 승인 필요 / 금지** 3단계 가드레일이 있습니다 (각 `CLAUDE.md` 참조). 시작 전 해당 스코프의 "교차 영향 사전 체크리스트"를 반드시 확인하세요.

**공통 금지 사항**:
- 내 스코프 밖의 디렉터리 수정 (예: 앱 작업 중 `platform/**` 또는 타 앱 수정)
- `docker-compose.yml`의 다른 앱 섹션 건드리기
- 플랫폼 테이블(`users`, `permissions`, `audit_log` 등) 스키마 직접 변경

## Claude Code 공통 슬래시 커맨드

루트 `.claude/commands/` — 전 앱 공통:

| 커맨드 | 용도 |
|---|---|
| `/docker_troubleshoot` | Docker 문제 진단 |
| `/enforce_standards` | 코딩 표준 검사 |
| `/deploy_check` | 배포 전 체크리스트 |
| `/write_pr_summary` | PR 요약 작성 |
| `/gh_issue_solve` | GitHub Issue 분석·해결 |
| `/migration_status` | 시스템 상태 확인 |
| `/check_sync_status` | 메시지 브리지 동기화 상태 |
| `/token_tips` | 토큰 최적화 팁 |

**앱 전용 자원 배치 (실측 기반 하이브리드)**:
- **Agents**: `apps/{app}/.claude/agents/{name}.md` — 앱 스코프에서 자동 로드됨 (예: `apps/v-channel-bridge/.claude/agents/migration-helper.md`)
- **Commands**: 루트 `.claude/commands/{app-prefix}_{name}.md` — 현재 prefix 방식으로 통일 (예: `bridge_provider_health`). 참고: 서브폴더(`bridge/health.md`)도 `/bridge:health` 로 인식되지만 혼용 금지. 앱 중첩(`apps/{app}/.claude/commands/`)은 실측상 현 세션에 로드되지 않아 미채택
- **Skills**: 루트 `.claude/skills/{app-prefix}-{name}/SKILL.md` — 반드시 디렉터리 구조, 플랫 파일 미로딩 (예: `bridge-add-route-rule/SKILL.md`)

상세 규약: `.claude/shared/documentation-rules.md` §8

## Agent 활용

| Agent | 모델 | 사용 시기 |
|---|---|---|
| **search-optimizer** | Haiku | 파일 찾기, 로그 검색 |
| **docker-expert** | Sonnet | Docker 상태/디버깅 |
| **Explore** | Sonnet | 코드베이스 흐름 파악 |

## 문서 저장 규칙

- **작업 이력**: `docusaurus/blog/work-history/YYYY-MM-DD-{title}.md`
- **설계 문서**: `docusaurus/docs/design/{TOPIC}_{TYPE}.md`
- **개발자 가이드**: `docusaurus/docs/developer-guide/`
- **스코프별 CLAUDE.md 유지보수**: 새 앱 추가 시 `apps/{app}/CLAUDE.md` 생성(8-섹션 템플릿), 스코프 마커(`<!-- scope: app:{name} -->`) 필수

상세: `.claude/shared/documentation-rules.md`

---

**문서 버전**: 8.0 (멀티앱 스코프 구조, 루트 슬림화)
**최종 업데이트**: 2026-04-17
