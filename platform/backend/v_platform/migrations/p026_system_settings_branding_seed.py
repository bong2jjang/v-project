"""Seed system_settings rows (global + per-app branding) to match canonical defaults.

Idempotent: 기존 행이 있으면 건드리지 않고, 없는 앱 컨텍스트의 행만 추가한다.
(사용자가 관리 UI에서 수정한 값은 덮어쓰지 않음)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

# (app_id, app_title, app_description) — app_id=None 은 전역 기본 행
SETTINGS_SEED = [
    (None, "v-platform", "통합 관리 플랫폼"),
    ("v-channel-bridge", "channel-bridge", "Slack ↔ Teams 메시지 브리지"),
    ("v-platform-portal", "v-platform-portal", "통합 관리 플랫폼"),
    ("v-platform-template", "v-platform-template", "플랫폼 템플릿 앱"),
]


def migrate(engine):
    with engine.connect() as conn:
        for app_id, app_title, app_description in SETTINGS_SEED:
            if app_id is None:
                existing = conn.execute(
                    text("SELECT id FROM system_settings WHERE app_id IS NULL")
                ).fetchone()
            else:
                existing = conn.execute(
                    text("SELECT id FROM system_settings WHERE app_id = :app_id"),
                    {"app_id": app_id},
                ).fetchone()

            if existing:
                logger.info(f"system_settings row exists (app_id={app_id}), skipping")
                continue

            conn.execute(
                text(
                    """
                    INSERT INTO system_settings
                        (app_id, app_title, app_description,
                         manual_enabled, manual_url, default_start_page)
                    VALUES
                        (:app_id, :app_title, :app_description,
                         TRUE, 'http://127.0.0.1:3000', '/')
                    """
                ),
                {
                    "app_id": app_id,
                    "app_title": app_title,
                    "app_description": app_description,
                },
            )
            logger.info(f"Seeded system_settings (app_id={app_id}, title={app_title})")

        conn.commit()
        logger.info("Migration p026 completed: system_settings branding seed")
