"""
Message Models

메시지 히스토리 저장을 위한 데이터베이스 모델
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Index,
    JSON,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Message(Base):
    """메시지 테이블"""

    __tablename__ = "messages"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Message Info
    message_id = Column(String(255), nullable=True, index=True)
    text = Column(Text, nullable=False)

    # Source
    gateway = Column(String(100), nullable=False, index=True)
    source_account = Column(String(100), nullable=False)
    source_channel = Column(String(100), nullable=False, index=True)
    source_user = Column(String(100), nullable=True, index=True)
    source_user_name = Column(String(255), nullable=True)  # 사용자명
    source_user_display_name = Column(String(255), nullable=True)  # 표시 이름

    # Destination
    destination_account = Column(String(100), nullable=False)
    destination_channel = Column(String(100), nullable=False, index=True)
    source_channel_name = Column(String(255), nullable=True)
    destination_channel_name = Column(String(255), nullable=True)

    # Metadata
    protocol = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Additional Info
    has_attachment = Column(Boolean, default=False)
    attachment_count = Column(Integer, default=0)
    attachment_details = Column(JSON, nullable=True)  # 첨부파일 상세 정보
    message_type = Column(String(50), default="text")
    message_format = Column(String(50), default="text")  # text, markdown, code, etc.

    # Delivery Status
    status = Column(
        String(20), default="pending", nullable=False, index=True
    )  # pending, sent, failed, retrying
    error_message = Column(Text, nullable=True)  # Error details if failed
    retry_count = Column(Integer, default=0)  # Number of retry attempts
    delivered_at = Column(
        DateTime(timezone=True), nullable=True
    )  # Timestamp when successfully delivered

    # Indexes
    __table_args__ = (
        Index("idx_timestamp", "timestamp"),
        Index("idx_gateway", "gateway"),
        Index("idx_source_channel", "source_channel"),
        Index("idx_destination_channel", "destination_channel"),
        Index("idx_source_user", "source_user"),
        Index("idx_created_at", "created_at"),
        Index("idx_status", "status"),
    )

    def __repr__(self):
        return (
            f"<Message(id={self.id}, gateway={self.gateway}, text={self.text[:50]}...)>"
        )

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "message_id": self.message_id,
            "text": self.text,
            "gateway": self.gateway,
            "source": {
                "account": self.source_account,
                "channel": self.source_channel,
                "channel_name": self.source_channel_name,
                "user": self.source_user,
                "user_name": self.source_user_name,
                "display_name": self.source_user_display_name,
            },
            "destination": {
                "account": self.destination_account,
                "channel": self.destination_channel,
                "channel_name": self.destination_channel_name,
            },
            "protocol": self.protocol,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_attachment": self.has_attachment,
            "attachment_count": self.attachment_count,
            "attachment_details": self.attachment_details,
            "message_type": self.message_type,
            "message_format": self.message_format,
            "status": self.status,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "delivered_at": self.delivered_at.isoformat()
            if self.delivered_at
            else None,
        }


class MessageStats(Base):
    """메시지 통계 테이블"""

    __tablename__ = "message_stats"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Date (unique per day)
    date = Column(DateTime(timezone=True), nullable=False, unique=True, index=True)

    # Counts
    total_messages = Column(Integer, default=0)

    # JSON Stats
    gateway_stats = Column(JSON, nullable=True)  # {"gateway1": count, ...}
    channel_stats = Column(JSON, nullable=True)  # {"channel1": count, ...}
    hourly_stats = Column(JSON, nullable=True)  # {"00": count, "01": count, ...}

    # Metadata
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self):
        return f"<MessageStats(date={self.date}, total={self.total_messages})>"

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "total_messages": self.total_messages,
            "gateway_stats": self.gateway_stats,
            "channel_stats": self.channel_stats,
            "hourly_stats": self.hourly_stats,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
