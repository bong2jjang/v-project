---
sidebar_position: 16
title: 사용자별 Provider 관리
---

# 사용자별 Provider 관리 설계

**작성일**: 2026-04-08
**상태**: 초안

## 개요

현재 VMS Chat Ops의 Provider(Slack/Teams 계정)는 **시스템 레벨에서만** 관리됩니다.
관리자가 Settings > 플랫폼 연동에서 등록하고, 모든 사용자가 해당 Provider를 공유합니다.

이 설계는 **사용자별 Provider 등록 및 OAuth 연동**을 지원하여,
각 사용자가 자신의 플랫폼 계정을 독립적으로 연결하고 개인 채널(DM, 그룹 채팅)을
Route에 활용할 수 있도록 확장합니다.

---

## 1. 현재 구조 분석

### 현재 아키텍처

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin UI   │────▶│  Account (DB)    │────▶│  Provider       │
│  Settings   │     │  - platform      │     │  (SlackProvider  │
│  (admin만)  │     │  - bot_token     │     │   TeamsProvider) │
│             │     │  - app_password  │     │                 │
│             │     │  - ms_refresh_*  │     │  bridge에 1개   │
└─────────────┘     └──────────────────┘     │  등록/플랫폼    │
                                             └─────────────────┘
```

**한계점:**

| 항목 | 현재 | 문제 |
|------|------|------|
| Provider 등록 | 관리자만 | 일반 사용자는 자신의 계정 연결 불가 |
| Teams Delegated Auth | Account에 1개 | 한 사람의 MS 계정만 연결 가능 |
| DM/그룹 채팅 | 연결된 1개 계정 기준 | 다른 사용자의 DM은 접근 불가 |
| Slack User Token | 미지원 | Bot이 볼 수 없는 DM 접근 불가 |
| Provider 당 Bridge | 플랫폼 이름 = 키 | 동일 플랫폼 다중 인스턴스 불가 |

### Teams 특수 상황

Microsoft Graph `/chats` API는 **delegated token 필수**입니다.
현재는 Account 모델에 `ms_refresh_token`이 1개만 저장되어,
시스템 전체에서 **한 명의 MS 계정**으로만 DM/그룹 채팅을 조회합니다.

각 사용자가 자신의 MS 계정을 연결해야 **자기 DM 목록**을 볼 수 있습니다.

---

## 2. 목표 아키텍처

### 핵심 원칙

1. **시스템 Provider 유지** — Bot/App 자격증명은 관리자가 중앙 관리
2. **사용자별 OAuth 연동 추가** — 개인 토큰은 각 사용자가 독립 관리
3. **권한 분리** — 관리자는 모든 연동 조회/관리, 사용자는 자기 것만
4. **점진적 확장** — 기존 구조를 깨지 않고 레이어 추가

### 개념 구조

```
┌──────────────────────────────────────────────────────────┐
│                    System Layer (Admin)                   │
│                                                          │
│  Account (기존)                                          │
│  ├─ Slack Bot Token (xoxb-...)     ← 공유 채널용        │
│  ├─ Teams App ID / Password        ← 팀 채널용          │
│  └─ Team ID                                              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    User Layer (개인)                      │
│                                                          │
│  UserOAuthToken (신규)                                   │
│  ├─ User A ─ MS Account ─ refresh_token  ← A의 DM 접근  │
│  ├─ User B ─ MS Account ─ refresh_token  ← B의 DM 접근  │
│  ├─ User C ─ Slack User Token            ← C의 DM 접근  │
│  └─ ...                                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 데이터베이스 설계

### 신규 테이블: `user_oauth_tokens`

```sql
CREATE TABLE user_oauth_tokens (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform      VARCHAR(50) NOT NULL,           -- "slack" | "teams"

    -- OAuth 토큰
    access_token  TEXT,                            -- 암호화 저장 (단기)
    refresh_token TEXT NOT NULL,                   -- 암호화 저장 (장기)
    token_expires_at TIMESTAMP,                    -- access token 만료

    -- 플랫폼 사용자 정보
    platform_user_id   VARCHAR(255),               -- MS user ID / Slack user ID
    platform_user_name VARCHAR(255),               -- 표시 이름
    platform_email     VARCHAR(255),               -- 플랫폼 이메일

    -- 메타
    scopes        TEXT,                            -- 부여된 OAuth scope (JSON)
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMP,                       -- 마지막 토큰 사용 시각

    -- 제약조건: 사용자별 + Account별 1개 연동
    UNIQUE(user_id, account_id)
);

CREATE INDEX idx_user_oauth_user ON user_oauth_tokens(user_id);
CREATE INDEX idx_user_oauth_account ON user_oauth_tokens(account_id);
CREATE INDEX idx_user_oauth_platform ON user_oauth_tokens(platform);
```

