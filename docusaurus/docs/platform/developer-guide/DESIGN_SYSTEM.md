---
id: design-system
title: VMS Chat Ops 디자인 시스템
sidebar_position: 4
tags: [guide, developer]
---

# VMS Chat Ops 디자인 시스템

이 문서는 프론트엔드 UI의 일관성을 유지하기 위한 디자인 시스템 규칙을 정의합니다.
새로운 페이지나 컴포넌트를 만들 때 반드시 이 규칙을 따르세요.

## 📋 관련 문서

**→ [페이지 레이아웃 가이드](./page-layout-guide)** - 새 페이지 생성 시 반드시 준수해야 하는 레이아웃 규칙 및 체크리스트

---

## 1. 디자인 토큰

모든 시각적 값은 `tailwind.config.js`에 정의된 토큰을 사용합니다.
하드코딩된 색상, 크기, 간격 값을 직접 쓰지 마세요.

### 색상

| 용도 | 토큰 | 예시 클래스 |
|------|------|------------|
| 브랜드/프라이머리 | `brand-*` | `bg-brand-600`, `text-brand-700` |
| 성공 | `status-success` | `text-status-success`, `bg-status-success-light` |
| 위험 | `status-danger` | `text-status-danger`, `border-status-danger-border` |
| 경고 | `status-warning` | `text-status-warning` |
| 정보 | `status-info` | `bg-status-info-light` |
| 페이지 배경 | `surface-page` | `bg-surface-page` |
| 카드 배경 | `surface-card` | `bg-surface-card` |
| 올린 표면 | `surface-raised` | `bg-surface-raised` |
| 기본 보더 | `line` | `border-line` |
| 주 텍스트 | `content-primary` | `text-content-primary` |
| 보조 텍스트 | `content-secondary` | `text-content-secondary` |
| 비활성 텍스트 | `content-tertiary` | `text-content-tertiary` |

**규칙**: `text-gray-900` 대신 `text-content-primary`, `bg-white` 대신 `bg-surface-card`를 사용하세요.

### 타이포그래피

| 용도 | 토큰 | 크기 |
|------|------|------|
| 페이지 제목 | `text-heading-xl` | 24px / bold |
| 섹션 제목 | `text-heading-lg` | 20px / semibold |
| 카드 제목 | `text-heading-md` | 18px / semibold |
| 소제목/라벨 | `text-heading-sm` | 14px / semibold |
| 본문 | `text-body-base` | 14px / normal |
| 보조 텍스트 | `text-body-sm` | 12px / normal |
| 캡션 | `text-caption` | 11px / medium |

### 간격

| 용도 | 토큰 | 값 |
|------|------|-----|
| 페이지 좌우 | `px-page-x` | 24px |
| 페이지 상하 | `py-page-y` | 32px |
| 카드 내부 좌우 | `px-card-x` | 24px |
| 카드 내부 상하 | `py-card-y` | 16px |
| 섹션 간격 | `gap-section-gap` | 24px |
| 요소 간격 | `gap-element-gap` | 12px |

### 둥글기

| 용도 | 토큰 |
|------|------|
| 카드 | `rounded-card` |
| 버튼 | `rounded-button` |
| 인풋 | `rounded-input` |
| 뱃지 | `rounded-badge` |
| 모달 | `rounded-modal` |

### 그림자

| 용도 | 토큰 |
|------|------|
| 카드 기본 | `shadow-card` |
| 카드 호버 | `shadow-card-hover` |
| 모달 | `shadow-modal` |
| 네비게이션 | `shadow-nav` |

---

## 2. 컴포넌트 사용 규칙

### 임포트

```tsx
// ✅ barrel export에서 임포트
import { Button, Card, CardBody, Badge } from "@/components/ui";

// ❌ 개별 파일에서 직접 임포트하지 마세요
import { Button } from "@/components/ui/Button";
```

### 페이지 구조

모든 페이지는 이 패턴을 따릅니다:

