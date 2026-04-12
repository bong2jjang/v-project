# pnpm Workspace 마이그레이션 계획

> **상태**: 검토 대기  
> **작성일**: 2026-04-12  
> **목적**: `@v-platform/core`를 path alias에서 실제 pnpm workspace 패키지로 전환

---

## 1. 배경 및 동기

### 현재 구조의 문제점

플랫폼 프론트엔드(`platform/frontend/v-platform-core/`)는 독립된 npm 패키지처럼 설계되었지만, 실제로는 **path alias + symlink** 조합으로 연결되어 있다.

```
현재 흐름:
  App vite.config.ts  →  alias '@v-platform/core' → '../../../platform/.../src'
  Docker command       →  ln -sf /app/node_modules /platform/.../node_modules
  App vite.config.ts  →  resolvePlatformDeps() 커스텀 플러그인
```

**직접적 문제 사례 (2026-04-12)**:
- 플랫폼 코드에 `@uiw/react-md-editor` 추가 → 3개 앱 전체 프론트엔드 장애
- 원인: 플랫폼 코드의 bare import를 Vite가 해석 불가
- 해결에 필요했던 작업: 3개 앱 package.json 수동 추가 + vite.config.ts 수정 + 커스텀 Vite 플러그인 작성

### 현재 방식의 구조적 약점

| 문제 | 설명 |
|------|------|
| **의존성 수동 동기화** | 플랫폼이 사용하는 패키지를 3개 앱에 각각 수동 추가해야 함 |
| **커스텀 Vite 플러그인** | `resolvePlatformDeps()` — 플랫폼 파일의 bare import를 앱 node_modules로 리다이렉트 |
| **Docker symlink 해킹** | `ln -sf /app/node_modules /platform/.../node_modules` 매 컨테이너 시작마다 실행 |
| **3곳 동시 수정** | 플랫폼 의존성 변경 시 vite.config.ts × 3, package.json × 3 동시 수정 필요 |
| **디버깅 난이도** | 표준이 아닌 해석 경로라 에러 메시지가 직관적이지 않음 |

---

## 2. 목표 상태

```
목표 흐름:
  pnpm-workspace.yaml  →  패키지 관계 정의
  App package.json     →  "@v-platform/core": "workspace:*"
  pnpm install         →  자동으로 심볼릭 링크 + 의존성 해석
```

### After 구조

```
v-project/
├── pnpm-workspace.yaml          ← NEW
├── package.json                  ← NEW (루트, scripts만)
├── platform/frontend/v-platform-core/
│   └── package.json              ← UPDATE (dependencies 완성)
├── apps/v-channel-bridge/frontend/
│   └── package.json              ← UPDATE ("@v-platform/core": "workspace:*")
├── apps/v-platform-template/frontend/
│   └── package.json              ← UPDATE
└── apps/v-platform-portal/frontend/
    └── package.json              ← UPDATE
```

---

## 3. 현재 상태 분석

### 3.1 플랫폼 패키지 (`@v-platform/core`)

```json
// platform/frontend/v-platform-core/package.json (현재)
{
  "name": "@v-platform/core",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0"
  },
  "dependencies": {
    "axios": "^1.6.5",
    "zustand": "^4.4.7",
    "lucide-react": "^0.309.0",
    "@tanstack/react-query": "^5.17.0"
  }
}
```

**누락된 의존성** (코드에서 import하지만 package.json에 미선언):
- `@uiw/react-md-editor` — NotificationManagement.tsx에서 사용

### 3.2 플랫폼 코드가 import하는 전체 외부 패키지

| 패키지 | 현재 package.json 위치 | 용도 |
|--------|----------------------|------|
| `react` | peer | UI 프레임워크 |
| `react-dom` | peer | DOM 렌더링 |
| `react-router-dom` | peer | 라우팅 |
| `axios` | dependencies | HTTP 클라이언트 |
| `zustand` | dependencies | 상태 관리 |
| `lucide-react` | dependencies | 아이콘 |
| `@tanstack/react-query` | dependencies | 서버 상태 관리 |
| `@uiw/react-md-editor` | **미선언** | 마크다운 에디터 |

### 3.3 앱별 고유 의존성 (플랫폼에 없는 것)

| 패키지 | 사용 앱 |
|--------|---------|
| `@fingerprintjs/fingerprintjs` | 3개 앱 공통 |
| `recharts` | 3개 앱 공통 |
| `driver.js` | 3개 앱 공통 (투어 기능) |

### 3.4 Docker 프론트엔드 서비스 구조

