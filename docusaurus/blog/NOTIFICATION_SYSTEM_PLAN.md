---
slug: notification-system-plan
title: 통합 알림 시스템 설계 계획안
sidebar_position: 99
draft: true
---

# 통합 알림 시스템 설계 계획안

**작성일**: 2026-03-23
**상태**: 제안
**담당**: Frontend & Backend Integration

---

## 1. 개요

### 1.1 목표

현재 각 페이지에 분산되어 있는 상태/오류 정보를 VS Code와 유사한 UX로 통합하여, Footer의 벨 아이콘을 통해 한 곳에서 확인할 수 있는 알림 시스템을 구축합니다.

### 1.2 핵심 기능

- **통합 알림 센터**: Footer 우측 벨 아이콘을 통한 알림 목록 확인
- **실시간 알림**: WebSocket을 통한 백엔드 이벤트 수신
- **토스트 알림**: 중요한 이벤트를 화면에 즉시 표시
- **알림 우선순위**: Critical, Warning, Info, Success 등급 구분
- **알림 이력**: 최근 알림 보관 및 읽음 처리
- **필터링**: 알림 유형별 필터링

---

## 2. 현재 상태 분석

### 2.1 현재 알림/상태 표시 방식

각 페이지에서 개별적으로 상태를 표시:

| 페이지 | 표시 위치 | 내용 |
|--------|----------|------|
| **Dashboard** | StatusCard | 서비스 상태 (Running/Stopped/Error) |
| **Dashboard** | ServiceControl | 제어 작업 결과 |
| **Dashboard** | RecentLogs | 최근 로그 (에러 포함) |
| **Messages** | Alert | 메시지 동기화 오류 |
| **Channels** | Alert | 채널 설정 저장 오류 |
| **Settings** | Alert | 설정 저장 성공/실패 |
| **UserManagement** | Alert | 사용자 작업 결과 |

### 2.2 문제점

1. **분산된 정보**: 사용자가 각 페이지를 방문해야 상태 확인 가능
2. **놓치기 쉬움**: 다른 페이지에서 발생한 오류를 인지하기 어려움
3. **일관성 부족**: 페이지마다 다른 방식으로 알림 표시
4. **이력 없음**: 이전 알림/오류를 다시 확인할 방법 없음
5. **우선순위 없음**: 중요한 알림과 일반 정보를 구분 안 함

### 2.3 기존 인프라

✅ **이미 구현된 기능**:
- **WebSocket 연결**: `backend/app/api/websocket.py`
- **실시간 상태 수신**: `useRealtimeStatus` hook
- **WebSocket Hook**: `useWebSocket` hook
- **상태 관리**: Zustand stores (matterbridge, config, auth)

---

## 3. 제안하는 아키텍처

### 3.1 시스템 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Footer    │  │ Notification │  │ Toast Stack  │       │
│  │  Bell Icon  │─▶│   Popover    │  │  (Overlay)   │       │
│  │  + Badge    │  │              │  │              │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                   │              │
│         └─────────────────┴───────────────────┘              │
│                           │                                  │
│                  ┌────────▼────────┐                         │
│                  │ Notification    │                         │
│                  │     Store       │                         │
│                  │   (Zustand)     │                         │
│                  └────────┬────────┘                         │
│                           │                                  │
│                  ┌────────▼────────┐                         │
│                  │  WebSocket Hook │                         │
│                  │ (useWebSocket)  │                         │
│                  └────────┬────────┘                         │
└───────────────────────────┼─────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│                        Backend                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  WebSocket   │  │ Notification │  │  Event Bus   │      │
│  │   Manager    │◀─│   Service    │◀─│  (Internal)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ▲                  ▲                   ▲             │
│         │                  │                   │             │
│  ┌──────┴───────┬──────────┴────────┬──────────┴─────┐     │
│  │  Matterbridge│   Config API   │   User API    │     │
│  │   Service    │                    │               │     │
│  └──────────────┴────────────────────┴───────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 흐름

