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
    manual_url = Column(String, default="http://127.0.0.1:3000", nullable=False)
    support_email = Column(String, nullable=True)
    support_url = Column(String, nullable=True)
    default_start_page = Column(
        String(255), default="/", nullable=False, server_default="/"
    )

    # 앱 브랜딩 설정
    app_title = Column(String(200), nullable=True)  # 앱 표시 이름 (TopBar, Login)
    app_description = Column(String(500), nullable=True)  # 앱 설명 (Login 페이지)
    app_logo_url = Column(String(500), nullable=True)  # 로고 이미지 URL (선택)

    app_id = Column(String(50), nullable=True)  # NULL = global, value = app-specific
