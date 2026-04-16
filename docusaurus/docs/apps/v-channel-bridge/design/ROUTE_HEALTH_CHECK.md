# Route Health Check 설계

> Route별 메시지 전송 상태를 사전 진단하고, 문제 발견 시 자동/수동 조치를 지원하는 기능

## 배경 및 문제

현재 시스템에서는 Route가 설정되어 있어도 실제 메시지 전송이 실패하는지 **메시지를 보내기 전까지 알 수 없다.**

실패 시나리오:
- Provider Socket/Token 만료 (Slack Socket Mode 끊김, Teams 토큰 갱신 실패)
- Receiver 태스크 미실행 (hot-replace 후 receiver 누락 — 이번에 수정한 버그)
- 채널 삭제/아카이브
- Bot이 채널에서 제거됨
- Route는 있지만 `enabled=0`
- DevTunnel/Webhook URL 만료 (Teams)

## 설계 개요

```
┌─────────────────────────────────────────────────────┐
│                  Route Health Check                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Probe (진단)                                    │
│     ├── Provider 연결 상태                          │
│     ├── Receiver 태스크 실행 여부                   │
│     ├── 채널 접근 가능 여부                         │
│     ├── Route enabled 상태                          │
│     └── 최근 전송 성공률                            │
│                                                     │
│  2. Test Message (가상 전송)                        │
│     └── 실제 메시지를 보내서 E2E 검증              │
│                                                     │
│  3. Auto-Heal (자동 복구)                           │
│     ├── Provider 재연결                             │
│     ├── Receiver 태스크 재시작                      │
│     └── Route 자동 비활성화 (연속 실패 시)          │
│                                                     │
│  4. Dashboard (상태 표시)                           │
│     ├── Route별 health 뱃지                        │
│     ├── 마지막 성공/실패 시각                      │
│     └── 알림 (연속 실패 시)                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 1단계: Route Health Probe API

### API: `GET /api/bridge/routes/{route_id}/health`

Route의 각 구간을 체크하여 종합 상태를 반환한다.

```json
{
  "route_id": "slack:C0APBT4G4UC→teams:chat:19:xxx@thread.v2",
  "overall": "healthy",          // healthy | degraded | unhealthy
  "checked_at": "2026-04-16T07:30:00Z",
  "checks": [
    {
      "name": "source_provider_connected",
      "status": "pass",
      "detail": "Slack provider connected (session s_7956269378857)"
    },
    {
      "name": "source_receiver_running",
      "status": "pass",
      "detail": "Slack receiver task active"
    },
    {
      "name": "target_provider_connected",
      "status": "pass",
      "detail": "Teams provider connected (token expires in 2400s)"
    },
    {
      "name": "source_channel_accessible",
      "status": "pass",
      "detail": "Channel C0APBT4G4UC (viktor-테스트-01) accessible"
    },
    {
      "name": "target_channel_accessible",
      "status": "pass",
      "detail": "Chat 19:xxx@thread.v2 (점심친구) accessible"
    },
    {
      "name": "route_enabled",
      "status": "pass",
      "detail": "Route enabled in both directions"
    },
    {
      "name": "recent_delivery",
      "status": "warn",
      "detail": "No messages in last 24h (may be normal if channel is quiet)"
    }
  ]
}
```

### Health 판정 기준

| overall | 조건 |
|---------|------|
| `healthy` | 모든 check가 pass |
| `degraded` | warn이 있지만 critical check는 pass |
| `unhealthy` | provider/receiver/channel 중 하나라도 fail |

### Backend 구현 포인트

```python
# app/services/route_health.py

