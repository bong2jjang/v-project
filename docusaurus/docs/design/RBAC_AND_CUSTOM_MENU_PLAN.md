# RBAC 권한 관리 및 커스텀 메뉴 시스템 설계

> **작성일**: 2026-04-09  
> **상태**: 설계 (Design)  
> **범위**: Backend + Frontend + DB Migration

---

## 1. 배경 및 목표

### 현재 상태
- 역할: `admin` / `user` 2단계만 존재
- 권한 체크: admin인지 아닌지만 판별 (`get_current_active_admin()`)
- 프론트엔드: `ProtectedRoute`의 `requiredRole="admin"` 하드코딩
- 페이지별/기능별 세분화된 권한 없음
- 외부 시스템 연동 메뉴 기능 없음

### 목표
1. **3단계 역할 체계**: 시스템관리자 → 운영관리자 → 일반사용자
2. **페이지별 읽기/쓰기 권한**: 메뉴 단위로 접근(읽기) · 수정(쓰기) 분리
3. **위임형 권한 관리**: 운영관리자가 일반사용자에게 자신의 권한 범위 내에서 부여
4. **커스텀 메뉴(iframe)**: 외부 시스템 화면을 메뉴로 등록·관리

---

## 2. 역할(Role) 체계

### 2.1 역할 정의

| 역할 | enum 값 | 설명 | 권한 범위 |
|------|---------|------|-----------|
| **시스템관리자** | `system_admin` | 개발사(VMS) 관리자 | 모든 권한 자동 획득, 권한 체크 패스 |
| **운영관리자** | `org_admin` | 고객사 관리자 | 시스템관리자가 부여한 메뉴 범위 내 전권 + 일반사용자 권한 관리 |
| **일반사용자** | `user` | 일반 사용자 | 운영관리자가 부여한 메뉴만 접근 |

### 2.2 역할 간 관계

```
시스템관리자 (system_admin)
  ├── 모든 권한 자동 획득 (DB 조회 없이 패스)
  ├── 운영관리자에게 메뉴 권한 부여 (온보딩)
  ├── 커스텀 메뉴 등록/관리
  └── 사용자 역할 변경
  
운영관리자 (org_admin)
  ├── 부여받은 메뉴만 접근 가능
  ├── 일반사용자에게 자신의 권한 범위 내에서 부여
  └── 일반사용자 관리 (자신이 관리하는 사용자)

일반사용자 (user)
  └── 부여받은 메뉴만 접근 (읽기/쓰기 구분)
```

### 2.3 기존 역할 마이그레이션

| 기존 역할 | 변환 대상 | 비고 |
|-----------|-----------|------|
| `admin` | `system_admin` | 기존 어드민은 시스템관리자로 승격 |
| `user` | `user` | 유지 |

---

## 3. 권한(Permission) 모델

### 3.1 메뉴(페이지) 식별자

각 페이지/기능에 고유한 `permission_key`를 부여합니다.

| permission_key | 페이지/기능 | 기본 분류 |
|----------------|------------|-----------|
| `dashboard` | 대시보드 | 기본 메뉴 |
| `channels` | 채널 관리 | 핵심 기능 |
| `messages` | 메시지 히스토리 | 핵심 기능 |
| `statistics` | 통계 | 분석 |
| `integrations` | 연동 관리 | 설정 |
| `settings` | 설정 | 설정 |
| `help` | 도움말 | 기본 메뉴 |
| `users` | 사용자 관리 | 관리 |
| `audit_logs` | 감사 로그 | 관리 |
| `monitoring` | 모니터링 | 관리 |
| `custom:{id}` | 커스텀 메뉴 | 동적 |

### 3.2 권한 수준

| 수준 | enum 값 | 설명 |
|------|---------|------|
| **없음** | `none` | 접근 불가 (메뉴 미표시) |
| **읽기** | `read` | 조회만 가능 (쓰기 UI 비활성화) |
| **쓰기** | `write` | 조회 + 생성/수정/삭제 가능 |

> `write`는 `read`를 포함합니다. 즉, `write` 권한이 있으면 자동으로 읽기도 가능합니다.

### 3.3 권한 해석 흐름