```yaml
# 현재 docker-compose.yml (3개 프론트엔드 서비스 공통 패턴)
frontend:
  build:
    context: ./apps/v-channel-bridge/frontend
    dockerfile: Dockerfile.dev
  volumes:
    - ./apps/v-channel-bridge/frontend:/app
    - ./platform/frontend:/platform/frontend
    - /app/node_modules          # 익명 볼륨 (빌드 시 설치된 것 보존)
    - /app/.vite
    - frontend-pnpm-store:/root/.local/share/pnpm/store
  command: sh -c "ln -sf /app/node_modules /platform/.../node_modules && pnpm run dev ..."
```

### 3.5 Vite 설정 (3개 앱 공통)

```typescript
// 현재 각 앱의 vite.config.ts
function resolvePlatformDeps(): Plugin { /* 커스텀 플러그인 */ }

export default defineConfig({
  plugins: [resolvePlatformDeps(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@v-platform/core': path.resolve(__dirname, '../../../platform/.../src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand', '@tanstack/react-query'],
  },
  optimizeDeps: {
    include: ['@uiw/react-md-editor'],
  },
});
```

### 3.6 TypeScript 설정 (3개 앱 공통)

```json
// 현재 각 앱의 tsconfig.json
{
  "paths": {
    "@/*": ["src/*"],
    "@v-platform/core": ["../../../platform/frontend/v-platform-core/src/index.ts"],
    "@v-platform/core/*": ["../../../platform/frontend/v-platform-core/src/*"]
  }
}
```

---

## 4. 마이그레이션 단계

### Phase 1: 루트 Workspace 설정

#### 1-1. `pnpm-workspace.yaml` 생성

```yaml
# v-project/pnpm-workspace.yaml
packages:
  - 'platform/frontend/v-platform-core'
  - 'apps/*/frontend'
```

#### 1-2. 루트 `package.json` 생성

```json
{
  "name": "v-project",
  "private": true,
  "packageManager": "pnpm@10.32.1",
  "scripts": {
    "dev:bridge": "pnpm --filter vms-chat-ops-frontend dev",
    "dev:template": "pnpm --filter v-platform-template-frontend dev",
    "dev:portal": "pnpm --filter v-platform-portal-frontend dev",
    "lint:all": "pnpm -r run lint",
    "type-check:all": "pnpm -r run type-check"
  }
}
```

### Phase 2: 플랫폼 패키지 의존성 완성

#### 2-1. `@v-platform/core` package.json 업데이트

```json
{
  "name": "@v-platform/core",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.17.0",
    "@uiw/react-md-editor": "^3.25.0",
    "axios": "^1.6.5",
    "lucide-react": "^0.309.0",
    "zustand": "^4.4.7"
  }
}
```

변경점: `@uiw/react-md-editor` 추가 (실제 코드에서 사용 중이므로)

### Phase 3: 앱 package.json 업데이트

#### 3-1. 3개 앱 공통 변경

```diff
// apps/*/frontend/package.json
{
  "dependencies": {
+   "@v-platform/core": "workspace:*",
    "@fingerprintjs/fingerprintjs": "^4.2.2",
-   "@tanstack/react-query": "^5.17.0",
-   "axios": "^1.6.5",
    "driver.js": "^1.3.1",
-   "lucide-react": "^0.309.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "recharts": "^2.15.4",
-   "@uiw/react-md-editor": "^3.25.0",
-   "zustand": "^4.4.7"
  }
}
```

> **참고**: `@tanstack/react-query`, `axios`, `lucide-react`, `zustand`, `@uiw/react-md-editor`은 `@v-platform/core`의 dependencies로 자동 설치됨. 앱에서 직접 import하는 경우에도 pnpm workspace가 hoisting으로 해석 가능.
>
> 다만 앱 코드에서도 직접 import하는 패키지(예: `zustand`, `@tanstack/react-query`)는 앱에도 남겨두는 게 명시적. **첫 단계에서는 제거하지 않고** workspace 연결만 추가하는 것을 권장.

#### 3-1 (보수적 버전): 첫 단계에서는 추가만

```diff
{
  "dependencies": {
+   "@v-platform/core": "workspace:*",
    "@fingerprintjs/fingerprintjs": "^4.2.2",
    "@tanstack/react-query": "^5.17.0",
    "axios": "^1.6.5",
    "driver.js": "^1.3.1",
    "lucide-react": "^0.309.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "recharts": "^2.15.4",
    "@uiw/react-md-editor": "^3.25.0",
    "zustand": "^4.4.7"
  }
}
```

### Phase 4: Vite 설정 정리

#### 4-1. `resolvePlatformDeps` 플러그인 제거

workspace에서 `@v-platform/core`가 실제 패키지로 설치되면, 플랫폼 코드의 bare import가 자체 node_modules를 통해 해석됨.

