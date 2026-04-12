"""Demo seed — 개발/테스트용 샘플 데이터 (플랫폼 공통).

base seed 위에 추가로:
  - 조직 구조 (부서 계층)
  - 추가 사용자 (org_admin, 일반 사용자)
  - 커스텀 권한그룹 (플랫폼 공통 메뉴만 참조)
  - 사용자-그룹 매핑
  - 메뉴 section 보정 (플랫폼 공통 메뉴만)
  - 개별 사용자 권한 오버라이드

Note: 앱 전용 메뉴(channels, messages 등)의 section/grant는
각 앱의 마이그레이션(a*.py)에서 관리합니다.
"""

import logging

from sqlalchemy import text

from v_platform.utils.auth import get_password_hash

logger = logging.getLogger(__name__)

# 비밀번호 통일: 모든 데모 사용자 동일
DEMO_PASSWORD = "Demo123!"

# ─────────────────────────────────────────────────────────────────────────────
# 데이터 정의
# ─────────────────────────────────────────────────────────────────────────────

DEPARTMENTS_TOP = [
    # (name, sort_order)
    ("대표이사", 0),
    ("전략사업부", 10),
    ("경영지원실", 20),
    ("글로벌사업부", 30),
    ("솔루션사업본부", 40),
    ("기획영업본부", 50),
    ("외부조직", 60),
]

DEPARTMENTS_SUB = [
    # (name, parent_name, sort_order)
    ("제품사업그룹", "솔루션사업본부", 0),
    ("운영1그룹", "솔루션사업본부", 10),
    ("운영2그룹", "솔루션사업본부", 20),
    ("제품팀", "제품사업그룹", 0),
    ("사업팀", "제품사업그룹", 10),
]

DEMO_USERS = [
    # (email, username, role, department_name, auth_method)
    ("orgadmin@demo.local", "데모관리자", "ORG_ADMIN", "전략사업부", "local"),
    ("user1@demo.local", "김테스트", "USER", "제품팀", "local"),
    ("user2@demo.local", "이데모", "USER", "운영1그룹", "local"),
    ("user3@demo.local", "박샘플", "USER", "경영지원실", "local"),
]

CUSTOM_GROUPS = [
    # (name, description)
    ("데모그룹-운영", "운영 부서 전용 — 플랫폼 공통 메뉴 write + 관리 일부 read"),
    ("데모그룹-뷰어", "외부 조직용 — 대시보드 + 도움말 read only"),
]

# 플랫폼 공통 메뉴 section 설정 (migration에서 누락되는 부분)
# 앱 전용 메뉴(channels, messages 등)는 각 앱 마이그레이션에서 관리
MENU_SECTIONS = [
    ("dashboard", "basic"),
    ("settings", "basic"),
    ("help", "basic"),
    ("users", "admin"),
    ("audit_logs", "admin"),
    ("menu_management", "admin"),
    ("permission_management", "admin"),
    ("permission_groups", "admin"),
    ("organizations", "admin"),
]


def seed_demo(conn):
    """데모 데이터 삽입 (idempotent)."""
    _seed_departments(conn)
    _seed_users(conn)
    _seed_menu_sections(conn)
    _seed_custom_groups(conn)
    _seed_group_grants(conn)
    _seed_user_group_memberships(conn)
    _seed_user_permissions(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 부서
# ─────────────────────────────────────────────────────────────────────────────


def _seed_departments(conn):
    """부서 계층 구조 생성."""
    # 최상위 부서
    for name, sort_order in DEPARTMENTS_TOP:
        conn.execute(
            text(
                """
                INSERT INTO departments (company_id, name, parent_id, sort_order, is_active, created_at, updated_at)
                SELECT 1, :name, NULL, :sort_order, TRUE, NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM departments WHERE name = :name AND company_id = 1
                )
                """
            ),
            {"name": name, "sort_order": sort_order},
        )

    # 하위 부서
    for name, parent_name, sort_order in DEPARTMENTS_SUB:
        conn.execute(
            text(
                """
                INSERT INTO departments (company_id, name, parent_id, sort_order, is_active, created_at, updated_at)
                SELECT 1, :name, p.id, :sort_order, TRUE, NOW(), NOW()
                FROM departments p
                WHERE p.name = :parent_name AND p.company_id = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM departments WHERE name = :name AND company_id = 1
                  )
                """
            ),
            {"name": name, "parent_name": parent_name, "sort_order": sort_order},
        )

    logger.info(
        "Demo seed: departments (top=%d, sub=%d)",
        len(DEPARTMENTS_TOP),
        len(DEPARTMENTS_SUB),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 사용자
# ─────────────────────────────────────────────────────────────────────────────


def _seed_users(conn):
    """데모 사용자 생성."""
    hashed = get_password_hash(DEMO_PASSWORD)

    for email, username, role, dept_name, auth_method in DEMO_USERS:
        existing = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email},
        ).fetchone()
        if existing:
            continue

        conn.execute(
            text(
                """
                INSERT INTO users (email, username, hashed_password, role, is_active,
                                   company_id, department_id, auth_method,
                                   start_page, theme, color_preset,
                                   created_at, updated_at)
                SELECT :email, :username, :hashed_password, :role, TRUE,
                       1, d.id, :auth_method,
                       '', 'system', 'blue',
                       NOW(), NOW()
                FROM departments d
                WHERE d.name = :dept_name AND d.company_id = 1
                """
            ),
            {
                "email": email,
                "username": username,
                "hashed_password": hashed,
                "role": role,
                "dept_name": dept_name,
                "auth_method": auth_method,
            },
        )

    logger.info("Demo seed: %d users", len(DEMO_USERS))