class RouteHealthChecker:
    """Route별 상태 진단 서비스"""

    async def check_route(self, source_platform, source_channel,
                          target_platform, target_channel) -> RouteHealth:
        checks = []

        # 1. Source Provider 연결 상태
        checks.append(await self._check_provider(source_platform, "source"))

        # 2. Source Receiver 태스크 실행 여부
        checks.append(self._check_receiver(source_platform))

        # 3. Target Provider 연결 상태
        checks.append(await self._check_provider(target_platform, "target"))

        # 4. Source 채널 접근 가능 여부
        checks.append(await self._check_channel_access(
            source_platform, source_channel, "source"))

        # 5. Target 채널 접근 가능 여부
        checks.append(await self._check_channel_access(
            target_platform, target_channel, "target"))

        # 6. Route enabled 상태
        checks.append(await self._check_route_enabled(
            source_platform, source_channel,
            target_platform, target_channel))

        # 7. 최근 전송 이력 (message_logs 테이블 조회)
        checks.append(await self._check_recent_delivery(
            source_platform, source_channel,
            target_platform, target_channel))

        return RouteHealth(checks=checks)
```

### _check_receiver 구현

```python
def _check_receiver(self, platform: str) -> HealthCheck:
    """Bridge의 receiver 태스크가 실행 중인지 확인"""
    bridge = get_bridge()
    task = bridge._receiver_tasks.get(platform)

    if task is None:
        return HealthCheck(
            name=f"{platform}_receiver_running",
            status="fail",
            detail=f"No receiver task for {platform}"
        )

    if task.done():
        exc = task.exception() if not task.cancelled() else None
        return HealthCheck(
            name=f"{platform}_receiver_running",
            status="fail",
            detail=f"Receiver task ended: {exc or 'cancelled'}"
        )

    return HealthCheck(
        name=f"{platform}_receiver_running",
        status="pass",
        detail=f"{platform} receiver task active"
    )
```

## 2단계: Test Message (Ping/Pong)

### API: `POST /api/bridge/routes/{route_id}/test`

실제 메시지를 보내서 E2E(end-to-end) 전송을 검증한다.

```json
// Request
{
  "direction": "forward",     // forward | reverse | both
  "message": "🔔 Route health check test message"  // optional, 기본값 사용
}

// Response
{
  "test_id": "test-abc123",
  "direction": "forward",
  "results": [
    {
      "from": "slack:C0APBT4G4UC",
      "to": "teams:chat:19:xxx@thread.v2",
      "status": "success",
      "latency_ms": 1250,
      "message_id": "msg_xxx",
      "detail": "Test message delivered successfully"
    }
  ]
}
```

### 구현 방식

1. `CommonMessage`를 수동 생성 (platform=source, channel=source_channel)
2. `metadata.is_test = True` 플래그 추가
3. 브리지의 `_route_message()`를 통해 실제 전송
4. 메시지 큐에도 `test` 상태로 기록 (통계에서 제외 가능)
5. 대상 채널에 테스트 메시지 도착 확인

### 주의사항

- 테스트 메시지는 실제 채널에 전송됨 → UI에서 "테스트 메시지가 전송됩니다" 경고
- Rate limit: 같은 route에 대해 1분에 1회 제한
- 테스트 메시지에는 시스템 표시: `[Route Health Check] 🔔 ...`

## 3단계: Auto-Heal (자동 복구)

### 주기적 Health Check (Background Task)

```python
class RouteHealthMonitor:
    """백그라운드에서 Route 상태를 주기적으로 체크"""

    INTERVAL = 300          # 5분마다
    FAILURE_THRESHOLD = 3   # 연속 3회 실패 시 조치

    async def run(self):
        while True:
            routes = await self.route_manager.get_all_routes()
            for route in routes:
                health = await self.checker.check_route(...)

                if health.overall == "unhealthy":
                    self._failure_counts[route_key] += 1
                    await self._try_auto_heal(route, health)
                else:
                    self._failure_counts[route_key] = 0

            await asyncio.sleep(self.INTERVAL)
