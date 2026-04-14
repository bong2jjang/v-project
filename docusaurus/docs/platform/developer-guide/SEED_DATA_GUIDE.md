---
id: seed-data-guide
title: 시드 데이터 및 마이그레이션 가이드
sidebar_position: 6
tags: [guide, developer]
---

# 시드 데이터 및 마이그레이션 가이드

v-platform은 번호 기반 마이그레이션 시스템을 사용하여 스키마 변경과 시드 데이터를 관리합니다. 이 가이드에서는 마이그레이션 네이밍 규칙, 실행 순서, 멱등성 패턴, 그리고 실제 시드 예시를 설명합니다.

---

## 1. 마이그레이션 시스템 개요

### 1.1 실행 위치

마이그레이션은 `init_db()` 함수 내부에서 자동 실행됩니다.

```python
# platform/backend/v_platform/core/database.py

def init_db():
    """데이터베이스 초기화"""
    # 1. 모든 모델 import (Base.metadata에 등록)
    from v_platform.models import user, audit_log, refresh_token  # noqa
    from v_platform.models import password_reset_token, system_settings  # noqa
    from v_platform.models import menu_item, user_permission  # noqa
    from v_platform.models import permission_group, company, department  # noqa
    from v_platform.models import user_oauth_token  # noqa
    from v_platform.models import notification  # noqa

    # 앱 모델 (있는 경우만)
    try:
        from app.models import message, account  # noqa
    except ImportError:
        pass

    # 2. 테이블 생성
    Base.metadata.create_all(bind=engine)

    # 3. 마이그레이션 실행
    _run_migrations()
```

### 1.2 실행 순서

`_run_migrations()` 함수가 플랫폼 마이그레이션을 먼저, 앱 마이그레이션을 나중에 실행합니다.

```python
def _run_migrations():
    """번호 순서대로 마이그레이션 실행: 플랫폼(p*) → 앱(a*) 순서"""
    import importlib.util
    import glob as glob_mod
    import pathlib

    # 1) Platform migrations (v_platform/migrations/)
    platform_dir = pathlib.Path(__file__).resolve().parent.parent / "migrations"

    # 2) App migrations (backend/migrations/) — Docker: /app/migrations
    app_dir = pathlib.Path("/app/migrations")
    if not app_dir.is_dir():
        app_dir = pathlib.Path.cwd() / "migrations"  # Fallback

    files = []
    if platform_dir.is_dir():
        files += sorted(glob_mod.glob(str(platform_dir / "p[0-9]*.py")))
    if app_dir.is_dir():
        files += sorted(glob_mod.glob(str(app_dir / "a[0-9]*.py")))

    for fpath in files:
        name = pathlib.Path(fpath).stem
        try:
            spec = importlib.util.spec_from_file_location(name, fpath)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "migrate"):
                mod.migrate(engine)
        except Exception as e:
            logger.error(f"Migration {name} failed: {e}")
```

---

## 2. 네이밍 규칙

### 2.1 파일 접두사

| 접두사 | 위치 | 용도 |
|--------|------|------|
| `p` | `platform/backend/v_platform/migrations/` | 플랫폼 마이그레이션 |
| `a` | `apps/{앱명}/backend/app/migrations/` | 앱 마이그레이션 |

### 2.2 파일명 형식

```
{접두사}{3자리 번호}_{설명}.py
```

예시:

```
p001_rbac_and_custom_menus.py
p002_add_iframe_fullscreen.py
p015_multi_app_isolation.py
p026_system_settings_branding_seed.py
a001_seed_app_menus.py
a002_add_custom_column.py
```

### 2.3 실행 순서 보장

파일명을 사전식(lexicographic)으로 정렬하여 실행합니다. `sorted()` 함수가 사용되므로:

- `p001` → `p002` → ... → `p026` (플랫폼 전체)
- `a001` → `a002` → ... (앱 전체)

:::warning 번호 충돌 주의
같은 접두사 내에서 번호가 겹치면 안 됩니다. 새 마이그레이션을 추가할 때 기존 최대 번호 + 1을 사용하세요.
:::

