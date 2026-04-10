# 고급 메시지 기능 구현 설계

> **작성일**: 2026-04-06
> **최종 수정**: 2026-04-07
> **상태**: 구현 중
> **대상 기능**: 스레드/댓글 지원, 편집 알림 전달, 삭제 알림 전달, 리액션 전달

---

## 1. 현황 분석

### 아키텍처 전제

Teams 메시지 수신은 **Graph API Change Notifications** 기반입니다 (Bot Framework `handle_activity()` 아님).

- `TeamsSubscriptionManager`가 라우팅된 Teams 채널에 대해 Graph API 구독 생성/갱신
- Graph API가 메시지 발생 시 `POST /api/teams/notifications`로 알림 전송
- `teams_notifications.py`에서 알림 수신 → Graph API로 전체 메시지 조회 → `transform_to_common()` → 큐 삽입

### 기능별 현재 상태

| 기능 | Slack 수신 | Slack 전송 | Teams 수신 | Teams 전송 | 크로스 플랫폼 |
|------|-----------|-----------|-----------|-----------|-------------|
| **스레드/댓글 지원** | ✅ thread_ts | ✅ thread_ts 전송 | ❌ replyToId 미매핑 | ❌ /replies 미사용 | ❌ 불가 |
| **편집 알림 전달** | ✅ message_changed | ✅ editable 모드 | ❌ changeType 미구독 | ❌ 알림만 가능 | ❌ 불가 |
| **삭제 알림 전달** | ✅ message_deleted | ✅ editable 모드 | ❌ changeType 미구독 | ❌ 알림만 가능 | ❌ 불가 |
| **리액션 전달** | ✅ reaction_added | ✅ 텍스트 전환 | ❌ 미구현 | ❌ API 없음 | ⚠️ 텍스트 폴백 |

### Slack Provider 구현 현황

- **편집**: `message_changed` 이벤트 → `_handle_message_edited()` → `is_edited=True` + ` _(edited)_` 접미
- **삭제**: `message_deleted` 이벤트 → `_handle_message_deleted()` → SYSTEM 타입 `~메시지가 삭제되었습니다~`
- **스레드**: `thread_ts` → `CommonMessage.thread_id` 양방향 매핑 완료
- **리액션**: `reaction_added` → REACTION 타입 합성 메시지 (`:{emoji}: by @{user}`)

### Teams Provider 미구현 현황

- `teams_subscription_manager.py`: `changeType: "created"`만 구독 (편집/삭제 미포함)
- `teams_notifications.py`: `changeType == "created"`만 처리 (80행), 수정/삭제 무시
- `transform_to_common()`: `thread_id`, `parent_id` 미매핑
- `send_message()`: reply chain API 미사용

---

## 2. 구현 가능성 판정

### 2.1 스레드/댓글 지원 — ✅ 구현 가능 (우선순위 높음)

**기술 근거:**

Teams Graph API는 채널 메시지에 대한 Reply를 지원합니다:

```
POST /teams/{team-id}/channels/{channel-id}/messages/{message-id}/replies
```

- 수신: Graph API 메시지 응답의 `replyToId` 필드로 부모 메시지 ID 확인 가능
- 전송: Graph API `/messages/{id}/replies` 엔드포인트로 답글 생성 가능
- 매핑: WebSocket Bridge의 `thread_mapping` 인프라가 이미 존재

**한계:**
- Slack의 `thread_ts`와 Teams의 `replyToId`는 구조가 다름 (Slack은 첫 메시지의 ts, Teams는 직접 부모 ID)
- Teams 채팅(DM/그룹)에서는 reply chain이 개념적으로 없음 → 채널 메시지에서만 동작

**난이도: 중간** — 기존 인프라 활용 가능, API 연동만 추가

---

### 2.2 편집 알림 전달 — ⚠️ 부분 구현 가능

**기술 근거:**

- **Teams → Slack (수신)**: Graph API Change Notifications에서 `changeType: "updated"` 구독으로 편집 감지 가능. 현재 `"created"`만 구독 중.
- **Slack → Teams (전송)**: Teams Graph API의 `PATCH /messages/{id}`로 메시지 수정 가능하나 `ChannelMessage.UpdatePolicyViolation.All` 특수 권한 필요 (일반 앱 등록 불가).

