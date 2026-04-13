---
sidebar_position: 10
title: 플랫폼 연동 기능 권한 관리 설계
---

# 플랫폼 연동 기능 권한 관리 설계

**작성일**: 2026-04-05
**상태**: 설계 중
**담당**: VMS Channel Bridge 팀

---

## 1. 배경 및 목적

### 현재 문제점

현재 플랫폼 연동(계정 관리) UI는 다음 한계를 가집니다:

1. **연결 여부만 확인**: 연결 테스트가 단순히 "연결됨/안됨"만 반환
2. **기능 선택 불가**: 어떤 기능을 사용할지 설정할 수 없음
3. **권한 정보 부재**: 봇이 실제로 어떤 API 권한을 가지고 있는지 표시되지 않음
4. **불일치 가능성**: 사용자가 파일 전송을 기대하지만 봇에 `files:write` 권한이 없어 실패하는 상황

### 개선 목표

```
[현재]                          [목표]
연결 테스트 → 성공/실패          연결 테스트 → 기능별 권한 상태 매트릭스
                                        ↓
계정 설정 → 토큰/자격증명만       계정 설정 → 사용할 기능 직접 선택
                                        ↓
Route 설정 → 플랫폼 선택만        Route 설정 → 선택된 기능 기반 안내
```

---

## 2. 핵심 개념 정의

### 2.1 Feature (기능)

우리 서비스가 제공하는 단위 기능. 각 기능은 특정 플랫폼 API 권한(Scope/Permission)에 의존합니다.

```
Feature = {
  id: string,                    // "send_message"
  name: string,                  // "메시지 전송"
  description: string,           // 사용자 설명
  category: FeatureCategory,     // "messaging" | "file" | "social" | "channel"
  is_core: boolean,              // 필수 기능 여부 (비활성화 불가)
  required_scopes: {             // 플랫폼별 필요 권한
    slack?: string[],
    teams?: string[],
  },
  currently_implemented: {       // 현재 코드에서 구현 여부
    slack: boolean,
    teams: boolean,
  },
}
```

### 2.2 PermissionStatus (권한 상태)

연결 테스트 시 각 Feature에 대해 반환하는 상태:

```
"granted"   → 봇이 해당 권한을 가지고 있음
"missing"   → 봇에 필요한 권한이 없음
"partial"   → 일부 권한만 있음 (기능이 제한적으로 동작)
"unknown"   → 확인 불가 (API로 검증 불가능한 경우)
"not_applicable" → 해당 플랫폼에서 지원 불가
```

### 2.3 Feature Catalog (전체 기능 목록)

| Feature ID | 이름 | 카테고리 | 필수 |
|---|---|---|---|
| `send_message` | 메시지 전송 | messaging | ✅ 필수 |
| `receive_message` | 메시지 수신 | messaging | ✅ 필수 |
| `send_file` | 파일 전송 | file | 선택 |
| `receive_file` | 파일 수신 | file | 선택 |
| `forward_reaction` | 리액션 전달 | social | 선택 |
| `forward_edit` | 편집 알림 전달 | messaging | 선택 |
| `forward_delete` | 삭제 알림 전달 | messaging | 선택 |
| `thread_reply` | 스레드/댓글 | messaging | 선택 |
| `list_channels` | 채널 목록 조회 | channel | 선택 |
| `user_display_name` | 발신자 이름 표시 | messaging | 선택 |

---

## 3. 플랫폼별 권한 매핑

### 3.1 Slack 권한 매핑

| Feature | 필요 Scope | API 검증 방법 |
|---|---|---|
| `send_message` | `chat:write` | `auth.test` + token 형식 확인 |
| `receive_message` | `channels:history` 또는 `groups:history` | `conversations.history` 호출 시도 |
| `send_file` | `files:write` | `files.upload` 또는 `files.getUploadURLExternal` 호출 |
| `receive_file` | `files:read` | `files.list` 호출 시도 |
| `forward_reaction` | `reactions:read`, `reactions:write` | `reactions.get` 호출 시도 |
| `forward_edit` | `channels:history` | (receive_message와 공유) |
| `forward_delete` | `channels:history` | (receive_message와 공유) |
| `thread_reply` | `chat:write` | (send_message와 공유, 추가 검증 없음) |
| `list_channels` | `channels:read` | `conversations.list` 호출 시도 |
| `user_display_name` | `users:read` | `users.list` 호출 시도 |

