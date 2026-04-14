---
title: Slack 앱 설정 가이드
sidebar_position: 4
---

# Slack 앱 설정 가이드

Slack 워크스페이스에 봇을 등록하고, v-channel-bridge가 Socket Mode로 실시간 메시지를 수신/발송할 수 있도록 설정하는 방법을 안내합니다.

---

## 전체 흐름 요약

1. Slack API 포털에서 앱 생성
2. Socket Mode 활성화 및 App-Level Token 발급
3. Bot Token Scope 설정
4. Event Subscriptions 설정
5. 워크스페이스에 봇 설치 및 Bot Token 발급
6. `.env` 파일에 토큰 반영
7. 채널에 봇 초대
8. 관리자 UI에서 라우트 등록

---

## 1. Slack 앱 생성

1. [Slack API 포털](https://api.slack.com/apps)에 접속합니다.
2. **Create New App** > **From scratch**를 선택합니다.
3. 앱 이름과 워크스페이스를 지정합니다.
   - **App Name**: `v-channel-bridge` (원하는 이름 가능)
   - **Workspace**: 연동할 Slack 워크스페이스
4. **Create App**을 클릭합니다.

---

## 2. Socket Mode 활성화

v-channel-bridge의 `SlackProvider`는 **Socket Mode**를 사용합니다. Socket Mode를 사용하면 방화벽 인바운드 설정 없이 실시간 이벤트를 수신할 수 있습니다.

1. 좌측 메뉴에서 **Socket Mode**를 클릭합니다.
2. **Enable Socket Mode**를 ON으로 설정합니다.
3. App-Level Token 이름을 입력합니다 (예: `socket-token`).
4. Scope에 `connections:write`를 추가합니다.
5. **Generate**를 클릭합니다.
6. 생성된 **App-Level Token**을 복사합니다. 이 토큰은 `xapp-`로 시작합니다.

이 토큰은 나중에 `.env`의 `SLACK_APP_TOKEN`에 입력합니다.

---

## 3. Bot Token Scope 설정

좌측 메뉴에서 **OAuth & Permissions**를 클릭하고, **Bot Token Scopes** 섹션에서 다음 권한을 추가합니다.

### 필수 Scope

| Scope | 설명 |
|-------|------|
| `chat:write` | 메시지 전송 |
| `chat:write.public` | 봇이 멤버가 아닌 공개 채널에도 메시지 전송 |
| `channels:read` | 공개 채널 정보 읽기 |
| `channels:history` | 공개 채널 메시지 히스토리 읽기 |
| `groups:read` | 비공개 채널 정보 읽기 |
| `groups:history` | 비공개 채널 메시지 히스토리 읽기 |
| `users:read` | 사용자 정보 읽기 (발신자 표시에 필요) |
| `files:read` | 파일 정보 읽기 (첨부 파일 전달에 필요) |
| `files:write` | 파일 업로드 (타 플랫폼 첨부 파일을 Slack에 전달할 때 필요) |
| `app_mentions:read` | 봇 멘션 이벤트 읽기 |

### 선택 Scope (DM/그룹챗 브리지 시)

| Scope | 설명 |
|-------|------|
| `im:history` | 다이렉트 메시지 히스토리 읽기 |
| `im:read` | 다이렉트 메시지 정보 읽기 |
| `im:write` | 다이렉트 메시지 전송 |
| `mpim:history` | 그룹 DM 히스토리 읽기 |
| `mpim:read` | 그룹 DM 정보 읽기 |
| `mpim:write` | 그룹 DM 전송 |
| `reactions:read` | 리액션 읽기 |
| `reactions:write` | 리액션 추가 |

---

## 4. Event Subscriptions 설정

1. 좌측 메뉴에서 **Event Subscriptions**를 클릭합니다.
2. **Enable Events**를 ON으로 설정합니다.
3. **Subscribe to bot events**에서 다음 이벤트를 추가합니다.

| 이벤트 | 설명 |
|--------|------|
| `message.channels` | 공개 채널 메시지 수신 |
| `message.groups` | 비공개 채널 메시지 수신 |

Socket Mode를 사용하므로 Request URL은 별도로 설정하지 않아도 됩니다.

### 선택 이벤트 (DM/그룹챗 브리지 시)

| 이벤트 | 설명 |
|--------|------|
| `message.im` | 다이렉트 메시지 수신 |
| `message.mpim` | 그룹 DM 수신 |

---

## 5. 워크스페이스에 봇 설치 및 Bot Token 발급

1. 좌측 메뉴에서 **OAuth & Permissions**로 이동합니다.
2. 상단의 **Install to Workspace**를 클릭합니다.
3. 권한 요청 화면을 확인하고 **Allow**를 클릭합니다.
4. **Bot User OAuth Token**을 복사합니다. 이 토큰은 `xoxb-`로 시작합니다.

이 토큰은 `.env`의 `SLACK_BOT_TOKEN`에 입력합니다.

> Scope를 변경한 후에는 반드시 워크스페이스에 봇을 **재설치**해야 변경사항이 반영됩니다.

---

## 6. 환경 변수 설정

프로젝트 루트의 `.env` 파일에 다음 값을 추가합니다.

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-level-token-here
```

v-channel-bridge는 시작 시 `.env`의 토큰을 DB(`accounts` 테이블)로 자동 마이그레이션합니다. `apps/v-channel-bridge/backend/app/main.py`의 `migrate_env_to_db()` 함수가 이 작업을 수행합니다. 이미 DB에 동일 계정이 있으면 중복 생성하지 않습니다.

---

## 7. 채널에 봇 초대

메시지를 브리지할 Slack 채널에 봇을 초대합니다.

```
/invite @v-channel-bridge
```

또는 채널 설정 > **Integrations** > **Add an App**에서 추가할 수 있습니다.

봇이 초대되지 않은 채널에 메시지를 보내면 `not_in_channel` 오류가 발생합니다.

---

## 8. 라우트 등록 (관리자 UI)

봇 설정이 완료되면 v-channel-bridge 관리자 화면에서 라우트를 등록합니다.

1. 브라우저에서 `http://127.0.0.1:5173`에 접속합니다.
2. 관리자 계정으로 로그인합니다.
3. 좌측 메뉴에서 **Channels** 페이지로 이동합니다.
4. **라우트 추가** 버튼을 클릭합니다.
5. 소스 플랫폼(Slack)과 채널, 타겟 플랫폼(Teams)과 채널을 선택합니다.
6. 메시지 모드(`sender_info` 또는 `editable`)와 양방향 여부를 설정합니다.
7. **저장**을 클릭합니다.

라우트가 등록되면 Redis에 `route:slack:{channel_id}` 키가 생성되고, 해당 채널의 메시지가 타겟 채널로 전달되기 시작합니다.

---

## 서비스 시작 및 연결 확인

```bash
# v-channel-bridge 전체 시작
docker compose up -d --build

# 백엔드 로그에서 Slack 연결 확인
docker logs v-channel-bridge-backend --tail=50 | grep -i slack
```

정상 연결 시 다음과 같은 로그가 출력됩니다.

```
INFO: Slack Provider registered: slack-default
INFO: v-channel-bridge started
```

---

## 자주 묻는 질문

### Scope 변경 후 반영이 안 됩니다

Scope를 추가하거나 변경한 후에는 **OAuth & Permissions** 페이지에서 봇을 워크스페이스에 **재설치**해야 합니다. 재설치하지 않으면 `missing_scope` 오류가 발생합니다.

### Socket Mode와 HTTP 방식의 차이가 무엇인가요

Socket Mode는 봇이 Slack 서버로 WebSocket 연결을 맺고 이벤트를 수신합니다. HTTP 방식과 달리 공인 IP나 인바운드 방화벽 규칙이 필요 없어 내부망 환경에서도 사용할 수 있습니다. v-channel-bridge의 `SlackProvider`(`apps/v-channel-bridge/backend/app/adapters/slack_provider.py`)는 `slack_bolt`의 `AsyncSocketModeHandler`를 사용합니다.

### 메시지 모드 `sender_info`와 `editable`의 차이

- **sender_info**: 브리지된 메시지에 원래 발신자의 이름과 아바타를 표시합니다. 단, `username`/`icon_url` 파라미터를 사용하므로 메시지 편집/삭제가 불가합니다.
- **editable**: 발신자 정보 없이 봇 이름으로 메시지를 전송합니다. 메시지 편집/삭제 동기화가 가능합니다.

---

## 관련 문서

- [Teams 설정 가이드](./TEAMS_SETUP.md)
- [트러블슈팅](./TROUBLESHOOTING.md)

---

**최종 업데이트**: 2026-04-13