```
요청 수신
  │
  ├─ role == system_admin? → ✅ 무조건 허용 (DB 조회 없음)
  │
  ├─ role == org_admin?
  │   └─ user_permissions에서 해당 메뉴 권한 조회
  │       ├─ write → ✅ 허용
  │       ├─ read → 조회만 허용 (쓰기 요청 시 403)
  │       └─ 없음 → ❌ 403
  │
  └─ role == user?
      └─ user_permissions에서 해당 메뉴 권한 조회
          ├─ write → ✅ 허용
          ├─ read → 조회만 허용
          └─ 없음 → ❌ 403
```

### 3.4 위임 규칙

운영관리자가 일반사용자에게 권한을 부여할 때:

- **원칙**: 자신이 가진 권한 이하만 부여 가능
- 자신이 `read`인 메뉴 → 일반사용자에게 `read`만 부여 가능
- 자신이 `write`인 메뉴 → 일반사용자에게 `read` 또는 `write` 부여 가능
- 자신에게 없는 메뉴 → 부여 불가

---

## 4. 데이터베이스 스키마

### 4.1 UserRole enum 변경

```python
class UserRole(str, Enum):
    SYSTEM_ADMIN = "system_admin"  # 개발사 관리자
    ORG_ADMIN = "org_admin"        # 운영관리자 (고객사)
    USER = "user"                  # 일반사용자
```

### 4.2 신규 테이블: `menu_items` (메뉴 마스터)

커스텀 메뉴 포함, 전체 메뉴 목록을 관리합니다.

```sql
CREATE TABLE menu_items (
    id              SERIAL PRIMARY KEY,
    permission_key  VARCHAR(100) UNIQUE NOT NULL,   -- 'dashboard', 'channels', 'custom:3'
    label           VARCHAR(200) NOT NULL,           -- 표시 이름
    icon            VARCHAR(100),                    -- Lucide 아이콘명
    path            VARCHAR(500) NOT NULL,           -- 라우트 경로 '/dashboard'
    menu_type       VARCHAR(20) NOT NULL DEFAULT 'built_in',  -- 'built_in' | 'custom_iframe' | 'custom_link'
    iframe_url      TEXT,                            -- iframe 타입일 때 외부 URL
    open_in_new_tab BOOLEAN DEFAULT FALSE,           -- 새 탭 열기 (link 타입)
    parent_key      VARCHAR(100),                    -- 그룹핑용 (선택)
    sort_order      INTEGER DEFAULT 0,               -- 정렬 순서
    is_active       BOOLEAN DEFAULT TRUE,            -- 활성화 여부
    visible_to_roles JSON,                           -- null이면 모든 역할, ['org_admin','user'] 등
    created_by      INTEGER REFERENCES users(id),
    updated_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

> **built_in 메뉴**: 앱 시작 시 시드(seed) 데이터로 생성. `permission_key`와 `path`가 프론트엔드 라우트와 매핑.  
> **custom_iframe 메뉴**: 시스템관리자가 등록. `iframe_url`로 외부 화면 표시.  
> **custom_link 메뉴**: 외부 URL을 새 탭으로 오픈.

### 4.3 신규 테이블: `user_permissions` (사용자별 메뉴 권한)

```sql
CREATE TABLE user_permissions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    access_level    VARCHAR(10) NOT NULL DEFAULT 'none',  -- 'none' | 'read' | 'write'
    granted_by      INTEGER REFERENCES users(id),          -- 누가 부여했는지
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, menu_item_id)
);
```

### 4.4 ER 다이어그램

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   users      │       │ user_permissions  │       │ menu_items   │
├─────────────┤       ├──────────────────┤       ├─────────────┤
│ id (PK)      │──┐   │ id (PK)           │   ┌──│ id (PK)      │
│ email         │  │   │ user_id (FK)  ────│───┘  │ permission_key│
│ username      │  └───│ menu_item_id (FK) │      │ label         │
│ role          │      │ access_level      │      │ menu_type     │
│ is_active     │      │ granted_by (FK)───│──┐   │ iframe_url    │
│ ...           │      │ created_at        │  │   │ path          │
└─────────────┘      │ updated_at        │  │   │ sort_order    │
                       └──────────────────┘  │   │ is_active     │
                              ┌───────────────┘   │ ...           │
                              │                    └─────────────┘
                         granted_by → users.id
```

### 4.5 마이그레이션 계획

