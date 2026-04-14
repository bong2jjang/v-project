---
title: 양방향 브리지 설계
sidebar_position: 7
---

# 양방향 브리지 설계

Slack과 Microsoft Teams 사이에서 메시지가 어떻게 수신, 정규화, 라우팅, 발송되는지 전체 흐름을 설명합니다. 메시지 모드(`sender_info` / `editable`)의 동작 차이, 양방향 라우트의 Redis 구조, 실패 시 재시도 전략, 멱등성 보장 방식을 다룹니다.

---

## 메시지 흐름 개요

v-channel-bridge의 메시지 처리는 다음 5단계로 이루어집니다.

1. **Provider가 메시지 수신**: `SlackProvider.receive_messages()` 또는 `TeamsProvider.handle_activity()`가 플랫폼 원본 이벤트를 수신합니다.
2. **CommonMessage로 정규화**: `provider.transform_to_common(raw_event)`가 플랫폼별 원본 메시지를 통합 스키마(`CommonMessage`)로 변환합니다.
3. **WebSocketBridge가 라우팅 조회**: `_route_message()`에서 `RouteManager.get_targets()`를 호출하여 Redis에 등록된 타겟 채널 목록을 조회합니다.
4. **타겟 Provider로 발송**: 각 타겟에 대해 `provider.send_message(common_msg)`를 호출합니다. CommonMessage를 타겟 플랫폼 형식으로 변환하여 발송합니다.
5. **메시지 기록**: `MessageQueue`가 전송 결과를 DB에 배치 저장합니다.

---

## 상세 흐름도

```
Slack 채널 메시지
  |
  v
SlackProvider.receive_messages()  -- Socket Mode WebSocket 수신
  |
  v
transform_to_common(raw_event)    -- CommonMessage 생성
  |
  v
WebSocketBridge._route_message()
  |
  +-- is_command()? --> CommandProcessor.process()
  |
  +-- RouteManager.get_targets(platform, channel_id)
  |     -- Redis: SMEMBERS route:slack:{channel_id}
  |     -- Redis: HGETALL route:slack:{channel_id}:enabled (비활성 필터링)
  |
  v
각 타겟에 대해 _send_message() 호출
  |
  +-- 첨부 파일 있으면: source_provider.download_file() -> local_path 저장
  +-- 스레드 메시지면: RouteManager.get_thread_mapping()으로 target thread_id 변환
  +-- 편집 메시지 + editable 모드면: chat.update 또는 PATCH API로 실제 편집
  +-- 삭제 메시지 + editable 모드면: chat.delete 또는 DELETE API로 실제 삭제
  |
  v
target_provider.send_message(target_message)
  |
  v
MessageQueue.enqueue_from_common_message()  -- DB 배치 저장
```

---

## CommonMessage 스키마

`CommonMessage`(`apps/v-channel-bridge/backend/app/schemas/common_message.py`)는 모든 플랫폼 메시지를 하나의 형식으로 통합하는 Pydantic 모델입니다.

### 주요 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `message_id` | `str` | 메시지 고유 ID |
| `timestamp` | `datetime` | 메시지 생성 시각 |
| `type` | `MessageType` | 메시지 타입 (`text`, `file`, `image`, `reaction`, `command`, `system`) |
| `platform` | `Platform` | 발신 플랫폼 (`slack`, `teams`, `vms`) |
| `user` | `User` | 발신자 정보 (id, username, display_name, avatar_url) |
| `channel` | `Channel` | 채널 정보 (id, name, platform, type) |
| `text` | `str` (선택) | 메시지 텍스트 |
| `attachments` | `list[Attachment]` | 첨부 파일 목록 |
| `reactions` | `list[str]` | 리액션 목록 |
| `is_edited` | `bool` | 편집 여부 |
| `thread_id` | `str` (선택) | 스레드 ID |
| `parent_id` | `str` (선택) | 부모 메시지 ID |
| `target_channels` | `list[Channel]` | 전송 대상 채널 목록 |
| `command` | `str` (선택) | 커맨드 (예: `/vms`) |
| `raw_message` | `dict` | 플랫폼 원본 메시지 (디버깅용) |

### ChannelType

`Channel` 스키마의 `type` 필드는 채널 종류를 구분합니다.

| 값 | 설명 | Slack 대응 | Teams 대응 |
|---|---|---|---|
| `channel` | 일반 채널 | public/private channel | Team Channel |
| `dm` | 1:1 다이렉트 메시지 | im (D prefix) | oneOnOne chat |
| `group_dm` | 그룹 채팅 | mpim (G prefix) | group chat |

기본값은 `channel`이며, 기존 라우트와의 하위 호환성을 유지합니다.

---

## 메시지 모드

