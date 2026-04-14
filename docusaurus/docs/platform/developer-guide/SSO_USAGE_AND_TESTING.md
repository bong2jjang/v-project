---
id: sso-usage-and-testing
title: SSO 사용법 및 테스트 가이드
sidebar_position: 7
tags: [guide, developer]
---

# SSO (Single Sign-On) 사용법 및 테스트 가이드

v-platform은 **OIDC (OpenID Connect)** 기반 SSO를 지원합니다. Microsoft 365와 Generic OIDC 두 가지 Provider를 내장하며, 환경 변수만 교체하면 온프레미스 IdP(Keycloak, Okta, Auth0 등)로 전환할 수 있습니다.

---

## 1. SSO 아키텍처

### 1.1 전체 구조

```
┌───────────────────────────────────────────────────────┐
│  SSO 시스템                                            │
│                                                       │
│  BaseSSOProvider (ABC)                                │
│      ├── MicrosoftSSOProvider                         │
│      └── GenericOIDCProvider                          │
│                                                       │
│  SSOProviderRegistry (싱글톤)                          │
│      register() / get() / get_all_active()            │
│                                                       │
│  init_sso_providers()                                 │
│      환경 변수 → Provider 생성 → Registry 등록          │
└───────────────────────────────────────────────────────┘
```

### 1.2 파일 구조

```
platform/backend/v_platform/sso/
├── __init__.py          # init_sso_providers() — 환경 변수 기반 자동 등록
├── base.py              # BaseSSOProvider (ABC) + SSOUserInfo (dataclass)
├── registry.py          # SSOProviderRegistry (싱글톤)
├── microsoft.py         # MicrosoftSSOProvider
└── generic_oidc.py      # GenericOIDCProvider

platform/backend/v_platform/api/
└── auth_sso.py          # SSO API 엔드포인트 (/api/auth/sso/*)

platform/frontend/v-platform-core/src/
├── pages/SSOCallback.tsx      # SSO 콜백 팝업 페이지
├── components/oauth/
│   └── SSOLoginButtons.tsx    # 로그인 페이지 SSO 버튼
└── stores/auth.ts             # postMessage 수신 로직
```

---

## 2. Provider 인터페이스

### 2.1 BaseSSOProvider (추상 클래스)

모든 SSO Provider가 구현해야 하는 인터페이스입니다.

```python
# platform/backend/v_platform/sso/base.py

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

### 2.2 SSOUserInfo (데이터클래스)

모든 Provider가 콜백 처리 후 반환하는 공통 사용자 정보입니다.

```python
# platform/backend/v_platform/sso/base.py

@dataclass
class SSOUserInfo:
    """SSO 인증 후 반환되는 사용자 정보 (모든 Provider 공통)"""

    email: str                              # 사용자 이메일 (필수)
    display_name: str                       # 표시 이름 (필수)
    provider_user_id: str                   # Provider 측 고유 ID
    provider_name: str                      # "microsoft", "corporate_sso" 등
    avatar_url: Optional[str] = None        # 프로필 이미지 URL
    raw_claims: Optional[dict] = field(     # 원본 토큰 클레임 (디버깅용)
        default=None, repr=False
    )
```

---

## 3. SSOProviderRegistry

### 3.1 싱글톤 레지스트리

```python
# platform/backend/v_platform/sso/registry.py

class SSOProviderRegistry:
    """SSO Provider 등록/조회"""

    def __init__(self):
        self._providers: dict[str, BaseSSOProvider] = {}

    def register(self, provider: BaseSSOProvider) -> None:
        """Provider 등록 (is_configured() 검사 포함)"""
        name = provider.get_provider_name()
        if not provider.is_configured():
            logger.warning("sso_provider_not_configured", provider=name)
            return
        self._providers[name] = provider
        logger.info("sso_provider_registered", provider=name)

    def get(self, name: str) -> BaseSSOProvider | None:
        """이름으로 Provider 조회"""
        return self._providers.get(name)

    def get_all_active(self) -> list[BaseSSOProvider]:
        """활성화된 모든 Provider 목록"""
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

