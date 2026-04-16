# 넓게보기 (Wide View) 레이아웃 설계

## 1. 개요

모든 페이지의 콘텐츠 영역에 **넓게보기 토글** 옵션을 추가하여, 사용자가 기본 너비(1280px)와 전체 너비 중 선택할 수 있도록 한다.

| 항목 | 내용 |
|------|------|
| 영향 범위 | 플랫폼 코어 + 3개 앱 (v-channel-bridge, v-platform-template, v-platform-portal) |
| 예상 공수 | **~1시간** (코딩 30분 + 테스트 30분) |
| 수정 파일 수 | **8개** |
| 추가 코드량 | ~80줄 |
| 백엔드 변경 | 없음 |
| 기술적 위험 | 없음 — 기존 테마 패턴 재사용 |

---

## 2. 현재 구조 분석

### 콘텐츠 너비를 제어하는 2개 지점

| 지점 | 위치 | 현재 값 |
|------|------|---------|
| `.page-container` | `index.css` (3개 앱 각각) | `@apply max-w-content mx-auto ...` |
| `ContentHeader` | `ContentHeader.tsx:25` | `className="max-w-content mx-auto ..."` |

### `max-w-content` 정의

```js
// tailwind.config.js (3개 앱 동일)
maxWidth: {
  'content': '80rem',  // 1280px 고정
}
```

### 기존 테마 시스템 패턴

테마/다크모드는 `<html>` 요소에 CSS 클래스를 토글하여 CSS 변수를 오버라이드하는 패턴을 사용한다:

```
html.dark → CSS 변수 오버라이드 → 전체 앱에 즉시 반영
html.theme-indigo → 브랜드 색상 변수 오버라이드
```

**넓게보기도 동일 패턴**으로 구현하면 된다:

```
html.layout-wide → --content-max-width 변수 오버라이드 → 전체 앱에 즉시 반영
```

---

## 3. 구현 설계

### 3.1. CSS 변수 기반 동적 너비

**원리**: Tailwind의 `max-w-content` 값을 하드코딩에서 CSS 변수 참조로 변경

#### tailwind.config.js (3개 앱)

```js
// Before
maxWidth: {
  'content': '80rem',
}

// After
maxWidth: {
  'content': 'var(--content-max-width, 80rem)',
}
```

#### index.css (3개 앱)

```css
:root {
  --content-max-width: 80rem;
  /* ... 기존 변수들 ... */
}

/* 넓게보기 모드 */
.layout-wide {
  --content-max-width: 100%;
}
```

> `100%`를 사용하면 사이드바를 제외한 콘텐츠 영역 전체를 활용한다.
> 양쪽 패딩(`px-4 sm:px-6 lg:px-8`)은 유지되므로 텍스트가 화면 끝까지 붙지 않는다.

### 3.2. useTheme 확장

기존 `useTheme` 훅에 `contentWidth` 상태를 추가한다. 별도 훅을 만들지 않는 이유:

- 테마와 레이아웃은 모두 "외형 설정"으로 같은 맥락
- 이미 ThemeProvider가 전역 Context를 제공 중
- localStorage 키 패턴, 앱별 분리 로직을 재사용

```typescript
// useTheme.ts 확장

type ContentWidth = "default" | "wide";

// ThemeContextValue에 추가
interface ThemeContextValue {
  // ... 기존 필드 ...
  contentWidth: ContentWidth;
  setContentWidth: (width: ContentWidth) => void;
}

// localStorage 키
function contentWidthKey(appName?: string) {
  return appName ? `${appName}:contentWidth` : "contentWidth";
}

// 적용 함수 (applyTheme와 동일 패턴)
function applyContentWidth(width: ContentWidth) {
  document.documentElement.classList.toggle("layout-wide", width === "wide");
}
```

### 3.3. ThemeSettings UI 확장

설정 > 테마 탭에 "콘텐츠 너비" 섹션을 추가한다.

```
┌─────────────────────────────────────────┐
│ 브랜드 색상                              │
│ [Blue] [Indigo] [Rose]                  │
│                                          │
│ 화면 모드                                │
│ [라이트] [다크] [시스템]                  │
│                                          │
│ 콘텐츠 너비              ← 새로 추가     │
│ [기본 너비] [넓게보기]                    │
│                                          │
│ ℹ️ 테마 안내                             │
└─────────────────────────────────────────┘
```

카드형 선택 UI (기존 ThemeModeCard/ColorPresetCard와 동일 스타일):

| 옵션 | 아이콘 | 설명 |
|------|--------|------|
| 기본 너비 | `Columns` or 중앙 정렬 프리뷰 | 읽기 편한 기본 너비 (1280px) |
| 넓게보기 | `Maximize` or 전체 너비 프리뷰 | 화면 전체를 활용하는 넓은 보기 |

