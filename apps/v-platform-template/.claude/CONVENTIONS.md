# {APP_NAME} 고유 컨벤션 (샘플 템플릿)

> **이 문서는 스캐폴딩 샘플입니다.** `apps/v-platform-template/` 을 복제하여 새 앱을 만들 때,
> 이 파일을 `apps/{new-app}/.claude/CONVENTIONS.md` 로 옮긴 뒤 `{APP_NAME}`, `{app_prefix}`,
> 플레이스홀더(`TODO:`)를 해당 앱 도메인에 맞게 교체하세요.
>
> **실제 구현 예시 참고**:
> - `apps/v-channel-bridge/.claude/CONVENTIONS.md` — Provider Pattern / CommonMessage / Dynamic Routing
> - `apps/v-itsm/.claude/CONVENTIONS.md` — Loop FSM / SLA Timer / Bridge Notifier
>
> 공통 규칙은 루트 `.claude/shared/coding_conventions.md`, 플랫폼 규칙은
> `.claude/platform/CONVENTIONS.md` 를 먼저 읽고, 이 문서에는 **앱 고유** 규칙만 남기세요.

---

## 1. 식별자 & 네임스페이스

앱이 공용 인프라(DB, Redis, 마이그레이션, 라우터, 감사로그)에서 사용할 **고유 네임스페이스**를
한 곳에 선언합니다. 다중 앱 격리(`docusaurus/docs/platform/design/MULTI_APP_DATA_ISOLATION.md`)
를 위반하지 않도록 반드시 앱 전용 접두사를 사용하세요.

| 자원 | 네임스페이스 규칙 | 예시 (채워 넣기) |
|---|---|---|
| DB 테이블 | `{app_prefix}_<entity>` | `TODO: {app_prefix}_ticket` |
| Redis 키 | `{app_prefix}:<domain>:<key>` | `TODO: {app_prefix}:cache:user:{id}` |
| 마이그레이션 파일 | `a<NNN>_<설명>.py` (a001부터) | `a001_initial_schema.py` |
| PlatformApp `app_id` | `{app-name}` (kebab-case) | `TODO: {app-name}` |
| 라우터 prefix | `/api/<feature>` (앱 이름 접두사는 Platform 이 자동 추가) | `/api/tickets` |
| 감사 로그 scope | `{app_name}.<resource>.<action>` | `TODO: {app_name}.ticket.create` |

> ⚠️ 다른 앱의 네임스페이스를 절대로 사용하지 마세요. (`route:*` 는 v-channel-bridge 전용,
> `itsm:*` 은 v-itsm 전용)

## 2. 도메인 패턴 (핵심 추상화)

앱의 중심 패턴을 여기에 선언합니다. 아래는 **대표적인 3가지 유형**입니다. 앱에 해당하는
유형을 남기고 나머지는 삭제하세요.

### (A) Provider Pattern — 외부 시스템 어댑터 (예: v-channel-bridge)

외부 시스템마다 `BaseProvider` 를 상속한 어댑터를 `app/adapters/` 에 둡니다. 모든 Provider가
동일한 공통 스키마(`CommonMessage` 등)로 입출력을 변환합니다.

```python
# app/adapters/base.py
from abc import ABC, abstractmethod

class BaseProvider(ABC):
    @abstractmethod
    async def connect(self) -> bool: ...
    @abstractmethod
    async def send(self, payload: CommonSchema) -> bool: ...
    @abstractmethod
    def transform_to_common(self, raw: dict) -> CommonSchema: ...
```

### (B) FSM Pattern — 상태 전이 중심 도메인 (예: v-itsm Loop)

상태·전이 액션을 `Enum` 으로 고정하고, 허용 전이 행렬(`ALLOWED`)을 단일 상수에 모읍니다.
서비스 레이어는 `advance(current, action)` 만 호출하고, 허용되지 않는 전이는 `ValueError`.

```python
class StageA(str, Enum): ...
class Action(str, Enum): ...
ALLOWED: dict[StageA, dict[Action, StageA]] = { ... }
```

전이마다 체크리스트:
- [ ] 사전 조건(예: 담당자 존재)
- [ ] 부수 효과(SLA 타이머, 알림, 감사 로그)
- [ ] 실패 시 원복 가능한 트랜잭션 경계

