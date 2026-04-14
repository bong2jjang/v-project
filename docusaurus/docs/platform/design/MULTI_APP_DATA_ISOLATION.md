# 멀티앱 데이터 격리 설계

> **문서 버전**: 2.0  
> **최종 업데이트**: 2026-04-13  
> **범위**: app_id 기반 데이터 분리 전략, 테이블별 격리 규칙, 쿼리 패턴, 마이그레이션 이력

---

## 1. 개요

v-project의 모든 앱(v-channel-bridge, v-platform-template, v-platform-portal)은 **동일한 PostgreSQL 데이터베이스**를 공유합니다. 사용자 계정과 조직 구조는 전 앱 공통이지만, 메뉴/감사로그/설정/알림/권한은 앱별로 격리됩니다.

### 1.1 핵심 원칙

```
같은 DB, 같은 사용자, 다른 메뉴, 다른 설정
```

사용자 A가 v-channel-bridge에 로그인하면 브리지 전용 메뉴(채널 관리, 메시지 히스토리 등)를 보고, v-platform-template에 로그인하면 플랫폼 공통 메뉴만 봅니다. 감사 로그는 어느 앱에서 발생했는지 자동으로 기록되고, 시스템 설정은 앱별로 오버라이드할 수 있습니다.

### 1.2 격리 메커니즘

모든 격리는 `app_id` 컬럼 하나로 동작합니다.

```
app_id = NULL         --> 플랫폼 공통 (모든 앱에 적용)
app_id = 'v-channel-bridge'  --> 해당 앱에서만 유효
app_id = 'v-platform-portal' --> 해당 앱에서만 유효
```

---

## 2. 데이터 분류

### 2.1 플랫폼 공유 테이블 (모든 앱 동일)

이 테이블들은 `app_id` 컬럼이 없습니다. 전 앱에서 동일한 데이터를 공유합니다.

| 테이블 | 모델 | 용도 |
|--------|------|------|
| `users` | `User` | 사용자 계정 -- 같은 이메일/비밀번호로 모든 앱 접속 |
| `user_group_memberships` | `UserGroupMembership` | 사용자 ↔ 권한 그룹 매핑 |
| `companies` | `Company` | 회사 조직 |
| `departments` | `Department` | 부서 조직 |
| `password_reset_tokens` | `PasswordResetToken` | 비밀번호 재설정 토큰 |

### 2.2 app_id로 격리된 테이블

이 테이블들은 `app_id VARCHAR(50)` 컬럼을 가지며, NULL이면 전역(모든 앱)에 적용됩니다.

| 테이블 | 모델 | NULL 의미 | 값이 있을 때 |
|--------|------|-----------|-------------|
| `menu_items` | `MenuItem` | 플랫폼 공통 메뉴 (대시보드, 사용자 관리 등) | 해당 앱 전용 메뉴 |
| `audit_logs` | `AuditLog` | 플랫폼 공통 이벤트 | 해당 앱에서 발생한 이벤트 |
| `system_settings` | `SystemSettings` | 전역 설정 | 앱별 설정 오버라이드 |
| `notifications` | `Notification` | 전역 알림 (scope=global) | 해당 앱 대상 알림 |
| `notification_app_overrides` | `NotificationAppOverride` | (해당 없음) | 앱별 시스템 알림 활성/비활성 |
| `permission_groups` | `PermissionGroup` | 플랫폼 공통 권한 그룹 | 앱 전용 권한 그룹 |
| `refresh_tokens` | `RefreshToken` | (해당 없음) | 토큰 발급 앱 기록 |

### 2.3 앱 전용 테이블 (특정 앱만 사용)

플랫폼이 아닌 앱이 자체적으로 생성하고 관리하는 테이블입니다.

| 테이블 | 소유 앱 | 설명 |
|--------|---------|------|
| `accounts` | v-channel-bridge | Slack/Teams 자격증명 |
| `messages` | v-channel-bridge | 메시지 이력 |
| `message_stats` | v-channel-bridge | 메시지 통계 |
| `user_oauth_tokens` | v-platform (공통) | 사용자별 OAuth 토큰 |
| `portal_apps` | v-platform-portal | 포털 앱 레지스트리 |

