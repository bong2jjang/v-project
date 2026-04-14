# 동적 메뉴 시스템 설계

> MenuItem 모델, menu_type 분류, parent_key 그룹핑, section별 탭 레이아웃, 메뉴 CRUD API

---

## 1. 개요

v-platform의 메뉴 시스템은 `menu_items` 테이블을 단일 소스로 사용하여, 기본 메뉴(built_in)와 관리자가 추가한 커스텀 메뉴(custom_iframe, custom_link)를 통합 관리한다. `parent_key`를 통해 메뉴 그룹을 구성하고, `section`으로 탭 분류하며, `app_id`로 앱별 메뉴를 격리한다.

### 핵심 특성

| 항목 | 설명 |
|------|------|
| 단일 테이블 | `menu_items` 하나로 모든 메뉴 유형 관리 |
| 3가지 menu_type | built_in / custom_iframe / custom_link + menu_group |
| 3가지 section | basic / admin / custom |
| 앱별 격리 | `app_id` 컬럼으로 플랫폼 공통/앱 전용 분리 |
| 그룹핑 | `parent_key`로 2계층 메뉴 구조 |
| 권한 연동 | `permission_key`로 UserPermission과 연결 |

---

## 2. MenuItem 모델

### 2.1 테이블 스키마

```
테이블: menu_items

+--------------------+--------------+-------------------------------------------+
| 컬럼               | 타입         | 설명                                      |
+--------------------+--------------+-------------------------------------------+
| id                 | Integer PK   | 자동 증가                                 |
| permission_key     | String(100)  | 권한 키 (앱 범위 내 고유)                  |
| label              | String(200)  | UI 표시 이름                              |
| icon               | String(100)  | Lucide 아이콘명                           |
| path               | String(500)  | 라우트 경로                               |
| menu_type          | String(20)   | built_in/custom_iframe/custom_link        |
| iframe_url         | Text         | iframe 삽입 URL (custom_iframe용)         |
| iframe_fullscreen  | Boolean      | iframe 전체 화면 (기본 false)             |
| open_in_new_tab    | Boolean      | 새 탭 열기 (기본 false)                   |
| parent_key         | String(100)  | 부모 메뉴 permission_key (그룹핑)         |
| sort_order         | Integer      | 정렬 순서                                 |
| section            | String(20)   | basic/admin/custom                        |
| app_id             | String(50)   | NULL=플랫폼 공통, 값=앱 전용              |
| is_active          | Boolean      | 활성 여부                                 |
| created_by         | Integer FK   | 생성자 (users.id)                         |
| updated_by         | Integer FK   | 수정자 (users.id)                         |
| created_at         | DateTime     | 생성 시각                                 |
| updated_at         | DateTime     | 수정 시각                                 |
+--------------------+--------------+-------------------------------------------+

인덱스: permission_key, app_id
```

### 2.2 Relationship

```python
permissions = relationship(
    "UserPermission",
    back_populates="menu_item",
    cascade="all, delete-orphan",
)
```

메뉴 삭제 시 연결된 `UserPermission` 레코드도 함께 삭제된다.

---

## 3. menu_type 분류

### 3.1 built_in (기본 메뉴)

플랫폼이 마이그레이션으로 생성하는 기본 메뉴. 삭제 불가, 수정 가능.

| 예시 | permission_key | path | section |
|------|---------------|------|---------|
| 대시보드 | `dashboard` | `/` | basic |
| 사용자 관리 | `admin_users` | `/admin/users` | admin |
| 감사 로그 | `admin_audit_logs` | `/admin/audit-logs` | admin |
| 설정 | `settings` | `/settings` | basic |
| 프로필 | `profile` | `/profile` | basic |

### 3.2 custom_iframe (외부 페이지 삽입)

관리자가 외부 URL을 iframe으로 삽입하여 메뉴에 추가한다.

```
MenuItem(
    permission_key="external_wiki",
    label="사내 위키",
    path="/custom/external-wiki",
    menu_type="custom_iframe",
    iframe_url="https://wiki.company.com",
    iframe_fullscreen=True,
    section="custom",
)
```