1. **백엔드 이벤트 발생** → Event Bus에 Publish
2. **NotificationService** → 이벤트 수신 및 처리
3. **WebSocket Manager** → 연결된 클라이언트에게 브로드캐스트
4. **Frontend WebSocket** → 알림 수신
5. **Notification Store** → 상태 업데이트
6. **UI 컴포넌트** → 자동 반영 (Bell Icon Badge, Toast)

---

## 4. UI/UX 설계

### 4.1 Footer Bell Icon

**위치**: Footer 우측 끝 (User Menu 왼쪽)

```
┌─────────────────────────────────────────────────────────┐
│ Footer                                                   │
│                                                          │
│  [대시보드] [채널] ... [설정]   🔔(3) 👤 admin ▾      │
└─────────────────────────────────────────────────────────┘
                                      ↑
                                   Badge 표시
                                 (읽지 않은 알림)
```

**상태 표시**:
- **Badge**: 읽지 않은 알림 개수 (최대 99+)
- **아이콘 색상**:
  - Critical 있음: `text-status-error` (빨강)
  - Warning 있음: `text-status-warning` (노랑)
  - Info만: `text-content-secondary` (회색)
  - 알림 없음: `text-content-tertiary` (연한 회색)

### 4.2 Notification Popover

**크기**: 400px × 500px
**위치**: Bell Icon 아래 우측 정렬

```
┌────────────────────────────────────────┐
│ 알림                          [모두읽음] │
├────────────────────────────────────────┤
│ [전체] [에러] [경고] [정보]              │
├────────────────────────────────────────┤
│ ● Service Started                       │
│   Matterbridge가 시작되었습니다.         │
│   방금 전                                │
├────────────────────────────────────────┤
│ ● 채널 동기화 실패                       │
│   #general 채널 메시지 전송 실패         │
│   5분 전                                 │
├────────────────────────────────────────┤
│   설정 저장 완료                         │
│   Gateway 설정이 저장되었습니다.         │
│   10분 전                                │
├────────────────────────────────────────┤
│              [모두 지우기]               │
└────────────────────────────────────────┘
```

**기능**:
- 최근 50개 알림 표시 (무한 스크롤)
- 클릭 시 상세 보기 (필요시 해당 페이지로 이동)
- 읽음/읽지 않음 상태 표시 (●/○)
- 타입별 필터링
- 전체 읽음 처리
- 개별/전체 삭제

### 4.3 Toast Notifications

**위치**: 화면 우측 상단
**크기**: 최대 360px × auto
**표시 시간**:
- Success: 3초
- Info: 5초
- Warning: 7초
- Error: 10초 (또는 수동 닫기)

```
┌────────────────────────────────────┐
│ ✓ 성공                      ✕      │
│ ─────────────────────────────      │
│ 설정이 저장되었습니다.              │
│                                     │
│ [Progress Bar]                     │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ⚠ 경고                      ✕      │
│ ─────────────────────────────      │
│ 메시지 전송이 지연되고 있습니다.    │
│                                     │
│ [자세히 보기]                       │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ✕ 오류                      ✕      │
│ ─────────────────────────────      │
│ Matterbridge 연결 실패              │
│                                     │
│ [재시도] [무시]                     │
└────────────────────────────────────┘
```

**스택 방식**: 최대 3개까지 표시, 초과 시 오래된 것부터 자동 제거

---

## 5. 백엔드 API 설계

### 5.1 WebSocket Events

#### 5.1.1 알림 전송 (Backend → Frontend)

**Event Type**: `notification`

```json
{
  "type": "notification",
  "data": {
    "id": "notif_1234567890",
    "timestamp": "2026-03-23T10:30:00Z",
    "severity": "error",
    "category": "service",
    "title": "Matterbridge 연결 실패",
    "message": "Slack API 연결에 실패했습니다.",
    "source": "matterbridge_service",
    "metadata": {
      "service": "slack",
      "error_code": "AUTH_FAILED",
      "retryable": true
    },
    "actions": [
      {
        "label": "재시도",
        "action": "retry_connection",
        "params": { "service": "slack" }
      }
    ],
    "link": "/settings#editor",
    "dismissible": true,
    "persistent": false
  }
}
```

