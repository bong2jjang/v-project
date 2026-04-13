---
id: api
title: v-project API 문서
sidebar_position: 99
tags: [api, reference]
---

# v-project API 문서

## 개요

v-project는 v-platform 기반 RESTful API와 WebSocket을 제공합니다. 18개 라우터로 브리지 제어, 메시지 관리, 인증, SSO, RBAC, 모니터링 등을 지원합니다.

- **Base URL**: `http://localhost:8000/api`
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 인증

대부분의 API는 JWT 토큰 기반 인증을 사용합니다.

### 토큰 획득

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin123!"
}
```

**응답:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "SYSTEM_ADMIN"
  }
}
```

### 인증 헤더

```
Authorization: Bearer <access_token>
```

---

## API 엔드포인트

### 1. 인증 (`/api/auth`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/auth/register` | 새 사용자 등록 | 공개 |
| POST | `/api/auth/login` | JWT 로그인 | 공개 |
| POST | `/api/auth/login/form` | Form 기반 로그인 | 공개 |
| GET | `/api/auth/me` | 현재 사용자 정보 | 인증 |
| POST | `/api/auth/refresh` | 토큰 갱신 | 인증 |
| POST | `/api/auth/logout` | 단일 디바이스 로그아웃 | 인증 |
| POST | `/api/auth/logout-all` | 전체 디바이스 로그아웃 | 인증 |
| GET | `/api/auth/devices` | 연결된 디바이스 목록 | 인증 |
| DELETE | `/api/auth/devices/\{device_id\}` | 디바이스 세션 제거 | 인증 |
| POST | `/api/auth/password-reset/request` | 비밀번호 재설정 요청 | 공개 |
| GET | `/api/auth/password-reset/verify` | 재설정 토큰 검증 | 공개 |
| POST | `/api/auth/password-reset/confirm` | 비밀번호 재설정 확인 | 공개 |

### 2. Microsoft OAuth (`/api/auth/microsoft`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/auth/microsoft/login` | OAuth2 로그인 시작 | 인증 |
| GET | `/api/auth/microsoft/callback` | OAuth2 콜백 | 공개 |
| POST | `/api/auth/microsoft/\{account_id\}/disconnect` | 위임 해제 | 관리자 |
| GET | `/api/auth/microsoft/\{account_id\}/status` | 위임 상태 확인 | 인증 |

### 3. 사용자 관리 (`/api/users`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/users` | 사용자 목록 | 관리자 |
| GET | `/api/users/me` | 내 프로필 | 인증 |
| PUT | `/api/users/me` | 프로필 수정 | 인증 |
| PUT | `/api/users/me/password` | 비밀번호 변경 | 인증 |
| GET | `/api/users/\{user_id\}` | 사용자 조회 | 관리자 |
| PUT | `/api/users/\{user_id\}` | 사용자 수정 | 관리자 |
| DELETE | `/api/users/\{user_id\}` | 사용자 삭제 | 관리자 |
| PUT | `/api/users/\{user_id\}/role` | 역할 변경 | 관리자 |

---

### 4. 브리지 제어 (`/api/bridge`)

브리지 상태, Provider 관리, Route CRUD를 담당합니다.

#### 브리지 상태

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/bridge/status` | 브리지 연결 상태 | 인증 |
| GET | `/api/bridge/providers` | 활성 Provider 목록 | 인증 |
| POST | `/api/bridge/start` | 브리지 시작 | 관리자 |
| POST | `/api/bridge/stop` | 브리지 중지 | 관리자 |
| POST | `/api/bridge/reload-providers` | Provider 설정 리로드 | 관리자 |
| GET | `/api/bridge/logs` | 브리지 로그 조회 | 인증 |

#### Route 관리

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/bridge/routes` | 전체 Route 목록 | 인증 |
| POST | `/api/bridge/routes` | Route 추가 | 관리자 |
| DELETE | `/api/bridge/routes` | Route 삭제 | 관리자 |
| PATCH | `/api/bridge/routes/toggle` | Route 활성화/비활성화 | 관리자 |

