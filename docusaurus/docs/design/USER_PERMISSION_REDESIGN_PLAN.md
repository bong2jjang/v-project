# 사용자·권한 관리 전면 재구성 설계서

> **작성일**: 2026-04-09  
> **상태**: 설계 (Design)  
> **범위**: Backend (모델, API, 서비스) + Frontend (페이지, 컴포넌트) + DB Migration  
> **기반 문서**: `RBAC_AND_CUSTOM_MENU_PLAN.md` (기존 RBAC 설계)

---

## 1. 배경 및 현재 상태

### 1.1 현재 시스템 요약

| 기능 | 현재 상태 | 한계 |
|------|-----------|------|
| 사용자 관리 | CRUD, 역할 변경, 페이징/검색 | 회사·부서 없음, 그룹 없음, 일괄 작업 불가 |
| 권한 매트릭스 | 사용자×메뉴 그리드, 클릭 토글 | 사용자별 뷰만 존재, 메뉴별 뷰 없음 |
| 역할 체계 | system_admin / org_admin / user | 커스텀 역할(그룹) 정의 불가 |
| 권한 위임 | org_admin → user (자신 범위 내) | 사용자 그룹 기반 일괄 부여 불가 |
| 메뉴 구조 | 3섹션(기본/관리/커스텀), 그룹 계층 | 권한 뷰에서 그룹 계층 미반영 |

### 1.2 현재 데이터 모델

```
User: id, email, username, role, is_active, auth_method, sso_provider, ...
MenuItem: id, permission_key, label, icon, path, menu_type, parent_key, section, ...
UserPermission: id, user_id, menu_item_id, access_level(none/read/write), granted_by
```

### 1.3 개선 요구사항 (5가지)

1. **사용자별 뷰 + 메뉴별 뷰** — 두 관점에서 권한 일괄 변경
2. **메뉴별 뷰에서 그룹 계층 표현** — menu_group 하위 메뉴 트리 구조 반영
3. **사용자별 뷰에서 개인/그룹 선택** — 특정 1명 또는 사용자 그룹 일괄 변경
4. **사용자 프로필 확장** — 회사, 부서(조직), 권한 그룹 필드 추가
5. **권한(역할) 그룹 정의** — 커스텀 그룹 생성, 디폴트 그룹은 보호

---

## 2. 데이터 모델 설계

### 2.1 신규 테이블

#### `companies` — 회사

