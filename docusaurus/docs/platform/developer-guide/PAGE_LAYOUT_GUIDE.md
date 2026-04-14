---
id: page-layout-guide
title: 페이지 레이아웃 가이드
sidebar_position: 5
tags: [guide, developer]
---

# 페이지 레이아웃 가이드

v-platform의 모든 페이지는 일관된 레이아웃 패턴을 따릅니다. 이 가이드에서는 `Layout` 컴포넌트의 구조, 페이지 템플릿, `ProtectedRoute` 권한 보호, 그리고 다양한 페이지 패턴을 설명합니다.

---

## 1. 전체 레이아웃 구조

v-platform은 **VS Code 스타일** 레이아웃을 사용합니다.

```
┌────────────────────────────────────────────┐
│  TopBar (상단 바)                           │
├──────┬─────────────────────────────────────┤
│      │                                     │
│ Side │  Main Content Area                  │
│ bar  │  (스크롤 가능)                       │
│      │                                     │
│      │                                     │
├──────┴─────────────────────────────────────┤
│  Footer (하단 바)                           │
└────────────────────────────────────────────┘
```

### 1.1 Layout 컴포넌트

`Layout` 컴포넌트는 `SidebarProvider`로 감싸진 `LayoutContent`를 렌더링합니다.

```tsx
// platform/frontend/v-platform-core/src/components/Layout.tsx

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
```

`LayoutContent` 내부 구조:

```tsx
<div className="h-screen bg-surface-page flex flex-col overflow-hidden">
  {/* 1. TopBar — 전체 넓이, 고정 */}
  <TopBar />

  {/* 2. 중앙 영역: Sidebar + Content */}
  <div className="flex flex-1 overflow-hidden">
    {sidebarVisible && <Sidebar />}
    <main className="flex-1 overflow-y-auto">{children}</main>
  </div>

  {/* 3. Footer — 전체 넓이, 하단 고정 */}
  <footer className="bg-surface-card border-t border-line flex-shrink-0">
    <div className="px-4 py-0.5">
      <div className="flex items-center justify-end text-caption text-content-tertiary">
        <span>v1.1.0</span>
        <NotificationBell />
      </div>
    </div>
  </footer>

  {/* 4. 오버레이 요소 */}
  <ToastContainer />
  <AnnouncementPopup />
</div>
```

### 1.2 핵심 영역별 역할

| 영역 | 컴포넌트 | 높이 | 설명 |
|------|----------|------|------|
| TopBar | `TopBar` | 48px (h-12) | 앱 로고, 페이지 제목, 상태 표시, 사용자 메뉴 |
| Sidebar | `Sidebar` | 100% (flex) | 아이콘 네비게이션 (축소/확장/숨김 3단계) |
| Content | `<main>` | 나머지 (flex-1) | 스크롤 가능한 페이지 콘텐츠 |
| Footer | 인라인 | auto | 버전 정보, 알림 벨 |

---

## 2. 페이지 템플릿 패턴

모든 페이지는 `Fragment + ContentHeader + page-container + space-y-section-gap` 패턴을 따릅니다.

### 2.1 기본 페이지 구조

```tsx
import { ContentHeader } from "@v-platform/core";

export default function MyPage() {
  return (
    <>
      {/* 1. 페이지 헤더 */}
      <ContentHeader
        title="페이지 제목"
        description="페이지에 대한 간단한 설명"
        actions={
          <button className="btn btn-primary btn-sm">
            액션 버튼
          </button>
        }
      />

      {/* 2. 콘텐츠 영역 */}
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 섹션 1 */}
          <div className="card-base p-card-x">
            <h2 className="text-heading-md text-content-primary mb-element-gap">
              섹션 제목
            </h2>
            {/* 콘텐츠 */}
          </div>

          {/* 섹션 2 */}
          <div className="card-base p-card-x">
            {/* 콘텐츠 */}
          </div>
        </div>
      </div>
    </>
  );
}
```

### 2.2 ContentHeader 컴포넌트

페이지 상단에 브랜드 색상 배경의 헤더를 표시합니다.

```tsx
// platform/frontend/v-platform-core/src/components/layout/ContentHeader.tsx

interface ContentHeaderProps {
  title: string;           // 페이지 제목
  description?: string;    // 부제목/설명
  actions?: ReactNode;     // 우측 액션 버튼
  globalScope?: boolean;   // "Global" 배지 표시
}
```

렌더링 결과:

```tsx
<div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-6">
  <div className="bg-brand-600 dark:bg-surface-card rounded-card border ...">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-heading-xl text-white dark:text-content-primary truncate">
          {title}
        </h1>
        {description && (
          <p className="text-body-base text-brand-200 dark:text-content-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  </div>
</div>
```

