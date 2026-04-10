"""
PasswordResetToken Model

비밀번호 재설정 토큰 관리를 위한 데이터베이스 모델
"""

import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from v_platform.models.base import Base


class PasswordResetToken(Base):
    """비밀번호 재설정 토큰 테이블"""

    __tablename__ = "password_reset_tokens"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 토큰 정보
    token = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 토큰 상태
    is_used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # 타임스탬프
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    used_at = Column(DateTime(timezone=True), nullable=True)

    # 관계
    user = relationship("User", backref="password_reset_tokens")

    @classmethod
    def create_token(
        cls, user_id: int, expiry_minutes: int = 30
    ) -> "PasswordResetToken":
        """
        새로운 재설정 토큰 생성

        Args:
            user_id: 사용자 ID
            expiry_minutes: 토큰 유효 시간 (분), 기본 30분

        Returns:
            PasswordResetToken: 생성된 토큰 객체
        """
        token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

        return cls(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
        )

    def is_valid(self) -> bool:
        """
        토큰 유효성 확인

        Returns:
            bool: 토큰이 유효하면 True, 아니면 False
        """
        if self.is_used:
            return False

        if datetime.now(timezone.utc) > self.expires_at:
            return False

        return True

    def mark_as_used(self) -> None:
        """토큰을 사용됨으로 표시"""
        self.is_used = True
        self.used_at = datetime.now(timezone.utc)

    def to_dict(self):
        """딕셔너리 변환"""
        return {
            "id": self.id,
            "token": self.token,
            "user_id": self.user_id,
            "is_used": self.is_used,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "used_at": self.used_at.isoformat() if self.used_at else None,
        }

    def __repr__(self):
        return f"<PasswordResetToken(id={self.id}, user_id={self.user_id}, is_used={self.is_used})>"