### (C) Ingest/Transform/Serve Pattern — 데이터 파이프라인 앱

`ingest/` (수집) → `transform/` (변환) → `serve/` (조회 API) 3계층으로 나누고, 각 단계에서
스키마 검증과 idempotency key 를 강제합니다.

> 앱이 위 3가지 중 어느 쪽도 아니라면, 새 패턴 이름을 정의하고 그림과 규칙을 기술하세요.

## 3. 외부 시스템 연동 규칙

- **다른 앱 호출은 반드시 HTTP**. 다른 앱의 Python 모듈을 직접 import 하지 말 것.
  - v-channel-bridge 알림: `POST {BRIDGE_BACKEND_URL}/api/bridge/notify`
  - v-ui-builder LLM: `BaseLLMProvider` 는 **copy-free import** 허용 (클래스 계약만 공유)
- 외부 서비스 인증 토큰은 반드시 `apps/{app}/.env` 에, 공용 URL·도메인은 루트 `.env` 에.
- Timeout 명시: `aiohttp.ClientTimeout(total=10)` 등. 기본값 무한대 금지.
- 외부 호출은 `asyncio.gather(..., return_exceptions=True)` 로 에러 격리.

## 4. 비동기 & 로깅

- 모든 I/O 는 `async def`. `time.sleep()` 금지, `asyncio.sleep()` 사용.
- DB: SQLAlchemy async 엔진 (`v_platform.core.database.get_async_session`).
- Redis: `redis.asyncio`.
- 로깅: `structlog.get_logger()` — 구조화 로깅만 허용.
  ```python
  logger.info("ticket_advanced", ticket_id=tid, from_stage=prev, to_stage=nxt)
  ```
- PII/토큰 로깅 금지. `password`, `secret`, `token` 필드는 마스킹.

## 5. 테스트 규칙

- 단위 테스트: `apps/{app}/backend/tests/` (pytest + pytest-asyncio)
- 통합 테스트: Docker compose 기동 후 `/api/health` 200 확인 + 핵심 엔드포인트 E2E
- 외부 시스템(Slack/Teams/LLM/SMTP)은 **Mock 필수**
- Frontend: `vitest --run` (jsdom), Playwright 는 E2E 전용

```python
# 예시
@pytest.mark.asyncio
async def test_service_happy_path(async_session):
    svc = MyService(session=async_session)
    result = await svc.do_thing(payload)
    assert result.status == "ok"
```

## 6. 체크리스트 (PR 전 최종 확인)

- [ ] 새 테이블/Redis 키가 앱 네임스페이스(`{app_prefix}_*`, `{app_prefix}:*`) 를 따르는가?
- [ ] `platform/**` 을 수정하지 않았는가? (import 만 허용)
- [ ] 다른 앱(`apps/{other}/**`)을 수정하지 않았는가?
- [ ] `docker-compose.yml` 의 타 앱 서비스를 건드리지 않았는가?
- [ ] 민감 정보(토큰/비밀번호)가 코드·커밋에 섞여 들어가지 않았는가?
- [ ] `apps/{app}/.env.example` 에 새 환경변수가 반영되었는가?
- [ ] 설계 문서(`docusaurus/docs/apps/{app}/design/`)와 구현이 일치하는가?

## 7. 스캐폴딩 시 반드시 할 일 (체크리스트)

새 앱을 복제할 때 이 문서를 받아서 해야 하는 작업:

1. [ ] `{APP_NAME}`, `{app-name}`, `{app_prefix}`, `{app_name}` 전부 교체
2. [ ] §1 네임스페이스 표의 `TODO:` 항목 확정
3. [ ] §2 에서 해당 없는 패턴 섹션 삭제, 사용하는 패턴만 남기고 도메인 용어로 리라이트
4. [ ] `agents/app-helper.md` 를 열어 YAML frontmatter(`name`, `description`) 및
      "현재 시스템 상태" 섹션을 앱 도메인 맞춤으로 교체
5. [ ] 상위 `apps/{new-app}/CLAUDE.md` (8-섹션 템플릿) 의 "관련 문서" 에서 이 문서를 링크
6. [ ] 루트 `CLAUDE.md` 의 스코프 표에 앱 추가
