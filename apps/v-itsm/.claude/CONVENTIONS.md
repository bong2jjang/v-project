# v-itsm 고유 컨벤션

업무 루프 관리 시스템의 고유 아키텍처 규칙입니다. 공통 규칙은 `.claude/shared/coding_conventions.md`, 플랫폼 규칙은 `.claude/platform/CONVENTIONS.md`, 앱 스코프 루틴은 `apps/v-itsm/CLAUDE.md` 참조.

## 식별자 & 네임스페이스

모든 앱 자원은 `itsm` / `itsm_` 로 네임스페이스를 분리합니다. 다중 앱 격리 설계(`MULTI_APP_DATA_ISOLATION.md`)를 따르세요.

| 계층 | 네임스페이스 | 예 |
|---|---|---|
| DB 테이블 | `itsm_*` | `itsm_ticket`, `itsm_loop_transition`, `itsm_sla_timer` |
| Redis 키 | `itsm:*` | `itsm:sla:timers`, `itsm:queue:classify`, `itsm:ai:suggest:{ticket_id}` |
| 마이그레이션 파일 | `apps/v-itsm/backend/migrations/a*.py` | `a003_ticket_core.py` |
| 앱 ID (menu/permission scope) | `v-itsm` | `menu_items.app_id = 'v-itsm'` |
| FastAPI 라우터 태그 | `itsm.*` | `tags=["itsm.tickets"]` |
| 감사 로그 카테고리 | `itsm.*` | `itsm.ticket.created`, `itsm.loop.transition` |

**체크리스트**:
- [ ] 새 테이블 이름이 `itsm_` 로 시작한다
- [ ] 새 Redis 키가 `itsm:` 로 시작한다
- [ ] 플랫폼 공통 테이블(`users`, `audit_log` 등)을 직접 ALTER 하지 않았다
- [ ] 다른 앱의 네임스페이스(`bridge:*`, `ui_builder_*`)와 충돌하지 않는다

## Ticket ULID & 표시용 번호

`itsm_ticket.id` 는 ULID(26자) 를 사용합니다. 사용자 노출용 번호는 별도 컬럼(`ticket_no`)로 분리합니다.

```python
import ulid

def new_ticket_id() -> str:
    return str(ulid.ULID())  # 예: 01HZ3R5...

# ticket_no 는 연도 + 일련번호 (예: ITSM-2026-000123)
# PostgreSQL SEQUENCE `itsm_ticket_no_seq` 로 증가. 연도 롤오버는 서비스 레이어에서 처리.
```

**체크리스트**:
- [ ] PK/외래키는 ULID (`CHAR(26)`)
- [ ] 사람이 보는 번호는 `ticket_no` 컬럼, 채널·이메일 제목에 사용
- [ ] ULID 생성을 서비스 레이어가 담당, DB 측 default 금지

## Loop FSM (5단계 + 종료/재개)

티켓 상태 전이는 모두 `LoopFSM` 서비스를 경유하고, 전이 이력은 `itsm_loop_transition` 에 기록합니다.

### 상태 정의

```python
# apps/v-itsm/backend/app/services/loop_fsm.py
from enum import Enum

class LoopStage(str, Enum):
    INTAKE   = "intake"    # 접수(VOC)
    ANALYZE  = "analyze"   # 분석(사업)
    EXECUTE  = "execute"   # 실행(제품)
    VERIFY   = "verify"    # 검증(운영)
    ANSWER   = "answer"    # 답변(고객)
    CLOSED   = "closed"

class LoopAction(str, Enum):
    ADVANCE  = "advance"    # 정방향 전이
    REOPEN   = "reopen"     # closed → verify/analyze
    REJECT   = "reject"     # 상위 단계로 반려
    HOLD     = "on_hold"    # 일시 보류
    RESUME   = "resume"     # 보류 해제
    ROLLBACK = "rollback"   # 강제 이전 단계 되돌리기 (관리자)
```

### 전이 규칙

