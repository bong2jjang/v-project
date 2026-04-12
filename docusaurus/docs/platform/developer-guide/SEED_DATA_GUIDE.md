# Seed Data 시스템 사용 가이드

> **작성일**: 2026-04-12  
> **관련 코드**: `platform/backend/v_platform/seeds/`

---

## 1. 개요

v-platform은 **시드 데이터 시스템**을 통해 신규 설치 시 필수 데이터와 개발/테스트용 샘플 데이터를 관리합니다.

| 레벨 | 용도 | 데이터 |
|------|------|--------|
| **base** | 프로덕션 / 신규 설치 | 기본 회사, 관리자 계정, 시스템 설정 |
| **demo** | 개발 / 테스트 | base + 부서, 테스트 사용자, 커스텀 권한그룹 |

**핵심 원리**: 모든 INSERT는 `ON CONFLICT DO NOTHING` 또는 존재 여부 확인 후 삽입하므로, 여러 번 실행해도 안전합니다 (idempotent).

---

## 2. CLI 사용법

Docker 컨테이너 내에서 실행합니다.

```bash
# 최소 시드 (신규 설치 — 관리자 계정 + 기본 설정)
docker exec v-channel-bridge-backend python -m v_platform.seeds --level base

# 데모 데이터 포함 (개발/테스트용)
docker exec v-channel-bridge-backend python -m v_platform.seeds --level demo

# 데모 데이터 초기화 후 재삽입
docker exec v-channel-bridge-backend python -m v_platform.seeds --level demo --reset
```

### 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--level` | `base` | 시드 레벨: `base` 또는 `demo` |
| `--reset` | `false` | 기존 데모 데이터 삭제 후 재삽입 (demo 레벨 전용) |

### 실행 결과 예시

```
INFO  Base seed: company
INFO  Base seed: admin user created (admin@example.com / Admin123!)
INFO  Base seed: system_settings
INFO  Base seed: admin group membership
INFO  Base seed completed
INFO  Demo seed: departments (top=7, sub=5)
INFO  Demo seed: 4 users
INFO  Demo seed: menu sections updated
INFO  Demo seed: 2 custom groups
INFO  Demo seed: group grants
INFO  Demo seed: 4 user-group mappings
INFO  Demo seed: 3 user permission overrides
INFO  Demo seed completed
INFO    companies: 1 rows
INFO    departments: 12 rows
INFO    users: 5 rows
INFO    permission_groups: 5 rows
INFO    user_group_memberships: 7 rows
```

---

## 3. 시드 레벨별 생성 데이터

### 3.1 Base 레벨

프로덕션 환경에서도 사용 가능한 최소 필수 데이터입니다.

#### 회사

| 필드 | 값 |
|------|-----|
| id | 1 |
| name | Default Company |
| code | DEFAULT |

#### 관리자 계정

| 필드 | 값 |
|------|-----|
| email | `admin@example.com` |
| password | `Admin123!` |
| role | SYSTEM_ADMIN |
| company_id | 1 |

#### 시스템 설정

| 필드 | 값 |
|------|-----|
| app_title | v-platform |
| app_description | 통합 관리 플랫폼 |
| default_start_page | / |

#### 관리자-권한그룹 매핑

관리자 계정을 마이그레이션에서 생성된 "시스템 관리자" 기본 권한그룹에 자동 매핑합니다.

---

### 3.2 Demo 레벨

base 위에 추가되는 개발/테스트용 데이터입니다.

#### 부서 구조

```
대표이사
전략사업부
경영지원실
글로벌사업부
솔루션사업본부
  ├── 제품사업그룹
  │   ├── 제품팀
  │   └── 사업팀
  ├── 운영1그룹
  └── 운영2그룹
기획영업본부
외부조직
```

#### 테스트 사용자

모든 데모 사용자 비밀번호: `Demo123!`

| 이메일 | 이름 | 역할 | 부서 |
|--------|------|------|------|
| `orgadmin@demo.local` | 데모관리자 | ORG_ADMIN | 전략사업부 |
| `user1@demo.local` | 김테스트 | USER | 제품팀 |
| `user2@demo.local` | 이데모 | USER | 운영1그룹 |
| `user3@demo.local` | 박샘플 | USER | 경영지원실 |

#### 커스텀 권한그룹

| 그룹명 | 설명 |
|--------|------|
| 데모그룹-운영 | 플랫폼 공통 메뉴 write + 관리 일부 read |
| 데모그룹-뷰어 | 대시보드 + 도움말 read only |

#### 사용자-그룹 매핑

| 사용자 | 권한그룹 |
|--------|----------|
| orgadmin@demo.local | 조직 관리자, 데모그룹-운영 |
| user1@demo.local | 일반 사용자 |
| user2@demo.local | 일반 사용자, 데모그룹-운영 |
| user3@demo.local | 데모그룹-뷰어 |

#### 개별 권한 오버라이드

| 사용자 | 메뉴 | 접근 수준 |
|--------|------|-----------|
| orgadmin@demo.local | users | write |
| orgadmin@demo.local | organizations | write |
| user1@demo.local | settings | write |

---

## 4. Reset 동작

`--reset` 옵션은 **demo 레벨 전용**이며, 다음 데이터만 삭제합니다:

- `@test.com` 또는 `@demo.local` 이메일의 사용자 (cascade로 관련 매핑도 삭제)
- 이름이 `데모`로 시작하는 커스텀 권한그룹

**base 데이터(관리자 계정, 기본 회사, 시스템 설정)는 삭제되지 않습니다.**

reset 후 base → demo 순서로 시드가 다시 실행됩니다.