- `iframe_url`: 삽입할 외부 URL (`javascript:` URL은 유효성 검사에서 차단)
- `iframe_fullscreen`: true이면 사이드바 없이 전체 화면
- 프론트엔드의 `CustomIframe.tsx` 페이지가 렌더링

### 3.3 custom_link (외부 링크)

외부 URL로 이동하는 링크 메뉴. iframe 삽입이 아닌 직접 이동.

```
MenuItem(
    permission_key="external_docs",
    label="API 문서",
    path="https://docs.example.com",
    menu_type="custom_link",
    open_in_new_tab=True,
    section="custom",
)
```

### 3.4 menu_group (메뉴 그룹)

하위 메뉴를 묶는 그룹 헤더. 자체 경로는 없고 `permission_key`가 하위 메뉴의 `parent_key`로 참조된다.

```
MenuItem(
    permission_key="tools_group",
    label="도구 모음",
    icon="Wrench",
    path="/tools",
    menu_type="menu_group",
    section="custom",
)
```

---

## 4. Section별 탭 분류

메뉴는 `section` 필드로 3개 탭으로 분류된다.

### 4.1 basic (기본 메뉴)

일반 사용자가 접근하는 기본 기능 메뉴.

| 메뉴 | permission_key | 비고 |
|------|---------------|------|
| 대시보드 | dashboard | 앱마다 다른 대시보드 |
| 프로필 | profile | 플랫폼 공통 |
| 설정 | settings | 플랫폼 공통 |
| 도움말 | help | 플랫폼 공통 |

### 4.2 admin (관리 메뉴)

관리자(system_admin, org_admin)가 접근하는 관리 기능.

| 메뉴 | permission_key | 비고 |
|------|---------------|------|
| 사용자 관리 | admin_users | 플랫폼 공통 |
| 감사 로그 | admin_audit_logs | 플랫폼 공통 |
| 알림 관리 | admin_notifications | 플랫폼 공통 |
| 앱 관리 | admin_apps | 포털 전용 |

### 4.3 custom (커스텀 메뉴)

관리자가 런타임에 추가한 메뉴. custom_iframe, custom_link, menu_group이 여기에 속한다.

---

## 5. parent_key 그룹핑

`parent_key`를 사용하여 2계층 메뉴 구조를 구성한다.

```
tools_group (menu_group)
  +-- external_wiki (custom_iframe, parent_key="tools_group")
  +-- external_docs (custom_link, parent_key="tools_group")
  +-- monitoring (custom_link, parent_key="tools_group")
```

### 5.1 렌더링 규칙

```
사이드바
  +-- 대시보드              (parent_key=NULL, section=basic)
  +-- 채널 관리             (parent_key=NULL, section=basic)
  +-- 도구 모음  [펼침]     (menu_group, parent_key=NULL)
  |    +-- 사내 위키        (parent_key="tools_group")
  |    +-- API 문서         (parent_key="tools_group")
  +-- 설정                  (parent_key=NULL, section=basic)
  +-- [관리]
  +-- 사용자 관리           (parent_key=NULL, section=admin)
  +-- 감사 로그             (parent_key=NULL, section=admin)
```

### 5.2 그룹 삭제 시 동작

menu_group을 삭제하면 하위 메뉴의 `parent_key`를 NULL로 리셋한다. 하위 메뉴 자체는 삭제되지 않고 최상위로 이동한다.

```python
if menu.menu_type == "menu_group":
    children = (
        db.query(MenuItem)
        .filter(MenuItem.parent_key == menu.permission_key)
        .filter(or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id))
        .all()
    )
    for child in children:
        child.parent_key = None
```

---

## 6. app_id 기반 메뉴 격리

### 6.1 분류 규칙

| app_id 값 | 의미 | 예시 |
|-----------|------|------|
| NULL | 플랫폼 공통 메뉴 | profile, settings, admin_users |
| `"v-channel-bridge"` | 해당 앱 전용 | dashboard, channels, messages |
| `"v-platform-portal"` | 포털 전용 | portal, admin_apps |

### 6.2 자동 분류 (_classify_app_menus)