:::note register() 동작
`is_configured()`가 `False`를 반환하면 Provider가 등록되지 않고 경고 로그만 남깁니다. 환경 변수가 설정되지 않은 Provider는 자동으로 비활성화됩니다.
:::

---

## 4. 환경 변수 기반 자동 등록

### 4.1 init_sso_providers() 함수

`PlatformApp.init_platform()` 호출 시 자동 실행됩니다.

```python
# platform/backend/v_platform/sso/__init__.py

def init_sso_providers():
    """환경 변수 기반 SSO Provider 자동 등록"""

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
        logger.info("sso_providers_initialized",
                     count=len(active),
                     providers=[p.get_provider_name() for p in active])
    else:
        logger.info("sso_no_providers_configured")
```

### 4.2 Microsoft SSO 환경 변수

Teams 봇 등록 시 받은 자격증명을 재사용합니다.

| 환경 변수 | 설명 | 예시 |
|-----------|------|------|
| `TEAMS_TENANT_ID` | Azure AD 테넌트 ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `TEAMS_APP_ID` | Azure 애플리케이션 ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `TEAMS_APP_PASSWORD` | Azure 클라이언트 시크릿 | `abc123~xyz789...` |

```env
# .env
TEAMS_TENANT_ID=12345678-1234-1234-1234-123456789abc
TEAMS_APP_ID=abcdefgh-abcd-abcd-abcd-abcdefghijkl
TEAMS_APP_PASSWORD=secret~password~here
```

### 4.3 Generic OIDC 환경 변수

Keycloak, Okta, Auth0 등 표준 OIDC Provider를 연결합니다.

| 환경 변수 | 필수 | 기본값 | 설명 |
|-----------|------|--------|------|
| `SSO_OIDC_ISSUER_URL` | O | - | OIDC Issuer URL |
| `SSO_OIDC_CLIENT_ID` | O | - | 클라이언트 ID |
| `SSO_OIDC_CLIENT_SECRET` | O | - | 클라이언트 시크릿 |
| `SSO_OIDC_PROVIDER_NAME` | X | `"corporate_sso"` | URL 경로용 식별자 |
| `SSO_OIDC_DISPLAY_NAME` | X | `"회사 SSO"` | UI 표시 이름 |
| `SSO_OIDC_ICON` | X | `"key"` | Lucide 아이콘 이름 |
| `SSO_OIDC_SCOPES` | X | `"openid email profile"` | OAuth2 스코프 |
| `SSO_OIDC_EMAIL_CLAIM` | X | `"email"` | 이메일 클레임 키 |
| `SSO_OIDC_NAME_CLAIM` | X | `"name"` | 이름 클레임 키 |
| `SSO_OIDC_SUB_CLAIM` | X | `"sub"` | 고유 ID 클레임 키 |

```env
# .env — Keycloak 예시
SSO_OIDC_ISSUER_URL=https://keycloak.example.com/realms/my-realm
SSO_OIDC_CLIENT_ID=v-platform
SSO_OIDC_CLIENT_SECRET=my-client-secret
SSO_OIDC_PROVIDER_NAME=keycloak
SSO_OIDC_DISPLAY_NAME=Keycloak SSO
SSO_OIDC_ICON=key
```

:::tip 온프레미스 전환
Microsoft SSO에서 고객사 SSO로 전환하려면:
1. `TEAMS_*` 환경 변수 제거 (또는 비움)
2. `SSO_OIDC_*` 환경 변수 설정
3. Docker 재시작

코드 변경 없이 환경 변수만으로 SSO Provider를 전환할 수 있습니다.
:::

---

## 5. 인증 플로우

### 5.1 전체 시퀀스

