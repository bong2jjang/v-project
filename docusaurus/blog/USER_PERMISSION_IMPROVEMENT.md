---
slug: user-permission-improvement
title: 일반 사용자 권한 및 알림 시스템 개선 계획안
sidebar_position: 99
draft: true
---

# 일반 사용자 권한 및 알림 시스템 개선 계획안

> **작성일**: 2026-03-23
> **작성자**: VMS Chat Ops Development Team
> **상태**: 구현 완료 (Phase 1-3)
> **우선순위**: 높음 (보안 이슈 포함)
> **완료일**: 2026-03-23

---

## 📋 목차

1. [현재 문제점](#1-현재-문제점)
2. [개선 목표](#2-개선-목표)
3. [상세 개선 계획](#3-상세-개선-계획)
4. [구현 계획](#4-구현-계획)
5. [영향 범위](#5-영향-범위)
6. [테스트 계획](#6-테스트-계획)
7. [마이그레이션 가이드](#7-마이그레이션-가이드)

---

## 1. 현재 문제점

### 1.1 보안 이슈 🔴

#### A. 라우팅 레벨 권한 검사 부재
- **문제**: 일반 사용자가 URL을 직접 입력하면 관리자 페이지에 접근 가능
- **예시**: `/users`, `/audit-logs`, `/monitoring` 직접 접근 가능
- **현재 방어**:
  - ✅ 백엔드 API에서 403 오류 반환 (권한 검증 완료)
  - ❌ 프론트엔드 라우팅에서는 권한 검사 없음
  - ⚠️ 네비게이션에서만 메뉴 숨김 (우회 가능)
- **영향**:
  - 페이지는 렌더링되지만 데이터 로드 실패
  - 불필요한 API 호출 발생 (403 오류)
  - 사용자 혼란 ("Not enough permissions" 오류 표시)

#### B. 권한 오류 처리 불명확
- **현재 동작**:
  ```
  일반 사용자 → /channels 접근 → API 호출 → 403 오류 → Alert 카드 표시
  "Not enough permissions. Admin role required."
  ```
- **문제점**:
  - 페이지는 정상 렌더링되어 사용자 혼란
  - 어떤 권한이 필요한지 명확하지 않음
  - 해결 방법 안내 없음

### 1.2 사용자 경험 이슈 🟡

#### A. 알림 UI 일관성 부족
- **현재 사용 중인 알림 시스템**:
  1. **Alert 카드 (페이지 상단 패널)**
     - 사용 위치: 모든 페이지의 오류/성공 메시지
     - 표시 방식: 수동 (`useState`로 제어)
     - 해제: 수동 (닫기 버튼 클릭)
     - 위치: 페이지 상단 컨텐츠 영역 내

  2. **Toast 알림 (우측 하단 팝업)**
     - 사용 위치: WebSocket 실시간 알림, 일부 API 응답
     - 표시 방식: 자동 (백엔드에서 전송)
     - 해제: 자동 (5초)
     - 위치: 화면 우측 하단 고정

- **문제점**:
  - 같은 유형의 메시지를 두 가지 방식으로 표시
  - 사용자가 어디서 알림을 확인해야 할지 혼란
  - 백엔드 알림(Toast)과 프론트엔드 알림(Alert)이 중복 표시될 수 있음

#### B. 일반 사용자 기능 접근성
- **Settings 페이지**: 일반 사용자가 접근 가능하지만 관리자 탭만 표시 안 됨
- **Messages 페이지**: "테스트 데이터 생성" 버튼이 일반 사용자에게도 노출 (클릭 시 403)
- **Dashboard**: Matterbridge 제어 버튼이 일반 사용자에게도 노출 (클릭 시 403)

### 1.3 기존 분석 요약

#### 페이지별 권한 현황

| 페이지 | 권한 요구 | 라우팅 검사 | 네비게이션 필터링 | 문제점 |
|--------|----------|------------|-----------------|--------|
| Dashboard | 없음 | ❌ | - | 제어 버튼 조건부 렌더링 필요 |
| Channels | 없음 | ❌ | - | 일반 사용자 접근 가능 (정상) |
| Messages | 없음 | ❌ | - | 테스트 데이터 버튼 숨김 필요 |
| Statistics | 없음 | ❌ | - | 일반 사용자 접근 가능 (정상) |
| Settings | 혼합 | ❌ | - | 탭 단위 권한 검사 (정상) |
| **UserManagement** | **Admin 전용** | **❌** | **✅** | **URL 직접 접근 가능** |
| **AuditLogs** | **Admin 전용** | **❌** | **✅** | **URL 직접 접근 가능** |
| **Monitoring** | **Admin 전용** | **❌** | **✅** | **URL 직접 접근 가능** |

#### 백엔드 API 권한 검사 (✅ 완벽)

```
✅ Admin 전용 엔드포인트: 34개 (get_current_active_admin)
✅ 일반 사용자 접근 가능: 24개 (get_current_user)
✅ 모든 엔드포인트에서 FastAPI Depends로 권한 검증
```

---

## 2. 개선 목표

### 2.1 보안 강화 🎯
1. **라우팅 레벨 권한 검사 추가**
   - 관리자 전용 페이지에 `ProtectedRoute` 컴포넌트 적용
   - URL 직접 입력 시 자동으로 Forbidden 페이지로 리다이렉트
   - 불필요한 API 호출 방지

2. **권한 오류 처리 개선**
   - 403 오류 시 명확한 안내 메시지 제공
   - Forbidden 페이지에서 해결 방법 안내
   - 관리자에게 권한 요청 기능 (향후 구현)

### 2.2 사용자 경험 향상 🎯
1. **알림 시스템 통합**
   - Alert 카드를 Toast 알림으로 전환
   - 일관된 알림 경험 제공
   - 자동 해제로 화면 정리

2. **일반 사용자 기능 최적화**
   - 권한이 없는 기능은 UI에서 완전히 숨김
   - 조회 기능은 모든 사용자에게 제공
   - 명확한 권한 안내

### 2.3 유지보수성 향상 🎯
1. **권한 관리 일원화**
   - 권한 검사 로직을 컴포넌트로 추상화
   - 권한 요구사항 명시적 선언
   - 권한 변경 시 한 곳에서만 수정

2. **코드 일관성**
   - 알림 표시 방식 표준화
   - 권한 검사 패턴 표준화
   - 에러 처리 패턴 표준화

---

## 3. 상세 개선 계획

### 3.1 ProtectedRoute 컴포넌트 구현 (우선순위 1)

#### 목적
- 라우팅 레벨에서 권한 검사 수행
- 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
- 권한이 부족한 사용자는 Forbidden 페이지로 리다이렉트

#### 구현 상세

**파일**: `frontend/src/components/ProtectedRoute.tsx`

```typescript
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * 필요한 권한 레벨
   * - undefined: 인증만 필요 (로그인 사용자)
   * - 'admin': 관리자 권한 필요
   */
  requiredRole?: 'admin';
}

/**
 * 권한 기반 라우트 보호 컴포넌트
 *
 * @example
 * // 인증만 필요한 페이지
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 * } />
 *
 * // 관리자 권한 필요한 페이지
 * <Route path="/users" element={
 *   <ProtectedRoute requiredRole="admin">
 *     <UserManagement />
 *   </ProtectedRoute>
 * } />
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  // 1. 인증 검사
  if (!isAuthenticated) {
    // 로그인 후 원래 페이지로 돌아가기 위해 현재 경로 저장
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. 권한 검사
  if (requiredRole === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/forbidden" replace />;
  }

  // 3. 권한 충족 시 자식 컴포넌트 렌더링
  return <>{children}</>;
}
```

#### 적용 대상

**파일**: `frontend/src/App.tsx`

```typescript
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* 공개 페이지 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forbidden" element={<Forbidden />} />

      {/* 인증 필요 페이지 (모든 로그인 사용자) */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/channels" element={
        <ProtectedRoute>
          <Layout><Channels /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/messages" element={
        <ProtectedRoute>
          <Layout><Messages /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/statistics" element={
        <ProtectedRoute>
          <Layout><Statistics /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout><Settings /></Layout>
        </ProtectedRoute>
      } />

      {/* 관리자 전용 페이지 */}
      <Route path="/users" element={
        <ProtectedRoute requiredRole="admin">
          <Layout><UserManagement /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/audit-logs" element={
        <ProtectedRoute requiredRole="admin">
          <Layout><AuditLogs /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/monitoring" element={
        <ProtectedRoute requiredRole="admin">
          <Layout><Monitoring /></Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
```

#### 효과
- ✅ URL 직접 입력 시 자동으로 Forbidden 페이지로 리다이렉트
- ✅ 불필요한 API 호출 방지 (403 오류 사전 차단)
- ✅ 로그인 후 원래 페이지로 돌아가기 지원
- ✅ 명확한 권한 요구사항 선언

---

### 3.2 Forbidden 페이지 개선 (우선순위 1)

#### 현재 상태
- 기본적인 403 오류 메시지만 표시
- 해결 방법 안내 없음

#### 개선 방안

**파일**: `frontend/src/pages/Forbidden.tsx`

```typescript
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, UserCog } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth';

export function Forbidden() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* 아이콘 */}
        <div className="flex justify-center">
          <div className="rounded-full bg-state-error-subtle p-6">
            <ShieldX className="h-16 w-16 text-state-error-emphasis" />
          </div>
        </div>

        {/* 헤딩 */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-content-primary">
            접근 권한 없음
          </h1>
          <p className="text-lg text-content-secondary">
            이 페이지는 관리자 권한이 필요합니다.
          </p>
        </div>

        {/* 상세 정보 */}
        <div className="bg-surface-card rounded-lg p-6 space-y-4 border border-border-subtle">
          <div className="flex items-center gap-3 text-sm text-content-secondary">
            <UserCog className="h-5 w-5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-content-primary">현재 계정 정보</p>
              <p>{user?.username} ({user?.role === 'admin' ? '관리자' : '일반 사용자'})</p>
            </div>
          </div>

          {user?.role !== 'admin' && (
            <div className="bg-state-warning-subtle border border-state-warning-emphasis rounded-md p-4 text-sm text-left">
              <p className="font-medium text-state-warning-emphasis mb-2">
                관리자 권한이 필요합니다
              </p>
              <p className="text-content-secondary">
                이 기능을 사용하려면 시스템 관리자에게 권한 상향을 요청하세요.
              </p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            이전 페이지로
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/')}
          >
            대시보드로 이동
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 효과
- ✅ 명확한 오류 원인 설명
- ✅ 현재 계정 정보 표시
- ✅ 해결 방법 안내
- ✅ 빠른 이동 액션 제공

---

### 3.3 알림 시스템 통합 (우선순위 2)

#### 목적
- Alert 카드를 Toast 알림으로 단계적 전환
- 일관된 알림 UX 제공
- 백엔드 WebSocket 알림과 통합

#### 전환 전략

##### A. 알림 유형별 적절한 UI 선택

| 알림 유형 | 사용 UI | 이유 |
|----------|---------|------|
| **실시간 알림** (WebSocket) | Toast | 비침투적, 자동 해제 |
| **API 응답** (성공/오류) | Toast | 빠른 피드백, 일관성 |
| **폼 검증 오류** | Inline Error | 입력 필드 근처 표시 필요 |
| **페이지 로드 오류** | Toast → Forbidden 리다이렉트 | 권한 오류 |
| **중요 공지** | Alert (유지) | 사용자 확인 필요 시 |

##### B. 전환 대상 페이지

**1단계: 권한 오류 처리**
- `Channels.tsx`: API 403 오류 → Toast + Forbidden 리다이렉트
- `Messages.tsx`: API 403 오류 → Toast + Forbidden 리다이렉트
- `Statistics.tsx`: API 403 오류 → Toast + Forbidden 리다이렉트
- `Settings.tsx`: API 403 오류 → Toast + Forbidden 리다이렉트

**2단계: 성공/오류 메시지**
- `Settings.tsx`: 설정 저장 성공/오류 → Toast
- `Channels.tsx`: 채널 생성/수정/삭제 → Toast
- `UserManagement.tsx`: 사용자 관리 작업 → Toast (이미 적용됨)

**3단계: Alert 컴포넌트 사용 범위 정리**
- 중요 공지 (시스템 점검 등)에만 사용
- 사용자 확인이 반드시 필요한 경우에만 사용

#### 구현 예시

**변경 전** (Alert 카드 사용):
```typescript
// Channels.tsx
const [error, setError] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);

const handleCreateChannel = async () => {
  try {
    await createChannel(data);
    setSuccessMessage("채널이 생성되었습니다!");
  } catch (err) {
    if (err instanceof ApiClientError) {
      setError(err.getUserMessage());
    }
  }
};

return (
  <>
    {error && (
      <div className="mb-6">
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      </div>
    )}
    {successMessage && (
      <div className="mb-6">
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </div>
    )}
    {/* 페이지 컨텐츠 */}
  </>
);
```

**변경 후** (Toast 알림 사용):
```typescript
// Channels.tsx
import { useNotificationStore } from '../store/notification';
import { useNavigate } from 'react-router-dom';

const { addNotification } = useNotificationStore();
const navigate = useNavigate();

const handleCreateChannel = async () => {
  try {
    await createChannel(data);

    // Toast 알림 표시
    addNotification({
      id: `channel-created-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: "success",
      category: "channel",
      title: "채널 생성 완료",
      message: `${data.name} 채널이 성공적으로 생성되었습니다.`,
      source: "channels_page",
      dismissible: true,
      persistent: false,
      read: false,
    });
  } catch (err) {
    if (err instanceof ApiClientError) {
      // 403 오류 시 Forbidden 페이지로 리다이렉트
      if (err.statusCode === 403) {
        navigate('/forbidden');
        return;
      }

      // 기타 오류는 Toast로 표시
      addNotification({
        id: `channel-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "channel",
        title: "채널 생성 실패",
        message: err.getUserMessage(),
        source: "channels_page",
        dismissible: true,
        persistent: false,
        read: false,
      });
    }
  }
};

return (
  <>
    {/* Alert 제거, 페이지 컨텐츠만 표시 */}
    {/* Toast는 Layout의 ToastContainer에서 자동 표시 */}
  </>
);
```

#### 효과
- ✅ 일관된 알림 경험
- ✅ 페이지 레이아웃 간소화
- ✅ 백엔드 알림과 통합
- ✅ 자동 해제로 화면 정리

---

### 3.4 일반 사용자 기능 최적화 (우선순위 2)

#### 목적
- 권한이 없는 기능은 UI에서 완전히 숨김
- 403 오류 사전 방지
- 명확한 사용자 경험 제공

#### 대상 컴포넌트

##### A. Dashboard - Matterbridge 제어 버튼

**현재**: 일반 사용자에게도 제어 버튼 표시 → 클릭 시 403 오류

**개선**:
```typescript
// Dashboard.tsx
import { useAuthStore } from '../store/auth';

export function Dashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <ContentHeader title="대시보드" description="Matterbridge 서비스 상태 및 모니터링" />

      <div className="page-container space-y-section-gap">
        {/* 상태 카드 - 모든 사용자 */}
        <StatusCard />

        {/* 제어 패널 - 관리자만 */}
        {isAdmin && <ControlPanel />}

        {/* 지표 - 모든 사용자 */}
        <MetricsOverview />

        {/* 로그 - 모든 사용자 (읽기 전용) */}
        <RecentLogs />
      </div>
    </>
  );
}
```

##### B. Messages - 테스트 데이터 생성 버튼

**현재**: 일반 사용자에게도 버튼 표시 → 클릭 시 403 오류

**개선**:
```typescript
// Messages.tsx
export function Messages() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <ContentHeader
        title="메시지 히스토리"
        description="Matterbridge를 통해 전송된 메시지 조회 및 검색"
      >
        {/* 관리자 전용 액션 */}
        {isAdmin && (
          <Button onClick={handleGenerateTestData}>
            테스트 데이터 생성
          </Button>
        )}
      </ContentHeader>

      {/* 메시지 목록 - 모든 사용자 */}
      <MessageList />
    </>
  );
}
```

##### C. Settings - 탭 권한 관리 (현재 방식 유지)

**현재 방식** (✅ 적절함):
```typescript
// Settings.tsx
const isAdmin = user?.role === 'admin';

const tabs = [
  { value: "theme", label: "테마", icon: Palette },
  { value: "session", label: "세션 관리", icon: Clock },
  { value: "notifications", label: "알림", icon: Bell },
  { value: "help", label: "도움말", icon: HelpCircle },
  // 관리자 전용 탭
  ...(isAdmin ? [
    { value: "backup", label: "백업/복원", icon: Database },
    { value: "config", label: "설정 편집", icon: Settings },
    { value: "security", label: "보안", icon: Shield },
  ] : []),
];
```

#### 효과
- ✅ 403 오류 사전 방지
- ✅ 명확한 권한 표시
- ✅ 혼란 감소

---

### 3.5 공통 에러 처리 훅 구현 (우선순위 3)

#### 목적
- 에러 처리 로직 중앙화
- 권한 오류 자동 처리
- 코드 중복 제거

#### 구현

**파일**: `frontend/src/hooks/useApiErrorHandler.ts`

```typescript
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '../lib/api/client';
import { useNotificationStore } from '../store/notification';

export interface UseApiErrorHandlerOptions {
  /**
   * 403 오류 시 Forbidden 페이지로 리다이렉트 여부
   * @default true
   */
  redirectOnForbidden?: boolean;

  /**
   * Toast 알림으로 표시 여부
   * @default true
   */
  showToast?: boolean;

  /**
   * 커스텀 에러 처리 콜백
   */
  onError?: (error: Error) => void;
}

/**
 * API 에러 처리 훅
 *
 * @example
 * const handleError = useApiErrorHandler();
 *
 * try {
 *   await api.deleteUser(userId);
 * } catch (err) {
 *   handleError(err);
 * }
 */
export function useApiErrorHandler(options: UseApiErrorHandlerOptions = {}) {
  const {
    redirectOnForbidden = true,
    showToast = true,
    onError,
  } = options;

  const navigate = useNavigate();
  const { addNotification } = useNotificationStore();

  const handleError = useCallback((error: unknown) => {
    // 1. ApiClientError 타입 체크
    if (!(error instanceof ApiClientError)) {
      console.error('Unexpected error:', error);
      if (onError) onError(error as Error);
      return;
    }

    // 2. 403 오류 처리
    if (error.statusCode === 403) {
      if (showToast) {
        addNotification({
          id: `forbidden-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: "error",
          category: "auth",
          title: "접근 권한 없음",
          message: "이 기능은 관리자 권한이 필요합니다.",
          source: "api_error_handler",
          dismissible: true,
          persistent: false,
          read: false,
        });
      }

      if (redirectOnForbidden) {
        navigate('/forbidden');
      }
      return;
    }

    // 3. 401 오류 처리 (인증 실패)
    if (error.statusCode === 401) {
      if (showToast) {
        addNotification({
          id: `unauthorized-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: "error",
          category: "auth",
          title: "인증 실패",
          message: "로그인이 필요합니다.",
          source: "api_error_handler",
          dismissible: true,
          persistent: false,
          read: false,
        });
      }

      navigate('/login');
      return;
    }

    // 4. 기타 에러 Toast 표시
    if (showToast) {
      addNotification({
        id: `error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: "error",
        category: "api",
        title: "오류 발생",
        message: error.getUserMessage(),
        source: "api_error_handler",
        dismissible: true,
        persistent: false,
        read: false,
      });
    }

    // 5. 커스텀 에러 핸들러 호출
    if (onError) onError(error);
  }, [navigate, addNotification, redirectOnForbidden, showToast, onError]);

  return handleError;
}
```

#### 사용 예시

```typescript
// Channels.tsx
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';

export function Channels() {
  const handleError = useApiErrorHandler();

  const handleCreateChannel = async () => {
    try {
      await createChannel(data);

      // 성공 Toast만 직접 추가
      addNotification({
        severity: "success",
        title: "채널 생성 완료",
        message: `${data.name} 채널이 성공적으로 생성되었습니다.`,
        // ...
      });
    } catch (err) {
      // 에러 처리는 훅에 위임
      handleError(err);
    }
  };

  return (/* ... */);
}
```

#### 효과
- ✅ 에러 처리 로직 중앙화
- ✅ 권한 오류 자동 리다이렉트
- ✅ 코드 중복 제거 (DRY)
- ✅ 일관된 에러 처리

---

## 4. 구현 계획

### 4.1 Phase 1: 보안 강화 (우선순위: 높음)

**목표**: 라우팅 레벨 권한 검사 추가

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 1.1. ProtectedRoute 컴포넌트 구현 | Frontend | 1시간 | P0 |
| 1.2. App.tsx에 ProtectedRoute 적용 | Frontend | 1시간 | P0 |
| 1.3. Forbidden 페이지 개선 | Frontend | 2시간 | P1 |
| 1.4. 통합 테스트 (권한별 라우팅) | QA | 2시간 | P0 |

**완료 기준**:
- ✅ 일반 사용자가 관리자 페이지 URL 직접 입력 시 Forbidden 페이지로 리다이렉트
- ✅ 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
- ✅ 로그인 후 원래 페이지로 돌아가기 작동
- ✅ Forbidden 페이지에서 명확한 안내 메시지 표시

### 4.2 Phase 2: 알림 시스템 통합 (우선순위: 중간)

**목표**: Alert 카드를 Toast 알림으로 전환

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 2.1. useApiErrorHandler 훅 구현 | Frontend | 2시간 | P1 |
| 2.2. Channels 페이지 Toast 전환 | Frontend | 1시간 | P1 |
| 2.3. Messages 페이지 Toast 전환 | Frontend | 1시간 | P1 |
| 2.4. Statistics 페이지 Toast 전환 | Frontend | 1시간 | P1 |
| 2.5. Settings 페이지 Toast 전환 | Frontend | 1시간 | P1 |
| 2.6. Alert 컴포넌트 사용 범위 정리 | Frontend | 1시간 | P2 |
| 2.7. 통합 테스트 (알림 UI) | QA | 2시간 | P1 |

**완료 기준**:
- ✅ 모든 페이지에서 Alert 카드 제거
- ✅ API 응답 알림은 Toast로 표시
- ✅ 권한 오류 시 Toast + Forbidden 리다이렉트
- ✅ 백엔드 WebSocket 알림과 일관된 UI

### 4.3 Phase 3: 일반 사용자 기능 최적화 (우선순위: 중간)

**목표**: 권한이 없는 기능 UI 숨김

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 3.1. Dashboard 제어 버튼 조건부 렌더링 | Frontend | 0.5시간 | P1 |
| 3.2. Messages 테스트 데이터 버튼 숨김 | Frontend | 0.5시간 | P1 |
| 3.3. 통합 테스트 (일반 사용자 시나리오) | QA | 2시간 | P1 |

**완료 기준**:
- ✅ 일반 사용자 로그인 시 관리자 전용 기능 UI에 표시 안 됨
- ✅ 403 오류 발생하지 않음
- ✅ 모든 노출된 기능은 일반 사용자가 사용 가능

### 4.4 Phase 4: 문서화 및 가이드 작성 (우선순위: 낮음)

**목표**: 권한 관리 문서화

| 작업 | 담당 | 예상 시간 | 우선순위 |
|------|------|----------|---------|
| 4.1. 권한별 기능 매트릭스 문서 작성 | Tech Writer | 2시간 | P2 |
| 4.2. 사용자 가이드 업데이트 | Tech Writer | 2시간 | P2 |
| 4.3. 개발자 가이드 업데이트 | Tech Writer | 2시간 | P2 |

**완료 기준**:
- ✅ docs/guides/user/USER_GUIDE.md 업데이트
- ✅ docs/guides/developer/PERMISSION_GUIDE.md 작성
- ✅ CLAUDE.md에 권한 관리 섹션 추가

### 4.5 타임라인

```
Week 1: Phase 1 (보안 강화)
├─ Day 1-2: ProtectedRoute 구현 및 적용
├─ Day 3: Forbidden 페이지 개선
└─ Day 4-5: 통합 테스트 및 버그 수정

Week 2: Phase 2 (알림 시스템 통합)
├─ Day 1-2: useApiErrorHandler 구현 및 페이지 적용
├─ Day 3-4: 나머지 페이지 Toast 전환
└─ Day 5: 통합 테스트

Week 3: Phase 3 (일반 사용자 기능 최적화)
├─ Day 1-2: UI 조건부 렌더링 적용
└─ Day 3-5: 통합 테스트 및 사용자 시나리오 검증

Week 4: Phase 4 (문서화)
└─ 전체 기간: 문서 작성 및 가이드 업데이트
```

---

## 5. 영향 범위

### 5.1 프론트엔드 (Medium Impact)

#### 영향 받는 파일

```
frontend/src/
├── App.tsx                          [수정] ProtectedRoute 적용
├── components/
│   ├── ProtectedRoute.tsx          [신규] 라우트 보호 컴포넌트
│   └── ui/Alert.tsx                [유지] 사용 범위 축소
├── pages/
│   ├── Forbidden.tsx               [수정] UI 개선
│   ├── Dashboard.tsx               [수정] Toast 전환, 조건부 렌더링
│   ├── Channels.tsx                [수정] Toast 전환
│   ├── Messages.tsx                [수정] Toast 전환, 버튼 숨김
│   ├── Statistics.tsx              [수정] Toast 전환
│   ├── Settings.tsx                [수정] Toast 전환
│   ├── UserManagement.tsx          [수정] Toast 전환 (선택)
│   └── AuditLogs.tsx               [수정] Toast 전환 (선택)
├── hooks/
│   └── useApiErrorHandler.ts       [신규] 공통 에러 처리 훅
└── store/
    └── notification.ts             [유지] 기존 Toast 시스템 활용
```

#### 호환성

- ✅ **하위 호환성 유지**: 기존 Alert 컴포넌트는 유지 (사용 범위만 축소)
- ✅ **Toast 시스템 활용**: 이미 구현된 Toast 시스템 재사용
- ✅ **점진적 마이그레이션**: 페이지별로 단계적 전환 가능

### 5.2 백엔드 (No Impact)

#### 변경 사항 없음

- ✅ 백엔드 API는 이미 완벽한 권한 검사 구현
- ✅ 프론트엔드 개선만 수행
- ✅ API 스펙 변경 없음

### 5.3 사용자 경험 (High Impact)

#### 일반 사용자

**Before**:
1. 관리자 페이지 URL 입력 → 페이지 렌더링 → API 403 오류 → Alert 카드 표시 → 혼란
2. 기능 버튼 클릭 → 403 오류 → Alert 표시 → 혼란
3. 성공/오류 메시지가 여러 곳에 표시 (Alert, Toast) → 일관성 부족

**After**:
1. 관리자 페이지 URL 입력 → Forbidden 페이지 즉시 리다이렉트 → 명확한 안내
2. 권한 없는 기능은 UI에 표시 안 됨 → 혼란 없음
3. 모든 알림이 Toast로 통합 → 일관된 경험

#### 관리자

**Before**:
- 일반 사용자와 동일한 UI
- 권한 차이가 명확하지 않음

**After**:
- 관리자 전용 기능이 명확히 표시
- "Admin" 배지로 권한 구분 명확

---

## 6. 테스트 계획

### 6.1 단위 테스트

#### ProtectedRoute 컴포넌트

**파일**: `frontend/src/components/__tests__/ProtectedRoute.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuthStore } from '../../store/auth';

// Mock useAuthStore
jest.mock('../../store/auth');

describe('ProtectedRoute', () => {
  it('인증되지 않은 사용자는 로그인 페이지로 리다이렉트', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('일반 사용자는 인증 페이지 접근 가능', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { username: 'user', role: 'user' },
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('일반 사용자는 관리자 페이지 접근 불가', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { username: 'user', role: 'user' },
    });

    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('관리자는 모든 페이지 접근 가능', () => {
    (useAuthStore as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { username: 'admin', role: 'admin' },
    });

    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});
```

#### useApiErrorHandler 훅

**파일**: `frontend/src/hooks/__tests__/useApiErrorHandler.test.ts`

```typescript
import { renderHook } from '@testing-library/react';
import { useApiErrorHandler } from '../useApiErrorHandler';
import { ApiClientError } from '../../lib/api/client';
import { useNotificationStore } from '../../store/notification';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../store/notification');

describe('useApiErrorHandler', () => {
  it('403 오류 시 Forbidden 페이지로 리다이렉트', () => {
    const { result } = renderHook(() => useApiErrorHandler());
    const error = new ApiClientError(
      'Forbidden',
      403,
      'POST',
      '/api/users',
      { detail: 'Not enough permissions' }
    );

    result.current(error);

    // Toast 알림 추가 확인
    expect(useNotificationStore().addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        title: '접근 권한 없음',
      })
    );
  });

  it('401 오류 시 로그인 페이지로 리다이렉트', () => {
    const { result } = renderHook(() => useApiErrorHandler());
    const error = new ApiClientError(
      'Unauthorized',
      401,
      'GET',
      '/api/users/me',
      { detail: 'Invalid credentials' }
    );

    result.current(error);

    expect(useNotificationStore().addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        title: '인증 실패',
      })
    );
  });

  it('기타 오류는 Toast로만 표시', () => {
    const { result } = renderHook(() => useApiErrorHandler({
      redirectOnForbidden: false,
    }));
    const error = new ApiClientError(
      'Bad Request',
      400,
      'POST',
      '/api/channels',
      { detail: 'Invalid input' }
    );

    result.current(error);

    expect(useNotificationStore().addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        title: '오류 발생',
      })
    );
  });
});
```

### 6.2 통합 테스트

#### 권한별 라우팅 시나리오

**파일**: `frontend/src/__tests__/integration/routing.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from '../../App';
import { useAuthStore } from '../../store/auth';

jest.mock('../../store/auth');

describe('권한별 라우팅', () => {
  describe('일반 사용자', () => {
    beforeEach(() => {
      (useAuthStore as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { username: 'user', role: 'user' },
      });
    });

    it('/users 접근 시 Forbidden 페이지 표시', async () => {
      window.history.pushState({}, '', '/users');
      render(<App />);

      expect(await screen.findByText(/접근 권한 없음/)).toBeInTheDocument();
    });

    it('/dashboard 접근 가능', async () => {
      window.history.pushState({}, '', '/');
      render(<App />);

      expect(await screen.findByText(/대시보드/)).toBeInTheDocument();
    });

    it('/channels 접근 가능', async () => {
      window.history.pushState({}, '', '/channels');
      render(<App />);

      expect(await screen.findByText(/채널 관리/)).toBeInTheDocument();
    });
  });

  describe('관리자', () => {
    beforeEach(() => {
      (useAuthStore as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        user: { username: 'admin', role: 'admin' },
      });
    });

    it('모든 페이지 접근 가능', async () => {
      const pages = [
        '/',
        '/channels',
        '/messages',
        '/statistics',
        '/settings',
        '/users',
        '/audit-logs',
      ];

      for (const path of pages) {
        window.history.pushState({}, '', path);
        render(<App />);
        expect(screen.queryByText(/접근 권한 없음/)).not.toBeInTheDocument();
      }
    });
  });
});
```

### 6.3 E2E 테스트 (선택)

#### Playwright 시나리오

**파일**: `e2e/permission.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('권한별 페이지 접근', () => {
  test('일반 사용자: 관리자 페이지 URL 직접 입력 시 Forbidden', async ({ page }) => {
    // 1. 일반 사용자로 로그인
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // 2. 관리자 페이지 URL 직접 입력
    await page.goto('http://localhost:5173/users');

    // 3. Forbidden 페이지 표시 확인
    await expect(page.locator('h1')).toContainText('접근 권한 없음');
    await expect(page.locator('text=관리자 권한이 필요합니다')).toBeVisible();
  });

  test('관리자: 모든 페이지 접근 가능', async ({ page }) => {
    // 1. 관리자로 로그인
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // 2. 관리자 페이지 접근
    await page.goto('http://localhost:5173/users');

    // 3. 페이지 정상 표시 확인
    await expect(page.locator('h1')).toContainText('사용자 관리');
    await expect(page.locator('text=접근 권한 없음')).not.toBeVisible();
  });

  test('일반 사용자: Dashboard 제어 버튼 숨김', async ({ page }) => {
    // 1. 일반 사용자로 로그인
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // 2. Dashboard 접근
    await page.goto('http://localhost:5173/');

    // 3. 제어 버튼 숨김 확인
    await expect(page.locator('button:has-text("시작")')).not.toBeVisible();
    await expect(page.locator('button:has-text("중지")')).not.toBeVisible();
    await expect(page.locator('button:has-text("재시작")')).not.toBeVisible();
  });
});
```

### 6.4 테스트 체크리스트

#### Phase 1: 보안 강화

- [ ] 인증되지 않은 사용자가 보호된 페이지 접근 시 로그인 페이지로 리다이렉트
- [ ] 일반 사용자가 관리자 페이지 URL 직접 입력 시 Forbidden 페이지로 리다이렉트
- [ ] 로그인 후 원래 페이지로 돌아가기 작동 (`state.from` 사용)
- [ ] Forbidden 페이지에서 명확한 안내 메시지 표시
- [ ] Forbidden 페이지에서 이전 페이지/대시보드로 이동 버튼 작동

#### Phase 2: 알림 시스템 통합

- [ ] useApiErrorHandler 훅이 403 오류 시 Forbidden 리다이렉트
- [ ] useApiErrorHandler 훅이 401 오류 시 로그인 리다이렉트
- [ ] 모든 페이지에서 Alert 카드 제거됨
- [ ] 성공/오류 메시지가 Toast로 표시됨
- [ ] Toast 알림이 5초 후 자동 해제됨
- [ ] 백엔드 WebSocket 알림과 프론트엔드 Toast가 동일한 UI로 표시

#### Phase 3: 일반 사용자 기능 최적화

- [ ] 일반 사용자 로그인 시 Dashboard에 제어 버튼 숨김
- [ ] 일반 사용자 로그인 시 Messages에 테스트 데이터 버튼 숨김
- [ ] 일반 사용자가 노출된 모든 기능 사용 가능 (403 오류 없음)
- [ ] 관리자 로그인 시 모든 기능 표시 및 사용 가능

---

## 7. 마이그레이션 가이드

### 7.1 개발자를 위한 가이드

#### A. 새로운 페이지 추가 시

**1. 권한 요구사항 결정**

```typescript
// 인증만 필요한 페이지
<Route path="/my-page" element={
  <ProtectedRoute>
    <Layout><MyPage /></Layout>
  </ProtectedRoute>
} />

// 관리자 권한 필요한 페이지
<Route path="/admin-page" element={
  <ProtectedRoute requiredRole="admin">
    <Layout><AdminPage /></Layout>
  </ProtectedRoute>
} />
```

**2. 에러 처리**

```typescript
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { useNotificationStore } from '../store/notification';

export function MyPage() {
  const handleError = useApiErrorHandler();
  const { addNotification } = useNotificationStore();

  const handleAction = async () => {
    try {
      await api.doSomething();

      // 성공 Toast
      addNotification({
        severity: "success",
        title: "작업 완료",
        message: "성공적으로 처리되었습니다.",
        // ...
      });
    } catch (err) {
      // 에러 처리는 훅에 위임
      handleError(err);
    }
  };

  return (/* ... */);
}
```

**3. 조건부 렌더링**

```typescript
import { useAuthStore } from '../store/auth';

export function MyPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* 모든 사용자에게 표시 */}
      <PublicFeature />

      {/* 관리자에게만 표시 */}
      {isAdmin && <AdminFeature />}
    </>
  );
}
```

#### B. 기존 페이지 마이그레이션

**Before**:
```typescript
// MyPage.tsx
const [error, setError] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);

const handleAction = async () => {
  try {
    await api.doSomething();
    setSuccessMessage("성공!");
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.statusCode === 403) {
        setError("권한이 없습니다.");
      } else {
        setError(err.getUserMessage());
      }
    }
  }
};

return (
  <>
    {error && <Alert variant="danger">{error}</Alert>}
    {successMessage && <Alert variant="success">{successMessage}</Alert>}
    {/* ... */}
  </>
);
```

**After**:
```typescript
// MyPage.tsx
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { useNotificationStore } from '../store/notification';

const handleError = useApiErrorHandler();
const { addNotification } = useNotificationStore();

const handleAction = async () => {
  try {
    await api.doSomething();

    addNotification({
      id: `action-success-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: "success",
      category: "action",
      title: "작업 완료",
      message: "성공적으로 처리되었습니다.",
      source: "my_page",
      dismissible: true,
      persistent: false,
      read: false,
    });
  } catch (err) {
    handleError(err); // 에러 처리 자동화
  }
};

return (
  <>
    {/* Alert 제거, Toast가 자동으로 표시됨 */}
    {/* ... */}
  </>
);
```

### 7.2 사용자를 위한 가이드

#### 일반 사용자

**변경 사항**:
1. 관리자 페이지 접근 시 명확한 안내 페이지 표시
2. 권한이 없는 기능은 UI에서 완전히 숨김
3. 알림 메시지가 화면 우측 하단에 표시 (자동 해제)

**주요 변경점**:
- ✅ Dashboard: 조회 기능만 제공 (제어 버튼 숨김)
- ✅ Channels: 조회 기능 제공
- ✅ Messages: 조회 및 검색 기능 제공
- ✅ Statistics: 통계 조회 기능 제공
- ✅ Settings: 테마, 세션, 알림, 도움말 탭만 접근

#### 관리자

**변경 사항**:
1. 기존 기능 모두 유지
2. 알림 메시지가 화면 우측 하단에 표시 (일반 사용자와 동일)

**추가 기능**:
- 사용자 관리 (`/users`)
- 감사 로그 (`/audit-logs`)
- 시스템 모니터링 (`/monitoring`)
- Settings 내 백업/복원, 설정 편집, 보안 탭

---

## 8. 추가 고려 사항

### 8.1 향후 확장 가능성

#### A. 역할 기반 접근 제어 (RBAC) 확장

현재는 `admin`과 `user` 두 가지 역할만 지원하지만, 향후 다음과 같이 확장 가능:

```typescript
// 미래 구조 예시
type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete';
}

// ProtectedRoute 확장
<ProtectedRoute requiredPermissions={[
  { resource: 'channels', action: 'write' }
]}>
  <ChannelEditor />
</ProtectedRoute>
```

#### B. 권한 요청 기능

일반 사용자가 관리자에게 권한 상향을 요청하는 기능:

```typescript
// Forbidden 페이지에서
<Button onClick={handleRequestPermission}>
  관리자에게 권한 요청
</Button>
```

백엔드에서 알림 전송:
```python
# backend/app/api/permissions.py
@router.post("/request-permission")
async def request_permission(
    target_role: str,
    reason: str,
    current_user: User = Depends(get_current_user),
):
    # 관리자에게 알림 전송
    await notification_service.notify_admins(
        title="권한 요청",
        message=f"{current_user.username}님이 {target_role} 권한을 요청했습니다.",
        severity="info",
    )
```

### 8.2 성능 최적화

#### A. 권한 정보 캐싱

현재는 `useAuthStore`에서 사용자 정보를 전역으로 관리하지만, 대규모 애플리케이션에서는 권한 정보를 별도로 캐싱:

```typescript
// frontend/src/hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuthStore();

  // 권한 정보 메모이제이션
  return useMemo(() => ({
    canManageUsers: user?.role === 'admin',
    canViewAuditLogs: user?.role === 'admin',
    canControlMatterbridge: user?.role === 'admin',
    canManageChannels: true, // 모든 사용자 가능
  }), [user?.role]);
}
```

#### B. 조건부 코드 스플리팅

관리자 전용 페이지는 lazy loading으로 번들 크기 최적화:

```typescript
// App.tsx
import { lazy, Suspense } from 'react';

const UserManagement = lazy(() => import('./pages/UserManagement'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));

<Route path="/users" element={
  <ProtectedRoute requiredRole="admin">
    <Suspense fallback={<Loading />}>
      <Layout><UserManagement /></Layout>
    </Suspense>
  </ProtectedRoute>
} />
```

### 8.3 보안 강화

#### A. CSRF 토큰 검증 (향후)

중요한 작업(사용자 삭제, 권한 변경 등)에 CSRF 토큰 추가:

```typescript
// frontend/src/lib/api/client.ts
export class ApiClient {
  async deleteUser(userId: string) {
    const csrfToken = await this.getCsrfToken();

    return this.request('/api/users/' + userId, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });
  }
}
```

#### B. 감사 로그 자동 기록

권한 관련 작업은 자동으로 감사 로그에 기록:

```python
# backend/app/services/audit_service.py
async def log_permission_check(
    user: User,
    resource: str,
    action: str,
    result: bool,
):
    await audit_log_repository.create(
        user_id=user.id,
        action=f"permission_check:{resource}:{action}",
        resource=resource,
        details={
            "result": "allowed" if result else "denied",
        },
    )
```

---

## 9. 참고 자료

### 9.1 관련 문서

- [VMS Chat Ops 아키텍처 문서](../developer-guide/ARCHITECTURE)
- [디자인 시스템 가이드](../developer-guide/DESIGN_SYSTEM)
- [페이지 레이아웃 가이드](../developer-guide/PAGE_LAYOUT_GUIDE)
- [알림 시스템 구현 보고서](../reports/NOTIFICATION_SYSTEM_IMPLEMENTATION)
- [API 문서](../api/API_DOCUMENTATION)

### 9.2 외부 참고

- [React Router - Protected Routes](https://reactrouter.com/en/main/examples/auth)
- [FastAPI - Security](https://fastapi.tiangolo.com/tutorial/security/)
- [OWASP - Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

---

## 10. 승인 및 리뷰

### 리뷰어

- [ ] Frontend Lead:
- [ ] Backend Lead:
- [ ] Security Team:
- [ ] Product Owner:

### 승인 상태

- 상태: **제안**
- 승인일:
- 다음 단계: Phase 1 구현 시작

---

**문서 버전**: 1.0
**최종 수정일**: 2026-03-23
**작성자**: VMS Chat Ops Development Team
