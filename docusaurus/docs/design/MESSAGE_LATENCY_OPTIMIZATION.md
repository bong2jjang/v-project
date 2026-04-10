# 메시지 전송 속도 최적화 설계서

**작성일**: 2026-04-07
**버전**: 1.0
**상태**: 검토 대기

---

## 1. 현재 상황 분석

### 1.1 메시지 전송 경로 (텍스트만, 파일 없음)

```
Slack 메시지 수신 → asyncio.Queue → receive_messages() → _route_message()
  → RouteManager.get_targets() [Redis 3회]
  → RouteManager.get_message_mode() [Redis 1회]
  → thread_mapping 조회 [Redis 1회]
  → Teams send_message()
    → _get_delegated_token_if_available() [DB 쿼리]
    → Graph API POST /messages [HTTP]
  → save_thread_mapping() [Redis 2회]
  → MessageQueue.enqueue() [메모리 큐 → 5초 배치 flush → DB]
```

### 1.2 현재 측정된 지연

| 경로 | 텍스트 메시지 | 파일 포함 |
|------|-------------|----------|
| Slack → Teams | 1~3초 | 5~20초 |
| Teams → Slack | 2~5초 | 5~30초 |

Teams → Slack이 더 느린 이유: Graph API 메시지 조회가 추가로 필요 (Teams는 알림만 오고, 본문은 별도 GET)

---

## 2. 병목 지점 분석

### 2.1 심각도 높음

| # | 병목 | 현재 지연 | 위치 |
|---|------|----------|------|
| A | **Teams Graph API 메시지 조회** | 1~3초 | `teams_notifications.py:_fetch_message()` |
| B | **파일 순차 다운로드/업로드** | 2~30초 | `websocket_bridge.py:370` / `slack_provider.py:554` |
| C | **인증 실패 시 폴백 직렬 실행** | 최대 30초 | `teams_provider.py:489~570` (Delegated → Webhook → Bot 순차) |

### 2.2 심각도 중간

| # | 병목 | 현재 지연 | 위치 |
|---|------|----------|------|
| D | **Delegated 토큰 매번 DB 조회** | 50~200ms | `teams_provider.py:_get_delegated_token_if_available()` |
| E | **사용자명 조회 (캐시 미스)** | 1~3초 | `teams_notifications.py:_resolve_user_display_name()` |
| F | **MessageQueue 배치 flush 5초** | 0~5초 | `message_queue.py` (DB 저장 지연, 전송에는 영향 없음) |

### 2.3 심각도 낮음 (개선 불필요)

| # | 항목 | 현재 지연 | 이유 |
|---|------|----------|------|
| G | Redis 라우팅 조회 | < 5ms | 이미 충분히 빠름 |
| H | asyncio.Queue 타임아웃 | 1초 (최대) | 메시지가 있으면 즉시 반환 |

---

## 3. 개선안

### 개선 1: Teams 알림에서 메시지 본문 직접 추출 (영향: A)

**현재**: Graph API Change Notification → `_fetch_message()`로 별도 GET 요청
**개선**: Graph API 구독 생성 시 `includeResourceData: true` 옵션 사용

```python
# 현재 구독 생성
subscription = {
    "changeType": "created,updated,deleted",
    "notificationUrl": notification_url,
    "resource": f"/teams/{team_id}/channels/{channel_id}/messages",
    # ...
}

# 개선: 리소스 데이터 포함 (encrypted)
subscription = {
    "changeType": "created,updated,deleted",
    "notificationUrl": notification_url,
    "resource": f"/teams/{team_id}/channels/{channel_id}/messages",
    "includeResourceData": True,
    "encryptionCertificate": "<base64-encoded-cert>",
    "encryptionCertificateId": "<cert-id>",
    # ...
}
```

**효과**: 메시지당 1회 HTTP GET 제거 → **1~3초 단축**
**난이도**: 높음 (인증서 관리, 복호화 로직 필요)
**리스크**: 인증서 갱신 관리 복잡, 메시지 크기 제한(4KB)으로 큰 메시지는 여전히 별도 조회 필요

**대안 (권장)**: `_fetch_message()` 타임아웃을 10초 → 5초로 단축하고, 응답 지연 시 빠른 실패 처리

---

### 개선 2: 파일 다운로드/업로드 병렬화 (영향: B)

**현재**: `websocket_bridge.py:370`에서 첨부파일을 `for` 루프로 순차 처리

```python
# 현재 (순차)
for attachment in target_message.attachments:
    local_path = await source_provider.download_file(...)
```

**개선**: `asyncio.gather()`로 병렬 처리

```python
# 개선 (병렬)
download_tasks = []
for attachment in target_message.attachments:
    if attachment.download_status == "pending" and attachment.url:
        download_tasks.append(
            _download_attachment(source_provider, attachment)
        )

if download_tasks:
    await asyncio.gather(*download_tasks)
```

**효과**: 파일 3개 × 5초 = 현재 15초 → 개선 후 5초 (가장 느린 파일 기준)
**난이도**: 낮음
**리스크**: 없음 (각 파일은 독립적)

> Slack `send_message()`의 파일 업로드도 동일하게 병렬화 가능

---

### 개선 3: 텍스트 먼저 전송, 파일은 비동기 후속 전송 (영향: B)

**현재**: 파일 다운로드 → 파일 업로드 → 텍스트 전송 (모두 완료 후 전달)

**개선**: 텍스트를 즉시 전송하고, 파일은 백그라운드에서 처리 후 후속 메시지로 전송

