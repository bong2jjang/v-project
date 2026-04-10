---
id: module-design
title: 메뉴별 상세 설계 및 기술 특성
sidebar_position: 3
tags: [frontend, design, tech-portfolio]
---

# 메뉴별 상세 설계 및 기술 특성

VMS Chat Ops의 사용자 인터페이스 설계, 컴포넌트 아키텍처, 상태 관리 전략을 기능 단위로 상세히 기술합니다.

---

## Frontend Architecture

### 기술 스택 상세

| 계층 | 기술 | 버전 | 역할 |
|------|------|------|------|
| **UI 프레임워크** | React | 18.2.0 | 컴포넌트 기반 선언적 UI |
| **빌드 도구** | Vite | 5.0.11 | ESBuild 기반 고속 빌드, HMR |
| **언어** | TypeScript | 5.3.3 | 정적 타입 안전성 |
| **라우팅** | react-router-dom | 6.21.0 | SPA 클라이언트 라우팅 |
| **서버 상태** | TanStack Query | 5.17.0 | API 응답 캐싱, 자동 갱신 |
| **클라이언트 상태** | Zustand | 4.4.7 | 경량 구독 기반 상태 관리 |
| **HTTP 클라이언트** | Axios | 1.6.5 | 인터셉터, 자동 토큰 갱신 |
| **CSS 프레임워크** | Tailwind CSS | 3.4.1 | 유틸리티 퍼스트 스타일링 |
| **차트** | Recharts | 2.15.4 | SVG 기반 반응형 차트 |
| **아이콘** | Lucide React | 0.309.0 | 트리셰이킹 가능 SVG 아이콘 |
| **폰트** | Pretendard | Variable | 한글 최적화 가변 폰트 |
| **디바이스 FP** | FingerprintJS | 4.2.2 | 브라우저 핑거프린팅 |
| **가이드 투어** | Driver.js | 1.3.1 | 사용자 온보딩 |

### 상태 관리 아키텍처

VMS Chat Ops는 **서버 상태**와 **클라이언트 상태**를 명확히 분리합니다.

```
┌──────────────────────────────────────────────────┐
│                  상태 관리 구조                     │
├──────────────────────────────────────────────────┤
│                                                    │
│  [Server State] TanStack Query                     │
│  ├── API 응답 캐싱 (staleTime 기반)               │
│  ├── 자동 백그라운드 갱신                          │
│  ├── 로딩/에러/성공 상태 자동 관리                 │
│  └── Mutation → Invalidation 패턴                  │
│                                                    │
│  [Client State] Zustand (9 Stores)                 │
│  ├── auth        → 인증 상태, 토큰 관리            │
│  ├── bridge      → 브리지 상태, 제어 명령          │
│  ├── providers   → Provider 목록, 연결 테스트      │
│  ├── routes      → Route 목록, 채널 캐시           │
│  ├── config      → 설정, 백업/복원                 │
│  ├── notification → 알림, 토스트, 필터             │
│  ├── systemSettings → 시스템 설정                  │
│  ├── sessionSettings → 세션 설정 (localStorage)    │
│  └── index       → 중앙 export                     │
│                                                    │
│  [Persistent State] localStorage                   │
│  ├── session-settings (세션 타임아웃 설정)          │
│  ├── theme (다크/라이트 모드)                      │
│  └── jwt tokens                                    │
│                                                    │
│  [Real-time State] WebSocket                       │
│  ├── useRealtimeStatus → 브리지 상태 실시간 수신   │
│  ├── useNotifications → 시스템 알림 실시간 수신    │
│  └── useWebSocket → 범용 WebSocket 관리            │
│                                                    │
└──────────────────────────────────────────────────┘
```

### API 클라이언트 아키텍처

18개 API 모듈이 단일 Axios 인스턴스를 공유합니다.

```typescript
// client.ts — 핵심 기능
const apiClient = axios.create({ baseURL });

// 요청 인터셉터: JWT 토큰 + CSRF 토큰 자동 첨부
apiClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

// 응답 인터셉터: 401 시 토큰 자동 갱신
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 큐잉: 동시 요청 중 한 번만 refresh
      // 실패 시 3회 제한 후 로그아웃
      await refreshToken();
      return apiClient(originalRequest);
    }
  }
);
```

