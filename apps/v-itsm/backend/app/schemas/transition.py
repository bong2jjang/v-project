"""Loop transition 편집/삭제/복원/되돌리기 스키마 (Pydantic v2).

설계 문서 `docusaurus/docs/apps/v-itsm/design/LOOP_TRANSITION_EDITING_DESIGN.md` §6 기준.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── 요청 ─────────────────────────────────────────────────────
class TransitionEditRequest(BaseModel):
    """PATCH /api/tickets/{ticket_id}/transitions/{transition_id}"""

    note: str | None = None
    artifacts: dict | None = None
    reason: str | None = Field(default=None, max_length=500)


class TransitionDeleteRequest(BaseModel):
    """DELETE body (FastAPI 는 DELETE 에도 body 허용)."""

    reason: str | None = Field(default=None, max_length=500)


class TransitionRestoreRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class TransitionRevertRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


# ── 응답 ─────────────────────────────────────────────────────
class LoopTransitionRevisionOut(BaseModel):
    """리비전 단건 — 이력 다이얼로그·diff 뷰에 사용."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    transition_id: str
    revision_no: int
    operation: str
    actor_id: int | None
    reason: str | None
    snapshot_note: str | None
    snapshot_artifacts: dict | None
    snapshot_from_stage: str | None
    snapshot_to_stage: str | None
    snapshot_action: str | None
    created_at: datetime


class LoopTransitionDetailOut(BaseModel):
    """편집 메타 + UI 버튼 상태를 포함한 확장 응답.

    `LoopTransitionOut` 과 호환 필드를 공유하되, 편집/삭제/복원 상태·버튼 플래그·
    최신 리비전 요약을 추가한다. 목록 API 가 `include_deleted=true` 또는
    `with_latest_revision=true` 일 때 이 스키마를 사용한다.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    from_stage: str | None
    to_stage: str
    action: str
    actor_id: int | None
    note: str | None
    artifacts: dict | None
    transitioned_at: datetime

    deleted_at: datetime | None = None
    deleted_by: int | None = None
    last_edited_at: datetime | None = None
    last_edited_by: int | None = None
    edit_count: int = 0
    head_revision_id: str | None = None

    # UI 버튼 활성화 — 서버가 계산해 내려줌
    can_edit: bool = False
    can_delete: bool = False
    can_restore: bool = False

    # 최신 리비전 요약 (목록에서 편집/삭제 배지 표시용)
    latest_revision: LoopTransitionRevisionOut | None = None