```python
# 1단계: 텍스트 즉시 전송
text_message = target_message.model_copy(deep=True)
text_message.attachments = []
if target_message.attachments:
    text_message.text += f"\n📎 파일 {len(target_message.attachments)}개 전송 중..."
await provider.send_message(text_message)

# 2단계: 파일 비동기 전송 (백그라운드)
asyncio.create_task(_send_attachments_async(provider, target_message))
```

**효과**: 텍스트 메시지 지연이 파일 처리와 완전 분리 → **텍스트는 항상 1~3초 내 전달**
**난이도**: 중간
**리스크**: 파일이 텍스트보다 늦게 도착 (사용자에게 "전송 중..." 표시로 완화)

---

### 개선 4: Delegated 토큰 메모리 캐싱 (영향: D)

**현재**: 매 전송마다 DB에서 `OAuthToken` 조회

```python
async def _get_delegated_token_if_available(self):
    token_record = await db.execute(select(OAuthToken).where(...))
```

**개선**: 메모리 캐시 + TTL (토큰 만료 5분 전까지 재사용)

```python
_delegated_token_cache: dict[str, tuple[str, datetime]] = {}

async def _get_delegated_token_if_available(self):
    cached = _delegated_token_cache.get(self.tenant_id)
    if cached and cached[1] > datetime.now(timezone.utc) + timedelta(minutes=5):
        return cached[0]
    
    token_record = await db.execute(select(OAuthToken).where(...))
    if token_record:
        _delegated_token_cache[self.tenant_id] = (token_record.access_token, token_record.expires_at)
        return token_record.access_token
    return None
```

**효과**: 매 전송마다 50~200ms 절감
**난이도**: 낮음
**리스크**: 없음 (토큰 만료 전 5분 여유)

---

### 개선 5: Teams 전송 폴백 타임아웃 단축 (영향: C)

**현재**: Delegated(10초) → Webhook(10초) → Bot Framework(10초) = 최대 30초

**개선**: 각 방식 타임아웃을 5초로 단축 + 이전 성공 방식 우선 시도

```python
# 마지막 성공 전송 방식 기억
_last_successful_method: str | None = None  # "delegated" | "webhook" | "bot"

async def send_message(self, message):
    # 마지막 성공 방식을 먼저 시도
    methods = self._get_ordered_methods()
    for method in methods:
        result = await asyncio.wait_for(method(message), timeout=5.0)
        if result:
            self._last_successful_method = method.__name__
            return True
    return False
```

**효과**: 최악 30초 → 15초, 일반적으로 첫 번째 방식에서 성공
**난이도**: 중간
**리스크**: 타임아웃 너무 짧으면 간헐적 실패 증가

---

### 개선 6: Graph API 메시지 조회 타임아웃 단축 (영향: A)

**현재**: `aiohttp.ClientTimeout(total=10)` (`teams_notifications.py:_fetch_message()`)

**개선**: 5초로 단축

```python
timeout = aiohttp.ClientTimeout(total=5)
```

**효과**: 느린 응답 시 빠른 실패 → 사용자 대기시간 5초 단축
**난이도**: 매우 낮음 (한 줄 변경)
**리스크**: Graph API가 간헐적으로 5초 이상 걸리면 메시지 누락 가능 (재시도 로직 추가 권장)

---

## 4. 우선순위 및 효과 요약

| 순위 | 개선안 | 예상 효과 | 난이도 | 권장 |
|------|--------|----------|--------|------|
| 1 | **개선 2**: 파일 병렬 처리 | 파일 메시지 50% 단축 | 낮음 | ✅ 즉시 적용 |
| 2 | **개선 4**: 토큰 메모리 캐싱 | 매 전송 50~200ms 절감 | 낮음 | ✅ 즉시 적용 |
| 3 | **개선 6**: API 타임아웃 단축 | 최악 케이스 5초 단축 | 매우 낮음 | ✅ 즉시 적용 |
| 4 | **개선 5**: 폴백 타임아웃 + 순서 최적화 | 최악 30초 → 15초 | 중간 | ✅ 권장 |
| 5 | **개선 3**: 텍스트/파일 분리 전송 | 텍스트 항상 1~3초 | 중간 | ⚠️ UX 변경 검토 필요 |
| 6 | **개선 1**: 알림에 본문 포함 | 1~3초 단축 | 높음 | ⚠️ 인증서 관리 부담 |

---

## 5. 적용 시 예상 지연

| 경로 | 현재 | 개선 2+4+6 적용 후 | 전체 적용 후 |
|------|------|-------------------|-------------|
| Slack → Teams (텍스트) | 1~3초 | 0.8~2초 | 0.5~1.5초 |
| Teams → Slack (텍스트) | 2~5초 | 1.5~3초 | 1~2초 |
| Slack → Teams (파일 3개) | 15~30초 | 5~15초 | 3~5초 (텍스트 즉시) |
| Teams → Slack (파일 3개) | 15~30초 | 5~15초 | 3~5초 (텍스트 즉시) |
| 최악 시나리오 | ~70초 | ~35초 | ~20초 |

---

## 6. 결론

**즉시 적용 권장 (개선 2, 4, 6)**: 코드 변경 최소, 리스크 없음, 체감 효과 있음
**검토 후 적용 (개선 3, 5)**: UX 변경이 수반되므로 사용자 피드백 필요
**보류 (개선 1)**: 효과 대비 구현 복잡도가 높음, 현재 단계에서는 비용 대비 효과 낮음