**API 모듈 목록 (14개)**:

| 모듈 | 주요 엔드포인트 | 기능 |
|------|----------------|------|
| `auth.ts` | `/api/auth/*` | 로그인, 회원가입, 토큰 갱신, 디바이스 관리 |
| `bridge.ts` | `/api/bridge/*` | 브리지 상태/제어, Route CRUD |
| `providers.ts` | `/api/providers/*` | Provider CRUD, 연결 테스트, 기능 카탈로그 |
| `routes.ts` | `/api/bridge/routes/*` | Route 관리, 채널 목록 조회 |
| `messages.ts` | `/api/messages/*` | 메시지 조회/검색/삭제/내보내기 |
| `auditLogs.ts` | `/api/audit-logs/*` | 감사 로그 조회/내보내기/통계 |
| `users.ts` | `/api/users/*` | 사용자 관리 (Admin) |
| `monitoring.ts` | `/api/health/*` | 헬스체크, 서비스 상태 |
| `config.ts` | `/api/config/*` | 설정 관리, 백업/복원 |
| `systemSettings.ts` | `/api/system-settings` | 시스템 설정 |
| `types.ts` | — | 공유 TypeScript 인터페이스 |
| `client.ts` | — | Axios 인스턴스, 인터셉터 |

### 디자인 시스템

#### CSS Variable 기반 시맨틱 토큰

Tailwind CSS와 CSS 변수를 결합한 디자인 시스템으로, 다크/라이트 모드와 일관된 UI를 보장합니다.

```css
/* 색상 시스템 */
--color-brand-500        /* 브랜드 메인 컬러 */
--color-status-success   /* 성공 상태 */
--color-status-danger    /* 에러/위험 상태 */
--color-status-warning   /* 경고 상태 */
--color-status-info      /* 정보 상태 */

/* 표면 계층 */
--color-surface-page     /* 페이지 배경 */
--color-surface-card     /* 카드 배경 */
--color-surface-raised   /* 팝업/드롭다운 배경 */
--color-surface-overlay  /* 모달 오버레이 */

/* 텍스트 계층 */
--color-content-primary    /* 기본 텍스트 */
--color-content-secondary  /* 보조 텍스트 */
--color-content-tertiary   /* 약한 텍스트 */
--color-content-link       /* 링크 텍스트 */
```

#### 타이포그래피 스케일

| 토큰 | 크기 | 두께 | 자간 | 용도 |
|------|------|------|------|------|
| `heading-xl` | 1.75rem (28px) | 700 | -0.025em | 페이지 제목 |
| `heading-lg` | 1.375rem (22px) | 600 | — | 섹션 제목 |
| `heading-md` | 1.125rem (18px) | 600 | — | 카드 제목 |
| `body-base` | 0.875rem (14px) | 400 | — | 본문 텍스트 |
| `body-sm` | 0.75rem (12px) | 400 | — | 보조 텍스트 |
| `caption` | 0.6875rem (11px) | 400 | — | 캡션, 라벨 |
| `overline` | 0.625rem (10px) | 600 | 0.1em | 오버라인 텍스트 |

**폰트**: Pretendard Variable (한글) + Inter (영문) + JetBrains Mono (코드)

#### 간격 및 레이아웃 시스템

```
page-x: 1.5rem     page-y: 2rem        ← 페이지 여백
card-x: 1.5rem     card-y: 1rem        ← 카드 내부 패딩
section-gap: 1.5rem                     ← 섹션 간 간격
element-gap: 0.75rem                    ← 요소 간 간격
```

**Border Radius**: card(12px), button/input(8px), badge(pill), modal(16px)

#### UI 컴포넌트 라이브러리 (23개)

| 카테고리 | 컴포넌트 | 비고 |
|----------|----------|------|
| **Form** | Button, Input, Select, Textarea, Toggle, DateRangePicker, MultiSelect | 7개 |
| **Layout** | Card (Header/Title/Body/Footer), Divider, Table, Tabs | 4개 |
| **Data** | Badge, PlatformIcon | 2개 |
| **Feedback** | Alert, InfoBox, EmptyState, Spinner, SpinnerOverlay | 5개 |
| **Overlay** | Modal, Tooltip, InfoTooltip, RestartConfirmDialog | 4개 |