### Account 모델 변경

기존 `ms_refresh_token`, `ms_token_expires_at`, `ms_user_id` 컬럼은
**하위 호환용으로 유지**하되, 신규 연동은 `user_oauth_tokens`에 저장합니다.

```python
# Account 모델에 관계 추가
class Account(Base):
    # ... 기존 필드 유지 ...

    # 신규 관계
    user_tokens = relationship(
        "UserOAuthToken",
        back_populates="account",
        cascade="all, delete-orphan",
    )
```

### 마이그레이션 전략

```
migrations/007_add_user_oauth_tokens.py
├─ user_oauth_tokens 테이블 생성
├─ 기존 Account.ms_refresh_token → user_oauth_tokens 데이터 이전
│  (Account.updated_by 사용자 기준)
└─ Account.ms_* 컬럼은 제거하지 않음 (폴백용)
```

---

## 4. API 설계

### 사용자 OAuth 연동 API

| Endpoint | Method | 권한 | 설명 |
|----------|--------|------|------|
| `/api/users/me/oauth` | GET | 로그인 | 내 OAuth 연동 목록 |
| `/api/users/me/oauth/{account_id}/connect` | GET | 로그인 | OAuth 인증 시작 (리다이렉트) |
| `/api/users/me/oauth/{account_id}/disconnect` | POST | 로그인 | OAuth 연동 해제 |
| `/api/users/me/oauth/{account_id}/status` | GET | 로그인 | 연동 상태 조회 |
| `/api/users/me/channels/{account_id}` | GET | 로그인 | 내 개인 채널 목록 (DM/그룹) |

### 관리자 OAuth 관리 API

| Endpoint | Method | 권한 | 설명 |
|----------|--------|------|------|
| `/api/admin/oauth` | GET | 관리자 | 전체 사용자 OAuth 연동 현황 |
| `/api/admin/oauth/{token_id}` | DELETE | 관리자 | 특정 사용자 연동 강제 해제 |
| `/api/admin/oauth/stats` | GET | 관리자 | 연동 통계 (플랫폼별, 활성/만료) |

### 응답 스키마

```python
class UserOAuthStatusResponse(BaseModel):
    """사용자 OAuth 연동 상태"""
    account_id: int
    platform: str
    account_name: str             # 시스템 Provider 이름
    is_connected: bool
    platform_user_name: str | None
    platform_email: str | None
    token_expires_at: str | None
    last_used_at: str | None

class UserChannelListResponse(BaseModel):
    """사용자 개인 채널 목록"""
    channels: list[ChannelInfo]   # 기존 ChannelInfo 재사용
    source: str                   # "user_token" | "system_token"
```

---

## 5. OAuth Flow 변경

### 현재 Flow (시스템 레벨)

```
Admin → /api/auth/microsoft/login?account_id=3
     → Microsoft 로그인
     → Callback → Account.ms_refresh_token에 저장
```

### 신규 Flow (사용자 레벨)

```
User → /api/users/me/oauth/{account_id}/connect
     → Microsoft 로그인 (동일 App ID 사용)
     → Callback → user_oauth_tokens에 저장 (user_id + account_id)
```

**핵심 차이**: 동일한 Azure App을 사용하되, 토큰 저장 위치가 다릅니다.
시스템 App의 Client ID/Secret으로 OAuth를 수행하지만,
결과 토큰은 **요청한 사용자의 `user_oauth_tokens`** 레코드에 저장됩니다.

### OAuth State 구조 변경

```python
# 현재
_oauth_states[state_token] = {
    "account_id": account_id,
    "user_id": current_user.id,    # 이미 있음
}

# 변경: 저장 대상 구분 플래그 추가
_oauth_states[state_token] = {
    "account_id": account_id,
    "user_id": current_user.id,
    "target": "user",              # "system" | "user"
}
```

### Callback 분기

```python
async def microsoft_callback(code, state, db):
    state_data = _oauth_states.pop(state)

    if state_data["target"] == "user":
        # user_oauth_tokens에 저장
        upsert_user_oauth_token(
            user_id=state_data["user_id"],
            account_id=state_data["account_id"],
            refresh_token=refresh_token,
            ...
        )
    else:
        # 기존: Account.ms_refresh_token에 저장 (관리자 시스템 연동)
        account.ms_refresh_token_decrypted = refresh_token
```