---

## 3. app_id 주입 메커니즘

### 3.1 PlatformApp의 app_id 설정

`PlatformApp` 생성 시 `app_name` 파라미터가 `request.app.state.app_id`로 저장됩니다. 이후 모든 API 핸들러에서 이 값을 참조합니다.

```python
# v_platform/app.py
class PlatformApp:
    def __init__(self, app_name: str, ...):
        self.fastapi = FastAPI(...)
        self.fastapi.state.app_id = app_name  # 모든 request에서 접근 가능
```

### 3.2 앱에서의 사용

```python
# apps/v-channel-bridge/backend/app/main.py
platform = PlatformApp(
    app_name="v-channel-bridge",
    app_menu_keys=["channels", "messages", "statistics",
                   "integrations", "monitoring"],
)

# apps/v-platform-portal/backend/app/main.py
platform = PlatformApp(
    app_name="v-platform-portal",
)
```

### 3.3 API 핸들러에서 app_id 읽기

```python
# 모든 API 엔드포인트에서 동일한 패턴
app_id = request.app.state.app_id  # "v-channel-bridge"
```

---

## 4. 메뉴 격리

### 4.1 menu_items 테이블 구조

```
menu_items
+----+------------------+-----------+--------+------------+-----------+
| id | permission_key   | label     | section| app_id     | is_active |
+----+------------------+-----------+--------+------------+-----------+
|  1 | dashboard        | 대시보드   | basic  | NULL       | true      |
|  2 | users            | 사용자 관리| admin  | NULL       | true      |
|  3 | audit_logs       | 감사 로그  | admin  | NULL       | true      |
|  4 | settings         | 설정      | basic  | NULL       | true      |
|  5 | channels         | 채널 관리  | basic  | v-channel- | true      |
|    |                  |           |        | bridge     |           |
|  6 | messages         | 메시지    | basic  | v-channel- | true      |
|    |                  | 히스토리   |        | bridge     |           |
|  7 | statistics       | 통계      | basic  | v-channel- | true      |
|    |                  |           |        | bridge     |           |
+----+------------------+-----------+--------+------------+-----------+
```

- `app_id = NULL`: 대시보드, 사용자 관리, 감사 로그, 설정, 도움말, 조직 관리, 권한 관리, 권한 그룹, 메뉴 관리
- `app_id = 'v-channel-bridge'`: 채널 관리, 메시지 히스토리, 통계, 연동 관리, 모니터링

### 4.2 메뉴 API 필터링 로직

```python
# v_platform/api/menus.py - get_my_menus()
app_id = request.app.state.app_id

# 쿼리: 플랫폼 공통(NULL) + 현재 앱 메뉴
query = db.query(MenuItem)
query = query.filter(
    or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
)
menus = query.order_by(MenuItem.sort_order).all()
```

v-channel-bridge (포트 8000)에 접속하면 `app_id IS NULL OR app_id = 'v-channel-bridge'` 조건으로 플랫폼 공통 메뉴 + 브리지 전용 메뉴가 반환됩니다. v-platform-template (포트 8002)에 접속하면 `app_id IS NULL OR app_id = 'v-platform-template'` 조건으로 플랫폼 공통 메뉴만 반환됩니다.

### 4.3 app_menu_keys 자동 분류

PlatformApp에 `app_menu_keys`를 전달하면 `init_platform()` 호출 시 해당 메뉴의 `app_id`를 자동으로 태깅합니다.

```python
# v_platform/app.py - _classify_app_menus()
def _classify_app_menus(self):
    """app_menu_keys에 해당하는 메뉴의 app_id를 현재 앱으로 설정"""
    with engine.connect() as conn:
        conn.execute(
            text(
                "UPDATE menu_items SET app_id = :app_id "
                "WHERE permission_key IN (:keys) AND app_id IS NULL"
            ),
            {"app_id": self.app_name, "keys": self.app_menu_keys},
        )
        conn.commit()
```

