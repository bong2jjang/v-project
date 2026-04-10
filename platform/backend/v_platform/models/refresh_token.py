"""
Refresh Token Models

Refresh Token 관리를 위한 데이터베이스 모델
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from v_platform.models.base import Base


class RefreshToken(Base):
    """Refresh Token 테이블"""

    __tablename__ = "refresh_tokens"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 사용자 참조
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 토큰 정보
    token_hash = Column(
        String(64), unique=True, nullable=False, index=True
    )  # SHA-256 해시

    # 디바이스 정보
    device_fingerprint = Column(String(128), nullable=True)
    device_name = Column(String(256), nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 지원

    # 만료 및 상태
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    is_revoked = Column(Boolean, default=False, nullable=False, index=True)

    # 타임스탬프
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_used_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # 관계
    user = relationship("User", back_populates="refresh_tokens")

    def to_dict(self):
        """딕셔너리 변환"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "device_fingerprint": self.device_fingerprint,
            "device_name": self.device_name,
            "ip_address": self.ip_address,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_revoked": self.is_revoked,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat()
            if self.last_used_at
            else None,
        }

    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, device={self.device_name})>"
