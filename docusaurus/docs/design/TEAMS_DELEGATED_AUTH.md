# Teams Delegated Auth 설계 (OAuth2 Authorization Code Flow)

## 1. 배경 및 동기

### 문제

Microsoft Graph API의 `/chats` 엔드포인트는 **application-only(client_credentials) 토큰을 지원하지 않습니다.**
현재 VMS Chat Ops의 Teams Provider는 client_credentials 방식만 사용하므로,
DM/그룹 채팅 목록 조회가 불가능합니다 (HTTP 400: `Requested API is not supported in application-only context`).

### 해결 방향

관리자가 Microsoft 계정으로 1회 로그인(OAuth2 Authorization Code Flow) →
delegated access token + refresh token 획득 → DB에 암호화 저장 →
이후 자동 갱신하여 `/chats` 등 delegated-only API 호출에 사용.

---

## 2. OAuth2 Authorization Code Flow 흐름

```
┌──────────────┐     ① /api/auth/microsoft/login?account_id=3
│  Frontend    │────────────────────────────────────────────────►┐
│  (Browser)   │                                                 │
│              │◄───── ② Redirect to Microsoft login ────────────┘
│              │
│              │     ③ User authenticates at Microsoft
│              │────────────────────────────────────►  Microsoft
│              │◄───── ④ Redirect to callback with code ─────┐  Identity
│              │                                              │  Platform
│              │     ⑤ /api/auth/microsoft/callback?code=...  │
│              │────────────────────────────────────────────►┐│
│              │                                             ││
│   Backend    │◄──── ⑥ Exchange code for tokens ────────────┘│
│              │                                               │
│              │     ⑦ Save refresh_token to Account DB        │
│              │     ⑧ Close popup / redirect to settings      │
└──────────────┘
```

### 토큰 수명

| 토큰 | 수명 | 갱신 방법 |
|------|------|-----------|
| Access Token | ~1시간 | refresh_token으로 자동 갱신 |
| Refresh Token | 최대 90일 (활동 시 무기한) | 사용할 때마다 갱신됨 |

---

## 3. Azure App Registration 추가 설정

기존 App Registration에 다음을 추가합니다:

### Redirect URI

```
https://{domain}/api/auth/microsoft/callback
http://localhost:8000/api/auth/microsoft/callback  (개발용)
```

Platform: **Web**

### API Permissions (Delegated)

| 권한 | 타입 | 용도 |
|------|------|------|
| `Chat.Read` | Delegated | 1:1/그룹 채팅 목록 조회 |
| `Chat.ReadWrite` | Delegated | 채팅 메시지 전송 (향후) |
| `User.Read` | Delegated | 로그인 사용자 확인 |

> **참고**: 기존 Application 권한(`ChannelMessage.Send` 등)은 그대로 유지.
> Delegated 권한은 **추가**하는 것.

### Admin Consent

`Chat.Read`는 admin consent 필요. Azure Portal에서 "Grant admin consent" 클릭.

---

## 4. DB 스키마 변경

### accounts 테이블 추가 컬럼

```sql
ALTER TABLE accounts ADD COLUMN ms_refresh_token TEXT;         -- 암호화된 refresh token
ALTER TABLE accounts ADD COLUMN ms_token_expires_at TIMESTAMP; -- delegated access token 만료 시간
ALTER TABLE accounts ADD COLUMN ms_user_id VARCHAR(255);       -- 연결된 Microsoft 사용자 ID
```

- `ms_refresh_token`: 암호화 저장 (기존 encrypt/decrypt 유틸 사용)
- `ms_token_expires_at`: access token 만료 시점. 만료 전 자동 갱신.
- `ms_user_id`: 어떤 Microsoft 계정으로 연결했는지 표시용.

---

## 5. 백엔드 API 설계

### 5.1 `GET /api/auth/microsoft/login`

**Query params**: `account_id` (Teams Account ID)

**동작**:
1. Account 조회 → platform이 msteams인지 확인
2. `state` 파라미터에 `account_id` + CSRF 토큰 포함 (암호화)
3. Microsoft OAuth2 authorize URL 생성 → redirect

**Authorize URL 구성**:
```
https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize
  ?client_id={app_id}
  &response_type=code
  &redirect_uri={callback_url}
  &scope=Chat.Read Chat.ReadWrite User.Read offline_access
  &state={encrypted_state}
  &prompt=consent
```

> `offline_access` 스코프는 refresh_token 발급에 필수.

### 5.2 `GET /api/auth/microsoft/callback`

**Query params**: `code`, `state`, `error` (선택)

**동작**:
1. `state` 복호화 → account_id, CSRF 토큰 검증
2. `code`를 access_token + refresh_token으로 교환:
   ```
   POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code={code}
   &redirect_uri={callback_url}
   &client_id={app_id}
   &client_secret={app_password}
   &scope=Chat.Read Chat.ReadWrite User.Read offline_access
   ```
3. refresh_token → Account DB에 암호화 저장
4. access_token의 만료 시간 저장
5. `/me` 호출 → `ms_user_id` 저장
6. 프론트엔드로 redirect (팝업 닫기 또는 설정 페이지)