### 2.4 현재 플랫폼 마이그레이션 목록

| 번호 | 파일명 | 설명 |
|------|--------|------|
| p001 | `p001_rbac_and_custom_menus.py` | RBAC 권한 + 커스텀 메뉴 시스템 |
| p002 | `p002_add_iframe_fullscreen.py` | iframe 전체화면 설정 컬럼 |
| p003 | `p003_add_menu_section.py` | 메뉴 섹션 컬럼 |
| p004 | `p004_add_sso_fields.py` | SSO 관련 사용자 필드 |
| p005 | `p005_organizations.py` | 조직도 테이블 |
| p006 | `p006_permission_groups.py` | 권한 그룹 테이블 |
| p007 | `p007_add_org_and_group_menus.py` | 조직/그룹 메뉴 추가 |
| p008 | `p008_fix_menu_icons.py` | 메뉴 아이콘 수정 |
| p009 | `p009_align_group_names_with_roles.py` | 그룹명을 역할에 맞춰 정렬 |
| p010 | `p010_backfill_user_group_memberships.py` | 기존 사용자 그룹 멤버십 보정 |
| p011 | `p011_datetime_to_timestamptz.py` | datetime → timestamptz 변환 |
| p012 | `p012_user_start_page.py` | 사용자별 시작 페이지 |
| p013 | `p013_system_default_start_page.py` | 시스템 기본 시작 페이지 |
| p014 | `p014_user_theme_settings.py` | 사용자 테마 설정 |
| p015 | `p015_multi_app_isolation.py` | Multi-app 데이터 격리 (app_id) |
| p016 | `p016_app_branding_settings.py` | 앱별 브랜딩 설정 |
| p017 | `p017_app_id_permissions.py` | 앱별 권한 격리 |
| p018 | `p018_permission_group_unique_per_app.py` | 권한 그룹 앱별 유니크 제약 |
| p019 | `p019_unique_constraints_per_app.py` | 앱별 유니크 제약 조건 |
| p020 | `p020_notifications.py` | 알림 테이블 |
| p021 | `p021_system_notifications_seed.py` | 시스템 알림 시드 데이터 |
| p022 | `p022_notification_app_overrides.py` | 앱별 알림 오버라이드 |
| p023 | `p023_notification_delivery_type.py` | 알림 전달 방식 |
| p024 | `p024_localhost_to_127001.py` | localhost → 127.0.0.1 변환 |
| p025 | `p025_refresh_token_app_id.py` | refresh_token에 app_id 추가 |
| p026 | `p026_system_settings_branding_seed.py` | system_settings 브랜딩 시드 |

---

## 3. 마이그레이션 함수 규약

### 3.1 기본 구조

모든 마이그레이션 파일은 `migrate(engine)` 함수를 export해야 합니다.

```python
"""설명: 이 마이그레이션이 하는 일"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    """마이그레이션 실행"""
    with engine.connect() as conn:
        # 마이그레이션 로직
        # ...
        conn.commit()
        logger.info("Migration pXXX completed: 설명")
```

### 3.2 핵심 규칙

1. **`engine` 파라미터**: SQLAlchemy Engine 인스턴스를 받습니다. `conn = engine.connect()`로 연결을 생성합니다.
2. **명시적 `conn.commit()`**: 자동 커밋이 없으므로 반드시 명시적으로 커밋합니다.
3. **`text()` 함수 사용**: Raw SQL은 반드시 `sqlalchemy.text()`로 감쌉니다.
4. **예외 처리**: `_run_migrations()`가 외부에서 `try/except`로 감싸므로, 마이그레이션 내부에서는 예외를 던져도 됩니다. 다만 로그는 남기세요.

---

## 4. 멱등성 패턴

모든 마이그레이션은 **멱등(idempotent)**이어야 합니다. 앱이 재시작될 때마다 `_run_migrations()`가 호출되므로, 동일한 마이그레이션을 여러 번 실행해도 결과가 같아야 합니다.

### 4.1 컬럼 추가 — 존재 확인 후 추가