```diff
// apps/*/frontend/vite.config.ts
-import { defineConfig, Plugin } from 'vite';
+import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

-function resolvePlatformDeps(): Plugin {
-  const appEntry = path.resolve(__dirname, './src/main.tsx');
-  return {
-    name: 'resolve-platform-deps',
-    enforce: 'pre',
-    async resolveId(source, importer, options) {
-      if (!importer || !importer.includes('/platform/')) return null;
-      if (source.startsWith('.') || source.startsWith('/')) return null;
-      const resolved = await this.resolve(source, appEntry, { ...options, skipSelf: true });
-      return resolved;
-    },
-  };
-}

export default defineConfig({
- plugins: [resolvePlatformDeps(), react()],
+ plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
-     '@v-platform/core': path.resolve(__dirname, '../../../platform/frontend/v-platform-core/src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand', '@tanstack/react-query'],
  },
- optimizeDeps: {
-   include: ['@uiw/react-md-editor'],
-   esbuildOptions: {
-     target: 'es2020',
-     logLimit: 0,
-   },
- },
```

> **핵심**: `@v-platform/core` alias가 더 이상 필요 없음. pnpm이 `node_modules/@v-platform/core` → `platform/frontend/v-platform-core` 심볼릭 링크를 자동 생성.

#### 4-2. `optimizeDeps` 정리

`@uiw/react-md-editor`가 플랫폼 패키지의 정식 의존성이므로 `optimizeDeps.include`도 불필요해질 수 있음. 제거 후 테스트하여 확인.

### Phase 5: TypeScript 설정 정리

#### 5-1. 앱 tsconfig.json 단순화

```diff
// apps/*/frontend/tsconfig.json
{
  "paths": {
    "@/*": ["src/*"],
-   "@v-platform/core": ["../../../platform/frontend/v-platform-core/src/index.ts"],
-   "@v-platform/core/*": ["../../../platform/frontend/v-platform-core/src/*"]
  }
}
```

> pnpm workspace가 `node_modules/@v-platform/core`를 생성하므로 TypeScript의 표준 `moduleResolution: "bundler"`가 자동으로 해석. tsconfig paths 제거 가능.

### Phase 6: Docker 설정 변경

#### 6-1. Dockerfile.dev 수정

```dockerfile
# apps/*/frontend/Dockerfile.dev
FROM node:18-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache wget

WORKDIR /workspace

# 루트 workspace 파일 복사
COPY pnpm-workspace.yaml package.json ./

# 플랫폼 패키지 복사
COPY platform/frontend/v-platform-core/package.json ./platform/frontend/v-platform-core/

# 앱 패키지 복사 (빌드할 앱만)
COPY apps/v-channel-bridge/frontend/package.json ./apps/v-channel-bridge/frontend/
# pnpm-lock.yaml은 루트에서 관리
COPY pnpm-lock.yaml ./

# Workspace 설치 (해당 앱 + 의존 패키지만)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --filter vms-chat-ops-frontend... --no-frozen-lockfile --prefer-offline

# 소스 복사
COPY apps/v-channel-bridge/frontend ./apps/v-channel-bridge/frontend
COPY platform/frontend/v-platform-core ./platform/frontend/v-platform-core

WORKDIR /workspace/apps/v-channel-bridge/frontend

EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]
```

#### 6-2. docker-compose.yml 수정

```diff
  frontend:
    build:
-     context: ./apps/v-channel-bridge/frontend
+     context: .
      dockerfile: Dockerfile.dev
+     args:
+       APP_NAME: v-channel-bridge
    volumes:
-     - ./apps/v-channel-bridge/frontend:/app
-     - ./platform/frontend:/platform/frontend
-     - /app/node_modules
-     - /app/.vite
-     - frontend-pnpm-store:/root/.local/share/pnpm/store
+     - ./apps/v-channel-bridge/frontend:/workspace/apps/v-channel-bridge/frontend
+     - ./platform/frontend/v-platform-core:/workspace/platform/frontend/v-platform-core
+     - /workspace/node_modules
+     - /workspace/apps/v-channel-bridge/frontend/node_modules
+     - /workspace/platform/frontend/v-platform-core/node_modules
+     - frontend-pnpm-store:/root/.local/share/pnpm/store
-   command: sh -c "ln -sf /app/node_modules /platform/.../node_modules && pnpm run dev ..."
+   command: pnpm run dev -- --host 0.0.0.0
```

> **핵심 변경**: symlink 명령 제거, build context를 프로젝트 루트로 변경, pnpm workspace가 node_modules 구조를 관리.

#### 6-3. lockfile 관리

