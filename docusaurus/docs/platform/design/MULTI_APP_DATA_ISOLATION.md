# 멀티앱 데이터 분리 설계

> **작성일**: 2026-04-11  
> **상태**: 구현 완료 (마이그레이션 p015)

---

## 1. 개요

v-project는 여러 앱(v-channel-bridge, v-platform-template 등)이 **같은 PostgreSQL 데이터베이스**를 공유합니다. 사용자 계정은 전 앱 공통이지만, 메뉴/감사로그/설정은 앱별로 분리되어야 합니다.

### 핵심 원칙

```
같은 DB, 같은 사용자, 다른 메뉴
```

사용자 A가 v-channel-bridge에 로그인하면 브리지 메뉴가 보이고, v-platform-template에 로그인하면 템플릿 메뉴만 보입니다.

---

## 2. 데이터 분류

### 2.1 플랫폼 공유 테이블 (모든 앱 동일)

| 테이블 | 용도 | 분리 방식 |
|--------|------|----------|
| `users` | 사용자 계정 | 전 앱 공유 — 같은 이메일/비밀번호로 모든 앱 접속 |
| `user_permissions` | 메뉴별 권한 | 메뉴와 연동 — 메뉴가 분리되면 권한도 자동 분리 |
| `permission_groups` | 권한 그룹 | 전 앱 공유 — 역할(admin, user 등)은 동일 |
| `permission_group_grants` | 그룹별 메뉴 권한 | 메뉴와 연동 |
| `user_group_memberships` | 사용자↔그룹 매핑 | 전 앱 공유 |
| `companies` | 회사 | 전 앱 공유 |
| `departments` | 부서 | 전 앱 공유 |
| `refresh_tokens` | JWT 갱신 토큰 | 전 앱 공유 |
| `password_reset_tokens` | 비밀번호 재설정 | 전 앱 공유 |

### 2.2 app_id로 분리된 테이블

| 테이블 | `app_id` 컬럼 | 동작 |
|--------|-------------|------|
| `menu_items` | `VARCHAR(50), NULL 허용` | `NULL` = 플랫폼 공통 메뉴 (모든 앱에 표시), `'v-channel-bridge'` = 해당 앱에서만 표시 |
| `audit_logs` | `VARCHAR(50), NULL 허용` | 감사 로그 생성 시 앱 이름 자동 기록 — 어느 앱에서 발생한 액션인지 추적 |
| `system_settings` | `VARCHAR(50), NULL 허용` | `NULL` = 전역 설정, `'v-channel-bridge'` = 앱별 설정 — 전역 우선, 앱별 오버라이드 |

### 2.3 앱 전용 테이블 (특정 앱만 사용)

| 테이블 | 소유 앱 | 설명 |
|--------|---------|------|
| `accounts` | v-channel-bridge | Slack/Teams 자격증명 |
| `messages` | v-channel-bridge | 메시지 이력 |
| `message_stats` | v-channel-bridge | 메시지 통계 |
| `user_oauth_tokens` | v-channel-bridge | 사용자별 OAuth 토큰 |

---

## 3. 메뉴 분리 상세

### 3.1 현재 메뉴 분류

| permission_key | label | app_id | 표시 위치 |
|----------------|-------|--------|----------|
| `dashboard` | 대시보드 | `NULL` | **모든 앱** |
| `users` | 사용자 관리 | `NULL` | **모든 앱** |
| `audit_logs` | 감사 로그 | `NULL` | **모든 앱** |
| `settings` | 설정 | `NULL` | **모든 앱** |
| `help` | 도움말 | `NULL` | **모든 앱** |
| `organizations` | 조직 관리 | `NULL` | **모든 앱** |
| `permission_management` | 권한 관리 | `NULL` | **모든 앱** |
| `permission_groups` | 권한 그룹 | `NULL` | **모든 앱** |
| `menu_management` | 메뉴 관리 | `NULL` | **모든 앱** |
| `channels` | 채널 관리 | `v-channel-bridge` | v-channel-bridge만 |
| `messages` | 메시지 히스토리 | `v-channel-bridge` | v-channel-bridge만 |
| `statistics` | 통계 | `v-channel-bridge` | v-channel-bridge만 |
| `integrations` | 연동 관리 | `v-channel-bridge` | v-channel-bridge만 |
| `monitoring` | 모니터링 | `v-channel-bridge` | v-channel-bridge만 |