### 3.4. 데이터 흐름

```
사용자 토글 클릭
  → setContentWidth("wide")
    → localStorage 저장 (앱별 키)
    → html.classList.add("layout-wide")
      → CSS 변수 --content-max-width: 100%
        → max-w-content 유틸리티 자동 반영
          → .page-container + ContentHeader 즉시 확장
```

**핵심**: 개별 페이지 수정이 전혀 필요 없다. CSS 변수 하나로 모든 페이지가 자동 반영된다.

---

## 4. 수정 대상 파일 목록

| # | 파일 | 변경 내용 | 예상 변경량 |
|---|------|-----------|-------------|
| 1 | `apps/v-channel-bridge/frontend/tailwind.config.js` | max-w-content에 CSS 변수 참조 | 1줄 |
| 2 | `apps/v-platform-template/frontend/tailwind.config.js` | 동일 | 1줄 |
| 3 | `apps/v-platform-portal/frontend/tailwind.config.js` | 동일 | 1줄 |
| 4 | `apps/v-channel-bridge/frontend/src/index.css` | CSS 변수 + .layout-wide 클래스 | 5줄 |
| 5 | `apps/v-platform-template/frontend/src/index.css` | 동일 | 5줄 |
| 6 | `apps/v-platform-portal/frontend/src/index.css` | 동일 | 5줄 |
| 7 | `platform/frontend/v-platform-core/src/hooks/useTheme.ts` | contentWidth 상태 + 적용 로직 | ~30줄 |
| 8 | `platform/frontend/v-platform-core/src/components/settings/ThemeSettings.tsx` | 콘텐츠 너비 선택 UI 섹션 | ~30줄 |

**총 ~80줄 추가/수정, 백엔드 변경 0**

---

## 5. 왜 동적 구성이 효율적인가

"항상 넓게보기"로 고정하는 대안과 비교:

| 비교 항목 | 고정 변경 | 동적 옵션 (본 설계) |
|-----------|-----------|---------------------|
| 수정 파일 수 | 3개 (tailwind.config.js만) | 8개 |
| 코드 추가량 | 3줄 | ~80줄 |
| 사용자 선택권 | 없음 | 있음 |
| 롤백 비용 | git revert | 토글 1회 |

동적 옵션이 고정 변경 대비 **~77줄만 더 추가**하면 되고, 이는 기존 테마 패턴을 그대로 복사하는 수준이므로 비효율적이지 않다. 오히려 사용자마다 선호가 다를 수 있어 (데이터 테이블 → 넓게, 텍스트 중심 → 기본) 동적 옵션이 더 적합하다.

---

## 6. 고려사항

### 6.1. 넓게보기에서의 테이블/카드 배치

현재 대부분의 페이지는 `grid-cols-1 md:grid-cols-2` 또는 테이블 형태를 사용한다. 넓게보기에서:
- **테이블**: 자연스럽게 더 넓어짐 → 칼럼이 넉넉해져서 UX 향상
- **카드 그리드**: `grid-cols-1 md:grid-cols-2` → 기존대로 유지 (max-width가 아닌 grid 기준)
- **통계 카드**: `grid-cols-2 lg:grid-cols-4` → 기존대로 유지

> 넓게보기에서도 깨지는 레이아웃은 없다. 모든 페이지가 이미 반응형으로 구현되어 있다.

### 6.2. ContentHeader 비율

ContentHeader는 페이지와 동일한 `max-w-content`을 사용하므로 넓게보기에서 함께 확장된다. 헤더가 너무 넓어질 걱정은 없다 — 내부 `flex` 구조가 양쪽으로 자연스럽게 배치된다.

### 6.3. 향후 확장 가능성

CSS 변수 기반이므로 나중에 3단계 옵션도 쉽게 추가 가능:

```css
.layout-comfortable { --content-max-width: 80rem; }   /* 기본 */
.layout-wide        { --content-max-width: 100rem; }  /* 넓게 */
.layout-full        { --content-max-width: 100%; }     /* 전체 */
```

---

## 7. 작업 순서

| 순서 | 작업 | 설명 |
|------|------|------|
| 1 | CSS 인프라 | tailwind.config.js 3개 + index.css 3개 수정 |
| 2 | 로직 | useTheme.ts에 contentWidth 상태 추가 |
| 3 | UI | ThemeSettings.tsx에 콘텐츠 너비 선택 섹션 추가 |
| 4 | 테스트 | 3개 앱에서 토글 동작 확인, 반응형 레이아웃 확인 |

---

## 8. 결론

- **공수**: 약 1시간 (8개 파일, ~80줄)
- **기술적 이슈**: 없음
- **동적 옵션 효율성**: 기존 패턴 재사용으로 효율적
- **권장**: 구현 진행

---

**작성일**: 2026-04-16