```
사용자           프론트엔드           백엔드             IdP (Microsoft/OIDC)
  │                │                  │                      │
  │─ SSO 버튼 클릭 →│                  │                      │
  │                │─ 팝업 열기 ──────→│                      │
  │                │  GET /api/auth/   │                      │
  │                │  sso/{provider}/  │                      │
  │                │  authorize        │                      │
  │                │                  │─ state 생성           │
  │                │                  │─ auth URL 생성 ──────→│
  │                │                  │                      │
  │                │← 302 Redirect ───│                      │
  │                │                  │                      │
  │─ IdP 로그인 ──→│                  │                      │
  │                │                  │                      │
  │                │                  │← code + state ───────│
  │                │                  │                      │
  │                │  GET /api/auth/   │                      │
  │                │  sso/{provider}/  │                      │
  │                │  callback         │                      │
  │                │                  │─ code → token 교환 ──→│
  │                │                  │← 사용자 정보 ─────────│
  │                │                  │                      │
  │                │                  │─ 사용자 생성/업데이트  │
  │                │                  │─ JWT 발행             │
  │                │                  │─ HTML 응답            │
  │                │                  │  (postMessage)        │
  │                │                  │                      │
  │                │← postMessage ────│                      │
  │                │  {access_token,   │                      │
  │                │   user}           │                      │
  │                │                  │                      │
  │← 로그인 완료 ──│                  │                      │
```

### 5.2 Authorize 엔드포인트

```python
# /api/auth/sso/{provider}/authorize

@router.get("/api/auth/sso/{provider}/authorize")
async def sso_authorize(provider: str, request: Request):
    sso_provider = sso_registry.get(provider)
    if not sso_provider:
        raise HTTPException(404, "SSO provider not found")

    # state 토큰 생성 (CSRF 방지, 10분 유효)
    state = secrets.token_urlsafe(32)
    _pending_states[state] = {
        "provider": provider,
        "created_at": datetime.utcnow(),
    }

    # redirect_uri 구성
    redirect_uri = str(request.base_url) + f"api/auth/sso/{provider}/callback"

    # IdP 인증 URL로 리다이렉트
    auth_url = await sso_provider.get_authorization_url(state, redirect_uri)
    return RedirectResponse(auth_url)
```

### 5.3 Callback 엔드포인트

```python
# /api/auth/sso/{provider}/callback

@router.get("/api/auth/sso/{provider}/callback")
async def sso_callback(provider: str, code: str, state: str, request: Request):
    # 1. State 검증 (CSRF 방지, 10분 만료)
    pending = _pending_states.pop(state, None)
    if not pending:
        raise HTTPException(400, "Invalid state")
    if (datetime.utcnow() - pending["created_at"]).seconds > 600:
        raise HTTPException(400, "State expired")

    # 2. Provider에서 사용자 정보 획득
    sso_provider = sso_registry.get(provider)
    redirect_uri = str(request.base_url) + f"api/auth/sso/{provider}/callback"
    user_info: SSOUserInfo = await sso_provider.handle_callback(code, state, redirect_uri)

    # 3. DB 사용자 생성 또는 업데이트
    db_user = get_or_create_sso_user(user_info)

    # 4. JWT 토큰 발행
    access_token = TokenService.create_access_token(db_user)
    refresh_token = TokenService.create_refresh_token(db_user)

    # 5. postMessage HTML 응답
    return _render_sso_popup_result(
        access_token=access_token,
        refresh_token=refresh_token,
        user=db_user,
    )
```

### 5.4 postMessage 팝업 패턴

SSO 콜백은 HTML 페이지를 반환하여, 부모 창(로그인 페이지)에 `window.opener.postMessage()`로 토큰을 전달합니다.

```python
def _render_sso_popup_result(access_token, refresh_token, user):
    """SSO 성공 후 팝업에서 부모 창으로 결과 전달"""
    html = f"""
    <html>
    <body>
    <script>
        window.opener.postMessage({{
            type: 'sso_success',
            access_token: '{access_token}',
            user: {{
                id: {user.id},
                email: '{user.email}',
                username: '{user.username}',
                role: '{user.role}'
            }}
        }}, window.location.origin);
        window.close();
    </script>
    </body>
    </html>
    """
    # refresh_token은 HttpOnly 쿠키로 전달
    response = HTMLResponse(html)
    response.set_cookie("refresh_token", refresh_token, httponly=True, ...)
    response.set_cookie("csrf_token", csrf_token, ...)
    return response
```