**Migration 008**: `alter_user_role_and_add_rbac`

```
1. UserRole enum 변경: admin → system_admin, 신규 org_admin 추가
2. 기존 admin 사용자 → system_admin으로 업데이트
3. menu_items 테이블 생성 + built_in 시드 데이터 삽입
4. user_permissions 테이블 생성
```

---

## 5. Backend API 설계

### 5.1 권한 확인 의존성 (Dependencies)

```python
# 기존
get_current_active_admin()  # role == admin 체크

# 신규
def require_permission(permission_key: str, level: str = "read"):
    """페이지별 권한 체크 의존성 팩토리"""
    async def checker(current_user = Depends(get_current_user)):
        # system_admin → 패스
        if current_user.role == UserRole.SYSTEM_ADMIN:
            return current_user
        # DB에서 user_permissions 조회
        perm = get_user_permission(current_user.id, permission_key)
        if level == "write" and perm.access_level != "write":
            raise HTTPException(403)
        if level == "read" and perm.access_level not in ("read", "write"):
            raise HTTPException(403)
        return current_user
    return checker

# 사용 예시
@router.get("/api/channels")
async def list_channels(user = Depends(require_permission("channels", "read"))):
    ...

@router.post("/api/channels")
async def create_channel(user = Depends(require_permission("channels", "write"))):
    ...
```

### 5.2 API 엔드포인트

#### 5.2.1 메뉴 관리 (`/api/menus`)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| `GET` | `/api/menus` | 인증된 사용자 | 현재 사용자가 접근 가능한 메뉴 목록 (권한 필터링) |
| `GET` | `/api/menus/all` | system_admin | 전체 메뉴 목록 (관리용) |
| `POST` | `/api/menus` | system_admin | 커스텀 메뉴 등록 |
| `PUT` | `/api/menus/{id}` | system_admin | 메뉴 수정 |
| `DELETE` | `/api/menus/{id}` | system_admin | 커스텀 메뉴 삭제 (built_in 삭제 불가) |
| `PUT` | `/api/menus/reorder` | system_admin | 메뉴 순서 변경 |

#### 5.2.2 권한 관리 (`/api/permissions`)

| Method | Path | 권한 | 설명 |
|--------|------|------|------|
| `GET` | `/api/permissions/user/{user_id}` | system_admin, org_admin | 특정 사용자의 권한 목록 |
| `GET` | `/api/permissions/me` | 인증된 사용자 | 내 권한 목록 |
| `PUT` | `/api/permissions/user/{user_id}` | system_admin, org_admin | 사용자 권한 일괄 설정 |
| `GET` | `/api/permissions/matrix` | system_admin | 전체 사용자×메뉴 권한 매트릭스 |

#### 5.2.3 권한 부여 규칙 (서버 검증)

```python
async def set_user_permissions(
    target_user_id: int,
    permissions: list[PermissionGrant],
    current_user: User
):
    target_user = get_user(target_user_id)
    
    # system_admin → 모든 사용자에게 모든 권한 부여 가능
    if current_user.role == UserRole.SYSTEM_ADMIN:
        apply_permissions(target_user_id, permissions)
        return
    
    # org_admin → user에게만, 자신의 권한 범위 내에서만
    if current_user.role == UserRole.ORG_ADMIN:
        if target_user.role != UserRole.USER:
            raise HTTPException(403, "운영관리자는 일반사용자에게만 권한을 부여할 수 있습니다")
        
        my_perms = get_user_permissions(current_user.id)
        for grant in permissions:
            my_level = my_perms.get(grant.menu_item_id)
            if not my_level or ACCESS_LEVELS[grant.access_level] > ACCESS_LEVELS[my_level]:
                raise HTTPException(403, f"자신의 권한을 초과하여 부여할 수 없습니다")
        
        apply_permissions(target_user_id, permissions)
        return
    
    raise HTTPException(403)
```

### 5.3 JWT 토큰 변경

기존 JWT payload에 role 값을 새 enum으로 반영:

```python
{
    "user_id": 1,
    "email": "admin@vms.local",
    "role": "system_admin",  # system_admin | org_admin | user
    "exp": ...,
    "iat": ...,
    "jti": ...
}
```

