---
title: Getting Started
sidebar_position: 1
---

# v-platform-template 시작 가이드

## 이 템플릿의 목적

v-platform-template은 **v-platform 기반 새 앱을 1시간 안에 만들어 실행할 수 있도록** 구성된 최소 스캐폴딩 앱입니다.

인증, RBAC(역할 기반 접근 제어), 감사 로그, 조직도, 알림, 설정 등 플랫폼 공통 기능이 이미 연결되어 있으므로, 개발자는 **앱 고유 비즈니스 로직에만 집중**하면 됩니다. 이 템플릿을 복사한 뒤 앱 이름과 포트만 변경하면 바로 동작하는 앱이 만들어집니다.

---

## 빠른 실행

### Docker 시작

v-platform-template은 `template` 프로필에 포함되어 있습니다.

```bash
docker compose --profile template up -d --build
```

모든 앱(v-channel-bridge, v-platform-template, v-platform-portal)을 함께 띄우려면:

```bash
docker compose --profile template --profile portal up -d --build
```

### 접속 정보

| 항목 | 주소 |
|------|------|
| 프론트엔드 | `http://127.0.0.1:5174` |
| 백엔드 API | `http://127.0.0.1:8002` |
| API 문서 (Swagger) | `http://127.0.0.1:8002/docs` |

### 기본 관리자 계정

| 항목 | 값 |
|------|-----|
| 이메일 | `admin@example.com` |
| 사용자명 | `admin` |
| 비밀번호 | `Admin123!` |

브라우저에서 `http://127.0.0.1:5174`로 접속하면 로그인 페이지가 나타납니다. 위 계정으로 로그인하면 대시보드가 첫 진입 화면으로 표시되며, 플랫폼/데이터베이스/Redis의 연결 상태를 바로 확인할 수 있습니다.

---

## 무엇이 들어있나

### 백엔드: PlatformApp 초기화

`apps/v-platform-template/backend/app/main.py` 파일 하나로 전체 백엔드가 구성됩니다. 핵심은 `PlatformApp` 인스턴스 생성뿐입니다.

```python
from v_platform.app import PlatformApp

platform = PlatformApp(
    app_name="v-platform-template",
    version="1.0.0",
    description="Template app with all platform features",
    lifespan=lifespan,
)

# 앱 전용 라우터는 여기에 등록
# platform.register_app_routers(my_feature.router)

app = platform.fastapi
```

`PlatformApp`이 자동으로 제공하는 것:
- 인증 API (로그인, 회원가입, JWT 발급/갱신)
- 사용자 관리, 권한 그룹, 권한 매트릭스 API
- 감사 로그, 메뉴 관리, 조직도 API
- 시스템 설정, 알림, 헬스체크 API
- CSRF 미들웨어, Prometheus 메트릭

### 프론트엔드: App.tsx 구조

`apps/v-platform-template/frontend/src/App.tsx`에서 플랫폼 페이지를 `@v-platform/core/pages`로부터 import하고, 앱 전용 페이지와 함께 라우트를 구성합니다.

```tsx
// 플랫폼 페이지 -- @v-platform/core에서 제공
import {
  LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage,
  SSOCallbackPage, ForbiddenPage, ProfilePage, PasswordChangePage,
  UserManagementPage, AuditLogsPage, SettingsPage, CustomIframePage,
  MenuManagementPage, PermissionMatrixPage, PermissionGroupsPage,
  OrganizationsPage,
} from "@v-platform/core/pages";

// 앱 전용 페이지
import Dashboard from "./pages/Dashboard";
import Help from "./pages/Help";
```

`PlatformProvider`로 앱 정보를 주입합니다:

```tsx
<PlatformProvider config={{
  appName: "v-platform-template",
  appTitle: "v-platform-template",
  appDescription: "플랫폼 템플릿 앱",
}}>
  {/* 라우트 구성 */}
</PlatformProvider>
```

### 앱 전용 페이지

