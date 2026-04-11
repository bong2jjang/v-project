# 알림 및 메시징 시스템 설계

> **작성일**: 2026-04-11  
> **상태**: 설계 검토 대기  
> **목적**: 플랫폼 레벨 알림/토스트 시스템을 멀티앱 환경에 맞게 확장 — 앱별 알림, 전역 공지, 역할 기반 선택 전송

---

## 1. 현재 상태

### 1.1 이미 플랫폼에 있는 것

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| `notification.ts` (store) | `@v-platform/core/stores/` | 알림/토스트 상태 관리 (Zustand) |
| `Toast.tsx` | `@v-platform/core/components/notifications/` | 토스트 메시지 UI |
| `ToastContainer.tsx` | `@v-platform/core/components/notifications/` | 토스트 컨테이너 |
| `NotificationBell.tsx` | `@v-platform/core/components/notifications/` | 알림 벨 아이콘 + 뱃지 |
| `NotificationPopover.tsx` | `@v-platform/core/components/notifications/` | 알림 목록 팝오버 |
| `useNotifications.ts` | `@v-platform/core/hooks/` | WebSocket 알림 수신 훅 |
| `useBrowserNotification.ts` | `@v-platform/core/hooks/` | 데스크톱 알림 |

**앱별 구현 불필요** — 모든 앱이 `@v-platform/core`에서 import하여 사용.

### 1.2 현재 알림 타입

```typescript
// 심각도
type NotificationSeverity = "critical" | "error" | "warning" | "info" | "success";

// 카테고리
type NotificationCategory = "service" | "message" | "config" | "user" | "system" | "session";

// 역할 필터 (기존)
requiredRole?: "admin" | "user";
```

### 1.3 현재 한계

| 문제 | 설명 |
|------|------|
| **앱 구분 없음** | 모든 알림이 앱 구분 없이 표시 |
| **전역 전송 불가** | 앱 간 공지/알림 전송 메커니즘 없음 |
| **역할 기반 선택 전송 불가** | `requiredRole`이 있지만 프론트엔드 필터링만 (백엔드 미지원) |
| **백엔드 알림 API 없음** | 알림 생성/조회/관리 API 없음 (프론트엔드 메모리만) |
| **영속성 없음** | 새로고침하면 알림 사라짐 |

---

## 2. 목표 아키텍처

### 2.1 알림 범위 (Scope)

```
┌──────────────────────────────────────────────────┐
│                 알림 범위 (Scope)                   │
│                                                    │
│  ┌─────────────┐                                  │
│  │   GLOBAL     │  전역 알림 — 모든 앱에 표시       │
│  │   (전역)     │  예: 시스템 점검, 긴급 공지        │
│  └──────┬──────┘                                  │
│         │                                          │
│  ┌──────┴──────┐  ┌──────────────┐                │
│  │  APP         │  │  APP          │               │
│  │  (앱별)     │  │  (앱별)      │               │
│  │ v-channel-  │  │ v-platform-  │  ...           │
│  │ bridge      │  │ template     │               │
│  └──────┬──────┘  └──────┬───────┘               │
│         │                 │                        │
│  ┌──────┴──────┐  ┌──────┴───────┐               │
│  │  USER        │  │  ROLE         │               │
│  │  (개인)     │  │  (역할별)    │               │
│  │ 특정 사용자  │  │ admin만      │               │
│  └─────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────┘
```

### 2.2 알림 분류

| Scope | 대상 | 예시 | 저장 |
|-------|------|------|------|
| **GLOBAL** | 전 앱 전 사용자 | 시스템 점검 공지, 긴급 알림 | DB |
| **APP** | 특정 앱 사용자 | 브리지 연결 끊김, 설정 변경 | DB |
| **ROLE** | 특정 역할 사용자 | 관리자 승인 요청, 보안 경고 | DB |
| **USER** | 특정 사용자 | 비밀번호 만료 경고, 세션 만료 | DB |
| **TOAST** | 현재 사용자 즉시 | 저장 성공, 에러 발생 | 메모리 (기존) |

---

## 3. 설계 상세