```

### 자동 복구 액션

| 진단 결과 | 자동 조치 | 조건 |
|-----------|----------|------|
| Provider disconnected | `provider.connect()` 재시도 | 연속 2회 이상 |
| Receiver task dead | 새 receiver 태스크 시작 | 즉시 |
| Channel not accessible | Route 자동 비활성화 + 알림 | 연속 3회 이상 |
| Token expired | Token 갱신 시도 | 즉시 |

### 알림 연동

```python
async def _notify_route_unhealthy(self, route, health):
    """Route가 unhealthy 상태일 때 시스템 알림 발송"""
    await notification_service.create_system_notification(
        title=f"Route 전송 장애: {route.source_name} → {route.target_name}",
        message=f"연속 {count}회 health check 실패. "
                f"원인: {health.failed_checks_summary}",
        severity="warning",
        app_id="v-channel-bridge",
    )
```

## 4단계: Dashboard UI

### Route 목록에 Health 뱃지 표시

```
┌──────────────────────────────────────────────────────────┐
│ Routes                                              [+]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [🟢] viktor-테스트-01 ↔ 점심친구                       │
│       Slack ↔ Teams  │ 양방향  │ sender_info             │
│       마지막 전송: 2분 전 │ 성공률: 98.5%               │
│                                  [테스트] [상세]         │
│                                                          │
│  [🟡] general ↔ 팀-공지                                 │
│       Slack → Teams  │ 단방향  │ editable                │
│       마지막 전송: 3시간 전 │ 성공률: 100%              │
│       ⚠ 최근 전송 없음                                  │
│                                  [테스트] [상세]         │
│                                                          │
│  [🔴] dev-alerts → 개발-알림                            │
│       Slack → Teams  │ 단방향  │ sender_info             │
│       ❌ Teams Provider 연결 끊김                        │
│       자동 복구 시도 중... (2/3)                         │
│                                  [테스트] [상세]         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Health 상세 모달

"상세" 클릭 시 모달에 각 check 항목과 결과를 표시:

```
Route Health: viktor-테스트-01 ↔ 점심친구
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Slack Provider 연결           정상 (session s_xxx)
✅ Slack Receiver 태스크         실행 중
✅ Teams Provider 연결           정상 (토큰 만료: 40분 후)
✅ 소스 채널 접근                viktor-테스트-01 접근 가능
✅ 대상 채널 접근                점심친구 접근 가능
✅ Route 활성화                  양방향 활성
⚠️ 최근 전송 이력               24시간 내 전송 없음

마지막 체크: 2분 전
                     [테스트 메시지 전송] [새로고침]
```

## 구현 우선순위

| 단계 | 범위 | 복잡도 | 가치 |
|------|------|--------|------|
| **1단계** | Health Probe API + Dashboard 뱃지 | 중 | 높음 — 문제를 즉시 확인 가능 |
| **2단계** | Test Message API + UI 버튼 | 중 | 높음 — E2E 검증으로 확신 |
| **3단계** | Auto-Heal 백그라운드 모니터 | 높 | 중 — 운영 자동화 |
| **4단계** | 상세 모달 + 알림 연동 | 낮 | 중 — 사용자 경험 향상 |

## 데이터 모델 변경

### Redis 추가 키 (휘발성)

```
route_health:{platform}:{channel_id}:{target}   → JSON (last check result)
route_health:{platform}:{channel_id}:{target}:failures → integer (연속 실패 횟수)
```

TTL: 600초 (10분) — health check 주기의 2배

### message_logs 테이블 활용

기존 `message_logs` 테이블의 `status` 필드(`sent`/`failed`)를 집계하여 성공률 산출.
추가 컬럼 불필요 — 기존 데이터로 충분.

## 기존 시스템과의 관계

- **Provider `health_check()`**: 이미 존재 (base.py) → Probe에서 직접 호출
- **Bridge `_receiver_tasks`**: 이번 버그 수정으로 추가됨 → Probe에서 태스크 상태 확인
- **Message Queue status 필드**: `sent`/`failed`/`no_route` → 성공률 집계에 활용
- **알림 시스템 (v-platform)**: `notification_service` → Auto-Heal 알림에 활용