| 페이지 | 파일 | 설명 |
|--------|------|------|
| Dashboard | `pages/Dashboard.tsx` | 시스템 상태 모니터링, 앱별 위젯 추가 영역 |
| Help | `pages/Help.tsx` | 사용 가이드, 프로덕트 투어, FAQ |
| NotificationManagement | `pages/admin/NotificationManagement.tsx` | 플랫폼 알림 관리 (re-export) |

`Layout`과 `ProtectedRoute` 컴포넌트는 `@v-platform/core`에서 re-export하여 사용합니다.

---

## 새 앱으로 복제하기

v-platform-template을 복사하여 "v-my-app"이라는 새 앱을 만드는 시나리오입니다.

### 1단계: 디렉터리 복사

```bash
cp -r apps/v-platform-template apps/v-my-app
```

### 2단계: app_id / appName 변경

**백엔드** -- `apps/v-my-app/backend/app/main.py`:

```python
platform = PlatformApp(
    app_name="v-my-app",          # 변경
    version="1.0.0",
    description="나의 새 앱",      # 변경
    lifespan=lifespan,
)
```

**프론트엔드** -- `apps/v-my-app/frontend/src/App.tsx`:

```tsx
<PlatformProvider config={{
  appName: "v-my-app",            // 변경
  appTitle: "My App",             // 변경
  appDescription: "나의 새 앱",    // 변경
}}>
```

**프론트엔드** -- `apps/v-my-app/frontend/package.json`:

```json
{
  "name": "v-my-app-frontend"
}
```

### 3단계: Docker 서비스 추가

`docker-compose.yml`에 새 서비스를 추가합니다. 기존 template 서비스 정의를 참고하여 경로와 포트를 변경합니다.

```yaml
  # v-my-app (포트 8003/5175)
  my-app-backend:
    build:
      context: .
      dockerfile: apps/v-my-app/backend/Dockerfile
    container_name: v-my-app-backend
    ports:
      - "8003:8000"
    volumes:
      - ./apps/v-my-app/backend:/app
      - ./platform/backend:/platform/backend
    environment:
      - PYTHONPATH=/app:/platform/backend
      - DATABASE_URL=${DATABASE_URL:-postgresql://vmsuser:vmspassword@postgres:5432/v_project}
      - REDIS_URL=${REDIS_URL:-redis://:redispassword@redis:6379/0}
      - SECRET_KEY=${SECRET_KEY:-v-my-app-secret-key-32chars!!}
      - FRONTEND_URL=http://${PUBLIC_HOST:-127.0.0.1}:5175
      # ... 나머지 환경 변수는 template-backend 참조
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    profiles:
      - my-app
    networks:
      - v-project-network

  my-app-frontend:
    build:
      context: .
      dockerfile: apps/v-my-app/frontend/Dockerfile.dev
    container_name: v-my-app-frontend
    ports:
      - "5175:5173"
    volumes:
      - ./apps/v-my-app/frontend:/workspace/apps/v-my-app/frontend
      - ./platform/frontend/v-platform-core:/workspace/platform/frontend/v-platform-core
      - /workspace/node_modules
      - /workspace/apps/v-my-app/frontend/node_modules
    profiles:
      - my-app
    networks:
      - v-project-network
```

### 4단계: 포트 할당

기존 앱 포트와 겹치지 않도록 배정합니다.

| 앱 | 백엔드 | 프론트엔드 |
|----|--------|-----------|
| v-channel-bridge | 8000 | 5173 |
| v-platform-template | 8002 | 5174 |
| v-platform-portal | 8080 | 5180 |
| **v-my-app (새 앱)** | **8003** | **5175** |

### 5단계: 마이그레이션 시드

플랫폼 마이그레이션은 앱 간 공유 DB를 사용하므로 별도 실행할 필요가 없습니다. 앱 전용 테이블이 필요하면 `apps/v-my-app/backend/migrations/` 디렉터리에 `a001_` 접두사로 마이그레이션 스크립트를 추가합니다.

### 6단계: 메뉴 등록

