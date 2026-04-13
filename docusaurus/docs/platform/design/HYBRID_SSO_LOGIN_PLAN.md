# Hybrid Login Interface - MS SSO + Local Auth 설계

> **상태**: Draft  
> **작성일**: 2026-04-09  
> **관련 파일**: `backend/app/api/auth.py`, `frontend/src/pages/Login.tsx`

---

## 1. 목표

| 목표 | 설명 |
|------|------|
| **하이브리드 로그인** | 기존 ID/PW 로그인과 MS SSO를 병행 |
| **플러그인 SSO 아키텍처** | 온프레미스 배포 시 고객사 SSO(SAML, OIDC 등)로 교체 가능한 Provider 구조 |
| **기존 시스템 보존** | 현재 JWT 토큰, RBAC, 디바이스 추적, CSRF 보호 등 모든 보안 메커니즘 유지 |
| **계정 자동 연동** | SSO 최초 로그인 시 자동 계정 생성 또는 기존 계정과 이메일 기반 연동 |

---

## 2. 아키텍처 개요

### 2.1 핵심 원칙: SSO Provider Pattern

```
┌──────────────────────────────────────────────────────────┐
│                   Login Page (Frontend)                    │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │  Local Login  │  │  SSO Button(s) — 설정 기반 렌더  │  │
│  │  (ID / PW)   │  │  [Microsoft로 로그인]            │  │
│  └──────┬───────┘  └──────────────┬───────────────────┘  │
└─────────┼──────────────────────────┼─────────────────────┘
          │                          │
          ▼                          ▼
   POST /api/auth/login      GET /api/auth/sso/{provider}/login
          │                          │
          ▼                          ▼
   기존 JWT 발급 로직     ┌─────────────────────┐
                          │  SSOProviderRegistry │
                          │  ┌─────────────────┐ │
                          │  │ MicrosoftSSO    │ │  ← 기본 제공
                          │  │ GenericOIDCSSO  │ │  ← OIDC 범용
                          │  │ GenericSAMLSSO  │ │  ← SAML 범용 (향후)
                          │  │ CustomSSO       │ │  ← 고객사 구현
                          │  └─────────────────┘ │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          SSO 인증 완료 후 → 내부 JWT 발급
                          (기존 토큰 시스템 그대로 사용)
```

### 2.2 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| **SSO는 인증(Authentication)만 위임** | 인가(Authorization)는 기존 RBAC 시스템이 담당. SSO Provider는 "이 사람이 누구인지"만 확인 |
| **SSO 인증 후 내부 JWT 발급** | 프론트엔드는 인증 방식에 무관하게 동일한 JWT로 동작. 기존 코드 변경 최소화 |
| **Provider 설정은 환경 변수 + DB** | 환경 변수로 Provider 활성화, DB에 Provider별 상세 설정 저장 |
| **이메일 기반 계정 매칭** | SSO에서 받은 이메일로 기존 User 테이블 조회. 없으면 자동 생성 |

---

## 3. Backend 설계

### 3.1 SSO Provider 인터페이스

```python
# backend/app/sso/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class SSOUserInfo:
    """SSO 인증 후 반환되는 사용자 정보 (모든 Provider 공통)"""
    email: str
    display_name: str
    provider_user_id: str          # Provider 측 고유 ID
    provider_name: str             # "microsoft", "oidc", "saml" 등
    avatar_url: Optional[str] = None
    raw_claims: Optional[dict] = None  # Provider 원본 클레임 (디버깅용)


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
```

### 3.2 Microsoft SSO Provider 구현

