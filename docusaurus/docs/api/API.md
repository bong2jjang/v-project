---
title: API 레퍼런스
sidebar_position: 1
---

# API 레퍼런스

v-project의 모든 REST API와 WebSocket 엔드포인트를 정리한 문서입니다. 플랫폼 공통 API, 앱별 전용 API, 그리고 실시간 통신을 위한 WebSocket까지 빠짐없이 다루고 있으니, 개발 중 필요한 엔드포인트를 찾을 때 참고하시면 됩니다.

---

## 공통 규약

### Base URL

각 서비스별 기본 URL은 아래와 같습니다.

| 서비스 | Base URL | Swagger UI |
|--------|----------|------------|
| v-channel-bridge | `http://127.0.0.1:8000` | `http://127.0.0.1:8000/docs` |
| v-platform-template | `http://127.0.0.1:8002` | `http://127.0.0.1:8002/docs` |
| v-platform-portal | `http://127.0.0.1:8080` | `http://127.0.0.1:8080/docs` |

모든 API 경로는 `/api` 접두사로 시작합니다. 예를 들어 인증 API는 `/api/auth/login`처럼 사용합니다.

### 인증 (Authentication)

대부분의 API는 JWT(Bearer Token) 인증을 요구합니다. 로그인 후 발급받은 `access_token`을 `Authorization` 헤더에 포함해서 요청하면 됩니다.

```
Authorization: Bearer <access_token>
```

**토큰 획득 방법**

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "Admin123!"
}
```

응답에서 `access_token`과 `expires_at`을 받게 되며, `refresh_token`은 HttpOnly 쿠키로 자동 설정됩니다.

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_at": "2026-04-13T12:00:00Z",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "username": "admin",
    "role": "system_admin"
  },
  "csrf_token": "abc123..."
}
```

**Refresh Token**: 액세스 토큰이 만료되면 `POST /api/auth/refresh`를 호출하여 갱신합니다. Refresh Token은 HttpOnly 쿠키에 저장되며, 토큰 로테이션 방식을 사용합니다(갱신 시 기존 토큰 폐기 + 새 토큰 발급).

### 권한 체계

API 엔드포인트마다 요구하는 권한 수준이 다릅니다. 이 문서에서 사용하는 권한 표기는 다음과 같습니다.

| 표기 | 의미 | 설명 |
|------|------|------|
| 공개 | 인증 불필요 | 누구나 호출 가능 |
| 인증 | `get_current_user` | 로그인한 사용자만 |
| 권한: `resource.level` | `require_permission("resource", "level")` | 특정 리소스에 대한 read/write 권한 필요 |
| 관리자 이상 | `require_admin_or_above()` | system_admin 또는 org_admin |
| 시스템 관리자 | `require_system_admin()` | system_admin만 |

유효 권한은 `MAX(그룹 권한, 개인 오버라이드)`로 계산됩니다. system_admin 역할은 모든 메뉴에 대해 write 권한을 자동으로 가집니다.

### 오류 응답

모든 API는 표준 HTTP 상태 코드를 사용하며, 오류 시 `detail` 필드에 설명이 포함됩니다.

| 상태 코드 | 의미 | 예시 |
|-----------|------|------|
| 400 | 잘못된 요청 | `{"detail": "이미 등록된 이메일 주소입니다."}` |
| 401 | 인증 필요 | `{"detail": "Not authenticated"}` |
| 403 | 권한 부족 | `{"detail": "Insufficient permissions"}` |
| 404 | 리소스 없음 | `{"detail": "User not found"}` |
| 409 | 충돌 | `{"detail": "app_id 'xxx' 이(가) 이미 존재합니다."}` |
| 429 | 요청 제한 | Rate Limit 초과 시 |
| 500 | 서버 오류 | `{"detail": "Internal server error"}` |

### CSRF 보호

상태 변경 요청(POST, PUT, DELETE)은 CSRF 토큰을 요구합니다. 로그인 시 `csrf_token` 쿠키가 설정되며, 요청 시 `X-CSRF-Token` 헤더에 이 값을 포함해야 합니다.

```
X-CSRF-Token: <csrf_token_from_cookie>
```

### app_id 컨텍스트

v-project는 멀티 앱 아키텍처를 사용합니다. 각 앱(v-channel-bridge, v-platform-template, v-platform-portal)이 백엔드를 실행할 때 `app_id`가 설정되며, 이를 기반으로 메뉴, 권한 그룹, 감사 로그, 시스템 설정 등이 앱별로 격리됩니다.

클라이언트가 직접 `app_id`를 보낼 필요는 없습니다. 서버가 `request.app.state.app_id`를 자동으로 주입합니다.

---

## 플랫폼 API

v-platform이 제공하는 공통 API입니다. 모든 앱에서 동일하게 사용할 수 있습니다.

### 인증 (`/api/auth`)

