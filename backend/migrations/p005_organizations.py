"""012: 조직 테이블 (회사, 부서) + users FK 추가

- companies 테이블 생성
- departments 테이블 생성
- users 테이블에 company_id, department_id FK 추가
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # 1. companies 테이블
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS companies (
                        id          SERIAL PRIMARY KEY,
                        name        VARCHAR(200) NOT NULL UNIQUE,
                        code        VARCHAR(50)  NOT NULL UNIQUE,
                        is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
                        created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
                        updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )

            # 2. departments 테이블
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS departments (
                        id          SERIAL PRIMARY KEY,
                        company_id  INTEGER      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                        name        VARCHAR(200) NOT NULL,
                        code        VARCHAR(50),
                        parent_id   INTEGER      REFERENCES departments(id) ON DELETE SET NULL,
                        sort_order  INTEGER      DEFAULT 0,
                        is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
                        created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
                        updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
                        UNIQUE(company_id, name)
                    )
                    """
                )
            )

            # 3. users 테이블에 FK 추가
            # company_id
            result = conn.execute(
                text(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'company_id'
                    """
                )
            )
            if not result.fetchone():
                conn.execute(
                    text(
                        """
                        ALTER TABLE users
                        ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL
                        """
                    )
                )

            # department_id
            result = conn.execute(
                text(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'department_id'
                    """
                )
            )
            if not result.fetchone():
                conn.execute(
                    text(
                        """
                        ALTER TABLE users
                        ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL
                        """
                    )
                )

            # 4. DB-level defaults 설정 (SQLAlchemy create_all이 server_default 없이 만들었을 수 있음)
            defaults = [
                ("companies", "is_active", "TRUE"),
                ("companies", "created_at", "NOW()"),
                ("companies", "updated_at", "NOW()"),
                ("departments", "is_active", "TRUE"),
                ("departments", "sort_order", "0"),
                ("departments", "created_at", "NOW()"),
                ("departments", "updated_at", "NOW()"),
            ]
            for table, col, val in defaults:
                try:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table} ALTER COLUMN {col} SET DEFAULT {val}"
                        )
                    )
                except Exception:
                    pass

            conn.commit()
            logger.info(
                "Migration 012 completed: companies, departments tables + user FK columns"
            )
            return True

    except Exception as e:
        logger.error(f"Migration 012 failed: {e}")
        return False
