---
id: design-system
title: v-platform 디자인 시스템
sidebar_position: 4
tags: [guide, developer]
---

# v-platform 디자인 시스템

v-platform의 프론트엔드 디자인 시스템은 **CSS 변수 기반 시맨틱 토큰**과 **Tailwind CSS**를 결합하여 일관된 UI를 제공합니다. VS Code 스타일의 시각 언어를 기반으로, 라이트/다크 테마와 3가지 컬러 프리셋을 지원합니다.

---

## 1. 아키텍처 개요

```
index.css (CSS 변수 정의)
    ↓
tailwind.config.js (변수 → Tailwind 클래스 매핑)
    ↓
컴포넌트 (시맨틱 클래스 사용: bg-surface-card, text-content-primary)
```

디자인 시스템의 핵심 원칙:

1. **시맨틱 토큰**: `bg-blue-500` 대신 `bg-brand-600` 사용 -- 의미 기반 색상
2. **CSS 변수 기반**: 테마 전환 시 변수만 교체하면 전체 UI가 변경됨
3. **컴포넌트 레이어**: `@layer components`에 재사용 가능한 유틸리티 클래스 정의
4. **접근성 우선**: WCAG AA 대비, `prefers-reduced-motion`, `prefers-contrast` 지원

---

## 2. CSS 변수 체계

### 2.1 파일 위치

CSS 변수는 각 앱의 `index.css`에 정의됩니다. 모든 앱이 동일한 변수 체계를 공유합니다.

```
apps/v-channel-bridge/frontend/src/index.css
apps/v-platform-template/frontend/src/index.css
apps/v-platform-portal/frontend/src/index.css
```

### 2.2 변수 카테고리

#### Brand (브랜드 색상)

VS Code Blue 기반 10단계 스케일입니다. 50(가장 밝음) ~ 900(가장 어두움).

```css
:root {
  /* Brand -- VS Code Blue */
  --color-brand-50: #e6f2ff;
  --color-brand-100: #cce4ff;
  --color-brand-200: #99c9ff;
  --color-brand-300: #5cadff;
  --color-brand-400: #2b93f5;
  --color-brand-500: #0078d4;    /* 메인 브랜드 */
  --color-brand-600: #0066b8;    /* 버튼 기본 */
  --color-brand-700: #005499;    /* 버튼 호버 */
  --color-brand-800: #00427a;
  --color-brand-900: #003060;
}
```

:::tip 브랜드 색상 사용 가이드
- **600**: 버튼 배경, ContentHeader 배경, 아바타 배경
- **700**: 버튼 hover 상태
- **500**: 포커스 링, 메인 액센트
- **50~200**: 라이트 배경, 배지 배경
:::

#### Status (상태 색상)

4가지 상태 각각에 3단계(기본, light 배경, border)를 제공합니다.

```css
:root {
  /* Success */
  --color-status-success: #16825d;
  --color-status-success-light: #e8f5ef;
  --color-status-success-border: #b4dfc8;

  /* Danger */
  --color-status-danger: #c72e2e;
  --color-status-danger-light: #fce8e8;
  --color-status-danger-border: #f0bcbc;

  /* Warning */
  --color-status-warning: #bf8700;
  --color-status-warning-light: #fdf6e3;
  --color-status-warning-border: #e8d48a;

  /* Info */
  --color-status-info: #0078d4;
  --color-status-info-light: #e6f2ff;
  --color-status-info-border: #99c9ff;
}
```

#### Surface (배경 계층)

4단계 배경 계층으로 시각적 깊이를 표현합니다.

```css
:root {
  --color-surface-page: #f3f3f3;      /* 최하위: 페이지 배경 */
  --color-surface-card: #ffffff;       /* 카드, 패널 */
  --color-surface-raised: #e8e8e8;    /* hover 배경, 툴바 */
  --color-surface-overlay: rgba(0, 0, 0, 0.4);  /* 모달 백드롭 */
}
```

:::note Surface 계층 규칙
`page` < `card` < `raised` 순서로 밝아집니다(라이트). 다크 모드에서는 반대로 어두워집니다. 항상 상위 계층이 더 "떠 있는" 느낌을 주도록 배치합니다.
:::