사용자 등록, 로그인, 토큰 갱신, 비밀번호 재설정 등 핵심 인증 기능을 제공합니다. 로그인과 회원가입 엔드포인트에는 Rate Limit이 적용되어 있습니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/register` | 공개 (3회/분) | 새 사용자 등록 |
| POST | `/api/auth/login` | 공개 (5회/분) | JSON 기반 로그인 |
| POST | `/api/auth/login/form` | 공개 (5회/분) | Form 기반 로그인 (OAuth2PasswordRequestForm) |
| GET | `/api/auth/me` | 인증 | 현재 사용자 정보 조회 |
| POST | `/api/auth/refresh` | 인증 (쿠키) | 액세스 토큰 갱신 (Refresh Token 로테이션) |
| POST | `/api/auth/logout` | 인증 | 현재 디바이스 로그아웃 |
| POST | `/api/auth/logout-all` | 인증 | 전체 디바이스 로그아웃 |
| GET | `/api/auth/devices` | 인증 | 연결된 디바이스 목록 조회 |
| DELETE | `/api/auth/devices/{device_id}` | 인증 | 특정 디바이스 세션 제거 |
| POST | `/api/auth/password-reset/request` | 공개 (3회/시간) | 비밀번호 재설정 이메일 발송 |
| GET | `/api/auth/password-reset/verify` | 공개 | 재설정 토큰 유효성 검증 |
| POST | `/api/auth/password-reset/confirm` | 공개 | 비밀번호 재설정 확정 |

**주요 스키마**: `UserCreate`, `UserLogin`, `Token`, `UserResponse`, `DeviceInfo`, `PasswordResetRequest`, `PasswordResetVerifyResponse`, `PasswordResetConfirm`, `MessageResponse`

**로그인 응답 예시**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_at": "2026-04-13T14:00:00+00:00",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "username": "admin",
    "role": "system_admin",
    "is_active": true,
    "auth_method": "local",
    "theme": "system",
    "color_preset": "blue",
    "groups": [
      { "id": 1, "name": "System Admin", "is_default": true }
    ]
  },
  "csrf_token": "abc123def456..."
}
```

**디바이스 목록 응답 예시**

```json
[
  {
    "id": 42,
    "device_name": "Chrome on Windows",
    "device_fingerprint": "fp_abc123",
    "ip_address": "192.168.1.100",
    "app_id": "v-channel-bridge",
    "last_used_at": "2026-04-13T10:30:00Z",
    "created_at": "2026-04-10T08:00:00Z",
    "expires_at": "2026-04-17T08:00:00Z"
  }
]
```

---

### SSO 인증 (`/api/auth/sso`)

외부 ID 제공자(Microsoft Entra ID, Generic OIDC)를 통한 Single Sign-On 인증을 지원합니다. 팝업 기반 인증 플로우를 사용하며, 인증 완료 후 `postMessage`로 결과를 전달합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/auth/sso/providers` | 공개 | 활성 SSO Provider 목록 (login_url 포함) |
| GET | `/api/auth/sso/{provider}/authorize` | 공개 | 인증 URL을 JSON으로 반환 |
| GET | `/api/auth/sso/{provider}/login` | 공개 | Provider 인증 페이지로 리다이렉트 (레거시) |
| GET | `/api/auth/sso/{provider}/callback` | 공개 | OAuth2 콜백 처리 및 JWT 발급 |

**지원 Provider**: `microsoft` (Microsoft Entra ID), `oidc` (Generic OpenID Connect)

SSO 콜백은 HTML 팝업 응답을 반환하며, opener 윈도우에 `postMessage`로 토큰을 전달합니다. SSO로 최초 로그인하면 사용자 계정이 자동 생성되고, 기존 로컬 계정이 있으면 `auth_method`가 `hybrid`로 전환됩니다.

---

### SSO Relay (`/api/auth/sso-relay`)

포털에서 앱으로 전환할 때 **1회용 코드** 기반의 경량 SSO를 제공합니다. URL에 JWT를 노출하지 않고, Redis에 저장된 1회용 코드를 서버 간에 교환하여 새 JWT를 발급합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/sso-relay/create` | 인증 필요 | 1회용 SSO 코드 생성 (Redis 저장, 30초 TTL) |
| POST | `/api/auth/sso-relay/exchange` | 공개 | 코드를 JWT + 사용자 정보로 교환 (1회용, 즉시 삭제) |

**Create 응답 예시**:

```json
{ "code": "u-KmtixZE0Ewi9JYOKKJJUB6Vk50P1x2if8cCUXdmuc" }
```

**Exchange 요청/응답 예시**:

```json
// Request
{ "code": "u-KmtixZE0Ewi9JYOKKJJUB6Vk50P1x2if8cCUXdmuc" }

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_at": "2026-04-14T09:00:00Z",
  "user": { "id": 1, "email": "user@example.com", "role": "user", ... }
}
```

**보안 특성**: 코드는 `secrets.token_urlsafe(32)`로 생성되며, 사용 즉시 Redis에서 삭제됩니다. 30초 내 미사용 시 자동 만료됩니다. 포털과 앱이 동일한 Redis 인스턴스와 `SECRET_KEY`를 공유해야 합니다.

자세한 동작 원리는 [SSO Relay 문서](/docs/apps/v-platform-portal/admin-guide/SSO_RELAY)를 참조하세요.

---

### Microsoft OAuth2 (`/api/auth/microsoft`)