**한계:**
- **현실적 접근**: 실제 수정 대신 "편집 알림"을 새 메시지로 전달
- Graph API `changeType: "updated"`는 편집 외에도 메시지 속성 변경(리액션 추가 등)에도 발생할 수 있음 → 실제 텍스트 변경 여부 확인 필요

**난이도: 중간** — 구독 확장 + 알림 처리 추가

---

### 2.3 삭제 알림 전달 — ⚠️ 부분 구현 가능

**기술 근거:**

- **Teams → Slack (수신)**: Graph API Change Notifications에서 `changeType: "deleted"` 구독 가능. 단, 삭제된 메시지의 본문은 조회 불가 → 삭제 사실만 전달.
- **Slack → Teams (전송)**: Teams Graph API `DELETE /messages/{id}`는 정책 위반 시나리오용. 일반 앱에서 불가.

**한계:**
- 삭제 알림은 리소스 경로에서 channel/message ID만 추출 가능 (본문 없음)
- **현실적 접근**: 삭제 알림을 새 메시지로 전달 (`~메시지가 삭제되었습니다~`)

**난이도: 중간** — 구독 확장 + 삭제 알림 메시지 생성

---

### 2.4 리액션 전달 — ⚠️ 부분 구현 가능

**기술 근거:**

- **Teams → Slack (수신)**: Graph API Change Notifications에서 `changeType: "updated"` 시 메시지의 `reactions` 필드 변화를 감지하여 리액션 추출 가능.
- **Slack → Teams (전송)**: Teams Graph API에는 리액션 추가 API가 없음 → 텍스트 알림으로 대체.

**한계:**
- Teams 리액션은 제한적 (`like`, `heart`, `laugh`, `surprised`, `sad`, `angry` 6종)
- Slack → Teams: API로 리액션 추가 불가 → 텍스트 알림으로 대체
- Teams 이모지 ↔ Slack 이모지 매핑 테이블 필요

**난이도: 중간** — updated 알림에서 reactions 변화 감지가 핵심

---

## 3. 구현 설계

### Phase 1: 스레드/댓글 지원 (Teams)

#### 3.1.1 Graph API 메시지 → Activity Dict 변환에 replyToId 추가

**파일**: `backend/app/api/teams_notifications.py` — `_graph_message_to_activity_dict()`

```python
# Graph API 메시지에서 replyToId 추출 → activity_dict에 포함
return {
    ...existing fields...
    "replyToId": msg_data.get("replyToId"),  # 추가
}
```

#### 3.1.2 Teams Provider — transform_to_common()에서 thread_id 매핑

**파일**: `backend/app/adapters/teams_provider.py` — `transform_to_common()`

```python
# replyToId가 있으면 thread_id로 매핑
reply_to_id = raw_message.get("replyToId")
thread_id = reply_to_id if reply_to_id else None

return CommonMessage(
    ...existing fields...
    thread_id=thread_id,  # 추가
)
```

#### 3.1.3 Teams Provider — send_message()에서 replies 엔드포인트 분기

**파일**: `backend/app/adapters/teams_provider.py` — `_send_via_graph_delegated()`

```python
# thread_id가 있으면 replies 엔드포인트 사용
if message.thread_id and team_id:
    url = (
        f"{self.graph_base_url}/teams/{team_id}"
        f"/channels/{channel_id}/messages/{message.thread_id}/replies"
    )
else:
    url = (
        f"{self.graph_base_url}/teams/{team_id}"
        f"/channels/{channel_id}/messages"
    )
```

#### 3.1.4 WebSocket Bridge — 변경 없음

기존 `thread_mapping` 인프라가 플랫폼 무관하게 동작하므로 추가 수정 불필요.
Route Manager의 `save_thread_mapping()`과 `get_thread_mapping()`이 Slack ↔ Teams 간 thread ID를 자동 매핑.

---

### Phase 2: 편집/삭제 알림 전달

#### 3.2.1 구독 changeType 확장

**파일**: `backend/app/services/teams_subscription_manager.py` — `_create_subscription()`

```python
# 기존
"changeType": "created",

# 변경: 생성 + 수정 + 삭제 모두 구독
"changeType": "created,updated,deleted",
```

#### 3.2.2 알림 핸들러 — updated/deleted 처리 추가