### 3.1 DB 스키마 (신규)

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    -- 알림 내용
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',   -- critical/error/warning/info/success
    category VARCHAR(50) NOT NULL DEFAULT 'system',  -- service/message/config/user/system/session
    
    -- 범위 (Scope)
    scope VARCHAR(20) NOT NULL DEFAULT 'app',        -- global/app/role/user
    app_id VARCHAR(50),                              -- NULL=global, value=특정 앱
    target_role VARCHAR(50),                         -- NULL=모든 역할, 'system_admin'=관리자만
    target_user_id INTEGER REFERENCES users(id),     -- NULL=모든 사용자, value=특정 사용자
    
    -- 메타데이터
    source VARCHAR(100),                             -- 발생 출처 (api, system, admin)
    link VARCHAR(500),                               -- 클릭 시 이동 URL
    metadata JSONB,                                  -- 추가 데이터
    
    -- 상태
    is_active BOOLEAN DEFAULT TRUE,                  -- 비활성화 가능
    expires_at TIMESTAMP WITH TIME ZONE,             -- 만료 시간 (선택)
    
    -- 발신자
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_notifications_scope (scope, app_id),
    INDEX idx_notifications_active (is_active, created_at DESC)
);

CREATE TABLE notification_reads (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (notification_id, user_id)
);
```

### 3.2 알림 API (신규)

```
# 알림 조회 (현재 앱 + 전역 + 본인 대상)
GET /api/notifications
  → scope=global OR (scope=app AND app_id=current) OR (scope=role AND target_role=my_role) OR (scope=user AND target_user_id=me)

# 알림 읽음 처리
POST /api/notifications/{id}/read

# 전체 읽음
POST /api/notifications/read-all

# 알림 생성 (관리자)
POST /api/notifications
  body: { title, message, severity, scope, app_id?, target_role?, target_user_id? }

