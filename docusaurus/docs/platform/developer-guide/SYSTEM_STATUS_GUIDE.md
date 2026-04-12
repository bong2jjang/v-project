# 시스템 상태 (System Status) 사용 가이드

> **작성일**: 2026-04-12  
> **관련 코드**:  
> - Backend: `platform/backend/v_platform/api/health.py`  
> - Frontend: `platform/frontend/v-platform-core/src/components/layout/TopBar.tsx`  
> - Frontend: `platform/frontend/v-platform-core/src/components/common/StatusDetailPopup.tsx`

---

## 1. 개요

TopBar 우측의 **시스템 상태 배지**는 연결된 모든 서비스의 종합 상태를 실시간으로 표시합니다. 배지를 클릭하면 각 서비스별 상세 상태를 확인할 수 있는 팝업이 열립니다.

| 배지 표시 | 의미 | 색상 |
|-----------|------|------|
| **OK** | 모든 서비스 정상 | 녹색 (success) |
| **Warn** | 일부 서비스 연결 중 또는 재시작 중 | 노란색 (warning) |
| **Error** | 일부 서비스 중단 또는 오류 | 빨간색 (danger) |
| **...** | 상태 확인 진행 중 | 노란색 (warning) |

---

## 2. 상태 확인 대상

### 2.1 고정 서비스 (항상 표시)

프론트엔드에서 직접 확인하는 서비스입니다.

| 서비스 | 아이콘 | 설명 | 확인 방법 |
|--------|--------|------|-----------|
| **WebSocket** | Wifi | 실시간 업데이트를 위한 서버 연결 | `useRealtimeStatus()` 훅으로 연결 상태 추적 |
| **Backend API** | Activity | FastAPI 백엔드 서버 | `/api/health` 호출 성공 여부 + 응답 시간 |

### 2.2 동적 서비스 (Health API에서 반환)

백엔드 `/api/health` 엔드포인트가 반환하는 서비스입니다. 플랫폼 기본 서비스 외에 앱이 커스텀 체크를 등록할 수 있습니다.

| 서비스 | 아이콘 | 설명 | 체크 방법 |
|--------|--------|------|-----------|
| **Database** | Database | PostgreSQL 데이터베이스 | `SELECT 1` 실행, 응답 시간 측정 |
| **Redis Cache** | Zap | Redis 캐시 및 세션 스토어 | `PING` 명령 실행, 응답 시간 측정 |
| **Message Bridge** | Server | Slack ↔ Teams 메시지 브리지 | 앱(v-channel-bridge)이 등록한 커스텀 체크 |

---

## 3. 상세 팝업 (StatusDetailPopup)

배지를 클릭하면 모달 팝업이 열리며, 각 서비스의 상세 정보를 표시합니다.

### 표시 정보

각 서비스 카드에 표시되는 항목:

- **아이콘**: 서비스 종류를 나타내는 아이콘
- **이름**: 서비스명 (예: Database, Redis Cache)
- **상태 배지**: Running / Connecting / Restarting / Stopped / Error
- **설명**: 서비스에 대한 간단한 설명
- **응답 시간**: 체크에 소요된 시간 (ms)
- **에러 메시지**: 장애 시 에러 원인 표시 (최대 120자)

### 서비스 상태 종류

| 상태 | 배지 색상 | 의미 |
|------|-----------|------|
| `running` | 녹색 (success) | 정상 동작 중 |
| `connecting` | 노란색 (warning) | 연결 시도 중 |
| `restarting` | 노란색 (warning) | 재시작 중 |
| `stopped` | 빨간색 (danger) | 중단됨 |
| `error` | 빨간색 (danger) | 오류 발생 |

### 기능 버튼

- **새로고침** (RefreshCw 아이콘): 수동으로 모든 서비스 상태를 즉시 재확인
- **닫기** (X 아이콘): 팝업 닫기 (배경 클릭으로도 닫힘)