---

## 6. Provider 토큰 해석 우선순위

Teams Provider가 채널 목록이나 메시지를 처리할 때, 어떤 토큰을 사용할지 결정하는 로직:

### 채널 목록 조회 (`get_channels`)

```
1. 팀 채널 → Application Token (기존, 모든 사용자 공통)
2. DM/그룹 채팅:
   a. 요청 사용자의 user_oauth_token이 있으면 → 해당 사용자 토큰
   b. 없으면 → 시스템 delegated token (Account.ms_refresh_token)
   c. 둘 다 없으면 → DM 목록 비어있음 + 연동 안내 메시지
```

### 메시지 전송 (`send_message`)

```
1. 팀 채널 (team_id:channel_id) → Application Token
2. 개인 채팅 (chat:xxx):
   a. Route 생성자의 user_oauth_token → 해당 토큰
   b. 시스템 delegated token (폴백)
```

### API 시그니처 변경

```python
# 현재
async def get_channels(self) -> List[Channel]:

# 변경: user_id를 선택적으로 받아 해당 사용자 토큰 사용
async def get_channels(self, user_id: int | None = None) -> List[Channel]:
```

---

## 7. 프론트엔드 설계

### 사용자 화면: "내 연동" 섹션

Settings 페이지에 모든 사용자가 접근할 수 있는 **"내 연동"** 탭을 추가합니다.

```
Settings
├─ 개요           (모든 사용자)
├─ 테마           (모든 사용자)
├─ 세션           (모든 사용자)
├─ 내 연동 ← NEW (모든 사용자)    ★
├─ 플랫폼 연동    (관리자만)
├─ 보안           (관리자만)
└─ 시스템 설정    (관리자만)
```

### "내 연동" 탭 UI 구성

```
┌─────────────────────────────────────────────────────┐
│  내 플랫폼 연동                                      │
│                                                      │
│  시스템에 등록된 Provider에 개인 계정을 연결하면       │
│  DM 및 그룹 채팅을 Route에 사용할 수 있습니다.        │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  🟦 Teams — VMS Production                   │    │
│  │                                              │    │
│  │  ✅ 연결됨: user@company.com                 │    │
│  │  마지막 사용: 2분 전                          │    │
│  │                                              │    │
│  │  [연결 해제]                                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  🟣 Slack — VMS Workspace                    │    │
│  │                                              │    │
│  │  ⚪ 연결되지 않음                             │    │
│  │  연결하면 Slack DM을 Route에 사용 가능        │    │
│  │                                              │    │
│  │  [계정 연결]                                  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 관리자 화면: OAuth 연동 현황

기존 "플랫폼 연동" 탭에 사용자별 연동 현황 서브섹션 추가:

```
┌─────────────────────────────────────────────────────┐
│  사용자 OAuth 연동 현황                               │
│                                                      │
│  Provider: Teams — VMS Production                    │
│  ┌──────────────┬───────────┬───────────┬────────┐  │
│  │ 사용자       │ MS 계정   │ 상태      │ 관리   │  │
│  ├──────────────┼───────────┼───────────┼────────┤  │
│  │ admin@...    │ a@co.com  │ ✅ 활성   │ [해제] │  │
│  │ user1@...    │ b@co.com  │ ✅ 활성   │ [해제] │  │
│  │ user2@...    │ —         │ ⚪ 미연결 │   —    │  │
│  └──────────────┴───────────┴───────────┴────────┘  │
└─────────────────────────────────────────────────────┘
```

### 채널 목록 개선

Route 생성 시 ChannelSelector가 **사용자 토큰 기반 개인 채널**도 표시:

```
┌────────────────────────────────┐
│ 채널 선택                 ▼    │
├────────────────────────────────┤
│ ── 채널 ──                     │
│ # General                      │
│ # Development                  │
│ ── 다이렉트 메시지 (내 계정) ──│  ★ 사용자 토큰 기반
│ 💬 홍길동                      │
│ 💬 김철수                      │
│ ── 그룹 채팅 (내 계정) ──     │
│ 👥 프로젝트 팀                 │
└────────────────────────────────┘
```

### 신규 컴포넌트

```
frontend/src/
├─ components/
│  └─ oauth/                        ← NEW
│     ├─ UserOAuthCard.tsx           # 개별 연동 카드
│     ├─ UserOAuthList.tsx           # 연동 목록
│     └─ AdminOAuthOverview.tsx      # 관리자 연동 현황
├─ lib/api/
│  └─ user-oauth.ts                 ← NEW: API 클라이언트
└─ store/
   └─ user-oauth.ts                 ← NEW: Zustand 스토어