새 앱을 실행한 뒤, 관리자로 로그인하여 **메뉴 관리** 페이지(`/admin/menus`)에서 앱 전용 메뉴를 등록합니다. 메뉴의 `path`를 앱 라우트와 맞추면 사이드바에 표시됩니다.

### 실행

```bash
docker compose --profile my-app up -d --build
```

브라우저에서 `http://127.0.0.1:5175`로 접속하여 확인합니다.

---

## 플랫폼 페이지 그대로 쓰기

App.tsx에는 이미 16개 플랫폼 페이지의 라우트가 연결되어 있습니다. 별도 구현 없이 그대로 동작합니다.

```tsx
<Routes>
  {/* 공개 라우트 -- 플랫폼 페이지 */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />
  <Route path="/forbidden" element={<ForbiddenPage />} />
  <Route path="/sso/callback" element={<SSOCallbackPage />} />

  {/* 대시보드 (앱 전용) */}
  <Route path="/" element={
    <ProtectedRoute permissionKey="dashboard">
      <Layout><Dashboard /></Layout>
    </ProtectedRoute>
  } />

  {/* 플랫폼 공통 페이지 -- 인증 필요 */}
  <Route path="/settings" element={<ProtectedRoute permissionKey="settings"><Layout><SettingsPage /></Layout></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
  <Route path="/password-change" element={<ProtectedRoute><Layout><PasswordChangePage /></Layout></ProtectedRoute>} />
  <Route path="/users" element={<ProtectedRoute permissionKey="users"><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
  <Route path="/audit-logs" element={<ProtectedRoute permissionKey="audit_logs"><Layout><AuditLogsPage /></Layout></ProtectedRoute>} />
  <Route path="/admin/menus" element={<ProtectedRoute permissionKey="menu_management"><Layout><MenuManagementPage /></Layout></ProtectedRoute>} />
  <Route path="/admin/permissions" element={<ProtectedRoute permissionKey="permission_management"><Layout><PermissionMatrixPage /></Layout></ProtectedRoute>} />
  <Route path="/admin/permission-groups" element={<ProtectedRoute permissionKey="permission_groups"><Layout><PermissionGroupsPage /></Layout></ProtectedRoute>} />
  <Route path="/admin/organizations" element={<ProtectedRoute permissionKey="organizations"><Layout><OrganizationsPage /></Layout></ProtectedRoute>} />
  <Route path="/custom/:menuId" element={<ProtectedRoute><Layout><CustomIframePage /></Layout></ProtectedRoute>} />

  {/* === 앱 전용 라우트는 여기에 추가 === */}

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

새 라우트를 추가할 때는 `{/* 앱 전용 라우트는 여기에 추가 */}` 주석 위치에 끼워 넣으면 됩니다.

---

## 앱 전용 기능 확장

### 백엔드: API 라우터 추가

새 라우터 파일을 `apps/<name>/backend/app/api/` 디렉터리에 생성합니다.

```python
# apps/v-my-app/backend/app/api/tasks.py
from fastapi import APIRouter, Depends
from v_platform.utils.auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/")
async def list_tasks(user=Depends(get_current_user)):
    return {"tasks": [], "user": user.username}
```

`main.py`에서 `register_app_routers()`로 등록합니다:

```python
# apps/v-my-app/backend/app/main.py

from app.api import tasks

platform.register_app_routers(tasks.router)
```

### 프론트엔드: 페이지 추가

새 페이지를 `apps/<name>/frontend/src/pages/` 디렉터리에 생성합니다.

```tsx
// apps/v-my-app/frontend/src/pages/Tasks.tsx
import { ContentHeader } from "../components/layout/ContentHeader";

export default function Tasks() {
  return (
    <>
      <ContentHeader title="작업 목록" description="앱 전용 작업 관리" />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 앱 전용 콘텐츠 */}
        </div>
      </div>
    </>
  );
}
```

App.tsx에 라우트를 등록합니다:

```tsx
import Tasks from "./pages/Tasks";