**Route 추가 요청 예시:**
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

#### 채널 조회

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/bridge/channels/\{platform\}` | 플랫폼 채널 목록 | 인증 |
| GET | `/api/bridge/channels/\{platform\}/validate/\{channel_id\}` | 채널 검증 | 인증 |

**채널 목록 응답 예시:**
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

### 5. 메시지 히스토리 (`/api/messages`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/messages` | 메시지 검색 (페이징) | 인증 |
| GET | `/api/messages/\{message_id\}` | 메시지 상세 조회 | 인증 |
| GET | `/api/messages/filters/options` | 필터 옵션 조회 | 인증 |
| GET | `/api/messages/stats/summary` | 메시지 통계 | 인증 |
| POST | `/api/messages/export/csv` | CSV 내보내기 | 인증 |
| POST | `/api/messages/export/json` | JSON 내보내기 | 인증 |
| POST | `/api/messages/test-data` | 테스트 데이터 생성 | 관리자 |
| DELETE | `/api/messages/\{message_id\}` | 메시지 삭제 | 관리자 |
| DELETE | `/api/messages` | 전체 메시지 삭제 | 관리자 |
| POST | `/api/messages/delete-by-filters` | 필터 기반 삭제 | 관리자 |
| GET | `/api/messages/count-by-filters` | 필터 기반 개수 조회 | 관리자 |

**메시지 검색 쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `q` | string | 텍스트 검색 |
| `gateway` | string[] | Gateway 필터 (여러 개 가능) |
| `route` | string | Route 필터 (`src→dst` 형식) |
| `channel` | string[] | 채널 필터 |
| `src_channel` | string[] | 소스 채널 필터 |
| `dst_channel` | string[] | 대상 채널 필터 |
| `user` | string | 사용자 필터 |
| `status` | string | 상태 필터 (sent, failed, retrying, pending) |
| `from_date` | datetime | 시작 날짜 (ISO 8601) |
| `to_date` | datetime | 종료 날짜 (ISO 8601) |
| `page` | int | 페이지 번호 (기본: 1) |
| `per_page` | int | 페이지당 항목 수 (기본: 50, 최대: 100) |
| `sort` | string | 정렬 (timestamp_asc, timestamp_desc) |

**메시지 응답 예시:**
```json
{
  "messages": [
    {
      "id": 1,
      "message_id": "msg_abc123",
      "text": "안녕하세요",
      "gateway": "slack→teams",
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
      "timestamp": "2026-04-07T10:30:00Z",
      "status": "sent",
      "has_attachment": true,
      "attachment_count": 1,
      "attachment_details": [
        {
          "name": "screenshot.png",
          "type": "image/png",
          "size": 245760
        }
      ],
      "delivered_at": "2026-04-07T10:30:02Z",
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

### 6. Provider 계정 관리 (`/api/accounts-db`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/accounts-db` | 전체 계정 목록 | 관리자 |
| GET | `/api/accounts-db/\{account_id\}` | 계정 상세 조회 | 관리자 |
| POST | `/api/accounts-db` | 계정 생성 | 관리자 |
| PUT | `/api/accounts-db/\{account_id\}` | 계정 수정 | 관리자 |
| DELETE | `/api/accounts-db/\{account_id\}` | 계정 삭제 | 관리자 |
| POST | `/api/accounts-db/\{account_id\}/validate` | 자격증명 검증 | 관리자 |
| POST | `/api/accounts-db/\{account_id\}/test` | 연결 테스트 | 관리자 |
| GET | `/api/accounts-db/features/catalog` | 사용 가능 기능 목록 | 관리자 |

---