```python
def migrate(engine):
    with engine.connect() as conn:
        # information_schema에서 컬럼 존재 확인
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='menu_items' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(text("ALTER TABLE menu_items ADD COLUMN app_id VARCHAR(50)"))
            conn.execute(
                text("CREATE INDEX idx_menu_items_app_id ON menu_items(app_id)")
            )
            logger.info("Added app_id column to menu_items")

        conn.commit()
```

### 4.2 데이터 시드 — 존재 확인 후 삽입

```python
def migrate(engine):
    with engine.connect() as conn:
        # 이미 존재하는지 확인
        existing = conn.execute(
            text("SELECT id FROM system_settings WHERE app_id IS NULL")
        ).fetchone()

        if existing:
            logger.info("system_settings row exists, skipping")
        else:
            conn.execute(
                text("""
                    INSERT INTO system_settings (app_id, app_title, app_description)
                    VALUES (NULL, 'v-platform', '통합 관리 플랫폼')
                """)
            )
            logger.info("Seeded system_settings row")

        conn.commit()
```

### 4.3 Enum 값 추가 — PostgreSQL IF NOT EXISTS

```python
def migrate(engine):
    with engine.connect() as conn:
        conn.execute(
            text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum
                        WHERE enumlabel = 'system_admin'
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                    ) THEN
                        ALTER TYPE userrole ADD VALUE 'system_admin';
                    END IF;
                END
                $$;
            """)
        )
        conn.commit()
```

### 4.4 데이터 업데이트 — AND 조건으로 중복 방지

```python
def migrate(engine):
    with engine.connect() as conn:
        # app_id가 NULL인 행만 업데이트 (이미 분류된 행은 건드리지 않음)
        conn.execute(
            text("""
                UPDATE menu_items SET app_id = 'v-channel-bridge'
                WHERE permission_key IN ('channels', 'messages', 'statistics')
                AND app_id IS NULL
            """)
        )
        conn.commit()
```

:::tip 멱등성 검증 방법
마이그레이션 작성 후 Docker 컨테이너를 2~3번 재시작하여 오류 없이 반복 실행되는지 확인하세요.
```bash
docker compose up -d --build v-channel-bridge-backend
docker compose restart v-channel-bridge-backend
docker compose restart v-channel-bridge-backend
```
:::

---

## 5. 실전 시드 데이터 예시

### 5.1 system_settings 브랜딩 시드 (p026)

앱별 브랜딩 기본값을 삽입하는 마이그레이션입니다. 사용자가 관리 UI에서 수정한 값은 덮어쓰지 않습니다.

```python
"""Seed system_settings rows (global + per-app branding) to match canonical defaults.

Idempotent: 기존 행이 있으면 건드리지 않고, 없는 앱 컨텍스트의 행만 추가한다.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

# (app_id, app_title, app_description) — app_id=None 은 전역 기본 행
SETTINGS_SEED = [
    (None, "v-platform", "통합 관리 플랫폼"),
    ("v-channel-bridge", "channel-bridge", "Slack ↔ Teams 메시지 브리지"),
    ("v-platform-portal", "v-platform-portal", "통합 관리 플랫폼"),
    ("v-platform-template", "v-platform-template", "플랫폼 템플릿 앱"),
]


def migrate(engine):
    with engine.connect() as conn:
        for app_id, app_title, app_description in SETTINGS_SEED:
            # app_id가 NULL인 행과 NOT NULL인 행 구분 검색
            if app_id is None:
                existing = conn.execute(
                    text("SELECT id FROM system_settings WHERE app_id IS NULL")
                ).fetchone()
            else:
                existing = conn.execute(
                    text("SELECT id FROM system_settings WHERE app_id = :app_id"),
                    {"app_id": app_id},
                ).fetchone()

            if existing:
                logger.info(f"system_settings row exists (app_id={app_id}), skipping")
                continue

            conn.execute(
                text("""
                    INSERT INTO system_settings
                        (app_id, app_title, app_description,
                         manual_enabled, manual_url, default_start_page)
                    VALUES
                        (:app_id, :app_title, :app_description,
                         TRUE, 'http://127.0.0.1:3000', '/')
                """),
                {
                    "app_id": app_id,
                    "app_title": app_title,
                    "app_description": app_description,
                },
            )
            logger.info(f"Seeded system_settings (app_id={app_id}, title={app_title})")

        conn.commit()
        logger.info("Migration p026 completed: system_settings branding seed")
```