이 방식으로 앱이 처음 부팅될 때 자동으로 자신의 메뉴를 분류합니다.

### 4.4 새 앱에서 앱 전용 메뉴 추가

```python
# apps/v-my-new-app/backend/app/main.py
def seed_app_menus(db):
    """앱 전용 메뉴 시드"""
    menus = [
        MenuItem(
            permission_key="tickets",
            label="티켓 관리",
            icon="Ticket",
            path="/tickets",
            section="basic",
            app_id="v-my-new-app",  # 이 앱에서만 표시
        ),
    ]
    for menu in menus:
        existing = db.query(MenuItem).filter_by(
            permission_key=menu.permission_key
        ).first()
        if not existing:
            db.add(menu)
    db.commit()
```

---

## 5. 감사 로그 격리

### 5.1 자동 app_id 주입

감사 로그 생성 시 `request`에서 `app_id`를 자동으로 추출하여 기록합니다.

```python
# v_platform/utils/audit_logger.py
def create_audit_log(action, user, detail, request=None, app_id=None):
    if not app_id and request:
        app_id = getattr(request.app.state, 'app_id', None)

    log = AuditLog(
        action=action,
        user_id=user.id,
        app_id=app_id,  # 어느 앱에서 발생했는지 기록
        ...
    )
```

### 5.2 AuditLog 모델의 app_id

```python
# v_platform/models/audit_log.py
class AuditLog(Base):
    __tablename__ = "audit_logs"
    ...
    app_id = Column(String(50), nullable=True, index=True)
```

### 5.3 감사 로그 조회 필터

감사 로그 API는 현재 앱의 로그를 기본으로 표시합니다. 관리자는 전체 앱 로그를 볼 수 있습니다.

```
v-channel-bridge에서 조회:
  WHERE app_id IS NULL OR app_id = 'v-channel-bridge'

관리자 전체 조회:
  WHERE 1=1 (필터 없음)
```

---

## 6. 시스템 설정 격리

### 6.1 설정 우선순위

시스템 설정은 전역 설정과 앱별 설정으로 나뉘며, 앱별 설정이 전역 설정보다 우선합니다.

```
앱별 설정 (app_id = 'v-channel-bridge')  <-- 최우선
전역 설정 (app_id = NULL)                <-- 폴백
```

### 6.2 SystemSettings 모델

```python
# v_platform/models/system_settings.py
class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True)
    manual_enabled = Column(Boolean, default=True)
    manual_url = Column(String, default="http://127.0.0.1:3000")
    support_email = Column(String, nullable=True)
    support_url = Column(String, nullable=True)
    default_start_page = Column(String(255), default="/")
    # 앱 브랜딩
    app_title = Column(String(200), nullable=True)
    app_description = Column(String(500), nullable=True)
    app_logo_url = Column(String(500), nullable=True)
    # 격리 키
    app_id = Column(String(50), nullable=True)
```

### 6.3 앱별 브랜딩 예시

| 필드 | app_id | 값 | 적용 대상 |
|------|--------|-----|----------|
| `manual_url` | `NULL` | `http://127.0.0.1:3000` | 모든 앱 기본 |
| `manual_url` | `v-channel-bridge` | `http://127.0.0.1:3000/docs/apps/v-channel-bridge` | v-channel-bridge만 |
| `app_title` | `NULL` | `v-platform` | 모든 앱 기본 |
| `app_title` | `v-channel-bridge` | `Channel Bridge` | v-channel-bridge만 |
| `app_title` | `v-platform-portal` | `v-platform Portal` | v-platform-portal만 |

---

## 7. 알림 격리

### 7.1 Notification 모델의 scope + app_id

알림은 `scope`와 `app_id`의 조합으로 대상을 결정합니다.

| scope | app_id | 의미 |
|-------|--------|------|
| `global` | `NULL` | 모든 앱의 모든 사용자 |
| `app` | `v-channel-bridge` | v-channel-bridge 사용자만 |
| `role` | `v-channel-bridge` | v-channel-bridge의 특정 역할만 |
| `user` | `NULL` 또는 특정 앱 | 특정 사용자 1명 |