Teams 위임 인증(Delegated Auth)을 위한 Microsoft OAuth2 연동입니다. SSO 로그인과는 별개로, Teams API 호출 권한 위임에 사용됩니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/auth/microsoft/login` | 인증 | OAuth2 인증 시작 (리다이렉트) |
| GET | `/api/auth/microsoft/callback` | 공개 | OAuth2 콜백 처리 |
| POST | `/api/auth/microsoft/{account_id}/disconnect` | 권한: `integrations.write` | 위임 해제 |
| GET | `/api/auth/microsoft/{account_id}/status` | 인증 | 위임 상태 확인 |

---

### 사용자 관리 (`/api/users`)

사용자 CRUD, 본인 정보 관리, 그룹 소속 관리, 유효 권한 조회를 제공합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/users` | 권한: `users.read` | 사용자 목록 (페이징, 필터링) |
| POST | `/api/users` | 권한: `users.write` | 관리자가 사용자 직접 생성 |
| GET | `/api/users/me` | 인증 | 본인 정보 조회 |
| PUT | `/api/users/me` | 인증 | 본인 정보 수정 (이름, 테마, 시작 페이지) |
| PUT | `/api/users/me/password` | 인증 | 비밀번호 변경 |
| GET | `/api/users/{user_id}` | 권한: `users.read` | 특정 사용자 조회 |
| PUT | `/api/users/{user_id}` | 권한: `users.write` | 사용자 정보 수정 |
| DELETE | `/api/users/{user_id}` | 권한: `users.write` | 사용자 삭제 |
| PUT | `/api/users/{user_id}/role` | 시스템 관리자 | 역할 변경 |
| PUT | `/api/users/{user_id}/groups` | 관리자 이상 | 그룹 소속 일괄 설정 |
| GET | `/api/users/{user_id}/groups` | 관리자 이상 | 소속 그룹 목록 조회 |
| GET | `/api/users/{user_id}/effective-permissions` | 관리자 이상 | 유효 권한 조회 (그룹+개인 MAX) |

**주요 스키마**: `UserResponse`, `UserListResponse`, `AdminUserCreate`, `UserUpdate`, `UserUpdateMe`, `UserPasswordChange`, `UserRoleUpdate`

**사용자 목록 쿼리 파라미터**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `page` | int | 페이지 번호 (기본: 1) |
| `per_page` | int | 페이지당 항목 수 (기본: 20, 최대: 1000) |
| `role` | string | 역할 필터 (`system_admin`, `org_admin`, `user`) |
| `is_active` | boolean | 활성 상태 필터 |
| `search` | string | 이메일/사용자명 검색 |
| `company_id` | int | 회사 ID 필터 |
| `department_id` | int | 부서 ID 필터 |
| `group_id` | int | 권한 그룹 ID 필터 |

---

### 권한 관리 (`/api/permissions`)

메뉴 기반 RBAC 권한의 조회 및 설정을 담당합니다. 각 메뉴 항목에 대해 `none`, `read`, `write` 수준을 지정할 수 있습니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/permissions/me` | 인증 | 내 유효 권한 목록 |
| GET | `/api/permissions/user/{user_id}` | 관리자 이상 | 특정 사용자의 권한 목록 |
| PUT | `/api/permissions/user/{user_id}` | 관리자 이상 | 사용자 권한 일괄 설정 |
| GET | `/api/permissions/matrix` | 관리자 이상 | 전체 사용자 x 메뉴 권한 매트릭스 (개인 권한) |
| GET | `/api/permissions/effective-matrix` | 관리자 이상 | 유효 권한 매트릭스 (그룹+개인 통합, source 포함) |
| GET | `/api/permissions/by-menu/{menu_item_id}` | 관리자 이상 | 특정 메뉴에 대한 모든 사용자 권한 |
| PUT | `/api/permissions/by-menu/{menu_item_id}` | 관리자 이상 | 특정 메뉴에 대한 여러 사용자 권한 일괄 설정 |
| PUT | `/api/permissions/bulk/by-group/{group_id}` | 관리자 이상 | 그룹 템플릿을 여러 사용자에게 일괄 적용 |

**권한 설정 요청 예시**

```json
{
  "permissions": [
    { "menu_item_id": 1, "access_level": "write" },
    { "menu_item_id": 2, "access_level": "read" },
    { "menu_item_id": 3, "access_level": "none" }
  ]
}
```

---

### 권한 그룹 (`/api/permission-groups`)

권한 그룹(역할 그룹)의 CRUD와 멤버 관리를 제공합니다. 그룹에 메뉴별 권한을 설정하면, 해당 그룹에 속한 모든 사용자에게 권한이 적용됩니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/permission-groups` | 관리자 이상 | 권한 그룹 목록 (grants 포함) |
| GET | `/api/permission-groups/{group_id}` | 관리자 이상 | 특정 그룹 상세 조회 |
| POST | `/api/permission-groups` | 시스템 관리자 | 커스텀 그룹 생성 |
| PUT | `/api/permission-groups/{group_id}` | 시스템 관리자 | 그룹 수정 (디폴트 그룹은 수정 불가) |
| DELETE | `/api/permission-groups/{group_id}` | 시스템 관리자 | 그룹 삭제 (디폴트 그룹은 삭제 불가) |
| PUT | `/api/permission-groups/{group_id}/grants` | 시스템 관리자 | 그룹 메뉴 권한 일괄 설정 |
| GET | `/api/permission-groups/{group_id}/members` | 관리자 이상 | 그룹 소속 사용자 목록 |
| POST | `/api/permission-groups/{group_id}/members` | 관리자 이상 | 그룹에 사용자 추가 |
| DELETE | `/api/permission-groups/{group_id}/members/{user_id}` | 관리자 이상 | 그룹에서 사용자 제거 |
| GET | `/api/permission-groups/user/{user_id}/groups` | 관리자 이상 | 특정 사용자의 소속 그룹 목록 |
| GET | `/api/permission-groups/members/search` | 관리자 이상 | 그룹 멤버 추가를 위한 사용자 검색 |