### 마지막 업데이트 시간

팝업 하단에 마지막 상태 확인 시각이 한국어 로케일(ko-KR)로 표시됩니다.

---

## 4. 자동 체크 주기

| 이벤트 | 동작 |
|--------|------|
| 페이지 로드 | 즉시 전체 서비스 체크 |
| **30초** 주기 | 자동으로 전체 서비스 체크 반복 |
| 팝업 열기 | 즉시 전체 서비스 체크 |
| 새로고침 버튼 클릭 | 기존 요청 중단 후 즉시 재체크 |

WebSocket 연결 상태는 별도로 `useRealtimeStatus()` 훅을 통해 **실시간** 추적됩니다 (30초 주기와 무관).

---

## 5. Health API 상세

### 엔드포인트

```
GET /api/health
```

인증 불필요 (공개 엔드포인트).

### 응답 형식

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 2.5,
      "error": null
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 1.2,
      "error": null
    },
    "bridge": {
      "status": "unhealthy",
      "response_time_ms": null,
      "error": "Bridge not running"
    }
  },
  "bridge_running": false
}
```

### 종합 상태 판정

| 조건 | `status` 값 |
|------|-------------|
| 모든 서비스가 `healthy` | `"healthy"` |
| 하나라도 `unhealthy` | `"degraded"` |

---

## 6. 커스텀 헬스체크 등록 (앱 개발자용)

각 앱은 `HealthRegistry`를 통해 자체 서비스의 헬스체크를 등록할 수 있습니다. 등록된 체크는 `/api/health` 응답의 `services`에 자동 포함되고, TopBar 상태 팝업에도 표시됩니다.

### 6.1 백엔드: 체크 함수 등록

```python
# apps/my-app/backend/app/main.py
from v_platform.api.health import health_registry, ServiceHealth

def _check_my_service() -> ServiceHealth:
    """커스텀 서비스 상태 체크."""
    if my_service.is_running:
        return ServiceHealth(status="healthy")
    return ServiceHealth(status="unhealthy", error="Service not running")

# 체크 등록 — 앱 모듈 로드 시 자동 실행
health_registry.register("my_service", _check_my_service)
```

**규칙:**
- 체크 함수는 `ServiceHealth`를 반환해야 합니다
- 동기(`def`) 또는 비동기(`async def`) 모두 가능
- `status`는 `"healthy"` 또는 `"unhealthy"` 사용
- `response_time_ms`로 응답 시간을 측정할 수 있습니다 (선택)
- `error`는 장애 시 원인을 설명합니다 (최대 120자로 잘림)
- 체크 함수가 예외를 발생시키면 자동으로 `unhealthy`로 처리됩니다

### 실제 예시 — v-channel-bridge

```python
# apps/v-channel-bridge/backend/app/main.py

from v_platform.api.health import health_registry, ServiceHealth
from app.services.websocket_bridge import get_bridge

def _check_bridge() -> ServiceHealth:
    b = get_bridge()
    if b and b.is_running:
        return ServiceHealth(status="healthy")
    return ServiceHealth(status="unhealthy", error="Bridge not running")

health_registry.register("bridge", _check_bridge)
```

### 6.2 프론트엔드: 서비스 표시 커스터마이징

Health API가 반환하는 서비스 키에 대한 아이콘과 이름은 `TopBar.tsx`의 `SERVICE_META`에서 매핑합니다.

```typescript
// platform/frontend/v-platform-core/src/components/layout/TopBar.tsx

