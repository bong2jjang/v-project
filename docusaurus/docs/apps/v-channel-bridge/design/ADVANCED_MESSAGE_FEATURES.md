---
title: 고급 메시지 기능 설계
sidebar_position: 8
---

# 고급 메시지 기능 설계

v-channel-bridge가 Slack과 Microsoft Teams 사이에서 텍스트 이외의 메시지 요소(첨부 파일, 멘션, 스레드, 이모지 리액션, 코드 블록, 마크다운)를 처리하는 방식을 설명합니다. 각 기능의 플랫폼별 차이, CommonMessage 추상화 전략, 현재 구현 상태, 향후 확장 방향을 다룹니다.

---

## CommonMessage 추상화 원칙

Slack과 Teams는 메시지 포맷, API 구조, 기능 범위가 서로 다릅니다. v-channel-bridge는 `CommonMessage` 스키마(`apps/v-channel-bridge/backend/app/schemas/common_message.py`)를 중간 표현으로 사용하여 이 차이를 흡수합니다.

각 Provider의 `transform_to_common()` 메서드가 플랫폼 원본 메시지를 CommonMessage로 변환하고, `transform_from_common()`이 CommonMessage를 타겟 플랫폼 형식으로 변환합니다. 고급 메시지 기능은 이 변환 과정에서 플랫폼별 차이를 처리합니다.

### MessageType 분류

| 타입 | 설명 | 사용 예시 |
|------|------|----------|
| `TEXT` | 일반 텍스트/마크다운 메시지 | 대부분의 채팅 메시지 |
| `FILE` | 파일 첨부 메시지 | PDF, DOCX, ZIP 등 |
| `IMAGE` | 이미지 첨부 메시지 | PNG, JPEG, GIF, WebP |
| `REACTION` | 리액션(이모지 반응) 이벤트 | 좋아요, 하트 등 |
| `COMMAND` | 명령어 메시지 | `/bridge status` 등 |
| `SYSTEM` | 시스템 알림 메시지 | 삭제 알림, 연결 상태 등 |

---

## 1. 첨부 파일 처리

### 처리 흐름

첨부 파일은 소스 플랫폼에서 다운로드한 뒤 타겟 플랫폼으로 업로드하는 2단계로 처리됩니다. `WebSocketBridge._send_message()`(`apps/v-channel-bridge/backend/app/services/websocket_bridge.py`)에서 이 과정을 관리합니다.

1. 소스 Provider가 메시지를 수신하면, 첨부 파일 URL과 메타데이터를 `CommonMessage.attachments` 배열에 담습니다.
2. `_send_message()`에서 `AttachmentHandler.download_file()`을 호출하여 임시 디렉토리에 파일을 다운로드합니다.
3. 다운로드가 완료되면 `Attachment.local_path`에 로컬 경로가 채워집니다.
4. 타겟 Provider의 `send_message()`가 `local_path`를 읽어 해당 플랫폼 API로 업로드합니다.

여러 첨부 파일이 있는 경우 `asyncio.gather()`를 사용하여 병렬 다운로드합니다.

### Attachment 모델

`CommonMessage.attachments`는 `Attachment` 모델의 배열입니다. 주요 필드는 다음과 같습니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `filename` | `str` | 파일 이름 |
| `url` | `str` | 소스 플랫폼의 파일 다운로드 URL |
| `content_type` | `str` | MIME 타입 (예: `image/png`, `application/pdf`) |
| `size` | `int` (선택) | 파일 크기 (바이트) |
| `local_path` | `str` (선택) | 다운로드 완료 후 로컬 임시 경로 |
| `download_status` | `str` | 상태: `pending` -> `downloaded` -> `uploaded` 또는 `failed` |

`download_status`는 파일 전달의 생애주기를 추적합니다. 초기값은 `pending`이고, 다운로드 성공 시 `downloaded`, 타겟 플랫폼 업로드 성공 시 `uploaded`, 어느 단계에서든 실패하면 `failed`로 변경됩니다.

### 지원 파일 형식과 크기 제한

`AttachmentHandler`(`apps/v-channel-bridge/backend/app/utils/attachment_handler.py`)에 정의된 제한 사항입니다.

**이미지 파일** (최대 10MB):