핵심 패턴:

1. **루프 기반 시드**: `SETTINGS_SEED` 리스트로 여러 행을 일괄 처리
2. **NULL 처리**: `app_id IS NULL` vs `app_id = :app_id` 분기
3. **파라미터 바인딩**: SQL 인젝션 방지를 위해 `:param` 바인딩 사용
4. **건너뛰기 로그**: 이미 존재하는 행은 스킵하되 로그를 남김

### 5.2 Multi-app 데이터 격리 (p015)

기존 테이블에 `app_id` 컬럼을 추가하고 기존 데이터를 분류하는 마이그레이션입니다.

```python
"""Multi-app data isolation: add app_id to menu_items, audit_logs, system_settings"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # 1. menu_items.app_id 컬럼 추가
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='menu_items' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(text("ALTER TABLE menu_items ADD COLUMN app_id VARCHAR(50)"))
            conn.execute(
                text("CREATE INDEX idx_menu_items_app_id ON menu_items(app_id)")
            )
            logger.info("Added app_id column to menu_items")

        # 2. 기존 메뉴 데이터 분류 (항상 실행 — 멱등)
        conn.execute(
            text("""
                UPDATE menu_items SET app_id = 'v-channel-bridge'
                WHERE permission_key IN (
                    'channels', 'messages', 'statistics', 'integrations', 'monitoring',
                    'menu_group_mgtmonitor', 'menu_group01'
                ) AND app_id IS NULL
            """)
        )

        # 3. audit_logs.app_id
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='audit_logs' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN app_id VARCHAR(50)"))
            conn.execute(
                text("CREATE INDEX idx_audit_logs_app_id ON audit_logs(app_id)")
            )

        # 4. system_settings.app_id
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='system_settings' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(
                text("ALTER TABLE system_settings ADD COLUMN app_id VARCHAR(50)")
            )

        conn.commit()
        logger.info("Migration p015 completed: multi-app data isolation")
```

핵심 패턴:

1. **스키마 변경 + 데이터 분류**를 하나의 마이그레이션에서 처리
2. **인덱스 동시 생성**: 컬럼 추가 시 인덱스도 함께 생성
3. **`AND app_id IS NULL`**: 이미 분류된 데이터는 건드리지 않음

### 5.3 RBAC 메뉴 시드 (p001)

커스텀 메뉴 시스템의 초기 데이터를 삽입합니다.

```python
"""RBAC 권한 관리 및 커스텀 메뉴 시스템"""

def migrate(engine):
    with engine.connect() as conn:
        # 1. Enum 값 추가
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'system_admin'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                ) THEN
                    ALTER TYPE userrole ADD VALUE 'system_admin';
                END IF;
            END
            $$;
        """))
        conn.commit()  # Enum 변경은 별도 트랜잭션 필요

        # 2. 기존 admin → system_admin 변환
        # ...

        # 3. menu_items 시드 데이터
        existing = conn.execute(
            text("SELECT COUNT(*) FROM menu_items WHERE is_built_in = TRUE")
        ).scalar()

        if existing == 0:
            # 빌트인 메뉴 삽입
            conn.execute(text("""
                INSERT INTO menu_items
                    (name, path, icon, section, sort_order, is_built_in, permission_key)
                VALUES
                    ('대시보드', '/', 'layout-dashboard', 'main', 1, TRUE, 'dashboard'),
                    ('사용자 관리', '/admin/users', 'users', 'admin', 10, TRUE, 'admin_users'),
                    -- ...
            """))

        conn.commit()
```

---

## 6. 앱 마이그레이션

### 6.1 파일 위치

앱 마이그레이션은 각 앱의 `backend/app/migrations/` 디렉토리에 위치합니다.

