"""
Audit Log Model

감사 로그 데이터베이스 모델
"""

from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, Index, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.database import Base


class AuditAction(str, Enum):
    """감사 로그 액션 타입"""

    # 사용자 관련
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    USER_REGISTER = "user.register"
    USER_UPDATE = "user.update"
    USER_DELETE = "user.delete"
    USER_ROLE_CHANGE = "user.role_change"
    USER_PASSWORD_CHANGE = "user.password_change"
    USER_PASSWORD_RESET_REQUEST = "user.password_reset_request"
    USER_PASSWORD_RESET = "user.password_reset"

    # 메시지 브리지 관련
    BRIDGE_START = "bridge.start"
    BRIDGE_STOP = "bridge.stop"
    BRIDGE_RESTART = "bridge.restart"
    BRIDGE_ROUTE_ADD = "bridge.route.add"
    BRIDGE_ROUTE_REMOVE = "bridge.route.remove"

    # 설정 관련
    CONFIG_READ = "config.read"
    CONFIG_UPDATE = "config.update"
    CONFIG_BACKUP = "config.backup"
    CONFIG_RESTORE = "config.restore"

    # 채널 관련
    CHANNEL_CREATE = "channel.create"
    CHANNEL_UPDATE = "channel.update"
    CHANNEL_DELETE = "channel.delete"

    # 메뉴 관련
    MENU_CREATE = "menu.create"
    MENU_UPDATE = "menu.update"
    MENU_DELETE = "menu.delete"
    MENU_REORDER = "menu.reorder"

    # 권한 관련
    PERMISSION_UPDATE = "permission.update"


class AuditLog(Base):
    """
    감사 로그 모델

    시스템의 중요한 작업들을 추적하기 위한 감사 로그
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_status_timestamp", "status", "timestamp"),
        Index("ix_audit_logs_action_timestamp", "action", "timestamp"),
        Index("ix_audit_logs_user_email_timestamp", "user_email", "timestamp"),
        Index("ix_audit_logs_resource_type_timestamp", "resource_type", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
    )

    # 사용자 정보
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_email = Column(String(255), nullable=True)  # 사용자 삭제 시에도 기록 유지

    # 액션 정보
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(
        String(100), nullable=True
    )  # user, config, bridge, route, channel 등
    resource_id = Column(String(255), nullable=True)  # 리소스 ID (선택적)

    # 상세 정보
    description = Column(Text, nullable=True)  # 액션에 대한 설명
    details = Column(Text, nullable=True)  # JSON 형식의 추가 정보

    # 결과
    status = Column(String(50), default="success")  # success, failure, error
    error_message = Column(Text, nullable=True)  # 에러 발생 시 메시지

    # 요청 정보
    ip_address = Column(String(45), nullable=True)  # IPv6 지원
    user_agent = Column(String(500), nullable=True)

    # 관계
    user = relationship("User", back_populates="audit_logs")

    def to_dict(self) -> dict:
        """딕셔너리 변환"""
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_id": self.user_id,
            "user_email": self.user_email,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "description": self.description,
            "details": self.details,
            "status": self.status,
            "error_message": self.error_message,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
        }
