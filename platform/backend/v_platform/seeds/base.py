"""Base seed — fresh install 최소 필수 데이터.

마이그레이션이 이미 생성하는 데이터:
  - menu_items (p001, p007)
  - permission_groups 기본 3개 (p006, p009)
  - permission_group_grants (p006, p007)
  - system_notifications (p021)

base seed가 추가로 생성하는 데이터:
  - 기본 회사 (companies)
  - 관리자 계정 (users) — admin@example.com / Admin123!
  - system_settings 기본 레코드
  - 관리자-권한그룹 매핑 (user_group_memberships)
"""

import logging

from sqlalchemy import text

from v_platform.utils.auth import get_password_hash

logger = logging.getLogger(__name__)

ADMIN_EMAIL = "admin@example.com"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Admin123!"


def seed_base(conn):
    """Fresh install 최소 시드 데이터 삽입 (idempotent)."""
    _seed_company(conn)
    _seed_admin_user(conn)
    _seed_system_settings(conn)
    _seed_admin_group_membership(conn)


def _seed_company(conn):
    """기본 회사 생성."""
    conn.execute(
        text(
            """
            INSERT INTO companies (id, name, code, created_at, updated_at)
            VALUES (1, 'Default Company', 'DEFAULT', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """
        )
    )
    conn.execute(
        text(
            "SELECT setval('companies_id_seq', GREATEST((SELECT MAX(id) FROM companies), 1))"
        )
    )
    logger.info("Base seed: company")


def _seed_admin_user(conn):
    """관리자 계정 생성."""
    existing = conn.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    ).fetchone()

    if existing:
        logger.info("Base seed: admin user already exists, skipping")
        return

    hashed = get_password_hash(ADMIN_PASSWORD)
    conn.execute(
        text(
            """
            INSERT INTO users (email, username, hashed_password, role, is_active,
                               company_id, auth_method, start_page, theme, color_preset,
                               created_at, updated_at)
            VALUES (:email, :username, :hashed_password, 'SYSTEM_ADMIN', TRUE,
                    1, 'local', '', 'system', 'blue',
                    NOW(), NOW())
            """
        ),
        {
            "email": ADMIN_EMAIL,
            "username": ADMIN_USERNAME,
            "hashed_password": hashed,
        },
    )
    logger.info("Base seed: admin user created (admin@example.com / Admin123!)")


def _seed_system_settings(conn):
    """시스템 설정 기본 레코드."""
    conn.execute(
        text(
            """
            INSERT INTO system_settings (id, manual_enabled, manual_url,
                                         default_start_page, app_title, app_description)
            VALUES (1, FALSE, '', '/', 'v-platform', '통합 관리 플랫폼')
            ON CONFLICT (id) DO NOTHING
            """
        )
    )
    conn.execute(
        text(
            "SELECT setval('system_settings_id_seq', GREATEST((SELECT MAX(id) FROM system_settings), 1))"
        )
    )
    logger.info("Base seed: system_settings")


def _seed_admin_group_membership(conn):
    """관리자를 '시스템 관리자' 권한그룹에 매핑."""
    conn.execute(
        text(
            """
            INSERT INTO user_group_memberships (user_id, permission_group_id, created_at)
            SELECT u.id, pg.id, NOW()
            FROM users u
            CROSS JOIN permission_groups pg
            WHERE u.email = :email
              AND pg.is_default = TRUE
              AND pg.description LIKE '%%(system_admin)%%'
            ON CONFLICT (user_id, permission_group_id) DO NOTHING
            """
        ),
        {"email": ADMIN_EMAIL},
    )
    logger.info("Base seed: admin group membership")
