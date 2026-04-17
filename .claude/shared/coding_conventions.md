# v-project 공통 코딩 컨벤션

모든 앱과 플랫폼에 공통으로 적용되는 코딩 표준입니다. 앱 고유 규칙은 각 앱의 `.claude/CONVENTIONS.md`를 참조하세요.

## Python 백엔드 (FastAPI)

### 타입 힌트

- Python 3.9+ 빌트인 제네릭 타입 사용: `list[str]`, `dict[str, Any]`
- `typing.Dict`, `typing.List` 등 레거시 타입 **사용 금지**
- `Optional[X]`와 `Union[X, Y]`는 `typing` 모듈에서 임포트하여 사용 (3.10+ `X | Y` 문법은 사용하지 않음)
- 모든 함수에 파라미터 및 반환 타입 어노테이션 필수

```python
# ✅ 올바른 사용
from typing import Any, Optional

def get_channels() -> list[dict[str, Any]]:
    return []

def find_channel(channel_id: str) -> Optional[dict[str, Any]]:
    return None

# ❌ 잘못된 사용
from typing import Dict, List
def get_channels() -> List[Dict[str, Any]]:  # 사용 금지
    return []
```

### 데이터 구조

- **API 요청/응답 스키마**: `app/schemas/` 폴더에 Pydantic BaseModel 정의
- **DB 모델**: `app/models/` 폴더에 SQLAlchemy 모델 정의
- **내부 데이터 구조**: dataclass 사용
- 딕셔너리 직접 사용 최소화

```python
# app/schemas/user.py — API 스키마
from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

# app/models/user.py — DB 모델
from sqlalchemy import Column, Integer, String
from app.db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
```

### 임포트 구성

- 최상위 레벨 임포트 우선
- 표준 라이브러리 → 서드파티 → 로컬 모듈 순서
- `TYPE_CHECKING`, 순환 참조 해결, 지연 로딩이 필요한 경우에만 함수 내부 임포트

```python
# ✅ 올바른 임포트 순서
import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.channel_service import ChannelService
from app.db import get_db
```

### 예외 처리

- 예외를 제어 흐름으로 사용하지 않음
- 조건을 먼저 확인하고 예외는 진정한 오류 상황에서만 사용
- 적절한 예외 타입과 HTTP 상태 코드 사용

### 인증 패턴

- JWT 토큰 기반 인증 (`python-jose`)
- 비밀번호 해싱: `bcrypt`
- 인증이 필요한 엔드포인트: `Depends(get_current_user)` 사용
- 역할 기반 접근 제어: `admin`, `user`

```python
# ✅ 인증이 필요한 엔드포인트
@router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"user": current_user.username}
```

### 서비스 아키텍처

- 싱글톤 패턴 사용 금지
- FastAPI의 Dependency Injection 활용
- 비즈니스 로직은 `app/services/` 레이어에 분리
- API 엔드포인트는 `app/api/`에, 스키마는 `app/schemas/`에

## TypeScript 프론트엔드 (React)

### 타입 정의

- 모든 컴포넌트 props에 `interface` 정의 필수
- API 응답에 대한 명시적 타입 정의
- `any` 타입 사용 최소화
- 유니온 타입 적극 활용

```typescript
interface ChannelMapping {
  id: string;
  slackChannel: string;
  teamsChannel: string;
  enabled: boolean;
}

type MessageStatus = 'pending' | 'sent' | 'failed';
type ApiResponse<T> = { data: T; error?: string };
```

### 컴포넌트 패턴

- 함수형 컴포넌트만 사용
- Props 타입은 컴포넌트 바로 위에 정의
- 로직 분리를 위해 커스텀 훅 활용

### 상태 관리

- 서버 상태: TanStack Query (`@tanstack/react-query`)
- 클라이언트 상태: Zustand (6 stores: auth, permission, notification, systemSettings, sessionSettings, user-oauth)
- 로컬 상태: useState/useReducer
- 테마 상태: `useTheme` 훅 (ThemeContext)
- 불필요한 전역 상태 최소화