| MIME 타입 | 확장자 |
|----------|--------|
| `image/png` | .png |
| `image/jpeg`, `image/jpg` | .jpeg, .jpg |
| `image/gif` | .gif |
| `image/webp` | .webp |

**일반 파일** (최대 20MB):

| MIME 타입 | 확장자 |
|----------|--------|
| `application/pdf` | .pdf |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | .xlsx |
| `application/zip` | .zip |
| `text/plain` | .txt |

크기 제한을 초과하는 파일이나 지원하지 않는 MIME 타입의 파일은 다운로드를 건너뛰고, 텍스트 메시지에 파일 이름과 URL만 포함하여 전달합니다.

### 임시 디렉토리

다운로드된 파일은 `/tmp/vms-attachments/` 디렉토리에 저장됩니다. Docker 컨테이너 내부 경로이며, 전송 완료 후 정리됩니다.

### 플랫폼별 차이

| 항목 | Slack | Teams |
|------|-------|-------|
| 파일 접근 방식 | `files:read` scope + Bot Token 인증 헤더 | Graph API 파일 엔드포인트 |
| 업로드 방식 | `files.upload` API | Graph API 또는 Bot Framework Activity |
| 인라인 이미지 | 지원 | 지원 |
| 파일 공유 이벤트 | `file_share` 서브타입 | Graph API Change Notification |

Slack에서 파일을 다운로드할 때는 Bot Token을 `Authorization: Bearer {token}` 헤더에 포함해야 합니다. `files:read` scope가 없으면 파일 URL에 접근할 수 없습니다.

---

## 2. 마크다운 변환

Slack과 Teams는 서로 다른 마크다운 문법을 사용합니다. `message_formatter.py`(`apps/v-channel-bridge/backend/app/utils/message_formatter.py`)가 양방향 변환을 처리합니다.

### 변환 규칙

| 서식 | Slack 문법 | Teams 문법 | 변환 방향 |
|------|-----------|-----------|----------|
| 굵게 | `*bold*` | `**bold**` | 양방향 |
| 기울임 | `_italic_` | `*italic*` | 양방향 |
| 취소선 | `~strike~` | `~~strike~~` | 양방향 |
| 인라인 코드 | `` `code` `` | `` `code` `` | 동일 (변환 불필요) |
| 코드 블록 | ```` ```code``` ```` | ```` ```code``` ```` | 동일 (변환 불필요) |

### 코드 블록 보존 전략

코드 블록과 인라인 코드는 Slack과 Teams에서 동일한 문법을 사용하므로 변환이 필요하지 않습니다. 그러나 코드 블록 내부의 텍스트가 마크다운 변환에 의해 잘못 변경되는 것을 방지해야 합니다.

`message_formatter.py`는 다음 전략을 사용합니다.

1. 변환 전에 코드 블록(```` ``` ````)과 인라인 코드(`` ` ``)를 임시 플레이스홀더로 교체합니다.
2. 나머지 텍스트에 대해 마크다운 변환을 수행합니다.
3. 변환 후 플레이스홀더를 원래 코드 내용으로 복원합니다.

이 방식으로 코드 내부의 `*`, `_`, `~` 같은 문자가 서식으로 오해석되는 것을 방지합니다.

### 메시지 포맷 감지

`detect_message_format()` 함수는 메시지 텍스트를 분석하여 `"text"`, `"markdown"`, `"code"` 중 하나를 반환합니다. 이 정보는 변환 필요 여부를 판단하는 데 사용됩니다.

---

## 3. 멘션 변환

Slack과 Teams의 멘션 형식은 근본적으로 다릅니다. 크로스 플랫폼 멘션은 텍스트 형식으로 변환됩니다.

### Slack 멘션 형식

Slack은 멘션을 다음과 같은 특수 구문으로 표현합니다.

- 사용자 멘션: `<@U123456>` -- 사용자 ID로 참조
- 채널 멘션: `<#C789012|channel-name>` -- 채널 ID와 이름으로 참조

### 변환 처리

`convert_slack_mentions_to_text()`(`apps/v-channel-bridge/backend/app/utils/message_formatter.py`)가 Slack 멘션을 사람이 읽을 수 있는 텍스트로 변환합니다.