```python
# ALLOWED[current] = {action: next_stage}
ALLOWED: dict[LoopStage, dict[LoopAction, LoopStage]] = {
    LoopStage.INTAKE:  {LoopAction.ADVANCE: LoopStage.ANALYZE},
    LoopStage.ANALYZE: {LoopAction.ADVANCE: LoopStage.EXECUTE,
                        LoopAction.REJECT:  LoopStage.INTAKE},
    LoopStage.EXECUTE: {LoopAction.ADVANCE: LoopStage.VERIFY,
                        LoopAction.REJECT:  LoopStage.ANALYZE},
    LoopStage.VERIFY:  {LoopAction.ADVANCE: LoopStage.ANSWER,
                        LoopAction.REJECT:  LoopStage.EXECUTE},
    LoopStage.ANSWER:  {LoopAction.ADVANCE: LoopStage.CLOSED},
    LoopStage.CLOSED:  {LoopAction.REOPEN:  LoopStage.VERIFY},
}
```

### 전이 체크리스트

- [ ] `LoopFSM.transition(ticket, action, actor, reason)` 이외의 경로로 `stage` 컬럼을 변경하지 않는다
- [ ] 전이마다 `itsm_loop_transition` 행 1건 (from_stage/to_stage/action/actor/reason/at)
- [ ] 감사 로그에 `itsm.loop.transition` 이벤트 발행
- [ ] WebSocket 으로 `ticket.stage_changed` 브로드캐스트 (`EventBroadcaster`)
- [ ] SLA 타이머 재계산: ANSWER/CLOSED 진입 시 해결 타이머 중단, REOPEN 시 재시작
- [ ] REJECT/ROLLBACK 은 RBAC `itsm.loop.rollback` 권한자만 호출 가능

## SLA 타이머

SLA 는 `응답시간(Response)` 과 `해결시간(Resolution)` 두 종류를 독립적으로 관리합니다.

### 정책 구조

```python
# itsm_sla_policy
# - priority: urgent | high | normal | low
# - response_minutes: int
# - resolution_minutes: int
# - business_hours_mode: "24x7" | "business_hours"
# - category: optional (일치 시 override)
```

### Redis 타이머 구조

```
itsm:sla:timers                → ZSET (score=deadline_epoch, member=ticket_id:kind)
itsm:sla:breaches              → ZSET (score=breached_at, member=ticket_id:kind)
itsm:sla:warn_sent:{ticket}:{kind}  → "1" (80% 경고 1회 발송 플래그, TTL=resolution)
```

### SLA 규칙

- [ ] 티켓 생성 시 `SLATimer.schedule(ticket_id, kind, deadline)` 로 응답+해결 타이머 등록
- [ ] 응답 타이머: 최초 담당자 액션(assign + comment) 시점에 중단 (`SLATimer.stop(kind="response")`)
- [ ] 해결 타이머: `ANSWER` 진입 시 중단, `REOPEN` 시 재계산하여 재등록
- [ ] APScheduler 가 10초 간격으로 `ZRANGEBYSCORE 0 now()` 호출 → 80% 경고·100% 위반 처리
- [ ] 위반 이벤트는 **v-itsm 내장 provider** (`app/providers/`) 로 담당 부서 채널에 알림 + `itsm_kpi_snapshot` 반영
- [ ] 영업시간 정책은 `business_hours_mode=business_hours` 일 때 공휴일/근무시간 테이블(`itsm_sla_calendar`)을 참조

## 알림 (v-itsm 내장 outbound provider)

Slack/Teams 알림은 **v-itsm 자체 provider** (`app/providers/slack_provider.py`, `teams_provider.py`) 로 Slack Web API / MS Graph 에 **직접 호출**합니다. v-channel-bridge 에 HTTP 의존하지 않습니다 — bridge 가 꺼져도 동작해야 합니다.

설계 배경: `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` §7.3 (v0.5 — embedded provider).

### 구조

