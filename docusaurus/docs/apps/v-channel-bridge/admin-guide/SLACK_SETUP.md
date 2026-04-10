---
id: slack-setup
title: Slack App 설정 가이드
sidebar_position: 4
tags: [guide, admin]
---

# Slack App 설정 가이드

VMS Chat Ops의 Slack Provider (Socket Mode)를 연동하기 위한 Slack App 설정 방법을 안내합니다.

---

## 1. Slack App 생성

1. [Slack API 페이지](https://api.slack.com/apps)에 접속합니다.
2. **"Create New App"** → **"From scratch"** 선택
3. App 이름과 워크스페이스를 지정합니다:
   - **App Name**: `VMS Chat Ops` (원하는 이름)
   - **Workspace**: 연동할 Slack 워크스페이스 선택
4. **"Create App"** 클릭

---

## 2. Socket Mode 활성화

VMS Chat Ops는 **Socket Mode**를 사용하여 실시간 이벤트를 수신합니다.

1. 좌측 메뉴에서 **"Socket Mode"** 클릭
2. **"Enable Socket Mode"** 를 ON으로 설정
3. App-Level Token 이름 입력 (예: `socket-token`)
4. Scope: `connections:write` 추가
5. **"Generate"** 클릭
6. 생성된 **App-Level Token** 복사 → `.env`의 `SLACK_APP_TOKEN` (형식: `xapp-...`)

---

## 3. Bot 권한 설정

좌측 메뉴에서 **"OAuth & Permissions"** 클릭 후 **"Bot Token Scopes"**에 다음 권한을 추가합니다:

### 필수 권한

```
channels:history       채널 메시지 히스토리 읽기
channels:read          공개 채널 정보 읽기
chat:write             메시지 전송
chat:write.public      멤버가 아닌 채널에도 메시지 전송
files:read             파일 정보 읽기
files:write            파일 업로드
groups:history         비공개 채널 메시지 히스토리 읽기
groups:read            비공개 채널 정보 읽기
users:read             사용자 정보 읽기
```

### 선택 권한 (DM/그룹챗 지원 시)

```
im:history             다이렉트 메시지 히스토리 읽기
im:read                다이렉트 메시지 정보 읽기
im:write               다이렉트 메시지 전송
mpim:history           그룹 DM 히스토리 읽기
mpim:read              그룹 DM 정보 읽기
mpim:write             그룹 DM 전송
reactions:read         리액션 읽기
reactions:write        리액션 추가
```

---

## 4. Event Subscriptions 설정

1. 좌측 메뉴에서 **"Event Subscriptions"** 클릭
2. **"Enable Events"** 를 ON으로 설정
3. **"Subscribe to bot events"**에서 다음 이벤트를 추가합니다:

```
message.channels       채널 메시지
message.groups         비공개 채널 메시지
```

Socket Mode를 사용하므로 Request URL은 자동으로 설정됩니다.

---

## 5. Bot 설치

1. 좌측 메뉴에서 **"OAuth & Permissions"**로 이동
2. 상단의 **"Install to Workspace"** 클릭
3. 권한 요청을 확인하고 **"Allow"** 클릭
4. **"Bot User OAuth Token"** 복사 → `.env`의 `SLACK_BOT_TOKEN` (형식: `xoxb-...`)

---

## 6. 채널에 Bot 초대

메시지를 브리지할 채널에 Bot을 초대합니다:

```
/invite @VMS-Chat-Ops
```

또는 채널 설정 → **"Integrations"** → **"Add an App"**에서 추가합니다.

---

## 7. 환경 변수 설정

`.env` 파일에 다음 값을 입력합니다:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token
```

---

## 8. VMS Chat Ops에 계정 등록

### Web UI

1. Settings 페이지 → Provider 섹션
2. "+" 버튼 → Slack 선택
3. Bot Token, App Token 입력
4. "저장" → "연결 테스트" 클릭

### API

```bash
curl -X POST http://localhost:8000/api/accounts-db \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "slack",
    "account_name": "my-workspace",
    "bot_token": "xoxb-...",
    "app_token": "xapp-..."
  }'
```

---

## 9. 연결 테스트

```bash
# 서비스 시작
docker compose up -d --build

# Backend 로그에서 Slack 연결 확인
docker logs vms-chatops-backend --tail=50 | grep -i slack

# 정상 연결 시 로그:
# INFO: Slack Provider connected successfully
# INFO: Slack Socket Mode connected
```

Settings 페이지에서 "연결 테스트" 버튼으로도 확인할 수 있습니다.

---

## 문제 해결

### "not_in_channel" 오류

Bot이 채널에 초대되지 않았습니다. `/invite @봇이름` 명령으로 초대하세요.

### "missing_scope" 오류

필요한 권한이 누락되었습니다. OAuth & Permissions에서 모든 필수 권한을 추가한 후 워크스페이스에 Bot을 **재설치**해야 합니다.

### "invalid_auth" 오류

Bot Token이 잘못되었거나 만료되었습니다:
- Token이 `xoxb-`로 시작하는지 확인
- App이 워크스페이스에 설치되어 있는지 확인

### Socket Mode 연결 실패

- App-Level Token이 `xapp-`로 시작하는지 확인
- Socket Mode가 활성화되어 있는지 확인
- `connections:write` scope가 있는지 확인

---

## 관련 문서

- [Teams 설정 가이드](teams-setup) — Microsoft Teams 연동
- [관리자 가이드](admin-guide) — 시스템 관리
- [트러블슈팅](troubleshooting) — 문제 해결

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0