> 페이지별 상세 권한은 JWT에 넣지 않습니다 (토큰 크기 문제). 별도 API(`/api/permissions/me`)로 조회하여 프론트엔드에서 캐싱합니다.

---

## 6. Frontend 설계

### 6.1 권한 상태 관리

```typescript
// store/permission.ts (Zustand)
interface PermissionState {
  permissions: Record<string, "none" | "read" | "write">;  // { dashboard: "write", channels: "read", ... }
  menus: MenuItem[];          // 서버에서 받은 접근 가능 메뉴 목록
  isLoaded: boolean;
  
  fetchPermissions: () => Promise<void>;
  hasAccess: (key: string) => boolean;
  canWrite: (key: string) => boolean;
  canRead: (key: string) => boolean;
  isSystemAdmin: () => boolean;
}
```

### 6.2 네비게이션 동적 생성

현재 `navigation.tsx`에 하드코딩된 메뉴를 서버 메뉴 데이터 기반으로 전환:

```typescript
// 기존: 하드코딩 배열 + filterNavItemsByRole()
// 변경: 서버 API 응답 기반 동적 메뉴

function useNavigationItems() {
  const { menus, isLoaded } = usePermissionStore();
  
  // menus는 서버에서 사용자 권한 필터링 완료된 상태
  // sort_order 기반 정렬, 아이콘 매핑
  return menus.map(menu => ({
    path: menu.path,
    label: menu.label,
    icon: resolveIcon(menu.icon),
    isCustom: menu.menu_type !== "built_in",
  }));
}
```

### 6.3 라우트 가드 개선

```typescript
// 기존 ProtectedRoute
<ProtectedRoute requiredRole="admin">

// 변경 → PermissionRoute
<PermissionRoute permissionKey="channels" level="read">
  <Channels />
</PermissionRoute>

<PermissionRoute permissionKey="channels" level="write">
  <ChannelEditForm />   {/* 쓰기 권한 필요한 컴포넌트 */}
</PermissionRoute>
```

### 6.4 쓰기 권한 UI 제어

```typescript
// 읽기만 가능한 경우 쓰기 UI 비활성화
function ChannelList() {
  const canWrite = usePermissionStore(s => s.canWrite("channels"));
  
  return (
    <div>
      <Button disabled={!canWrite}>채널 추가</Button>
      {/* 리스트는 항상 표시 */}
    </div>
  );
}
```

### 6.5 커스텀 메뉴(iframe) 페이지

```typescript
// pages/CustomIframe.tsx
// 동적 라우트: /custom/:menuId
function CustomIframePage() {
  const { menuId } = useParams();
  const menu = useMenuById(menuId);
  
  return (
    <>
      <ContentHeader title={menu.label} />
      <div className="page-container">
        <iframe
          src={menu.iframe_url}
          className="w-full h-[calc(100vh-140px)] border-0 rounded-lg"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          title={menu.label}
        />
      </div>
    </>
  );
}
```

### 6.6 신규 페이지 목록

| 페이지 | 경로 | 접근 권한 | 설명 |
|--------|------|-----------|------|
| **메뉴 관리** | `/admin/menus` | system_admin | 커스텀 메뉴 CRUD, 순서 변경, iframe URL 설정 |
| **권한 관리** | `/admin/permissions` | system_admin, org_admin | 사용자별 권한 매트릭스 편집 |
| **커스텀 iframe** | `/custom/:id` | 권한 보유자 | 외부 시스템 iframe 표시 |

---

## 7. 커스텀 메뉴(iframe) 상세 설계

### 7.1 메뉴 등록 플로우

```
시스템관리자 → /admin/menus 접속
  │
  ├── [메뉴 추가] 클릭
  │     ├── 메뉴 타입 선택: iframe / 외부 링크
  │     ├── 이름, 아이콘, URL 입력
  │     ├── 정렬 순서 설정
  │     └── 저장 → menu_items에 INSERT
  │
  ├── 드래그앤드롭으로 순서 변경
  │
  └── 기존 메뉴 활성화/비활성화 토글
```

### 7.2 메뉴 관리 UI 구성