# ─────────────────────────────────────────────────────────────────────────────
# 메뉴 section 보정
# ─────────────────────────────────────────────────────────────────────────────


def _seed_menu_sections(conn):
    """메뉴 section 값 설정 (마이그레이션에서 누락될 수 있는 부분)."""
    for pkey, section in MENU_SECTIONS:
        conn.execute(
            text(
                """
                UPDATE menu_items SET section = :section
                WHERE permission_key = :pkey AND (section IS NULL OR section = '')
                """
            ),
            {"pkey": pkey, "section": section},
        )
    logger.info("Demo seed: menu sections updated")


# ─────────────────────────────────────────────────────────────────────────────
# 커스텀 권한그룹
# ─────────────────────────────────────────────────────────────────────────────


def _seed_custom_groups(conn):
    """데모 커스텀 권한그룹 생성."""
    admin = conn.execute(
        text("SELECT id FROM users WHERE email = 'admin@example.com'")
    ).fetchone()
    admin_id = admin[0] if admin else None

    for name, desc in CUSTOM_GROUPS:
        conn.execute(
            text(
                """
                INSERT INTO permission_groups (name, description, is_default, is_active,
                                               created_by, created_at, updated_at)
                VALUES (:name, :desc, FALSE, TRUE, :admin_id, NOW(), NOW())
                ON CONFLICT (name) DO NOTHING
                """
            ),
            {"name": name, "desc": desc, "admin_id": admin_id},
        )

    logger.info("Demo seed: %d custom groups", len(CUSTOM_GROUPS))


# ─────────────────────────────────────────────────────────────────────────────
# 권한그룹 grants (커스텀 그룹용)
# ─────────────────────────────────────────────────────────────────────────────


def _seed_group_grants(conn):
    """커스텀 그룹에 메뉴 권한 매핑."""
    # 데모그룹-운영: 플랫폼 공통 메뉴 write + 관리 일부 read
    # 앱 전용 메뉴 권한은 각 앱 마이그레이션에서 추가
    _grant_group(
        conn,
        "데모그룹-운영",
        {
            "dashboard": "write",
            "settings": "write",
            "help": "write",
            "users": "read",
            "organizations": "read",
        },
    )

    # 데모그룹-뷰어: 최소 read
    _grant_group(
        conn,
        "데모그룹-뷰어",
        {
            "dashboard": "read",
            "help": "read",
        },
    )

    logger.info("Demo seed: group grants")


def _grant_group(conn, group_name: str, grants: dict[str, str]):
    """권한그룹에 메뉴 권한을 매핑."""
    for pkey, level in grants.items():
        conn.execute(
            text(
                """
                INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
                SELECT pg.id, mi.id, :level
                FROM permission_groups pg, menu_items mi
                WHERE pg.name = :group_name AND mi.permission_key = :pkey
                ON CONFLICT (permission_group_id, menu_item_id)
                DO UPDATE SET access_level = EXCLUDED.access_level
                """
            ),
            {"group_name": group_name, "pkey": pkey, "level": level},
        )


# ─────────────────────────────────────────────────────────────────────────────
# 사용자-그룹 매핑
# ─────────────────────────────────────────────────────────────────────────────


def _seed_user_group_memberships(conn):
    """데모 사용자를 적절한 그룹에 배정."""
    mappings = [
        # (user_email, group_name)
        ("orgadmin@demo.local", "조직 관리자"),
        ("orgadmin@demo.local", "데모그룹-운영"),
        ("user1@demo.local", "일반 사용자"),
        ("user2@demo.local", "일반 사용자"),
        ("user2@demo.local", "데모그룹-운영"),
        ("user3@demo.local", "데모그룹-뷰어"),
    ]

    for email, group_name in mappings:
        conn.execute(
            text(
                """
                INSERT INTO user_group_memberships (user_id, permission_group_id, created_at)
                SELECT u.id, pg.id, NOW()
                FROM users u, permission_groups pg
                WHERE u.email = :email AND pg.name = :group_name
                ON CONFLICT (user_id, permission_group_id) DO NOTHING
                """
            ),
            {"email": email, "group_name": group_name},
        )

    logger.info("Demo seed: %d user-group mappings", len(mappings))


# ─────────────────────────────────────────────────────────────────────────────
# 개별 사용자 권한 오버라이드
# ─────────────────────────────────────────────────────────────────────────────


def _seed_user_permissions(conn):
    """특정 사용자에게 개별 권한 오버라이드."""
    admin = conn.execute(
        text("SELECT id FROM users WHERE email = 'admin@example.com'")
    ).fetchone()
    admin_id = admin[0] if admin else None

    overrides = [
        # (user_email, permission_key, access_level)
        ("orgadmin@demo.local", "users", "write"),
        ("orgadmin@demo.local", "organizations", "write"),
        ("user1@demo.local", "settings", "write"),
    ]

    for email, pkey, level in overrides:
        conn.execute(
            text(
                """
                INSERT INTO user_permissions (user_id, menu_item_id, access_level, granted_by,
                                              created_at, updated_at)
                SELECT u.id, mi.id, :level, :admin_id, NOW(), NOW()
                FROM users u, menu_items mi
                WHERE u.email = :email AND mi.permission_key = :pkey
                ON CONFLICT (user_id, menu_item_id)
                DO UPDATE SET access_level = EXCLUDED.access_level
                """
            ),
            {"email": email, "pkey": pkey, "level": level, "admin_id": admin_id},
        )

    logger.info("Demo seed: %d user permission overrides", len(overrides))