```

---

## 8. 보안 고려사항

### 토큰 보호

| 항목 | 방법 |
|------|------|
| refresh_token 저장 | 기존 `encrypt()`/`decrypt()` 유틸 사용 (AES) |
| access_token 노출 | API 응답에 포함 안 함, 서버 메모리 캐시만 |
| 타 사용자 토큰 접근 | API에서 `user_id == current_user.id` 필터 강제 |
| 관리자 접근 | admin 역할만 전체 조회/강제 해제 가능 |
| 토큰 만료 | refresh_token 실패 시 자동 `is_active=False` 처리 |

### OAuth Scope 최소화

```
Teams: Chat.Read Chat.ReadWrite User.Read offline_access
Slack: channels:read groups:read im:read mpim:read users:read
```

- 메시지 전송 scope는 시스템 Bot Token으로 처리 (사용자 토큰 불필요)
- 사용자 토큰은 **채널 목록 조회**에만 사용

### 세션 격리

- 사용자가 로그아웃하면 OAuth 토큰은 유지 (다시 로그인 시 재활용)
- 사용자가 "연결 해제"하면 토큰 완전 삭제
- 관리자가 사용자 비활성화 시 해당 사용자의 모든 OAuth 토큰 비활성화

---

## 9. Route 연동

### Route와 사용자 토큰 연결

개인 채널(DM/그룹)을 소스 또는 타겟으로 하는 Route는
**생성한 사용자의 OAuth 토큰**에 의존합니다.

```python
# Route 메타데이터에 owner 추가 (Redis)
route:teams:chat:xxxxx:owner → user_id
```

### Route 유효성

| 상황 | 동작 |
|------|------|
| 사용자 토큰 만료 | Route 비활성, 재연동 알림 |
| 사용자 연동 해제 | 해당 개인 채널 Route 자동 비활성 |
| 관리자 강제 해제 | 동일 |
| 팀 채널 Route | 시스템 토큰 사용 → 영향 없음 |

---

## 10. 구현 단계

### Phase 1: DB + API 기반 (MVP)

- [ ] `user_oauth_tokens` 테이블 + 마이그레이션
- [ ] `UserOAuthToken` SQLAlchemy 모델
- [ ] OAuth callback 분기 (시스템 vs 사용자)
- [ ] 사용자 OAuth CRUD API (`/api/users/me/oauth/*`)
- [ ] Teams Provider에 `user_id` 기반 토큰 해석

### Phase 2: 프론트엔드 UI

- [ ] "내 연동" 탭 + UserOAuthList/Card 컴포넌트
- [ ] ChannelSelector에 사용자 개인 채널 병합
- [ ] 관리자 OAuth 현황 테이블

### Phase 3: Route 확장

- [ ] Route에 owner 메타데이터 추가
- [ ] 사용자 토큰 만료 시 Route 비활성 + 알림
- [ ] Slack User Token OAuth 지원

### Phase 4: 운영 안정화

- [ ] 토큰 자동 갱신 헬스체크 (백그라운드 태스크)
- [ ] 관리자 대시보드: 연동 통계, 만료 임박 알림
- [ ] 감사 로그: OAuth 연동/해제 이벤트 기록

---

## 11. 영향 범위

### 변경 파일 (예상)

**Backend:**
- `models/user_oauth_token.py` — 신규 모델
- `migrations/007_add_user_oauth_tokens.py` — 마이그레이션
- `api/user_oauth.py` — 신규 API 라우터
- `api/auth_microsoft.py` — OAuth callback 분기 추가
- `adapters/teams_provider.py` — `get_channels(user_id)`, 토큰 해석
- `adapters/slack_provider.py` — User Token 지원 (Phase 3)
- `services/route_manager.py` — owner 메타데이터
- `services/websocket_bridge.py` — 토큰 선택 로직

**Frontend:**
- `components/oauth/` — 신규 컴포넌트 디렉토리
- `lib/api/user-oauth.ts` — API 클라이언트
- `store/user-oauth.ts` — Zustand 스토어
- `pages/Settings.tsx` — "내 연동" 탭 추가
- `components/channels/ChannelSelector.tsx` — 개인 채널 병합

---

## 참고

- 기존 설계: [Teams Delegated Auth](./TEAMS_DELEGATED_AUTH.md)
- Microsoft Graph `/chats` API: delegated permission 필수
- Slack OAuth: `users.conversations` + user token으로 DM 확장 가능
