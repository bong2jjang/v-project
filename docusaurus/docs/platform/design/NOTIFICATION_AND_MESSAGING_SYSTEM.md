# 알림 및 메시징 시스템 설계

> scope 기반 알림 전달, 3가지 delivery_type, WebSocket 실시간 브로드캐스트, 앱별 시스템 알림 오버라이드

---

## 1. 개요

v-platform의 알림 시스템은 **영속 알림**(DB 저장)과 **실시간 알림**(WebSocket 브로드캐스트)을 통합한다. 4단계 scope로 대상을 지정하고, 3가지 delivery_type으로 전달 방식을 제어하며, 앱별로 시스템 알림을 독립적으로 활성/비활성화한다.

### 핵심 특성

| 항목 | 설명 |
|------|------|
| scope | global / app / role / user |
| delivery_type | toast / announcement / both |
| 시스템 알림 | `is_system=True`, 삭제 불가, 앱별 override 가능 |
| 커스텀 알림 | 관리자가 생성, 앱별 `app_id` 자동 바인딩 |
| 실시간 전달 | WebSocket `notifications` 채널 브로드캐스트 |
| 읽음 추적 | `notification_reads` 테이블, 사용자별 독립 관리 |

---

## 2. 데이터 모델

### 2.1 Notification (notifications 테이블)

```
+------------------+------------------+----------------------------------------+
| 컬럼             | 타입             | 설명                                   |
+------------------+------------------+----------------------------------------+
| id               | Integer PK       | 자동 증가                              |
| title            | String(200)      | 알림 제목                              |
| message          | Text             | 알림 본문                              |
| severity         | String(20)       | critical/error/warning/info/success    |
| category         | String(50)       | system/service/message/config/user     |
| scope            | String(20)       | global/app/role/user                   |
| app_id           | String(50)       | NULL=global, 값=앱별                   |
| target_role      | String(50)       | scope=role일 때 대상 역할              |
| target_user_id   | Integer FK       | scope=user일 때 대상 사용자            |
| source           | String(100)      | 발생 원천 (admin, system 등)           |
| link             | String(500)      | 관련 페이지 링크                       |
| metadata         | JSON             | 추가 컨텍스트 데이터                   |
| is_active        | Boolean          | 활성 여부                              |
| is_system        | Boolean          | 시스템 기본 알림 여부 (삭제 불가)       |
| delivery_type    | String(20)       | toast/announcement/both                |
| expires_at       | DateTime         | 만료 시각 (NULL=무기한)                |
| created_by       | Integer FK       | 생성자 (users.id)                      |
| created_at       | DateTime         | 생성 시각                              |
+------------------+------------------+----------------------------------------+

인덱스:
  idx_notifications_scope_app      (scope, app_id)
  idx_notifications_active_created (is_active, created_at)
```

### 2.2 NotificationAppOverride (notification_app_overrides 테이블)

시스템 알림(`is_system=True`)의 활성/비활성 상태를 앱별로 독립 관리한다.

```
+------------------+------------------+----------------------------------------+
| 컬럼             | 타입             | 설명                                   |
+------------------+------------------+----------------------------------------+
| id               | Integer PK       | 자동 증가                              |
| notification_id  | Integer FK       | notifications.id (CASCADE)             |
| app_id           | String(50)       | 앱 식별자                              |
| is_active        | Boolean          | 해당 앱에서의 활성 여부                |
| updated_at       | DateTime         | 수정 시각                              |
+------------------+------------------+----------------------------------------+

UNIQUE: (notification_id, app_id)
```

### 2.3 NotificationRead (notification_reads 테이블)

사용자별 읽음 상태를 추적한다.

```
+------------------+------------------+----------------------------------------+
| 컬럼             | 타입             | 설명                                   |
+------------------+------------------+----------------------------------------+
| id               | Integer PK       | 자동 증가                              |
| notification_id  | Integer FK       | notifications.id (CASCADE)             |
| user_id          | Integer FK       | users.id (CASCADE)                     |
| read_at          | DateTime         | 읽은 시각                              |
+------------------+------------------+----------------------------------------+

UNIQUE: (notification_id, user_id)
```

---

## 3. Scope 계층

알림은 4단계 scope로 전달 범위를 지정한다.

```
+--------+   global: 전 앱 전 사용자
|        |
+--------+
    |
+--------+   app: 특정 앱 사용자 (app_id 매칭)
|        |
+--------+
    |
+--------+   role: 특정 역할 사용자 (target_role 매칭)
|        |
+--------+
    |
+--------+   user: 특정 사용자 (target_user_id 매칭)
|        |
+--------+
```

### 3.1 Scope별 필터 규칙

