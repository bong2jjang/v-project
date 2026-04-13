# 앱 브랜딩 및 콘텐츠 분리 설계

> **작성일**: 2026-04-11  
> **상태**: 설계 완료, 구현 대기  
> **목적**: 플랫폼 공통 페이지를 `@v-platform/core`에서 제공하여, template 앱은 최소한의 코드만 유지

---

## 1. 현재 문제

### 1.1 template에 불필요한 복사본이 존재

```
apps/v-platform-template/frontend/src/pages/  ← 18개 페이지 복사본
├── Login.tsx              ← 플랫폼 기능 (인증)
├── Register.tsx           ← 플랫폼 기능 (인증)
├── ForgotPassword.tsx     ← 플랫폼 기능 (인증)
├── ResetPassword.tsx      ← 플랫폼 기능 (인증)
├── SSOCallback.tsx        ← 플랫폼 기능 (인증)
├── Forbidden.tsx          ← 플랫폼 기능 (인증)
├── Profile.tsx            ← 플랫폼 기능 (프로필)
├── PasswordChange.tsx     ← 플랫폼 기능 (프로필)
├── UserManagement.tsx     ← 플랫폼 기능 (관리자)
├── AuditLogs.tsx          ← 플랫폼 기능 (관리자)
├── Settings.tsx           ← 플랫폼 기능 (설정)
├── Help.tsx               ← 플랫폼 기능 (도움말)
├── CustomIframe.tsx       ← 플랫폼 기능 (커스텀 메뉴)
├── Dashboard.tsx          ← ★ 유일한 앱 전용 페이지
└── admin/
    ├── MenuManagement.tsx     ← 플랫폼 기능
    ├── PermissionMatrix.tsx   ← 플랫폼 기능
    ├── PermissionGroups.tsx   ← 플랫폼 기능
    └── Organizations.tsx      ← 플랫폼 기능
```

**18개 중 17개가 플랫폼 기능** — 복사가 아닌 플랫폼에서 import해야 합니다.

### 1.2 문제의 결과

- 앱 이름("VMS Channel Bridge")이 하드코딩 → template에 잘못된 이름 표시
- 앱 전용 내용(Slack/Teams)이 template에 노출
- 페이지 업데이트 시 모든 앱에 수동 반영 필요
- 새 앱 만들 때 18개 파일 복사 + 수정 필요

---

## 2. 목표

### 2.1 template은 극도로 단순해야 함

```
apps/v-platform-template/frontend/src/
├── App.tsx                ← 라우트 설정 (플랫폼 페이지 import)
├── pages/
│   └── Dashboard.tsx      ← ★ 앱 전용 페이지 (유일)
└── main.tsx               ← 진입점
```

**17개 페이지가 사라지고, App.tsx + Dashboard.tsx만 남음.**

### 2.2 플랫폼이 페이지를 제공

```tsx
// template App.tsx — 이것이 최종 목표
import {
  // 인증 페이지
  LoginPage, RegisterPage, ForgotPasswordPage,
  ResetPasswordPage, SSOCallbackPage, ForbiddenPage,
  // 관리 페이지
  UserManagementPage, AuditLogsPage,
  SettingsPage, HelpPage,
  ProfilePage, PasswordChangePage,
  CustomIframePage,
  // 관리자 페이지
  MenuManagementPage, PermissionMatrixPage,
  PermissionGroupsPage, OrganizationsPage,
  // 레이아웃
  Layout, ProtectedRoute,
} from '@v-platform/core';

// 앱 전용 페이지만 직접 구현
import Dashboard from './pages/Dashboard';
```

### 2.3 v-channel-bridge도 동일 패턴

```tsx
// v-channel-bridge App.tsx
import {
  LoginPage, RegisterPage, ...  // 플랫폼 페이지
} from '@v-platform/core';

// 앱 전용 페이지
import Channels from './pages/Channels';
import Messages from './pages/Messages';
import Statistics from './pages/Statistics';
```

---

## 3. 설계 상세

### 3.1 PlatformConfig 확장

```typescript
interface PlatformConfig {
  appName: string;             // 앱 식별자
  appTitle?: string;           // 로그인 페이지 표시 이름 (기본: appName)
  appDescription?: string;     // 로그인 페이지 부제목 (기본: "")
  // 기존 필드...
}
```

### 3.2 플랫폼 페이지가 Config를 사용

```tsx
// @v-platform/core/pages/LoginPage.tsx
export function LoginPage() {
  const { appTitle, appDescription } = usePlatformConfig();
  return (
    <div>
      <h1>{appTitle || "v-platform"}</h1>
      {appDescription && <p>{appDescription}</p>}
      <LoginForm />
    </div>
  );
}
```

### 3.3 페이지 분류

| 페이지 | 위치 | 브랜딩 |
|--------|------|--------|
| Login | `@v-platform/core/pages` | appTitle, appDescription |
| Register | `@v-platform/core/pages` | appTitle |
| ForgotPassword | `@v-platform/core/pages` | appTitle |
| ResetPassword | `@v-platform/core/pages` | appTitle |
| SSOCallback | `@v-platform/core/pages` | — (처리 로직만) |
| Forbidden | `@v-platform/core/pages` | — |
| Profile | `@v-platform/core/pages` | — |
| PasswordChange | `@v-platform/core/pages` | — |
| UserManagement | `@v-platform/core/pages` | — |
| AuditLogs | `@v-platform/core/pages` | — |
| Settings | `@v-platform/core/pages` | 공통 탭만 (테마, 보안, 세션, 시스템) |
| Help | `@v-platform/core/pages` | 플랫폼 기능 가이드 |
| CustomIframe | `@v-platform/core/pages` | — |
| MenuManagement | `@v-platform/core/pages/admin` | — |
| PermissionMatrix | `@v-platform/core/pages/admin` | — |
| PermissionGroups | `@v-platform/core/pages/admin` | — |
| Organizations | `@v-platform/core/pages/admin` | — |
| **Dashboard** | **앱 자체 구현** | 앱별 다름 |