```
apps/v-channel-bridge/backend/app/migrations/
    a001_seed_bridge_menus.py
    a002_add_provider_settings.py

apps/v-platform-portal/backend/app/migrations/
    a001_seed_portal_menus.py
```

Docker 컨테이너 내부에서는 `/app/migrations/`로 접근됩니다.

### 6.2 앱 마이그레이션 예시

```python
# apps/v-channel-bridge/backend/app/migrations/a001_seed_bridge_menus.py
"""v-channel-bridge 전용 메뉴 시드"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # 이미 등록된 메뉴가 있는지 확인
        existing = conn.execute(
            text("""
                SELECT COUNT(*) FROM menu_items
                WHERE app_id = 'v-channel-bridge' AND permission_key = 'channels'
            """)
        ).scalar()

        if existing > 0:
            logger.info("Bridge menus already exist, skipping")
            return

        # 앱 전용 메뉴 삽입
        conn.execute(text("""
            INSERT INTO menu_items
                (name, path, icon, section, sort_order, is_built_in,
                 permission_key, app_id)
            VALUES
                ('채널 관리', '/channels', 'radio', 'main', 2, TRUE,
                 'channels', 'v-channel-bridge'),
                ('메시지', '/messages', 'message-square', 'main', 3, TRUE,
                 'messages', 'v-channel-bridge'),
                ('통계', '/statistics', 'bar-chart-2', 'main', 4, TRUE,
                 'statistics', 'v-channel-bridge')
        """))

        conn.commit()
        logger.info("Migration a001 completed: bridge menus seeded")
```

### 6.3 플랫폼 vs 앱 마이그레이션 구분

| 구분 | 플랫폼 (p*) | 앱 (a*) |
|------|------------|---------|
| 위치 | `platform/backend/v_platform/migrations/` | `apps/{앱}/backend/app/migrations/` |
| 실행 순서 | 먼저 | 나중 |
| 대상 | 공통 테이블 (users, menu_items, system_settings 등) | 앱 전용 데이터 |
| 관리자 | 플랫폼 개발자 | 앱 개발자 |

---

## 7. 새 마이그레이션 작성 가이드

### 7.1 단계별 절차

1. **번호 확인**: 해당 접두사의 최대 번호 확인

```bash
# 플랫폼 최대 번호 확인
ls platform/backend/v_platform/migrations/p*.py | sort | tail -1
# → p026_system_settings_branding_seed.py

# 다음 번호: p027
```

2. **파일 생성**: `p027_설명.py` 파일 생성

3. **migrate() 함수 작성**: 멱등성 보장

4. **테스트**: Docker 재시작으로 반복 실행 확인

### 7.2 템플릿

```python
"""p027: 마이그레이션 설명

변경 내용:
- 무엇을 변경하는지 상세히 기술
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # --- 스키마 변경 ---
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='테이블명' AND column_name='컬럼명'"
            )
        )
        if not result.fetchone():
            conn.execute(text("ALTER TABLE 테이블명 ADD COLUMN 컬럼명 타입"))
            logger.info("Added 컬럼명 column to 테이블명")

        # --- 데이터 시드 ---
        existing = conn.execute(
            text("SELECT id FROM 테이블명 WHERE 조건")
        ).fetchone()

        if not existing:
            conn.execute(
                text("""
                    INSERT INTO 테이블명 (col1, col2)
                    VALUES (:val1, :val2)
                """),
                {"val1": "값1", "val2": "값2"},
            )
            logger.info("Seeded 테이블명 data")

        conn.commit()
        logger.info("Migration p027 completed: 설명")
```

### 7.3 Docker 내 마이그레이션 실행 확인

```bash
# 백엔드 재빌드 (마이그레이션 자동 실행)
docker compose up -d --build v-channel-bridge-backend

# 로그에서 마이그레이션 결과 확인
docker logs v-channel-bridge-backend 2>&1 | grep -i migration
```

---

## 8. 주의사항 및 안티패턴

### 8.1 금지 패턴