**Slack 실제 검증 방법**: 각 API를 작은 쿼리로 실제 호출 → 성공/실패(`missing_scope` 에러)로 판별

```python
# 예시: files:read 검증
try:
    result = await slack_client.files_list(limit=1)
    # 성공 → "granted"
except SlackApiError as e:
    if e.response.get("error") == "missing_scope":
        # "missing" + needed_oauth_scopes 추출
    else:
        # "unknown"
```

### 3.2 Teams 권한 매핑

| Feature | 필요 Azure Permission | API 검증 방법 |
|---|---|---|
| `send_message` | `ChannelMessage.Send` | Graph API `POST /teams/{id}/channels/{id}/messages` 시도 |
| `receive_message` | `ChannelMessage.Read.All` | Graph API `GET /teams/{id}/channels/{id}/messages` 시도 |
| `send_file` | `Files.ReadWrite` (SharePoint) | Graph API `PUT /groups/{id}/drive/root:/{file}:/content` 시도 |
| `receive_file` | `Files.ReadWrite` | (send_file과 공유) |
| `forward_reaction` | `not_applicable` | Teams Graph API에서 리액션 전달 미지원 |
| `forward_edit` | `not_applicable` | Teams에서 편집 이벤트 수신 미구현 |
| `forward_delete` | `not_applicable` | Teams에서 삭제 이벤트 수신 미구현 |
| `thread_reply` | `ChannelMessage.Send` | (send_message와 공유) |
| `list_channels` | `Channel.ReadBasic.All` | Graph API `GET /teams/{id}/channels` 시도 |
| `user_display_name` | `TeamMember.Read.All` | Graph API `GET /teams/{id}/members` 시도 |

**Teams 검증 방법**: Graph API 호출 → 403 `Forbidden` 시 `missing` 판정

```python
# 예시: ChannelMessage.Read.All 검증
try:
    async with session.get(f"{graph_url}/teams/{team_id}/channels/{channel_id}/messages?$top=1",
                           headers=headers) as resp:
        if resp.status == 200:
            return "granted"
        elif resp.status == 403:
            return "missing"
        else:
            return "unknown"
```

> **참고**: Teams 검증은 실제 팀 ID가 있어야 의미 있는 검증 가능. `team_id` 미설정 시 `unknown` 처리.

---

## 4. 설계 변경 사항

### 4.1 DB 스키마 변경 (`accounts` 테이블)

기존 Account 모델에 `enabled_features` 컬럼 추가:

```python
# backend/app/models/account.py 추가
enabled_features = Column(
    Text,
    nullable=True,
    comment="활성화된 기능 목록 (JSON 배열). NULL이면 기본값 사용",
    # 예: '["send_message", "receive_message", "send_file", "user_display_name"]'
)
```

DB Migration:
```sql
ALTER TABLE accounts
ADD COLUMN enabled_features TEXT NULL;
```

기본값 정책: `NULL` = 모든 구현된 기능 활성화 (하위 호환성 유지)

### 4.2 Backend API 변경

#### (A) 새 엔드포인트: Feature Catalog 조회

```
GET /api/accounts-db/features/catalog
```

응답:
```json
{
  "features": [
    {
      "id": "send_message",
      "name": "메시지 전송",
      "description": "다른 플랫폼 채널로 메시지를 전달합니다.",
      "category": "messaging",
      "is_core": true,
      "platform_support": {
        "slack": { "supported": true, "implemented": true, "required_scopes": ["chat:write"] },
        "teams": { "supported": true, "implemented": true, "required_permissions": ["ChannelMessage.Send"] }
      }
    },
    {
      "id": "forward_reaction",
      "name": "리액션 전달",
      "description": "이모지 리액션을 다른 채널로 전달합니다.",
      "category": "social",
      "is_core": false,
      "platform_support": {
        "slack": { "supported": true, "implemented": true, "required_scopes": ["reactions:read", "reactions:write"] },
        "teams": { "supported": false, "implemented": false, "reason": "Teams Graph API 미지원" }
      }
    }
    // ...
  ]
}
```

#### (B) 연결 테스트 응답 확장

```
POST /api/accounts-db/{account_id}/test
```

현재 응답:
```json
{
  "success": true,
  "message": "연결 성공",
  "details": { "user": "...", "team": "...", "bot_id": "..." }
}
```

