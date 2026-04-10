"""
User Models

사용자 인증 및 권한 관리를 위한 데이터베이스 모델
"""

from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from app.models.base import Base


class UserRole(str, Enum):
    """사용자 역할 (RBAC 3단계)"""

    SYSTEM_ADMIN = "system_admin"  # 개발사(VMS) 관리자 — 모든 권한 자동 획득
    ORG_ADMIN = "org_admin"  # 운영관리자 (고객사) — 위임 범위 내 전권
    USER = "user"  # 일반사용자 — 부여받은 메뉴만 접근


class User(Base):
    """사용자 테이블"""

    __tablename__ = "users"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 인증 정보
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # 권한 및 상태
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # 타임스탬프
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_login = Column(DateTime(timezone=True), nullable=True)

    # SSO 연동 필드
    sso_provider = Column(String(50), nullable=True)  # "microsoft", "corporate_sso" 등
    sso_provider_id = Column(String(255), nullable=True)  # Provider 측 고유 ID
    auth_method = Column(String(20), default="local")  # "local" | "sso" | "hybrid"

    # 사용자 설정 (빈 문자열 = 시스템 기본값 사용)
    start_page = Column(String(255), default="", nullable=False, server_default="")
    theme = Column(
        String(20), default="system", nullable=False, server_default="system"
    )
    color_preset = Column(
        String(20), default="blue", nullable=False, server_default="blue"
    )

    # 조직 정보
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )

    # 관계
    audit_logs = relationship(
        "AuditLog", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    oauth_tokens = relationship(
        "UserOAuthToken", back_populates="user", cascade="all, delete-orphan"
    )
    permissions = relationship(
        "UserPermission",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[UserPermission.user_id]",
    )
    company = relationship("Company", back_populates="users")
    department = relationship("Department", back_populates="users")
    group_memberships = relationship(
        "UserGroupMembership",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[UserGroupMembership.user_id]",
    )

    def to_dict(self):
        """딕셔너리 변환 (비밀번호 제외)"""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "role": self.role.value if isinstance(self.role, UserRole) else self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "auth_method": self.auth_method or "local",
            "sso_provider": self.sso_provider,
            "start_page": self.start_page if self.start_page is not None else "",
            "theme": self.theme or "system",
            "color_preset": self.color_preset or "blue",
        }

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