---

## 5. 마이그레이션과의 관계

시드 시스템은 마이그레이션이 생성하는 데이터와 역할이 분리되어 있습니다.

| 데이터 | 생성 주체 |
|--------|----------|
| menu_items (14개) | 마이그레이션 (p001, p007) |
| 기본 권한그룹 3개 (시스템 관리자, 조직 관리자, 일반 사용자) | 마이그레이션 (p006, p009) |
| 기본 권한그룹 grants | 마이그레이션 (p006, p007) |
| 시스템 알림 | 마이그레이션 (p021) |
| 기본 회사, 관리자 계정 | **시드 (base)** |
| 시스템 설정 | **시드 (base)** |
| 관리자-권한그룹 매핑 | **시드 (base)** |
| 부서, 테스트 사용자, 커스텀 그룹 | **시드 (demo)** |

**실행 순서**: 마이그레이션 → 시드. 시드는 마이그레이션이 생성한 테이블과 데이터에 의존합니다.

---

## 6. 앱별 Seed 분리 아키텍처

플랫폼 공통 시드(`demo.py`)는 **플랫폼 공통 메뉴만** 다룹니다. 앱 전용 메뉴의 section 설정이나 권한 grants는 각 앱의 마이그레이션(`a*.py`)에서 관리합니다.

### 분리 원칙

| 데이터 | 관리 위치 | 예시 |
|--------|----------|------|
| 플랫폼 공통 메뉴 section | `seeds/demo.py` | dashboard, settings, help, users |
| 플랫폼 공통 그룹 grants | `seeds/demo.py` | 데모그룹-운영 → dashboard:write |
| 앱 전용 메뉴 section | 앱 마이그레이션 (`a*.py`) | channels:basic, monitoring:admin |
| 앱 전용 그룹 grants | 앱 마이그레이션 (`a*.py`) | 데모그룹-운영 → channels:write |

### 앱 마이그레이션 예시 (v-channel-bridge)

`apps/v-channel-bridge/backend/migrations/a009_app_menu_grants.py`:

```python
APP_MENU_SECTIONS = [
    ("channels", "basic"),
    ("messages", "basic"),
    ("statistics", "basic"),
    ("integrations", "basic"),
    ("monitoring", "admin"),
]

DEMO_GROUP_GRANTS = {
    "데모그룹-운영": {
        "channels": "write",
        "messages": "write",
        "statistics": "write",
        "integrations": "write",
        "monitoring": "read",
    },
}
```

앱 마이그레이션은 반드시 `app_id = 'v-channel-bridge'` 필터를 포함하여 다른 앱의 메뉴에 영향을 주지 않도록 합니다.

### 새 앱에 메뉴 grants 추가하기

1. 앱의 `migrations/` 디렉토리에 `a[번호]_*.py` 파일 생성
2. `migrate(engine)` 함수 구현 — 해당 앱의 `app_id`로 필터링
3. 마이그레이션 러너가 `a[0-9]*.py` 패턴으로 자동 발견

---

## 7. 새로운 플랫폼 시드 데이터 추가하기

### base 레벨에 추가

`platform/backend/v_platform/seeds/base.py`의 `seed_base()` 함수에 새 함수를 추가합니다.

```python
def seed_base(conn):
    _seed_company(conn)
    _seed_admin_user(conn)
    _seed_system_settings(conn)
    _seed_admin_group_membership(conn)
    _seed_new_data(conn)           # 새로 추가

def _seed_new_data(conn):
    conn.execute(text("""
        INSERT INTO my_table (...)
        VALUES (...)
        ON CONFLICT (...) DO NOTHING
    """))
    logger.info("Base seed: new data")
```

### demo 레벨에 추가

`platform/backend/v_platform/seeds/demo.py`의 `seed_demo()` 함수에 추가합니다. 패턴은 동일합니다.

### 주의사항

- **반드시 idempotent하게 작성**: `ON CONFLICT DO NOTHING` 또는 `WHERE NOT EXISTS` 사용
- **FK 순서 준수**: companies → departments → users → 매핑 테이블 순서
- **이름 기반 참조**: 다른 테이블의 레코드를 참조할 때 하드코딩 ID 대신 이름으로 조회

```python
# 좋은 예: 이름으로 조회
conn.execute(text("""
    INSERT INTO user_group_memberships (user_id, permission_group_id, created_at)
    SELECT u.id, pg.id, NOW()
    FROM users u, permission_groups pg
    WHERE u.email = :email AND pg.name = :group_name
    ON CONFLICT (user_id, permission_group_id) DO NOTHING
"""), {"email": "user@example.com", "group_name": "일반 사용자"})

# 나쁜 예: 하드코딩 ID
conn.execute(text("""
    INSERT INTO user_group_memberships (user_id, permission_group_id, created_at)
    VALUES (5, 3, NOW())
"""))
```

---

## 8. 파일 구조

```
platform/backend/v_platform/seeds/
├── __init__.py      # 패키지 설명 + CLI 사용법 주석
├── __main__.py      # CLI 진입점 (python -m v_platform.seeds)
├── runner.py        # 오케스트레이터 (레벨 분기, reset, 검증)
├── base.py          # base 레벨 시드 (회사, 관리자, 설정)
└── demo.py          # demo 레벨 시드 (부서, 사용자, 플랫폼 공통 권한그룹)

apps/v-channel-bridge/backend/migrations/
├── a001~a008.py     # 기존 앱 마이그레이션
└── a009_app_menu_grants.py  # 앱 전용 메뉴 section + 데모그룹 grants
```