### 7. 감사 로그 (`/api/audit-logs`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/audit-logs` | 감사 로그 목록 | 관리자 |
| GET | `/api/audit-logs/\{log_id\}` | 감사 로그 상세 | 관리자 |
| GET | `/api/audit-logs/stats/summary` | 감사 통계 | 관리자 |
| GET | `/api/audit-logs/export/csv` | CSV 내보내기 | 관리자 |

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `user_id` | int | 사용자 필터 |
| `action` | string | 작업 필터 (create, update, delete, login 등) |
| `resource_type` | string | 리소스 필터 (route, account, user 등) |
| `from_date` | datetime | 시작 날짜 |
| `to_date` | datetime | 종료 날짜 |
| `page` | int | 페이지 번호 |
| `per_page` | int | 페이지당 항목 수 |

---

### 8. 시스템 설정 (`/api/system-settings`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/system-settings/` | 시스템 설정 조회 | 관리자 |
| PUT | `/api/system-settings/` | 시스템 설정 수정 | 관리자 |

---

### 9. 모니터링 (`/api/monitoring`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/monitoring/health` | 전체 시스템 헬스 | 인증 |
| GET | `/api/monitoring/health/\{service_id\}` | 개별 서비스 헬스 | 인증 |

---

### 10. 헬스체크

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/health` | 기본 헬스체크 | 공개 |
| GET | `/api/status` | 전체 상태 리포트 | 공개 |

**응답 예시:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-07T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "slack_provider": "connected",
    "teams_provider": "connected"
  }
}
```

---

### 11. 알림 (`/api/notifications`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/notifications/test` | 테스트 알림 발송 | 관리자 |
| POST | `/api/notifications/send` | 알림 발송 | 관리자 |
| POST | `/api/notifications/test/all-types` | 전체 타입 테스트 | 관리자 |

---

### 12. Teams Webhook (`/api/teams`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/teams/webhook` | Bot Framework webhook 수신 | 공개 (Bot 인증) |
| POST | `/api/teams/notifications` | Graph 변경 알림 수신 | 공개 (구독 인증) |

---

### 13. Prometheus 메트릭

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/metrics` | Prometheus 메트릭 | 공개 |

---

### 14. SSO 인증 (`/api/auth/sso`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/auth/sso/providers` | 사용 가능 SSO Provider 목록 | 공개 |
| GET | `/api/auth/sso/login/\{provider\}` | SSO 로그인 시작 (리다이렉트) | 공개 |
| GET | `/api/auth/sso/callback/\{provider\}` | SSO 콜백 처리 | 공개 |
| GET | `/api/auth/sso/settings` | SSO 설정 조회 | 관리자 |
| PUT | `/api/auth/sso/settings` | SSO 설정 수정 | 관리자 |

**지원 Provider**: `microsoft` (Microsoft Entra ID), `oidc` (Generic OIDC)

---

### 15. 권한 관리 (`/api/permissions`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/permissions` | 전체 권한 목록 | 관리자 |
| GET | `/api/permissions/\{user_id\}` | 사용자 권한 조회 | 관리자 |
| PUT | `/api/permissions/\{user_id\}` | 사용자 권한 수정 | 관리자 |
| GET | `/api/permissions/me` | 내 유효 권한 조회 | 인증 |

**권한 체계**: 유효 권한 = MAX(권한 그룹 부여, 개인 오버라이드)

---

### 16. 권한 그룹 (`/api/permission-groups`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/permission-groups` | 권한 그룹 목록 | 관리자 |
| POST | `/api/permission-groups` | 권한 그룹 생성 | 관리자 |
| GET | `/api/permission-groups/\{group_id\}` | 그룹 상세 조회 | 관리자 |
| PUT | `/api/permission-groups/\{group_id\}` | 그룹 수정 | 관리자 |
| DELETE | `/api/permission-groups/\{group_id\}` | 그룹 삭제 | 관리자 |

---

### 17. 커스텀 메뉴 (`/api/menus`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/menus` | 메뉴 항목 목록 | 인증 |
| GET | `/api/menus/sidebar` | 사이드바 메뉴 (RBAC 필터링) | 인증 |
| POST | `/api/menus` | 메뉴 항목 생성 | 관리자 |
| PUT | `/api/menus/\{menu_id\}` | 메뉴 항목 수정 | 관리자 |
| DELETE | `/api/menus/\{menu_id\}` | 메뉴 항목 삭제 | 관리자 |
| PUT | `/api/menus/reorder` | 메뉴 순서 변경 | 관리자 |