```
┌────────────────────────────────────────────────┐
│  메뉴 관리                          [+ 메뉴 추가]│
├────────────────────────────────────────────────┤
│                                                 │
│  ☰ 기본 메뉴                                    │
│  ├── ☐ 대시보드          /dashboard     built_in │
│  ├── ☐ 채널 관리          /channels     built_in │
│  ├── ☐ 메시지 히스토리    /messages     built_in │
│  ├── ☐ 통계              /statistics   built_in │
│  ├── ☐ 연동 관리          /integrations built_in │
│  └── ☐ 도움말            /help         built_in │
│                                                 │
│  ☰ 관리 메뉴                                    │
│  ├── ☐ 사용자 관리        /users        built_in │
│  ├── ☐ 감사 로그          /audit-logs   built_in │
│  └── ☐ 모니터링          /monitoring   built_in │
│                                                 │
│  ☰ 커스텀 메뉴                                   │
│  ├── ☐ Grafana 대시보드   /custom/1     iframe   │
│  │     URL: https://grafana.company.com/d/abc    │
│  ├── ☐ Jenkins           /custom/2     iframe   │
│  │     URL: https://jenkins.company.com          │
│  └── [+ 커스텀 메뉴 추가]                         │
│                                                 │
└────────────────────────────────────────────────┘
```

### 7.3 iframe 보안 고려사항

| 항목 | 설정 | 이유 |
|------|------|------|
| `sandbox` | `allow-same-origin allow-scripts allow-forms allow-popups` | XSS 방지하면서 기능 유지 |
| URL 검증 | `https://` 필수 (개발 환경 제외) | Mixed Content 방지 |
| CSP 헤더 | `frame-src` 화이트리스트 | 허용된 도메인만 iframe 가능 |
| X-Frame-Options | 대상 사이트 확인 필요 | 일부 사이트는 iframe 차단 |

---

## 8. 권한 관리 UI 상세

### 8.1 권한 매트릭스 뷰 (시스템관리자용)

모든 사용자 × 모든 메뉴의 권한을 한눈에 보고 편집:

```
┌──────────────────────────────────────────────────────────────┐
│  권한 관리                                                    │
├────────────┬──────┬──────┬──────┬──────┬──────┬─────────────┤
│ 사용자      │대시보드│채널   │메시지 │통계   │Grafana│ ...         │
├────────────┼──────┼──────┼──────┼──────┼──────┼─────────────┤
│ 🔴 admin   │ ALL  │ ALL  │ ALL  │ ALL  │ ALL  │ 시스템관리자  │
│ 🟡 김운영   │  W   │  W   │  R   │  R   │  W   │ 운영관리자   │
│ 🟢 박사용   │  R   │  R   │  R   │  -   │  -   │ 일반사용자   │
│ 🟢 이사용   │  R   │  -   │  R   │  -   │  R   │ 일반사용자   │
└────────────┴──────┴──────┴──────┴──────┴──────┴─────────────┘

범례: ALL=전체, W=쓰기, R=읽기, -=없음
클릭하면 none → read → write 순환 토글
```

### 8.2 권한 부여 뷰 (운영관리자용)

자신의 권한 범위 내에서 일반사용자에게 부여:

```
┌──────────────────────────────────────────────────┐
│  사용자 권한 관리 (내 권한 범위 내)                  │
├────────────┬──────┬──────┬──────┬───────────────┤
│ 사용자      │대시보드│채널   │메시지 │ 내 권한        │
│            │(내:W) │(내:W) │(내:R) │               │
├────────────┼──────┼──────┼──────┼───────────────┤
│ 🟢 박사용   │ [R▾] │ [R▾] │ [R▾] │               │
│ 🟢 이사용   │ [R▾] │ [ -] │ [R▾] │               │
└────────────┴──────┴──────┴──────┴───────────────┘

드롭다운: 내가 W → 대상에게 -/R/W 선택 가능
          내가 R → 대상에게 -/R만 선택 가능
```

---

## 9. 구현 계획

### Phase 1: 핵심 RBAC (백엔드)