```tsx
import { ContentHeader } from "@/components/layout";

const MyPage = () => (
  <>
    <ContentHeader
      title="페이지 제목"
      description="페이지 설명"
      actions={<Button>액션</Button>}
    />
    <div className="page-container">
      {/* 페이지 콘텐츠 */}
    </div>
  </>
);
```

**금지 사항**:
- 페이지에 `min-h-screen` 사용 금지 (Layout이 관리)
- 페이지에 자체 `<header>`, `<footer>` 금지 (Layout이 관리)
- 페이지에 자체 `<nav>` 금지

### CSS 클래스 사용

```tsx
// ✅ 디자인 시스템 유틸리티 클래스 사용
<div className="page-container">
<div className="card-base">
<button className="focus-ring">

// ❌ 인라인 포커스 스타일 반복 금지
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
```

---

## 3. 컴포넌트 카탈로그

### Actions (액션)

| 컴포넌트 | 용도 | 주요 Props |
|---------|------|-----------|
| `Button` | 모든 클릭 가능한 액션 | `variant`, `size`, `loading`, `icon` |

### Layout (레이아웃)

| 컴포넌트 | 용도 |
|---------|------|
| `Card` + `CardHeader` + `CardBody` + `CardFooter` | 콘텐츠 그룹 |
| `ContentHeader` | 페이지 상단 제목 + 액션 |
| `Divider` | 구분선 (선택적 라벨) |

### Data Display (데이터 표시)

| 컴포넌트 | 용도 |
|---------|------|
| `Badge` | 상태 표시 (success, danger, warning, info) |
| `Table` + 하위 컴포넌트 | 데이터 테이블 |
| `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | 탭 네비게이션 |

### Feedback (피드백)

| 컴포넌트 | 용도 | 차이점 |
|---------|------|--------|
| `Alert` | 일시적 알림 (성공, 에러) | `onClose`로 닫을 수 있음 |
| `InfoBox` | 영구 안내 (도움말, 팁) | 닫기 버튼 없음, 항상 표시 |
| `Spinner` / `SpinnerOverlay` | 로딩 표시 | |
| `EmptyState` | 데이터 없음 표시 | `icon`, `title`, `action` |

### Overlay (오버레이)

| 컴포넌트 | 용도 |
|---------|------|
| `Modal` + `ModalFooter` | 모달 다이얼로그 |

### Form (폼)

| 컴포넌트 | 용도 |
|---------|------|
| `Input` | 텍스트 입력 |
| `Select` | 드롭다운 선택 |
| `Textarea` | 여러 줄 텍스트 입력 |

---

## 4. 새 컴포넌트 추가 시 체크리스트

1. **토큰 사용**: 하드코딩된 색상/크기 대신 디자인 토큰 사용
2. **타입 정의**: Props에 TypeScript interface 필수
3. **className 전달**: 외부에서 스타일 확장 가능하도록 `className` prop 지원
4. **접근성**: `button`에 `type` 속성, 아이콘 전용 버튼에 `title` + `sr-only` 텍스트
5. **barrel export**: `components/ui/index.ts`에 export 추가
6. **이 문서 업데이트**: 컴포넌트 카탈로그에 추가

---

## 5. z-index 스케일

겹침 순서가 충돌하지 않도록 정해진 스케일을 사용합니다:

| 레이어 | z-index | 용도 |
|--------|---------|------|
| `z-nav` | 30 | 상단 네비게이션 |
| `z-modal-backdrop` | 40 | 모달 배경 |
| `z-modal` | 50 | 모달 본체 |
| `z-toast` | 60 | 토스트 알림 |

---

## 6. 반응형 Breakpoints

Tailwind 기본 breakpoints를 사용합니다:

| Breakpoint | 크기 | 용도 |
|-----------|------|------|
| `sm:` | 640px | 모바일 → 태블릿 |
| `md:` | 768px | 네비게이션 표시 전환 |
| `lg:` | 1024px | 2-3 컬럼 레이아웃 |
| `xl:` | 1280px | 최대 콘텐츠 너비 |
