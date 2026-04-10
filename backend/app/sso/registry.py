"""
SSO Provider Registry

SSO Provider 등록/조회 — 싱글톤.
활성화된 Provider만 등록되어 프론트엔드에 노출.
"""

import structlog

from app.sso.base import BaseSSOProvider

logger = structlog.get_logger()


class SSOProviderRegistry:
    """SSO Provider 등록/조회"""

    def __init__(self):
        self._providers: dict[str, BaseSSOProvider] = {}

    def register(self, provider: BaseSSOProvider) -> None:
        name = provider.get_provider_name()
        if not provider.is_configured():
            logger.warning("sso_provider_not_configured", provider=name)
            return
        self._providers[name] = provider
        logger.info("sso_provider_registered", provider=name)

    def get(self, name: str) -> BaseSSOProvider | None:
        return self._providers.get(name)

    def get_all_active(self) -> list[BaseSSOProvider]:
        return list(self._providers.values())

    def get_provider_info(self) -> list[dict]:
        """프론트엔드에 전달할 활성 SSO Provider 목록"""
        return [
            {
                "name": p.get_provider_name(),
                "display_name": p.get_display_name(),
                "icon": p.get_icon(),
            }
            for p in self._providers.values()
        ]


# 전역 인스턴스
sso_registry = SSOProviderRegistry()
