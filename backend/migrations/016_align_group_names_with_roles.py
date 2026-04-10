"""016: 기본 권한 그룹명을 사용자 역할명과 통일

전체 관리자 → 시스템 관리자
운영자 → 조직 관리자
뷰어 → 일반 사용자
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            renames = [
                (
                    "전체 관리자",
                    "시스템 관리자",
                    "모든 메뉴에 대한 write 권한 (system_admin)",
                ),
                (
                    "운영자",
                    "조직 관리자",
                    "기본 메뉴 write + 관리 메뉴 read 권한 (org_admin)",
                ),
                (
                    "뷰어",
                    "일반 사용자",
                    "기본 메뉴 read 전용 권한 (user)",
                ),
            ]

            for old_name, new_name, new_desc in renames:
                # 이미 new_name이 존재하면 description만 갱신 (멱등성)
                existing = conn.execute(
                    text("SELECT id FROM permission_groups WHERE name = :name"),
                    {"name": new_name},
                ).fetchone()
                if existing:
                    conn.execute(
                        text(
                            """
                            UPDATE permission_groups
                            SET description = :new_desc, updated_at = NOW()
                            WHERE name = :new_name
                            """
                        ),
                        {"new_name": new_name, "new_desc": new_desc},
                    )
                    # old_name 그룹이 아직 남아있으면 삭제 (중복 정리)
                    conn.execute(
                        text(
                            """
                            DELETE FROM permission_groups
                            WHERE name = :old_name
                              AND id NOT IN (
                                  SELECT permission_group_id
                                  FROM user_group_memberships
                              )
                            """
                        ),
                        {"old_name": old_name},
                    )
                else:
                    conn.execute(
                        text(
                            """
                            UPDATE permission_groups
                            SET name = :new_name,
                                description = :new_desc,
                                updated_at = NOW()
                            WHERE name = :old_name
                            """
                        ),
                        {
                            "old_name": old_name,
                            "new_name": new_name,
                            "new_desc": new_desc,
                        },
                    )

            conn.commit()
            logger.info("Aligned default permission group names with user role names")
            return True

    except Exception as e:
        logger.error(f"Migration 016 failed: {e}")
        return False