### 3.2 메뉴 API 필터링 로직

```python
# v_platform/api/menus.py
app_id = request.app.state.app_id  # PlatformApp이 자동 주입

# 쿼리: 플랫폼 공통(NULL) + 현재 앱 메뉴
menus = db.query(MenuItem).filter(
    or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id)
).all()
```

### 3.3 새 앱에서 앱 전용 메뉴 추가

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
            app_id="v-my-new-app",  # ← 이 앱에서만 표시
        ),
    ]
    for menu in menus:
        existing = db.query(MenuItem).filter_by(permission_key=menu.permission_key).first()
        if not existing:
            db.add(menu)
    db.commit()
```

---

## 4. 감사 로그 분리 상세

### 4.1 자동 app_id 주입

```python
# v_platform/utils/audit_logger.py
def create_audit_log(action, user, detail, request=None, app_id=None):
    # request에서 app_id 자동 추출
    if not app_id and request:
        app_id = getattr(request.app.state, 'app_id', None)
    
    log = AuditLog(
        action=action,
        user_id=user.id,
        app_id=app_id,  # 어느 앱에서 발생했는지 기록
        ...
    )
```

### 4.2 감사 로그 조회 시 필터

감사 로그 API는 현재 앱의 로그만 기본 표시하되, 관리자는 전체 앱 로그를 볼 수 있습니다.

---

## 5. 시스템 설정 분리 상세

### 5.1 설정 우선순위

```
1. 앱별 설정 (app_id = 'v-channel-bridge')  ← 최우선
2. 전역 설정 (app_id = NULL)                ← 폴백
```

### 5.2 예시

| key | value | app_id | 적용 |
|-----|-------|--------|------|
| `manual_url` | `http://docs.example.com` | `NULL` | 모든 앱 기본 |
| `manual_url` | `http://bridge-docs.example.com` | `v-channel-bridge` | v-channel-bridge만 오버라이드 |

---

## 6. 스키마 변경 (마이그레이션 p015)

```sql
-- menu_items
ALTER TABLE menu_items ADD COLUMN app_id VARCHAR(50);
CREATE INDEX idx_menu_items_app_id ON menu_items(app_id);
UPDATE menu_items SET app_id = 'v-channel-bridge'
  WHERE permission_key IN ('channels', 'messages', 'statistics',
                           'integrations', 'monitoring',
                           'menu_group_mgtmonitor', 'menu_group01');

-- audit_logs
ALTER TABLE audit_logs ADD COLUMN app_id VARCHAR(50);
CREATE INDEX idx_audit_logs_app_id ON audit_logs(app_id);

-- system_settings
ALTER TABLE system_settings ADD COLUMN app_id VARCHAR(50);
```

---

## 7. PlatformApp의 app_id 주입

```python
# v_platform/app.py
class PlatformApp:
    def __init__(self, app_name: str, ...):
        self.fastapi = FastAPI(...)
        self.fastapi.state.app_id = app_name  # ← 모든 request에서 접근 가능
```

앱의 `main.py`에서 `PlatformApp(app_name="v-channel-bridge")`로 생성하면, 모든 API 핸들러에서 `request.app.state.app_id`로 앱 이름을 참조할 수 있습니다.

---

## 8. 확인 방법

```bash
# v-channel-bridge (포트 8000) — 브리지 메뉴 포함
curl -s http://localhost:8000/api/menus -H "Authorization: Bearer $TOKEN" | python -m json.tool

# v-platform-template (포트 8002) — 플랫폼 공통 메뉴만
curl -s http://localhost:8002/api/menus -H "Authorization: Bearer $TOKEN" | python -m json.tool

# 감사 로그 app_id 확인
psql -U vmsuser -d v_project -c "SELECT action, app_id FROM audit_logs ORDER BY id DESC LIMIT 5;"
```