| # | 작업 | 파일 | 상세 |
|---|------|------|------|
| 1-1 | UserRole enum 확장 | `models/user.py` | `system_admin`, `org_admin`, `user` |
| 1-2 | DB 마이그레이션 | `migrations/008_rbac_and_custom_menus.py` | role 변환 + 테이블 생성 + 시드 |
| 1-3 | MenuItem 모델 | `models/menu_item.py` | SQLAlchemy 모델 |
| 1-4 | UserPermission 모델 | `models/user_permission.py` | SQLAlchemy 모델 |
| 1-5 | 권한 서비스 | `services/permission_service.py` | 권한 조회/부여/위임 검증 로직 |
| 1-6 | `require_permission` 의존성 | `utils/auth.py` | 기존 `get_current_active_admin` 대체 |
| 1-7 | 메뉴 API | `api/menus.py` | CRUD + 순서 변경 |
| 1-8 | 권한 API | `api/permissions.py` | 조회/부여 + 매트릭스 |
| 1-9 | 기존 API 권한 적용 | `api/bridge.py` 등 | `require_permission()` 적용 |

### Phase 2: 프론트엔드 권한

| # | 작업 | 파일 | 상세 |
|---|------|------|------|
| 2-1 | 권한 Store | `store/permission.ts` | Zustand + 권한 API 연동 |
| 2-2 | PermissionRoute 컴포넌트 | `components/PermissionRoute.tsx` | 페이지 접근 가드 |
| 2-3 | 동적 네비게이션 | `lib/navigation.tsx` | 서버 메뉴 기반으로 전환 |
| 2-4 | App.tsx 라우트 개편 | `App.tsx` | 동적 라우트 + iframe 라우트 |
| 2-5 | 쓰기 권한 UI 제어 | 각 페이지 | `canWrite()` 기반 버튼 비활성화 |
| 2-6 | 권한 API 클라이언트 | `lib/api/permissions.ts` | API 호출 함수 |

### Phase 3: 관리 페이지

| # | 작업 | 파일 | 상세 |
|---|------|------|------|
| 3-1 | 메뉴 관리 페이지 | `pages/admin/MenuManagement.tsx` | CRUD + 드래그 정렬 |
| 3-2 | 권한 매트릭스 페이지 | `pages/admin/PermissionMatrix.tsx` | 사용자×메뉴 매트릭스 |
| 3-3 | 커스텀 iframe 페이지 | `pages/CustomIframe.tsx` | iframe 렌더링 |
| 3-4 | 메뉴 등록 모달 | `components/admin/MenuFormModal.tsx` | 타입별 폼 |
| 3-5 | 역할 변경 UI | `pages/UserManagement.tsx` 개선 | 3단계 역할 선택 |

### Phase 4: 마무리

| # | 작업 | 상세 |
|---|------|------|
| 4-1 | 감사 로그 연동 | 권한 변경 이력 AuditLog에 기록 |
| 4-2 | 온보딩 플로우 | 운영관리자 초기 권한 설정 가이드 |
| 4-3 | 기존 ProtectedRoute 마이그레이션 | requiredRole → PermissionRoute 전환 |
| 4-4 | API 전체 권한 점검 | 모든 엔드포인트에 적절한 권한 체크 적용 |

---

## 10. 주요 결정사항 & 트레이드오프

| 결정 | 선택 | 이유 |
|------|------|------|
| 권한을 JWT에 포함? | ❌ 별도 API | JWT 크기 제한, 권한 변경 시 즉시 반영 필요 |
| RBAC vs ABAC? | RBAC (역할+메뉴 단위) | 현재 규모에 충분, 구현 복잡도 적절 |
| 메뉴를 DB 관리? | ✅ menu_items 테이블 | 커스텀 메뉴 동적 추가 요구사항 |
| built_in 메뉴도 DB? | ✅ 시드 데이터 | 권한 부여 시 FK 참조 통일, 활성화/비활성화 가능 |
| org_admin 다중? | ✅ 여러 명 가능 | 고객사 내 역할 분담 |
| 권한 캐싱? | 프론트: Zustand, 백엔드: Redis(선택) | 매 요청 DB 조회 부담 줄임 |

---

## 11. 보안 체크리스트

- [ ] system_admin 권한 체크는 DB 조회 없이 role만으로 판별
- [ ] org_admin의 위임 시 서버에서 범위 초과 검증 필수
- [ ] iframe URL에 `javascript:` 스킴 차단
- [ ] iframe sandbox 속성 필수 적용
- [ ] 권한 변경 시 AuditLog 기록
- [ ] 프론트엔드 권한 체크는 UX용, 백엔드 체크가 진짜 보안 경계
- [ ] 커스텀 메뉴 삭제 시 연관 user_permissions도 CASCADE 삭제