:::warning 보안 고려사항
- **postMessage origin 제한**: `window.location.origin`으로 동일 출처만 허용
- **refresh_token**: `HttpOnly` 쿠키로 전달 (JavaScript 접근 불가)
- **state 토큰**: CSRF 방지, 10분 유효기간
- **_pending_states**: 인메모리 저장 (단일 인스턴스 환경)
:::

### 5.5 프론트엔드 수신

로그인 페이지에서 `window.addEventListener("message", ...)`로 SSO 결과를 수신합니다.

```tsx
// LoginPage에서 SSO 팝업 열기
const handleSSOLogin = (providerName: string) => {
  const popup = window.open(
    `/api/auth/sso/${providerName}/authorize`,
    "sso_popup",
    "width=500,height=600"
  );
};

// postMessage 수신
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "sso_success") {
      const { access_token, user } = event.data;
      authStore.setAuth(access_token, user);
      navigate("/");
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}, []);
```

---

## 6. SSO 사용자 자동 생성

SSO로 처음 로그인한 사용자는 자동으로 계정이 생성됩니다.

### 6.1 생성 규칙

| 필드 | 값 |
|------|-----|
| `email` | SSO Provider가 반환한 이메일 |
| `username` | 이메일의 `@` 앞부분 |
| `display_name` | `SSOUserInfo.display_name` |
| `role` | `user` (기본 역할) |
| `sso_provider` | Provider 이름 (예: `"microsoft"`) |
| `sso_provider_id` | `SSOUserInfo.provider_user_id` |
| `is_active` | `True` |

### 6.2 기존 사용자 매칭

이메일이 일치하는 기존 사용자가 있으면 SSO 정보를 업데이트합니다. 새 계정을 생성하지 않고 기존 계정에 SSO를 연결합니다.

---

## 7. Provider별 설정 가이드

### 7.1 Microsoft 365 설정

#### Azure Portal 등록

1. **Azure Portal** > **App registrations** > **New registration**
2. **Redirect URI** 추가:
   - Type: Web
   - URI: `http://127.0.0.1:8000/api/auth/sso/microsoft/callback`
   - 프로덕션: `https://your-domain.com/api/auth/sso/microsoft/callback`
3. **Certificates & secrets** > **New client secret** 생성
4. **API permissions** 추가:
   - `User.Read` (기본)
   - `openid`, `email`, `profile` (OIDC 스코프)

#### 환경 변수 설정

```env
TEAMS_TENANT_ID=12345678-1234-1234-1234-123456789abc
TEAMS_APP_ID=abcdefgh-abcd-abcd-abcd-abcdefghijkl
TEAMS_APP_PASSWORD=~client-secret-value~
```

#### Microsoft SSO 엔드포인트

- Authorization: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
- Token: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
- UserInfo: Microsoft Graph API (`https://graph.microsoft.com/v1.0/me`)

### 7.2 Keycloak 설정

#### Keycloak 관리자 설정

1. **Realm** 생성 (또는 기존 Realm 사용)
2. **Clients** > **Create client**
   - Client ID: `v-platform`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `http://127.0.0.1:8000/api/auth/sso/keycloak/callback`
3. **Credentials** 탭에서 Client Secret 복사

#### 환경 변수 설정

```env
SSO_OIDC_ISSUER_URL=https://keycloak.example.com/realms/my-realm
SSO_OIDC_CLIENT_ID=v-platform
SSO_OIDC_CLIENT_SECRET=keycloak-client-secret
SSO_OIDC_PROVIDER_NAME=keycloak
SSO_OIDC_DISPLAY_NAME=Keycloak SSO
SSO_OIDC_ICON=key
```

### 7.3 Okta 설정

```env
SSO_OIDC_ISSUER_URL=https://your-org.okta.com/oauth2/default
SSO_OIDC_CLIENT_ID=okta-client-id
SSO_OIDC_CLIENT_SECRET=okta-client-secret
SSO_OIDC_PROVIDER_NAME=okta
SSO_OIDC_DISPLAY_NAME=Okta SSO
SSO_OIDC_ICON=key
```