```sql
CREATE TABLE companies (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL UNIQUE,
    code        VARCHAR(50)  NOT NULL UNIQUE,   -- 약칭 코드
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

#### `departments` — 부서(조직)

```sql
CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50),                     -- 조직 코드 (선택)
    parent_id   INTEGER      REFERENCES departments(id) ON DELETE SET NULL,
    sort_order  INTEGER      DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, name)
);
```

#### `permission_groups` — 권한(역할) 그룹

```sql
CREATE TABLE permission_groups (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,  -- 디폴트 그룹 표시 (수정·삭제 불가)
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by  INTEGER      REFERENCES users(id),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

**디폴트 그룹 (시드 데이터)**:

| name | description | 보호 |
|------|-------------|------|
| `전체 관리자` | 모든 메뉴 write 권한 | 수정·삭제 불가 |
| `운영자` | 기본 메뉴 write + 관리 메뉴 read | 수정·삭제 불가 |
| `뷰어` | 기본 메뉴 read 전용 | 수정·삭제 불가 |

#### `permission_group_grants` — 그룹별 메뉴 권한 매핑

```sql
CREATE TABLE permission_group_grants (
    id                  SERIAL PRIMARY KEY,
    permission_group_id INTEGER NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
    menu_item_id        INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    access_level        VARCHAR(10) NOT NULL DEFAULT 'none',  -- none / read / write
    UNIQUE(permission_group_id, menu_item_id)
);
```

#### `user_group_memberships` — 사용자↔그룹 연결

```sql
CREATE TABLE user_group_memberships (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_group_id INTEGER NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
    assigned_by         INTEGER REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, permission_group_id)
);
```

### 2.2 기존 테이블 변경

#### `users` — 회사, 부서 FK 추가

```sql
ALTER TABLE users
    ADD COLUMN company_id    INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
```

### 2.3 권한 해석 우선순위 (Effective Permission)

하나의 사용자에게 그룹 권한과 개인 권한이 동시에 존재할 수 있습니다.

```
최종 권한 = MAX(그룹 권한들, 개인 권한)
```

- **그룹 권한**: `user_group_memberships` → `permission_group_grants`로 조회
- **개인 권한**: 기존 `user_permissions` 테이블 (오버라이드 용도)
- **해석 순서**: 모든 소속 그룹의 access_level과 개인 오버라이드 중 **최고 수준** 적용
- **system_admin**: 여전히 무조건 write (DB 조회 없이 패스)

**예시**:
| 소스 | 메뉴 A 권한 |
|------|------------|
| 그룹 "운영자" | read |
| 그룹 "대시보드 관리자" | write |
| 개인 오버라이드 | — |
| **최종** | **write** |

### 2.4 ER 다이어그램

```
companies ──1:N── departments
    │                   │
    └──1:N── users ──N:M── permission_groups
                │                  │
                │           permission_group_grants ──N:1── menu_items
                │
                └── user_permissions ──N:1── menu_items
```

---

## 3. Backend API 설계

### 3.1 회사 관리 API

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/companies` | 회사 목록 | system_admin |
| POST | `/api/companies` | 회사 생성 | system_admin |
| PUT | `/api/companies/{id}` | 회사 수정 | system_admin |
| DELETE | `/api/companies/{id}` | 회사 삭제 | system_admin |

### 3.2 부서 관리 API

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/companies/{id}/departments` | 부서 트리 | system_admin, org_admin |
| POST | `/api/departments` | 부서 생성 | system_admin |
| PUT | `/api/departments/{id}` | 부서 수정 | system_admin |
| DELETE | `/api/departments/{id}` | 부서 삭제 | system_admin |

### 3.3 권한 그룹 API

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/permission-groups` | 그룹 목록 (grants 포함) | admin |
| POST | `/api/permission-groups` | 커스텀 그룹 생성 | system_admin |
| PUT | `/api/permission-groups/{id}` | 그룹 수정 (is_default=true면 403) | system_admin |
| DELETE | `/api/permission-groups/{id}` | 그룹 삭제 (is_default=true면 403) | system_admin |
| PUT | `/api/permission-groups/{id}/grants` | 그룹 메뉴 권한 일괄 설정 | system_admin |

### 3.4 사용자 확장 API

기존 API 확장:

| Method | Path | 변경 사항 |
|--------|------|-----------|
| GET | `/api/users` | 응답에 `company`, `department`, `groups[]` 포함 |
| POST | `/api/users` | 요청에 `company_id`, `department_id` 추가 |
| PUT | `/api/users/{id}` | `company_id`, `department_id` 수정 가능 |
| PUT | `/api/users/{id}/groups` | 사용자의 그룹 소속 일괄 설정 |
| GET | `/api/users/{id}/effective-permissions` | 최종 권한 계산 결과 |

### 3.5 권한 관리 API 확장

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/permissions/by-menu/{menu_id}` | 메뉴별 사용자 권한 목록 | admin |
| PUT | `/api/permissions/by-menu/{menu_id}` | 메뉴별 사용자 권한 일괄 설정 | admin |
| PUT | `/api/permissions/bulk/by-group/{group_id}` | 그룹 소속 전체에 권한 일괄 적용 | system_admin |
| GET | `/api/permissions/effective-matrix` | 유효 권한 매트릭스 (그룹+개인 통합) | admin |

### 3.6 PermissionService 확장

```python
class PermissionService:
    # 기존 메서드 유지 + 아래 추가
    
    @staticmethod
    def get_effective_permission(db, user_id, menu_item_id) -> str:
        """그룹 권한 + 개인 오버라이드 → 최종 access_level 계산"""
        
    @staticmethod
    def get_effective_permissions_for_user(db, user_id) -> dict[str, str]:
        """사용자의 전체 메뉴 유효 권한 맵"""
        
    @staticmethod
    def get_users_by_menu(db, menu_item_id) -> list[dict]:
        """특정 메뉴에 대한 모든 사용자의 유효 권한"""
        
    @staticmethod
    def apply_group_template(db, group_id, user_ids, current_user) -> None:
        """그룹의 권한 템플릿을 여러 사용자에게 일괄 적용"""
```

---

## 4. Frontend 페이지 설계

### 4.1 전체 페이지 구성

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/admin/users` | 사용자 관리 | 사용자 CRUD + 회사/부서/그룹 설정 |
| `/admin/permissions` | 권한 관리 (통합) | 사용자별 뷰 ↔ 메뉴별 뷰 전환 |
| `/admin/permission-groups` | 권한 그룹 관리 | 그룹 CRUD + 메뉴 권한 템플릿 정의 |
| `/admin/organizations` | 조직 관리 | 회사/부서 CRUD |

### 4.2 사용자 관리 페이지 (`/admin/users`)

기존 `UserManagement.tsx` 확장.

#### 변경 사항

```
┌─────────────────────────────────────────────────────┐
│ 사용자 관리                            [+ 사용자 추가]│
├─────────────────────────────────────────────────────┤
│ [검색]  [역할 ▼]  [회사 ▼]  [부서 ▼]  [그룹 ▼]     │
├────┬──────────┬──────┬──────┬──────┬──────┬─────────┤
│ □  │ 사용자명  │ 이메일│ 회사 │ 부서  │ 역할 │ 그룹    │
│ □  │ 홍길동    │ h@.. │ VMS  │ 개발팀│ user │ 운영자  │
│ □  │ 김영희    │ k@.. │ ACME │ 인프라│ user │ 뷰어   │
├────┴──────────┴──────┴──────┴──────┴──────┴─────────┤
│ □ 전체 선택    [일괄 그룹 지정 ▼] [일괄 비활성화]     │
│                              페이지네이션 1/5          │
└─────────────────────────────────────────────────────┘
```

**추가 기능**:
- 회사, 부서, 그룹 필터 드롭다운
- 체크박스 선택 → 일괄 그룹 지정 / 일괄 비활성화
- 사용자 생성/수정 모달에 회사, 부서, 권한 그룹 필드

#### 사용자 생성/수정 모달

```
┌──────── 사용자 수정 ─────────┐
│ 이메일:    hong@example.com  │
│ 사용자명:  홍길동             │
│ 역할:     [user ▼]           │
│                              │
│ ── 조직 정보 ──              │
│ 회사:     [VMS ▼]            │
│ 부서:     [개발팀 ▼]         │
│                              │
│ ── 권한 그룹 ──              │
│ [✓] 운영자                   │
│ [ ] 뷰어                    │
│ [✓] 대시보드 관리자          │
│                              │
│       [취소]  [저장]          │
└──────────────────────────────┘
```

### 4.3 권한 관리 페이지 (`/admin/permissions`)

기존 `PermissionMatrix.tsx`를 대체하는 통합 권한 관리 페이지.

#### 4.3.1 상단 뷰 전환

```
┌──────────────────────────────────────────────┐
│ 권한 관리                                     │
│ [● 사용자별 뷰]  [○ 메뉴별 뷰]               │
└──────────────────────────────────────────────┘
```

#### 4.3.2 사용자별 뷰 (User View)

특정 사용자 1명 또는 그룹을 선택 → 해당 대상의 전체 메뉴 권한을 보고 일괄 변경.

```
┌─────────────────────────────────────────────────────────────┐
│ 대상 선택:  [○ 개별 사용자] [○ 권한 그룹]                    │
│                                                             │
│ (개별 사용자 선택 시)                                        │
│ 사용자:  [홍길동 (hong@example.com) ▼]                       │
│                                                             │
│ (권한 그룹 선택 시)                                          │
│ 그룹:    [운영자 ▼]  소속 인원: 12명                         │
│ ⚠️ 그룹 권한 변경은 그룹 정의 자체를 수정합니다               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── 기본 메뉴 ─────────────────────────────────              │
│   대시보드              [none ○] [read ●] [write ○]         │
│   채널 관리             [none ○] [read ○] [write ●]         │
│   메시지                [none ○] [read ●] [write ○]         │
│                                                             │
│ ── 관리 메뉴 ─────────────────────────────────              │
│   사용자 관리           [none ●] [read ○] [write ○]         │
│   감사 로그             [none ○] [read ●] [write ○]         │
│                                                             │
│ ── 커스텀 메뉴 ────────────────────────────────             │
│   📁 모니터링 그룹                                          │
│     ├─ Grafana 대시보드 [none ○] [read ●] [write ○]         │
│     └─ Kibana 로그     [none ●] [read ○] [write ○]         │
│   Wiki 바로가기         [none ○] [read ●] [write ○]         │
│                                                             │
│ 유효 권한 출처: 🔵 = 개인 설정, 🟢 = 그룹(운영자) 상속      │
│                                                             │
│           [초기화]                        [변경 반영]         │
└─────────────────────────────────────────────────────────────┘
```

**핵심 기능**:
- **대상 전환**: "개별 사용자" / "권한 그룹" 라디오
  - 개별 사용자: 검색 가능한 드롭다운 (email, username 검색)
  - 권한 그룹: 드롭다운 + 소속 인원 표시
- **권한 출처 표시**: 각 메뉴 행에 아이콘으로 개인/그룹/혼합 표시
  - 🔵 개인 오버라이드
  - 🟢 그룹 상속 (어떤 그룹인지 툴팁)
  - 유효 권한 = MAX(개인, 그룹들)
- **메뉴 계층 표현**: 섹션별 구분 + menu_group 들여쓰기
- **로컬 상태 패턴**: 변경 사항을 로컬에서 누적 → "변경 반영" 버튼으로 일괄 저장

#### 4.3.3 메뉴별 뷰 (Menu View)

특정 메뉴 1개를 선택 → 해당 메뉴에 접근 가능한 모든 사용자를 보고 일괄 변경.

```
┌─────────────────────────────────────────────────────────────┐
│ 메뉴 선택 (트리):                                            │
│                                                             │
│ ── 기본 메뉴 ──                                             │
│   ○ 대시보드                                                │
│   ● 채널 관리              ← 선택됨                          │
│   ○ 메시지                                                  │
│                                                             │
│ ── 관리 메뉴 ──                                             │
│   ○ 사용자 관리                                              │
│   ○ 감사 로그                                               │
│                                                             │
│ ── 커스텀 메뉴 ──                                           │
│   📁 모니터링 그룹                                          │
│     ├─ ○ Grafana 대시보드                                   │
│     └─ ○ Kibana 로그                                        │
│   ○ Wiki 바로가기                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📋 "채널 관리" 권한 현황                                     │
│                                                             │
│ [검색] [역할 ▼] [회사 ▼] [그룹 ▼] [권한 수준 ▼]            │
│                                                             │
│ ┌────┬──────────┬──────────┬──────┬────────┬──────────────┐ │
│ │ □  │ 사용자명  │ 이메일    │ 그룹 │ 유효권한│ 출처         │ │
│ │ □  │ 홍길동    │ h@..     │ 운영자│ write  │ 🟢 그룹     │ │
│ │ □  │ 김영희    │ k@..     │ 뷰어  │ read   │ 🔵 개인     │ │
│ │ □  │ 이철수    │ l@..     │ —     │ none   │ —           │ │
│ └────┴──────────┴──────────┴──────┴────────┴──────────────┘ │
│                                                             │
│ □ 전체 선택  선택된 3명: [일괄 권한 변경 ▼ read]             │
│                                                             │
│           [초기화]                        [변경 반영]         │
└─────────────────────────────────────────────────────────────┘
```

**핵심 기능**:
- **좌측 메뉴 트리**: 섹션별 분류 + menu_group 계층 구조 반영
  - menu_group은 폴더 아이콘(📁)으로 표시, 하위 메뉴 들여쓰기
  - menu_group 자체는 선택 불가 (컨테이너), 하위 메뉴만 선택 가능
- **우측 사용자 테이블**: 선택된 메뉴에 대한 모든 사용자의 권한 상태
- **필터링**: 역할, 회사, 그룹, 현재 권한 수준으로 필터
- **체크박스 + 일괄 변경**: 여러 사용자 선택 → 드롭다운으로 권한 수준 일괄 설정
- **권한 출처**: 개인 오버라이드 vs 그룹 상속 구분 표시

### 4.4 권한 그룹 관리 페이지 (`/admin/permission-groups`)

권한 그룹 정의 및 메뉴별 권한 템플릿 설정.

```
┌──────────────────────────────────────────────────────────────┐
│ 권한 그룹 관리                         [+ 그룹 추가]          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────┬──────────┬──────┬────────┬────────────────┐ │
│ │ 그룹명       │ 설명     │ 인원 │ 유형    │ 액션           │ │
│ │ 전체 관리자   │ 모든 ... │ 3    │ 🔒기본 │ [상세]         │ │
│ │ 운영자       │ 기본 ... │ 12   │ 🔒기본 │ [상세]         │ │
│ │ 뷰어         │ 읽기 ... │ 25   │ 🔒기본 │ [상세]         │ │
│ │ 대시보드관리자│ Grafana..│ 5    │ 커스텀  │ [수정][삭제]   │ │
│ └──────────────┴──────────┴──────┴────────┴────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 그룹 상세/수정 모달

```
┌────────── 그룹 수정: 대시보드 관리자 ──────────┐
│                                               │
│ 그룹명:    대시보드 관리자                      │
│ 설명:      Grafana, Kibana 접근 권한           │
│                                               │
│ ── 메뉴 권한 설정 ──                           │
│                                               │
│ [기본 메뉴]                                    │
│   대시보드          [none ○] [read ●] [write ○]│
│   채널 관리         [none ●] [read ○] [write ○]│
│   메시지            [none ●] [read ○] [write ○]│
│                                               │
│ [커스텀 메뉴]                                  │
│   📁 모니터링 그룹                              │
│     ├─ Grafana     [none ○] [read ○] [write ●]│
│     └─ Kibana      [none ○] [read ●] [write ○]│
│                                               │
│ ── 소속 사용자 (5명) ──                         │
│   홍길동, 김영희, 이철수, 박민수, 정수진         │
│                                               │
│            [취소]              [저장]            │
└───────────────────────────────────────────────┘
```

**디폴트 그룹 보호**:
- `is_default=true` 그룹: 이름/설명/권한 설정 변경 불가, 삭제 불가
- UI에서 🔒 아이콘 표시, 수정/삭제 버튼 비활성화
- 상세 보기는 가능 (소속 사용자 확인 등)

### 4.5 조직 관리 페이지 (`/admin/organizations`)

회사 및 부서 트리 관리.

```
┌──────────────────────────────────────────────────────────────┐
│ 조직 관리                              [+ 회사 추가]          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 🏢 VMS (vms)                                     [수정]     │
│   ├─ 개발팀                               [수정] [삭제]      │
│   ├─ 인프라팀                             [수정] [삭제]      │
│   └─ [+ 부서 추가]                                           │
│                                                              │
│ 🏢 ACME Corp (acme)                              [수정]     │
│   ├─ 운영팀                               [수정] [삭제]      │
│   └─ [+ 부서 추가]                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 프론트엔드 컴포넌트 구조

### 5.1 신규 컴포넌트

```
frontend/src/
├── components/
│   ├── admin/
│   │   ├── permissions/
│   │   │   ├── UserPermissionView.tsx      # 사용자별 뷰
│   │   │   ├── MenuPermissionView.tsx      # 메뉴별 뷰
│   │   │   ├── MenuTreeSelector.tsx        # 메뉴 트리 (계층 표현)
│   │   │   ├── UserSelector.tsx            # 사용자/그룹 선택 드롭다운
│   │   │   ├── AccessLevelRadio.tsx        # none/read/write 라디오 그룹
│   │   │   └── PermissionSourceBadge.tsx   # 권한 출처 배지 (개인/그룹)
│   │   ├── groups/
│   │   │   ├── GroupFormModal.tsx           # 그룹 생성/수정 모달
│   │   │   └── GroupGrantsEditor.tsx        # 그룹 내 메뉴 권한 에디터
│   │   └── organizations/
│   │       ├── CompanyFormModal.tsx         # 회사 생성/수정 모달
│   │       └── DepartmentTree.tsx          # 부서 트리 컴포넌트
│   └── ui/
│       └── TreeView.tsx                    # 범용 트리 뷰 컴포넌트
├── pages/
│   ├── admin/
│   │   ├── PermissionManagement.tsx        # 통합 권한 관리 (기존 PermissionMatrix 대체)
│   │   ├── PermissionGroups.tsx            # 권한 그룹 관리
│   │   └── Organizations.tsx              # 조직 관리 (회사/부서)
│   └── UserManagement.tsx                 # 기존 확장 (회사/부서/그룹 필드)
├── store/
│   └── permission.ts                      # 기존 확장 (그룹 정보 포함)
└── lib/api/
    ├── permissions.ts                     # 기존 확장 (메뉴별 뷰, 유효 권한)
    ├── permission-groups.ts               # 신규: 그룹 CRUD API
    └── organizations.ts                   # 신규: 회사/부서 API
```

### 5.2 상태 관리

#### 권한 관리 페이지 로컬 상태

```typescript
// PermissionManagement.tsx 내부 상태
interface PermissionPageState {
  viewMode: "user" | "menu";                    // 뷰 전환
  // 사용자별 뷰
  targetType: "individual" | "group";           // 개인/그룹 선택
  selectedUserId: number | null;                // 선택된 사용자
  selectedGroupId: number | null;               // 선택된 그룹
  // 메뉴별 뷰
  selectedMenuId: number | null;                // 선택된 메뉴
  selectedUserIds: Set<number>;                 // 체크된 사용자 (일괄 변경용)
  // 공통
  pendingChanges: Map<string, AccessLevel>;     // "userId:menuId" → level
  isDirty: boolean;                             // 미저장 변경 존재
}
```

#### Permission Store 확장

```typescript
interface PermissionState {
  // 기존 필드 유지
  menus: MenuItemResponse[];
  permissions: Record<string, AccessLevel>;
  isLoaded: boolean;
  isLoading: boolean;
  
  // 추가 필드
  groups: PermissionGroup[];                   // 전체 그룹 목록
  userGroups: number[];                        // 현재 사용자의 소속 그룹 ID
  effectivePermissions: Record<string, {       // 유효 권한 (출처 포함)
    level: AccessLevel;
    source: "personal" | "group" | "mixed";
    groupNames?: string[];
  }>;
}
```

### 5.3 신규 API 타입

```typescript
// types.ts 추가

interface Company {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

interface Department {
  id: number;
  company_id: number;
  name: string;
  code: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
  children?: Department[];    // 트리 빌드용
}

interface PermissionGroup {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  member_count: number;       // 소속 인원 수
  grants: PermissionGroupGrant[];
}

interface PermissionGroupGrant {
  menu_item_id: number;
  permission_key: string;
  menu_label: string;
  access_level: AccessLevel;
}

interface EffectivePermission {
  menu_item_id: number;
  permission_key: string;
  access_level: AccessLevel;
  source: "personal" | "group" | "mixed";
  group_names?: string[];     // 그룹 상속 시 출처 그룹 이름
}

// User 인터페이스 확장
interface User {
  // ... 기존 필드
  company_id?: number | null;
  department_id?: number | null;
  company?: Company | null;
  department?: Department | null;
  groups?: PermissionGroup[];
}
```

---

## 6. 메뉴 트리 & 권한 계층 표현

### 6.1 MenuTreeSelector 컴포넌트

메뉴별 뷰에서 사용하는 트리 선택기. 기존 `MenuManagement.tsx`의 `buildMenuTree()` 로직을 재사용.

```typescript
interface MenuTreeNode {
  menu: MenuItemResponse;
  children: MenuTreeNode[];
  depth: number;
}

function buildMenuTreeBySection(menus: MenuItemResponse[]): {
  basic: MenuTreeNode[];
  admin: MenuTreeNode[];
  custom: MenuTreeNode[];
}
```

렌더링 규칙:
- **섹션 헤더**: "기본 메뉴", "관리 메뉴", "커스텀 메뉴"
- **menu_group**: 📁 아이콘, 클릭 시 확장/축소, 선택 불가
- **일반 메뉴**: 라디오 선택 가능, depth에 따라 들여쓰기 (pl-4 * depth)
- **비활성 메뉴**: 회색 텍스트, 선택 불가

### 6.2 사용자별 뷰의 권한 목록

사용자별 뷰에서 메뉴를 나열할 때도 섹션 + 그룹 계층 유지:

```typescript
function renderMenuPermissionList(
  menus: MenuItemResponse[],
  permissions: Map<number, EffectivePermission>,
  onChange: (menuId: number, level: AccessLevel) => void
)
```

- 섹션별 그룹화 (기본/관리/커스텀)
- menu_group → 들여쓰기된 하위 메뉴
- 각 메뉴 행: `[메뉴명] [none ○] [read ○] [write ○] [출처 배지]`

---

## 7. 위임 규칙 확장

### 7.1 현재 위임 규칙 (유지)

| 역할 | 대상 | 범위 |
|------|------|------|
| system_admin | 모든 사용자 | 제한 없음 |
| org_admin | user 역할만 | 자신의 권한 이하만 부여 가능 |

### 7.2 추가 위임 규칙

| 시나리오 | 규칙 |
|----------|------|
| 그룹 CRUD | system_admin만 가능 |
| 디폴트 그룹 수정 | 불가 (system_admin 포함) |
| 그룹 소속 변경 | system_admin: 제한 없음, org_admin: user에게만 |
| 개인 오버라이드 | 기존 위임 규칙과 동일 |
| 메뉴별 뷰 일괄 변경 | 위임 규칙 적용 (org_admin은 자기 범위 내) |

---

## 8. DB Migration 계획

### Migration 012: 조직 테이블

```python
def migrate(engine):
    """companies, departments 테이블 생성, users에 FK 추가"""
    # 1. companies 테이블 생성
    # 2. departments 테이블 생성
    # 3. users에 company_id, department_id 컬럼 추가
```

### Migration 013: 권한 그룹

```python
def migrate(engine):
    """permission_groups, permission_group_grants, user_group_memberships 생성 + 시드"""
    # 1. permission_groups 테이블 생성
    # 2. permission_group_grants 테이블 생성
    # 3. user_group_memberships 테이블 생성
    # 4. 디폴트 그룹 시드 데이터 삽입
    #    - "전체 관리자" (is_default=true): 전체 메뉴 write
    #    - "운영자" (is_default=true): 기본 메뉴 write + 관리 메뉴 read
    #    - "뷰어" (is_default=true): 기본 메뉴 read
```

---

## 9. 구현 단계

### Phase 1: 기반 (데이터 모델 + API)

| 단계 | 작업 | 예상 파일 |
|------|------|-----------|
| 1-1 | Migration 012: companies, departments | `migrations/012_organizations.py` |
| 1-2 | Migration 013: permission_groups, grants, memberships | `migrations/013_permission_groups.py` |
| 1-3 | Backend 모델: Company, Department, PermissionGroup | `models/company.py`, `models/department.py`, `models/permission_group.py` |
| 1-4 | User 모델 확장 (company_id, department_id, groups relationship) | `models/user.py` |
| 1-5 | API: 회사/부서 CRUD | `api/organizations.py` |
| 1-6 | API: 권한 그룹 CRUD + grants 설정 | `api/permission_groups.py` |
| 1-7 | PermissionService 확장: 유효 권한 계산, 메뉴별 조회 | `services/permission_service.py` |
| 1-8 | 기존 users API 확장: company, department, groups 필드 | `api/users.py`, `schemas/user.py` |

### Phase 2: 프론트엔드 (사용자 관리 개선)

| 단계 | 작업 | 예상 파일 |
|------|------|-----------|
| 2-1 | 타입 정의 추가 | `lib/api/types.ts` |
| 2-2 | API 클라이언트: 조직, 그룹 | `lib/api/organizations.ts`, `lib/api/permission-groups.ts` |
| 2-3 | UserManagement 확장: 회사/부서/그룹 필터, 일괄 작업 | `pages/UserManagement.tsx` |
| 2-4 | 사용자 생성/수정 모달 확장 | `components/admin/UserFormModal.tsx` |

### Phase 3: 프론트엔드 (권한 관리 재구성)

| 단계 | 작업 | 예상 파일 |
|------|------|-----------|
| 3-1 | MenuTreeSelector 컴포넌트 | `components/admin/permissions/MenuTreeSelector.tsx` |
| 3-2 | UserSelector 컴포넌트 (검색 드롭다운) | `components/admin/permissions/UserSelector.tsx` |
| 3-3 | AccessLevelRadio, PermissionSourceBadge | `components/admin/permissions/` |
| 3-4 | 사용자별 뷰 (UserPermissionView) | `components/admin/permissions/UserPermissionView.tsx` |
| 3-5 | 메뉴별 뷰 (MenuPermissionView) | `components/admin/permissions/MenuPermissionView.tsx` |
| 3-6 | 통합 PermissionManagement 페이지 | `pages/admin/PermissionManagement.tsx` |

### Phase 4: 프론트엔드 (그룹 + 조직 관리)

| 단계 | 작업 | 예상 파일 |
|------|------|-----------|
| 4-1 | 권한 그룹 관리 페이지 | `pages/admin/PermissionGroups.tsx` |
| 4-2 | 그룹 생성/수정 모달 + 권한 에디터 | `components/admin/groups/` |
| 4-3 | 조직 관리 페이지 (회사/부서 트리) | `pages/admin/Organizations.tsx` |
| 4-4 | 사이드바 메뉴 항목 추가 + 라우팅 | `navigation.tsx`, `App.tsx` |

### Phase 5: 통합 테스트 + 마이그레이션

| 단계 | 작업 |
|------|------|
| 5-1 | 유효 권한 계산 단위 테스트 (그룹+개인 병합) |
| 5-2 | 위임 규칙 테스트 (org_admin 범위 제한) |
| 5-3 | 기존 user_permissions 데이터 호환성 검증 |
| 5-4 | Permission Store 확장 → 사이드바 연동 확인 |

---

## 10. 하위 호환성

### 10.1 데이터 호환

- 기존 `user_permissions` 테이블 **변경 없음** — 개인 오버라이드로 계속 사용
- 기존 `users` 테이블에 `company_id`, `department_id` 추가 (nullable) — 기존 사용자에 영향 없음
- 기존 `UserRole` enum (system_admin, org_admin, user) **변경 없음**

### 10.2 API 호환

- 기존 `/api/permissions/me`, `/api/permissions/matrix` 엔드포인트 유지
- `/api/users` 응답에 새 필드 추가 (기존 필드 변경 없음)
- 새 기능은 모두 새 엔드포인트로 제공

### 10.3 점진적 마이그레이션

- 회사/부서/그룹 미설정 상태에서도 기존 권한 체계 정상 동작
- 그룹을 활용하지 않으면 기존 개인 권한만으로 운영 가능
- 그룹 도입 후에도 개인 오버라이드로 예외 처리 가능

---

## 부록: 용어 정리

| 용어 | 설명 |
|------|------|
| 권한 그룹 (Permission Group) | 메뉴 권한 프리셋. 사용자에게 일괄 적용 |
| 디폴트 그룹 | 시스템이 제공하는 기본 그룹. 수정·삭제 불가 |
| 유효 권한 (Effective Permission) | 그룹 + 개인 오버라이드의 MAX 결과 |
| 개인 오버라이드 | `user_permissions` 테이블의 직접 설정 |
| 위임 규칙 | org_admin이 부여 가능한 범위 제한 |