**필드 설명**:
- `id`: 고유 알림 ID
- `timestamp`: ISO 8601 형식
- `severity`: `critical` | `error` | `warning` | `info` | `success`
- `category`: `service` | `message` | `config` | `user` | `system`
- `title`: 알림 제목 (간단)
- `message`: 알림 본문 (상세)
- `source`: 발생 원천 (로깅용)
- `metadata`: 추가 컨텍스트 데이터
- `actions`: 사용자 액션 버튼 (선택)
- `link`: 관련 페이지 링크 (선택)
- `dismissible`: 사용자 삭제 가능 여부
- `persistent`: 페이지 새로고침 후에도 유지 여부

#### 5.1.2 알림 목록 요청 (Frontend → Backend)

**Event Type**: `get_notifications`

```json
{
  "type": "get_notifications",
  "data": {
    "limit": 50,
    "offset": 0,
    "severity": ["error", "warning"],
    "category": null,
    "unread_only": false
  }
}
```

#### 5.1.3 알림 읽음 처리 (Frontend → Backend)

**Event Type**: `mark_notification_read`

```json
{
  "type": "mark_notification_read",
  "data": {
    "notification_ids": ["notif_123", "notif_456"],
    "mark_all": false
  }
}
```

### 5.2 REST API (선택적)

#### GET `/api/notifications`

```
Query Parameters:
- limit: int (기본 50)
- offset: int (기본 0)
- severity: str[] (필터)
- category: str[] (필터)
- unread_only: bool (기본 false)

Response:
{
  "notifications": [...],
  "total": 150,
  "unread_count": 12
}
```

#### POST `/api/notifications/{id}/read`

알림 읽음 처리

#### DELETE `/api/notifications/{id}`

알림 삭제

---

## 6. 프론트엔드 구현 계획

### 6.1 상태 관리 (Zustand Store)

**파일**: `frontend/src/store/notification.ts`

```typescript
interface Notification {
  id: string;
  timestamp: string;
  severity: 'critical' | 'error' | 'warning' | 'info' | 'success';
  category: 'service' | 'message' | 'config' | 'user' | 'system';
  title: string;
  message: string;
  source: string;
  metadata?: Record<string, any>;
  actions?: NotificationAction[];
  link?: string;
  dismissible: boolean;
  persistent: boolean;
  read: boolean;
}

interface NotificationAction {
  label: string;
  action: string;
  params?: Record<string, any>;
}

interface NotificationStore {
  // State
  notifications: Notification[];
  unreadCount: number;
  filter: {
    severity: string[];
    category: string[];
    unreadOnly: boolean;
  };

  // Actions
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setFilter: (filter: Partial<NotificationFilter>) => void;

  // Toast specific
  showToast: (notification: Notification) => void;
  dismissToast: (id: string) => void;
}
```

### 6.2 컴포넌트 구조

```
frontend/src/components/notifications/
├── NotificationBell.tsx          # Footer의 벨 아이콘
├── NotificationPopover.tsx       # 알림 목록 팝오버
├── NotificationItem.tsx          # 개별 알림 아이템
├── NotificationFilter.tsx        # 필터 탭
├── ToastContainer.tsx            # 토스트 컨테이너
├── Toast.tsx                     # 개별 토스트
└── NotificationActions.tsx       # 액션 버튼

frontend/src/hooks/
└── useNotifications.ts           # 알림 훅
```

### 6.3 주요 컴포넌트

#### NotificationBell.tsx

```typescript
export const NotificationBell = () => {
  const { unreadCount, notifications } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  // 가장 높은 severity 색상
  const severityColor = useMemo(() => {
    // critical > error > warning > info
  }, [notifications]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <button className="relative">
          <Bell className={severityColor} />
          {unreadCount > 0 && (
            <Badge>{unreadCount > 99 ? '99+' : unreadCount}</Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <NotificationPopover />
      </PopoverContent>
    </Popover>
  );
};
```

#### ToastContainer.tsx