**파일**: `backend/app/api/teams_notifications.py` — `_process_notification()`

```python
# 기존: created만 처리
if change_type != "created":
    return

# 변경: created, updated, deleted 분기 처리
if change_type == "created":
    await _process_created(notification, teams_provider)
elif change_type == "updated":
    await _process_updated(notification, teams_provider)
elif change_type == "deleted":
    await _process_deleted(notification, teams_provider)
```

**편집 처리 (`_process_updated`):**
- Graph API로 메시지 재조회 → `lastModifiedDateTime` vs `createdDateTime` 비교
- 텍스트가 실제로 변경된 경우만 `is_edited=True` + ` _(edited)_` 접미
- 리액션만 변경된 경우 → Phase 3에서 처리

**삭제 처리 (`_process_deleted`):**
- 삭제된 메시지는 Graph API로 조회 불가 → resource 경로에서 ID만 추출
- SYSTEM 타입 메시지 생성: `~메시지가 삭제되었습니다~ _(deleted)_`
- `message_id = "{원본ID}_deleted"` 형식

#### 3.2.3 WebSocket Bridge — Teams 편집/삭제 플랫폼 조건 완화

**파일**: `backend/app/services/websocket_bridge.py`

```python
# 편집 처리 (line 435)
# 기존: platform == "slack"
# 변경: platform in ("slack", "teams")
if message.is_edited and message_mode == "editable" and platform in ("slack", "teams"):

# 삭제 처리 (line 493)
# 기존: platform == "slack"
# 변경: platform in ("slack", "teams")
elif ... and message_mode == "editable" and platform in ("slack", "teams"):
```

#### 3.2.4 크로스 플랫폼 전달 전략

| 시나리오 | 동작 |
|---------|------|
| Slack 편집 → Teams | 새 메시지: `**[편집됨]** {수정된 텍스트}` |
| Teams 편집 → Slack (sender_info 모드) | 새 메시지: `**[편집됨]** {수정된 텍스트}` |
| Teams 편집 → Slack (editable 모드) | `chat.update`로 실제 수정 (기존 로직) |
| Slack 삭제 → Teams | 새 메시지: `~메시지가 삭제되었습니다~` |
| Teams 삭제 → Slack (sender_info 모드) | 새 메시지: `~메시지가 삭제되었습니다~` |
| Teams 삭제 → Slack (editable 모드) | `chat.delete`로 실제 삭제 (기존 로직) |

---

### Phase 3: 리액션 전달

#### 3.3.1 이모지 매핑 테이블

**파일**: `backend/app/utils/emoji_mapper.py` (신규)

Teams는 6가지 고정 리액션만 제공:

```python
TEAMS_TO_SLACK_EMOJI: dict[str, str] = {
    "like": "+1",
    "heart": "heart",
    "laugh": "joy",
    "surprised": "open_mouth",
    "sad": "cry",
    "angry": "angry",
}

SLACK_TO_TEAMS_EMOJI: dict[str, str] = {v: k for k, v in TEAMS_TO_SLACK_EMOJI.items()}
```

#### 3.3.2 Teams → Slack 리액션 감지

**파일**: `backend/app/api/teams_notifications.py` — `_process_updated()`

Graph API `changeType: "updated"` 알림에서 리액션 변화 감지:

```python
# 메시지 재조회 → reactions 필드 확인
# reactions 배열의 변화를 이전 상태와 비교하여 새 리액션 추출
# REACTION 타입 CommonMessage 생성 → 큐 삽입
```

**한계**: Graph API는 리액션 변화만을 위한 별도 알림이 없음. `updated` 알림에서 텍스트 변경과 리액션 변경을 구분해야 함.

#### 3.3.3 Slack Provider — 리액션 추가 API 호출

Teams에서 온 리액션을 Slack에 실제 이모지로 추가:

```python
# slack_provider.py — send_message() 내 REACTION 타입 분기
if message.type == MessageType.REACTION and message.thread_id:
    emoji = message.text.split(":")[1]  # ":+1: by @user" → "+1"
    await self.app.client.reactions_add(
        channel=channel_id,
        name=emoji,
        timestamp=message.thread_id,
    )
    return True
```

#### 3.3.4 크로스 플랫폼 전달 전략

