"""Create uploaded_files table for DB BLOB storage.

멀티앱 아키텍처에서 각 앱의 Docker 볼륨이 격리되어 있어, bridge-backend가
저장한 아바타 파일을 portal-backend가 서빙할 수 없는 문제가 있었습니다.
파일을 PostgreSQL(공유 DB)에 BYTEA로 저장하여 볼륨 격리 이슈를 해결합니다.

- id: UUID (VARCHAR(36)) — URL 식별자
- content: BYTEA — 파일 내용
- mime_type: VARCHAR(100)
- size: INTEGER — 바이트 단위 크기
- purpose: VARCHAR(32) — 'avatar' | 'image'
- uploaded_by: FK users.id (nullable, ON DELETE SET NULL)
- uploaded_at: TIMESTAMPTZ
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'uploaded_files'
                """
            )
        ).fetchone()

        if result is None:
            conn.execute(
                text(
                    """
                    CREATE TABLE uploaded_files (
                        id VARCHAR(36) PRIMARY KEY,
                        content BYTEA NOT NULL,
                        mime_type VARCHAR(100) NOT NULL,
                        size INTEGER NOT NULL,
                        purpose VARCHAR(32) NOT NULL,
                        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX idx_uploaded_files_purpose "
                    "ON uploaded_files (purpose)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX idx_uploaded_files_uploaded_by "
                    "ON uploaded_files (uploaded_by)"
                )
            )
            conn.commit()
            logger.info("p029: uploaded_files table created")
        else:
            logger.info("p029: uploaded_files already exists, skipping")
