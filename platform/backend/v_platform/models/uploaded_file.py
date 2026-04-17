"""
UploadedFile Model

이미지/아바타 등 업로드 파일을 DB BYTEA로 저장하는 모델.
멀티앱 아키텍처에서 앱별 Docker 볼륨 격리 문제를 해결하기 위해
파일시스템 대신 PostgreSQL에 저장합니다.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, LargeBinary
from v_platform.models.base import Base


class UploadedFile(Base):
    """업로드 파일 (BLOB 저장)"""

    __tablename__ = "uploaded_files"

    id = Column(String(36), primary_key=True)  # UUID
    content = Column(LargeBinary, nullable=False)
    mime_type = Column(String(100), nullable=False)
    size = Column(Integer, nullable=False)
    purpose = Column(String(32), nullable=False, index=True)  # 'avatar' | 'image'
    uploaded_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    uploaded_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return (
            f"<UploadedFile(id={self.id}, purpose={self.purpose}, "
            f"size={self.size}, mime={self.mime_type})>"
        )