**그룹 권한 설정 요청 예시**

```json
{
  "grants": [
    { "menu_item_id": 1, "access_level": "write" },
    { "menu_item_id": 2, "access_level": "read" }
  ]
}
```

**그룹 응답 예시**

```json
{
  "id": 1,
  "name": "System Admin",
  "description": "시스템 관리자 그룹",
  "is_default": true,
  "is_active": true,
  "created_by": null,
  "created_at": "2026-04-01T00:00:00Z",
  "updated_at": "2026-04-01T00:00:00Z",
  "member_count": 3,
  "grants": [
    {
      "id": 1,
      "menu_item_id": 1,
      "permission_key": "dashboard",
      "menu_label": "대시보드",
      "access_level": "write"
    }
  ]
}
```

---

### 메뉴 관리 (`/api/menus`)

사이드바 메뉴의 CRUD와 순서 변경을 관리합니다. 기본 제공 메뉴(`built_in`)와 커스텀 메뉴(`custom_iframe`, `custom_link`, `menu_group`)를 지원합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/menus` | 인증 | 현재 사용자가 접근 가능한 메뉴 목록 |
| GET | `/api/menus/all` | 관리자 이상 | 전체 메뉴 목록 (관리용) |
| POST | `/api/menus` | 시스템 관리자 | 커스텀 메뉴 등록 |
| PUT | `/api/menus/reorder` | 시스템 관리자 | 메뉴 순서 변경 |
| PUT | `/api/menus/{menu_id}` | 시스템 관리자 | 메뉴 수정 |
| DELETE | `/api/menus/{menu_id}` | 시스템 관리자 | 커스텀 메뉴 삭제 (built_in 삭제 불가) |

**메뉴 타입**: `built_in`, `custom_iframe`, `custom_link`, `menu_group`

**섹션**: `basic`, `admin`, `custom`

**커스텀 메뉴 생성 요청 예시**

```json
{
  "permission_key": "external_docs",
  "label": "외부 문서",
  "icon": "BookOpen",
  "path": "/custom/external-docs",
  "menu_type": "custom_iframe",
  "iframe_url": "https://docs.example.com",
  "iframe_fullscreen": false,
  "sort_order": 500,
  "section": "custom"
}
```

---

### 감사 로그 (`/api/audit-logs`)

시스템 내 모든 주요 작업(로그인, 사용자 변경, 권한 변경, 메뉴 변경 등)의 기록을 조회합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/audit-logs` | 권한: `audit_logs.read` | 감사 로그 목록 (페이징, 필터링) |
| GET | `/api/audit-logs/{log_id}` | 권한: `audit_logs.read` | 특정 감사 로그 상세 조회 |
| GET | `/api/audit-logs/stats/summary` | 권한: `audit_logs.read` | 기간별 감사 통계 |
| GET | `/api/audit-logs/export/csv` | 권한: `audit_logs.read` | CSV 내보내기 (최대 10,000건) |

**주요 스키마**: `AuditLogResponse`, `AuditLogListResponse`

**쿼리 파라미터**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `page` | int | 페이지 번호 (기본: 1) |
| `per_page` | int | 페이지당 항목 수 (기본: 50, 최대: 500) |
| `action` | string | 액션 필터 (예: `user.login`, `menu.create`) |
| `user_id` | int | 사용자 ID 필터 |
| `user_email` | string | 이메일 부분 일치 검색 |
| `resource_type` | string | 리소스 타입 필터 (예: `user`, `config`, `menu`) |
| `resource_id` | string | 리소스 ID 필터 |
| `status` | string | 상태 필터 (`success`, `failure`, `error`) |
| `start_date` | datetime | 시작 일시 (ISO 8601) |
| `end_date` | datetime | 종료 일시 (ISO 8601) |
| `ip_address` | string | IP 주소 필터 |

**통계 응답 예시**

```json
{
  "period_days": 7,
  "start_date": "2026-04-06T00:00:00+00:00",
  "end_date": "2026-04-13T12:00:00+00:00",
  "total_logs": 1234,
  "by_status": { "success": 1200, "failure": 30, "error": 4 },
  "top_actions": [
    { "action": "user.login", "count": 500 },
    { "action": "permission.update", "count": 120 }
  ],
  "top_users": [
    { "user_email": "admin@example.com", "count": 300 }
  ]
}
```

---

### 시스템 설정 (`/api/system-settings`)

메뉴얼 링크, 기본 시작 페이지, 앱 브랜딩(제목, 설명, 로고) 등 시스템 전역 설정을 관리합니다. 앱 컨텍스트에서는 앱별 설정이 우선 적용되고, 없으면 전역 설정으로 폴백합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/system-settings/` | 인증 | 시스템 설정 조회 |
| PUT | `/api/system-settings/` | 권한: `settings.write` | 시스템 설정 수정 |

**주요 스키마**: `SystemSettingsResponse`, `SystemSettingsUpdate`

**설정 응답 예시**

```json
{
  "id": 1,
  "manual_enabled": true,
  "manual_url": "http://127.0.0.1:3000",
  "default_start_page": "/",
  "app_title": "v-channel-bridge",
  "app_description": "Slack/Teams 메시지 브리지",
  "app_logo_url": "/api/uploads/images/logo.png"
}
```

---

### 실시간 알림 (`/api/notifications`)

WebSocket을 통해 실시간으로 전송되는 인메모리 알림을 관리합니다. 주로 테스트 및 디버깅 목적으로 사용됩니다. 이 라우터는 앱 메인에서 prefix와 함께 마운트됩니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/notifications/test` | 관리자 이상 | 테스트 알림 발송 |
| POST | `/api/notifications/send` | 관리자 이상 | 커스텀 알림 전송 |
| POST | `/api/notifications/test/all-types` | 관리자 이상 | 5가지 severity 레벨 테스트 일괄 발송 |

