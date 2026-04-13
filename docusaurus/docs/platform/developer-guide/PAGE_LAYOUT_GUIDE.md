---
id: page-layout-guide
title: 페이지 레이아웃 가이드
sidebar_position: 99
tags: [guide, developer]
---

# 페이지 레이아웃 가이드

## 개요

VMS Channel Bridge 프론트엔드의 모든 페이지는 일관된 레이아웃 패턴을 따릅니다. 이 가이드는 새로운 페이지를 만들 때 반드시 준수해야 하는 구조와 규칙을 정의합니다.

## 표준 페이지 구조

### 기본 템플릿

```tsx
import { ContentHeader } from "@/components/layout/ContentHeader";

export default function YourPage() {
  return (
    <>
      {/* 1. 페이지 헤더 */}
      <ContentHeader
        title="페이지 제목"
        description="페이지 설명 (1-2문장)"
      />

      {/* 2. 페이지 컨테이너 */}
      <div className="page-container space-y-section-gap">
        {/* 3. 콘텐츠 섹션들 */}
        <div>필터 또는 검색 섹션</div>
        <div>메인 콘텐츠</div>
        <div>추가 섹션</div>
      </div>
    </>
  );
}
```

## 핵심 규칙

### 1. Fragment 사용

**❌ 잘못된 예:**
```tsx
export default function YourPage() {
  return (
    <div>
      <ContentHeader ... />
      <div className="page-container">
        ...
      </div>
    </div>
  );
}
```

**✅ 올바른 예:**
```tsx
export default function YourPage() {
  return (
    <>
      <ContentHeader ... />
      <div className="page-container space-y-section-gap">
        ...
      </div>
    </>
  );
}
```

**이유:** 불필요한 DOM 래퍼를 제거하여 레이아웃 단순화

### 2. ContentHeader 컴포넌트

모든 페이지는 **반드시 ContentHeader 컴포넌트**를 사용해야 합니다.

**필수 props:**
- `title`: 페이지 제목 (명사형)
- `description`: 페이지 설명 (1-2문장, 명확하게)

**선택 props:**
- `actions`: 우측 상단 액션 버튼들

**예시:**
```tsx
<ContentHeader
  title="사용자 관리"
  description="사용자 계정을 관리하고 역할을 설정합니다"
  actions={
    <Button onClick={handleCreate}>
      사용자 추가
    </Button>
  }
/>
```

### 3. 페이지 컨테이너

**필수 클래스:**
```tsx
<div className="page-container space-y-section-gap">
  {/* 콘텐츠 */}
</div>
```

**클래스 설명:**
- `page-container`: 좌우 여백 자동 적용 (반응형)
- `space-y-section-gap`: 섹션 간 일관된 수직 간격

**❌ 금지 사항:**
- 수동 여백 (`mb-6`, `mt-4` 등) 사용 금지
- `p-6`, `px-4` 등 임의 패딩 금지

### 4. 섹션 구조

각 섹션은 **카드 형태**로 구성합니다.

**필터/검색 섹션:**
```tsx
<div className="bg-surface-card border border-stroke-default rounded-lg p-4">
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Input ... />
    <Select ... />
  </div>
</div>
```

**데이터 표시 섹션:**
```tsx
<div className="bg-surface-card border border-stroke-default rounded-lg overflow-hidden">
  <table className="min-w-full">
    ...
  </table>
</div>
```

**그리드 레이아웃:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  {items.map(item => (
    <Card key={item.id} ... />
  ))}
</div>
```

### 5. 에러/성공 메시지

Alert 컴포넌트를 page-container 내부에 배치합니다.

```tsx
<div className="page-container space-y-section-gap">
  {/* 에러 메시지 */}
  {error && (
    <Alert variant="error">
      {error}
    </Alert>
  )}

  {/* 성공 메시지 */}
  {success && (
    <Alert variant="success">
      {success}
    </Alert>
  )}

  {/* 나머지 콘텐츠 */}
  ...
</div>
```

### 6. 모달 배치

모달은 **page-container 내부 마지막**에 배치합니다.

```tsx
<div className="page-container space-y-section-gap">
  {/* 콘텐츠 */}
  ...

  {/* 모달 */}
  <Modal isOpen={isOpen} onClose={handleClose}>
    ...
  </Modal>