| 원본 (Slack) | 변환 결과 | 설명 |
|-------------|----------|------|
| `<@U123456>` | `@username` | Slack API로 사용자 이름 조회 |
| `<#C789012\|general>` | `#general` | 파이프 뒤의 채널 이름 사용 |

사용자 멘션 변환 시 Slack `users_info` API를 호출하여 display_name을 조회합니다. API 호출이 실패하면 사용자 ID를 그대로 사용합니다 (예: `@U123456`).

### 플랫폼별 차이

| 항목 | Slack | Teams |
|------|-------|-------|
| 멘션 형식 | `<@USER_ID>` | `<at>사용자이름</at>` |
| 채널 참조 | `<#CHANNEL_ID\|name>` | 텍스트 형식 |
| 크로스 플랫폼 전달 시 | 텍스트로 변환 (`@이름`) | 텍스트로 변환 (`@이름`) |

현재 구현에서는 크로스 플랫폼 멘션을 네이티브 멘션(알림이 울리는 형태)으로 전달하지 않고, 텍스트 형식으로 변환합니다. 이는 타겟 플랫폼의 사용자 ID를 소스 플랫폼의 사용자 ID로 매핑하는 인프라가 필요하기 때문입니다.

---

## 4. 스레드(답글) 매핑

Slack과 Teams 모두 스레드(답글 체인)를 지원하지만 구조가 다릅니다. v-channel-bridge는 Redis 기반 스레드 매핑으로 크로스 플랫폼 스레드를 연결합니다.

### 플랫폼별 스레드 구조

| 항목 | Slack | Teams |
|------|-------|-------|
| 스레드 식별자 | `thread_ts` (첫 메시지의 타임스탬프) | `replyToId` (부모 메시지 ID) |
| 스레드 시작 | 메시지에 답글 달면 자동 생성 | 채널 메시지에 reply로 생성 |
| 답글 API | `chat.postMessage`에 `thread_ts` 포함 | `POST /messages/{id}/replies` |
| DM에서 스레드 | 지원 | 미지원 (채널 메시지에서만 동작) |

### CommonMessage의 스레드 필드

| 필드 | 설명 |
|------|------|
| `thread_id` | 부모 메시지 식별자. Slack에서는 `thread_ts`, Teams에서는 부모 메시지 ID |
| `parent_id` | 직접 부모 메시지의 ID (선택) |

### Redis 스레드 매핑

`RouteManager`(`apps/v-channel-bridge/backend/app/services/route_manager.py`)가 스레드 매핑을 Redis에 저장합니다.

**키 형식**: `thread:{platform}:{channel}:{timestamp}`

**저장 값**: `{target_platform}:{target_channel}:{target_timestamp}`

**TTL**: 7일 (`setex` 사용)

Slack에서 스레드 메시지가 발생하면, `WebSocketBridge`가 Redis에서 해당 스레드의 타겟 플랫폼 매핑을 조회합니다. 매핑이 존재하면 타겟 플랫폼의 해당 스레드에 답글로 전달합니다. 매핑이 없으면 일반 메시지로 전달하고, 새 매핑을 저장합니다.

7일 TTL은 오래된 스레드 매핑이 Redis 메모리를 점유하는 것을 방지합니다. 7일이 지난 스레드에 답글이 달리면 새 메시지로 전달됩니다.

---

## 5. 이모지 리액션 전달

### 플랫폼별 리액션 차이

| 항목 | Slack | Teams |
|------|-------|-------|
| 리액션 종류 | 수천 개 (커스텀 이모지 포함) | 6개 고정 (`like`, `heart`, `laugh`, `surprised`, `sad`, `angry`) |
| 리액션 추가 API | `reactions.add` | 없음 (Graph API에 리액션 추가 엔드포인트 미제공) |
| 리액션 이벤트 | `reaction_added` 개별 이벤트 | Graph API `changeType: "updated"`에 포함 |

### 이모지 매핑 테이블

`emoji_mapper.py`(`apps/v-channel-bridge/backend/app/utils/emoji_mapper.py`)에 정의된 매핑입니다.

**Teams -> Slack 매핑**:

| Teams 리액션 | Slack 이모지 |
|-------------|------------|
| `like` | `:+1:` |
| `heart` | `:heart:` |
| `laugh` | `:joy:` |
| `surprised` | `:open_mouth:` |
| `sad` | `:cry:` |
| `angry` | `:angry:` |