#### Line (구분선)

```css
:root {
  --color-line: #e5e5e5;         /* 기본 구분선 */
  --color-line-light: #f0f0f0;   /* 미세한 구분선 */
  --color-line-heavy: #cccccc;   /* 강조 구분선 */
}
```

#### Content (텍스트/아이콘)

```css
:root {
  --color-content-primary: #333333;     /* 제목, 본문 */
  --color-content-secondary: #616161;   /* 부제목, 설명 */
  --color-content-tertiary: #a0a0a0;    /* 비활성, 힌트 */
  --color-content-inverse: #ffffff;     /* 반전 (브랜드 배경 위) */
  --color-content-link: #0078d4;        /* 링크 */
}
```

#### Shadows (그림자)

```css
:root {
  --shadow-card: 0 1px 3px rgb(0 0 0 / 0.08);
  --shadow-card-hover: 0 4px 12px rgb(0 0 0 / 0.12);
  --shadow-card-elevated: 0 8px 24px rgb(0 0 0 / 0.14);
  --shadow-modal: 0 16px 48px -8px rgb(0 0 0 / 0.2);
  --shadow-nav: 0 1px 0 rgb(0 0 0 / 0.06);
}
```

---

## 3. 다크 테마

`.dark` 클래스를 `<html>` 요소에 적용하면 다크 테마가 활성화됩니다. 동일한 CSS 변수 이름을 다크 값으로 재정의하는 방식입니다.

```css
.dark {
  color-scheme: dark;

  /* Surface -- VS Code Dark+ (#1e1e1e 기반) */
  --color-surface-page: #181818;
  --color-surface-card: #1e1e1e;
  --color-surface-raised: #2a2d2e;
  --color-surface-overlay: rgba(0, 0, 0, 0.5);

  /* Content -- WCAG AA 대비 확보 (card #1e1e1e 기준) */
  --color-content-primary: #cccccc;
  --color-content-secondary: #9d9d9d;
  --color-content-tertiary: #6e6e6e;
  --color-content-inverse: #1e1e1e;
  --color-content-link: #4da6ff;

  /* Line */
  --color-line: #2b2b2b;
  --color-line-light: #222222;
  --color-line-heavy: #3e3e3e;

  /* Brand -- 다크에서 밝기 반전 */
  --color-brand-600: #2b93f5;
  --color-brand-700: #4da6ff;

  /* Shadows -- 더 깊은 그림자 */
  --shadow-card: 0 1px 3px rgb(0 0 0 / 0.4);
  --shadow-card-hover: 0 4px 12px rgb(0 0 0 / 0.5);
  --shadow-modal: 0 16px 48px -8px rgb(0 0 0 / 0.65);
}
```

