# 메뉴 그룹 및 탭 레이아웃 설계

> **작성일**: 2026-04-09  
> **범위**: 메뉴 관리 페이지 탭 전환 + 2차원 메뉴 그룹 지원

---

## 1. 배경

현재 메뉴 관리 페이지는 기본 메뉴 / 관리 메뉴 / 커스텀 메뉴를 Card 섹션으로 나열한다.
메뉴 구조는 **1차원 플랫 리스트**만 지원하며, 그룹핑(parent_key)은 DB 컬럼이 존재하지만 UI/로직에서 활용하지 않는다.

### 개선 목표

1. **탭 레이아웃** — 3개 섹션을 탭으로 전환하여 화면 밀도 개선
2. **2차원 메뉴 그룹** — `menu_group` 타입 메뉴로 하위 메뉴를 묶는 계층 구조
3. **그룹 아이콘** — 사이드바에서 폴더형 아이콘으로 그룹 표현, 펼침 시 하위 항목 노출

---

## 2. 데이터 모델

### 2.1 menu_type 확장

| menu_type | 설명 |
|---|---|
| `built_in` | 시스템 기본 메뉴 |
| `custom_iframe` | 커스텀 iframe 메뉴 |
| `custom_link` | 커스텀 외부 링크 |
| **`menu_group`** | 메뉴 그룹 (컨테이너, 자체 페이지 없음) |

### 2.2 parent_key 활용

- `parent_key`가 `null`인 메뉴 → **최상위(1차원)** 항목
- `parent_key`가 특정 `permission_key`와 일치 → 해당 그룹의 **하위 메뉴**
- `menu_group` 타입 메뉴가 그룹 컨테이너 역할
- 2단계 중첩까지만 허용 (그룹 안에 그룹 불가)

### 2.3 menu_group 특성

- `path`: `/group/{permission_key}` (실제 라우팅에 사용되지 않음)
- `iframe_url`: null
- `open_in_new_tab`: false
- 하위 메뉴가 모두 비활성이면 그룹도 사이드바에서 숨김

---

## 3. Backend 변경

### 3.1 MenuCreateRequest

```python
@field_validator("menu_type")
def validate_menu_type(cls, v):
    if v not in ("custom_iframe", "custom_link", "menu_group"):
        raise ValueError("...")
    return v
```

### 3.2 MenuUpdateRequest

- `parent_key: Optional[str] = None` 필드 추가 → 메뉴의 그룹 소속 변경 가능

### 3.3 삭제 정책

- `menu_group` 삭제 시 하위 메뉴의 `parent_key`를 `null`로 리셋 (최상위로 이동)

---

## 4. Frontend 변경

### 4.1 MenuManagement 페이지 — 탭 레이아웃

기존 3개 Card 섹션 → `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` 사용.

```
[기본 메뉴] [관리 메뉴] [커스텀 메뉴]
─────────────────────────────────────
(현재 탭의 메뉴 목록)
```

각 탭 내에서:
- 최상위 메뉴: 기존과 동일하게 표시
- 메뉴 그룹: 접힌 상태에서 클릭 시 하위 메뉴 표시 (들여쓰기)
- 드래그 앤 드롭은 같은 탭 내에서만 동작

### 4.2 MenuFormModal

- **메뉴 타입**에 `menu_group` 옵션 추가
- **소속 그룹** 드롭다운: 같은 섹션의 `menu_group` 목록에서 선택 (선택 안하면 최상위)
- `menu_group` 선택 시 iframe/링크 관련 필드 숨김

### 4.3 navigation.tsx

```typescript
export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ active: boolean }>;
  permissionKey?: string;
  badge?: string;
  children?: NavItem[];  // 메뉴 그룹의 하위 항목
}
```

- `categorizeMenus()`: parent_key 기반으로 그룹의 children 조립
- `MenuGroupIcon`: 폴더 + 화살표 형태의 아이콘 추가

### 4.4 Sidebar

- 그룹 항목 클릭 시 팝오버/플라이아웃으로 하위 메뉴 표시 (collapsed 모드)
- `SidebarGroupItem` 컴포넌트: 그룹 아이콘 + 호버 시 하위 메뉴 팝오버

---

## 5. 사이드바 그룹 렌더링

### Collapsed 모드 (기본)

```
[📁]  ← 그룹 아이콘 (hover 시 팝오버)
  ┌──────────────┐
  │ 하위 메뉴 1   │
  │ 하위 메뉴 2   │
  │ 하위 메뉴 3   │
  └──────────────┘
```

- 그룹 아이콘에 hover → 오른쪽에 플라이아웃 팝오버 표시
- 하위 메뉴 중 하나가 active이면 그룹 아이콘도 active 스타일

---

## 6. 구현 순서

1. Backend: `menu_group` 타입 허용, `parent_key` update 지원
2. Frontend types: `menu_group` 추가
3. MenuFormModal: 그룹 타입 + 소속 그룹 선택
4. MenuManagement: 탭 레이아웃 + 그룹 표시/관리
5. navigation.tsx: NavItem.children, categorizeMenus 계층 조립, 그룹 아이콘
6. Sidebar: SidebarGroupItem (플라이아웃 팝오버)
