"""시스템 전역 설정 모델

메뉴얼 URL, 지원 연락처 등 시스템 전역 설정을 관리합니다.
"""

from sqlalchemy import Boolean, Column, Integer, String

from v_platform.models.base import Base


class SystemSettings(Base):
    """시스템 전역 설정

    Attributes:
        id: 기본 키 (항상 1)
        manual_enabled: 메뉴얼 링크 표시 여부
        manual_url: 메뉴얼 URL
        support_email: 지원 이메일 (선택사항)
        support_url: 지원 URL (선택사항)
        default_start_page: 시스템 기본 시작 페이지 (기본값 "/")
    """

    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    manual_enabled = Column(Boolean, default=True, nullable=False)
    manual_url = Column(String, default="http://localhost:3000", nullable=False)
    support_email = Column(String, nullable=True)
    support_url = Column(String, nullable=True)
    default_start_page = Column(
        String(255), default="/", nullable=False, server_default="/"
    )