**severity 종류**: `critical`, `error`, `warning`, `info`, `success`

**category 종류**: `service`, `message`, `config`, `user`, `system`

**알림 전송 요청 예시**

```json
{
  "severity": "warning",
  "category": "service",
  "title": "Provider 연결 불안정",
  "message": "Slack Provider 응답 시간이 느려지고 있습니다.",
  "source": "monitoring",
  "link": "/bridge/status",
  "dismissible": true,
  "persistent": false
}
```

---

### 영구 알림 (`/api/notifications-v2`)

DB에 저장되는 영구 알림 시스템입니다. scope 기반(global, app, role, user)으로 대상을 지정할 수 있고, toast/announcement/both 방식으로 전달됩니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/notifications-v2` | 인증 | 알림 목록 (`admin_view=true`이면 전체) |
| POST | `/api/notifications-v2` | 인증 | 알림 생성 (관리자) |
| PUT | `/api/notifications-v2/{notification_id}` | 인증 | 알림 수정 (관리자) |
| POST | `/api/notifications-v2/{notification_id}/read` | 인증 | 알림 읽음 처리 |
| POST | `/api/notifications-v2/read-all` | 인증 | 전체 읽음 처리 |
| GET | `/api/notifications-v2/system-status` | 인증 | 앱별 시스템 알림 활성 상태 |
| GET | `/api/notifications-v2/announcements` | 인증 | 미읽은 공지사항 목록 (팝업 표시용) |
| DELETE | `/api/notifications-v2/{notification_id}` | 인증 | 알림 삭제 (시스템 기본 알림은 삭제 불가) |

**scope 종류**: `global` (전체), `app` (현재 앱), `role` (특정 역할), `user` (특정 사용자)

**delivery_type 종류**: `toast` (실시간 토스트만), `announcement` (공지 팝업만), `both` (둘 다)

**알림 목록 쿼리 파라미터**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `limit` | int | 최대 반환 수 (기본: 50, 최대: 100) |
| `offset` | int | 건너뛸 수 (기본: 0) |
| `unread_only` | boolean | 미읽은 알림만 (기본: false) |
| `admin_view` | boolean | 관리자 뷰 - 전체 알림 표시 (기본: false) |

**알림 생성 요청 예시**

```json
{
  "title": "시스템 점검 안내",
  "message": "2026-04-14 02:00~04:00 시스템 점검이 예정되어 있습니다.",
  "severity": "warning",
  "category": "system",
  "scope": "app",
  "delivery_type": "both",
  "link": "/help"
}
```

---

### 조직 관리 (`/api/organizations`)

회사 및 부서 CRUD와 조직도 트리 조회를 제공합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/organizations/companies` | 관리자 이상 | 회사 목록 조회 |
| POST | `/api/organizations/companies` | 시스템 관리자 | 회사 생성 |
| PUT | `/api/organizations/companies/{company_id}` | 시스템 관리자 | 회사 수정 |
| DELETE | `/api/organizations/companies/{company_id}` | 시스템 관리자 | 회사 삭제 |
| GET | `/api/organizations/companies/{company_id}/departments` | 관리자 이상 | 부서 트리 조회 (`flat=true`이면 플랫 목록) |
| POST | `/api/organizations/companies/{company_id}/departments` | 시스템 관리자 | 부서 생성 |
| PUT | `/api/organizations/departments/{dept_id}` | 시스템 관리자 | 부서 수정 |
| DELETE | `/api/organizations/departments/{dept_id}` | 시스템 관리자 | 부서 삭제 |
| GET | `/api/organizations/tree` | 관리자 이상 | 조직도 트리 (회사 > 부서 > 사용자 계층) |

**조직도 트리 응답 예시**

```json
{
  "companies": [
    {
      "id": 1,
      "name": "본사",
      "code": "HQ",
      "is_active": true,
      "departments": [
        {
          "id": 1,
          "name": "개발팀",
          "code": "DEV",
          "users": [
            { "id": 2, "username": "developer", "email": "dev@example.com", "role": "user", "is_active": true }
          ],
          "children": []
        }
      ],
      "unassigned_users": []
    }
  ],
  "unassigned_users": [
    { "id": 10, "username": "newuser", "email": "new@example.com", "role": "user", "is_active": true }
  ],
  "total_users": 12
}
```

---

### 사용자 OAuth 토큰 (`/api/users/me/oauth`, `/api/admin/oauth`)