```diff
- apps/v-channel-bridge/frontend/pnpm-lock.yaml   (삭제)
- apps/v-platform-template/frontend/pnpm-lock.yaml (삭제)
- apps/v-platform-portal/frontend/pnpm-lock.yaml   (삭제)
+ v-project/pnpm-lock.yaml                          (루트 단일 lockfile)
```

---

## 5. 마이그레이션 순서 및 체크리스트

### Step 1: 로컬 workspace 설정 (Docker 외부)
- [ ] 루트에 `pnpm-workspace.yaml` 생성
- [ ] 루트에 `package.json` 생성
- [ ] `@v-platform/core/package.json`에 `@uiw/react-md-editor` 추가
- [ ] 3개 앱 package.json에 `"@v-platform/core": "workspace:*"` 추가
- [ ] 루트에서 `pnpm install` 실행 → `pnpm-lock.yaml` 생성 확인
- [ ] `node_modules/@v-platform/core` 심볼릭 링크 확인

### Step 2: Vite/TypeScript 설정 정리
- [ ] 3개 앱 vite.config.ts에서 `resolvePlatformDeps` 플러그인 제거
- [ ] 3개 앱 vite.config.ts에서 `@v-platform/core` alias 제거
- [ ] 3개 앱 vite.config.ts에서 `optimizeDeps.include` 정리
- [ ] 3개 앱 tsconfig.json에서 `@v-platform/core` paths 제거
- [ ] 로컬에서 `pnpm run type-check` 통과 확인 (3개 앱)

### Step 3: Docker 설정 변경
- [ ] 3개 앱 Dockerfile.dev를 workspace 구조로 수정
- [ ] docker-compose.yml volumes/command 수정
- [ ] 앱별 pnpm-lock.yaml 삭제 (+ package-lock.json 정리)
- [ ] `docker compose --profile template --profile portal up -d --build` 로 전체 빌드
- [ ] 3개 프론트엔드 정상 기동 확인

### Step 4: 검증
- [ ] 3개 앱 브라우저 접속 확인
- [ ] 알림 관리 페이지 (MDEditor) 정상 동작
- [ ] HMR 동작 확인 — 앱 코드 수정 시
- [ ] HMR 동작 확인 — 플랫폼 코드 수정 시
- [ ] `docker compose` 재시작 시 정상 기동

### Step 5: 정리
- [ ] 기존 symlink 관련 코드/주석 정리
- [ ] CLAUDE.md 업데이트 (워크플로우 변경 반영)
- [ ] 커밋

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Docker build context가 루트로 변경 → 빌드 속도 저하 | `.dockerignore`가 더 많은 파일을 제외해야 함 | 루트에 `.dockerignore` 추가, backend/docs/monitoring 등 제외 |
| pnpm workspace hoisting으로 패키지 위치 변경 | phantom dependency 가능성 | `dedupe` 유지, 명시적 의존성 선언 |
| 익명 볼륨 경로 변경 (`/app` → `/workspace`) | 기존 볼륨과 충돌 가능 | `docker compose down -v`로 볼륨 초기화 후 시작 |
| 플랫폼 코드 수정 시 HMR이 달라질 수 있음 | 개발 경험 변화 | `server.watch`에 workspace 경로 포함 확인 |
| vite.config.ts의 `server.fs.allow` 변경 필요 | 파일 접근 거부 가능 | workspace 루트 포함하도록 수정 |

---

## 7. Before / After 요약

| 항목 | Before | After |
|------|--------|-------|
| 플랫폼 패키지 추가 | 3개 앱 package.json + vite.config 수동 수정 | 플랫폼 package.json만 수정, `pnpm install` |
| Vite import 해석 | 커스텀 플러그인 (`resolvePlatformDeps`) | 표준 node_modules 해석 |
| Docker symlink | `ln -sf ...` command 매번 실행 | pnpm workspace가 자동 관리 |
| TypeScript 해석 | tsconfig paths로 상대경로 매핑 | 표준 패키지 해석 |
| lockfile | 앱별 3개 분리 | 루트 1개 통합 |
| 새 앱 추가 시 | alias + symlink + 의존성 복사 | `"@v-platform/core": "workspace:*"` 한 줄 |

---

## 8. 판단 기준

**전환을 권장하는 경우:**
- 플랫폼에 npm 패키지를 추가할 일이 앞으로도 있을 때
- 새 앱을 추가할 계획이 있을 때
- 커스텀 Vite 플러그인/symlink 유지 비용이 부담될 때

**현재 유지를 권장하는 경우:**
- 플랫폼 의존성이 안정적이고 변경이 드물 때
- Docker 설정 변경 리스크를 감수하기 어려울 때

---

*문서 버전: 1.0*  
*관련 이슈: 2026-04-12 `@uiw/react-md-editor` import 장애*