### 7.2 NotificationAppOverride

시스템 알림(is_system=True)은 삭제가 불가능합니다. 대신 앱별로 활성/비활성을 오버라이드합니다.

```python
# v_platform/models/notification.py
class NotificationAppOverride(Base):
    __tablename__ = "notification_app_overrides"
    notification_id = Column(Integer, ForeignKey("notifications.id"))
    app_id = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    # UNIQUE(notification_id, app_id)
```

시스템 알림 "비밀번호 변경 권장"이 있을 때:
- v-channel-bridge에서는 활성 (오버라이드 없음 -> 원본 is_active 사용)
- v-platform-template에서는 비활성 (오버라이드 is_active=False)

### 7.3 알림 조회 필터

```python
# v_platform/api/persistent_notifications.py
app_id = getattr(request.app.state, "app_id", None)

# 사용자에게 표시할 알림:
# 1. scope=global (전역)
# 2. scope=app AND app_id=현재앱 (앱 대상)
# 3. scope=role AND target_role=내역할 (역할 대상)
# 4. scope=user AND target_user_id=나 (개인 대상)
```

---

## 8. 권한 그룹 격리

### 8.1 PermissionGroup의 app_id

```python
# v_platform/models/permission_group.py
class PermissionGroup(Base):
    __tablename__ = "permission_groups"
    name = Column(String(100), nullable=False)
    app_id = Column(String(50), nullable=True, index=True)
    # NULL = 플랫폼 공통 그룹, 값 = 앱 전용 그룹
```

### 8.2 격리 효과

| 그룹 이름 | app_id | 가시 범위 |
|----------|--------|----------|
| `시스템 관리자` | `NULL` | 모든 앱 |
| `일반 사용자` | `NULL` | 모든 앱 |
| `브리지 운영자` | `v-channel-bridge` | v-channel-bridge만 |

### 8.3 권한 계산 흐름

```
사용자 권한 = MAX(그룹 권한, 개인 권한)

1. 사용자가 속한 권한 그룹 조회
   -> 플랫폼 공통 그룹 (app_id IS NULL)
   -> 현재 앱 전용 그룹 (app_id = 현재 앱)

2. 그룹의 메뉴별 권한(PermissionGroupGrant) 취합

3. 개인 권한(UserPermission)과 비교하여 MAX 적용
   -> none < read < write
```

---

## 9. UNIQUE 제약 조건

앱별 격리를 위해 여러 테이블에 복합 UNIQUE 제약이 적용되어 있습니다.

### 9.1 permission_groups

```sql
-- p018_permission_group_unique_per_app.py
UNIQUE (name, app_id)  -- 같은 이름의 그룹이 앱별로 존재 가능
```

같은 "관리자" 그룹이 `app_id=NULL`(플랫폼), `app_id='v-channel-bridge'`(브리지) 각각 존재 가능합니다.

### 9.2 notification_app_overrides

```sql
-- p022_notification_app_overrides.py
UNIQUE (notification_id, app_id)  -- 알림당 앱별 1개 오버라이드
```

### 9.3 notification_reads

```sql
-- p020_notifications.py
UNIQUE (notification_id, user_id)  -- 알림당 사용자별 1개 읽음 기록
```

### 9.4 user_permissions

```sql
-- p001_rbac_and_custom_menus.py
UNIQUE (user_id, menu_item_id)  -- 사용자당 메뉴별 1개 권한
```

### 9.5 permission_group_grants

```sql
-- p006_permission_groups.py
UNIQUE (permission_group_id, menu_item_id)  -- 그룹당 메뉴별 1개 권한
```

---

## 10. 마이그레이션 이력

app_id 기반 격리와 관련된 마이그레이션 파일 목록입니다.