### 스타일링 — 디자인 시스템 토큰

**반드시 시맨틱 토큰을 사용합니다. 하드코딩 색상은 금지입니다.**

```tsx
// ✅ 시맨틱 토큰 사용
<div className="bg-surface-card text-content-primary border-line">
<button className="bg-brand-600 text-content-inverse">
<p className="text-content-secondary">

// ❌ 하드코딩 색상 금지
<div className="bg-white text-gray-900 border-gray-200">
<button className="bg-blue-600 text-white">
<p className="text-gray-500">
```

**토큰 카테고리**:
- `surface-*`: 배경 (page, card, raised)
- `content-*`: 텍스트 (primary, secondary, tertiary, inverse)
- `line-*`: 보더 (DEFAULT, light, heavy)
- `brand-*`: 브랜드 액센트 (50~900)
- `status-*`: 상태 (success, danger, warning, info + light/border 변형)

**유틸리티 클래스**:
- `page-container`: 페이지 콘텐츠 래퍼
- `card-base`: 카드 기본 스타일
- `focus-ring`: 포커스 표시
- `text-truncate`: 말줄임

**타이포그래피 토큰**:
- `text-heading-xl/lg/md/sm`: 제목
- `text-body-base/sm`: 본문
- `text-caption`: 캡션

자세한 규칙은 `docs/DESIGN_SYSTEM.md` 참조

### 페이지 구조 패턴

모든 페이지는 이 패턴을 따릅니다:

```tsx
import { ContentHeader } from "../components/Layout";

const MyPage = () => (
  <>
    <ContentHeader title="페이지 제목" description="설명" actions={...} />
    <div className="page-container">
      <div className="space-y-section-gap">
        {/* 콘텐츠 */}
      </div>
    </div>
  </>
);
```

**금지 사항**:
- 페이지에 `min-h-screen` 사용 금지 (Layout이 관리)
- 페이지에 자체 `<header>`, `<footer>` 금지 (Layout이 관리)

### 스켈레톤 로딩 패턴 (필수)

비동기 데이터를 불러오는 모든 페이지는 Skeleton 로딩 상태를 구현해야 합니다:

```tsx
import { ContentHeader } from "../components/Layout";
import { SkeletonCard } from "@v-platform/core/components";

// 로딩 상태 - 스켈레톤 패턴 (필수)
function LoadingSkeleton() {
  return (
    <div className="space-y-section-gap">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default function MyPage() {
  const [loading, setLoading] = useState(true);

  if (loading) return <><ContentHeader title="..." /><div className="page-container"><LoadingSkeleton /></div></>;

  return (
    <>
      <ContentHeader title="페이지 제목" description="설명" />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 콘텐츠 */}
        </div>
      </div>
    </>
  );
}
```

**스켈레톤 규칙**:
- 비동기 데이터 페이지에 Skeleton 로딩은 **필수**
- `ContentHeader`는 로딩/완료 양쪽 모두 렌더링
- `page-container`로 감싸서 레이아웃 일관성 유지
- `space-y-section-gap`으로 섹션 간격 유지

## 공통 규칙

### 파일 명명

- Python: `snake_case.py`
- TypeScript 컴포넌트: `PascalCase.tsx`
- TypeScript 유틸리티/훅: `camelCase.ts`
- 테스트: `*.test.ts(x)` 또는 `test_*.py`

### 라인 길이

- Python: 100자 제한 (Ruff 설정)
- TypeScript: Prettier 기본 설정 (80자)

### 문서화

- 공개 API 함수에 docstring/JSDoc 필수
- 복잡한 비즈니스 로직에 인라인 주석
- 자명한 코드에는 불필요한 주석 금지

### UI 텍스트 규칙

- 버튼/라벨 (1~2단어): 영어 유지 (`Start`, `Stop`, `Edit`, `Delete`, `Search`)
- 설명 문장, 에러 메시지, 도움말: 한국어
- 상태 표시: 영어 대문자 (`RUNNING`, `STOPPED`, `OFFLINE`)