---

## 메뉴별 상세 설계

### 1. Dashboard — 실시간 모니터링 허브

**경로**: `/` (메인 페이지)
**컴포넌트 구조**:

```
Dashboard.tsx
├── ProvidersStatusCard      ← Slack/Teams Provider 연결 상태
│   └── 실시간 상태 표시 (Connected/Disconnected/Error)
│
├── RealtimeMetricsChart     ← 메시지 처리량 시계열 차트
│   └── Recharts 기반 실시간 메트릭
│
├── MessageFlowWidget        ← 라우팅 흐름 시각화
│   └── Source → Target 방향 표시
│
├── RecentActivityStream     ← 최근 활동 로그
│   └── 시간순 이벤트 스트림
│
└── LogViewer               ← 실시간 로그 뷰어
    └── WebSocket 기반 로그 스트리밍
```

**데이터 연동**:
- Provider 상태: `GET /api/bridge/providers` → Zustand bridge store
- 메시지 메트릭: WebSocket 실시간 수신 (`useRealtimeStatus` 훅)
- 활동 로그: `GET /api/bridge/logs` → 최근 N줄

**기술적 특징**:
- WebSocket 기반 실시간 데이터 업데이트
- Recharts 시계열 차트 (자동 시간축 스크롤)
- Provider 상태 변경 시 자동 알림 생성

---

### 2. Routes — Route 관리 (채널 브리지 설정)

**경로**: `/channels`
**컴포넌트 구조**:

```
Channels.tsx
├── InfoBox                  ← 라우팅 설명/도움말
├── RouteList                ← Route 목록 테이블
│   ├── 양방향 Route: ↔ 배지
│   ├── 단방향 Route: → 배지
│   ├── 활성/비활성 토글
│   └── 삭제 버튼
│
├── RouteModal               ← Route 추가/수정 모달
│   ├── Source: 플랫폼 선택 → 채널 드롭다운
│   ├── Target: 플랫폼 선택 → 채널 드롭다운
│   ├── 메시지 모드: sender_info / editable
│   └── 양방향 토글
│
└── ChannelInputField        ← 채널 선택 컴포넌트
    ├── 채널 목록 API 조회 (캐싱)
    └── 검색/필터링
```

**데이터 흐름**:
```
User: Route 추가 버튼 클릭
  → RouteModal 열림
  → 플랫폼 선택 시 GET /api/bridge/channels/{platform}
  → 채널 목록 Zustand routes store에 캐시
  → 소스/타겟 채널 선택
  → POST /api/bridge/routes (양방향 시 자동 역방향 생성)
  → RouteList 자동 갱신
```

**메시지 모드**:

| 모드 | 표시 방식 | 편집 가능 | 사용 시나리오 |
|------|----------|----------|-------------|
| `sender_info` | `[사용자명] 메시지` (아바타 포함) | ❌ | 기본값, 발신자 식별 중요 |
| `editable` | 봇 명의로 전송 | ✅ 수정/삭제 | 메시지 동기화 정확성 중요 |

---

### 3. Messages — 메시지 이력 조회

**경로**: `/messages`
**파일 크기**: 28.5KB (가장 큰 페이지)
**컴포넌트 구조**:

```
Messages.tsx
├── SearchBar                ← 전문 검색 (Full-text search)
│   └── 실시간 검색어 입력 → 디바운싱
│
├── FiltersPanel             ← 고급 필터
│   ├── DateRangePicker      ← 날짜 범위
│   ├── 게이트웨이 필터      ← slack→teams 등
│   ├── 채널 필터            ← 소스/대상 채널
│   ├── 사용자 필터          ← 발신자
│   └── 상태 필터            ← pending/sent/failed/retrying
│
├── MessageCard (반복)       ← 메시지 카드
│   ├── 발신자 정보 (이름, 플랫폼 아이콘)
│   ├── 메시지 텍스트
│   ├── 첨부파일 정보
│   ├── 라우팅 경로 (slack:general → teams:General)
│   ├── 전송 상태 배지
│   └── 타임스탬프
│
├── Pagination               ← 페이지네이션
│   └── per_page: 20 (기본값)
│
├── DeleteMessagesModal      ← 배치 삭제 (Admin)
│   ├── 필터 기반 삭제
│   └── 전체 삭제
│
└── Export (CSV/JSON)        ← 데이터 내보내기
    ├── POST /api/messages/export/csv
    └── POST /api/messages/export/json
```