사용자가 연결한 외부 OAuth 토큰(Microsoft 등)의 관리를 제공합니다. 사용자 셀프 서비스와 관리자 기능으로 나뉩니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/users/me/oauth/tokens` | 인증 | 내 OAuth 토큰 목록 |
| POST | `/api/users/me/oauth/connect/{provider}` | 인증 | 외부 서비스 연결 |
| DELETE | `/api/users/me/oauth/disconnect/{provider}` | 인증 | 외부 서비스 연결 해제 |
| GET | `/api/users/me/oauth/status` | 인증 | 연결 상태 확인 |
| GET | `/api/admin/oauth/tokens` | 권한: `integrations.write` | 전체 사용자 OAuth 토큰 목록 |
| DELETE | `/api/admin/oauth/tokens/{token_id}` | 권한: `integrations.write` | 관리자 토큰 강제 해지 |
| GET | `/api/admin/oauth/stats` | 권한: `integrations.write` | OAuth 연동 통계 |

---

### 이미지 업로드 (`/api/uploads`)

알림 콘텐츠나 마크다운 등에서 사용할 이미지 업로드 기능입니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/uploads/image` | 인증 | 이미지 업로드 (최대 5MB) |
| GET | `/api/uploads/images/{filename}` | 공개 | 업로드된 이미지 조회 |

**허용 형식**: `image/png`, `image/jpeg`, `image/gif`, `image/webp`

**업로드 응답 예시**

```json
{
  "url": "/api/uploads/images/abc123def456.png"
}
```

---

### 헬스 체크 (`/health`)

