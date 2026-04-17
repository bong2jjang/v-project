"""a001: v-ui-builder 핵심 테이블 생성.

- ui_builder_projects  : 프로젝트 메타
- ui_builder_messages  : LLM 대화 히스토리
- ui_builder_artifacts : 파일 스냅샷 (버전)

멱등성 보장 — 테이블 존재 시 스킵.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def _table_exists(conn, name: str) -> bool:
    result = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = :name"
        ),
        {"name": name},
    )
    return result.fetchone() is not None


def migrate(engine):
    with engine.connect() as conn:
        if _table_exists(conn, "ui_builder_projects"):
            logger.info("ui_builder_* tables already exist, skipping a001")
            return

        conn.execute(text("""
            CREATE TABLE ui_builder_projects (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id      INTEGER NOT NULL REFERENCES users(id),
                name         VARCHAR(200) NOT NULL,
                description  TEXT,
                template     VARCHAR(50) NOT NULL DEFAULT 'react-ts',
                llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
                llm_model    VARCHAR(100),
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))

        conn.execute(text("""
            CREATE TABLE ui_builder_messages (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
                role       VARCHAR(20) NOT NULL,
                content    TEXT NOT NULL,
                tokens_in  INTEGER,
                tokens_out INTEGER,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))

        conn.execute(text("""
            CREATE TABLE ui_builder_artifacts (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id  UUID NOT NULL REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
                file_path   VARCHAR(500) NOT NULL,
                content     TEXT NOT NULL,
                version     INTEGER NOT NULL DEFAULT 1,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (project_id, file_path, version)
            )
        """))

        conn.execute(text(
            "CREATE INDEX idx_ui_builder_messages_project "
            "ON ui_builder_messages(project_id, created_at)"
        ))
        conn.execute(text(
            "CREATE INDEX idx_ui_builder_artifacts_project "
            "ON ui_builder_artifacts(project_id, file_path, version DESC)"
        ))

        conn.commit()
        logger.info("a001: created ui_builder_projects/messages/artifacts")
