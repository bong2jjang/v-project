# 채팅방(DM/그룹챗) 지원 설계

**작성일**: 2026-04-06
**상태**: 구현 중

## 1. 배경

현재 Route 추가 시 Slack 채널(public/private)과 Teams 채널만 선택 가능하며, DM(1:1 메시지)이나 그룹 채팅방은 조회 및 라우팅이 불가능함.

사용자가 채팅방 간 브리지 라우팅을 설정할 수 있도록 양쪽 플랫폼의 채팅방 조회, 메시지 수신/전송을 지원해야 함.

## 2. 설계 결정

### 2.1 ChannelType Enum

`Channel` 스키마에 `type` 필드 추가:

| 값 | 설명 | Slack 대응 | Teams 대응 |
|---|---|---|---|
| `channel` | 일반 채널 | public_channel, private_channel | Team Channel |
| `dm` | 1:1 다이렉트 메시지 | im (D prefix) | oneOnOne chat |
| `group_dm` | 그룹 채팅 | mpim (G prefix) | group chat |

기본값은 `channel`로 설정하여 하위 호환성 보장.

### 2.2 Teams 채팅 ID 식별
기존 Teams 채널 ID 형식: `{teamId}:{channelId}` (예: `c070ebee-...:19:abc@thread.tacv2`)

채팅 ID는 `chat:` 접두사로 구분:
- 채널: `c070ebee-...:19:abc@thread.tacv2` (기존 그대로)
- 채팅: `chat:19:abc@unq.gbl.spaces` 또는 `chat:{chatId}`

`_parse_channel_ref()`에서 `chat:` 접두사 감지 시 `(None, chatId)` 반환 → `send_message()`가 `/chats/{chatId}/messages` 엔드포인트 사용.

### 2.3 플랫폼별 API

#### Slack
- 기존: `conversations_list(types="public_channel,private_channel")`
- 변경: `conversations_list(types="public_channel,private_channel,im,mpim")`
- `send_message`: `chat.postMessage` — 채널/DM 구분 없이 동일 API

#### Teams
- 기존: `GET /teams/{teamId}/channels`
- 추가: `GET /chats` (필요 권한: `Chat.Read.All`)
- `send_message` 분기:
  - 채널: `POST /teams/{teamId}/channels/{channelId}/messages`
  - 채팅: `POST /chats/{chatId}/messages`

### 2.4 UI 그룹핑

채널 드롭다운에서 `<optgroup>`으로 시각적 구분:
- 채널 (Channels)
- 다이렉트 메시지 (Direct Messages)
- 그룹 채팅 (Group Chats)

## 3. 수정 범위

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/schemas/common_message.py` | ChannelType enum, Channel.type 필드 |
| `backend/app/adapters/slack_provider.py` | get_channels im/mpim, transform_to_common 타입 |
| `backend/app/adapters/teams_provider.py` | get_channels /chats, send_message 분기, _parse_channel_ref |
| `backend/app/api/bridge.py` | 응답 type 필드 반영 |
| `frontend/src/components/channels/ChannelInputField.tsx` | optgroup 그룹핑 |

## 4. 제약 사항

- **Teams Chat.Read.All 권한**: Azure 관리자 동의 필요. 권한 미부여 시 채팅 목록 조회 실패 → 채널만 반환 (graceful fallback)
- **파일 업로드**: Teams 채팅에서의 파일 업로드는 채널과 다른 API 사용 → 1차 구현에서는 텍스트 fallback, 후속 작업으로 분리
- **Slack DM 이름**: DM은 채널명 대신 상대방 사용자 ID만 반환됨 → 사용자명 조회 필요

## 5. 라우팅 호환성

Redis 라우팅 키는 `route:{platform}:{channel_id}` 형식으로, 채팅 ID도 동일 패턴으로 저장:
- `route:slack:D01ABCDEF` (Slack DM)
- `route:teams:chat:19:abc@unq.gbl.spaces` (Teams 채팅)

기존 채널 라우트에는 영향 없음.