</div>
```

## 반응형 디자인

### 그리드 breakpoints

```tsx
// 모바일: 1열
// 태블릿: 2열
// 데스크톱: 3열
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
```

### 필터 레이아웃

```tsx
// 모바일: 세로 스택
// 데스크톱: 가로 정렬
<div className="flex flex-col md:flex-row gap-4">
```

## 간격 시스템

### 사용 가능한 간격

- `space-y-section-gap`: 섹션 간 간격 (주로 사용)
- `gap-5`: 그리드/카드 간격
- `gap-4`: 폼 요소 간격
- `gap-3`: 버튼 그룹 간격
- `gap-2`: 작은 요소 간격

### 금지된 간격

❌ 다음은 **절대 사용하지 마세요:**
- `mb-6`, `mt-8`, `py-10` 등 임의의 수동 여백
- `space-y-4`, `space-y-6` (section-gap 대신)

## 실제 예시

### 예시 1: 목록 페이지

```tsx
import { ContentHeader } from "@/components/layout/ContentHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export default function ItemsPage() {
  return (
    <>
      <ContentHeader
        title="항목 관리"
        description="항목을 조회하고 관리합니다"
        actions={
          <Button onClick={handleCreate}>
            항목 추가
          </Button>
        }
      />

      <div className="page-container space-y-section-gap">
        {/* 에러 */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* 필터 */}
        <div className="bg-surface-card border border-stroke-default rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="검색..." />
            <Select>
              <option>전체</option>
            </Select>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-surface-card border border-stroke-default rounded-lg overflow-hidden">
          <table className="min-w-full">
            ...
          </table>
        </div>
      </div>
    </>
  );
}
```

### 예시 2: 그리드 페이지

```tsx
import { ContentHeader } from "@/components/layout/ContentHeader";
import { Card } from "@/components/ui/Card";