:::tip ContentHeader 테마 동작
- **라이트 모드**: `bg-brand-600` 배경, 흰색 텍스트
- **다크 모드**: `bg-surface-card` 배경, `text-content-primary` 텍스트
- `globalScope` prop을 전달하면 제목 옆에 반투명 "Global" 배지가 표시됩니다. 앱별 격리가 아닌 전역 설정 페이지에 사용합니다.
:::

### 2.3 page-container 클래스

```css
.page-container {
  @apply max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-section-gap pb-page-y;
}
```

이 클래스가 적용하는 규칙:

| 속성 | 값 | 설명 |
|------|-----|------|
| `max-w-content` | 80rem (1280px) | 콘텐츠 최대 너비 |
| `mx-auto` | auto | 가운데 정렬 |
| `px-4 sm:px-6 lg:px-8` | 반응형 | 모바일 16px → 태블릿 24px → 데스크톱 32px |
| `pt-section-gap` | 1.5rem | 상단 여백 (ContentHeader와의 간격) |
| `pb-page-y` | 2rem | 하단 여백 |

---

## 3. ProtectedRoute

### 3.1 개요

`ProtectedRoute`는 페이지 접근을 인증 + RBAC 권한에 따라 보호하는 래퍼 컴포넌트입니다.

```tsx
// platform/frontend/v-platform-core/src/components/ProtectedRoute.tsx

interface ProtectedRouteProps {
  children: ReactNode;
  permissionKey?: string;        // RBAC 권한 키 (menu_items.permission_key)
  requiredRole?: "admin";        // @deprecated — permissionKey 사용 권장
}
```

### 3.2 검사 흐름

```
요청 진입
  │
  ├─ isInitialized === false ──→ 로딩 스피너
  │
  ├─ isAuthenticated === false ─→ /login 리다이렉트 (현재 경로 state 보존)
  │
  ├─ permissionKey && !isLoaded ─→ 로딩 스피너 (권한 데이터 대기)
  │
  ├─ permissionKey 검사 (system_admin은 항상 통과)
  │   ├─ canAccess(permissionKey) === true ──→ 통과
  │   ├─ 루트 경로 ("/") && 접근 불가
  │   │   └─ menus에서 첫 번째 접근 가능 페이지로 이동
  │   └─ 비루트 경로 && 접근 불가
  │       └─ resolveStartPage() fallback → /forbidden
  │
  └─ requiredRole === "admin" && !isAdminRole(user.role) ─→ /forbidden
```

### 3.3 사용 예시

```tsx
// App.tsx 라우트 정의

import { ProtectedRoute, Layout } from "@v-platform/core";

<Route path="/" element={<Layout><Outlet /></Layout>}>
  {/* 대시보드 — dashboard 권한 필요 */}
  <Route
    index
    element={
      <ProtectedRoute permissionKey="dashboard">
        <DashboardPage />
      </ProtectedRoute>
    }
  />

  {/* 채널 관리 — channels 권한 필요 */}
  <Route
    path="channels"
    element={
      <ProtectedRoute permissionKey="channels">
        <ChannelsPage />
      </ProtectedRoute>
    }
  />

  {/* 관리자 전용 페이지 — admin_users 권한 필요 */}
  <Route
    path="admin/users"
    element={
      <ProtectedRoute permissionKey="admin_users">
        <AdminUsersPage />
      </ProtectedRoute>
    }
  />

  {/* 프로필 — 인증만 필요 (permissionKey 없음) */}
  <Route
    path="profile"
    element={
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    }
  />
</Route>
```

### 3.4 루트 경로 자동 리다이렉트

`/` 접근 시 `dashboard` 권한이 없으면, `menus` 배열에서 첫 번째 접근 가능한 페이지를 찾아 자동 이동합니다.

```tsx
// ProtectedRoute.tsx 내부 로직
if (location.pathname === "/") {
  const firstAccessible = menus.find(
    (m) => m.permission_key !== permissionKey,
  );
  if (firstAccessible) {
    return <Navigate to={firstAccessible.path} replace />;
  }
  return <Navigate to="/forbidden" replace />;
}
```

### 3.5 resolveStartPage 함수

비루트 경로에서 접근 불가 시 대체 페이지를 결정하는 함수입니다.

```tsx
import { resolveStartPage } from "@v-platform/core";

// resolveStartPage(userPreference, systemDefault, menus)
const fallback = resolveStartPage(
  "",                              // 사용자 설정 (빈 문자열이면 무시)
  settings?.default_start_page,    // 시스템 기본 시작 페이지
  menus,                           // 접근 가능 메뉴 목록
);
```