```python
# backend/app/sso/microsoft.py

import httpx
from app.sso.base import BaseSSOProvider, SSOUserInfo


class MicrosoftSSOProvider(BaseSSOProvider):
    """Microsoft Entra ID (Azure AD) — OpenID Connect 기반"""

    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.authority = f"https://login.microsoftonline.com/{tenant_id}"

    def get_provider_name(self) -> str:
        return "microsoft"

    def get_display_name(self) -> str:
        return "Microsoft 365"

    def get_icon(self) -> str:
        return "microsoft"

    def is_configured(self) -> bool:
        return all([self.tenant_id, self.client_id, self.client_secret])

    async def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "response_mode": "query",
            "scope": "openid email profile User.Read",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.authority}/oauth2/v2.0/authorize?{query}"

    async def handle_callback(
        self, code: str, state: str, redirect_uri: str
    ) -> SSOUserInfo:
        # 1. Authorization Code → Token 교환
        token_url = f"{self.authority}/oauth2/v2.0/token"
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(token_url, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "scope": "openid email profile User.Read",
            })
            token_resp.raise_for_status()
            tokens = token_resp.json()

            # 2. Access Token으로 사용자 정보 조회
            me_resp = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            me_resp.raise_for_status()
            me = me_resp.json()

        return SSOUserInfo(
            email=me.get("mail") or me.get("userPrincipalName"),
            display_name=me.get("displayName", ""),
            provider_user_id=me["id"],
            provider_name="microsoft",
            avatar_url=None,  # Graph API 별도 호출 필요
            raw_claims=me,
        )
```

### 3.3 Generic OIDC Provider (범용 — 고객사 SSO 대응)

```python
# backend/app/sso/generic_oidc.py

import httpx
from app.sso.base import BaseSSOProvider, SSOUserInfo


class GenericOIDCProvider(BaseSSOProvider):
    """범용 OIDC Provider — 고객사 IdP(Keycloak, Okta, ADFS 등) 대응"""

    def __init__(
        self,
        provider_name: str,
        display_name: str,
        icon: str,
        issuer_url: str,       # e.g., https://keycloak.customer.com/realms/main
        client_id: str,
        client_secret: str,
        scopes: str = "openid email profile",
        # 클레임 매핑 (IdP마다 클레임 키가 다를 수 있음)
        email_claim: str = "email",
        name_claim: str = "name",
        sub_claim: str = "sub",
    ):
        self._provider_name = provider_name
        self._display_name = display_name
        self._icon = icon
        self.issuer_url = issuer_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.scopes = scopes
        self.email_claim = email_claim
        self.name_claim = name_claim
        self.sub_claim = sub_claim
        self._oidc_config: dict | None = None

    def get_provider_name(self) -> str:
        return self._provider_name

    def get_display_name(self) -> str:
        return self._display_name

    def get_icon(self) -> str:
        return self._icon

    def is_configured(self) -> bool:
        return all([self.issuer_url, self.client_id, self.client_secret])

    async def _discover(self) -> dict:
        """OIDC Discovery (.well-known) 자동 조회"""
        if self._oidc_config:
            return self._oidc_config
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.issuer_url}/.well-known/openid-configuration"
            )
            resp.raise_for_status()
            self._oidc_config = resp.json()
        return self._oidc_config

    async def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        config = await self._discover()
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": self.scopes,
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{config['authorization_endpoint']}?{query}"

    async def handle_callback(
        self, code: str, state: str, redirect_uri: str
    ) -> SSOUserInfo:
        config = await self._discover()

        async with httpx.AsyncClient() as client:
            # Token 교환
            token_resp = await client.post(config["token_endpoint"], data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })
            token_resp.raise_for_status()
            tokens = token_resp.json()

            # UserInfo 조회
            userinfo_resp = await client.get(
                config["userinfo_endpoint"],
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()

        return SSOUserInfo(
            email=userinfo.get(self.email_claim, ""),
            display_name=userinfo.get(self.name_claim, ""),
            provider_user_id=userinfo.get(self.sub_claim, ""),
            provider_name=self._provider_name,
            raw_claims=userinfo,
        )
```

### 3.4 SSO Provider Registry

```python
# backend/app/sso/registry.py

import structlog
from app.sso.base import BaseSSOProvider

logger = structlog.get_logger()


class SSOProviderRegistry:
    """SSO Provider 등록/조회 — 싱글톤"""

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
```

### 3.5 SSO 초기화 (main.py 연동)

```python
# backend/app/sso/__init__.py

import os
from app.sso.registry import sso_registry
from app.sso.microsoft import MicrosoftSSOProvider
from app.sso.generic_oidc import GenericOIDCProvider


def init_sso_providers():
    """환경 변수 기반 SSO Provider 자동 등록
    
    온프레미스 배포 시:
    - MS SSO 환경 변수를 제거하고
    - OIDC_* 환경 변수를 고객사 IdP로 설정하면 자동 전환
    """

    # --- Microsoft SSO ---
    sso_tenant = os.getenv("SSO_MICROSOFT_TENANT_ID", "")
    sso_client = os.getenv("SSO_MICROSOFT_CLIENT_ID", "")
    sso_secret = os.getenv("SSO_MICROSOFT_CLIENT_SECRET", "")

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
```