| 패턴 | 문제 | 대안 |
|------|------|------|
| 마이그레이션 버전 테이블 사용 | 불필요한 복잡성 (매번 실행이므로) | 멱등성으로 해결 |
| `DROP TABLE IF EXISTS` | 데이터 유실 위험 | 컬럼 추가/수정만 허용 |
| 하드코딩된 `id` 값 | 시퀀스 충돌 | DB가 자동 생성하도록 |
| ORM 모델 사용 | 모델 변경 시 마이그레이션 깨짐 | Raw SQL (`text()`) 사용 |
| 외부 서비스 호출 | 네트워크 오류 시 실패 | DB 작업만 |

### 8.2 ORM 대신 Raw SQL을 쓰는 이유

마이그레이션에서 ORM 모델을 사용하면 위험합니다:

```python
# 나쁜 예 — 모델 구조가 바뀌면 과거 마이그레이션이 깨짐
from v_platform.models.system_settings import SystemSettings
db.query(SystemSettings).filter_by(app_id=None).first()

# 좋은 예 — Raw SQL은 스키마 변경에 영향 받지 않음
conn.execute(text("SELECT id FROM system_settings WHERE app_id IS NULL"))
```

### 8.3 트랜잭션 주의사항

PostgreSQL에서 `ALTER TYPE ... ADD VALUE`는 트랜잭션 내에서 실행할 수 없습니다. enum 값 추가 후 반드시 `conn.commit()`을 호출하고, 후속 작업을 별도 트랜잭션에서 실행하세요.

```python
# Enum 변경 — 별도 커밋 필요
conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'new_role'"))
conn.commit()  # 여기서 커밋

# 이후 작업
conn.execute(text("UPDATE users SET role = 'new_role' WHERE ..."))
conn.commit()
```

---

## 9. app_id 기반 데이터 격리

### 9.1 격리 대상 테이블

| 테이블 | app_id 역할 |
|--------|-------------|
| `menu_items` | 앱별 메뉴 표시 분리 |
| `audit_logs` | 앱별 감사 로그 필터링 |
| `system_settings` | 앱별 브랜딩/설정 |
| `notifications` | 앱별 알림 |
| `refresh_tokens` | 토큰 발행 앱 추적 |
| `user_permissions` | 앱별 권한 |
| `permission_groups` | 앱별 권한 그룹 |

### 9.2 app_id 값 규칙

- `NULL`: 전역 (모든 앱 공용) -- 플랫폼 기본 메뉴, 전역 설정
- `"v-channel-bridge"`: v-channel-bridge 앱 전용
- `"v-platform-portal"`: v-platform-portal 앱 전용
- `"v-platform-template"`: v-platform-template 앱 전용

### 9.3 PlatformApp의 자동 분류

`PlatformApp.init_platform()` 호출 시 `_classify_app_menus()`가 실행되어, `app_menu_keys`에 지정된 메뉴를 해당 앱의 `app_id`로 자동 분류합니다.

```python
# apps/v-channel-bridge/backend/app/main.py
platform = PlatformApp(
    app_name="v-channel-bridge",
    app_menu_keys=["channels", "messages", "statistics", "integrations", "monitoring",
                   "menu_group_mgtmonitor", "menu_group01"],
)
```

```python
# PlatformApp._classify_app_menus() 내부 로직
UPDATE menu_items SET app_id = :app_name
WHERE permission_key IN (:keys) AND app_id IS NULL
```

---

## 10. 체크리스트

새 마이그레이션을 작성할 때 확인할 항목:

- [ ] 파일명이 `{접두사}{3자리 번호}_{설명}.py` 형식인가?
- [ ] 번호가 기존 최대값 + 1인가?
- [ ] `migrate(engine)` 함수를 정의했는가?
- [ ] 모든 작업이 멱등한가? (2번 실행해도 동일 결과)
- [ ] Raw SQL + `text()` 함수를 사용하는가? (ORM 모델 금지)
- [ ] 명시적 `conn.commit()`이 있는가?
- [ ] 적절한 로그 메시지가 있는가?
- [ ] 컬럼 추가 시 `information_schema` 확인을 하는가?
- [ ] 데이터 삽입 시 존재 여부를 먼저 확인하는가?
- [ ] Docker 재시작으로 반복 실행을 테스트했는가?
