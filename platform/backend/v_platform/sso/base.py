"""
SSO Provider Base Interface

모든 SSO Provider가 상속하는 추상 인터페이스.
온프레미스 배포 시 고객사 SSO를 쉽게 교체할 수 있도록 설계.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SSOUserInfo:
    """SSO 인증 후 반환되는 사용자 정보 (모든 Provider 공통)"""

    email: str
    display_name: str
    provider_user_id: str  # Provider 측 고유 ID
    provider_name: str  # "microsoft", "oidc", "saml" 등
    avatar_url: Optional[str] = None
    raw_claims: Optional[dict] = field(default=None, repr=False)


class BaseSSOProvider(ABC):
    """SSO Provider 인터페이스 — 모든 SSO 구현체가 상속"""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Provider 식별자 (URL 경로에 사용)"""
        ...

    @abstractmethod
    def get_display_name(self) -> str:
        """UI에 표시할 이름 (e.g., 'Microsoft 365')"""
        ...

    @abstractmethod
    def get_icon(self) -> str:
        """UI 아이콘 식별자 (e.g., 'microsoft', 'key')"""
        ...

    @abstractmethod
    async def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """인증 서버 리다이렉트 URL 생성"""
        ...

    @abstractmethod
    async def handle_callback(
        self, code: str, state: str, redirect_uri: str
    ) -> SSOUserInfo:
        """인증 서버 콜백 처리 → SSOUserInfo 반환"""
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """필수 설정값이 모두 존재하는지 확인"""
        ...