const SERVICE_META: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  database: {
    name: "Database",
    description: "PostgreSQL 데이터베이스 서버",
    icon: <Database className="w-5 h-5" />,
  },
  redis: {
    name: "Redis Cache",
    description: "Redis 캐시 및 세션 스토어",
    icon: <Zap className="w-5 h-5" />,
  },
  bridge: {
    name: "Message Bridge",
    description: "Slack ↔ Teams 메시지 브리지",
    icon: <Server className="w-5 h-5" />,
  },
};
```

**새 서비스를 추가하려면:**

1. 백엔드에서 `health_registry.register("my_key", check_fn)`으로 등록
2. 프론트엔드 `SERVICE_META`에 해당 키의 표시 정보 추가

`SERVICE_META`에 등록하지 않은 키도 자동으로 표시됩니다 — 키 이름이 서비스명으로, 기본 Server 아이콘이 사용됩니다.

---

## 7. 상태 흐름도

```
[TopBar 렌더링]
    │
    ├─ useRealtimeStatus() → WebSocket 연결 상태 실시간 추적
    │
    └─ 30초 주기 / 팝업 오픈 시 → checkAllServices()
         │
         ├─ WebSocket 상태 즉시 반영 (이미 알고 있는 정보)
         │
         └─ GET /api/health 호출
              │
              ├─ 성공 → Backend API: running (응답 시간 측정)
              │    │
              │    └─ 응답의 services를 동적으로 파싱:
              │         ├─ database: healthy → running / unhealthy → error
              │         ├─ redis: healthy → running / unhealthy → error
              │         └─ bridge: healthy → running / unhealthy → error
              │
              └─ 실패 → Backend API: error ("연결 실패")
                        동적 서비스 모두 제거 (상태 불명)
    │
    ▼
[종합 상태 계산]
    ├─ error/stopped 하나라도 있음 → 배지: "Error" (빨간색)
    ├─ connecting/restarting만 있음 → 배지: "Warn" (노란색)
    └─ 모두 running              → 배지: "OK" (녹색)
```

---

## 8. 플랫폼 기본 체크 상세

### Database 체크

```python
async def _check_db() -> ServiceHealth:
    # SELECT 1 실행으로 DB 연결 확인
    # 응답 시간(ms) 측정
    # 실패 시 에러 메시지 포함 (최대 120자)
```

### Redis 체크

```python
async def _check_redis() -> ServiceHealth:
    # REDIS_URL 환경 변수에서 연결 정보 읽기
    # PING 명령으로 연결 확인
    # 응답 시간(ms) 측정
    # 사용 후 연결 닫기 (aclose)
```

---

## 9. 관련 파일 요약

| 범주 | 파일 | 역할 |
|------|------|------|
| **Backend** | `platform/backend/v_platform/api/health.py` | Health API 엔드포인트 + HealthRegistry |
| **Frontend** | `platform/frontend/.../components/layout/TopBar.tsx` | 상태 배지 + 체크 로직 |
| **Frontend** | `platform/frontend/.../components/common/StatusDetailPopup.tsx` | 상세 팝업 UI |
| **앱 예시** | `apps/v-channel-bridge/backend/app/main.py` | bridge 커스텀 체크 등록 |

---

## 10. 트러블슈팅

### 배지가 계속 "Error"로 표시되는 경우

1. **Backend 서버 확인**: `docker ps`로 백엔드 컨테이너가 실행 중인지 확인
2. **직접 API 호출**: `curl http://127.0.0.1:8000/api/health`로 응답 확인
3. **DB 연결 확인**: `docker exec v-channel-bridge-backend python -c "from v_platform.core.database import engine; print(engine.url)"`
4. **Redis 연결 확인**: `docker exec v-channel-bridge-backend python -c "import redis; r=redis.from_url('redis://:redispassword@redis:6379/0'); print(r.ping())"`

### 배지가 "Warn"으로 표시되는 경우

- **WebSocket 연결 중**: 페이지 로드 직후 잠시 표시될 수 있음 (정상)
- **재연결 시도 중**: 네트워크 불안정 시 자동 재연결 진행 중

### 팝업에서 "확인 중"이 계속 표시되는 경우

- Backend 응답이 지연되고 있음. 서버 부하 또는 DB/Redis 연결 지연 확인