```typescript
export const ToastContainer = () => {
  const { toasts } = useNotificationStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.slice(0, 3).map(toast => (
        <Toast key={toast.id} notification={toast} />
      ))}
    </div>
  );
};
```

### 6.4 Hook: useNotifications

```typescript
export const useNotifications = () => {
  const store = useNotificationStore();
  const { sendMessage } = useWebSocket();

  useEffect(() => {
    // WebSocket 메시지 리스너
    const handleNotification = (event: NotificationEvent) => {
      store.addNotification(event.data);

      // 중요도에 따라 토스트 표시
      if (shouldShowToast(event.data)) {
        store.showToast(event.data);
      }
    };

    // WebSocket 이벤트 구독
    subscribeToNotifications(handleNotification);

    return () => unsubscribe();
  }, []);

  return {
    ...store,
    refetch: () => sendMessage({ type: 'get_notifications' })
  };
};
```

---

## 7. 데이터 모델 (Backend)

### 7.1 Database Schema (Optional - 영구 저장)

```python
# backend/app/models/notification.py

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON
from app.db import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    severity = Column(String(20), nullable=False)
    category = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(String(1000), nullable=False)
    source = Column(String(100), nullable=False)
    metadata = Column(JSON, nullable=True)
    actions = Column(JSON, nullable=True)
    link = Column(String(500), nullable=True)
    dismissible = Column(Boolean, default=True)
    persistent = Column(Boolean, default=False)
    read = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

**참고**: 알림은 주로 메모리에서 관리하고, 중요한 알림만 DB에 저장할 수 있습니다.

### 7.2 NotificationService

```python
# backend/app/services/notification_service.py

from typing import Dict, List, Optional
from datetime import datetime
import uuid