**검색 파라미터**:

```typescript
interface MessageSearchParams {
  search?: string;           // 전문 검색
  page: number;              // 페이지 번호
  per_page: number;          // 페이지당 개수 (기본 20)
  gateway?: string;          // 라우팅 경로
  source_channel?: string;   // 소스 채널
  destination_channel?: string; // 대상 채널
  source_user?: string;      // 발신자
  status?: string;           // 전송 상태
  start_date?: string;       // 시작일
  end_date?: string;         // 종료일
}
```

---

### 4. Statistics — 메시지 통계 분석

**경로**: `/statistics`
**파일 크기**: 25.4KB
**컴포넌트 구조**:

```
Statistics.tsx
├── MessageTrendChart        ← 메시지 추이 (시계열)
│   └── Recharts AreaChart — 일별/시간별 메시지 수
│
├── PlatformDirectionChart   ← 플랫폼 방향별 통계
│   └── Recharts BarChart — slack→teams vs teams→slack
│
├── ChannelDistributionChart ← 채널별 분포
│   └── Recharts PieChart — 채널별 메시지 비율
│
├── DeliveryStatusChart      ← 전송 상태 분석
│   └── Recharts BarChart — sent/failed/retrying 비율
│
└── HourlyDistributionChart  ← 시간대별 패턴
    └── Recharts BarChart — 0~23시 메시지 밀도
```

**데이터 소스**:
- `GET /api/messages/stats/summary` → 일별 집계 (MessageStats 테이블)
- 게이트웨이별, 채널별, 시간대별 JSON 통계

---

### 5. Settings — Provider 계정 관리 & 시스템 설정

**경로**: `/settings`
**파일 크기**: 16.8KB
**탭 구성**:

```
Settings.tsx (Tabs 기반)
├── [Tab] Provider 관리
│   ├── ProviderList          ← 등록된 Provider 목록
│   │   └── ProviderCard      ← 개별 Provider 카드
│   │       ├── 플랫폼 아이콘 + 이름
│   │       ├── 연결 상태 (Valid/Invalid)
│   │       ├── 활성화 토글
│   │       └── 편집/삭제/테스트 버튼
│   │
│   ├── ProviderModal         ← Provider 추가/수정 모달
│   │   ├── Slack: Bot Token (xoxb-), App Token (xapp-)
│   │   ├── Teams: Tenant ID, App ID, App Password, Team ID
│   │   └── 기능 선택 (FeatureSelector)
│   │
│   └── FeaturePermissionMatrix ← 권한 매트릭스
│       ├── 기능별 Slack/Teams 지원 상태
│       └── granted/missing/partial/unknown 상태 표시
│
├── [Tab] 일반 설정
│   └── ConfigEditor          ← JSON 설정 편집기
│
├── [Tab] 알림 설정
│   └── NotificationSettings  ← 알림 수준/카테고리 설정
│
├── [Tab] 세션 설정
│   └── SessionSettings       ← 타임아웃, 자동 연장, 유휴 감지
│
├── [Tab] 보안 설정
│   └── SecurityTab           ← 보안 관련 설정
│
├── [Tab] 테마 설정
│   └── ThemeSettings         ← 다크/라이트 모드
│
├── [Tab] 시스템 설정 (Admin)
│   └── SystemSettingsTab     ← 매뉴얼 URL, 지원 이메일
│
└── [Tab] 백업/복원
    ├── BackupList            ← 백업 이력
    └── BackupContentModal    ← 백업 내용 미리보기/복원
```

**Provider 연결 테스트 흐름**:

```
User: "테스트" 버튼 클릭
  → POST /api/providers/{id}/test
  → Backend: Provider.connect() → Provider.get_channels() 시도
  → 결과: { success: boolean, message: string, details: {...} }
  → UI: ConnectionTestResponse 결과 표시
```

---

### 6. 사용자 관리 (Admin)

**경로**: `/users`
**파일 크기**: 21.9KB
**접근 제한**: Admin 역할 필요