### 3.6 SSO API 엔드포인트

```python
# backend/app/api/auth_sso.py

import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from app.sso.registry import sso_registry
from app.sso.base import SSOUserInfo
from app.services.token_service import TokenService
from app.models.user import User, UserRole
from app.db.database import get_db
from app.utils.audit_logger import AuditLogger

router = APIRouter(prefix="/api/auth/sso", tags=["SSO Authentication"])

# State 토큰 저장 (Redis 권장, MVP는 in-memory)
_pending_states: dict[str, dict] = {}


@router.get("/providers")
async def list_sso_providers():
    """프론트엔드용: 활성 SSO Provider 목록 반환"""
    return sso_registry.get_provider_info()


@router.get("/{provider}/login")
async def sso_login(provider: str, request: Request):
    """SSO 인증 시작 → Provider 인증 페이지로 리다이렉트"""
    sso = sso_registry.get(provider)
    if not sso:
        raise HTTPException(404, f"SSO provider '{provider}' not found")

    state = secrets.token_urlsafe(32)
    redirect_uri = str(request.base_url).rstrip("/") + f"/api/auth/sso/{provider}/callback"

    _pending_states[state] = {
        "provider": provider,
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc),
    }

    auth_url = await sso.get_authorization_url(state, redirect_uri)
    return RedirectResponse(auth_url)


@router.get("/{provider}/callback")
async def sso_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
    response: Response,
):
    """SSO 인증 콜백 → 내부 JWT 발급"""
    # 1. State 검증
    pending = _pending_states.pop(state, None)
    if not pending or pending["provider"] != provider:
        raise HTTPException(400, "Invalid or expired state")

    if datetime.now(timezone.utc) - pending["created_at"] > timedelta(minutes=10):
        raise HTTPException(400, "State expired")

    # 2. Provider에서 사용자 정보 획득
    sso = sso_registry.get(provider)
    if not sso:
        raise HTTPException(404, f"SSO provider '{provider}' not found")

    sso_user: SSOUserInfo = await sso.handle_callback(
        code, state, pending["redirect_uri"]
    )

    # 3. 내부 사용자 조회 또는 생성
    async with get_db() as db:
        user = await db.execute(
            select(User).where(User.email == sso_user.email)
        )
        user = user.scalar_one_or_none()

        if user is None:
            # 자동 계정 생성 (SSO 사용자는 비밀번호 없음)
            user = User(
                email=sso_user.email,
                username=sso_user.display_name,
                hashed_password="",   # SSO 전용 계정은 비밀번호 비활성
                role=UserRole.user,
                is_active=True,
                sso_provider=provider,
                sso_provider_id=sso_user.provider_user_id,
            )
            db.add(user)
            await db.flush()

        elif not user.is_active:
            raise HTTPException(403, "Account is disabled")

        # 4. SSO 연동 정보 업데이트
        user.sso_provider = provider
        user.sso_provider_id = sso_user.provider_user_id
        user.last_login = datetime.now(timezone.utc)
        await db.commit()

        # 5. 내부 JWT 토큰 발급 (기존 시스템 그대로)
        token_service = TokenService(db)
        access_token, expires_at = token_service.create_access_token(user)
        refresh_token = await token_service.create_refresh_token(
            user_id=user.id,
            device_fingerprint=f"sso_{provider}",
            device_name=f"SSO ({sso.get_display_name()})",
            ip_address=request.client.host if request.client else "",
        )

        # Refresh token → HttpOnly cookie
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=7 * 24 * 3600,
        )

        # Audit log
        await AuditLogger.log(
            db, user_id=user.id, action="sso_login",
            resource_type="auth", description=f"SSO login via {provider}",
            ip_address=request.client.host if request.client else "",
        )

    # 6. 프론트엔드로 리다이렉트 (토큰 전달)
    #    팝업 방식: postMessage로 토큰 전달 후 닫기
    #    리다이렉트 방식: 프론트엔드 /sso/callback 페이지로 전달
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(
        f"{frontend_url}/sso/callback"
        f"?token={access_token}"
        f"&expires_at={expires_at.isoformat()}"
    )
```