라우트를 등록할 때 `message_mode`를 선택할 수 있습니다. Redis의 `route:{platform}:{channel_id}:modes` 해시에 저장됩니다.

### sender_info 모드

브리지된 메시지에 원래 발신자의 이름과 아바타를 표시합니다.

- Slack으로 전송할 때: `chat.postMessage`의 `username`과 `icon_url` 파라미터를 사용합니다.
- 결과: `[John Doe] 안녕하세요` 형태로 발신자 정보가 표시됩니다.
- 편집 동기화가 불가합니다. `username`/`icon_url` 파라미터로 전송된 메시지는 `chat.update` API를 사용할 수 없기 때문입니다.
- 삭제 동기화가 불가합니다. 같은 이유로 `chat.delete`도 사용할 수 없습니다.
- 편집/삭제 이벤트는 알림 메시지로 대체됩니다.

### editable 모드

발신자 정보 없이 봇 이름으로 메시지를 전송합니다.

- 결과: `v-channel-bridge` 봇 이름으로 메시지가 표시됩니다.
- 편집 동기화가 가능합니다. 원본 메시지의 thread mapping을 조회하여 `chat.update`로 실제 메시지를 편집합니다.
- 삭제 동기화가 가능합니다. `chat.delete`로 실제 메시지를 삭제합니다.
- 발신자 구분이 어려울 수 있으므로, 메시지 본문에 발신자 이름을 포함하는 것을 권장합니다.

### 모드 선택 기준

| 기준 | sender_info | editable |
|------|-------------|----------|
| 발신자 표시 | 원래 발신자 이름/아바타 | 봇 이름 |
| 메시지 편집 동기화 | 불가 (알림 메시지 대체) | 가능 (실제 편집) |
| 메시지 삭제 동기화 | 불가 (알림 메시지 대체) | 가능 (실제 삭제) |
| 권장 상황 | 여러 사람이 대화하는 채널 | 공지/알림 용도 채널 |

---

## 양방향 라우트 구조

### Redis 키 구조

양방향 라우트를 등록하면 정방향과 역방향 Redis 키가 모두 생성됩니다.

```
# 정방향: Slack -> Teams
route:slack:C123456          → {teams:T789}          (SMEMBERS)
route:slack:C123456:names    → {teams:T789: "General"}  (HGETALL)
route:slack:C123456:modes    → {teams:T789: "sender_info"}
route:slack:C123456:bidirectional → {teams:T789: "1"}
route:slack:C123456:enabled  → {teams:T789: "1"}
route:slack:C123456:source_name → "general"

# 역방향: Teams -> Slack (자동 생성)
route:teams:T789             → {slack:C123456}
route:teams:T789:names       → {slack:C123456: "general"}
route:teams:T789:modes       → {slack:C123456: "sender_info"}
route:teams:T789:bidirectional → {slack:C123456: "1"}
route:teams:T789:enabled     → {slack:C123456: "1"}
route:teams:T789:source_name → "General"
```

### add_route() 동작

`RouteManager.add_route(is_bidirectional=True)`를 호출하면 다음이 수행됩니다.

1. 중복 확인: `SISMEMBER`로 이미 동일한 라우트가 존재하는지 확인합니다. 존재하면 `False`를 반환합니다.
2. 정방향 키 생성: `SADD route:{source}:{channel}` + 메타데이터 해시 저장
3. 역방향 키 생성: `SADD route:{target}:{channel}` + 메타데이터 해시 저장
4. 활성 상태 플래그: `:enabled` 해시에 `"1"` 저장

### UI에서 1건으로 표시

`get_all_routes()`는 양방향 라우트를 1건으로 표시합니다. 소스-타겟 쌍을 `frozenset`으로 변환하여 중복을 제거합니다.

```python
# RouteManager.get_all_routes() 내부 로직
pair = frozenset((source_id, target_id))
if pair in seen_bidirectional_pairs:
    continue  # 역방향 건너뛰기
seen_bidirectional_pairs.add(pair)
```

이를 통해 Slack -> Teams와 Teams -> Slack이 관리자 UI에서 한 건의 양방향 라우트로 표시됩니다.

### remove_route() 동작

양방향 라우트를 삭제하면 `_remove_single_direction()`이 정방향과 역방향 모두에 대해 호출됩니다. 각 방향의 Redis 키(`route:*`)와 모든 메타데이터 해시(`:names`, `:modes`, `:bidirectional`, `:enabled`)가 함께 삭제됩니다.

---

## 스레드 매핑

크로스 플랫폼 스레드를 지원하기 위해 Redis에 스레드 ID 매핑을 저장합니다.

### 키 형식

```
thread:{source_platform}:{source_channel}:{source_ts}
  → "{target_platform}:{target_channel}:{target_ts}"
```

### TTL

