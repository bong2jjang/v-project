"""UserOAuthToken 데이터베이스 모델

사용자별 OAuth 토큰 관리 — 각 사용자가 자신의 플랫폼 계정을 독립적으로 연결

⚠️ 보안: access_token/refresh_token은 DB에 암호화되어 저장됩니다.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from v_platform.models.base import Base
from v_platform.utils.encryption import decrypt, encrypt, is_encrypted


class UserOAuthToken(Base):
    """사용자별 OAuth 토큰

    시스템 Account(Bot/App)에 연결된 개인 OAuth 토큰을 저장합니다.
    주로 Teams Delegated Auth (DM/그룹 채팅 접근)에 사용됩니다.
    """

    __tablename__ = "user_oauth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    account_id = Column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    platform = Column(String(50), nullable=False, index=True)  # "slack" | "teams"

    # OAuth 토큰 (암호화 저장)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=False)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # 플랫폼 사용자 정보
    platform_user_id = Column(String(255), nullable=True)
    platform_user_name = Column(String(255), nullable=True)
    platform_email = Column(String(255), nullable=True)

    # 메타
    scopes = Column(Text, nullable=True)  # 부여된 OAuth scope
    is_active = Column(Boolean, nullable=False, default=True, index=True)
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
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="oauth_tokens")

    # Account is an app model — relationship configured only when Account is available
    @staticmethod
    def _configure_account_relationship():
        """Called by app after Account model is loaded"""
        from sqlalchemy.orm import relationship as rel

        UserOAuthToken.account = rel("Account", back_populates="user_tokens")

    # Constraints
    __table_args__ = (
        UniqueConstraint("user_id", "account_id", name="uq_user_account_oauth"),
        Index("idx_user_oauth_user", "user_id"),
        Index("idx_user_oauth_account", "account_id"),
    )

    # ═══════════════════════════════════════════════════════════════
    # 암호화 Property
    # ═══════════════════════════════════════════════════════════════

    @property
    def access_token_decrypted(self) -> Optional[str]:
        """복호화된 access token"""
        if not self.access_token:
            return None
        if is_encrypted(self.access_token):
            return decrypt(self.access_token)
        return self.access_token

    @access_token_decrypted.setter
    def access_token_decrypted(self, value: Optional[str]):
        """access token 암호화 저장"""
        if value:
            self.access_token = encrypt(value)
        else:
            self.access_token = None

    @property
    def refresh_token_decrypted(self) -> Optional[str]:
        """복호화된 refresh token"""
        if not self.refresh_token:
            return None
        if is_encrypted(self.refresh_token):
            return decrypt(self.refresh_token)
        return self.refresh_token

    @refresh_token_decrypted.setter
    def refresh_token_decrypted(self, value: Optional[str]):
        """refresh token 암호화 저장"""
        if value:
            self.refresh_token = encrypt(value)
        else:
            self.refresh_token = None

    def to_dict(self) -> dict:
        """딕셔너리 변환 (토큰 제외)"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "account_id": self.account_id,
            "platform": self.platform,
            "platform_user_id": self.platform_user_id,
            "platform_user_name": self.platform_user_name,
            "platform_email": self.platform_email,
            "is_active": self.is_active,
            "token_expires_at": (
                self.token_expires_at.isoformat() if self.token_expires_at else None
            ),
            "last_used_at": (
                self.last_used_at.isoformat() if self.last_used_at else None
            ),
            "created_at": (self.created_at.isoformat() if self.created_at else None),
            "updated_at": (self.updated_at.isoformat() if self.updated_at else None),
        }

    def __repr__(self):
        return (
            f"<UserOAuthToken(id={self.id}, user_id={self.user_id}, "
            f"account_id={self.account_id}, platform={self.platform})>"
        )