class NotificationService:
    """알림 생성 및 전송 서비스"""

    @staticmethod
    def create_notification(
        severity: str,
        category: str,
        title: str,
        message: str,
        source: str,
        metadata: Optional[Dict] = None,
        actions: Optional[List[Dict]] = None,
        link: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict:
        """알림 생성"""
        return {
            "id": f"notif_{uuid.uuid4().hex[:12]}",
            "timestamp": datetime.utcnow().isoformat(),
            "severity": severity,
            "category": category,
            "title": title,
            "message": message,
            "source": source,
            "metadata": metadata or {},
            "actions": actions or [],
            "link": link,
            "dismissible": True,
            "persistent": False,
            "read": False,
        }

    @staticmethod
    async def broadcast_notification(notification: Dict):
        """모든 연결된 클라이언트에게 알림 브로드캐스트"""
        from app.api.websocket import manager

        await manager.broadcast({
            "type": "notification",
            "data": notification
        })
```

---

## 8. 알림 이벤트 정의

### 8.1 Service Category

| 이벤트 | Severity | Title | 예시 Message |
|--------|----------|-------|-------------|
| Service Started | success | Matterbridge 시작됨 | 서비스가 정상적으로 시작되었습니다. |
| Service Stopped | warning | Matterbridge 중지됨 | 서비스가 중지되었습니다. |
| Service Crashed | critical | Matterbridge 비정상 종료 | 서비스가 예기치 않게 종료되었습니다. |
| Connection Lost | error | 연결 끊김 | Slack/Teams 연결이 끊어졌습니다. |
| Connection Restored | success | 연결 복구됨 | Slack/Teams 연결이 복구되었습니다. |

### 8.2 Message Category

| 이벤트 | Severity | Title | 예시 Message |
|--------|----------|-------|-------------|
| Message Sync Failed | error | 메시지 동기화 실패 | #general 채널 메시지 전송에 실패했습니다. |
| Message Delayed | warning | 메시지 지연 | 메시지 전송이 지연되고 있습니다. |
| High Message Rate | info | 높은 메시지 처리량 | 분당 100개 이상 메시지 처리 중 |

### 8.3 Config Category

| 이벤트 | Severity | Title | 예시 Message |
|--------|----------|-------|-------------|
| Config Updated | success | 설정 저장됨 | Gateway 설정이 저장되었습니다. |
| Config Invalid | error | 설정 오류 | 설정 파일 검증에 실패했습니다. |
| Backup Created | success | 백업 생성됨 | 설정 백업이 생성되었습니다. |
| Backup Restored | success | 백업 복원됨 | 설정이 복원되었습니다. |

### 8.4 User Category

| 이벤트 | Severity | Title | 예시 Message |
|--------|----------|-------|-------------|
| User Login | info | 로그인 | 사용자가 로그인했습니다. |
| User Logout | info | 로그아웃 | 사용자가 로그아웃했습니다. |
| User Created | success | 사용자 생성됨 | 새 사용자가 생성되었습니다. |
| Unauthorized Access | warning | 인증 실패 | 권한이 없는 접근 시도가 있었습니다. |

### 8.5 System Category

| 이벤트 | Severity | Title | 예시 Message |
|--------|----------|-------|-------------|
| High CPU Usage | warning | CPU 사용량 높음 | CPU 사용률이 80%를 초과했습니다. |
| High Memory Usage | warning | 메모리 사용량 높음 | 메모리 사용률이 90%를 초과했습니다. |
| Disk Space Low | error | 디스크 공간 부족 | 디스크 여유 공간이 10% 미만입니다. |
| Update Available | info | 업데이트 가능 | 새 버전이 출시되었습니다. |

---

## 9. 구현 단계

### Phase 1: 기반 구조 (1-2일)

**백엔드**:
- [ ] NotificationService 클래스 구현
- [ ] WebSocket에 notification 이벤트 핸들러 추가
- [ ] 테스트용 알림 생성 API 추가

**프론트엔드**:
- [ ] Notification Store (Zustand) 구현
- [ ] useNotifications Hook 구현
- [ ] WebSocket 이벤트 리스너 연결

### Phase 2: UI 컴포넌트 (2-3일)

**프론트엔드**:
- [ ] NotificationBell 컴포넌트
- [ ] NotificationPopover 컴포넌트
- [ ] NotificationItem 컴포넌트
- [ ] NotificationFilter 컴포넌트
- [ ] Footer에 Bell Icon 통합

### Phase 3: Toast 시스템 (1-2일)

**프론트엔드**:
- [ ] ToastContainer 컴포넌트
- [ ] Toast 컴포넌트 (variants: success, error, warning, info)
- [ ] 자동 dismiss 로직
- [ ] 스택 관리 (최대 3개)
- [ ] Layout에 ToastContainer 추가

### Phase 4: 백엔드 통합 (2-3일)

**백엔드**:
- [ ] Matterbridge Service 이벤트에 알림 연동
- [ ] Config API 이벤트에 알림 연동
- [ ] User API 이벤트에 알림 연동
- [ ] 시스템 모니터링 메트릭에 알림 연동

**프론트엔드**:
- [ ] 실시간 알림 수신 테스트
- [ ] 토스트 표시 로직 검증

### Phase 5: 영구 저장 (선택, 1-2일)

**백엔드**:
- [ ] Notification 모델 추가
- [ ] Database 마이그레이션
- [ ] REST API 엔드포인트 추가
- [ ] 읽음/삭제 처리

**프론트엔드**:
- [ ] API 연동
- [ ] 새로고침 후 알림 복원

### Phase 6: 고급 기능 (선택, 2-3일)

- [ ] 알림 검색 기능
- [ ] 알림 그룹화 (같은 source)
- [ ] 알림 사운드 (선택)
- [ ] 데스크톱 알림 (Browser Notification API)
- [ ] 알림 설정 페이지 (사용자별 알림 on/off)
- [ ] 이메일 알림 (critical 이벤트)

### Phase 7: 테스트 및 최적화 (1-2일)

- [ ] 단위 테스트 (Service, Hook, Component)
- [ ] 통합 테스트 (WebSocket 통신)
- [ ] 성능 테스트 (대량 알림 처리)
- [ ] UX 개선 (애니메이션, 접근성)

---

## 10. 기술 스택

### 10.1 Backend

- **WebSocket**: 기존 FastAPI WebSocket 활용
- **이벤트 버스**: Python Event 패턴 또는 간단한 PubSub
- **영구 저장** (선택): PostgreSQL (기존 DB)

### 10.2 Frontend

- **상태 관리**: Zustand
- **UI 컴포넌트**:
  - Popover: Headless UI 또는 Radix UI
  - Toast: `react-hot-toast` 또는 커스텀 구현
  - Icons: Lucide React
- **WebSocket**: 기존 `useWebSocket` Hook
- **애니메이션**: CSS Transitions + Framer Motion (선택)

---

## 11. 성능 고려사항

### 11.1 메모리 관리

- **최대 알림 개수**: 메모리에 최대 100개까지만 유지
- **자동 정리**: 1시간 이상 된 읽은 알림은 자동 삭제
- **Persistent 알림**: DB에 저장 후 메모리에서 제거

### 11.2 WebSocket 최적화

- **배치 전송**: 여러 알림을 배치로 전송
- **Rate Limiting**: 초당 최대 10개 알림
- **우선순위 큐**: Critical 알림 우선 전송

### 11.3 Toast 성능

- **렌더링 최적화**: React.memo 사용
- **애니메이션**: CSS Transform (GPU 가속)
- **Portal 사용**: DOM 트리 최상위에 렌더링

---

## 12. 보안 고려사항

### 12.1 알림 필터링

- **사용자별 알림**: 관리자만 시스템 알림 수신
- **권한 검증**: 민감한 알림은 권한 확인 후 전송

### 12.2 XSS 방지

- **메시지 이스케이핑**: 알림 내용 HTML 이스케이핑
- **링크 검증**: 외부 링크 허용 여부 검토

---

## 13. 접근성 (a11y)

- **ARIA 레이블**: 스크린 리더 지원
- **키보드 네비게이션**: Tab, Enter, Escape 키 지원
- **Focus Management**: Popover 열림/닫힘 시 포커스 관리
- **색상 대비**: WCAG 2.1 AA 준수

---

## 14. 모니터링 및 로깅

- **알림 발생 로그**: 모든 알림 이벤트 로깅
- **사용자 액션 추적**: 읽음/삭제/클릭 이벤트 로깅
- **에러 모니터링**: 알림 전송 실패 추적

---

## 15. 예상 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 알림 폭주 (Notification Storm) | 높음 | Rate limiting, 배치 처리 |
| WebSocket 연결 불안정 | 중간 | 재연결 로직, REST API 대체 |
| 메모리 누수 | 중간 | 자동 정리, 최대 개수 제한 |
| 토스트 UI 과부하 | 낮음 | 최대 3개 제한, 우선순위 처리 |

---

## 16. 성공 지표

- **알림 도달률**: 95% 이상
- **평균 응답 시간**: 100ms 이하 (WebSocket)
- **사용자 인지율**: 중요 알림 놓침 0%
- **성능**: 100개 알림 처리 시 메모리 증가 < 10MB

---

## 17. 참고 자료

### UI/UX 참고

- **VS Code**: 하단 우측 벨 아이콘
- **GitHub**: 상단 알림 아이콘
- **Slack**: Desktop 알림
- **Discord**: 서버별 알림 배지

### 기술 문서

- [FastAPI WebSocket](https://fastapi.tiangolo.com/advanced/websockets/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React Hot Toast](https://react-hot-toast.com/)
- [Headless UI - Popover](https://headlessui.com/react/popover)

---

## 18. 결론

이 알림 시스템은 VMS Chat Ops의 UX를 크게 개선하여:

1. **중앙 집중화**: 모든 시스템 이벤트를 한 곳에서 확인
2. **실시간성**: WebSocket을 통한 즉각적인 알림
3. **우선순위**: 중요도에 따른 차등 표시
4. **사용자 편의**: VS Code 스타일의 친숙한 UI

단계별로 구현하여 점진적으로 기능을 확장할 수 있습니다.

---

**다음 단계**: 이 계획안 검토 후 Phase 1부터 구현 시작