Teams의 유니코드 이모지 문자도 `TEAMS_EMOJI_CHAR_TO_SLACK` 딕셔너리를 통해 Slack 이모지 이름으로 매핑됩니다.

역방향 매핑(`SLACK_TO_TEAMS_EMOJI`)은 `TEAMS_TO_SLACK_EMOJI`의 키-값을 뒤집어 자동 생성됩니다.

### 현재 구현 상태

**Slack -> Teams 리액션**: Slack의 `reaction_added` 이벤트가 발생하면, `SlackProvider`가 `REACTION` 타입의 CommonMessage를 생성합니다. Teams에는 리액션 추가 API가 없으므로, 텍스트 메시지로 대체합니다 (예: `:{emoji}: by @{username}`).

**Teams -> Slack 리액션**: Teams의 Graph API에서 `changeType: "updated"` 알림 시 메시지의 `reactions` 필드 변화를 감지하여 리액션을 추출할 수 있습니다. 매핑 가능한 이모지는 Slack `reactions.add` API로 실제 리액션을 추가하고, 매핑할 수 없는 이모지는 텍스트 폴백을 사용합니다.

### 제한 사항

- Teams는 6종 고정 리액션만 지원하므로, Slack의 커스텀 이모지나 수천 개의 표준 이모지 중 대부분은 Teams로 전달할 수 없습니다.
- Slack -> Teams 방향에서 리액션을 네이티브로 추가하는 것은 Teams Graph API의 한계로 불가능합니다.

---

## 6. 편집/삭제 메시지 처리

### 편집 메시지

Slack에서 메시지를 편집하면 `message_changed` 이벤트가 발생합니다. `SlackProvider`의 `_handle_message_edited()` 핸들러가 이를 처리합니다.

1. 편집된 메시지를 CommonMessage로 변환합니다 (`is_edited=True`).
2. 텍스트 끝에 ` _(edited)_` 접미사를 추가합니다.
3. 메시지 모드에 따라 타겟 플랫폼에서의 동작이 달라집니다.

| 메시지 모드 | 동작 |
|------------|------|
| `editable` 모드 | 타겟 플랫폼의 기존 메시지를 실제로 수정합니다 (Slack: `chat.update` API) |
| `sender_info` 모드 | 편집 알림을 새 메시지로 전달합니다 |

### 삭제 메시지

Slack에서 메시지를 삭제하면 `message_deleted` 이벤트가 발생합니다. `SlackProvider`의 `_handle_message_deleted()` 핸들러가 이를 처리합니다.

1. `SYSTEM` 타입의 CommonMessage를 생성합니다.
2. 텍스트: `~메시지가 삭제되었습니다~`
3. 메시지 모드에 따라 타겟 플랫폼에서의 동작이 달라집니다.

| 메시지 모드 | 동작 |
|------------|------|
| `editable` 모드 | 타겟 플랫폼의 기존 메시지를 실제로 삭제합니다 (Slack: `chat.delete` API) |
| `sender_info` 모드 | 삭제 알림을 새 메시지로 전달합니다 |

### Teams API 제약

Teams Graph API에서 메시지 수정(`PATCH /messages/{id}`)과 삭제(`DELETE /messages/{id}`)는 `ChannelMessage.UpdatePolicyViolation.All` 특수 권한이 필요하며, 일반 앱 등록으로는 이 권한을 획득할 수 없습니다. 따라서 Teams를 타겟으로 하는 편집/삭제는 알림 메시지 방식으로 처리합니다.

---

## 7. 리액션 동기화와 다중 타겟 팬아웃

### 리액션 동기화

v-channel-bridge는 리액션 이벤트를 CommonMessage의 `REACTION` 타입으로 추상화합니다. `CommonMessage.reactions` 필드는 리액션 목록을 저장할 수 있으며, 각 리액션은 이모지 이름과 사용자 정보를 포함합니다.

리액션 동기화 흐름은 다음과 같습니다.

1. Slack에서 사용자가 메시지에 리액션을 추가합니다 (`reaction_added` 이벤트).
2. `SlackProvider`가 `REACTION` 타입 CommonMessage를 생성합니다.
3. `WebSocketBridge`가 라우팅 규칙에 따라 타겟 Provider로 전달합니다.
4. 타겟 Provider가 플랫폼에 맞는 방식으로 처리합니다 (API 리액션 추가 또는 텍스트 폴백).