**기능**:
- 사용자 목록 조회 (페이지네이션, 검색)
- 사용자 생성/수정/삭제
- 역할 변경 (Admin ↔ User)
- 계정 활성화/비활성화

---

### 7. Audit Logs (Admin) — 감사 로그

**경로**: `/audit-logs`
**파일 크기**: 28.5KB
**접근 제한**: Admin 역할 필요

**컴포넌트 구조**:

```
AuditLogs.tsx
├── 필터 패널
│   ├── 액션 타입 (27개 타입 중 선택)
│   ├── 사용자 이메일
│   ├── 리소스 타입
│   ├── 상태 (success/failure/error)
│   ├── 날짜 범위
│   └── IP 주소
│
├── 감사 로그 테이블
│   ├── 타임스탬프
│   ├── 사용자 이메일
│   ├── 액션 (색상 코딩)
│   ├── 리소스 타입/ID
│   ├── 상태 배지
│   └── 상세 보기 (JSON 펼치기)
│
├── 통계 요약
│   └── GET /api/audit-logs/stats/summary
│
└── CSV 내보내기
    └── GET /api/audit-logs/export/csv
```

**27개 감사 액션 타입**:

| 카테고리 | 액션 |
|----------|------|
| **사용자** | LOGIN, LOGOUT, REGISTER, UPDATE, DELETE, ROLE_CHANGE, PASSWORD_CHANGE, PASSWORD_RESET_REQUEST, PASSWORD_RESET |
| **브리지** | START, STOP, RESTART, ROUTE_ADD, ROUTE_REMOVE |
| **설정** | READ, UPDATE, BACKUP, RESTORE |
| **채널** | CREATE, UPDATE, DELETE |

---

### 8. Monitoring (Admin) — 서비스 모니터링

**경로**: `/monitoring`
**파일 크기**: 11.9KB

```
Monitoring.tsx
├── MonitoringServiceCard (반복)
│   ├── 서비스명 + 상태 배지
│   ├── StatusBadge (healthy/unhealthy/unknown)
│   ├── 응답 시간
│   └── 마지막 확인 시각
│
└── 서비스 목록
    ├── Backend API    (curl /api/health)
    ├── PostgreSQL     (pg_isready)
    ├── Redis          (redis-cli ping)
    ├── Prometheus     (/-/healthy)
    ├── Grafana        (/api/health)
    └── Loki           (/ready)
```

---

## UI/UX 통합 설계

### 서비스 단위 통합 (Service Unit) 과정

VMS Chat Ops는 원래 분리된 여러 도구(CLI, 설정 파일, 별도 모니터링)를 **단일 웹 플랫폼**으로 통합한 프로젝트입니다. 현재는 v-channel-bridge 네이티브 아키텍처로 전환 완료되었습니다.

| 기존 (개별 도구) | 통합 후 (VMS Chat Ops) |
|-----------------|----------------------|
| 외부 브리지 CLI | Dashboard + Bridge 제어 API |
| TOML 설정 파일 편집 | Routes 페이지 UI |
| 별도 Slack Admin | Settings > Provider 관리 |
| 별도 Azure Portal | Settings > Teams Provider |
| SQLite 직접 조회 | Messages 페이지 |
| 서버 로그 SSH 접속 | Dashboard > LogViewer |
| Grafana 별도 접속 | Monitoring 페이지 + Grafana 연동 |

### 재사용성 확보

#### 컴포넌트 재사용 계층

```
┌──────────────────────────────────────┐
│ Layer 3: Feature Components          │  페이지 단위 조합
│ (RouteList, ProviderCard, etc.)      │
├──────────────────────────────────────┤
│ Layer 2: Composition Components      │  복합 UI 패턴
│ (ChannelInputField, SearchBar,       │
│  FiltersPanel, StatusBadge)          │
├──────────────────────────────────────┤
│ Layer 1: UI Primitives (23개)        │  기본 빌딩 블록
│ (Button, Input, Card, Modal,         │
│  Badge, Table, Tabs, Alert)          │
└──────────────────────────────────────┘
```

#### 커스텀 훅 재사용 (15개)