| scope | 조건 | app_id | target_role | target_user_id |
|-------|------|--------|-------------|----------------|
| global | 전 앱 전 사용자 | NULL | - | - |
| app | `app_id == 현재 앱` | 필수 | - | - |
| role | `target_role == 사용자 역할` + `app_id == 현재 앱` | 필수 | 필수 | - |
| user | `target_user_id == 사용자 ID` + `app_id == 현재 앱` | 필수 | - | 필수 |

### 3.2 시스템 알림의 특수 scope 동작

시스템 알림(`is_system=True`)은 커스텀 알림과 다르게 동작한다:

| scope | 시스템 알림 동작 |
|-------|-----------------|
| global | 전 사용자에게 전달 (커스텀과 동일) |
| role | `target_role`이 NULL -- system_admin, org_admin에게만 전달 |
| user | `target_user_id`가 NULL -- 전 사용자에게 전달 (본인 알림 용도) |

### 3.3 Scope 필터 생성 코드

`PersistentNotificationService._build_scope_filter()`가 이 규칙을 구현한다:

```python
conditions = [
    Notification.scope == "global",
    and_(Notification.scope == "app", Notification.app_id == app_id),
    # 커스텀 role: target_role 정확히 매칭
    and_(
        Notification.scope == "role",
        Notification.is_system.is_(False),
        Notification.target_role == user_role,
        Notification.app_id == app_id,
    ),
    # 커스텀 user: target_user_id 정확히 매칭
    and_(
        Notification.scope == "user",
        Notification.is_system.is_(False),
        Notification.target_user_id == user_id,
        Notification.app_id == app_id,
    ),
    # 시스템 user: 모든 사용자에게
    and_(Notification.scope == "user", Notification.is_system.is_(True)),
]
# 시스템 role: system_admin, org_admin에게만
if user_role in ("system_admin", "org_admin"):
    conditions.append(
        and_(Notification.scope == "role", Notification.is_system.is_(True))
    )
```

---

## 4. Delivery Type

알림의 전달 방식을 3가지로 구분한다.

| delivery_type | 용도 | WebSocket | DB 저장 | UI 표시 |
|---------------|------|-----------|---------|---------|
| `toast` | 즉시 알림 | O | O | 토스트 팝업 |
| `announcement` | 공지사항 | X | O | 로그인 시 팝업 |
| `both` | 즉시 + 공지 | O | O | 토스트 + 팝업 |

### 4.1 WebSocket 브로드캐스트 조건

알림 생성 시 `delivery_type`이 `toast` 또는 `both`인 경우에만 WebSocket으로 실시간 전달한다:

```python
if data.delivery_type in ("toast", "both"):
    ws_notif = NotificationService.create_notification(
        severity=data.severity,
        category=data.category,
        title=data.title,
        message=data.message,
        source="admin",
        link=data.link,
        persistent=True,
    )
    ws_notif["persistent_id"] = notif.id
    await NotificationService.broadcast_notification(ws_notif)
```

### 4.2 공지사항 팝업

`announcement` 또는 `both` 타입의 미읽은 알림은 `GET /api/notifications-v2/announcements` 엔드포인트로 조회한다. 프론트엔드는 로그인 후 이 엔드포인트를 호출하여 미읽은 공지를 팝업으로 표시한다.

---

## 5. 시스템 알림과 앱별 오버라이드

### 5.1 시스템 알림 특성

| 속성 | 값 |
|------|-----|
| `is_system` | `True` |
| 생성 | 마이그레이션/시드 데이터로 생성 |
| 삭제 | 불가 (API에서 403 반환) |
| 수정 | `is_active` 토글만 가능 (앱별 override) |
| 범위 | 앱별 독립적 활성/비활성 |

### 5.2 앱별 Override 메커니즘

시스템 알림의 `is_active`를 토글하면, 원본 알림의 값은 변경하지 않고 `notification_app_overrides` 테이블에 앱별 레코드를 생성/갱신한다.

```
시스템 알림 (is_active=True)
  |
  +-- v-channel-bridge:   override 없음 -> True (원본)
  +-- v-platform-template: override(is_active=False) -> False
  +-- v-platform-portal:  override(is_active=True) -> True
```

### 5.3 Override 생성 (upsert)

```python
def set_app_override(db, notification_id, app_id, is_active):
    override = db.query(NotificationAppOverride).filter(
        NotificationAppOverride.notification_id == notification_id,
        NotificationAppOverride.app_id == app_id,
    ).first()
    if override:
        override.is_active = is_active    # 기존 레코드 갱신
    else:
        override = NotificationAppOverride(
            notification_id=notification_id,
            app_id=app_id,
            is_active=is_active,
        )
        db.add(override)                  # 신규 레코드 생성
    db.commit()
```

### 5.4 조회 시 비활성 알림 제외