| 마이그레이션 | 파일명 | 내용 |
|------------|--------|------|
| p015 | `p015_multi_app_isolation.py` | menu_items, audit_logs, system_settings에 app_id 컬럼 추가. 인덱스 생성. v-channel-bridge 전용 메뉴 분류. |
| p016 | `p016_app_branding_settings.py` | system_settings에 app_title, app_description, app_logo_url 추가 |
| p017 | `p017_app_id_permissions.py` | permission_groups에 app_id 컬럼 추가 |
| p018 | `p018_permission_group_unique_per_app.py` | permission_groups에 (name, app_id) UNIQUE 제약 추가 |
| p019 | `p019_unique_constraints_per_app.py` | 기타 앱별 UNIQUE 제약 정리 |
| p020 | `p020_notifications.py` | notifications, notification_reads 테이블 생성 (scope, app_id 포함) |
| p022 | `p022_notification_app_overrides.py` | notification_app_overrides 테이블 생성 |
| p025 | `p025_refresh_token_app_id.py` | refresh_tokens에 app_id 컬럼 추가 |
| p026 | `p026_system_settings_branding_seed.py` | 앱별 브랜딩 초기 데이터 시드 |

---

## 11. 전체 격리 데이터 흐름

```
사용자 로그인 (v-channel-bridge, 포트 5173)
    |
    v
[Frontend] --> POST /api/auth/login
    |
    v
[PlatformApp] app_name="v-channel-bridge"
    |          request.app.state.app_id = "v-channel-bridge"
    |
    v
[메뉴 API]  GET /api/menus
    |       WHERE app_id IS NULL OR app_id = 'v-channel-bridge'
    |       --> 플랫폼 공통 메뉴 + 브리지 전용 메뉴 반환
    |
    v
[감사 로그]  user.login 기록
    |        app_id = 'v-channel-bridge' 자동 주입
    |
    v
[알림]      GET /api/notifications-v2
    |       scope=global 전역 알림
    |       + scope=app AND app_id='v-channel-bridge' 앱 알림
    |       + scope=role AND target_role=내역할
    |       + scope=user AND target_user_id=나
    |
    v
[설정]      GET /api/system-settings
            앱별 오버라이드 (app_id='v-channel-bridge') 우선
            없으면 전역 설정 (app_id=NULL) 폴백
```

---

## 12. 검증 방법

### 12.1 메뉴 격리 확인

```bash
# v-channel-bridge (포트 8000) -- 브리지 전용 메뉴 포함
curl -s http://127.0.0.1:8000/api/menus \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# v-platform-template (포트 8002) -- 플랫폼 공통 메뉴만
curl -s http://127.0.0.1:8002/api/menus \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

### 12.2 감사 로그 app_id 확인

```bash
psql -U vmsuser -d v_project \
  -c "SELECT action, app_id FROM audit_logs ORDER BY id DESC LIMIT 5;"
```

### 12.3 알림 격리 확인

```bash
# v-channel-bridge에서 알림 조회
curl -s http://127.0.0.1:8000/api/notifications-v2 \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# v-platform-template에서 알림 조회 (브리지 앱 알림은 안 보임)
curl -s http://127.0.0.1:8002/api/notifications-v2 \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

### 12.4 권한 그룹 격리 확인

```bash
psql -U vmsuser -d v_project \
  -c "SELECT name, app_id FROM permission_groups ORDER BY app_id NULLS FIRST;"
```

---

## 13. 새 앱 추가 시 격리 체크리스트

새 앱을 추가할 때 데이터 격리는 대부분 자동으로 동작합니다. 확인해야 할 사항은 다음과 같습니다.

| 단계 | 내용 | 자동/수동 |
|------|------|----------|
| PlatformApp 생성 | `app_name` 파라미터로 app_id 자동 설정 | 자동 |
| 앱 전용 메뉴 등록 | `app_menu_keys` 파라미터 또는 직접 시드 | 수동 |
| 감사 로그 격리 | `request.app.state.app_id` 자동 주입 | 자동 |
| 시스템 설정 오버라이드 | 필요 시 앱별 SystemSettings 레코드 추가 | 수동 |
| 알림 격리 | scope + app_id로 자동 필터 | 자동 |
| 권한 그룹 | 앱 전용 그룹이 필요하면 app_id 설정 | 수동 |
| UNIQUE 제약 | 이미 적용되어 있으므로 추가 작업 불필요 | 자동 |