변경 후 응답:
```json
{
  "success": true,
  "message": "연결 성공",
  "details": {
    "user": "...",
    "team": "...",
    "bot_id": "...",
    "raw_scopes": ["chat:write", "channels:read", "files:write"]
  },
  "feature_permissions": [
    {
      "feature_id": "send_message",
      "feature_name": "메시지 전송",
      "status": "granted",
      "missing_scopes": [],
      "note": null
    },
    {
      "feature_id": "send_file",
      "feature_name": "파일 전송",
      "status": "missing",
      "missing_scopes": ["files:write"],
      "note": "Slack App에서 files:write 권한 추가 필요"
    },
    {
      "feature_id": "forward_reaction",
      "feature_name": "리액션 전달",
      "status": "missing",
      "missing_scopes": ["reactions:read", "reactions:write"],
      "note": null
    },
    {
      "feature_id": "forward_reaction",
      "feature_name": "리액션 전달 (Teams)",
      "status": "not_applicable",
      "missing_scopes": [],
      "note": "Teams Graph API에서 리액션 전달 미지원"
    }
  ]
}
```

#### (C) Account 업데이트 스키마 확장

```python
# backend/app/schemas/account_crud.py
class AccountUpdateRequest(BaseModel):
    ...
    enabled_features: Optional[list[str]] = None  # 추가
```

```python
class AccountResponse(BaseModel):
    ...
    enabled_features: Optional[list[str]] = None  # 추가 (NULL = 전체 활성화)
    feature_permissions: Optional[list[FeaturePermissionStatus]] = None  # 최근 테스트 결과 캐시
```

#### (D) 새 Pydantic 스키마

```python
# backend/app/schemas/account_crud.py 추가

class FeaturePermissionStatus(BaseModel):
    feature_id: str
    feature_name: str
    status: Literal["granted", "missing", "partial", "unknown", "not_applicable"]
    missing_scopes: list[str] = []
    note: Optional[str] = None

class FeaturePlatformSupport(BaseModel):
    supported: bool
    implemented: bool
    required_scopes: list[str] = []       # Slack
    required_permissions: list[str] = []  # Teams
    reason: Optional[str] = None          # not_applicable 이유

class FeatureCatalogItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    is_core: bool
    platform_support: dict[str, FeaturePlatformSupport]

class FeatureCatalogResponse(BaseModel):
    features: list[FeatureCatalogItem]
```

### 4.3 Backend 새 파일

```
backend/app/
├── services/
│   └── feature_checker.py     # 플랫폼별 권한 검증 로직
├── schemas/
│   └── feature_catalog.py     # Feature 정의 및 카탈로그
```

#### `feature_catalog.py` — Feature 정의

```python
FEATURE_CATALOG: list[dict] = [
    {
        "id": "send_message",
        "name": "메시지 전송",
        "description": "수신된 메시지를 연결된 다른 채널로 전달합니다.",
        "category": "messaging",
        "is_core": True,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["chat:write"]},
            "teams": {"supported": True, "implemented": True, "required_permissions": ["ChannelMessage.Send"]},
        },
    },
    {
        "id": "receive_message",
        "name": "메시지 수신",
        "description": "채널의 메시지를 수신합니다.",
        "category": "messaging",
        "is_core": True,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["channels:history"]},
            "teams": {"supported": True, "implemented": True, "required_permissions": ["ChannelMessage.Read.All"]},
        },
    },
    {
        "id": "send_file",
        "name": "파일 전송",
        "description": "파일 및 이미지를 다른 채널로 전달합니다.",
        "category": "file",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["files:write", "files:read"]},
            "teams": {"supported": True, "implemented": True, "required_permissions": ["Files.ReadWrite"]},
        },
    },
    {
        "id": "forward_reaction",
        "name": "리액션 전달",
        "description": "이모지 리액션을 다른 채널로 전달합니다.",
        "category": "social",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["reactions:read", "reactions:write"]},
            "teams": {"supported": False, "implemented": False, "reason": "Teams Graph API 미지원"},
        },
    },
    {
        "id": "forward_edit",
        "name": "편집 알림 전달",
        "description": "메시지 편집 시 변경 사실을 다른 채널에 알립니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["channels:history"]},
            "teams": {"supported": False, "implemented": False, "reason": "Teams 편집 이벤트 수신 미구현"},
        },
    },
    {
        "id": "forward_delete",
        "name": "삭제 알림 전달",
        "description": "메시지 삭제 시 삭제 사실을 다른 채널에 알립니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["channels:history"]},
            "teams": {"supported": False, "implemented": False, "reason": "Teams 삭제 이벤트 수신 미구현"},
        },
    },
    {
        "id": "thread_reply",
        "name": "스레드/댓글 지원",
        "description": "답글이 달린 스레드 구조를 유지하여 전달합니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["chat:write"]},
            "teams": {"supported": True, "implemented": False, "reason": "스레드 매핑 구현 예정"},
        },
    },
    {
        "id": "list_channels",
        "name": "채널 목록 조회",
        "description": "Route 설정 시 채널을 검색하고 선택할 수 있습니다.",
        "category": "channel",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["channels:read"]},
            "teams": {"supported": True, "implemented": True, "required_permissions": ["Channel.ReadBasic.All"]},
        },
    },
    {
        "id": "user_display_name",
        "name": "발신자 이름 표시",
        "description": "메시지에 원본 발신자의 이름을 표시합니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {"supported": True, "implemented": True, "required_scopes": ["users:read"]},
            "teams": {"supported": True, "implemented": True, "required_permissions": ["User.Read"]},
        },
    },
]
```