`PlatformApp` 생성 시 `app_menu_keys`를 지정하면, `init_platform()` 호출 시 해당 키들의 `app_id`를 자동으로 설정한다:

```python
platform = PlatformApp(
    app_name="v-channel-bridge",
    app_menu_keys=["dashboard", "channels", "messages", "statistics"],
)
```

이 키에 해당하는 `menu_items`의 `app_id`가 NULL이면 `"v-channel-bridge"`로 업데이트한다.

### 6.3 조회 필터

모든 메뉴 조회 API는 `app_id` 필터를 적용한다:

```python
# 사용자 메뉴: 플랫폼 공통 + 현재 앱 메뉴
query.filter(or_(MenuItem.app_id.is_(None), MenuItem.app_id == app_id))
```

---

## 7. 권한 연동

### 7.1 permission_key와 UserPermission

각 메뉴의 `permission_key`는 `UserPermission` 테이블과 연결되어 사용자별 접근 권한을 제어한다.

```
menu_items (permission_key)
     |
     +-- user_permissions (menu_item_id, user_id, access_level)
```

### 7.2 접근 가능 메뉴 조회

`PermissionService.get_accessible_menus(db, user, app_id)`가 현재 사용자의 권한을 기반으로 접근 가능한 메뉴 목록을 반환한다. system_admin은 모든 메뉴에 접근 가능하다.

### 7.3 PermissionGroup 연동

`PermissionGroupGrant` 테이블을 통해 권한 그룹에 메뉴 접근 권한을 일괄 할당한다:

```
permission_groups
     |
     +-- permission_group_grants (permission_group_id, menu_item_id, access_level)
     |
     +-- user_group_memberships (user_id, permission_group_id)
```

---

## 8. 메뉴 CRUD API

### 8.1 엔드포인트 목록

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/menus` | 현재 사용자 접근 가능 메뉴 | 인증 사용자 |
| GET | `/api/menus/all` | 전체 메뉴 목록 (관리용) | admin 이상 |
| POST | `/api/menus` | 커스텀 메뉴 등록 | system_admin |
| PUT | `/api/menus/reorder` | 메뉴 순서 변경 | system_admin |
| PUT | `/api/menus/{menu_id}` | 메뉴 수정 | system_admin |
| DELETE | `/api/menus/{menu_id}` | 커스텀 메뉴 삭제 | system_admin |

### 8.2 메뉴 생성 스키마

```python
class MenuCreateRequest(BaseModel):
    permission_key: str
    label: str
    icon: Optional[str] = None
    path: str
    menu_type: str = "custom_iframe"   # custom_iframe | custom_link | menu_group
    iframe_url: Optional[str] = None
    iframe_fullscreen: bool = False
    open_in_new_tab: bool = False
    parent_key: Optional[str] = None
    sort_order: int = 0
    section: str = "custom"            # basic | admin | custom
```

#### 유효성 검사

- `menu_type`은 `custom_iframe`, `custom_link`, `menu_group`만 허용 (built_in 직접 생성 불가)
- `iframe_url`에 `javascript:` 프로토콜 차단
- `permission_key` 중복 체크 (동일 앱 범위 내)

### 8.3 메뉴 수정 스키마

```python
class MenuUpdateRequest(BaseModel):
    label: Optional[str] = None
    icon: Optional[str] = None
    path: Optional[str] = None
    iframe_url: Optional[str] = None
    iframe_fullscreen: Optional[bool] = None
    open_in_new_tab: Optional[bool] = None
    parent_key: Optional[str] = None
    sort_order: Optional[int] = None
    section: Optional[str] = None
    is_active: Optional[bool] = None
```

`model_dump(exclude_unset=True)`로 전달된 필드만 변경한다.

### 8.4 순서 변경

```python
class MenuReorderRequest(BaseModel):
    orders: list[dict]  # [{"id": 1, "sort_order": 100}, ...]
