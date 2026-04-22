"""a010: Loop transition 편집/삭제/복원 + 리비전 이력.

설계 문서 `docusaurus/docs/apps/v-itsm/design/LOOP_TRANSITION_EDITING_DESIGN.md` §4 기준.

작업:
  1. `itsm_loop_transition` 에 6개 컬럼 추가
     - deleted_at / deleted_by : 소프트 삭제
     - last_edited_at / last_edited_by / edit_count : 편집 추적
     - head_revision_id : 현재 헤드 리비전 참조 (FK 는 순환 참조 때문에 나중에)
  2. `itsm_loop_transition_revision` 신규 테이블 (전이 스냅샷)
  3. 기존 전이 로우에 revision_no=1 백필

멱등: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, 백필은 존재 체크 후 INSERT.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from ulid import ULID

logger = logging.getLogger(__name__)


ALTER_TRANSITION: list[str] = [
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id)",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS last_edited_by INTEGER REFERENCES users(id)",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS head_revision_id VARCHAR(26)",
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_loop_transition_deleted
        ON itsm_loop_transition(deleted_at) WHERE deleted_at IS NOT NULL
    """,
]

CREATE_REVISION = """
CREATE TABLE IF NOT EXISTS itsm_loop_transition_revision (
    id                  VARCHAR(26) PRIMARY KEY,
    transition_id       VARCHAR(26) NOT NULL REFERENCES itsm_loop_transition(id) ON DELETE CASCADE,
    revision_no         INTEGER     NOT NULL,
    operation           VARCHAR(20) NOT NULL,
    actor_id            INTEGER     REFERENCES users(id),
    reason              TEXT,
    snapshot_note       TEXT,
    snapshot_artifacts  JSONB,
    snapshot_from_stage VARCHAR(20),
    snapshot_to_stage   VARCHAR(20),
    snapshot_action     VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_itsm_transition_revision UNIQUE (transition_id, revision_no)
)
"""

REVISION_INDEXES = [
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_loop_transition_revision_tid
        ON itsm_loop_transition_revision(transition_id, revision_no DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_loop_transition_revision_actor
        ON itsm_loop_transition_revision(actor_id, created_at DESC)
    """,
]


BACKFILL_QUERY = text(
    """
    SELECT t.id, t.note, t.artifacts, t.from_stage, t.to_stage, t.action, t.actor_id, t.transitioned_at
      FROM itsm_loop_transition t
      LEFT JOIN itsm_loop_transition_revision r
        ON r.transition_id = t.id AND r.revision_no = 1
     WHERE r.id IS NULL
    """
)

INSERT_REVISION = text(
    """
    INSERT INTO itsm_loop_transition_revision (
        id, transition_id, revision_no, operation, actor_id, reason,
        snapshot_note, snapshot_artifacts,
        snapshot_from_stage, snapshot_to_stage, snapshot_action,
        created_at
    ) VALUES (
        :id, :transition_id, 1, 'create', :actor_id, NULL,
        :snapshot_note, CAST(:snapshot_artifacts AS JSONB),
        :snapshot_from_stage, :snapshot_to_stage, :snapshot_action,
        :created_at
    )
    """
)

UPDATE_HEAD = text(
    """
    UPDATE itsm_loop_transition
       SET head_revision_id = :rid
     WHERE id = :tid AND head_revision_id IS NULL
    """
)


def migrate(engine):
    import json

    with engine.connect() as conn:
        for stmt in ALTER_TRANSITION:
            conn.execute(text(stmt))
        conn.execute(text(CREATE_REVISION))
        for stmt in REVISION_INDEXES:
            conn.execute(text(stmt))

        rows = conn.execute(BACKFILL_QUERY).fetchall()
        backfilled = 0
        for row in rows:
            rid = str(ULID())
            artifacts_json = json.dumps(row.artifacts) if row.artifacts is not None else None
            conn.execute(
                INSERT_REVISION,
                {
                    "id": rid,
                    "transition_id": row.id,
                    "actor_id": row.actor_id,
                    "snapshot_note": row.note,
                    "snapshot_artifacts": artifacts_json,
                    "snapshot_from_stage": row.from_stage,
                    "snapshot_to_stage": row.to_stage,
                    "snapshot_action": row.action,
                    "created_at": row.transitioned_at,
                },
            )
            conn.execute(UPDATE_HEAD, {"rid": rid, "tid": row.id})
            backfilled += 1
        conn.commit()

    logger.info(
        "a010: transition edit/restore columns + revision table applied (backfilled=%d)",
        backfilled,
    )