사용자 뷰에서는 앱별로 비활성화된 시스템 알림을 제외한다:

```python
disabled_ids = _get_disabled_system_ids(db, app_id)
if disabled_ids:
    query = query.filter(~Notification.id.in_(disabled_ids))
```

### 5.5 관리자 뷰

관리자 뷰(`admin_view=true`)에서는 시스템 알림 + 해당 앱의 커스텀 알림을 모두 표시한다. 시스템 알림의 `is_active`는 `app_overrides` 맵에서 해당 앱의 값을 반영한다.

---

## 6. API 엔드포인트

### 6.1 Persistent Notifications API (`/api/notifications-v2`)

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/notifications-v2` | 알림 목록 | 인증 사용자 |
| POST | `/api/notifications-v2` | 알림 생성 | 인증 사용자 |
| PUT | `/api/notifications-v2/{id}` | 알림 수정 | 인증 사용자 |
| POST | `/api/notifications-v2/{id}/read` | 읽음 처리 | 인증 사용자 |
| POST | `/api/notifications-v2/read-all` | 전체 읽음 | 인증 사용자 |
| GET | `/api/notifications-v2/system-status` | 시스템 알림 상태 | 인증 사용자 |
| GET | `/api/notifications-v2/announcements` | 미읽은 공지 | 인증 사용자 |
| DELETE | `/api/notifications-v2/{id}` | 알림 삭제 | 인증 사용자 |

### 6.2 목록 조회 파라미터

```
GET /api/notifications-v2?limit=50&offset=0&unread_only=false&admin_view=false
```

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `limit` | 50 | 최대 100 |
| `offset` | 0 | 페이지네이션 |
| `unread_only` | false | 미읽은 알림만 |
| `admin_view` | false | true: 시스템+앱 전체 알림 / false: scope 기반 필터 |

### 6.3 알림 생성 스키마

```python
class NotificationCreate(BaseModel):
    title: str                                    # 최대 200자
    message: str
    severity: str = "info"                        # critical|error|warning|info|success
    category: str = "system"
    scope: str = "app"                            # global|app|role|user
    target_role: Optional[str] = None             # scope=role 필수
    target_user_id: Optional[int] = None          # scope=user 필수
    link: Optional[str] = None
    expires_at: Optional[datetime] = None
    delivery_type: str = "toast"                  # toast|announcement|both
```

### 6.4 생성 시 유효성 검사

| 조건 | 에러 |
|------|------|
| `scope == "global"` | 400: 커스텀 알림은 global 불가 |
| `scope == "role"` + `target_role` 없음 | 400: 대상 역할 필수 |
| `scope == "user"` + `target_user_id` 없음 | 400: 대상 사용자 ID 필수 |

커스텀 알림은 `global` scope를 사용할 수 없다. global scope는 시스템 알림(마이그레이션 시드)에서만 사용한다.

### 6.5 삭제 규칙

| 알림 유형 | 삭제 가능 | 응답 |
|-----------|-----------|------|
| 커스텀 | O | `{"status": "deleted"}` |
| 시스템 | X | 403: "시스템 기본 알림은 삭제할 수 없습니다. 비활성화만 가능합니다." |

---

## 7. WebSocket 실시간 알림

### 7.1 NotificationService

`NotificationService`는 WebSocket 기반 실시간 알림 생성/브로드캐스트를 담당한다.

```python
class NotificationService:
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    SUCCESS = "success"

    @staticmethod
    def create_notification(severity, category, title, message, source, ...):
        return {
            "id": f"notif_{uuid4().hex[:12]}",
            "timestamp": datetime.now(UTC).isoformat(),
            "severity": severity,
            "title": title,
            "message": message,
            ...
        }

    @staticmethod
    async def broadcast_notification(notification):
        await manager.broadcast(
            {"type": "notification", "data": notification},
            channel="notifications",
        )