# 알림 삭제 (관리자)
DELETE /api/notifications/{id}
```

### 3.3 알림 전송 패턴

#### 패턴 A: 토스트 (즉시, 메모리)
```typescript
// 기존과 동일 — 현재 사용자에게 즉시 표시, DB 저장 안 함
addToast({
  severity: "success",
  title: "저장 완료",
  message: "설정이 저장되었습니다.",
});
```

#### 패턴 B: 앱 알림 (영속, DB)
```python
# Backend에서 앱 사용자 전체에게 알림
NotificationService.create(
    title="브리지 연결 끊김",
    message="Slack Provider 연결이 끊어졌습니다.",
    severity="warning",
    scope="app",
    app_id="v-channel-bridge",
)
```

#### 패턴 C: 전역 공지 (영속, 전 앱)
```python
# Backend에서 모든 앱 모든 사용자에게 공지
NotificationService.create(
    title="시스템 점검 예정",
    message="2026-04-15 02:00~04:00 서비스 점검이 예정되어 있습니다.",
    severity="info",
    scope="global",
    expires_at=datetime(2026, 4, 15, 4, 0),
)
```

#### 패턴 D: 역할 기반 선택 전송
```python
# 관리자에게만 전송
NotificationService.create(
    title="새 사용자 승인 요청",
    message="신규 사용자 john@example.com 가입 승인 대기 중입니다.",
    severity="info",
    scope="role",
    target_role="system_admin",
)
```

#### 패턴 E: 특정 사용자 전송
```python
# 특정 사용자에게만 전송
NotificationService.create(
    title="비밀번호 변경 권장",
    message="90일 이상 비밀번호를 변경하지 않았습니다.",
    severity="warning",
    scope="user",
    target_user_id=user.id,
)
```

### 3.4 실시간 전달 (WebSocket)

```
1. Backend: 알림 생성 → DB 저장
2. Backend: WebSocket으로 대상 클라이언트에 push
3. Frontend: useNotifications 훅이 WebSocket 메시지 수신
4. Frontend: notification store에 추가 → 벨 뱃지 + 토스트
```

### 3.5 프론트엔드 알림 UI 개선

```
┌─────────────────────────────────┐
│ 🔔 알림 (3)                      │
├─────────────────────────────────┤
│ 🌐 [전역] 시스템 점검 예정       │  ← scope=global
│    2026-04-15 02:00~04:00       │
│                          2분 전  │
├─────────────────────────────────┤
│ ⚠️ [v-channel-bridge]           │  ← scope=app
│    Slack Provider 연결 끊김      │
│                          5분 전  │
├─────────────────────────────────┤
│ 🔒 [관리자] 새 사용자 승인 요청   │  ← scope=role
│    john@example.com 가입 대기    │
│                         10분 전  │
└─────────────────────────────────┘
```

### 3.6 관리자 알림 관리 페이지

```
┌──────────────────────────────────────────┐
│ 📢 알림 관리 (관리자)                      │
├──────────────────────────────────────────┤
│ [+ 새 알림 보내기]                        │
│                                          │
│ 범위: ○ 전역  ○ 이 앱  ○ 역할별  ○ 사용자  │
│ 역할: [system_admin ▾]                   │
│ 심각도: [info ▾]                         │
│ 제목: [________________________]         │
│ 내용: [________________________]         │
│ 만료: [2026-04-15 04:00      ]           │
│                                          │
│                        [취소] [전송]      │
├──────────────────────────────────────────┤
│ 기존 알림 목록                            │
│ ┌─────────┬────────┬────────┬──────┐     │
│ │ 시간     │ 범위    │ 제목    │ 상태 │     │
│ ├─────────┼────────┼────────┼──────┤     │
│ │ 10분 전  │ 전역    │ 점검공지 │ 활성 │     │
│ │ 1시간 전 │ 관리자  │ 승인요청 │ 읽음 │     │
│ └─────────┴────────┴────────┴──────┘     │
└──────────────────────────────────────────┘
```

---

## 4. 구현 계획

### Phase N1: 백엔드 알림 서비스 (1주)

| # | 작업 | 설명 |
|---|------|------|
| 1 | `notifications` 테이블 생성 (마이그레이션) | scope, app_id, target_role, target_user_id |
| 2 | `notification_reads` 테이블 생성 | 읽음 처리 추적 |
| 3 | `NotificationService` 구현 | create, list, mark_read, delete |
| 4 | 알림 API 엔드포인트 구현 | GET/POST/DELETE /api/notifications |
| 5 | scope 기반 필터링 로직 | global + app + role + user 조합 조회 |

### Phase N2: 프론트엔드 연동 (1주)

| # | 작업 | 설명 |
|---|------|------|
| 6 | notification store 확장 | DB 알림 + 메모리 토스트 통합 |
| 7 | 알림 API 클라이언트 | fetchNotifications, markRead, createNotification |
| 8 | NotificationBell 개선 | scope 뱃지, 미읽음 카운트 |
| 9 | NotificationPopover 개선 | scope 표시, 읽음 처리, 무한 스크롤 |
| 10 | WebSocket 연동 | 실시간 알림 push 수신 |

### Phase N3: 관리자 UI + 자동 알림 (1주)

| # | 작업 | 설명 |
|---|------|------|
| 11 | 알림 관리 페이지 | 전송 폼 + 기존 알림 목록 |
| 12 | 자동 알림 훅 | 비밀번호 만료, Provider 끊김 등 자동 생성 |
| 13 | 만료 알림 자동 정리 | 스케줄러 또는 조회 시 필터 |
| 14 | 알림 설정 (사용자) | 카테고리별 수신 on/off |

---

## 5. 기존 토스트와의 관계

| 구분 | 토스트 (기존) | 알림 (신규) |
|------|-------------|-----------|
| **저장** | 메모리 (새로고침 시 사라짐) | DB (영속) |
| **대상** | 현재 사용자만 | 범위별 (전역/앱/역할/사용자) |
| **표시** | 화면 하단 자동 사라짐 | 벨 아이콘 + 팝오버 목록 |
| **생성** | 프론트엔드 직접 | 백엔드 API |
| **용도** | 즉시 피드백 (저장 성공 등) | 공지, 경고, 승인 요청 등 |

**공존**: 토스트는 즉시 피드백용으로 유지, 알림은 영속적 중요 메시지용으로 추가.

---

## 6. 기대 효과

| Before | After |
|--------|-------|
| 앱 내 메모리 알림만 | 전역/앱/역할/사용자별 영속 알림 |
| 새로고침 시 사라짐 | DB 저장, 읽음 추적 |
| 관리자가 공지 불가 | 관리자 알림 관리 페이지 |
| WebSocket 로컬 이벤트만 | WebSocket으로 실시간 push |
| 역할 필터 프론트엔드만 | 백엔드 scope 기반 필터링 |