```

일괄 순서 변경을 지원한다. 각 항목의 `id`와 새 `sort_order`를 지정한다.

### 8.5 삭제 규칙

| menu_type | 삭제 가능 | 설명 |
|-----------|-----------|------|
| built_in | X | "기본 메뉴는 삭제할 수 없습니다. 비활성화를 사용하세요." |
| custom_iframe | O | 삭제 + 관련 UserPermission cascade 삭제 |
| custom_link | O | 삭제 + 관련 UserPermission cascade 삭제 |
| menu_group | O | 삭제 + 하위 메뉴 parent_key NULL로 리셋 |

---

## 9. 감사 로그 연동

모든 메뉴 CRUD 작업은 감사 로그에 기록된다.

| 작업 | AuditAction | 기록 내용 |
|------|-------------|----------|
| 생성 | `MENU_CREATE` | menu_type, permission_key, path |
| 수정 | `MENU_UPDATE` | 변경된 필드 목록 |
| 삭제 | `MENU_DELETE` | permission_key |
| 순서 변경 | `MENU_REORDER` | 변경된 orders 배열 |

```python
log_menu_action(
    db=db,
    action=AuditAction.MENU_CREATE,
    actor=current_user,
    menu_label=menu.label,
    menu_id=menu.id,
    details={"menu_type": menu.menu_type, "permission_key": menu.permission_key},
    ip_address=request.client.host,
    user_agent=request.headers.get("user-agent"),
)
```

---

## 10. 프론트엔드 렌더링

### 10.1 사이드바 구성

프론트엔드 사이드바는 `/api/menus` 응답을 기반으로 렌더링한다:

1. `section` 기준으로 basic / admin / custom 영역 구분
2. `parent_key`가 NULL인 메뉴를 최상위로 배치
3. `parent_key`가 있는 메뉴를 해당 그룹 아래에 배치
4. `sort_order` 기준 정렬
5. `is_active=false`인 메뉴는 표시하지 않음

### 10.2 menu_type별 라우팅

| menu_type | 동작 |
|-----------|------|
| built_in | React Router로 해당 `path`로 이동 |
| custom_iframe | `CustomIframe.tsx` 페이지에서 `iframe_url` 렌더링 |
| custom_link | `open_in_new_tab`이면 새 탭, 아니면 현재 탭에서 이동 |
| menu_group | 클릭 시 하위 메뉴 토글 |

### 10.3 관리 UI 탭 레이아웃

메뉴 관리 페이지는 section별로 탭을 제공한다:

```
[기본 메뉴] [관리 메뉴] [커스텀 메뉴]
+----------------------------------------+
| 메뉴 카드 목록                          |
|                                        |
| [대시보드]  [sort_order: 0]  [활성]     |
| [채널 관리] [sort_order: 10] [활성]     |
| [메시지]    [sort_order: 20] [활성]     |
+----------------------------------------+
| [+ 커스텀 메뉴 추가]                    |
+----------------------------------------+
```

각 카드에서:
- 레이블, 아이콘, 경로 수정
- sort_order 변경 (드래그 앤 드롭 또는 직접 입력)
- 활성/비활성 토글
- 커스텀 메뉴만 삭제 가능

---

## 11. to_dict() 응답 형식

```python
def to_dict(self):
    return {
        "id": self.id,
        "permission_key": self.permission_key,
        "label": self.label,
        "icon": self.icon,
        "path": self.path,
        "menu_type": self.menu_type,
        "iframe_url": self.iframe_url,
        "iframe_fullscreen": self.iframe_fullscreen,
        "open_in_new_tab": self.open_in_new_tab,
        "parent_key": self.parent_key,
        "sort_order": self.sort_order,
        "section": self.section,
        "app_id": self.app_id,
        "is_active": self.is_active,
        "created_at": self.created_at.isoformat(),
        "updated_at": self.updated_at.isoformat(),
    }
```

---

## 12. 관련 문서

- [멀티 앱 데이터 격리](./MULTI_APP_DATA_ISOLATION.md) -- app_id 기반 메뉴 격리
- [모듈 경계 맵](./MODULE_BOUNDARY_MAP.md) -- 플랫폼/앱 코드 분류
- [플랫폼/앱 분리 아키텍처](./PLATFORM_APP_SEPARATION_ARCHITECTURE.md) -- PlatformApp.app_menu_keys
