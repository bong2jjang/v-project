"""Loop FSM — 5단계 업무 루프 상태 전이 엔진.

설계 문서 `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` §4.2 / §5 기준.

상태: intake → analyze → execute → verify → answer → closed
행동: advance / reject / on_hold / resume / rollback / reopen

순수 함수로 구성하여 서비스 레이어(`ticket_service`)에서 호출한다.
전이 이력은 호출자가 `itsm_loop_transition` 에 기록한다.
"""

from __future__ import annotations

from app.models.enums import LoopAction, LoopStage


class LoopTransitionError(ValueError):
    """허용되지 않은 Loop FSM 전이를 시도했을 때 발생."""


ALLOWED: dict[LoopStage, dict[LoopAction, LoopStage]] = {
    LoopStage.INTAKE: {
        LoopAction.ADVANCE: LoopStage.ANALYZE,
        LoopAction.REJECT: LoopStage.CLOSED,
    },
    LoopStage.ANALYZE: {
        LoopAction.ADVANCE: LoopStage.EXECUTE,
        LoopAction.REJECT: LoopStage.CLOSED,
        LoopAction.ON_HOLD: LoopStage.ANALYZE,
        LoopAction.RESUME: LoopStage.ANALYZE,
    },
    LoopStage.EXECUTE: {
        LoopAction.ADVANCE: LoopStage.VERIFY,
        LoopAction.ROLLBACK: LoopStage.ANALYZE,
        LoopAction.ON_HOLD: LoopStage.EXECUTE,
        LoopAction.RESUME: LoopStage.EXECUTE,
    },
    LoopStage.VERIFY: {
        LoopAction.ADVANCE: LoopStage.ANSWER,
        LoopAction.ROLLBACK: LoopStage.EXECUTE,
        LoopAction.ON_HOLD: LoopStage.VERIFY,
        LoopAction.RESUME: LoopStage.VERIFY,
    },
    LoopStage.ANSWER: {
        LoopAction.ADVANCE: LoopStage.CLOSED,
        LoopAction.REOPEN: LoopStage.ANALYZE,
    },
    LoopStage.CLOSED: {
        LoopAction.REOPEN: LoopStage.ANALYZE,
    },
}


TERMINAL_STAGES: frozenset[LoopStage] = frozenset({LoopStage.CLOSED})


def advance(current: LoopStage, action: LoopAction) -> LoopStage:
    """현재 단계에서 액션을 적용해 다음 단계를 반환.

    허용되지 않은 전이인 경우 `LoopTransitionError` 를 발생시킨다.
    `on_hold` / `resume` 은 단계를 변경하지 않지만 전이 기록 목적으로 허용된다.
    """
    stage_rules = ALLOWED.get(current)
    if not stage_rules or action not in stage_rules:
        raise LoopTransitionError(
            f"전이 불가: {current.value} 에서 {action.value} 액션은 허용되지 않습니다"
        )
    return stage_rules[action]


def allowed_actions(current: LoopStage) -> list[LoopAction]:
    """UI/검증용: 현재 단계에서 선택 가능한 액션 목록."""
    return list(ALLOWED.get(current, {}).keys())


def is_terminal(stage: LoopStage) -> bool:
    return stage in TERMINAL_STAGES
