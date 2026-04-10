"""Account 데이터베이스 모델

Slack 및 Microsoft Teams 계정 정보를 PostgreSQL에 저장

⚠️ 보안: Token/Password는 DB에 암호화되어 저장됩니다.
- token, app_token, app_password: 암호화된 값 (DB 직접 접근)
- token_decrypted, app_token_decrypted, app_password_decrypted: 평문 (property)
"""

from datetime import datetime, timezone
from typing import Optional

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
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.utils.encryption import decrypt, encrypt, is_encrypted


class Account(Base):
    """Account 모델

    Slack 또는 Teams 계정 정보를 저장하는 테이블
    """

    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(50), nullable=False, index=True)  # "slack" or "teams"
    name = Column(String(255), unique=True, nullable=False, index=True)

    # Slack 필드
    token = Column(String(500), nullable=True)  # xoxb-...
    app_token = Column(String(500), nullable=True)  # xapp-... (Socket Mode)

    # Teams 필드
    tenant_id = Column(String(255), nullable=True)
    app_id = Column(String(255), nullable=True)
    app_password = Column(String(500), nullable=True)
    team_id = Column(String(500), nullable=True)  # Teams Team ID (암호화)
    webhook_url = Column(Text, nullable=True)  # deprecated: 더 이상 사용하지 않음

    # Teams Delegated Auth (OAuth2 Authorization Code Flow)
    ms_refresh_token = Column(Text, nullable=True)  # 암호화된 refresh token
    ms_token_expires_at = Column(
        DateTime(timezone=True), nullable=True
    )  # access token 만료
    ms_user_id = Column(String(255), nullable=True)  # 연결된 MS 사용자 ID

    # 공통 설정
    prefix_messages_with_nick = Column(Boolean, default=True)
    edit_suffix = Column(String(50), default=" (edited)")
    edit_disable = Column(Boolean, default=False)
    use_username = Column(Boolean, default=True)
    no_send_join_part = Column(Boolean, default=True)
    use_api = Column(Boolean, default=True)
    debug = Column(Boolean, default=False)

    # 기능 설정
    enabled_features = Column(
        Text,
        nullable=True,
        comment="활성화된 기능 목록 (JSON 배열). NULL이면 모든 기능 활성화",
    )

    # 유효성 검증
    is_valid = Column(Boolean, nullable=False, default=True, index=True)
    validation_errors = Column(Text, nullable=True)

    # 메타데이터
    enabled = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    user_tokens = relationship(
        "UserOAuthToken",
        back_populates="account",
        cascade="all, delete-orphan",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "(platform = 'slack' AND token IS NOT NULL) OR "
            "(platform = 'teams' AND tenant_id IS NOT NULL AND app_id IS NOT NULL)",
            name="account_platform_fields_check",
        ),
    )

    # ═══════════════════════════════════════════════════════════════
    # 암호화 Property (Token/Password)
    # ═══════════════════════════════════════════════════════════════

    @property
    def token_decrypted(self) -> Optional[str]:
        """
        복호화된 Slack Bot Token 반환

        Returns:
            평문 Token 또는 None

        Example:
            >>> account.token_decrypted
            'xoxb-1234567890-...'
        """
        if not self.token:
            return None

        # 이미 암호화된 값인지 확인
        if is_encrypted(self.token):
            return decrypt(self.token)

        # 마이그레이션 중 - 평문 그대로 반환 (경고 출력)
        print(
            f"WARNING: Account {self.id} token is not encrypted. "
            "Please run migration."
        )
        return self.token

    @token_decrypted.setter
    def token_decrypted(self, value: Optional[str]):
        """
        Slack Bot Token 암호화하여 저장

        Args:
            value: 평문 Token

        Example:
            >>> account.token_decrypted = 'xoxb-1234567890-...'
        """
        if value:
            self.token = encrypt(value)
        else:
            self.token = None

    @property
    def app_token_decrypted(self) -> Optional[str]:
        """복호화된 Slack App Token 반환"""
        if not self.app_token:
            return None

        if is_encrypted(self.app_token):
            return decrypt(self.app_token)

        print(
            f"WARNING: Account {self.id} app_token is not encrypted. "
            "Please run migration."
        )
        return self.app_token

    @app_token_decrypted.setter
    def app_token_decrypted(self, value: Optional[str]):
        """Slack App Token 암호화하여 저장"""
        if value:
            self.app_token = encrypt(value)
        else:
            self.app_token = None

    @property
    def tenant_id_decrypted(self) -> Optional[str]:
        """복호화된 Azure Tenant ID 반환"""
        if not self.tenant_id:
            return None

        if is_encrypted(self.tenant_id):
            return decrypt(self.tenant_id)

        print(
            f"WARNING: Account {self.id} tenant_id is not encrypted. "
            "Please run migration."
        )
        return self.tenant_id

    @tenant_id_decrypted.setter
    def tenant_id_decrypted(self, value: Optional[str]):
        """Azure Tenant ID 암호화하여 저장"""
        if value:
            self.tenant_id = encrypt(value)
        else:
            self.tenant_id = None

    @property
    def app_id_decrypted(self) -> Optional[str]:
        """복호화된 Azure App ID 반환"""
        if not self.app_id:
            return None

        if is_encrypted(self.app_id):
            return decrypt(self.app_id)

        print(
            f"WARNING: Account {self.id} app_id is not encrypted. "
            "Please run migration."
        )
        return self.app_id

    @app_id_decrypted.setter
    def app_id_decrypted(self, value: Optional[str]):
        """Azure App ID 암호화하여 저장"""
        if value:
            self.app_id = encrypt(value)
        else:
            self.app_id = None

    @property
    def team_id_decrypted(self) -> Optional[str]:
        """복호화된 Teams Team ID 반환"""
        if not self.team_id:
            return None

        if is_encrypted(self.team_id):
            return decrypt(self.team_id)

        return self.team_id

    @team_id_decrypted.setter
    def team_id_decrypted(self, value: Optional[str]):
        """Teams Team ID 암호화하여 저장"""
        if value:
            self.team_id = encrypt(value)
        else:
            self.team_id = None

    @property
    def webhook_url_decrypted(self) -> Optional[str]:
        """복호화된 Teams Webhook URL 반환"""
        if not self.webhook_url:
            return None
        if is_encrypted(self.webhook_url):
            return decrypt(self.webhook_url)
        return self.webhook_url

    @webhook_url_decrypted.setter
    def webhook_url_decrypted(self, value: Optional[str]):
        """Teams Webhook URL 암호화하여 저장"""
        if value:
            self.webhook_url = encrypt(value)
        else:
            self.webhook_url = None

    @property
    def app_password_decrypted(self) -> Optional[str]:
        """복호화된 Teams App Password 반환"""
        if not self.app_password:
            return None

        if is_encrypted(self.app_password):
            return decrypt(self.app_password)

        print(
            f"WARNING: Account {self.id} app_password is not encrypted. "
            "Please run migration."
        )
        return self.app_password

    @app_password_decrypted.setter
    def app_password_decrypted(self, value: Optional[str]):
        """Teams App Password 암호화하여 저장"""
        if value:
            self.app_password = encrypt(value)
        else:
            self.app_password = None

    @property
    def ms_refresh_token_decrypted(self) -> Optional[str]:
        """복호화된 Microsoft Refresh Token 반환"""
        if not self.ms_refresh_token:
            return None

        if is_encrypted(self.ms_refresh_token):
            return decrypt(self.ms_refresh_token)

        return self.ms_refresh_token

    @ms_refresh_token_decrypted.setter
    def ms_refresh_token_decrypted(self, value: Optional[str]):
        """Microsoft Refresh Token 암호화하여 저장"""
        if value:
            self.ms_refresh_token = encrypt(value)
        else:
            self.ms_refresh_token = None

    # ═══════════════════════════════════════════════════════════════

    def __repr__(self) -> str:
        return (
            f"<Account(id={self.id}, platform={self.platform}, name={self.name}, "
            f"enabled={self.enabled}, is_valid={self.is_valid})>"
        )
