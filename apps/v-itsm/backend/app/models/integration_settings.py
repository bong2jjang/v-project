"""itsm_integration_settings — Slack/Teams/Email 통합 설정 (싱글턴 id=1).

민감값(`*_enc`)은 `v_platform.utils.encryption` 의 Fernet 으로 암호화 저장.
서비스 레이어는 `*_decrypted` 프로퍼티를 통해 평문을 읽고/쓴다.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from v_platform.models.base import Base
from v_platform.utils.encryption import decrypt, encrypt, is_encrypted

logger = logging.getLogger(__name__)


def _decrypt_or_warn(field: str, value: str | None) -> str | None:
    if not value:
        return None
    if is_encrypted(value):
        try:
            return decrypt(value)
        except Exception as e:  # noqa: BLE001
            logger.error("IntegrationSettings.%s 복호화 실패: %s", field, e)
            return None
    logger.warning("IntegrationSettings.%s 가 평문으로 저장됨 — 암호화 재저장 권장", field)
    return value


class IntegrationSettings(Base):
    __tablename__ = "itsm_integration_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_integration_settings_singleton"),
    )

    id = Column(Integer, primary_key=True)

    # Slack
    slack_bot_token_enc = Column(Text, nullable=True)
    slack_app_token_enc = Column(Text, nullable=True)
    slack_signing_secret_enc = Column(Text, nullable=True)
    slack_default_channel = Column(String(200), nullable=True)

    # Teams
    teams_tenant_id = Column(String(100), nullable=True)
    teams_app_id = Column(String(100), nullable=True)
    teams_app_password_enc = Column(Text, nullable=True)
    teams_team_id = Column(String(100), nullable=True)
    teams_webhook_url_enc = Column(Text, nullable=True)
    teams_default_channel_id = Column(String(200), nullable=True)

    # Email
    email_smtp_host = Column(String(200), nullable=True)
    email_smtp_port = Column(Integer, nullable=True)
    email_from = Column(String(300), nullable=True)
    email_smtp_user_enc = Column(Text, nullable=True)
    email_smtp_password_enc = Column(Text, nullable=True)

    # 연결 테스트 결과
    slack_last_test_at = Column(DateTime(timezone=True), nullable=True)
    slack_last_test_ok = Column(Boolean, nullable=True)
    slack_last_test_message = Column(Text, nullable=True)
    teams_last_test_at = Column(DateTime(timezone=True), nullable=True)
    teams_last_test_ok = Column(Boolean, nullable=True)
    teams_last_test_message = Column(Text, nullable=True)
    email_last_test_at = Column(DateTime(timezone=True), nullable=True)
    email_last_test_ok = Column(Boolean, nullable=True)
    email_last_test_message = Column(Text, nullable=True)

    updated_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ---- 복호화 프로퍼티 (읽기) + 암호화 세터 (쓰기) ----

    @property
    def slack_bot_token(self) -> str | None:
        return _decrypt_or_warn("slack_bot_token", self.slack_bot_token_enc)

    @slack_bot_token.setter
    def slack_bot_token(self, value: str | None) -> None:
        self.slack_bot_token_enc = encrypt(value) if value else None

    @property
    def slack_app_token(self) -> str | None:
        return _decrypt_or_warn("slack_app_token", self.slack_app_token_enc)

    @slack_app_token.setter
    def slack_app_token(self, value: str | None) -> None:
        self.slack_app_token_enc = encrypt(value) if value else None

    @property
    def slack_signing_secret(self) -> str | None:
        return _decrypt_or_warn("slack_signing_secret", self.slack_signing_secret_enc)

    @slack_signing_secret.setter
    def slack_signing_secret(self, value: str | None) -> None:
        self.slack_signing_secret_enc = encrypt(value) if value else None

    @property
    def teams_app_password(self) -> str | None:
        return _decrypt_or_warn("teams_app_password", self.teams_app_password_enc)

    @teams_app_password.setter
    def teams_app_password(self, value: str | None) -> None:
        self.teams_app_password_enc = encrypt(value) if value else None

    @property
    def teams_webhook_url(self) -> str | None:
        return _decrypt_or_warn("teams_webhook_url", self.teams_webhook_url_enc)

    @teams_webhook_url.setter
    def teams_webhook_url(self, value: str | None) -> None:
        self.teams_webhook_url_enc = encrypt(value) if value else None

    @property
    def email_smtp_user(self) -> str | None:
        return _decrypt_or_warn("email_smtp_user", self.email_smtp_user_enc)

    @email_smtp_user.setter
    def email_smtp_user(self, value: str | None) -> None:
        self.email_smtp_user_enc = encrypt(value) if value else None

    @property
    def email_smtp_password(self) -> str | None:
        return _decrypt_or_warn("email_smtp_password", self.email_smtp_password_enc)

    @email_smtp_password.setter
    def email_smtp_password(self, value: str | None) -> None:
        self.email_smtp_password_enc = encrypt(value) if value else None