### 7.4 Auth0 설정

```env
SSO_OIDC_ISSUER_URL=https://your-tenant.auth0.com
SSO_OIDC_CLIENT_ID=auth0-client-id
SSO_OIDC_CLIENT_SECRET=auth0-client-secret
SSO_OIDC_PROVIDER_NAME=auth0
SSO_OIDC_DISPLAY_NAME=Auth0 SSO
SSO_OIDC_ICON=key
```

---

## 8. 커스텀 Provider 구현

### 8.1 새 Provider 만들기

`BaseSSOProvider`를 상속하여 새 Provider를 구현합니다.

```python
# platform/backend/v_platform/sso/my_custom.py

from v_platform.sso.base import BaseSSOProvider, SSOUserInfo


class MyCustomSSOProvider(BaseSSOProvider):
    def __init__(self, api_url: str, api_key: str):
        self._api_url = api_url
        self._api_key = api_key

    def get_provider_name(self) -> str:
        return "my_custom"

    def get_display_name(self) -> str:
        return "My Custom SSO"

    def get_icon(self) -> str:
        return "shield"

    def is_configured(self) -> bool:
        return bool(self._api_url and self._api_key)

    async def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        params = urlencode({
            "client_id": self._api_key,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": "openid email profile",
        })
        return f"{self._api_url}/authorize?{params}"

    async def handle_callback(
        self, code: str, state: str, redirect_uri: str
    ) -> SSOUserInfo:
        # 1. code → access_token 교환
        token_response = await self._exchange_code(code, redirect_uri)

        # 2. access_token으로 사용자 정보 조회
        user_data = await self._get_user_info(token_response["access_token"])

        return SSOUserInfo(
            email=user_data["email"],
            display_name=user_data["name"],
            provider_user_id=user_data["sub"],
            provider_name="my_custom",
            raw_claims=user_data,
        )
```

### 8.2 Provider 등록

`init_sso_providers()` 함수에 등록 로직을 추가합니다.

```python
# platform/backend/v_platform/sso/__init__.py

from v_platform.sso.my_custom import MyCustomSSOProvider

def init_sso_providers():
    # ... 기존 코드 ...

    # --- Custom SSO ---
    custom_url = os.getenv("SSO_CUSTOM_API_URL", "")
    custom_key = os.getenv("SSO_CUSTOM_API_KEY", "")

    if custom_url and custom_key:
        sso_registry.register(
            MyCustomSSOProvider(
                api_url=custom_url,
                api_key=custom_key,
            )
        )
```

---

## 9. API 엔드포인트 레퍼런스

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/auth/sso/providers` | 활성 SSO Provider 목록 |
| `GET` | `/api/auth/sso/{provider}/authorize` | 인증 시작 (IdP로 리다이렉트) |
| `GET` | `/api/auth/sso/{provider}/callback` | IdP 콜백 처리 (postMessage HTML) |

### 9.1 Provider 목록 응답 예시

```json
GET /api/auth/sso/providers

{
  "providers": [
    {
      "name": "microsoft",
      "display_name": "Microsoft 365",
      "icon": "microsoft",
      "login_url": "/api/auth/sso/microsoft/authorize"
    },
    {
      "name": "corporate_sso",
      "display_name": "회사 SSO",
      "icon": "key",
      "login_url": "/api/auth/sso/corporate_sso/authorize"
    }
  ]
}
```

---

## 10. 테스트 가이드

### 10.1 로컬 개발 환경 테스트

#### Mock Provider 없이 테스트

1. Keycloak Docker 컨테이너 실행:

```bash
docker run -d --name keycloak \
  -p 8180:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev
```

2. Realm + Client 설정 (127.0.0.1:8180 관리자 콘솔)
3. `.env`에 OIDC 환경 변수 설정
4. Docker 재시작

#### 활성화 확인

```bash
# 로그에서 SSO Provider 등록 확인
docker logs v-channel-bridge-backend 2>&1 | grep sso