### 3.4 Settings 페이지 확장 패턴

앱이 Settings에 커스텀 탭을 추가할 수 있도록:

```tsx
// v-channel-bridge App.tsx
import { SettingsPage } from '@v-platform/core';
import { BackupTab } from './components/settings/BackupTab';
import { ConfigTab } from './components/settings/ConfigTab';

<Route path="/settings" element={
  <SettingsPage extraTabs={[
    { key: "backup", label: "백업 관리", component: <BackupTab /> },
    { key: "config", label: "설정 편집", component: <ConfigTab /> },
  ]} />
} />
```

### 3.5 Help 페이지 확장 패턴

앱이 Help에 앱 전용 섹션을 추가:

```tsx
import { HelpPage } from '@v-platform/core';
import { BridgeHelpSection } from './components/help/BridgeHelp';

<Route path="/help" element={
  <HelpPage extraSections={[
    { title: "메시지 브리지", component: <BridgeHelpSection /> },
  ]} />
} />
```

---

## 4. 작업 계획

### Phase B1: 페이지를 @v-platform/core로 이동 (3일)

| # | 작업 | 설명 |
|---|------|------|
| 1 | PlatformConfig에 appTitle, appDescription 추가 | `PlatformProvider.tsx` |
| 2 | v-channel-bridge 페이지 17개를 platform으로 이동 | `git mv` + import 수정 |
| 3 | 이동된 페이지에서 하드코딩 → `usePlatformConfig()` 전환 | Login, Register 등 |
| 4 | Help.tsx를 범용으로 리팩토링 | 브리지 내용 제거, 확장 가능 구조 |
| 5 | Settings.tsx를 범용으로 리팩토링 | extraTabs 패턴 적용 |
| 6 | `@v-platform/core/pages` index.ts 생성 | 모든 페이지 export |

### Phase B2: template 간소화 (1일)

| # | 작업 | 설명 |
|---|------|------|
| 7 | template의 17개 페이지 삭제 | platform에서 import로 대체 |
| 8 | template App.tsx 간소화 | `@v-platform/core` 페이지 import |
| 9 | template 불필요 shim/컴포넌트 정리 | 최소한만 남김 |

### Phase B3: v-channel-bridge도 전환 (1일)

| # | 작업 | 설명 |
|---|------|------|
| 10 | v-channel-bridge App.tsx에서 플랫폼 페이지를 platform import로 전환 | 로컬 복사본 제거 |
| 11 | v-channel-bridge Settings에 extraTabs 적용 | BackupTab, ConfigTab |
| 12 | v-channel-bridge Help에 extraSections 적용 | 브리지 가이드 |

### Phase B4: 검증 (1일)

| # | 작업 |
|---|------|
| 13 | v-channel-bridge 전체 페이지 동작 확인 |
| 14 | v-platform-template 전체 페이지 동작 확인 |
| 15 | 새 앱 생성 시 App.tsx + Dashboard.tsx만으로 동작 확인 |

---

## 5. 최종 파일 구조

### template (목표)

```
apps/v-platform-template/frontend/src/
├── App.tsx              ← ~80줄 (라우트 설정)
├── pages/
│   └── Dashboard.tsx    ← ~100줄 (기본 대시보드)
├── main.tsx             ← ~10줄
└── index.css            ← Tailwind + 디자인 토큰
```

### v-channel-bridge (목표)

```
apps/v-channel-bridge/frontend/src/
├── App.tsx              ← 라우트 설정 (플랫폼 + 앱 페이지)
├── pages/
│   ├── Channels.tsx     ← 앱 전용
│   ├── Messages.tsx     ← 앱 전용
│   ├── Statistics.tsx   ← 앱 전용
│   ├── Integrations.tsx ← 앱 전용
│   └── Monitoring.tsx   ← 앱 전용
├── components/          ← 앱 전용 컴포넌트만
└── store/               ← 앱 전용 스토어만
```

### @v-platform/core (추가)

```
platform/frontend/v-platform-core/src/
├── pages/                         ← ★ 신규
│   ├── index.ts                   ← 모든 페이지 export
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── SSOCallbackPage.tsx
│   ├── ForbiddenPage.tsx
│   ├── ProfilePage.tsx
│   ├── PasswordChangePage.tsx
│   ├── UserManagementPage.tsx
│   ├── AuditLogsPage.tsx
│   ├── SettingsPage.tsx           ← extraTabs 지원
│   ├── HelpPage.tsx               ← extraSections 지원
│   ├── CustomIframePage.tsx
│   └── admin/
│       ├── MenuManagementPage.tsx
│       ├── PermissionMatrixPage.tsx
│       ├── PermissionGroupsPage.tsx
│       └── OrganizationsPage.tsx
└── ...
```

---

## 6. 기대 효과

| 항목 | Before | After |
|------|--------|-------|
| **template 페이지 수** | 18개 (복사본) | **1개** (Dashboard만) |
| **새 앱 작성 시** | 18개 파일 복사 + 수정 | App.tsx + Dashboard.tsx |
| **플랫폼 페이지 업데이트** | 모든 앱에 수동 반영 | 플랫폼 1곳만 수정 |
| **앱 브랜딩** | 하드코딩 | PlatformConfig 자동 |
| **Settings 확장** | 파일 복사 + 수정 | extraTabs prop |
| **Help 확장** | 파일 복사 + 수정 | extraSections prop |