우선순위: 사용자 설정 > 시스템 기본 > 메뉴 첫 항목 > `/forbidden`

---

## 4. PlatformProvider

모든 앱의 최상위를 감싸는 Provider입니다. 내부적으로 여러 Provider를 합성합니다.

### 4.1 구조

```tsx
// platform/frontend/v-platform-core/src/providers/PlatformProvider.tsx

export function PlatformProvider({ config, children }: PlatformProviderProps) {
  const mergedConfig = { ...defaultConfig, ...config };

  return (
    <PlatformConfigContext.Provider value={mergedConfig}>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <DocumentTitleSync config={mergedConfig} />
          {children}
        </SidebarProvider>
      </QueryClientProvider>
    </PlatformConfigContext.Provider>
  );
}
```

### 4.2 PlatformConfig 인터페이스

```tsx
interface PlatformConfig {
  apiBaseUrl?: string;                // API 기본 URL ("" = same-origin)
  appName: string;                     // 앱 식별자 (예: "v-channel-bridge")
  appTitle?: string;                   // 표시 이름 (TopBar, 로그인 페이지)
  appDescription?: string;             // 로그인 페이지 설명
  appLogo?: React.ReactNode;           // 커스텀 로고 아이콘
  features?: {
    sso?: boolean;                     // SSO 기능 활성화
    organizations?: boolean;           // 조직도 기능 활성화
    auditLog?: boolean;                // 감사로그 기능 활성화
    notifications?: boolean;           // 알림 기능 활성화
  };
  theme?: {
    defaultTheme?: "light" | "dark" | "system";
  };
}
```

### 4.3 앱에서의 사용

```tsx
// apps/v-channel-bridge/frontend/src/App.tsx

import { PlatformProvider } from "@v-platform/core";

function App() {
  return (
    <PlatformProvider
      config={{
        appName: "v-channel-bridge",
        appTitle: "Channel Bridge",
        appDescription: "Slack-Teams 메시지 브리지",
        features: {
          sso: true,
          organizations: true,
          auditLog: true,
          notifications: true,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* 라우트 정의 */}
        </Routes>
      </BrowserRouter>
    </PlatformProvider>
  );
}
```

### 4.4 DocumentTitleSync

`PlatformProvider` 내부에서 `document.title`을 자동 동기화합니다.

우선순위: 서버 `system_settings.app_title` > `config.appTitle` > `config.appName`

```tsx
function DocumentTitleSync({ config }: { config: PlatformConfig }) {
  const settings = useSystemSettingsStore((s) => s.settings);

  useEffect(() => {
    document.title =
      settings?.app_title || config.appTitle || config.appName;
  }, [settings?.app_title, config.appTitle, config.appName]);

  return null;
}
```

---

## 5. Sidebar 상태 관리

### 5.1 세 가지 상태

| 상태 | 너비 | 내용 |
|------|------|------|
| `expanded` | 240px (w-60) | 아이콘 + 텍스트 라벨 |
| `collapsed` | 48px (w-12) | 아이콘만 (hover 시 툴팁) |
| `hidden` | 0px | 사이드바 숨김 |

### 5.2 useSidebar 훅

```tsx
import { useSidebar } from "@v-platform/core";

const {
  state,            // "expanded" | "collapsed" | "hidden"
  actualState,      // 실제 렌더링 상태 (반응형 고려)
  isMobileOpen,     // 모바일 오버레이 열림 여부
  toggle,           // expanded ↔ collapsed 토글
  openMobile,       // 모바일 오버레이 열기
  closeMobile,      // 모바일 오버레이 닫기
} = useSidebar();
```

### 5.3 모바일 오버레이

768px 미만에서 사이드바는 숨겨지고, 오버레이로 전환됩니다.

```tsx
{isMobileOpen && (
  <>
    {/* 백드롭 */}
    <div className="fixed inset-0 bg-black/50 z-40" onClick={closeMobile} />

    {/* 모바일 사이드바 */}
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-surface-card z-50">
      {/* 로고, 네비게이션, 사용자 정보 */}
    </aside>
  </>
)}
```

모바일 사이드바는 라우트 변경 시 자동으로 닫힙니다:

```tsx
useEffect(() => {
  closeMobile();
}, [location.pathname, closeMobile]);
```

---

## 6. 서버 메뉴 기반 네비게이션

### 6.1 메뉴 소스

사이드바 네비게이션은 두 가지 소스에서 생성됩니다:

1. **서버 메뉴** (권장): `usePermissionStore`의 `menus` 배열 -- DB `menu_items` 테이블 기반
2. **레거시 폴백**: `mainNavItems`, `adminNavItems` 하드코딩 배열 (서버 메뉴 없을 때)