```
app/
├── providers/
│   ├── base.py            # BaseOutboundProvider (추상) — bridge 에서 포팅
│   ├── slack_provider.py  # SlackOutboundProvider (AsyncWebClient chat_postMessage)
│   ├── teams_provider.py  # TeamsOutboundProvider (Graph client_credentials + webhook fallback)
│   ├── registry.py        # provider_registry (platform → provider 매핑)
│   └── __init__.py        # init_providers_from_env / shutdown_providers
├── schemas/
│   └── common_message.py  # CommonMessage / Platform / MessageType (bridge 에서 포팅)
└── services/
    └── notification_service.py   # 동기 공개 API + _fire_and_forget 브리지
```

### 공개 API (동기)

`notification_service` 는 동기 시그니처만 노출해 FSM/SLA 호출부에 async 가 새로 퍼지지 않게 합니다.

```python
# apps/v-itsm/backend/app/services/notification_service.py
import asyncio
import threading
import structlog

from app.providers.registry import provider_registry
from app.schemas.common_message import CommonMessage

logger = structlog.get_logger()


def notify_assignment(ticket, assignee_id: int | None) -> None:
    """배정 변경 알림. 티켓 커밋 후 호출. 실패는 fail-open (로그만)."""
    _fire_and_forget(_dispatch_assignment(ticket, assignee_id))


def notify_transition(ticket, from_stage: str, to_stage: str, actor_id: int) -> None:
    """Loop 전이 알림. post-commit 에서 호출."""
    _fire_and_forget(_dispatch_transition(ticket, from_stage, to_stage, actor_id))


def _fire_and_forget(coro) -> None:
    """실행 컨텍스트에 따라 분기.

    - FastAPI 요청 경로(async loop 활성): create_task
    - APScheduler job(sync thread): daemon thread + asyncio.run
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        threading.Thread(target=asyncio.run, args=(coro,), daemon=True).start()


async def _dispatch_all(message: CommonMessage) -> None:
    for target in _resolve_targets():
        provider = provider_registry.get(target.platform)
        if provider is None:
            continue
        try:
            await provider.send_message(target.channel_id, message)
        except Exception as exc:
            logger.warning("itsm.notify.failed",
                           platform=target.platform, error=str(exc))
```

### 훅 지점 3곳

| 호출부 | 함수 | 타이밍 |
|---|---|---|
| `ticket_service.update()` | `notify_assignment` | owner 변경 후 (post-commit) |
| `ticket_service.transition()` | `notify_transition` | 전이 후 (post-commit) |
| `sla_timer._notify_warning/_notify_breach` | `notify_sla_*` | SLA 80% / 100% 감지 시 |

### Provider 라이프사이클

```python
# app/main.py lifespan
from app.providers import init_providers_from_env, shutdown_providers

async def lifespan(app):
    await init_providers_from_env()   # env 누락은 silently skip
    yield
    await shutdown_providers()
```

### 체크리스트

- [ ] `apps/v-channel-bridge/**` 를 **import 하지 않는다** (copy-not-import)
- [ ] v-channel-bridge 에 **HTTP 호출도 하지 않는다** (bridge 가 꺼져도 동작)
- [ ] v-channel-bridge 코드·스키마를 수정하지 않는다 (원본은 bridge 에 그대로 유지)
- [ ] 알림 실패는 FSM 전이 / 티켓 처리를 막지 않는다 (fail-open, WARN 로그만)
- [ ] 알림 훅은 **DB 커밋 후** 배치 (예외가 트랜잭션을 롤백시키지 않도록)
- [ ] 개인정보·민감 토큰은 메시지 payload 에 포함 금지
- [ ] 공용 env(`TEAMS_TENANT_ID/APP_ID/APP_PASSWORD`) 는 루트 `.env`, 앱 고유(`SLACK_BOT_TOKEN`, `TEAMS_TEAM_ID`, `TEAMS_NOTIFICATION_URL`, `ITSM_DEFAULT_NOTIFY_CHANNELS`) 는 `apps/v-itsm/.env`