### 3.7 User 모델 변경

```python
# User 모델에 추가할 필드 (backend/app/models/user.py)

class User(Base):
    # ... 기존 필드 ...

    # SSO 연동 필드 (추가)
    sso_provider = Column(String, nullable=True)       # "microsoft", "oidc", etc.
    sso_provider_id = Column(String, nullable=True)    # Provider 측 고유 ID
    auth_method = Column(String, default="local")      # "local" | "sso" | "hybrid"
```

| auth_method | 의미 |
|-------------|------|
| `local` | ID/PW만 사용 가능 |
| `sso` | SSO만 사용 가능 (비밀번호 미설정) |
| `hybrid` | 둘 다 사용 가능 (SSO 연동 + 비밀번호 설정됨) |

### 3.8 DB Migration

```python
# backend/migrations/0XX_add_sso_fields.py

"""사용자 SSO 연동 필드 추가"""

async def upgrade(conn):
    await conn.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50),
        ADD COLUMN IF NOT EXISTS sso_provider_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'local';
    """)
    # 기존 사용자 모두 local로 설정
    await conn.execute("""
        UPDATE users SET auth_method = 'local' WHERE auth_method IS NULL;
    """)

async def downgrade(conn):
    await conn.execute("""
        ALTER TABLE users
        DROP COLUMN IF EXISTS sso_provider,
        DROP COLUMN IF EXISTS sso_provider_id,
        DROP COLUMN IF EXISTS auth_method;
    """)
```

### 3.9 로그인 분기 로직 (기존 auth.py 수정)

```python
# POST /api/auth/login 수정 — SSO 전용 계정의 비밀번호 로그인 차단

@router.post("/login")
async def login(request: LoginRequest, ...):
    user = await get_user_by_email(request.email)

    if not user:
        raise HTTPException(401, "Invalid credentials")

    # SSO 전용 계정은 비밀번호 로그인 불가
    if user.auth_method == "sso":
        raise HTTPException(
            403,
            "This account uses SSO login only. "
            "Please use the SSO button to sign in."
        )

    # 기존 비밀번호 검증 로직 유지
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    # ... 기존 JWT 발급 로직 ...
```

---

## 4. Frontend 설계

### 4.1 로그인 페이지 UI

```
┌─────────────────────────────────────────┐
│              VMS Channel Bridge               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Email      [________________]   │  │
│  │  Password   [________________]   │  │
│  │  □ Remember me    Forgot PW? →   │  │
│  │  [        로그인        ]         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ─────────── 또는 ───────────           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  🪟 Microsoft 365로 로그인        │  │  ← SSO Provider별 동적 렌더링
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  🔑 회사 SSO로 로그인             │  │  ← 온프레미스 시 표시
│  └───────────────────────────────────┘  │
│                                         │
│  계정이 없으신가요? 회원가입 →          │
└─────────────────────────────────────────┘
```

### 4.2 SSO Provider 목록 API 연동

```typescript
// frontend/src/lib/api/auth.ts — 추가

interface SSOProviderInfo {
  name: string;        // "microsoft", "corporate_sso"
  display_name: string; // "Microsoft 365", "회사 SSO"
  icon: string;        // "microsoft", "key"
}

export async function getSSOProviders(): Promise<SSOProviderInfo[]> {
  const response = await apiClient.get("/api/auth/sso/providers");
  return response.data;
}
```

### 4.3 Login.tsx 수정 (SSO 버튼 동적 렌더링)

