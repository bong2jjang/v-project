# v-platform 고유 컨벤션 (새 앱 작성 규칙)

플랫폼 자체(프레임워크) 수정 시 및 **새 앱을 작성할 때** 따라야 하는 규칙입니다. 공통 규칙은 `.claude/shared/coding_conventions.md` 참조.

## 새 앱 작성 규칙

### 앱 프론트엔드 페이지

- **플랫폼 공통 페이지** (Login, Register, Settings, UserManagement 등)는 `@v-platform/core/pages`에서 import — **복사 금지**
- **앱 전용 페이지**만 `pages/` 디렉토리에 직접 구현
- 앱 이름/설명은 PlatformConfig에서 설정 — **하드코딩 금지**

```tsx
// App.tsx에서 플랫폼 페이지 import
import { LoginPage, SettingsPage, UserManagementPage } from '@v-platform/core/pages';
import Dashboard from './pages/Dashboard';  // 앱 전용
```

### PlatformConfig 사용

앱 브랜딩(이름, 설명, 로고)은 코드에서 PlatformConfig로 설정하며, Settings UI에서도 변경 가능합니다:

```tsx
// App.tsx
import { PlatformProvider } from '@v-platform/core/providers';

const config: PlatformConfig = {
  appTitle: "My App",
  appDescription: "앱 설명",
  appLogo: "/logo.svg",
  // ... 기타 설정
};

function App() {
  return (
    <PlatformProvider config={config}>
      {/* 라우트 */}
    </PlatformProvider>
  );
}
```

### Shim 패턴 (하위 호환)

앱 로컬 파일에서 `@v-platform/core`를 re-export하는 shim 파일을 사용하여 기존 import 경로를 유지합니다:

```tsx
// src/components/Layout.tsx (shim)
export { ContentHeader, Sidebar } from '@v-platform/core/components';
```

### 앱 메뉴 시드

- 플랫폼 공통 메뉴 (`app_id = NULL`)는 자동 제공
- 앱 전용 메뉴는 `app_id`를 지정하여 시드
- 다른 앱의 메뉴가 표시되지 않음 (app_id 격리)

### 앱 컨테이너 명명

- 인프라: `v-project-{service}` (postgres, redis, mailhog)
- 앱: `{app-name}-{service}` (v-channel-bridge-backend, v-channel-bridge-frontend)

### 앱 백엔드 진입점

새 앱의 `main.py`는 PlatformApp만 사용하면 됩니다 (~30줄):

```python
from v_platform.app import PlatformApp

app = PlatformApp(
    app_id="my-app",
    app_title="My App",
)
# PlatformApp이 자동 제공: auth, RBAC, audit, SSO, middleware, logging, metrics
```

### 앱 전용 API/모델 추가

- 앱 전용 라우터는 `register_app_routers()`로 등록
- 앱 전용 모델은 `apps/{app-name}/backend/app/models/` 에 정의
- DB 마이그레이션은 `apps/{app-name}/backend/migrations/a{NNN}_*.py` (멱등 필수)
- 플랫폼 테이블(`users`, `permissions`, `audit_log` 등) 스키마 수정 금지 — 플랫폼 마이그레이션 `p*.py` 경로로만

### 앱 전용 설정/환경변수

- `.env` 에서 앱 전용 네임스페이스 사용 (예: `BRIDGE_*`, `PORTAL_*`)
- 플랫폼 공통 변수(`DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `FRONTEND_URL`)는 재사용
- Redis 키는 앱 전용 네임스페이스(`{app_name}:*`) 내에서만 사용 (다른 앱과 충돌 방지)

## 플랫폼 자체 수정 규칙

### Public API 하위 호환

- `PlatformApp` 생성자 시그니처 변경 전에는 기존 앱 영향 확인
- `@v-platform/core` public export(`src/index.ts`)에서 이름 변경/제거는 deprecate 단계 필수
- `v_platform.models.*` 스키마 breaking change는 마이그레이션 동반

### 마이그레이션

- 파일명: `platform/backend/v_platform/migrations/p{NNN}_{description}.py`
- `def migrate(engine)` 함수 구현
- **멱등 필수**: IF NOT EXISTS, 중복 체크, 여러 번 실행해도 안전
- 앱 전용 마이그레이션(`a*.py`)과 네임스페이스 분리

### 플랫폼 페이지/컴포넌트 추가

- 모든 앱이 사용할 수 있는 일반화된 구조만 추가
- 특정 앱에만 의미 있는 로직은 앱 스코프에서 구현
- 추가 후 `npm run build` → 앱 프론트엔드 재빌드 경로 확인

### 테스트

- 플랫폼 변경 후 모든 앱(bridge/portal/template)에서 여전히 동작하는지 확인
- `docker compose --profile template --profile portal up -d --build` 로 전체 리빌드 검증