### 5.3 `POST /api/auth/microsoft/{account_id}/disconnect`

Delegated auth 연결 해제. `ms_refresh_token`, `ms_token_expires_at`, `ms_user_id`를 NULL로.

### 5.4 내부: `get_delegated_token(account_id)` 유틸

Teams Provider 내부에서 호출. refresh_token으로 새 access_token 발급:

```python
async def get_delegated_token(account: Account) -> Optional[str]:
    """Delegated access token 반환 (필요 시 자동 갱신)"""
    if not account.ms_refresh_token_decrypted:
        return None

    # 만료 5분 전이면 갱신
    if account.ms_token_expires_at and account.ms_token_expires_at > now + 5min:
        return cached_access_token

    # Token refresh
    response = POST token_endpoint {
        grant_type: "refresh_token",
        refresh_token: account.ms_refresh_token_decrypted,
        client_id, client_secret, scope
    }

    # 새 refresh_token 저장 (rotation)
    account.ms_refresh_token_decrypted = response.refresh_token
    account.ms_token_expires_at = now + response.expires_in
    db.commit()

    return response.access_token
```

---

## 6. Teams Provider 변경

### get_channels() 수정

```python
async def get_channels(self) -> List[Channel]:
    channels = []

    # 1. 기존: app-only token으로 Team 채널 조회 (변경 없음)
    channels.extend(await self._get_team_channels())

    # 2. 신규: delegated token으로 채팅 목록 조회
    delegated_token = await get_delegated_token(self._account)
    if delegated_token:
        channels.extend(await self._get_chats(delegated_token))
    else:
        logger.info("Delegated auth not configured — chat list unavailable")

    return channels
```

### Feature Checker 변경

`list_conversations`의 Teams 설정:
- `ms_refresh_token`이 있으면 → delegated token으로 `/chats` probe
- 없으면 → `not_applicable` + "Microsoft 계정 연결 필요" 안내

---

## 7. 프론트엔드 변경

### ProviderModal (Teams)

기존 필드 아래에 **Microsoft 계정 연결** 섹션 추가:

```
┌─────────────────────────────────────────┐
│ ⚙️ DM/그룹 채팅 접근 (선택)              │
│                                         │
│ Graph /chats API는 사용자 인증이 필요    │
│ 합니다. Microsoft 계정을 연결하면 DM     │
│ 및 그룹 채팅 라우팅이 가능합니다.        │
│                                         │
│ [🔗 Microsoft 계정 연결]                │
│                                         │
│ ✅ user@contoso.com 연결됨              │
│    [연결 해제]                           │
└─────────────────────────────────────────┘
```

**연결 버튼 동작**:
1. 새 팝업 윈도우로 `/api/auth/microsoft/login?account_id={id}` 열기
2. Microsoft 로그인 완료 → callback → 팝업 자동 닫힘
3. 부모 창에서 Provider 정보 새로고침 → 연결 상태 표시

### ProviderCard

`ms_user_id`가 있으면 "Microsoft 연결됨" 배지 표시.

### AccountResponse 스키마

`ms_user_id`와 `has_delegated_auth` (bool) 필드 추가.

---

## 8. 보안 고려사항

1. **State 파라미터**: account_id + 랜덤 nonce를 암호화 → CSRF 방지
2. **Refresh Token 암호화**: 기존 encrypt/decrypt 유틸 사용 (AES-256)
3. **Scope 최소화**: `Chat.Read`, `User.Read`, `offline_access`만 요청
4. **Callback URL 검증**: 환경변수로 설정된 URL만 허용
5. **Token Rotation**: Microsoft는 refresh 시 새 refresh_token 발급 → 반드시 업데이트

---

## 9. 환경변수 추가

```bash
# 기존 TEAMS_APP_ID, TEAMS_APP_PASSWORD 활용 (추가 없음)
# Redirect URI는 FRONTEND_URL 기반으로 자동 생성
MS_OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/microsoft/callback  # 개발용 오버라이드 (선택)
```

---

## 10. 구현 순서

1. **DB 마이그레이션**: `ms_refresh_token`, `ms_token_expires_at`, `ms_user_id` 컬럼 추가
2. **Account 모델**: 암호화 property 추가
3. **OAuth2 API**: `auth_microsoft.py` — login, callback, disconnect 엔드포인트
4. **Token 갱신 유틸**: `get_delegated_token()` 함수
5. **Teams Provider**: `get_channels()`에 delegated token 분기 추가
6. **Feature Catalog/Checker**: delegated auth 상태에 따른 동적 표시
7. **프론트엔드**: ProviderModal 연결 버튼, ProviderCard 상태 표시
8. **Docker 재빌드 및 검증**

---

## 11. 제한사항 및 향후 작업

- **단일 사용자 컨텍스트**: 연결한 관리자의 채팅만 조회 가능 (다른 사용자의 채팅은 불가)
- **Refresh Token 만료**: 90일간 미사용 시 만료 → 재로그인 필요 (UI에서 안내)
- **향후**: 채팅 메시지 전송(`Chat.ReadWrite`), 멀티 사용자 지원 검토