| 시나리오 | 동작 |
|---------|------|
| Slack → Teams | 텍스트 메시지: `:{emoji}: by @{user}` (Teams API에 리액션 추가 불가) |
| Teams → Slack (매핑 가능) | `reactions.add` API로 실제 이모지 추가 |
| Teams → Slack (매핑 불가) | 텍스트 폴백: `:{teams_emoji}: by @{user}` |

---

## 4. 수정 파일 요약

| Phase | 파일 | 변경 내용 |
|-------|------|----------|
| 1 | `teams_notifications.py` | `_graph_message_to_activity_dict()` — replyToId 추가 |
| 1 | `teams_provider.py` | `transform_to_common()` — thread_id 매핑 |
| 1 | `teams_provider.py` | `_send_via_graph_delegated()` — /replies 엔드포인트 분기 |
| 2 | `teams_subscription_manager.py` | `changeType` → `"created,updated,deleted"` |
| 2 | `teams_notifications.py` | `_process_notification()` — updated/deleted 분기 처리 |
| 2 | `websocket_bridge.py` | 편집/삭제 플랫폼 조건 완화 (`"teams"` 추가) |
| 3 | `utils/emoji_mapper.py` | 이모지 매핑 테이블 (신규) |
| 3 | `teams_notifications.py` | `_process_updated()` — 리액션 변화 감지 |
| 3 | `slack_provider.py` | `send_message()` — REACTION 타입 분기 |
| ALL | `feature_catalog.py` | 4개 기능 상태 업데이트 |

---

## 5. 구현 우선순위

| 순위 | 기능 | 난이도 | 이유 |
|------|------|--------|------|
| 1 | **스레드/댓글 지원** | 중간 | 기존 인프라 활용, UX 가치 높음 |
| 2 | **편집 알림 전달** | 중간 | 구독 확장 + 알림 처리 추가 |
| 3 | **삭제 알림 전달** | 낮음 | 편집과 동일 패턴, 메시지 조회 불필요 |
| 4 | **리액션 전달** | 중간 | updated 알림에서 리액션 변화 감지 필요 |

---

## 6. 제약 사항 및 알려진 한계

### Teams API 권한 제약
- **메시지 수정/삭제 API**: `ChannelMessage.UpdatePolicyViolation.All` 권한 필요 (일반 앱 등록 불가). **알림 방식**으로 구현.
- **리액션 추가 API**: Teams Graph API에 리액션 추가 엔드포인트 없음. Slack → Teams 리액션은 텍스트 메시지로 대체.

### Graph API Change Notifications 제약
- `changeType: "updated"` 알림은 텍스트 편집뿐 아니라 리액션 변경, 메시지 속성 변경 등 모든 업데이트에 발생 → 변경 유형 구분 로직 필요
- `changeType: "deleted"` 시 삭제된 메시지 본문 조회 불가 → 삭제 사실만 전달 가능
- 구독 수명 최대 60분 → `TeamsSubscriptionManager`의 50분 갱신 주기로 대응 (기존 인프라)

### Teams 리액션 제한
- Teams는 6종 고정 리액션만 제공 (`like`, `heart`, `laugh`, `surprised`, `sad`, `angry`)
- Slack의 커스텀 이모지는 Teams로 전달 시 텍스트 폴백

### DM/그룹 채팅 제한
- 스레드(reply chain)는 Teams 채널 메시지에서만 지원
- DM/그룹 채팅에서는 일반 메시지로 전송

---

## 7. 검증 방법

### 스레드/댓글
1. Slack에서 스레드 답글 작성 → Teams 채널에 reply로 전달 확인
2. Teams 채널에서 reply 작성 → Slack 스레드에 답글로 전달 확인
3. Route Manager의 thread_mapping 저장 확인 (Redis)

### 편집/삭제 알림
1. Teams 메시지 편집 → Slack에 `_(edited)_` 알림 메시지 확인
2. Teams 메시지 삭제 → Slack에 `~삭제됨~` 알림 메시지 확인
3. Slack 메시지 편집 → Teams에 `[편집됨]` 알림 메시지 확인

### 리액션
1. Teams에서 `like` 리액션 → Slack에 `:+1:` 이모지 추가 확인
2. Slack에서 이모지 리액션 → Teams에 텍스트 알림 확인
3. 매핑 불가한 이모지의 텍스트 폴백 확인
