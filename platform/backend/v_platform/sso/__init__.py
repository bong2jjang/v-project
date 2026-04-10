"""
SSO Provider 초기화

환경 변수 기반 SSO Provider 자동 등록.
온프레미스 배포 시 환경 변수만 교체하면 SSO Provider 전환 가능.
"""

import os

import structlog

from v_platform.sso.microsoft import MicrosoftSSOProvider
from v_platform.sso.generic_oidc import GenericOIDCProvider
from v_platform.sso.registry import sso_registry

logger = structlog.get_logger()


def init_sso_providers():
    """환경 변수 기반 SSO Provider 자동 등록

    온프레미스 배포 시:
    - MS SSO 환경 변수를 제거하고
    - OIDC_* 환경 변수를 고객사 IdP로 설정하면 자동 전환
    """

    # --- Microsoft SSO (Teams 자격증명 재사용) ---
    sso_tenant = os.getenv("TEAMS_TENANT_ID", "")
    sso_client = os.getenv("TEAMS_APP_ID", "")
    sso_secret = os.getenv("TEAMS_APP_PASSWORD", "")

    if sso_tenant and sso_client and sso_secret:
        sso_registry.register(
            MicrosoftSSOProvider(
                tenant_id=sso_tenant,
                client_id=sso_client,
                client_secret=sso_secret,
            )
        )

    # --- Generic OIDC (고객사 SSO) ---
    oidc_issuer = os.getenv("SSO_OIDC_ISSUER_URL", "")
    oidc_client = os.getenv("SSO_OIDC_CLIENT_ID", "")
    oidc_secret = os.getenv("SSO_OIDC_CLIENT_SECRET", "")

    if oidc_issuer and oidc_client and oidc_secret:
        sso_registry.register(
            GenericOIDCProvider(
                provider_name=os.getenv("SSO_OIDC_PROVIDER_NAME", "corporate_sso"),
                display_name=os.getenv("SSO_OIDC_DISPLAY_NAME", "회사 SSO"),
                icon=os.getenv("SSO_OIDC_ICON", "key"),
                issuer_url=oidc_issuer,
                client_id=oidc_client,
                client_secret=oidc_secret,
                scopes=os.getenv("SSO_OIDC_SCOPES", "openid email profile"),
                email_claim=os.getenv("SSO_OIDC_EMAIL_CLAIM", "email"),
                name_claim=os.getenv("SSO_OIDC_NAME_CLAIM", "name"),
                sub_claim=os.getenv("SSO_OIDC_SUB_CLAIM", "sub"),
            )
        )

    active = sso_registry.get_all_active()
    if active:
        logger.info(
            "sso_providers_initialized",
            count=len(active),
            providers=[p.get_provider_name() for p in active],
        )
    else:
        logger.info("sso_no_providers_configured")