스레드 매핑의 기본 TTL은 7일입니다. `save_thread_mapping(ttl_days=7)`로 설정되며, `setex` 명령으로 자동 만료됩니다.

### 매핑 조회 흐름

`_send_message()`에서 `target_message.thread_id`가 있으면 다음 과정을 거칩니다.

1. `get_thread_mapping()`으로 소스 thread_id에 대응하는 타겟 thread_id를 조회합니다.
2. 매핑이 있으면 `target_message.thread_id`를 타겟 값으로 교체합니다.
3. 매핑이 없으면 `thread_id`를 `None`으로 설정하여 일반 메시지로 전송합니다 (잘못된 ID로 전송 실패를 방지).

---

## 실패 처리 전략

### 전송 실패 시 DB 기록

메시지 라우팅 중 예외가 발생하면 `MessageQueue`에 `status="failed"`로 기록합니다. 타겟이 존재하면 각 타겟별로 실패 기록을 생성하고, 타겟이 없으면 소스 채널에 실패 기록을 남깁니다.

```python
# WebSocketBridge._route_message() 내부
if self.message_queue:
    await self.message_queue.enqueue_from_common_message(
        message=message,
        status="failed",
        target_platform=target.platform.value,
        target_channel=target.id,
        error_message=f"Routing error: {str(e)}",
    )
```

### Provider 연결 실패

`bridge.add_provider()` 호출 시 `provider.connect()`가 실패하면 해당 Provider는 등록되지 않습니다. `init_bridge()`에서는 한 Provider의 실패가 다른 Provider의 등록을 막지 않도록 개별 `try/except`로 처리합니다.

### 라우트 미등록

라우팅 대상이 없으면(`get_targets()` 결과가 빈 목록) `status="no_route"`로 DB에 기록하고 메시지를 삭제하지 않습니다. 관리자가 나중에 라우트를 추가하면 이후 메시지부터 전달됩니다.

### Provider 미존재

타겟 플랫폼의 Provider가 등록되어 있지 않으면(예: Teams Provider가 시작되지 않은 상태에서 Teams 타겟으로 라우팅) `status="failed"`, `error_message="Provider not found: {platform}"`으로 DB에 기록합니다.

---

## 멱등성 보장

### Slack 중복 이벤트 방지

Slack Socket Mode는 동일한 이벤트를 여러 번 전달할 수 있습니다. `SlackProvider`는 LRU 기반 `OrderedDict` 캐시(최대 5000건, 60초 TTL)를 사용하여 중복 이벤트를 필터링합니다.

```
message_id = f"{event['channel']}:{event['ts']}"
if message_id in self._processed_events:
    return  # 이미 처리된 이벤트
self._processed_events[message_id] = current_time
```

### 라우트 중복 등록 방지

`add_route()`는 `SISMEMBER`로 기존 라우트 존재 여부를 확인합니다. 이미 동일한 소스-타겟 쌍이 존재하면 `False`를 반환하고 중복 등록을 방지합니다.

### 메시지 ID 기반 스레드 매핑

스레드 매핑은 `thread:{platform}:{channel}:{ts}` 키로 저장됩니다. 동일한 키에 대해 `setex`를 호출하면 기존 값을 덮어쓰므로 중복 매핑이 발생하지 않습니다.

---

## Teams 채널 ID 형식

Teams 채널 ID는 v-channel-bridge 내부에서 `{teamId}:{channelId}` 형식으로 저장됩니다.

```
route:teams:team-uuid-1234:19:abc123def456@thread.tacv2
```

`_parse_channel_ref()` 함수가 이 형식을 파싱하여 `(teamId, channelId)` 튜플을 반환합니다. Teams 채팅(DM/그룹)의 경우 `chat:` 접두사로 구분됩니다.

```
# 채널: {teamId}:{channelId}
route:teams:c070ebee-...:19:abc@thread.tacv2

# 채팅: chat:{chatId}
route:teams:chat:19:abc@unq.gbl.spaces
```

---

## MessageQueue 배치 저장

`MessageQueue`(`apps/v-channel-bridge/backend/app/services/message_queue.py`)는 메시지를 DB에 배치로 저장하여 I/O 부하를 줄입니다.

- **batch_size**: 50건 (50건이 모이면 즉시 flush)
- **flush_interval**: 5초 (5초마다 남아 있는 메시지를 flush)
- **정상 종료**: `bridge.stop()` 호출 시 `message_queue.stop()`이 실행되어 큐에 남은 메시지를 모두 처리합니다.

---

## 관련 문서

- [개발 가이드](../developer-guide/DEVELOPMENT.md)
- [고급 메시지 기능 설계](./ADVANCED_MESSAGE_FEATURES.md)
- [Provider 설정 전략](./ENV_VS_DATABASE_PROVIDERS.md)

---

**최종 업데이트**: 2026-04-13