```tsx
const { menus, isLoaded } = usePermissionStore();
const useServerMenus = isLoaded && menus.length > 0;

if (useServerMenus) {
  const categorized = categorizeMenus(menus);
  mobileMainItems = categorized.main;    // section = "main"
  mobileAdminItems = categorized.admin;  // section = "admin"
  mobileBottomItems = categorized.bottom; // section = "bottom"
} else {
  // 레거시 폴백
  mobileMainItems = mainNavItems.filter(item => item.path !== "/settings");
  mobileAdminItems = filterNavItemsByRole(adminNavItems, user?.role);
}
```

### 6.2 categorizeMenus 함수

서버 메뉴를 섹션별로 분류합니다.

```tsx
import { categorizeMenus } from "@v-platform/core";

const { main, admin, bottom } = categorizeMenus(menus);
// main:   section="main" 메뉴 (대시보드, 채널, 메시지 등)
// admin:  section="admin" 메뉴 (사용자 관리, 역할 관리 등)
// bottom: section="bottom" 메뉴 (설정)
```

### 6.3 메뉴 그룹

`menu_type = "menu_group"`인 항목은 하위 메뉴를 가진 그룹입니다. 사이드바에서 펼침/접기 가능한 폴더 형태로 렌더링됩니다.

```tsx
{mobileMainItems
  .filter(item =>
    item.menuType !== "menu_group" ||
    (item.children && item.children.length > 0)
  )
  .map(item =>
    item.children && item.children.length > 0 ? (
      <MobileSidebarGroupItem key={item.permissionKey || item.path} item={item} />
    ) : (
      <SidebarNavItem key={item.path} {...item} expanded={true} />
    )
  )}
```

---

## 7. 페이지 패턴별 예시

### 7.1 대시보드 패턴

통계 카드 + 차트 + 테이블의 조합입니다.

```tsx
export default function DashboardPage() {
  return (
    <>
      <ContentHeader
        title="대시보드"
        description="시스템 현황을 한눈에 확인합니다"
      />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 통계 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-element-gap">
            <StatCard title="총 메시지" value="1,234" trend="+12%" />
            <StatCard title="활성 채널" value="8" />
            <StatCard title="오늘 오류" value="2" variant="danger" />
            <StatCard title="가동 시간" value="99.9%" variant="success" />
          </div>

          {/* 차트 섹션 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-section-gap">
            <div className="card-base p-card-x py-card-y">
              <h3 className="text-heading-md text-content-primary mb-4">
                메시지 추이
              </h3>
              <MessageChart />
            </div>
            <div className="card-base p-card-x py-card-y">
              <h3 className="text-heading-md text-content-primary mb-4">
                채널별 분포
              </h3>
              <ChannelDistribution />
            </div>
          </div>

          {/* 최근 활동 테이블 */}
          <div className="card-base overflow-hidden">
            <div className="px-card-x py-card-y border-b border-line">
              <h3 className="text-heading-md text-content-primary">최근 활동</h3>
            </div>
            <RecentActivityTable />
          </div>
        </div>
      </div>
    </>
  );
}
```

### 7.2 목록(CRUD) 패턴

검색/필터 + 테이블 + 페이지네이션 구조입니다.