#### `feature_checker.py` — 권한 검증 서비스

```python
class SlackFeatureChecker:
    """Slack 봇의 기능별 권한 검증"""

    async def check_all(self, token: str) -> list[FeaturePermissionStatus]:
        raw_scopes = await self._get_raw_scopes(token)
        results = []
        for feature in SLACK_FEATURES:
            status = self._check_feature(feature, raw_scopes)
            results.append(status)
        return results

    async def _get_raw_scopes(self, token: str) -> set[str]:
        """auth.test로 실제 부여된 scopes 확인"""
        # Slack API: auth.test 응답의 x-oauth-scopes 헤더
        # 또는 conversations.list 등 실제 호출로 누락 scope 확인

    def _check_feature(self, feature, raw_scopes) -> FeaturePermissionStatus:
        missing = [s for s in feature["required_scopes"] if s not in raw_scopes]
        if not missing:
            return FeaturePermissionStatus(feature_id=feature["id"], status="granted", ...)
        elif len(missing) < len(feature["required_scopes"]):
            return FeaturePermissionStatus(feature_id=feature["id"], status="partial", missing_scopes=missing, ...)
        else:
            return FeaturePermissionStatus(feature_id=feature["id"], status="missing", missing_scopes=missing, ...)


class TeamsFeatureChecker:
    """Teams 봇의 기능별 권한 검증"""

    async def check_all(self, token: str, team_id: Optional[str]) -> list[FeaturePermissionStatus]:
        results = []
        for feature in TEAMS_FEATURES:
            if not feature["platform_support"]["teams"]["supported"]:
                results.append(FeaturePermissionStatus(
                    feature_id=feature["id"],
                    status="not_applicable",
                    note=feature["platform_support"]["teams"].get("reason"),
                ))
                continue
            status = await self._probe_api(feature, token, team_id)
            results.append(status)
        return results

    async def _probe_api(self, feature, token, team_id) -> FeaturePermissionStatus:
        """실제 Graph API 소규모 호출로 권한 확인"""
        # feature별 검증 API 호출 → 200 OK: granted, 403: missing
```

---

## 5. 프론트엔드 설계

### 5.1 UI 흐름