:::warning 다크 모드 개발 시 주의
1. **하드코딩 색상 금지**: `text-gray-600` 대신 `text-content-secondary` 사용
2. **대비 확인**: `content-primary`(#cccccc)와 `surface-card`(#1e1e1e) 사이 대비율 = 10.4:1 (WCAG AAA)
3. **조건부 스타일**: 테마별 다른 디자인이 필요하면 `dark:` prefix 사용 (예: `bg-brand-600 dark:bg-surface-card`)
:::

### 3.1 테마 전환 메커니즘

`useTheme` 훅이 테마 상태를 관리합니다. 3가지 모드를 지원합니다:

- **light**: `.dark` 클래스 제거
- **dark**: `.dark` 클래스 추가
- **system**: `prefers-color-scheme` 미디어 쿼리 추적

```tsx
import { useTheme } from "@v-platform/core";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="light">라이트</option>
      <option value="dark">다크</option>
      <option value="system">시스템</option>
    </select>
  );
}
```

---

## 4. 컬러 프리셋

기본 VS Code Blue 외에 2가지 추가 프리셋을 제공합니다. `<html>` 요소에 클래스를 추가하여 활성화합니다.

### 4.1 Blue (기본)

클래스 없음 -- `:root` 기본값 사용

### 4.2 Indigo

```css
.theme-indigo {
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;
  --color-status-info: #4f46e5;
  --color-content-link: #4f46e5;
}
.dark.theme-indigo {
  --color-brand-600: #6366f1;
  --color-brand-700: #818cf8;
  --color-content-link: #a5b4fc;
}
```

### 4.3 Rose

```css
.theme-rose {
  --color-brand-500: #f43f5e;
  --color-brand-600: #e11d48;
  --color-brand-700: #be123c;
  --color-status-info: #e11d48;
  --color-content-link: #e11d48;
}
.dark.theme-rose {
  --color-brand-600: #f43f5e;
  --color-brand-700: #fb7185;
  --color-content-link: #fda4af;
}
```

:::tip 컬러 프리셋 적용 방법
관리자 설정 > 시스템 설정 > 컬러 프리셋에서 변경합니다. `useTheme` 훅이 `<html>` 요소에 `theme-indigo` 또는 `theme-rose` 클래스를 자동으로 토글합니다. 별도 코드 변경 없이 전체 앱의 브랜드 색상이 전환됩니다.
:::

---

## 5. Tailwind 설정

### 5.1 CSS 변수 매핑

`tailwind.config.js`에서 CSS 변수를 Tailwind 클래스로 매핑합니다.

```js
// tailwind.config.js
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          // ... 200~800
          900: 'var(--color-brand-900)',
        },
        status: {
          success:          'var(--color-status-success)',
          'success-light':  'var(--color-status-success-light)',
          'success-border': 'var(--color-status-success-border)',
          danger:           'var(--color-status-danger)',
          'danger-light':   'var(--color-status-danger-light)',
          'danger-border':  'var(--color-status-danger-border)',
          warning:          'var(--color-status-warning)',
          'warning-light':  'var(--color-status-warning-light)',
          'warning-border': 'var(--color-status-warning-border)',
          info:             'var(--color-status-info)',
          'info-light':     'var(--color-status-info-light)',
          'info-border':    'var(--color-status-info-border)',
        },
        surface: {
          page:    'var(--color-surface-page)',
          card:    'var(--color-surface-card)',
          raised:  'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
        },
        line: {
          DEFAULT: 'var(--color-line)',
          light:   'var(--color-line-light)',
          heavy:   'var(--color-line-heavy)',
        },
        content: {
          primary:   'var(--color-content-primary)',
          secondary: 'var(--color-content-secondary)',
          tertiary:  'var(--color-content-tertiary)',
          inverse:   'var(--color-content-inverse)',
          link:      'var(--color-content-link)',
        },
      },
    },
  },
};
```

이 매핑을 통해 `bg-surface-card`, `text-content-primary`, `border-line` 등의 시맨틱 클래스를 사용할 수 있습니다.

### 5.2 타이포그래피

Pretendard 폰트를 기본으로 사용하며, 8단계 타이포그래피 스케일을 정의합니다.

```js
fontSize: {
  'heading-xl': ['1.75rem',   { lineHeight: '2.25rem',  fontWeight: '700', letterSpacing: '-0.025em' }],
  'heading-lg': ['1.375rem',  { lineHeight: '1.875rem', fontWeight: '600', letterSpacing: '-0.02em' }],
  'heading-md': ['1.125rem',  { lineHeight: '1.625rem', fontWeight: '600', letterSpacing: '-0.01em' }],
  'heading-sm': ['0.875rem',  { lineHeight: '1.375rem', fontWeight: '500' }],
  'body-base':  ['0.875rem',  { lineHeight: '1.5rem',   fontWeight: '400' }],
  'body-sm':    ['0.75rem',   { lineHeight: '1.25rem',  fontWeight: '400' }],
  'caption':    ['0.6875rem', { lineHeight: '1rem',     fontWeight: '500', letterSpacing: '0.01em' }],
  'overline':   ['0.625rem',  { lineHeight: '1rem',     fontWeight: '600', letterSpacing: '0.05em' }],
},
```

| 클래스 | 크기 | 용도 |
|--------|------|------|
| `text-heading-xl` | 1.75rem (28px) | 페이지 제목 (ContentHeader) |
| `text-heading-lg` | 1.375rem (22px) | 섹션 제목 |
| `text-heading-md` | 1.125rem (18px) | 카드 제목 |
| `text-heading-sm` | 0.875rem (14px) | 소제목 |
| `text-body-base` | 0.875rem (14px) | 기본 본문 |
| `text-body-sm` | 0.75rem (12px) | 보조 텍스트 |
| `text-caption` | 0.6875rem (11px) | 캡션, 메타 정보 |
| `text-overline` | 0.625rem (10px) | 카테고리 라벨 |

:::note 폰트 패밀리
```js
fontFamily: {
  sans: ['"Pretendard Variable"', 'Pretendard', 'Inter', '-apple-system', ...],
  mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', ...],
},
```
Pretendard는 한영 혼합 최적화 폰트로, 한글과 영문 사이 간격이 자연스럽습니다.
:::

### 5.3 간격 (Spacing)

시맨틱 간격 토큰으로 일관된 레이아웃을 보장합니다.

```js
spacing: {
  'page-x':       '1.5rem',    // 페이지 좌우 패딩
  'page-y':       '2rem',      // 페이지 하단 패딩
  'card-x':       '1.5rem',    // 카드 내부 좌우 패딩
  'card-y':       '1rem',      // 카드 내부 상하 패딩
  'section-gap':  '1.5rem',    // 섹션 간 간격
  'element-gap':  '0.75rem',   // 요소 간 간격
},
```

사용 예시:

```tsx
// 페이지 컨테이너
<div className="px-page-x pb-page-y">

// 섹션 간격
<div className="space-y-section-gap">

// 카드 내부
<div className="px-card-x py-card-y">
```

### 5.4 둥글기 (Border Radius)

```js
borderRadius: {
  'card':   '0.75rem',   // 카드, 패널
  'button': '0.5rem',    // 버튼
  'input':  '0.5rem',    // 입력 필드
  'badge':  '9999px',    // 배지, 태그 (완전 원형)
  'modal':  '1rem',      // 모달
},
```

### 5.5 z-index 체계

겹침 순서를 명확하게 정의합니다.

```js
zIndex: {
  'nav':            '30',    // 사이드바, 탑바
  'dropdown':       '35',    // 드롭다운 메뉴
  'modal-backdrop': '40',    // 모달 배경
  'modal':          '50',    // 모달 본체
  'tooltip':        '55',    // 툴팁
  'toast':          '60',    // 토스트 알림 (최상위)
},
```

### 5.6 최대 너비

```js
maxWidth: {
  'content': '80rem',    // 1280px — 콘텐츠 영역 최대 너비
},
```

---

## 6. 컴포넌트 레이어

`@layer components`에 정의된 재사용 가능한 유틸리티 클래스입니다.

### 6.1 레이아웃 컴포넌트

```css
/* 페이지 컨테이너 — 최대 너비 + 반응형 패딩 */
.page-container {
  @apply max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-section-gap pb-page-y;
}

/* 카드 기본 */
.card-base {
  @apply bg-surface-card rounded-card border border-line shadow-card;
}

/* 인터랙티브 카드 — hover 시 부상 효과 */
.card-interactive {
  @apply card-base hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-normal;
}

/* 글래스 효과 */
.glass {
  @apply bg-surface-card/80 backdrop-blur-lg;
}
```

### 6.2 버튼 스타일

```css
/* 버튼 기본 (driver.js 투어 버튼 제외) */
.btn:not(.driver-popover-prev-btn):not(.driver-popover-next-btn):not(.driver-popover-close-btn) {
  @apply inline-flex items-center justify-center rounded-button font-medium
         transition-colors duration-normal
         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500
         disabled:opacity-50 disabled:cursor-not-allowed
         px-4 py-2 text-body-base;
}

/* 크기 변형 */
.btn-sm { @apply px-3 py-1.5 text-body-sm; }
.btn-lg { @apply px-5 py-2.5 text-body-base font-semibold; }

/* 색상 변형 */
.btn-primary   { @apply bg-brand-600 text-content-inverse hover:bg-brand-700; }
.btn-secondary { @apply bg-surface-raised text-content-primary border border-line hover:bg-line; }
.btn-danger    { @apply bg-status-danger text-content-inverse hover:bg-status-danger/90; }
```

### 6.3 입력 필드

```css
.input {
  @apply w-full px-3 py-2 rounded-input border border-line
         bg-surface-card text-content-primary
         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
         placeholder:text-content-tertiary
         transition-colors duration-normal;
}
```

### 6.4 포커스 링

```css
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
  --tw-ring-color: var(--color-brand-500);
  --tw-ring-opacity: 0.5;
  --tw-ring-offset-color: var(--color-surface-card);
}
```

---

## 7. 접근성 (Accessibility)

### 7.1 터치 타겟

```css
/* WCAG 2.1 AAA — 최소 44x44px */
.touch-target {
  @apply min-w-[44px] min-h-[44px];
}
```

### 7.2 스크린 리더

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 7.3 키보드 포커스

```css
.focus-visible:focus-visible {
  outline: 2px solid var(--color-brand-600);
  outline-offset: 2px;
  border-radius: 0.375rem;
}
```

### 7.4 모션 감소

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.5 고대비 모드

```css
@media (prefers-contrast: high) {
  .focus-ring,
  .focus-visible:focus-visible {
    outline-width: 3px;
    outline-offset: 3px;
  }
}
```

---

## 8. UI 컴포넌트 카탈로그

`v-platform-core`에서 제공하는 주요 컴포넌트를 카테고리별로 정리합니다.

### 8.1 레이아웃 (11개)

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| `Layout` | `components/Layout.tsx` | VS Code 스타일 메인 레이아웃 |
| `TopBar` | `components/layout/TopBar.tsx` | 상단 바 (앱 로고, 검색, 상태) |
| `Sidebar` | `components/layout/Sidebar.tsx` | 좌측 아이콘 네비게이션 |
| `ContentHeader` | `components/layout/ContentHeader.tsx` | 페이지 제목 + 액션 버튼 |
| `SidebarNavItem` | `components/layout/SidebarNavItem.tsx` | 사이드바 네비게이션 항목 |
| `SidebarSection` | `components/layout/SidebarSection.tsx` | 사이드바 섹션 그룹 |
| `MobileSidebarGroupItem` | `components/layout/MobileSidebarGroupItem.tsx` | 모바일 사이드바 그룹 |
| `Footer` | Layout 내 인라인 | 하단 바 (버전, 알림 벨) |

### 8.2 UI 기본 (25개)

| 컴포넌트 | 설명 |
|----------|------|
| `Button` | 기본 버튼 (primary, secondary, danger, ghost) |
| `Input` | 텍스트 입력 필드 |
| `Select` | 셀렉트 박스 |
| `Modal` | 모달 다이얼로그 |
| `ConfirmDialog` | 확인/취소 다이얼로그 |
| `Badge` | 상태 배지 |
| `Divider` | 구분선 |
| `Spinner` | 로딩 스피너 |
| `Tabs` | 탭 네비게이션 |
| `Tooltip` | 툴팁 |
| `Card` | 카드 컨테이너 |
| `Table` | 데이터 테이블 |
| `Pagination` | 페이지네이션 |
| `Switch` | 토글 스위치 |
| `Skeleton` | 로딩 스켈레톤 |
| `EmptyState` | 빈 상태 안내 |

### 8.3 알림 (6개)

| 컴포넌트 | 설명 |
|----------|------|
| `NotificationBell` | 푸터 알림 벨 아이콘 + 읽지 않은 수 배지 |
| `ToastContainer` | 화면 우측 하단 토스트 알림 컨테이너 |
| `AnnouncementPopup` | 미읽은 공지사항 자동 팝업 |
| `NotificationList` | 알림 목록 |
| `NotificationItem` | 개별 알림 카드 |
| `NotificationBanner` | 상단 배너 알림 |

### 8.4 인증/프로필 (8개)

| 컴포넌트 | 설명 |
|----------|------|
| `LoginForm` | 이메일/비밀번호 로그인 |
| `RegisterForm` | 회원가입 |
| `SSOLoginButtons` | SSO Provider 버튼 목록 |
| `ProfileCard` | 프로필 정보 카드 |
| `ProfileForm` | 프로필 수정 폼 |
| `OAuthConnections` | OAuth 연결 관리 |
| `ActiveDevices` | 활성 세션 목록 |
| `ProtectedRoute` | 권한 기반 라우트 보호 |

---

## 9. 아이콘 시스템

**Lucide React**를 사용합니다. 크기는 컨텍스트에 따라 3단계로 사용합니다.

```tsx
import { Settings, User, Bell, LogOut, KeyRound, Sparkles } from "lucide-react";

// 사이드바/버튼 아이콘
<Settings className="w-5 h-5" />

// 작은 컨텍스트 (배지, 인라인)
<Bell className="w-4 h-4" />

// 큰 컨텍스트 (빈 상태, 히어로)
<Settings className="w-8 h-8" />
```

:::tip 아이콘 네이밍 규칙
사이드바 메뉴의 아이콘은 DB `menu_items.icon` 컬럼에 Lucide 아이콘 이름을 저장합니다. 예: `"settings"`, `"users"`, `"shield"`, `"bar-chart-2"`. 프론트엔드에서 동적으로 렌더링합니다.
:::

---

## 10. 반응형 디자인

### 10.1 브레이크포인트

Tailwind 기본 브레이크포인트를 사용합니다.

| 프리픽스 | 최소 너비 | 용도 |
|----------|-----------|------|
| (없음) | 0px | 모바일 |
| `sm:` | 640px | 작은 태블릿 |
| `md:` | 768px | 태블릿 |
| `lg:` | 1024px | 데스크톱 |
| `xl:` | 1280px | 대형 데스크톱 |

### 10.2 반응형 패턴

```tsx
// page-container의 반응형 패딩
<div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8">

// 모바일: 세로 정렬 → 데스크톱: 가로 정렬
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

// 모바일 사이드바: hidden → 오버레이
// 데스크톱 사이드바: 항상 표시
```

### 10.3 모바일 사이드바

모바일(768px 미만)에서 사이드바는 숨겨지고, 햄버거 메뉴로 오버레이 형태로 열립니다. `useSidebar` 훅이 상태를 관리합니다.

```tsx
import { useSidebar } from "@v-platform/core";

const { isMobileOpen, openMobile, closeMobile } = useSidebar();
```

### 10.4 모바일 가로 스크롤 패턴 (정보 밀도가 높은 목록/테이블)

한 행에 여러 메타데이터(이름·설명·배지·카운터·액션 버튼 등)가 함께 들어가는 **목록·카드·테이블**은 모바일에서 컨테이너 폭에 맞춰 축소하면 **텍스트가 겹치거나 말줄임으로 판독 불가**가 됩니다. 이런 경우 폭을 유지하고 **가로 스크롤**로 전환합니다.

**적용 대상**
- 관리자 테이블형 리스트 (사용자 관리, 권한 그룹, 감사 로그 등)
- 한 행에 3개 이상의 정보 블록이 나열되는 카드
- 액션 버튼이 우측에 고정되어야 하는 목록

**적용 제외**
- 단순 카드 그리드 (제목 + 1~2줄 설명)
- 이미 자연스럽게 세로 적층되는 폼/설정 패널

**표준 스니펫**

```tsx
{/* 모바일에서는 가로 스크롤로 카드 폭을 유지 (텍스트 겹침 방지) */}
<div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
  <div className="space-y-3 min-w-[720px]">
    {/* 목록 아이템들 */}
  </div>
</div>
```

**구성 규칙**

| 클래스 | 역할 |
|--------|------|
| `overflow-x-auto` | 내부가 넘칠 때만 스크롤바 표시 |
| `-mx-4 px-4` | `page-container`의 좌우 패딩을 상쇄해 **엣지-투-엣지** 스크롤 영역 확보 (모바일) |
| `md:mx-0 md:px-0` | `md` 이상에서는 음수 마진 해제 — 스크롤 불필요 |
| `min-w-[720px]` | 콘텐츠 최소 폭. 행의 실제 필요 폭에 맞춰 조정 (일반 목록 720px, 넓은 테이블 960px) |

**min-width 선택 가이드**

| 콘텐츠 유형 | 권장값 |
|------------|--------|
| 아이콘 + 제목 + 2~3개 배지 + 액션 | `min-w-[640px]` |
| 위 + 부가 메타(생성일·유저 수 등) | `min-w-[720px]` |
| 테이블 5~6열 | `min-w-[960px]` |

**체크리스트**
- [ ] `page-container`의 패딩(`px-4`)과 일치하는 음수 마진(`-mx-4`) 사용
- [ ] `md:` 브레이크포인트에서 마진 상쇄 해제
- [ ] `min-w-[…]`는 실제 콘텐츠 폭 기준으로 설정 (과도하게 크면 데스크톱에서도 스크롤 발생)
- [ ] 스크롤 컨테이너는 **카드/섹션 단위**로 감싸기 — 페이지 전체를 감싸지 말 것

**참고 구현**
- `platform/frontend/v-platform-core/src/pages/UserManagement.tsx` — 테이블형 사용자 목록
- `platform/frontend/v-platform-core/src/pages/admin/PermissionGroups.tsx` — 권한 그룹 기준 탭

---

## 11. 트랜지션과 애니메이션

### 11.1 트랜지션 속도

```js
transitionDuration: {
  'fast':   '100ms',    // 미세한 변화 (opacity, color)
  'normal': '200ms',    // 기본 (hover, focus)
  'slow':   '300ms',    // 레이아웃 변경 (사이드바, 모달)
},
```

### 11.2 사용 패턴

```tsx
// 기본 hover 트랜지션
<button className="transition-colors duration-normal hover:bg-surface-raised">

// 카드 부상 효과
<div className="card-interactive">
  {/* hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-normal */}
</div>

// 배경 테마 전환
<body className="transition-[background-color,color] duration-[200ms] ease-in-out">
```

---

## 12. 새 앱에서 디자인 시스템 적용하기

### 12.1 필수 파일

1. `index.css` -- CSS 변수 정의 (기존 앱에서 복사)
2. `tailwind.config.js` -- 변수 매핑 (기존 앱에서 복사)
3. Tailwind content 경로에 플랫폼 코어 포함

```js
// tailwind.config.js
content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}',
  // 플랫폼 컴포넌트도 Tailwind 스캔 대상에 포함
  '../../../platform/frontend/v-platform-core/src/**/*.{js,ts,jsx,tsx}',
  '/platform/frontend/v-platform-core/src/**/*.{js,ts,jsx,tsx}',
],
```

:::warning Docker 환경 경로
Docker 컨테이너 내부와 로컬 개발 시 상대 경로가 다를 수 있습니다. 두 경로 모두 `content`에 포함하세요. Docker 내부 경로는 `/platform/frontend/v-platform-core/...`입니다.
:::

### 12.2 체크리스트

- [ ] `index.css`에 모든 CSS 변수 카테고리 정의 (brand, status, surface, line, content, shadows)
- [ ] `.dark` 클래스 블록에 다크 테마 변수 정의
- [ ] `tailwind.config.js`에 `darkMode: 'class'` 설정
- [ ] 모든 시맨틱 토큰 매핑 완료
- [ ] Pretendard 폰트 CDN 또는 로컬 포함
- [ ] 하드코딩 색상 없이 시맨틱 토큰만 사용
- [ ] 다크 모드에서 전체 UI 검수
- [ ] `prefers-reduced-motion` 대응 확인

---

## 13. 금지 패턴

| 금지 | 대안 |
|------|------|
| `bg-white` | `bg-surface-card` |
| `text-gray-600` | `text-content-secondary` |
| `border-gray-200` | `border-line` |
| `text-blue-600` | `text-brand-600` |
| `text-red-500` | `text-status-danger` |
| `shadow-lg` | `shadow-card-elevated` |
| `rounded-xl` | `rounded-card` |
| `text-sm` | `text-body-sm` |
| `text-xs` | `text-caption` |
| `z-50` | `z-modal` |

시맨틱 토큰을 사용하면 테마/프리셋 전환 시 모든 컴포넌트가 자동으로 적응합니다. 하드코딩된 Tailwind 기본 클래스를 사용하면 다크 모드와 컬러 프리셋에서 깨집니다.