```tsx
// frontend/src/pages/Login.tsx — SSO 섹션 추가

function Login() {
  const [ssoProviders, setSsoProviders] = useState<SSOProviderInfo[]>([]);

  useEffect(() => {
    // 활성 SSO Provider 목록 조회 (로그인 페이지 로드 시)
    getSSOProviders()
      .then(setSsoProviders)
      .catch(() => setSsoProviders([])); // SSO 미설정 시 빈 배열
  }, []);

  const handleSSOLogin = (providerName: string) => {
    // SSO 인증 페이지로 리다이렉트
    window.location.href = `${API_BASE_URL}/api/auth/sso/${providerName}/login`;
  };

  return (
    <div>
      {/* 기존 ID/PW 로그인 폼 (변경 없음) */}
      <LoginForm ... />

      {/* SSO 버튼 — Provider가 있을 때만 표시 */}
      {ssoProviders.length > 0 && (
        <>
          <Divider label="또는" />
          <div className="space-y-2">
            {ssoProviders.map((provider) => (
              <SSOButton
                key={provider.name}
                provider={provider}
                onClick={() => handleSSOLogin(provider.name)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

### 4.4 SSO Callback 페이지

```tsx
// frontend/src/pages/SSOCallback.tsx

function SSOCallback() {
  const navigate = useNavigate();
  const { setToken } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const expiresAt = params.get("expires_at");

    if (token && expiresAt) {
      // JWT를 auth store에 저장 (기존 로그인 후 처리와 동일)
      saveToken(token, expiresAt);
      setToken(token, new Date(expiresAt));
      navigate("/", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, []);

  return <LoadingSpinner message="로그인 처리 중..." />;
}
```

### 4.5 App.tsx 라우트 추가

```tsx
// 공개 라우트에 추가
<Route path="/sso/callback" element={<SSOCallback />} />
```

---

## 5. 환경 변수 설계

### 5.1 SaaS 배포 (MS SSO)

```bash
# .env — Microsoft SSO 활성화
SSO_MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SSO_MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SSO_MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5.2 온프레미스 배포 (고객사 Keycloak 예시)

```bash
# .env — 고객사 SSO로 교체 (MS SSO 변수 제거 또는 비움)
SSO_OIDC_ISSUER_URL=https://keycloak.customer.com/realms/main
SSO_OIDC_CLIENT_ID=vms-channel-bridge
SSO_OIDC_CLIENT_SECRET=customer-secret
SSO_OIDC_PROVIDER_NAME=customer_sso
SSO_OIDC_DISPLAY_NAME=회사 통합인증
SSO_OIDC_ICON=building
SSO_OIDC_SCOPES=openid email profile
SSO_OIDC_EMAIL_CLAIM=email
SSO_OIDC_NAME_CLAIM=preferred_username
SSO_OIDC_SUB_CLAIM=sub
```

### 5.3 교체 절차 (운영팀 가이드)

| 단계 | 작업 |
|------|------|
| 1 | `.env`에서 `SSO_MICROSOFT_*` 변수 제거 |
| 2 | `.env`에 `SSO_OIDC_*` 변수 설정 (고객사 IdP 정보) |
| 3 | 고객사 IdP에 VMS Channel Bridge를 Client로 등록 (redirect_uri 설정) |
| 4 | `docker compose up -d --build` 재배포 |
| 5 | 로그인 페이지에서 고객사 SSO 버튼 확인 |

**코드 수정 없이 환경 변수만으로 SSO Provider 전환 가능.**

---

## 6. 보안 고려사항

| 항목 | 대책 |
|------|------|
| **State CSRF** | 랜덤 32바이트 state 토큰, 10분 만료 (Redis 저장 권장) |
| **Token 전달** | SSO callback에서 프론트엔드로 토큰 전달 시 URL 파라미터 → 즉시 소비 후 URL에서 제거. 향후 PKCE 적용 검토 |
| **계정 탈취 방지** | SSO 이메일과 기존 계정 매칭 시 이미 SSO 연동된 계정만 자동 로그인. 첫 연동 시 관리자 승인 옵션 제공 가능 |
| **SSO 전용 계정** | `auth_method="sso"` 계정은 비밀번호 로그인 차단 |
| **Provider 장애** | SSO Provider 장애 시 로컬 로그인으로 fallback (하이브리드 계정) |
| **감사 로그** | SSO 로그인도 기존 audit_log에 기록 (provider 정보 포함) |
| **PKCE (향후)** | Authorization Code + PKCE 적용으로 code intercept 공격 방지 |

---

## 7. 구현 계획

### Phase 1 — SSO Provider 인프라 (백엔드)

| 작업 | 파일 | 비고 |
|------|------|------|
| `BaseSSOProvider` 인터페이스 | `backend/app/sso/base.py` | 신규 |
| `MicrosoftSSOProvider` 구현 | `backend/app/sso/microsoft.py` | 신규 |
| `GenericOIDCProvider` 구현 | `backend/app/sso/generic_oidc.py` | 신규 |
| `SSOProviderRegistry` | `backend/app/sso/registry.py` | 신규 |
| SSO 초기화 함수 | `backend/app/sso/__init__.py` | 신규 |
| SSO API 라우터 | `backend/app/api/auth_sso.py` | 신규 |
| User 모델 SSO 필드 | `backend/app/models/user.py` | 수정 |
| DB Migration | `backend/migrations/0XX_*.py` | 신규 |
| main.py에 SSO 라우터 등록 | `backend/app/main.py` | 수정 |
| CSRF 미들웨어 SSO 경로 제외 | `backend/app/middleware/csrf.py` | 수정 |

### Phase 2 — 프론트엔드 하이브리드 UI

| 작업 | 파일 | 비고 |
|------|------|------|
| SSO Provider API 클라이언트 | `frontend/src/lib/api/auth.ts` | 수정 |
| SSO 버튼 컴포넌트 | `frontend/src/components/auth/SSOButton.tsx` | 신규 |
| 로그인 페이지 SSO 통합 | `frontend/src/pages/Login.tsx` | 수정 |
| SSO Callback 페이지 | `frontend/src/pages/SSOCallback.tsx` | 신규 |
| App.tsx 라우트 추가 | `frontend/src/App.tsx` | 수정 |
| 타입 정의 추가 | `frontend/src/lib/api/types.ts` | 수정 |

### Phase 3 — 보안 강화 및 관리 기능

| 작업 | 설명 |
|------|------|
| State를 Redis로 이전 | in-memory → Redis (다중 인스턴스 대응) |
| PKCE 지원 | Authorization Code + PKCE |
| 관리자 SSO 설정 UI | Settings 페이지에서 SSO Provider 설정 관리 |
| SSO 계정 자동 생성 정책 | 자동 생성 / 관리자 승인 / 거부 중 선택 |
| SSO 로그인 통계 | 대시보드에 SSO vs Local 로그인 비율 표시 |

---

## 8. 파일 변경 영향도

```
신규 파일 (7개):
  backend/app/sso/base.py
  backend/app/sso/microsoft.py
  backend/app/sso/generic_oidc.py
  backend/app/sso/registry.py
  backend/app/sso/__init__.py
  backend/app/api/auth_sso.py
  frontend/src/pages/SSOCallback.tsx

수정 파일 (7개):
  backend/app/models/user.py          ← SSO 필드 3개 추가
  backend/app/api/auth.py             ← SSO 전용 계정 비밀번호 로그인 차단
  backend/app/main.py                 ← SSO 라우터 등록, init_sso_providers() 호출
  backend/app/middleware/csrf.py      ← /api/auth/sso/* 경로 제외
  frontend/src/pages/Login.tsx        ← SSO 버튼 섹션 추가
  frontend/src/App.tsx                ← /sso/callback 라우트
  frontend/src/lib/api/types.ts       ← SSOProviderInfo 타입
```

---

## 9. 온프레미스 교체 시나리오 요약

```
SaaS 배포                          온프레미스 배포
─────────                          ──────────────
.env:                              .env:
  SSO_MICROSOFT_TENANT_ID=xxx        (삭제)
  SSO_MICROSOFT_CLIENT_ID=xxx        SSO_OIDC_ISSUER_URL=https://customer-idp/...
  SSO_MICROSOFT_CLIENT_SECRET=xxx    SSO_OIDC_CLIENT_ID=vms-channel-bridge
                                     SSO_OIDC_CLIENT_SECRET=xxx
                                     SSO_OIDC_DISPLAY_NAME=통합인증

결과:                              결과:
  로그인 페이지:                     로그인 페이지:
  ┌────────────────────┐             ┌────────────────────┐
  │ [ID/PW 로그인]     │             │ [ID/PW 로그인]     │
  │ ── 또는 ──         │             │ ── 또는 ──         │
  │ [MS 365 로그인]    │             │ [통합인증 로그인]   │
  └────────────────────┘             └────────────────────┘
```

**코드 변경 = 0. 환경 변수만 교체.**