```
[플랫폼 연동 탭]
├── ProviderCard (계정 카드)
│   ├── 계정 정보 (기존)
│   ├── 활성화된 기능 배지 (신규)
│   │   예: [메시지 전송] [파일 전송] [리액션]
│   └── Actions: [연결 테스트] [수정] [삭제]
│
├── 연결 테스트 결과 패널 (기존 → 확장)
│   ├── 기본 정보 (user, team, bot_id)
│   └── 기능별 권한 매트릭스 (신규)
│       ┌─────────────────┬────────┬────────────────────┐
│       │ 기능             │ 상태   │ 안내               │
│       ├─────────────────┼────────┼────────────────────┤
│       │ 메시지 전송      │ ✅     │                    │
│       │ 파일 전송        │ ❌     │ files:write 필요   │
│       │ 리액션 전달      │ ❌     │ reactions:read 필요│
│       │ 편집 알림        │ ✅     │                    │
│       │ 발신자 이름      │ ✅     │                    │
│       └─────────────────┴────────┴────────────────────┘
│
└── ProviderModal (추가/수정)
    ├── 기본 정보 (플랫폼, 이름, 토큰) — 기존
    └── 기능 선택 섹션 (신규)
        ┌─────────────────────────────────────────┐
        │ 사용할 기능 선택                          │
        │                                          │
        │ [필수 기능]                               │
        │  ✅ 메시지 전송 (비활성화 불가)            │
        │  ✅ 메시지 수신 (비활성화 불가)            │
        │                                          │
        │ [파일]                                   │
        │  ☑ 파일 전송    requires: files:write    │
        │  ☑ 파일 수신    requires: files:read     │
        │                                          │
        │ [소셜]                                   │
        │  ☑ 리액션 전달  requires: reactions:read │
        │                                          │
        │ [메시지 상세]                             │
        │  ☑ 편집 알림 전달                         │
        │  ☑ 삭제 알림 전달                         │
        │  ☑ 스레드/댓글                            │
        │                                          │
        │ [채널 관리]                               │
        │  ☑ 채널 목록 조회                         │
        │  ☑ 발신자 이름 표시                        │
        └─────────────────────────────────────────┘
```

### 5.2 컴포넌트 변경 계획

#### `ProviderModal.tsx` 변경

- Feature 카탈로그 API 조회 (`GET /api/accounts-db/features/catalog`)
- 플랫폼 선택 후 해당 플랫폼의 Feature 목록 표시
- 카테고리별 그룹핑 (필수 / 파일 / 소셜 / 메시지 상세 / 채널 관리)
- `is_core: true`인 기능은 항상 체크, 비활성화
- `not_applicable` 기능은 회색으로 표시 + 이유 툴팁
- 선택된 feature ID 배열을 `enabled_features`로 API 전송

#### `ProviderCard.tsx` 변경

- 활성화된 기능 배지 row 추가
- 최근 테스트 결과의 권한 상태 캐시 표시 (선택적)

#### `ProviderList.tsx` 변경

- 연결 테스트 결과 패널에 `FeaturePermissionMatrix` 컴포넌트 추가
- 기존 단순 권한 목록 → Feature 기반 매트릭스로 교체

#### 신규 컴포넌트

```
frontend/src/components/providers/
├── FeatureSelector.tsx        # 기능 선택 체크박스 그룹
├── FeaturePermissionMatrix.tsx # 연결 테스트 결과 매트릭스
└── FeatureBadgeRow.tsx        # 카드에 표시되는 기능 배지 행
```

#### 신규 타입

```typescript
// frontend/src/lib/api/providers.ts 추가

interface FeaturePlatformSupport {
  supported: boolean;
  implemented: boolean;
  required_scopes?: string[];
  required_permissions?: string[];
  reason?: string;
}

interface FeatureCatalogItem {
  id: string;
  name: string;
  description: string;
  category: "messaging" | "file" | "social" | "channel";
  is_core: boolean;
  platform_support: {
    slack?: FeaturePlatformSupport;
    teams?: FeaturePlatformSupport;
  };
}

interface FeaturePermissionStatus {
  feature_id: string;
  feature_name: string;
  status: "granted" | "missing" | "partial" | "unknown" | "not_applicable";
  missing_scopes: string[];
  note: string | null;
}

// ConnectionTestResponse 확장
interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details?: {
    user?: string;
    team?: string;
    bot_id?: string;
    raw_scopes?: string[];
    // ... 기존
  };
  feature_permissions?: FeaturePermissionStatus[];  // 신규
}

// AccountResponse 확장
interface AccountResponse {
  // ... 기존 필드
  enabled_features: string[] | null;  // 신규 (null = 전체)
}
```

---

## 6. 구현 계획

### Phase 1 — Backend 기반 (우선순위: 높음)

**예상 공수**: 2일

#### Step 1-1. Feature Catalog 정의 및 API

- [ ] `backend/app/schemas/feature_catalog.py` 작성
  - `FEATURE_CATALOG` 상수 정의 (10개 기능)
  - `FeatureCatalogItem`, `FeatureCatalogResponse` Pydantic 모델
- [ ] `GET /api/accounts-db/features/catalog` 엔드포인트 추가
- [ ] 단위 테스트: `tests/api/test_feature_catalog.py`

#### Step 1-2. Feature Checker 서비스