# 기대 출력:
# sso_provider_registered provider=microsoft
# sso_providers_initialized count=1 providers=['microsoft']
```

```bash
# API로 활성 Provider 확인
curl http://127.0.0.1:8000/api/auth/sso/providers
```

### 10.2 SSO 로그인 플로우 테스트

1. 브라우저에서 `http://127.0.0.1:5173/login` 접속
2. SSO 버튼이 표시되는지 확인
3. SSO 버튼 클릭 → 팝업 창이 열리는지 확인
4. IdP 로그인 완료 → 팝업이 닫히고 메인 페이지로 이동하는지 확인

### 10.3 Callback URL 설정 확인

IdP에 등록한 Redirect URI가 실제 요청과 정확히 일치해야 합니다.

| 환경 | Callback URL |
|------|-------------|
| 로컬 개발 | `http://127.0.0.1:8000/api/auth/sso/{provider}/callback` |
| 프로덕션 | `https://your-domain.com/api/auth/sso/{provider}/callback` |

:::warning localhost vs 127.0.0.1
WSL 환경에서 `localhost`가 IPv6로 해석되어 문제가 발생할 수 있습니다. 항상 `127.0.0.1`을 사용하세요. IdP의 Redirect URI도 `127.0.0.1`로 등록해야 합니다.
:::

---

## 11. 트러블슈팅

### 11.1 SSO 버튼이 표시되지 않음

**원인**: SSO Provider가 등록되지 않음

```bash
# 확인
curl http://127.0.0.1:8000/api/auth/sso/providers
# {"providers": []}  ← 비어 있음

# 해결: 환경 변수 확인
docker exec v-channel-bridge-backend env | grep -E "TEAMS_|SSO_OIDC_"
```

### 11.2 "Invalid state" 오류

**원인 1**: State 토큰 만료 (10분 초과)
- 해결: SSO 팝업을 다시 열어 재시도

**원인 2**: 서버 재시작으로 `_pending_states` 초기화
- 해결: SSO 팝업을 다시 열어 재시도

**원인 3**: 다중 인스턴스 환경에서 state 불일치
- 해결: `_pending_states`는 인메모리이므로 단일 인스턴스 환경에서만 사용. 다중 인스턴스 시 Redis 기반 state 저장 필요.

### 11.3 Callback에서 "redirect_uri mismatch" 오류

**원인**: IdP에 등록된 Redirect URI와 실제 요청 URL 불일치

```
# IdP 등록: http://127.0.0.1:8000/api/auth/sso/microsoft/callback
# 실제 요청: http://localhost:8000/api/auth/sso/microsoft/callback
# → 불일치!
```

**해결**: IdP와 `FRONTEND_URL` 환경 변수의 호스트명을 정확히 일치시킵니다.

### 11.4 "User email not found in token" 오류

**원인**: IdP 토큰에 이메일 클레임이 없음

**해결 (Generic OIDC)**: `SSO_OIDC_EMAIL_CLAIM` 환경 변수를 IdP의 이메일 클레임 키로 설정

```env
# 기본값: email
# Keycloak에서 다른 클레임을 사용하는 경우:
SSO_OIDC_EMAIL_CLAIM=preferred_username
```

### 11.5 팝업이 닫히지 않음

**원인**: `window.opener`가 `null` (팝업 차단 등)

**해결**:
- 브라우저 팝업 차단 해제
- 동일 출처(same-origin) 확인
- 브라우저 콘솔에서 `postMessage` 오류 확인

---

## 12. 보안 체크리스트

- [ ] State 토큰으로 CSRF 방지 (10분 만료)
- [ ] `postMessage` origin 검증 (`window.location.origin`)
- [ ] Refresh token은 `HttpOnly` 쿠키로 전달
- [ ] Client secret은 환경 변수로만 관리 (코드에 하드코딩 금지)
- [ ] HTTPS 사용 (프로덕션)
- [ ] IdP Redirect URI를 정확한 경로로 제한
- [ ] SSO로 생성된 사용자는 기본 `user` 역할 (권한 상승 방지)
- [ ] 비활성 사용자(`is_active=False`) SSO 로그인 차단