```

### 7.2 편의 메서드

서비스 코드에서 간편하게 알림을 전송할 수 있는 정적 메서드:

| 메서드 | severity | 기본 category |
|--------|----------|---------------|
| `notify_success()` | success | service |
| `notify_error()` | error | service |
| `notify_warning()` | warning | service |
| `notify_info()` | info | system |
| `notify_critical()` | critical | service |

### 7.3 영속 알림과 실시간 알림의 연결

영속 알림 생성 시 WebSocket으로도 브로드캐스트하면, 실시간 알림 데이터에 `persistent_id` 필드를 추가하여 프론트엔드에서 영속 알림과 연결한다:

```python
ws_notif["persistent_id"] = notif.id
await NotificationService.broadcast_notification(ws_notif)
```

---

## 8. app_id 자동 바인딩

모든 알림 API에서 `app_id`는 `request.app.state.app_id`에서 자동으로 가져온다.

```python
app_id = getattr(request.app.state, "app_id", None)
```

`PlatformApp` 생성 시 `self.fastapi.state.app_id = app_name`으로 설정되므로:

| 앱 | app_id |
|----|--------|
| v-channel-bridge | `"v-channel-bridge"` |
| v-platform-template | `"v-platform-template"` |
| v-platform-portal | `"v-platform-portal"` |

커스텀 알림 생성 시 이 `app_id`가 자동으로 알림에 바인딩된다. global scope 알림은 `app_id = NULL`로 저장된다.

---

## 9. 알림 응답 구조

```python
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    severity: str                        # critical|error|warning|info|success
    category: str
    scope: str                           # global|app|role|user
    app_id: Optional[str] = None
    target_role: Optional[str] = None
    target_user_id: Optional[int] = None
    source: Optional[str] = None
    link: Optional[str] = None
    is_active: bool
    is_system: bool = False
    delivery_type: str = "toast"
    expires_at: Optional[str] = None
    created_by: Optional[int] = None
    created_at: str
    is_read: bool = False                # 현재 사용자 기준
```

### 9.1 목록 응답 래퍼

```python
class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int
```

---

## 10. 알림 수명 주기

### 10.1 생성 흐름

```
관리자 UI
  |
  v
POST /api/notifications-v2
  |
  +-- PersistentNotificationService.create()  --> DB 저장
  |
  +-- delivery_type in ("toast", "both")?
        |
        +-- Yes --> NotificationService.broadcast_notification()
        |              --> WebSocket manager.broadcast()
        |                     --> 프론트엔드 토스트
        +-- No  --> (DB에만 저장, 공지사항으로만 표시)
```

### 10.2 조회 흐름

```
프론트엔드
  |
  v
GET /api/notifications-v2
  |
  +-- admin_view=true?
  |     |
  |     +-- Yes --> list_all(db, app_id) -- 시스템+앱 전체
  |     +-- No  --> list_for_user(db, user_id, role, app_id)
  |                    |
  |                    +-- scope 필터 적용
  |                    +-- 앱별 비활성 시스템 알림 제외
  |                    +-- 만료된 알림 제외
  v
NotificationListResponse
```

### 10.3 읽음 처리

```
POST /api/notifications-v2/{id}/read
  |
  +-- notification_reads 테이블에 (notification_id, user_id) 삽입
  +-- 이미 읽음이면 무시 (UNIQUE 제약)

POST /api/notifications-v2/read-all
  |
  +-- scope 필터로 접근 가능한 알림 조회
  +-- 읽지 않은 알림에 대해 일괄 read 레코드 생성
```

---

## 11. severity 수준

| severity | 용도 | UI 색상 (일반적) |
|----------|------|-----------------|
| `critical` | 긴급 장애, 보안 사고 | 빨강 |
| `error` | 오류 발생 | 빨강 |
| `warning` | 주의 필요 | 노랑 |
| `info` | 정보 안내 | 파랑 |
| `success` | 작업 완료 | 초록 |

---

## 12. 만료 처리

`expires_at` 필드가 설정된 알림은 만료 시각이 지나면 조회에서 자동으로 제외된다:

```python
base_filter = and_(
    Notification.is_active.is_(True),
    or_(Notification.expires_at.is_(None), Notification.expires_at > now),
)
```

만료된 알림은 DB에서 삭제되지 않고 필터링으로만 제외된다. 필요 시 관리자가 수동으로 삭제한다.

---

## 13. 프론트엔드 통합

### 13.1 알림 스토어 (notification.ts)

Zustand 기반 알림 스토어가 실시간 알림 상태를 관리한다.

### 13.2 useNotifications 훅

알림 목록 조회, 읽음 처리, 미읽은 수 카운트를 제공한다.

### 13.3 WebSocket 연결

`useWebSocket` 훅이 `/api/ws` WebSocket 엔드포인트에 연결하여 `notifications` 채널의 메시지를 수신한다. `type: "notification"` 메시지를 받으면 토스트를 표시하고 알림 목록을 갱신한다.

### 13.4 공지사항 팝업

로그인 후 `GET /api/notifications-v2/announcements`를 호출하여 미읽은 `announcement`/`both` 알림을 팝업으로 표시한다. 사용자가 확인하면 `POST /api/notifications-v2/{id}/read`로 읽음 처리한다.

---

## 14. 관련 문서

- [멀티 앱 데이터 격리](./MULTI_APP_DATA_ISOLATION.md) -- app_id 기반 알림 격리
- [플랫폼/앱 분리 아키텍처](./PLATFORM_APP_SEPARATION_ARCHITECTURE.md) -- PlatformApp 구조
- [v-platform-portal 설계](./V_PLATFORM_PORTAL_DESIGN.md) -- 포털 알림 관리
