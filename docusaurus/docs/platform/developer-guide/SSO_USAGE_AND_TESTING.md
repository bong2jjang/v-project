# SSO (Single Sign-On) 사용법 및 테스트 가이드

> **작성일**: 2026-04-10  
> **설계 문서**: [HYBRID_SSO_LOGIN_PLAN.md](/docs/design/HYBRID_SSO_LOGIN_PLAN)  
> **관련 코드**: `backend/app/sso/`, `backend/app/api/auth_sso.py`, `frontend/src/pages/SSOCallback.tsx`

---

## 1. 개요

VMS Chat Ops는 기존 ID/PW 로그인과 **SSO 로그인을 병행**하는 하이브리드 인증을 지원합니다.

| 인증 방식 | 설명 |
|-----------|------|
| **Local** | 기존 이메일 + 비밀번호 로그인 |
| **Microsoft SSO** | Azure AD(Microsoft Entra ID) OpenID Connect |
| **Generic OIDC** | 범용 OIDC (Keycloak, Okta, ADFS 등 — 온프레미스 대응) |

**핵심 원리**: SSO는 "이 사람이 누구인지(Authentication)"만 확인하고, 내부 JWT 토큰을 발급합니다. 인가(Authorization)는 기존 RBAC 시스템이 그대로 담당합니다.

---

## 2. 인증 흐름 요약

```
사용자 → [MS SSO 로그인 버튼 클릭]
  → Backend: GET /api/auth/sso/microsoft/login
    → Microsoft 인증 페이지로 리다이렉트 (state 토큰 포함)
      → 사용자가 MS 계정으로 인증
        → Microsoft → Backend: GET /api/auth/sso/microsoft/callback?code=xxx&state=yyy
          → Backend: code로 Access Token 교환 → MS Graph API /me 호출 → 이메일 확보
            → 이메일로 내부 User 조회 (없으면 자동 생성)
              → 내부 JWT 발급 → Frontend /sso/callback?token=xxx 으로 리다이렉트
                → Frontend: 토큰 저장 → 대시보드 이동
```

---

## 3. 적용 방법 (Microsoft SSO)

### 3.1 사전 준비: Azure App Registration

Azure Portal에서 앱을 등록해야 합니다.

#### Step 1: Azure Portal → App Registration

