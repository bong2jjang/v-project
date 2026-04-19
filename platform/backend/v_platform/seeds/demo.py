"""Demo seed — 현재 운영 중인 DB 스냅샷을 재현하는 시드.

base seed 위에 추가로:
  - 회사 브랜딩 (VMS / VMS-KR)
  - 조직 구조 (부서 계층 12개)
  - 추가 사용자 8명 (VMS 실사용자 4 + 데모 샘플 4)
  - 커스텀 권한그룹 4개 (사용자정의그룹-1/2, 데모그룹-운영/뷰어)
  - 권한그룹 grants, 사용자-그룹 매핑, 개별 사용자 권한 오버라이드
  - 메뉴 section 보정 (플랫폼 공통 메뉴만)

Note: 앱 전용 메뉴(channels, messages 등)의 메뉴 자체 등록은
각 앱의 마이그레이션(a*.py)이 담당한다. 본 시드는 해당 메뉴에 대한
grant/override만 설정한다.
"""

import logging

from sqlalchemy import text

from v_platform.utils.auth import get_password_hash

logger = logging.getLogger(__name__)

# 비밀번호 통일: 모든 데모 사용자 동일 (실사용자 포함 — 리셋 후 재로그인 기준)
DEMO_PASSWORD = "Demo123!"

# ─────────────────────────────────────────────────────────────────────────────
# 회사 브랜딩
# ─────────────────────────────────────────────────────────────────────────────

COMPANY_NAME = "VMS"
COMPANY_CODE = "VMS-KR"

# ─────────────────────────────────────────────────────────────────────────────
# 부서 (현재 DB 계층 스냅샷)
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
    ("운영1그룹", "솔루션사업본부", 0),
    ("운영2그룹", "솔루션사업본부", 0),
    ("제품팀", "제품사업그룹", 0),
    ("사업팀", "제품사업그룹", 0),
]

# ─────────────────────────────────────────────────────────────────────────────
# 사용자 (VMS 실사용자 + 데모 샘플)
# ─────────────────────────────────────────────────────────────────────────────

DEMO_USERS = [
    # (email, username, role, department_name, auth_method, color_preset)
    # VMS 실사용자 (현재 운영 DB 기준)
    ("bong78@vms-solutions.com", "viktor", "ORG_ADMIN", "제품사업그룹", "hybrid", "rose"),
    ("yichunbong@hotmail.com", "이춘봉", "USER", "제품팀", "local", "blue"),
    ("kbhee@vms-solutions.com", "김병희", "USER", "대표이사", "local", "blue"),
    ("chunggh@vms-solutions.com", "정구환", "ORG_ADMIN", "솔루션사업본부", "local", "blue"),
    # 데모 샘플 사용자
    ("orgadmin@demo.local", "데모관리자", "ORG_ADMIN", "전략사업부", "local", "blue"),
    ("user1@demo.local", "김테스트", "USER", "제품팀", "local", "blue"),
    ("user2@demo.local", "이데모", "USER", "운영1그룹", "local", "blue"),
    ("user3@demo.local", "박샘플", "USER", "경영지원실", "local", "blue"),
]

# 리셋 시 demo seed가 재생성하는 사용자 이메일 (runner에서 참조)
DEMO_USER_EMAILS = [u[0] for u in DEMO_USERS]

# ─────────────────────────────────────────────────────────────────────────────
# 커스텀 권한그룹
# ─────────────────────────────────────────────────────────────────────────────

CUSTOM_GROUPS = [
    # (name, description)
    ("사용자정의그룹-1", "테스트 그룹 1"),
    ("사용자정의그룹-2", "테스트 그룹 2"),
    ("데모그룹-운영", "운영 부서 전용 — 기본 메뉴 write + 관리 메뉴 일부 read"),
    ("데모그룹-뷰어", "외부 조직용 — 대시보드 + 도움말 read only"),
]

# 리셋 시 demo seed가 재생성하는 그룹 이름 prefix (runner에서 참조)
CUSTOM_GROUP_NAMES = [g[0] for g in CUSTOM_GROUPS]

# ─────────────────────────────────────────────────────────────────────────────
# 그룹 grants (커스텀 그룹별 메뉴 권한)
# ─────────────────────────────────────────────────────────────────────────────