export default function CardsPage() {
  return (
    <>
      <ContentHeader
        title="카드 목록"
        description="카드 형태로 데이터를 표시합니다"
      />

      <div className="page-container space-y-section-gap">
        {/* 필터 */}
        <div className="bg-surface-card border border-stroke-default rounded-lg p-4">
          ...
        </div>

        {/* 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => (
            <Card key={item.id}>
              <CardHeader>{item.title}</CardHeader>
              <CardBody>{item.content}</CardBody>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
```

## 페이지 유형별 패턴

### 유형 1: Card 기반 단일 섹션 페이지

단일 주제의 폼이나 설정을 다루는 페이지입니다.

**예시: PasswordChange.tsx**

```tsx
import { ContentHeader } from '../components/Layout';
import { Card, CardBody } from '../components/ui/Card';

export default function PasswordChange() {
  return (
    <>
      <ContentHeader
        title="비밀번호 변경"
        description="보안을 위해 정기적으로 비밀번호를 변경하세요"
      />

      <div className="page-container space-y-section-gap">
        <Card>
          <CardBody>
            <div className="space-y-6">
              {/* 섹션 1: 주요 콘텐츠 */}
              <div>
                <h3 className="text-lg font-semibold text-content-primary mb-1">
                  새 비밀번호 설정
                </h3>
                <p className="text-body-sm text-content-secondary mb-4">
                  현재 비밀번호를 입력한 후 새 비밀번호를 설정할 수 있습니다
                </p>
                <PasswordChangeForm />
              </div>

              {/* 섹션 2: 추가 정보 (구분선 사용) */}
              <div className="border-t border-line pt-6">
                <h3 className="text-lg font-semibold text-content-primary mb-4">
                  비밀번호 보안 가이드
                </h3>
                {/* 가이드 내용 */}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
```

**핵심 규칙:**
- Card + CardBody로 전체 콘텐츠 래핑
- 내부 섹션은 `space-y-6`으로 간격 조정
- 섹션 구분은 `border-t border-line pt-6` 사용
- 섹션 제목은 `h3` + `text-lg font-semibold text-content-primary`

### 유형 2: Tab 기반 다중 섹션 페이지

여러 관련 섹션을 탭으로 구분하는 페이지입니다.

**예시: Profile.tsx**

```tsx
import { useState } from 'react';
import { ContentHeader } from '../components/Layout';
import { Card, CardBody } from '../components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <>
      <ContentHeader
        title="프로필"
        description="내 프로필 정보를 확인하고 수정합니다"
      />

      <div className="page-container space-y-section-gap">
        <Card>
          <CardBody>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="sessions">로그인 세션</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-content-primary">
                    기본 정보
                  </h3>
                  {/* 탭 콘텐츠 */}
                </div>
              </TabsContent>

              <TabsContent value="sessions">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-content-primary">
                    로그인 세션
                  </h3>
                  {/* 탭 콘텐츠 */}
                </div>
              </TabsContent>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
```

**핵심 규칙:**
- Card + CardBody 안에 Tabs 전체 구조 배치
- Tabs는 `value`와 `onValueChange`로 상태 관리
- 각 TabsContent는 `space-y-4`로 내부 간격 조정
- 탭별 제목은 h3 사용 (CardHeader 사용하지 않음)

### 유형 3: 디바이스/세션 리스트 표시

로그인 세션이나 디바이스 정보를 표시하는 패턴입니다.

**예시: SessionDeviceList.tsx**

```tsx
import { Smartphone, Monitor, Tablet, X, LogOut } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function SessionDeviceList() {
  // 디바이스 아이콘 결정 헬퍼
  const getDeviceIcon = (deviceName: string) => {
    const name = deviceName.toLowerCase();
    if (name.includes('mobile') || name.includes('android') || name.includes('ios')) {
      return <Smartphone className="w-5 h-5" />;
    }
    if (name.includes('tablet') || name.includes('ipad')) {
      return <Tablet className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  // 날짜 포맷팅 헬퍼
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '알 수 없음';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return '알 수 없음';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {devices.map((device) => {
          const isCurrent = device.device_fingerprint === localStorage.getItem('device_fingerprint');

          return (
            <div
              key={device.id}
              className="p-4 bg-surface-base border border-line rounded-card hover:border-line-hover transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* 디바이스 정보 */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* 아이콘 */}
                  <div className="flex-shrink-0 text-content-secondary mt-1">
                    {getDeviceIcon(device.device_name)}
                  </div>

                  {/* 상세 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-body-base font-medium text-content-primary truncate">
                        {device.device_name || '알 수 없는 디바이스'}
                      </p>
                      {isCurrent && (
                        <Badge variant="info" size="sm">
                          현재 디바이스
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-body-sm text-content-secondary">
                      <p>
                        <span className="font-medium">IP 주소:</span>{' '}
                        {device.ip_address || '알 수 없음'}
                      </p>
                      <p>
                        <span className="font-medium">마지막 활동:</span>{' '}
                        {formatDate(device.last_used_at)}
                      </p>
                      <p>
                        <span className="font-medium">로그인 시간:</span>{' '}
                        {formatDate(device.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                {!isCurrent && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleLogoutDevice(device.id)}
                    disabled={logoutingDeviceId === device.id}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {logoutingDeviceId === device.id ? '로그아웃 중...' : '로그아웃'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 전체 액션 버튼 */}
      {devices.length > 1 && (
        <div className="pt-2 border-t border-line">
          <Button variant="danger" onClick={handleLogoutAll}>
            <LogOut className="w-4 h-4 mr-2" />
            모든 디바이스에서 로그아웃
          </Button>
        </div>
      )}
    </div>
  );
}
```

**핵심 규칙:**
- 각 항목: `p-4 bg-surface-base border border-line rounded-card hover:border-line-hover transition-colors`
- lucide-react 아이콘 사용 (Smartphone, Monitor, Tablet, X, LogOut)
- 날짜는 `Intl.DateTimeFormat`으로 포맷
- 현재 항목 표시는 Badge 컴포넌트 사용
- 액션 버튼은 Button 컴포넌트 사용
- flex 레이아웃으로 아이콘-내용-버튼 구조
- `flex-shrink-0`, `min-w-0`, `truncate`로 반응형 처리

## 공통 패턴 가이드

### 날짜 포맷팅 표준

모든 날짜 표시는 `Intl.DateTimeFormat`을 사용합니다.

```tsx
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '알 수 없음';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '알 수 없음';
  }
};
```

### Notification 사용 표준

모든 알림은 완전한 Notification 객체를 포함해야 합니다.

```tsx
import { useNotificationStore } from '../store/notification';

const { addNotification } = useNotificationStore();

addNotification({
  id: `unique-id-${Date.now()}`,           // 고유 ID
  timestamp: new Date().toISOString(),      // ISO 포맷 타임스탬프
  severity: 'error',                        // 'error' | 'success' | 'warning' | 'info'
  category: 'user',                         // 카테고리 (user, system, bridge 등)
  title: '프로필 로드 실패',                // 제목
  message: '프로필 정보를 불러오는데 실패했습니다.', // 메시지
  source: 'profile_page',                   // 소스 (컴포넌트/페이지 이름)
  dismissible: true,                        // ⚠️ 필수: 닫기 버튼 표시 여부
  persistent: false,                        // 영구 표시 여부
  read: false,                              // 읽음 상태
});
```

**중요:** `dismissible: true`를 누락하면 알림을 닫을 수 없습니다.

### 아이콘 사용 표준

lucide-react 라이브러리의 아이콘을 사용합니다.

```tsx
import { Smartphone, Monitor, Tablet, X, LogOut, User, Key } from 'lucide-react';

// 아이콘 크기 표준
<Smartphone className="w-5 h-5" />  // 일반 크기
<X className="w-4 h-4" />            // 버튼 내부 작은 크기
```

**자주 사용하는 아이콘:**
- 디바이스: `Smartphone`, `Monitor`, `Tablet`
- 액션: `X` (닫기), `LogOut` (로그아웃), `Plus` (추가), `Edit` (수정)
- 사용자: `User`, `Users`, `Key` (비밀번호)
- 상태: `Check`, `AlertCircle`, `Info`, `AlertTriangle`

## 참고 페이지

다음 페이지들이 표준 레이아웃을 따릅니다:

**기본 레이아웃:**
- `frontend/src/pages/Messages.tsx` - 목록 + 필터
- `frontend/src/pages/Monitoring.tsx` - 그리드 레이아웃
- `frontend/src/pages/UserManagement.tsx` - 테이블 레이아웃
- `frontend/src/pages/AuditLogs.tsx` - 테이블 레이아웃

**Card 기반 패턴:**
- `frontend/src/pages/Profile.tsx` - Tab 기반 다중 섹션 (Card + Tabs)
- `frontend/src/pages/PasswordChange.tsx` - Card 기반 단일 섹션
- `frontend/src/pages/Settings.tsx` - Tab 기반 설정 페이지

**컴포넌트 참고:**
- `frontend/src/components/profile/SessionDeviceList.tsx` - 디바이스 리스트 패턴
- `frontend/src/components/settings/SecurityTab.tsx` - 보안 설정 패턴

## 체크리스트

새 페이지를 만들 때 다음을 확인하세요:

### 기본 레이아웃
- [ ] Fragment (`<>`) 사용
- [ ] ContentHeader 컴포넌트 사용
- [ ] page-container + space-y-section-gap 클래스 사용
- [ ] 수동 여백 (mb-*, mt-* 등) 제거
- [ ] Alert를 page-container 내부에 배치
- [ ] Modal을 page-container 내부 마지막에 배치

### Card 기반 페이지 (Profile, PasswordChange 유형)
- [ ] Card + CardBody로 콘텐츠 래핑
- [ ] 섹션 제목은 h3 + `text-lg font-semibold text-content-primary`
- [ ] 섹션 구분은 `border-t border-line pt-6` 사용
- [ ] 내부 간격은 `space-y-6` (Card) 또는 `space-y-4` (TabsContent)

### Tab 기반 페이지 (Settings, Profile 유형)
- [ ] Tabs를 Card + CardBody 내부에 배치
- [ ] `value`와 `onValueChange`로 상태 관리
- [ ] 각 TabsContent는 `space-y-4`로 간격 조정
- [ ] CardHeader 사용하지 않고 TabsContent 내부에 h3 제목

### 리스트 표시 (SessionDeviceList 유형)
- [ ] 각 항목: `p-4 bg-surface-base border border-line rounded-card hover:border-line-hover`
- [ ] lucide-react 아이콘 사용
- [ ] Badge 컴포넌트로 상태 표시
- [ ] Button 컴포넌트로 액션 버튼
- [ ] flex 레이아웃: `flex items-start justify-between gap-4`
- [ ] 반응형 처리: `flex-shrink-0`, `min-w-0`, `truncate`

### 공통 패턴
- [ ] 날짜는 `Intl.DateTimeFormat` 사용
- [ ] Notification은 모든 필수 필드 포함 (`dismissible: true` 필수)
- [ ] 반응형 그리드: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] 일관된 간격: `gap-5` (그리드), `gap-4` (폼), `gap-3` (버튼 그룹)

## 문의

레이아웃 관련 질문이나 불명확한 부분이 있으면 기존 페이지를 참고하거나 개발팀에 문의하세요.