## AI 기능 (v-ui-builder 의 BaseLLMProvider 재사용)

AI 초안·추천·요약은 v-ui-builder 의 `BaseLLMProvider` 를 import 해 재사용합니다. Provider 계약 자체는 변경 금지.

```python
# apps/v-itsm/backend/app/services/ai_suggester.py
from v_ui_builder_providers import BaseLLMProvider  # pnpm/py workspace 에서 제공

class TicketAiSuggester:
    def __init__(self, llm: BaseLLMProvider):
        self.llm = llm

    async def suggest_reply(self, ticket, context: str) -> str:
        messages = [
            {"role": "system", "content": "ITSM 답변 초안을 간결/정중하게 작성하라."},
            {"role": "user",   "content": f"[티켓]\n{ticket.title}\n\n[컨텍스트]\n{context}"},
        ]
        chunks = []
        async for delta in self.llm.stream(messages):
            chunks.append(delta.content)
        return "".join(chunks)
```

**체크리스트**:
- [ ] Provider 계약(`stream`, 메시지 포맷) 확장이 필요하면 v-ui-builder 스코프에서 별도 논의
- [ ] 생성 결과는 `itsm_ai_suggestion` 에 기록(원문 + 채택 여부)
- [ ] AI 채택률(`adopted / total`) 은 KPI 스냅샷에 반영

## KPI 스냅샷

일간/주간/월간 KPI 는 `itsm_kpi_snapshot` 에 누적 스냅샷으로 저장합니다. 실시간 계산은 피하세요.

| 지표 | 계산식 |
|---|---|
| SLA 준수율 | `on_time / total` (해결 기준) |
| MTTR | `avg(resolved_at - created_at)` |
| Re-open Rate | `reopen_count / closed_count` |
| 부서별 처리량 | `count(ticket group by department)` |
| AI 채택률 | `adopted / suggested` |

**체크리스트**:
- [ ] 스냅샷 작성은 APScheduler 야간 잡 (`itsm.kpi.nightly`) 에서 수행
- [ ] Recharts 는 스냅샷 테이블을 직접 조회 (트랜잭션 DB 부하 방지)
- [ ] 부서 집계는 `users.department_id` → `organizations` 조인, 플랫폼 조직도 재사용

## 비동기 & 로깅 규칙

- [ ] 네트워크 I/O: `async def`
- [ ] Redis 작업: `redis.asyncio`
- [ ] DB 작업: SQLAlchemy async (세션은 platform 의 `get_async_session` 의존성 사용)
- [ ] `time.sleep()` 금지, `asyncio.sleep()`
- [ ] 로깅: `structlog.get_logger()` — 이벤트 키는 `itsm.*` (예: `itsm.ticket.created`, `itsm.sla.breach`)

## 테스트 규칙

```python
# apps/v-itsm/backend/tests/services/test_loop_fsm.py
import pytest
from app.services.loop_fsm import LoopFSM, LoopAction, LoopStage

@pytest.mark.asyncio
async def test_advance_intake_to_analyze(db_session, ticket_factory):
    ticket = await ticket_factory(stage=LoopStage.INTAKE)
    fsm = LoopFSM(db_session)
    await fsm.transition(ticket, LoopAction.ADVANCE, actor_id="u1", reason="ok")
    assert ticket.stage == LoopStage.ANALYZE
```

**체크리스트**:
- [ ] FSM 전이 케이스별 단위 테스트(허용/거부/권한)
- [ ] SLA 타이머: 경고/위반 경계 케이스(80%, 100%, 영업시간 롤오버)
- [ ] 알림 provider 는 `AsyncMock` 으로 `SlackOutboundProvider.send_message` / `TeamsOutboundProvider.send_message` 스터빙
- [ ] AI Suggester 는 fake LLM (`async generator`) 으로 결정론적 결과 검증
- [ ] 플랫폼 인증/권한은 `v_platform.testing` fixture 재사용