#
# 주의: `dashboard`, `help` 는 p032 부터 공통 키가 아니다. 각 앱이 자체
# (app_id 스코프) 메뉴를 소유하므로, 앱별 a* 마이그레이션에서 자체 grants 를
# 삽입한다. 아래 그룹 grants 는 여전히 공통(app_id=NULL) 메뉴만을 대상으로
# 한다 (설정은 공통 유지).
GROUP_GRANTS: dict[str, dict[str, str]] = {
    # 사용자정의그룹-1: 기본(basic) 메뉴 read-only 세트
    "사용자정의그룹-1": {
        "channels": "read",
        "integrations": "read",
        "messages": "read",
        "settings": "read",
        "statistics": "read",
    },
    # 사용자정의그룹-2: grant 없음 (UI 테스트용 빈 그룹)
    "사용자정의그룹-2": {},
    # 데모그룹-운영: 기본 메뉴 write + 관리 메뉴 일부 read
    "데모그룹-운영": {
        "channels": "write",
        "integrations": "write",
        "messages": "write",
        "settings": "write",
        "statistics": "write",
        "monitoring": "read",
        "organizations": "read",
        "users": "read",
    },
    # 데모그룹-뷰어: 최소 read
    "데모그룹-뷰어": {
        "settings": "read",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 사용자-그룹 매핑
# ─────────────────────────────────────────────────────────────────────────────

MEMBERSHIPS = [
    # (user_email, group_name)
    ("bong78@vms-solutions.com", "조직 관리자"),
    ("bong78@vms-solutions.com", "사용자정의그룹-1"),
    ("yichunbong@hotmail.com", "일반 사용자"),
    ("kbhee@vms-solutions.com", "일반 사용자"),
    ("kbhee@vms-solutions.com", "사용자정의그룹-1"),
    ("chunggh@vms-solutions.com", "조직 관리자"),
    ("orgadmin@demo.local", "조직 관리자"),
    ("orgadmin@demo.local", "데모그룹-운영"),
    ("user1@demo.local", "일반 사용자"),
    ("user2@demo.local", "일반 사용자"),
    ("user2@demo.local", "데모그룹-운영"),
    ("user3@demo.local", "일반 사용자"),
    ("user3@demo.local", "데모그룹-뷰어"),
]

# ─────────────────────────────────────────────────────────────────────────────
# 개별 사용자 권한 오버라이드
# ─────────────────────────────────────────────────────────────────────────────

USER_PERMISSIONS = [
    # (user_email, permission_key, access_level)
    # bong78 — 공통 메뉴 write (dashboard/help 는 p032 이후 앱별 키로 이관되어 여기서 제외)
    ("bong78@vms-solutions.com", "audit_logs", "write"),
    ("bong78@vms-solutions.com", "channels", "write"),
    ("bong78@vms-solutions.com", "integrations", "write"),
    ("bong78@vms-solutions.com", "menu_management", "write"),
    ("bong78@vms-solutions.com", "messages", "write"),
    ("bong78@vms-solutions.com", "monitoring", "write"),
    ("bong78@vms-solutions.com", "organizations", "write"),
    ("bong78@vms-solutions.com", "permission_groups", "write"),
    ("bong78@vms-solutions.com", "permission_management", "write"),
    ("bong78@vms-solutions.com", "settings", "write"),
    ("bong78@vms-solutions.com", "statistics", "write"),
    ("bong78@vms-solutions.com", "users", "write"),
    # 기타 개별 오버라이드
    ("yichunbong@hotmail.com", "settings", "write"),
    ("kbhee@vms-solutions.com", "settings", "write"),
    ("chunggh@vms-solutions.com", "organizations", "write"),
    ("orgadmin@demo.local", "organizations", "write"),
    ("orgadmin@demo.local", "users", "write"),
    ("user1@demo.local", "settings", "write"),
]

# ─────────────────────────────────────────────────────────────────────────────
# 메뉴 section 보정 (플랫폼 공통 메뉴만)
# ─────────────────────────────────────────────────────────────────────────────

MENU_SECTIONS = [
    # dashboard/help 는 p032 이후 앱별 소유로 이관됨 — 공통 section 보정 대상 아님.
    ("settings", "basic"),
    ("users", "admin"),
    ("audit_logs", "admin"),
    ("menu_management", "admin"),
    ("permission_management", "admin"),
    ("permission_groups", "admin"),
    ("organizations", "admin"),
]


def seed_demo(conn):
    """데모 데이터 삽입 (idempotent)."""
    _seed_company_branding(conn)
    _seed_departments(conn)
    _seed_users(conn)
    _seed_menu_sections(conn)
    _seed_custom_groups(conn)
    _seed_group_grants(conn)
    _seed_user_group_memberships(conn)
    _seed_user_permissions(conn)


# ─────────────────────────────────────────────────────────────────────────────
# 회사 브랜딩
# ─────────────────────────────────────────────────────────────────────────────


def _seed_company_branding(conn):
    """회사 이름/코드를 현재 운영 브랜딩(VMS / VMS-KR)으로 정렬."""
    conn.execute(
        text(
            """
            UPDATE companies
            SET name = :name, code = :code, updated_at = NOW()
            WHERE id = 1
            """
        ),
        {"name": COMPANY_NAME, "code": COMPANY_CODE},
    )
    logger.info("Demo seed: company branding (%s / %s)", COMPANY_NAME, COMPANY_CODE)


# ─────────────────────────────────────────────────────────────────────────────
# 부서
# ─────────────────────────────────────────────────────────────────────────────


def _seed_departments(conn):
    """부서 계층 구조 생성."""
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

    for email, username, role, dept_name, auth_method, color_preset in DEMO_USERS:
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
                       '', 'system', :color_preset,
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
                "color_preset": color_preset,
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
    for group_name, grants in GROUP_GRANTS.items():
        if not grants:
            continue
        _grant_group(conn, group_name, grants)

    logger.info("Demo seed: group grants (%d groups)", len(GROUP_GRANTS))


def _grant_group(conn, group_name: str, grants: dict[str, str]):
    """권한그룹에 메뉴 권한을 매핑. 존재하지 않는 메뉴는 조용히 건너뜀."""
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
    for email, group_name in MEMBERSHIPS:
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

    logger.info("Demo seed: %d user-group mappings", len(MEMBERSHIPS))


# ─────────────────────────────────────────────────────────────────────────────
# 개별 사용자 권한 오버라이드
# ─────────────────────────────────────────────────────────────────────────────


def _seed_user_permissions(conn):
    """특정 사용자에게 개별 권한 오버라이드."""
    admin = conn.execute(
        text("SELECT id FROM users WHERE email = 'admin@example.com'")
    ).fetchone()
    admin_id = admin[0] if admin else None

    for email, pkey, level in USER_PERMISSIONS:
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

    logger.info("Demo seed: %d user permission overrides", len(USER_PERMISSIONS))
