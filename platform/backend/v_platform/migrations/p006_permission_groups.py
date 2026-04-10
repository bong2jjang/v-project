"""013: 권한 그룹 테이블 + 시드 데이터

- permission_groups 테이블 생성
- permission_group_grants 테이블 생성
- user_group_memberships 테이블 생성
- 디폴트 그룹 3개 시드 + 권한 매핑
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # 1. permission_groups 테이블
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS permission_groups (
                        id          SERIAL PRIMARY KEY,
                        name        VARCHAR(100) NOT NULL UNIQUE,
                        description VARCHAR(500),
                        is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
                        is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
                        created_by  INTEGER      REFERENCES users(id),
                        created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
                        updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )

            # 2. permission_group_grants 테이블
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS permission_group_grants (
                        id                  SERIAL PRIMARY KEY,
                        permission_group_id INTEGER     NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
                        menu_item_id        INTEGER     NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
                        access_level        VARCHAR(10) NOT NULL DEFAULT 'none',
                        UNIQUE(permission_group_id, menu_item_id)
                    )
                    """
                )
            )

            # 3. user_group_memberships 테이블
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS user_group_memberships (
                        id                  SERIAL PRIMARY KEY,
                        user_id             INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        permission_group_id INTEGER   NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
                        assigned_by         INTEGER   REFERENCES users(id),
                        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
                        UNIQUE(user_id, permission_group_id)
                    )
                    """
                )
            )

            # 4. DB-level 기본값 설정 (SQLAlchemy create_all이 server_default 없이 만들었을 수 있음)
            defaults = [
                ("permission_groups", "is_default", "FALSE"),
                ("permission_groups", "is_active", "TRUE"),
                ("permission_groups", "created_at", "NOW()"),
                ("permission_groups", "updated_at", "NOW()"),
                ("permission_group_grants", "access_level", "'none'"),
                ("user_group_memberships", "created_at", "NOW()"),
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

            # 5. 디폴트 그룹 시드 데이터
            conn.execute(
                text(
                    """
                    INSERT INTO permission_groups (name, description, is_default, is_active, created_at, updated_at)
                    VALUES
                        ('전체 관리자', '모든 메뉴에 대한 write 권한', TRUE, TRUE, NOW(), NOW()),
                        ('운영자', '기본 메뉴 write + 관리 메뉴 read 권한', TRUE, TRUE, NOW(), NOW()),
                        ('뷰어', '기본 메뉴 read 전용 권한', TRUE, TRUE, NOW(), NOW())
                    ON CONFLICT (name) DO NOTHING
                    """
                )
            )

            # 6. 디폴트 그룹에 메뉴 권한 매핑
            # 전체 관리자: 모든 메뉴 write
            conn.execute(
                text(
                    """
                    INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
                    SELECT pg.id, mi.id, 'write'
                    FROM permission_groups pg
                    CROSS JOIN menu_items mi
                    WHERE pg.name = '전체 관리자'
                      AND mi.menu_type != 'menu_group'
                      AND mi.is_active = TRUE
                    ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                    """
                )
            )

            # 운영자: 기본 메뉴 write + 관리 메뉴 read
            conn.execute(
                text(
                    """
                    INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
                    SELECT pg.id, mi.id,
                        CASE WHEN mi.section = 'basic' THEN 'write'
                             WHEN mi.section = 'admin' THEN 'read'
                             ELSE 'none'
                        END
                    FROM permission_groups pg
                    CROSS JOIN menu_items mi
                    WHERE pg.name = '운영자'
                      AND mi.menu_type != 'menu_group'
                      AND mi.is_active = TRUE
                    ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                    """
                )
            )

            # 뷰어: 기본 메뉴 read
            conn.execute(
                text(
                    """
                    INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
                    SELECT pg.id, mi.id, 'read'
                    FROM permission_groups pg
                    CROSS JOIN menu_items mi
                    WHERE pg.name = '뷰어'
                      AND mi.section = 'basic'
                      AND mi.menu_type != 'menu_group'
                      AND mi.is_active = TRUE
                    ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                    """
                )
            )

            conn.commit()
            logger.info("Migration 013 completed: permission groups + seed data")
            return True

    except Exception as e:
        logger.error(f"Migration 013 failed: {e}")
        return False