서비스 상태를 확인하는 엔드포인트입니다. HealthRegistry 패턴을 사용하여 각 서비스(DB, Redis 등)의 상태를 확장 가능하게 체크합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/health` | 공개 | 전체 헬스 체크 |

**응답 예시**

```json
{
  "status": "healthy",
  "timestamp": "2026-04-13T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

### Prometheus 메트릭 (`/metrics`)

Prometheus 형식의 메트릭을 수집할 수 있는 엔드포인트입니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/metrics` | 공개 | Prometheus 메트릭 |

---

## v-channel-bridge 전용 API

v-channel-bridge 앱에서만 사용하는 API입니다. 브리지 제어, 메시지 히스토리, Provider 계정 관리, Teams 웹훅, 모니터링을 포함합니다.

### 브리지 제어 (`/api/bridge`)

Slack/Teams 간 메시지 브리지의 상태 조회, Route 관리, Provider 제어를 담당합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/bridge/status` | 권한: `channels.read` | 브리지 연결 상태 |
| GET | `/api/bridge/providers` | 권한: `channels.read` | 활성 Provider 목록 |
| GET | `/api/bridge/routes` | 권한: `channels.read` | 전체 Route 목록 |
| POST | `/api/bridge/routes` | 권한: `channels.write` | Route 추가 |
| DELETE | `/api/bridge/routes` | 권한: `channels.write` | Route 삭제 |
| PATCH | `/api/bridge/routes/toggle` | 권한: `channels.write` | Route 활성화/비활성화 |
| GET | `/api/bridge/channels/{platform}` | 권한: `channels.read` | 플랫폼 채널 목록 |
| GET | `/api/bridge/channels/{platform}/validate/{channel_id}` | 권한: `channels.read` | 채널 ID 유효성 검증 |
| POST | `/api/bridge/command` | 권한: `channels.write` | 브리지 명령 실행 |
| POST | `/api/bridge/start` | 시스템 관리자 | 브리지 시작 |
| POST | `/api/bridge/stop` | 시스템 관리자 | 브리지 중지 |
| POST | `/api/bridge/reload-providers` | 시스템 관리자 | Provider 설정 리로드 |
| GET | `/api/bridge/logs` | 권한: `channels.read` | 브리지 로그 조회 |

**Route 추가 요청 예시**

```json
{
  "source_platform": "slack",
  "source_channel": "C01ABC123DEF",
  "target_platform": "teams",
  "target_channel": "19:xxx@thread.tacv2",
  "is_bidirectional": true,
  "mode": "sender_info"
}
```

**채널 목록 응답 예시**

```json
{
  "channels": [
    {
      "id": "C01ABC123DEF",
      "name": "general",
      "type": "channel"
    }
  ]
}
```

---

### 메시지 히스토리 (`/api/messages`)

브리지를 통해 전달된 메시지의 검색, 조회, 내보내기, 삭제를 지원합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/messages/filters/options` | 인증 | 필터 옵션 조회 (게이트웨이, 채널, 상태 목록) |
| GET | `/api/messages/stats/summary` | 인증 | 메시지 통계 |
| POST | `/api/messages/test-data` | 권한: `messages.write` | 테스트 데이터 생성 |
| GET | `/api/messages` | 인증 | 메시지 검색 (페이징) |
| GET | `/api/messages/{message_id}` | 인증 | 메시지 상세 조회 |
| POST | `/api/messages/export/csv` | 인증 | CSV 내보내기 |
| POST | `/api/messages/export/json` | 인증 | JSON 내보내기 |
| DELETE | `/api/messages/{message_id}` | 권한: `messages.write` | 메시지 삭제 |
| DELETE | `/api/messages` | 권한: `messages.write` | 전체 메시지 삭제 |
| POST | `/api/messages/delete-by-filters` | 권한: `messages.write` | 필터 기반 삭제 |
| GET | `/api/messages/count-by-filters` | 권한: `messages.write` | 필터 기반 개수 조회 |

**메시지 검색 쿼리 파라미터**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `q` | string | 텍스트 검색 |
| `gateway` | string[] | Gateway 필터 (여러 개 가능) |
| `route` | string | Route 필터 (`src->dst` 형식) |
| `channel` | string[] | 채널 필터 |
| `src_channel` | string[] | 소스 채널 필터 |
| `dst_channel` | string[] | 대상 채널 필터 |
| `user` | string | 사용자 필터 |
| `status` | string | 상태 필터 (`sent`, `failed`, `retrying`, `pending`) |
| `from_date` | datetime | 시작 날짜 (ISO 8601) |
| `to_date` | datetime | 종료 날짜 (ISO 8601) |
| `page` | int | 페이지 번호 (기본: 1) |
| `per_page` | int | 페이지당 항목 수 (기본: 50, 최대: 100) |
| `sort` | string | 정렬 (`timestamp_asc`, `timestamp_desc`) |

**메시지 응답 예시**

```json
{
  "messages": [
    {
      "id": 1,
      "message_id": "msg_abc123",
      "text": "안녕하세요",
      "gateway": "slack->teams",
      "protocol": "slack",
      "source": {
        "account": "slack",
        "channel": "C01ABC123DEF",
        "channel_name": "general",
        "user": "U01XYZ",
        "user_name": "alice",
        "display_name": "Alice Kim"
      },
      "destination": {
        "account": "teams",
        "channel": "19:xxx@thread.tacv2",
        "channel_name": "General"
      },
      "timestamp": "2026-04-13T10:30:00Z",
      "status": "sent",
      "has_attachment": true,
      "attachment_count": 1,
      "attachment_details": [
        { "name": "screenshot.png", "type": "image/png", "size": 245760 }
      ],
      "delivered_at": "2026-04-13T10:30:02Z",
      "retry_count": 0
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 50,
  "total_pages": 3
}
```

---

### Provider 계정 관리 (`/api/accounts-db`)

Slack, Teams 등 외부 서비스의 연결 계정을 관리합니다. 자격 증명은 서버 측에서 암호화되어 저장됩니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/accounts-db/features/catalog` | 권한: `integrations.read` | 사용 가능한 기능 카탈로그 |
| GET | `/api/accounts-db` | 권한: `integrations.read` | 전체 계정 목록 |
| GET | `/api/accounts-db/{account_id}` | 권한: `integrations.read` | 계정 상세 조회 |
| POST | `/api/accounts-db` | 권한: `integrations.write` | 계정 생성 |
| PUT | `/api/accounts-db/{account_id}` | 권한: `integrations.write` | 계정 수정 |
| DELETE | `/api/accounts-db/{account_id}` | 권한: `integrations.write` | 계정 삭제 |
| POST | `/api/accounts-db/{account_id}/validate` | 권한: `integrations.write` | 자격증명 검증 |

---

### Teams 웹훅 (`/api/teams`)

Microsoft Teams Bot Framework 웹훅과 Graph API 변경 알림을 수신하는 엔드포인트입니다. 플랫폼 JWT 인증 대신 각각 고유한 인증 방식을 사용합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/teams/webhook` | Bot Framework JWT 인증 | Bot Framework 메시지 수신 |
| POST | `/api/teams/notifications` | Graph API 구독 검증 | Graph 변경 알림 수신 |

---

### 모니터링 (`/api/monitoring`)

v-channel-bridge 내부 서비스(Slack Provider, Teams Provider 등)의 헬스 상태를 조회합니다.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/monitoring/health` | 권한: `monitoring.read` | 전체 서비스 헬스 |
| GET | `/api/monitoring/health/{service_id}` | 권한: `monitoring.read` | 개별 서비스 헬스 |

---

## v-platform-portal 전용 API

포털 앱에서 사용하는 API입니다. 등록된 앱 목록 조회, 헬스 체크, 사이트맵, 앱 CRUD를 포함합니다.

### 포털 (`/api/portal`)

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/portal/apps` | 공개 | 활성 앱 목록 (포털 런처용) |
| GET | `/api/portal/health` | 공개 | 전체 앱 헬스 체크 |
| GET | `/api/portal/health/{app_id}` | 공개 | 특정 앱 헬스 체크 |
| GET | `/api/portal/sitemap` | 공개 | 전체 앱 사이트맵 (각 앱의 메뉴 통합) |
| GET | `/api/portal/apps/all` | 시스템 관리자 | 모든 앱 목록 (비활성 포함, 관리용) |
| POST | `/api/portal/apps` | 시스템 관리자 | 앱 등록 |
| PUT | `/api/portal/apps/{app_id}` | 시스템 관리자 | 앱 수정 |
| DELETE | `/api/portal/apps/{app_id}` | 시스템 관리자 | 앱 삭제 |

**앱 등록 요청 예시**

```json
{
  "app_id": "v-new-app",
  "display_name": "새 앱",
  "description": "새로운 서비스입니다.",
  "icon": "Box",
  "frontend_url": "http://127.0.0.1:5175",
  "api_url": "http://127.0.0.1:8003",
  "health_endpoint": "/api/health",
  "sort_order": 10,
  "is_active": true
}
```

**앱 목록 응답 예시**

```json
[
  {
    "id": 1,
    "app_id": "v-channel-bridge",
    "display_name": "Channel Bridge",
    "description": "Slack/Teams 메시지 브리지",
    "icon": "MessageSquare",
    "frontend_url": "http://127.0.0.1:5173",
    "api_url": "http://127.0.0.1:8000",
    "health_endpoint": "/api/health",
    "sort_order": 0,
    "is_active": true
  }
]
```

**헬스 체크 응답 예시**

```json
{
  "app_id": "v-channel-bridge",
  "status": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  },
  "response_time_ms": 42.5
}
```

---

## WebSocket 엔드포인트

실시간 상태 업데이트, 로그 스트리밍, 알림 수신을 위한 WebSocket 연결을 제공합니다.

### 연결

JWT 토큰을 쿼리 파라미터로 전달하여 연결합니다.

```javascript
const ws = new WebSocket('ws://127.0.0.1:8000/ws?token=<access_token>');
```

### WebSocket 정보 조회

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/ws/info` | 인증 | 사용 가능한 채널 목록 및 현재 연결 정보 |

### 채널 구독

연결 후 JSON 메시지로 채널을 구독/해제할 수 있습니다.

**구독 요청**

```json
{ "type": "subscribe", "channel": "status" }
```

**구독 해제**

```json
{ "type": "unsubscribe", "channel": "status" }
```

**Ping/Pong (30초 간격 Heartbeat)**

```json
{ "type": "ping" }
```

### 사용 가능한 채널

| 채널 | 설명 |
|------|------|
| `status` | Provider 연결 상태 변경 |
| `logs` | 실시간 로그 스트림 |
| `config` | 설정 변경 알림 |
| `notifications` | 시스템/앱 알림 |

### 수신 이벤트 예시

**연결 성공**

```json
{
  "type": "connection",
  "data": {
    "message": "Connected to WebSocket",
    "available_channels": ["status", "logs", "config", "notifications"]
  }
}
```

**상태 업데이트**

```json
{
  "type": "status_update",
  "channel": "status",
  "data": {
    "provider": "slack",
    "status": "connected",
    "timestamp": "2026-04-13T10:30:00Z"
  }
}
```

**알림 수신**

```json
{
  "type": "notification",
  "channel": "notifications",
  "data": {
    "severity": "info",
    "category": "system",
    "title": "시스템 알림",
    "message": "새로운 공지사항이 있습니다.",
    "source": "admin",
    "timestamp": "2026-04-13T10:30:00Z"
  }
}
```

---

## 마이그레이션/시드

### 데이터베이스 마이그레이션

v-platform은 순차 번호 기반 마이그레이션 파일(`p001` ~ `p024`)을 사용합니다. 앱 시작 시 자동으로 미적용 마이그레이션이 실행됩니다.

```
platform/backend/v_platform/migrations/
  p001_initial_tables.sql
  p002_add_audit_logs.sql
  ...
  p024_notification_app_overrides.sql
```

v-platform-portal은 별도 마이그레이션을 가집니다.

```
apps/v-platform-portal/backend/app/migrations/
```

### 시드 데이터

앱 시작 시 `PlatformApp.init_platform()` 메서드가 호출되며, 다음 항목이 자동 시드됩니다.

- 기본 관리자 계정 (admin@example.com / Admin123!)
- 기본 메뉴 항목 (built_in 타입)
- 기본 권한 그룹 (System Admin, Org Admin, User)
- 기본 시스템 설정
- 기본 시스템 알림

각 앱은 `app_menu_keys` 파라미터로 자신의 메뉴 키를 지정하여, 해당 앱에 맞는 메뉴만 활성화합니다.

---

## 예제

### cURL

```bash
# 로그인
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'

# 브리지 상태 조회
curl http://127.0.0.1:8000/api/bridge/status \
  -H "Authorization: Bearer <token>"

# 사용자 목록 (페이징 + 검색)
curl "http://127.0.0.1:8000/api/users?page=1&per_page=20&search=admin" \
  -H "Authorization: Bearer <token>"

# 메시지 검색
curl "http://127.0.0.1:8000/api/messages?q=hello&page=1&per_page=50" \
  -H "Authorization: Bearer <token>"

# 포털 앱 목록
curl http://127.0.0.1:8080/api/portal/apps
```

### Python

```python
import requests

BASE = "http://127.0.0.1:8000/api"

# 로그인
resp = requests.post(f"{BASE}/auth/login", json={
    "email": "admin@example.com",
    "password": "Admin123!",
})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 브리지 상태
status = requests.get(f"{BASE}/bridge/status", headers=headers).json()
print(f"Bridge status: {status}")

# Route 추가
requests.post(f"{BASE}/bridge/routes", headers=headers, json={
    "source_platform": "slack",
    "source_channel": "C01ABC123DEF",
    "target_platform": "teams",
    "target_channel": "19:xxx@thread.tacv2",
    "is_bidirectional": True,
    "mode": "sender_info",
})

# 감사 로그 통계
stats = requests.get(f"{BASE}/audit-logs/stats/summary?days=30", headers=headers).json()
print(f"Total logs (30d): {stats['total_logs']}")
```

### JavaScript (WebSocket)

```javascript
const token = "eyJhbGciOiJIUzI1NiIs...";
const ws = new WebSocket(`ws://127.0.0.1:8000/ws?token=${token}`);

ws.onopen = () => {
  console.log("WebSocket 연결됨");
  // 채널 구독
  ws.send(JSON.stringify({ type: "subscribe", channel: "status" }));
  ws.send(JSON.stringify({ type: "subscribe", channel: "notifications" }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case "status_update":
      console.log("상태 변경:", msg.data);
      break;
    case "notification":
      console.log("알림:", msg.data.title);
      break;
  }
};

// 30초마다 heartbeat
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ping" }));
  }
}, 30000);
```

---

**최종 업데이트**: 2026-04-13
