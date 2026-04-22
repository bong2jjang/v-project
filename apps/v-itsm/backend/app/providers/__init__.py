"""v-itsm 내장 알림 provider — Slack/Teams 로 직접 송출.

v-channel-bridge 의 Provider Pattern 을 outbound-only 로 축약 포팅했다.
설계 의도: **앱 간 런타임 HTTP 의존 회피**. v-channel-bridge 가 내려가도
v-itsm 알림은 독립적으로 동작한다.

공개 API
    from app.providers import provider_registry, init_providers_from_env
    provider_registry.get(Platform.SLACK).send_message(message)
"""

from app.providers.base import BaseOutboundProvider
from app.providers.registry import (
    init_providers,
    init_providers_from_env,
    provider_registry,
    reload_providers,
    shutdown_providers,
)

__all__ = [
    "BaseOutboundProvider",
    "init_providers",
    "init_providers_from_env",
    "provider_registry",
    "reload_providers",
    "shutdown_providers",
]