1. [Azure Portal](https://portal.azure.com) 로그인
2. **Microsoft Entra ID** (구 Azure Active Directory) → **App registrations** → **New registration**
3. 앱 정보 입력:

| 항목 | 값 |
|------|------|
| Name | `VMS Chat Ops SSO` |
| Supported account types | **Single tenant** (이 조직만) 또는 **Multitenant** (선택) |
| Redirect URI (Web) | `http://localhost:8000/api/auth/sso/microsoft/callback` |

4. **Register** 클릭

#### Step 2: Client Secret 생성

1. 등록된 앱 → **Certificates & secrets** → **New client secret**
2. Description: `VMS Chat Ops SSO Secret`
3. Expires: 적절한 만료 기간 선택 (권장: 24 months)
4. **Add** → 생성된 **Value**를 즉시 복사 (나중에 다시 볼 수 없음)

#### Step 3: 필요한 값 확인

앱 **Overview** 페이지에서:

| 필요한 값 | 위치 |
|-----------|------|
| `SSO_MICROSOFT_TENANT_ID` | Directory (tenant) ID |
| `SSO_MICROSOFT_CLIENT_ID` | Application (client) ID |
| `SSO_MICROSOFT_CLIENT_SECRET` | Step 2에서 복사한 Secret Value |

#### Step 4: API 권한 확인

앱 → **API permissions** 에서 다음 권한이 있는지 확인:

| 권한 | 타입 | 용도 |
|------|------|------|
| `openid` | Delegated | OpenID Connect 기본 |
| `email` | Delegated | 이메일 주소 조회 |
| `profile` | Delegated | 사용자 이름 조회 |
| `User.Read` | Delegated | MS Graph /me 호출 |

> 보통 기본 등록 시 `User.Read`와 `openid`, `profile`은 자동 추가됩니다. 없으면 **Add a permission** → **Microsoft Graph** → **Delegated permissions** 에서 추가하세요.

### 3.2 환경 변수 설정

`.env` 파일에 다음 변수를 추가합니다:

```bash
# ─── SSO: Microsoft Entra ID ─────────────────────
SSO_MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SSO_MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SSO_MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.3 docker-compose.yml에 환경 변수 전달

`docker-compose.yml`의 backend 서비스 environment 섹션에 추가:

```yaml
backend:
  environment:
    # ... 기존 변수들 ...
    - SSO_MICROSOFT_TENANT_ID=${SSO_MICROSOFT_TENANT_ID}
    - SSO_MICROSOFT_CLIENT_ID=${SSO_MICROSOFT_CLIENT_ID}
    - SSO_MICROSOFT_CLIENT_SECRET=${SSO_MICROSOFT_CLIENT_SECRET}
```

### 3.4 재배포

```bash
docker compose up -d --build
```

백엔드 로그에서 SSO 초기화 확인:

```bash
docker logs vms-chatops-backend 2>&1 | grep sso
```

정상이면 다음과 같은 로그가 출력됩니다:

```
sso_provider_registered    provider=microsoft
sso_providers_initialized  count=1 providers=['microsoft']
```

### 3.5 Redirect URI 주의사항

| 환경 | Redirect URI |
|------|-------------|
| 로컬 개발 | `http://localhost:8000/api/auth/sso/microsoft/callback` |
| 스테이징 | `https://staging.example.com/api/auth/sso/microsoft/callback` |
| 프로덕션 | `https://chatops.example.com/api/auth/sso/microsoft/callback` |

Azure App Registration의 Redirect URI에 **사용하는 환경의 URI를 모두 등록**해야 합니다.

> **중요**: `http://`는 `localhost`에서만 허용됩니다. 외부 도메인은 반드시 `https://`가 필요합니다.

---

## 4. 적용 방법 (Generic OIDC — 온프레미스)

Keycloak, Okta, ADFS 등 표준 OIDC를 지원하는 IdP에 대응합니다.

### 4.1 IdP에 클라이언트 등록

IdP 관리 콘솔에서:

1. 새 Client(Application) 생성
2. Client ID / Client Secret 발급
3. Redirect URI 등록: `http://localhost:8000/api/auth/sso/{provider_name}/callback`

### 4.2 환경 변수 설정

```bash
# ─── SSO: Generic OIDC (예: Keycloak) ────────────
SSO_OIDC_ISSUER_URL=https://keycloak.example.com/realms/main
SSO_OIDC_CLIENT_ID=vms-chatops
SSO_OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxx

# 선택 사항 (기본값 있음)
SSO_OIDC_PROVIDER_NAME=corporate_sso          # URL 경로에 사용
SSO_OIDC_DISPLAY_NAME=회사 통합인증             # 로그인 버튼 텍스트
SSO_OIDC_ICON=building                         # 아이콘: microsoft|key|building|shield
SSO_OIDC_SCOPES=openid email profile           # OIDC Scopes
SSO_OIDC_EMAIL_CLAIM=email                     # 이메일 클레임 키
SSO_OIDC_NAME_CLAIM=preferred_username         # 표시 이름 클레임 키
SSO_OIDC_SUB_CLAIM=sub                         # 고유 ID 클레임 키
```

> **OIDC Discovery**: `SSO_OIDC_ISSUER_URL/.well-known/openid-configuration` 에서 authorization_endpoint, token_endpoint, userinfo_endpoint를 자동으로 조회합니다. 별도 설정 불필요.

---

## 5. 테스트 시나리오

### 5.1 사전 확인: SSO Provider 등록 상태

```bash
# Provider 목록 API 호출
curl http://localhost:8000/api/auth/sso/providers
```

**기대 응답** (Microsoft SSO 설정 시):

```json
[
  {
    "name": "microsoft",
    "display_name": "Microsoft 365",
    "icon": "microsoft"
  }
]
```

**SSO 미설정 시**: `[]` (빈 배열)

---

### 5.2 시나리오 1: SSO 로그인 (신규 사용자)

> 기존에 VMS Chat Ops 계정이 없는 사용자가 SSO로 최초 로그인

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | http://localhost:5173/login 접속 | ID/PW 폼 아래 "Microsoft 365(으)로 로그인" 버튼 표시 |
| 2 | SSO 버튼 클릭 | Microsoft 로그인 페이지로 리다이렉트 |
| 3 | MS 계정으로 인증 | 동의 화면 표시 (최초 1회) |
| 4 | 동의 후 | `http://localhost:5173/sso/callback?token=...` 으로 리다이렉트 |
| 5 | 자동 처리 | "로그인 처리 중..." 표시 후 대시보드로 이동 |

**확인 포인트**:
- DB에 새 User 생성됨 (`auth_method='sso'`, `sso_provider='microsoft'`)
- 감사 로그에 "SSO login via microsoft" 기록
- 해당 사용자는 ID/PW 로그인 불가 (비밀번호 미설정)

```sql
-- DB 확인
SELECT email, username, auth_method, sso_provider, sso_provider_id
FROM users WHERE sso_provider IS NOT NULL;
```

---

### 5.3 시나리오 2: SSO 로그인 (기존 Local 사용자)

> 기존 ID/PW 계정이 있는 사용자가 SSO로 로그인

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 기존 계정 (예: `user@company.com`)이 이미 존재 | `auth_method='local'` |
| 2 | SSO 로그인 실행 (같은 이메일) | 기존 계정에 SSO 정보 연동 |
| 3 | 로그인 완료 후 DB 확인 | `auth_method='hybrid'` 로 변경됨 |

**확인 포인트**:
- 새 계정이 생성되지 않음 (기존 계정 재사용)
- `auth_method`이 `local` → `hybrid`로 변경
- 이후 ID/PW 로그인과 SSO 로그인 **모두 가능**

---

### 5.4 시나리오 3: SSO 전용 사용자의 비밀번호 로그인 차단

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | SSO로 자동 생성된 사용자 이메일 확인 | `auth_method='sso'` |
| 2 | 로그인 폼에서 해당 이메일 + 아무 비밀번호 입력 | `403 Forbidden` 응답 |
| 3 | 에러 메시지 확인 | "This account uses SSO login only..." |

```bash
# API로 직접 테스트
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sso-user@company.com", "password": "anything"}'

# 기대: 403 응답
```

---

### 5.5 시나리오 4: 비활성 사용자의 SSO 로그인 차단

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 관리자가 사용자를 비활성화 (`is_active=False`) | — |
| 2 | 해당 사용자가 SSO 로그인 시도 | 로그인 페이지로 리다이렉트 |
| 3 | URL 확인 | `?error=account_disabled` 파라미터 포함 |
| 4 | 화면 | "계정이 비활성화되었습니다. 관리자에게 문의하세요." 표시 |

---

### 5.6 시나리오 5: SSO Provider 장애 시 Fallback

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | SSO 버튼 클릭 → Microsoft 인증 실패 (네트워크 오류 등) | `?error=sso_failed` 파라미터 |
| 2 | 화면 | "SSO 인증에 실패했습니다. 다시 시도해주세요." 표시 |
| 3 | 3초 후 자동으로 로그인 페이지 이동 | — |
| 4 | `auth_method='hybrid'` 사용자는 ID/PW로 로그인 가능 | 정상 로그인 |

---

### 5.7 시나리오 6: SSO 미설정 시 로그인 페이지

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | `.env`에 `SSO_MICROSOFT_*` 변수 없음 | — |
| 2 | http://localhost:5173/login 접속 | SSO 버튼이 **표시되지 않음** |
| 3 | 기존 ID/PW 로그인만 사용 가능 | — |

> SSO 환경 변수가 없으면 Provider가 등록되지 않고, `/api/auth/sso/providers`가 빈 배열을 반환하여 버튼이 자동으로 숨겨집니다.

---

### 5.8 시나리오 7: State CSRF 보호 검증

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | callback URL을 직접 조작하여 잘못된 state 전달 | `400 Bad Request` |
| 2 | 10분 이상 된 state로 callback 호출 | `400 State expired` |

```bash
# 잘못된 state로 직접 호출 테스트
curl "http://localhost:8000/api/auth/sso/microsoft/callback?code=fake&state=invalid"
# 기대: 400 "Invalid or expired state"
```

---

## 6. 사용자 계정 유형 요약

| `auth_method` | 생성 경로 | ID/PW 로그인 | SSO 로그인 |
|---------------|----------|-------------|-----------|
| `local` | 회원가입 (ID/PW) | O | X (SSO 미연동) |
| `sso` | SSO 최초 로그인 (자동 생성) | **X** (차단) | O |
| `hybrid` | Local 사용자가 SSO 로그인 | O | O |

---

## 7. 관리자 운영 가이드

### 7.1 SSO 사용자 현황 확인

```sql
-- SSO 연동 현황
SELECT
  email,
  username,
  auth_method,
  sso_provider,
  last_login
FROM users
WHERE sso_provider IS NOT NULL
ORDER BY last_login DESC;
```

### 7.2 사용자 인증 방식 강제 변경

```sql
-- SSO 전용 → 하이브리드로 전환 (비밀번호 설정이 필요한 경우)
UPDATE users SET auth_method = 'hybrid' WHERE email = 'user@company.com';

-- SSO 연동 해제 (로컬로 복귀)
UPDATE users
SET auth_method = 'local', sso_provider = NULL, sso_provider_id = NULL
WHERE email = 'user@company.com';
```

### 7.3 Redirect URI 변경 시

도메인이 변경되면:
1. Azure App Registration → **Authentication** → Redirect URI 수정
2. 재배포 (Backend가 `request.base_url`을 기준으로 redirect_uri를 자동 생성하므로 코드 변경 불필요)

---

## 8. 트러블슈팅

### Q: 로그인 버튼이 안 보여요

1. `.env`에 `SSO_MICROSOFT_*` 3개 변수가 모두 설정되었는지 확인
2. Docker 재빌드: `docker compose up -d --build`
3. Backend 로그 확인: `docker logs vms-chatops-backend 2>&1 | grep sso`
4. API 직접 호출: `curl http://localhost:8000/api/auth/sso/providers`

### Q: "Invalid or expired state" 에러

- SSO 인증 시작 후 10분이 지나면 state가 만료됩니다
- 다시 SSO 버튼을 클릭하여 인증을 재시작하세요
- Backend가 재시작되면 in-memory state가 초기화됩니다 (프로덕션에서는 Redis 사용 권장)

### Q: Microsoft 동의 화면에서 "Need admin approval" 에러

- Azure AD 관리자가 앱에 대한 **Admin consent**를 승인해야 합니다
- Azure Portal → App Registration → API permissions → **Grant admin consent**

### Q: SSO로 로그인했는데 권한이 없어요

- SSO 최초 로그인 시 `role=user` (일반 사용자)로 생성됩니다
- 관리자가 사용자 관리 페이지에서 역할을 변경해야 합니다
- SSO는 인증만 담당하고, 권한(RBAC)은 내부 시스템이 관리합니다

### Q: `redirect_uri` 불일치 에러 (AADSTS50011)

- Azure App Registration에 등록된 Redirect URI와 실제 Backend URL이 정확히 일치해야 합니다
- 슬래시(`/`) 유무, `http`/`https` 차이, 포트 번호 확인
- 예시: `http://localhost:8000/api/auth/sso/microsoft/callback` (정확한 형식)

### Q: 온프레미스 OIDC에서 이메일이 안 넘어와요

- IdP의 클레임 매핑을 확인하세요
- `SSO_OIDC_EMAIL_CLAIM` 환경 변수로 클레임 키를 변경할 수 있습니다
- Keycloak: `email`, Okta: `email`, ADFS: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`

---

## 9. 보안 체크리스트

| 항목 | 상태 | 설명 |
|------|------|------|
| State CSRF 보호 | ✅ | `secrets.token_urlsafe(32)`, 10분 만료 |
| SSO 경로 CSRF 예외 | ✅ | `/api/auth/sso` 경로 CSRF 미들웨어 제외 |
| Token URL 노출 최소화 | ✅ | SSOCallback에서 즉시 소비 후 URL 파라미터 제거 |
| Refresh Token HttpOnly | ✅ | 쿠키로 설정, JavaScript 접근 차단 |
| SSO 전용 계정 PW 차단 | ✅ | `auth_method='sso'`일 때 비밀번호 로그인 거부 |
| 비활성 계정 차단 | ✅ | `is_active=False` 계정 SSO 로그인 차단 |
| 감사 로그 | ✅ | SSO 로그인 이벤트 audit_log 기록 |
| PKCE | ⬜ | 향후 적용 예정 (Phase 3) |
| State Redis 이전 | ⬜ | 프로덕션 다중 인스턴스 대응 (Phase 3) |

---

## 10. 환경별 빠른 설정 요약

### 개발 환경 (로컬 Docker)

```bash
# .env에 추가
SSO_MICROSOFT_TENANT_ID=your-tenant-id
SSO_MICROSOFT_CLIENT_ID=your-client-id
SSO_MICROSOFT_CLIENT_SECRET=your-client-secret

# docker-compose.yml backend environment에 추가
# 재빌드
docker compose up -d --build
```

Azure Redirect URI: `http://localhost:8000/api/auth/sso/microsoft/callback`

### 프로덕션 환경

```bash
# .env
SSO_MICROSOFT_TENANT_ID=prod-tenant-id
SSO_MICROSOFT_CLIENT_ID=prod-client-id
SSO_MICROSOFT_CLIENT_SECRET=prod-client-secret
ENVIRONMENT=production    # 쿠키 Secure 플래그 활성화
FRONTEND_URL=https://chatops.company.com
```

Azure Redirect URI: `https://chatops.company.com/api/auth/sso/microsoft/callback`