- [ ] `backend/app/services/feature_checker.py` 작성
  - `SlackFeatureChecker.check_all(token)` 구현
    - `auth.test` 호출로 raw scopes 획득
    - scope → feature 매핑 로직
  - `TeamsFeatureChecker.check_all(token, team_id)` 구현
    - Graph API 소규모 호출로 권한 프로빙
    - `not_applicable` 처리
- [ ] 단위 테스트: `tests/services/test_feature_checker.py`

#### Step 1-3. 연결 테스트 API 확장

- [ ] `backend/app/api/accounts_test.py` 수정
  - Slack 테스트: `feature_permissions` 필드 추가
  - Teams 테스트: `feature_permissions` 필드 추가
  - `ConnectionTestResponse` 스키마에 `feature_permissions` 추가
- [ ] 기존 테스트 유지 (하위 호환)

#### Step 1-4. DB 마이그레이션 + Account 기능 선택

- [ ] `accounts` 테이블에 `enabled_features TEXT NULL` 컬럼 추가
- [ ] `AccountUpdateRequest`에 `enabled_features` 필드 추가
- [ ] `AccountResponse`에 `enabled_features` 필드 추가
- [ ] `accounts_crud.py` PUT 핸들러에서 `enabled_features` 저장 처리

### Phase 2 — Frontend UI (우선순위: 높음)

**예상 공수**: 2일

#### Step 2-1. API 클라이언트 + 타입 확장

- [ ] `frontend/src/lib/api/providers.ts` 타입 추가
  - `FeatureCatalogItem`, `FeaturePermissionStatus`, 확장된 `ConnectionTestResponse`
- [ ] `getFeatureCatalog()` API 메서드 추가
- [ ] Zustand store에 `featureCatalog` 상태 추가

#### Step 2-2. `FeatureSelector.tsx` 컴포넌트

- [ ] Feature Catalog API 조회
- [ ] 플랫폼별 카테고리 그룹 렌더링
- [ ] `is_core` → 항상 체크 + disabled
- [ ] `not_applicable` → 회색 + 이유 툴팁
- [ ] 변경 시 `onFeaturesChange(featureIds: string[])` 콜백

#### Step 2-3. `FeaturePermissionMatrix.tsx` 컴포넌트

- [ ] `FeaturePermissionStatus[]` props로 받아 테이블 렌더링
- [ ] 상태별 아이콘: ✅ granted, ❌ missing, ⚠️ partial, ❓ unknown, ➖ not_applicable
- [ ] `missing_scopes` → 클릭 시 권한 추가 방법 안내
- [ ] Teams: Azure Portal 링크 제공

#### Step 2-4. `ProviderModal.tsx` 수정

- [ ] `FeatureSelector` 컴포넌트 통합
- [ ] `enabled_features` 필드를 API 요청에 포함

#### Step 2-5. `ProviderCard.tsx` 수정

- [ ] 활성화된 기능 배지 행 추가 (`FeatureBadgeRow`)
- [ ] null → "전체 기능" 표시

#### Step 2-6. `ProviderList.tsx` 수정

- [ ] 연결 테스트 결과에 `FeaturePermissionMatrix` 통합
- [ ] 기존 단순 권한 표시 대체

### Phase 3 — Provider 연동 (우선순위: 중간)

**예상 공수**: 1일

- [ ] `websocket_bridge.py`에서 Route 메시지 처리 시 `enabled_features` 참조
  - `forward_reaction`이 비활성화된 경우 리액션 이벤트 무시
  - `send_file`이 비활성화된 경우 파일 첨부 무시 (텍스트만 전달)
- [ ] Slack Provider: `enabled_features` 로드 및 이벤트 필터링
- [ ] Teams Provider: `enabled_features` 로드 및 기능 필터링

### Phase 4 — 고도화 (우선순위: 낮음)

- [ ] 연결 테스트 결과를 DB에 캐시 (`last_permission_check_at`, `last_permission_result`)
- [ ] 권한 추가 가이드 모달 (Slack App 설정 페이지 직접 링크)
- [ ] 정기 권한 재검증 (Cron: 하루 1회)
- [ ] 알림: 권한이 취소/만료된 경우 관리자에게 알림

---

## 7. 예상 UI 스케치

### 7.1 ProviderCard (기능 배지 추가)