### 다중 타겟 팬아웃

하나의 소스 채널에 여러 타겟 채널이 라우팅되어 있을 수 있습니다. `RouteManager.get_targets()`가 소스 채널에 대한 모든 타겟을 반환하면, `WebSocketBridge._route_message()`가 각 타겟에 대해 `_send_message()`를 호출합니다.

```
route:slack:C123 -> {teams:T456, slack:C789, teams:T012}
```

위 예시에서 Slack 채널 `C123`에 메시지가 도착하면, Teams 채널 2개와 Slack 채널 1개에 동시에 전달됩니다. 첨부 파일이 있는 경우 한 번만 다운로드하고, 각 타겟 Provider의 `send_message()`에서 업로드합니다.

이 팬아웃 구조는 텍스트 메시지뿐 아니라 편집, 삭제, 리액션 이벤트에도 동일하게 적용됩니다.

---

## 8. 플랫폼 제한 사항 종합

| 기능 | Slack -> Teams | Teams -> Slack | 비고 |
|------|---------------|---------------|------|
| 텍스트 메시지 | 완전 지원 | 완전 지원 | 마크다운 자동 변환 |
| 첨부 파일 | 다운로드 후 업로드 | 다운로드 후 업로드 | 크기/타입 제한 있음 |
| 멘션 | 텍스트 변환 (`@이름`) | 텍스트 변환 (`@이름`) | 네이티브 멘션 미지원 |
| 스레드 | Redis 매핑으로 연결 | Redis 매핑으로 연결 | Teams DM에서는 스레드 미지원 |
| 리액션 | 텍스트 폴백 | API로 추가 가능 (6종) | Teams에 리액션 추가 API 없음 |
| 편집 | 알림 메시지로 전달 | editable 모드: 실제 수정 | Teams PATCH API 권한 제약 |
| 삭제 | 알림 메시지로 전달 | editable 모드: 실제 삭제 | Teams DELETE API 권한 제약 |
| 코드 블록 | 그대로 보존 | 그대로 보존 | 양쪽 동일 문법 |
| 커스텀 이모지 | 텍스트 이름으로 전달 | 해당 없음 | Teams는 커스텀 이모지 미지원 |

---

## 9. 향후 확장 방향

### 네이티브 멘션 매핑

소스 플랫폼의 사용자 ID와 타겟 플랫폼의 사용자 ID를 매핑하는 테이블을 구축하면, 크로스 플랫폼 멘션을 네이티브 멘션으로 전달할 수 있습니다. 타겟 플랫폼에서 실제로 알림이 울리게 되므로 사용자 경험이 크게 개선됩니다.

### 새 Provider 추가 시 고려사항

`BasePlatformProvider`(`apps/v-channel-bridge/backend/app/adapters/base.py`)를 상속하여 새 플랫폼을 추가할 때, 다음 항목을 확인해야 합니다.

1. **마크다운 변환**: 새 플랫폼의 마크다운 문법이 다르다면 `message_formatter.py`에 변환 함수를 추가합니다.
2. **이모지 매핑**: 새 플랫폼의 리액션 체계에 맞는 매핑 테이블을 `emoji_mapper.py`에 추가합니다.
3. **첨부 파일**: 새 플랫폼의 파일 다운로드/업로드 API를 `AttachmentHandler`와 연동합니다.
4. **스레드**: 새 플랫폼의 스레드/답글 구조를 `thread_id`와 `parent_id`에 매핑합니다.
5. **멘션**: 새 플랫폼의 멘션 형식을 텍스트로 변환하는 함수를 구현합니다.

### 미지원 MIME 타입 확장

현재 지원하는 파일 형식 외에 추가 MIME 타입이 필요하다면, `attachment_handler.py`의 `SUPPORTED_IMAGE_TYPES`와 `SUPPORTED_FILE_TYPES` 집합에 항목을 추가합니다.

---

## 관련 문서

- [양방향 브리지 설계](./CHAT_SUPPORT.md)
- [Provider 설정 전략](./ENV_VS_DATABASE_PROVIDERS.md)
- [개발 가이드](../developer-guide/DEVELOPMENT.md)

---

**최종 업데이트**: 2026-04-13
