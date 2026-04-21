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
- [ ] 위반 이벤트는 v-channel-bridge 를 통해 담당 부서 채널에 알림 + `itsm_kpi_snapshot` 반영
- [ ] 영업시간 정책은 `business_hours_mode=business_hours` 일 때 공휴일/근무시간 테이블(`itsm_sla_calendar`)을 참조

## 알림 (v-channel-bridge 위임)

직접 Slack/Teams/Email SDK 를 호출하지 말고, v-channel-bridge 를 얇은 HTTP 어댑터로 사용하세요.

```python
# apps/v-itsm/backend/app/services/notifier.py
import httpx
import structlog
from v_platform.core.settings import settings

logger = structlog.get_logger()

class BridgeNotifier:
    """v-channel-bridge 로 채널 알림을 위임.

    bridge 자체는 수정하지 않으며, 공개 REST 계약만 사용한다.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def send(self, channel: str, target: str, payload: dict) -> bool:
        url = f"{self.base_url}/api/notifications/send"
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                resp = await client.post(url, json={
                    "channel": channel,   # "slack" | "teams" | "email"
                    "target":  target,    # channel_id or email
                    "payload": payload,
                })
                resp.raise_for_status()
                return True
            except httpx.HTTPError as exc:
                logger.error("itsm.notify.failed",
                             channel=channel, target=target, error=str(exc))
                return False
```

**체크리스트**:
- [ ] `apps/v-channel-bridge/**` 를 import 하지 않는다 (HTTP 경계 유지)
- [ ] 알림 실패는 티켓 처리 실패로 이어지지 않게 격리
- [ ] 개인정보·민감 토큰은 payload 에 포함 금지

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
- [ ] 알림 어댑터는 `httpx_mock` 으로 bridge API 모킹
- [ ] AI Suggester 는 fake LLM (`async generator`) 으로 결정론적 결과 검증
- [ ] 플랫폼 인증/권한은 `v_platform.testing` fixture 재사용