| 훅 | 재사용 범위 | 기능 |
|---|---|---|
| `useTheme` | 전역 | 다크/라이트 모드 토글 |
| `useTokenExpiry` | 인증 컴포넌트 | 토큰 만료 카운트다운 |
| `useRealtimeStatus` | Dashboard | WebSocket 실시간 상태 |
| `useNotifications` | 전역 (TopBar) | 실시간 알림 수신 |
| `useWebSocket` | 다목적 | 범용 WebSocket 관리 |
| `useIdleTimeout` | 전역 | 유휴 감지 → 세션 경고 |
| `useActivityDetection` | 전역 | 마우스/키보드 활동 추적 |
| `useKeyboardShortcuts` | 전역 | 단축키 바인딩 |
| `useSidebar` | Layout | 사이드바 접기/펼치기 |
| `useTabSync` | 전역 | 멀티 탭 간 상태 동기화 |
| `useBrowserNotification` | 전역 | 네이티브 브라우저 알림 |
| `useApiErrorHandler` | API 호출 | 에러 추상화 |
| `useMessageStats` | Statistics | 통계 데이터 조회 |
| `useMonitoringHealth` | Monitoring | 헬스체크 폴링 |

### 페이지 레이아웃 패턴

모든 페이지는 일관된 레이아웃 패턴을 따릅니다:

```tsx
// 표준 페이지 구조
export default function PageName() {
  return (
    <>
      <ContentHeader
        title="페이지 제목"
        description="페이지 설명"
      />
      <div className="page-container">
        <div className="space-y-section-gap">
          {/* 페이지 콘텐츠 */}
        </div>
      </div>
    </>
  );
}
```

### 라우팅 구조

```
/ (App.tsx)
├── Public Routes (인증 불필요)
│   ├── /login
│   ├── /register
│   ├── /forgot-password
│   ├── /reset-password
│   ├── /sso/callback        (SSO 콜백 처리)
│   └── /forbidden (403)
│
├── Protected Routes (로그인 필요)
│   ├── / (Dashboard)
│   ├── /channels (Routes)
│   ├── /messages
│   ├── /statistics
│   ├── /integrations         (OAuth 연동 관리)
│   ├── /settings
│   ├── /help
│   ├── /profile
│   ├── /password-change
│   └── /custom-iframe/:id    (커스텀 iframe 페이지)
│
└── Admin Routes (관리자 역할 필요)
    ├── /admin/users           (사용자 관리)
    ├── /admin/permissions     (권한 관리)
    ├── /admin/organizations   (조직 관리)
    ├── /audit-logs
    └── /monitoring
```

**접근 제어 구현**:
- `ProtectedRoute`: `isAuthenticated` 확인 → 미인증 시 `/login` 리다이렉트
- `RoleBasedRoute`: `requiredRole` 확인 → 권한 부족 시 `/forbidden` 리다이렉트
- **서버 기반 메뉴 필터링**: `/api/menus/sidebar`에서 RBAC 기반으로 메뉴 목록 반환

---

## 컴포넌트 디렉토리 구조

```
src/components/
├── auth/          (1) TokenExpiryManager
├── channels/      (6) RouteList, RouteModal, ChannelInputField, ...
├── common/        (2) ConnectionStatus, StatusDetailPopup
├── dashboard/     (6) LogViewer, MessageFlowWidget, ProvidersStatusCard, RecentActivityStream, ...
├── layout/        (7) Layout, Sidebar, TopBar, ContentHeader, UserMenu, ...
├── messages/      (5) MessageCard, SearchBar, FiltersPanel, Pagination, ...
├── monitoring/    (2) MonitoringServiceCard, StatusBadge
├── notifications/ (5) NotificationBell, NotificationPopover, Toast, ...
├── oauth/         (2) AdminOAuthOverview, UserOAuthList
├── profile/       (2) PasswordChangeForm, SessionDeviceList
├── providers/     (4) ProviderList, ProviderCard, ProviderModal, ...
├── settings/      (7) ConfigEditor, BackupList, SecurityTab, ...
├── statistics/    (5) MessageTrendChart, ChannelDistributionChart, ...
├── tour/          (1) TourProvider
└── ui/            (25+) Button, Card, Modal, Table, Badge, ...

총 컴포넌트: ~85개
```

---

**최종 업데이트**: 2026-04-10
**문서 버전**: 1.1