**메뉴 타입**: `built_in`, `custom_iframe`, `custom_link`, `menu_group`
**섹션**: `basic`, `admin`, `custom`

---

### 18. 조직 관리 (`/api/organizations`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/organizations/companies` | 회사 목록 | 관리자 |
| POST | `/api/organizations/companies` | 회사 생성 | 관리자 |
| PUT | `/api/organizations/companies/\{id\}` | 회사 수정 | 관리자 |
| DELETE | `/api/organizations/companies/\{id\}` | 회사 삭제 | 관리자 |
| GET | `/api/organizations/departments` | 부서 목록 | 관리자 |
| POST | `/api/organizations/departments` | 부서 생성 | 관리자 |
| PUT | `/api/organizations/departments/\{id\}` | 부서 수정 | 관리자 |
| DELETE | `/api/organizations/departments/\{id\}` | 부서 삭제 | 관리자 |

---

### 19. 사용자 OAuth 토큰 (`/api/users/me/oauth`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/users/me/oauth/tokens` | 내 OAuth 토큰 목록 | 인증 |
| DELETE | `/api/users/me/oauth/tokens/\{token_id\}` | OAuth 토큰 삭제 | 인증 |
| GET | `/api/users/\{user_id\}/oauth/tokens` | 사용자 OAuth 토큰 (관리) | 관리자 |

---

## WebSocket API

### 연결

```javascript
const ws = new WebSocket('ws://localhost:8000/api/ws?token=<access_token>');
```

### WebSocket 정보

```
GET /api/ws/info
```

### 이벤트 타입

| 이벤트 | 설명 |
|--------|------|
| `connection` | 연결 성공 |
| `status_update` | Provider 상태 변경 |
| `message_created` | 새 메시지 브리지 |
| `route_update` | Route 변경 |
| `ping` / `pong` | Heartbeat (30초 간격) |

---

## 오류 응답

모든 API는 표준 HTTP 상태 코드를 사용합니다.

| 상태 코드 | 설명 | 예시 |
|-----------|------|------|
| 400 | Bad Request | `{"detail": "Invalid request parameters"}` |
| 401 | Unauthorized | `{"detail": "Not authenticated"}` |
| 403 | Forbidden | `{"detail": "Insufficient permissions"}` |
| 404 | Not Found | `{"detail": "Resource not found"}` |
| 500 | Internal Server Error | `{"detail": "Internal server error"}` |

---

## 예제

### cURL

```bash
# 로그인
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# 브리지 상태 조회
curl http://localhost:8000/api/bridge/status \
  -H "Authorization: Bearer <token>"

# Route 목록 조회
curl http://localhost:8000/api/bridge/routes \
  -H "Authorization: Bearer <token>"

# 메시지 검색
curl "http://localhost:8000/api/messages?q=hello&page=1&per_page=50" \
  -H "Authorization: Bearer <token>"

# Slack 채널 목록
curl http://localhost:8000/api/bridge/channels/slack \
  -H "Authorization: Bearer <token>"
```

### Python

```python
import requests

BASE = "http://localhost:8000/api"

# 로그인
resp = requests.post(f"{BASE}/auth/login",
    json={"username": "admin", "password": "Admin123!"})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 브리지 상태
status = requests.get(f"{BASE}/bridge/status", headers=headers).json()

# Route 추가
requests.post(f"{BASE}/bridge/routes", headers=headers, json={
    "source_platform": "slack",
    "source_channel": "C01ABC123DEF",
    "target_platform": "teams",
    "target_channel": "19:xxx@thread.tacv2",
    "is_bidirectional": True,
})
```

---

## 추가 리소스

- **Swagger UI**: `http://localhost:8000/docs` — 인터랙티브 API 문서
- **ReDoc**: `http://localhost:8000/redoc` — 상세 API 레퍼런스

---

**최종 업데이트**: 2026-04-10
**API 버전**: Light-Zowe 3.1
