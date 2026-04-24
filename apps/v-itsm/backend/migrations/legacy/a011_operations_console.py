"""a011: 운영 콘솔 (Operations Console) 스키마.

설계 문서 `docusaurus/docs/apps/v-itsm/design/V_ITSM_OPERATIONS_CONSOLE_DESIGN.md` §7 기준.

신규 테이블 5개 (모두 `itsm_` 접두사 — MULTI_APP_DATA_ISOLATION 준수):
  - itsm_notification_log              전송 로그 + 재시도 상태
  - itsm_integration_settings          Slack/Teams/Email 통합 설정 (싱글턴, id=1)
  - itsm_sla_notification_policy       SLA 이벤트별 알림 대상/채널 정책
  - itsm_user_notification_pref        사용자별 알림 선호 (플랫폼 승격 보류 대안)
  - itsm_scheduler_override            APScheduler 잡 간격/일시정지 오버라이드

시드:
  - itsm_integration_settings (id=1) 싱글턴 로우
  - itsm_sla_notification_policy 기본 2건 (warning, breach)

멱등: IF NOT EXISTS + ON CONFLICT DO NOTHING. 여러 번 실행해도 안전.
Forward-only — 롤백 스크립트는 보류 (설계 §7.3).

기존 마이그레이션(a005~a010) 과 충돌하지 않도록 a011 번호 사용.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


STATEMENTS: list[str] = [
    # -------- 4.1 Notification Log --------
    """
    CREATE TABLE IF NOT EXISTS itsm_notification_log (
        id              VARCHAR(26)  PRIMARY KEY,
        ticket_id       VARCHAR(26)  REFERENCES itsm_ticket(id) ON DELETE SET NULL,
        event_type      VARCHAR(40)  NOT NULL,
        channel         VARCHAR(20)  NOT NULL,
        target_user_id  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        target_address  VARCHAR(300) NOT NULL,
        payload         JSONB        NOT NULL,
        status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
        error_message   TEXT,
        retry_count     INTEGER      NOT NULL DEFAULT 0,
        last_retry_at   TIMESTAMPTZ,
        delivered_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_inlog_ticket ON itsm_notification_log(ticket_id)",
    "CREATE INDEX IF NOT EXISTS ix_inlog_event ON itsm_notification_log(event_type)",
    "CREATE INDEX IF NOT EXISTS ix_inlog_status_created ON itsm_notification_log(status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_inlog_target_user ON itsm_notification_log(target_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_inlog_created_desc ON itsm_notification_log(created_at DESC)",

    # -------- 4.2 Integration Settings (singleton id=1) --------
    """
    CREATE TABLE IF NOT EXISTS itsm_integration_settings (
        id                        INTEGER      PRIMARY KEY,
        slack_bot_token_enc       TEXT,
        slack_app_token_enc       TEXT,
        slack_signing_secret_enc  TEXT,
        slack_default_channel     VARCHAR(200),
        teams_tenant_id           VARCHAR(100),
        teams_app_id              VARCHAR(100),
        teams_app_password_enc    TEXT,
        teams_team_id             VARCHAR(100),
        teams_webhook_url_enc     TEXT,
        teams_default_channel_id  VARCHAR(200),
        email_smtp_host           VARCHAR(200),
        email_smtp_port           INTEGER,
        email_from                VARCHAR(300),
        email_smtp_user_enc       TEXT,
        email_smtp_password_enc   TEXT,
        slack_last_test_at        TIMESTAMPTZ,
        slack_last_test_ok        BOOLEAN,
        slack_last_test_message   TEXT,
        teams_last_test_at        TIMESTAMPTZ,
        teams_last_test_ok        BOOLEAN,
        teams_last_test_message   TEXT,
        email_last_test_at        TIMESTAMPTZ,
        email_last_test_ok        BOOLEAN,
        email_last_test_message   TEXT,
        updated_by                INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT ck_integration_settings_singleton CHECK (id = 1)
    )
    """,
    # 기존 배포 호환: 이전 스키마로 테이블이 이미 존재한다면 DEFAULT 가 없을 수 있어 보강.
    "ALTER TABLE itsm_integration_settings ALTER COLUMN updated_at SET DEFAULT NOW()",
    """
    INSERT INTO itsm_integration_settings (id, updated_at)
    VALUES (1, NOW())
    ON CONFLICT (id) DO NOTHING
    """,

    # -------- 4.3 SLA Notification Policy --------
    """
    CREATE TABLE IF NOT EXISTS itsm_sla_notification_policy (
        id                        VARCHAR(26)  PRIMARY KEY,
        name                      VARCHAR(100) NOT NULL,
        trigger_event             VARCHAR(20)  NOT NULL,
        applies_priority          VARCHAR(20),
        applies_service_type      VARCHAR(20),
        notify_channels           JSONB        NOT NULL,
        notify_assignee           BOOLEAN      NOT NULL DEFAULT TRUE,
        notify_assignee_manager   BOOLEAN      NOT NULL DEFAULT FALSE,
        notify_custom_user_ids    JSONB,
        notify_custom_addresses   JSONB,
        template_key              VARCHAR(50),
        active                    BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_snp_trigger_active
        ON itsm_sla_notification_policy(trigger_event, active)
    """,

    # -------- 4.4 User Notification Preference --------
    """
    CREATE TABLE IF NOT EXISTS itsm_user_notification_pref (
        id                      VARCHAR(26)  PRIMARY KEY,
        user_id                 INTEGER      NOT NULL UNIQUE
                                REFERENCES users(id) ON DELETE CASCADE,
        slack_user_id           VARCHAR(50),
        teams_user_id           VARCHAR(100),
        teams_channel_override  VARCHAR(200),
        email_override          VARCHAR(300),
        channels                JSONB        NOT NULL DEFAULT '["email"]'::jsonb,
        event_overrides         JSONB,
        enabled                 BOOLEAN      NOT NULL DEFAULT TRUE,
        quiet_hours             JSONB,
        created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,

    # -------- 4.5 Scheduler Override --------
    """
    CREATE TABLE IF NOT EXISTS itsm_scheduler_override (
        job_id            VARCHAR(50)  PRIMARY KEY,
        interval_seconds  INTEGER      NOT NULL,
        paused            BOOLEAN      NOT NULL DEFAULT FALSE,
        updated_by        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
]


# -------- Seed: 기본 SLA 알림 정책 2건 (warning / breach) --------
# ULID 는 상수로 고정해 재실행 멱등 보장. 정책 UI 에서 이후 편집 가능.
SEED_SLA_NOTIFICATION_POLICIES: list[tuple[str, str, str, str]] = [
    (
        "01HSNP00DEFAULTWARNING0000",
        "SLA 80% 경고 기본",
        "warning",
        '["slack","email"]',
    ),
    (
        "01HSNP00DEFAULTBREACH00000",
        "SLA 100% 위반 기본",
        "breach",
        '["slack","teams","email"]',
    ),
]


SEED_POLICY_STATEMENT = """
INSERT INTO itsm_sla_notification_policy
    (id, name, trigger_event, notify_channels,
     notify_assignee, notify_assignee_manager, active,
     created_at, updated_at)
VALUES
    (:id, :name, :trigger_event, CAST(:notify_channels AS JSONB),
     TRUE, :notify_manager, TRUE,
     NOW(), NOW())
ON CONFLICT (id) DO NOTHING
"""


def migrate(engine):
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))

        for policy_id, name, trigger_event, channels in SEED_SLA_NOTIFICATION_POLICIES:
            conn.execute(
                text(SEED_POLICY_STATEMENT),
                {
                    "id": policy_id,
                    "name": name,
                    "trigger_event": trigger_event,
                    "notify_channels": channels,
                    # breach 는 관리자도 수신 기본값, warning 은 담당자만
                    "notify_manager": trigger_event == "breach",
                },
            )

        conn.commit()
    logger.info(
        "a011: operations console (notification_log / integration_settings / "
        "sla_notification_policy / user_notification_pref / scheduler_override) "
        "applied"
    )