```tsx
export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  return (
    <>
      <ContentHeader
        title="사용자 관리"
        description="시스템 사용자를 관리합니다"
        actions={
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>
            사용자 추가
          </button>
        }
      />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 검색/필터 바 */}
          <div className="card-base p-card-x py-card-y">
            <div className="flex flex-col sm:flex-row gap-element-gap">
              <input
                className="input flex-1"
                placeholder="이름 또는 이메일 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="input w-auto">
                <option value="">전체 역할</option>
                <option value="system_admin">시스템 관리자</option>
                <option value="org_admin">조직 관리자</option>
                <option value="user">일반 사용자</option>
              </select>
            </div>
          </div>

          {/* 데이터 테이블 */}
          <div className="card-base overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-raised">
                <tr>
                  <th className="px-card-x py-3 text-left text-heading-sm text-content-secondary">
                    이름
                  </th>
                  {/* ... */}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map(user => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
            <div className="px-card-x py-card-y border-t border-line">
              <Pagination page={page} total={totalPages} onChange={setPage} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

### 7.3 설정 페이지 패턴

탭 + 폼 구조입니다.

```tsx
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <>
      <ContentHeader
        title="설정"
        description="시스템 설정을 관리합니다"
      />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 탭 네비게이션 */}
          <div className="card-base">
            <div className="border-b border-line px-card-x">
              <nav className="flex gap-4 -mb-px">
                <TabButton
                  active={activeTab === "general"}
                  onClick={() => setActiveTab("general")}
                >
                  일반
                </TabButton>
                <TabButton
                  active={activeTab === "branding"}
                  onClick={() => setActiveTab("branding")}
                >
                  브랜딩
                </TabButton>
                <TabButton
                  active={activeTab === "security"}
                  onClick={() => setActiveTab("security")}
                >
                  보안
                </TabButton>
              </nav>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="p-card-x py-card-y">
              {activeTab === "general" && <GeneralSettings />}
              {activeTab === "branding" && <BrandingSettings />}
              {activeTab === "security" && <SecuritySettings />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

### 7.4 상세/폼 페이지 패턴

단일 카드 안에 폼 필드를 배치합니다.

```tsx
export default function EditUserPage() {
  return (
    <>
      <ContentHeader
        title="사용자 수정"
        description={`${user.username} 정보를 수정합니다`}
      />
      <div className="page-container">
        <div className="card-base p-card-x py-card-y max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-element-gap">
            <div>
              <label className="block text-heading-sm text-content-primary mb-1">
                이름
              </label>
              <input className="input" value={name} onChange={...} />
            </div>

            <div>
              <label className="block text-heading-sm text-content-primary mb-1">
                이메일
              </label>
              <input className="input" type="email" value={email} onChange={...} />
            </div>

            <div>
              <label className="block text-heading-sm text-content-primary mb-1">
                역할
              </label>
              <select className="input">
                <option value="user">일반 사용자</option>
                <option value="org_admin">조직 관리자</option>
                <option value="system_admin">시스템 관리자</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                취소
              </button>
              <button type="submit" className="btn btn-primary">
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
```

---

## 8. 인증 페이지 (Layout 외부)

로그인, 회원가입 등은 `Layout` 밖에 렌더링됩니다. 사이드바/탑바 없이 전체 화면을 사용합니다.

```tsx
// App.tsx 라우트 구조

<Routes>
  {/* Layout 외부 — 인증 페이지 */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/sso/callback" element={<SSOCallbackPage />} />

  {/* Layout 내부 — 인증 필요 페이지 */}
  <Route path="/" element={<Layout><Outlet /></Layout>}>
    <Route index element={<ProtectedRoute permissionKey="dashboard"><Dashboard /></ProtectedRoute>} />
    {/* ... */}
  </Route>

  {/* 에러 페이지 */}
  <Route path="/forbidden" element={<ForbiddenPage />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

---

## 9. 플랫폼 페이지 import

앱에서 플랫폼 제공 페이지를 import하여 라우트에 등록합니다.

```tsx
// apps/v-channel-bridge/frontend/src/App.tsx

import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  SSOCallbackPage,
  ProfilePage,
  PasswordChangePage,
  SettingsPage,
  ForbiddenPage,
  AdminUsersPage,
  AdminAuditLogPage,
  AdminPermissionsPage,
  AdminPermissionGroupsPage,
  AdminOrganizationsPage,
  AdminSystemSettingsPage,
  AdminNotificationsPage,
  NotificationsPage,
} from "@v-platform/core";
```

플랫폼이 18개 페이지를 제공하므로, 앱은 앱 고유 페이지만 구현하면 됩니다.

---

## 10. 키보드 단축키

`useKeyboardShortcuts` 훅이 `LayoutContent` 내부에서 전역 단축키를 등록합니다.

```tsx
// Layout.tsx 내부
function LayoutContent({ children }: LayoutContentProps) {
  useKeyboardShortcuts();
  // ...
}
```

---

## 11. 체크리스트

새 페이지를 만들 때 확인할 항목:

- [ ] Fragment(`<>`) + `ContentHeader` + `page-container` + `space-y-section-gap` 패턴 준수
- [ ] `ProtectedRoute`로 감싸고 적절한 `permissionKey` 지정
- [ ] 카드는 `card-base` 클래스 사용
- [ ] 제목은 `text-heading-*` + `text-content-primary` 사용
- [ ] 입력 필드는 `input` 클래스 사용
- [ ] 버튼은 `btn` + `btn-primary`/`btn-secondary`/`btn-danger` 사용
- [ ] 하드코딩 색상 없이 시맨틱 토큰만 사용
- [ ] 반응형 레이아웃 (모바일 → 데스크톱) 확인
- [ ] 다크 모드에서 UI 확인
- [ ] 라우트를 `App.tsx`에 등록
- [ ] DB `menu_items`에 메뉴 항목 추가 (사이드바에 표시할 경우)