```
┌─────────────────────────────────────────────────────────┐
│ 🟣 Slack  slack-production              ● 연결됨  ● 활성 │
│─────────────────────────────────────────────────────────│
│ Bot Token: xoxb-522...y53mQe                             │
│ App Token: xapp-1-H8...xKpT                              │
│                                                          │
│ 활성화된 기능:                                            │
│ [메시지 전송] [메시지 수신] [파일 전송] [발신자 이름]      │
│                                                          │
│                   [연결 테스트] [수정] [삭제]             │
└─────────────────────────────────────────────────────────┘
```

### 7.2 연결 테스트 결과 패널

```
┌─────────────────────────────────────────────────────────┐
│ ✅ slack-production 연결 성공                            │
│ 사용자: @vmsbot  팀: VMS Workspace  Bot ID: B07NZE4H65X  │
│─────────────────────────────────────────────────────────│
│ 기능별 권한 상태                                          │
│                                                          │
│ [메시징]                                                 │
│  ✅ 메시지 전송        chat:write                        │
│  ✅ 메시지 수신        channels:history                  │
│  ✅ 편집 알림 전달     channels:history (공유)           │
│  ✅ 삭제 알림 전달     channels:history (공유)           │
│  ✅ 발신자 이름 표시   users:read                        │
│                                                          │
│ [파일]                                                   │
│  ❌ 파일 전송          files:write ← 권한 없음           │
│                        → Slack App 설정에서 추가 필요    │
│  ❌ 파일 수신          files:read ← 권한 없음            │
│                                                          │
│ [소셜]                                                   │
│  ❌ 리액션 전달        reactions:read, reactions:write   │
│                                                          │
│ [채널 관리]                                              │
│  ✅ 채널 목록 조회     channels:read                     │
└─────────────────────────────────────────────────────────┘
```

### 7.3 ProviderModal — 기능 선택 섹션

```
┌─────────────────────────────────────────────────────────┐
│ 사용할 기능 선택                                          │
│                                                          │
│ ▼ 필수 기능 (비활성화 불가)                               │
│   ■ 메시지 전송    requires: chat:write                  │
│   ■ 메시지 수신    requires: channels:history            │
│                                                          │
│ ▶ 파일 (2/2 선택)                                       │
│   ■ 파일 전송      requires: files:write                 │
│   ■ 파일 수신      requires: files:read                  │
│                                                          │
│ ▶ 소셜 (0/1 선택)                                       │
│   □ 리액션 전달    requires: reactions:read, write       │
│                                                          │
│ ▶ 메시지 상세 (2/3 선택)                                 │
│   ■ 편집 알림 전달                                       │
│   ■ 삭제 알림 전달                                       │
│   □ 스레드/댓글    requires: chat:write (공유)           │
│                                                          │
│ ▶ 채널 관리 (2/2 선택)                                   │
│   ■ 채널 목록 조회 requires: channels:read              │
│   ■ 발신자 이름 표시 requires: users:read               │
└─────────────────────────────────────────────────────────┘
```

---

## 8. 하위 호환성

- 기존 Account의 `enabled_features = NULL` → 모든 기능 활성화 (기존 동작 유지)
- 연결 테스트 기존 응답 구조 유지 + `feature_permissions` 필드 추가 (선택적 필드)
- Provider의 기존 동작 변경 없음 (Phase 3에서 선택적 적용)

---

## 9. 관련 파일 변경 목록

### 신규 생성
- `backend/app/schemas/feature_catalog.py`
- `backend/app/services/feature_checker.py`
- `backend/tests/api/test_feature_catalog.py`
- `backend/tests/services/test_feature_checker.py`
- `frontend/src/components/providers/FeatureSelector.tsx`
- `frontend/src/components/providers/FeaturePermissionMatrix.tsx`
- `frontend/src/components/providers/FeatureBadgeRow.tsx`

### 수정
- `backend/app/models/account.py` — `enabled_features` 컬럼 추가
- `backend/app/schemas/account_crud.py` — 확장된 스키마
- `backend/app/api/accounts_crud.py` — `enabled_features` CRUD
- `backend/app/api/accounts_test.py` — Feature 권한 검증 통합
- `frontend/src/lib/api/providers.ts` — 타입 + API 메서드 추가
- `frontend/src/store/providers.ts` — `featureCatalog` 상태 추가
- `frontend/src/components/providers/ProviderModal.tsx` — Feature 선택 UI
- `frontend/src/components/providers/ProviderCard.tsx` — 기능 배지 행
- `frontend/src/components/providers/ProviderList.tsx` — 테스트 결과 확장

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-04-05 | 1.0 | 초기 설계 작성 |