// Routes 안에 추가
<Route path="/tasks" element={
  <ProtectedRoute permissionKey="tasks">
    <Layout><Tasks /></Layout>
  </ProtectedRoute>
} />
```

`ProtectedRoute`의 `permissionKey`는 메뉴 관리에서 등록한 메뉴의 키와 일치해야 권한 검사가 적용됩니다.

---

## 앱별 투어와 도움말

### 투어 스텝 수정

투어 정의 파일은 `apps/<name>/frontend/src/lib/tour/tours.ts`에 있습니다. Driver.js의 `DriveStep` 배열로 구성되며, `element` 셀렉터는 실제 DOM의 `data-tour` 속성과 매칭됩니다.

```typescript
// apps/v-my-app/frontend/src/lib/tour/tours.ts
import { DriveStep } from "driver.js";

export const mainTourSteps: DriveStep[] = [
  {
    popover: {
      title: "My App에 오신 것을 환영합니다!",
      description: "앱 소개 메시지를 여기에 작성합니다.",
    },
  },
  {
    element: "[data-tour='my-widget']",  // 페이지에 data-tour 속성 추가 필요
    popover: {
      title: "주요 위젯",
      description: "이 위젯의 기능을 설명합니다.",
      side: "bottom",
    },
  },
];
```

`lib/tour/index.ts`에서 export하고, `hooks/useTour.ts`의 `startPageTour`에서 페이지별 스텝을 switch문으로 매핑합니다.

```typescript
// hooks/useTour.ts -- 새 페이지 투어 추가 시
import { tasksTourSteps } from "../lib/tour";

type PageName = "dashboard" | "settings" | "tasks";  // 페이지 추가

const startPageTour = useCallback((pageName: PageName) => {
  let steps: DriveStep[] = [];
  switch (pageName) {
    case "tasks":
      steps = tasksTourSteps;   // 새 투어 스텝 연결
      break;
    // ...
  }
  // ...
}, []);
```

### Help 페이지에 섹션 추가

`pages/Help.tsx`에는 "시작하기", "페이지별 기능 안내", "프로덕트 투어", "자주 묻는 질문" 섹션이 있습니다. 앱 고유 기능을 추가할 때는:

1. **페이지별 기능 안내** 섹션에 `FeatureRow` 컴포넌트를 추가하여 새 페이지 설명을 넣습니다.
2. **프로덕트 투어** 섹션에 새 페이지 투어를 시작하는 버튼을 추가합니다.
3. **자주 묻는 질문** 섹션에 앱 관련 FAQ를 `FaqItem`으로 추가합니다.

---

## 확인 체크리스트

새 앱을 만든 뒤 아래 항목을 순서대로 검증합니다.

### 기본 동작

- [ ] `docker compose --profile <name> up -d --build`로 컨테이너가 정상 시작되는가
- [ ] 프론트엔드 주소(`http://127.0.0.1:<포트>`)에 접속하면 로그인 페이지가 나타나는가
- [ ] `admin@example.com` / `Admin123!`로 로그인이 되는가
- [ ] 로그인 후 대시보드가 표시되고, 플랫폼/데이터베이스/Redis 상태가 모두 healthy인가

### 메뉴와 권한

- [ ] 메뉴 관리(`/admin/menus`)에서 앱 전용 메뉴를 등록하면 사이드바에 표시되는가
- [ ] 권한 그룹(`/admin/permission-groups`)에서 새 메뉴에 대한 권한을 설정할 수 있는가
- [ ] 권한이 없는 사용자가 해당 메뉴에 접근하면 차단되는가

### 감사 로그

- [ ] 로그인, 사용자 생성, 설정 변경 등의 작업이 감사 로그(`/audit-logs`)에 기록되는가

### 앱 전용 기능

- [ ] 백엔드에 추가한 API 라우터가 `/docs`(Swagger)에 표시되는가
- [ ] 프론트엔드에 추가한 페이지가 라우트를 통해 정상 렌더링되는가
- [ ] 프로덕트 투어가 앱 전용 요소를 올바르게 하이라이트하는가
