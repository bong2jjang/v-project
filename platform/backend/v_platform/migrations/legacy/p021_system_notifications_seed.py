"""Add is_system column and seed default system notifications."""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

SYSTEM_NOTIFICATIONS = [
    {
        "title": "비밀번호 변경 권장",
        "message": "90일 이상 비밀번호를 변경하지 않은 사용자에게 자동 발송됩니다.",
        "severity": "warning",
        "category": "user",
        "scope": "user",
        "source": "system",
    },
    {
        "title": "새 사용자 가입 알림",
        "message": "새로운 사용자가 가입하면 관리자에게 자동 발송됩니다.",
        "severity": "info",
        "category": "user",
        "scope": "role",
        "source": "system",
    },
    {
        "title": "시스템 헬스 경고",
        "message": "DB, Redis 등 인프라 서비스 연결 이상 시 관리자에게 자동 발송됩니다.",
        "severity": "critical",
        "category": "service",
        "scope": "role",
        "source": "system",
    },
    {
        "title": "세션 만료 경고",
        "message": "사용자 세션이 곧 만료될 때 해당 사용자에게 자동 발송됩니다.",
        "severity": "warning",
        "category": "session",
        "scope": "user",
        "source": "system",
    },
    {
        "title": "시스템 점검 공지",
        "message": "시스템 점검 예정 시 전체 사용자에게 발송됩니다.",
        "severity": "info",
        "category": "system",
        "scope": "global",
        "source": "system",
    },
    {
        "title": "보안 경고",
        "message": "비정상 로그인 시도 등 보안 이벤트 발생 시 관리자에게 발송됩니다.",
        "severity": "error",
        "category": "system",
        "scope": "role",
        "source": "system",
    },
]


def migrate(engine):
    with engine.connect() as conn:
        # Add is_system column
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='notifications' AND column_name='is_system'"
            )
        )
        if not result.fetchone():
            conn.execute(
                text(
                    "ALTER TABLE notifications ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            logger.info("Added is_system column to notifications")

        # Seed system notifications (idempotent)
        for notif in SYSTEM_NOTIFICATIONS:
            existing = conn.execute(
                text(
                    "SELECT id FROM notifications WHERE title = :title AND is_system = TRUE"
                ),
                {"title": notif["title"]},
            ).fetchone()
            if not existing:
                conn.execute(
                    text(
                        """
                    INSERT INTO notifications (title, message, severity, category, scope, source, is_system, is_active, delivery_type, created_at)
                    VALUES (:title, :message, :severity, :category, :scope, :source, TRUE, TRUE, 'toast', NOW())
                """
                    ),
                    notif,
                )
                logger.info(f"Seeded system notification: {notif['title']}")

        conn.commit()
        logger.info("Migration p021 completed: system notifications seed")
