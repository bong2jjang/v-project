---
id: teams-setup
title: Microsoft Teams Bot 설정 가이드
sidebar_position: 5
tags: [guide, admin]
---

# Microsoft Teams Bot 설정 가이드

VMS Channel Bridge의 Teams Provider (Graph API + Bot Framework)를 연동하기 위한 Azure Bot Service 설정 방법을 안내합니다.

---

## 사전 요구사항

- Microsoft Azure 계정
- Microsoft Teams 관리자 권한 (또는 Bot 설치 권한)
- Azure Portal 접근 권한

---

## 1. Azure AD App 등록

### 1.1 App 등록 생성

1. [Azure Portal](https://portal.azure.com/)에 로그인
2. **"App registrations"** 검색 → **"+ New registration"** 클릭
3. 다음 정보 입력:
   - **Name**: `VMS Channel Bridge Bot`
   - **Supported account types**: `Accounts in this organizational directory only` (단일 테넌트)
   - **Redirect URI**: 비워둡니다
4. **"Register"** 클릭

### 1.2 Application ID 및 Tenant ID 복사

생성된 앱의 **"Overview"** 페이지에서:
- **Application (client) ID** → `.env`의 `TEAMS_APP_ID`
- **Directory (tenant) ID** → `.env`의 `TEAMS_TENANT_ID`

### 1.3 Client Secret 생성

1. **"Certificates & secrets"** → **"+ New client secret"**
2. Description: `VMS Channel Bridge Secret`, Expires: 24 months
3. **"Add"** 클릭
4. 생성된 **"Value"** 즉시 복사 → `.env`의 `TEAMS_APP_PASSWORD`

> **중요**: 이 값은 한 번만 표시되므로 반드시 복사해두어야 합니다!

---

## 2. API 권한 설정

### 2.1 필수 권한 추가

1. Azure AD App에서 **"API permissions"** → **"+ Add a permission"**
2. **"Microsoft Graph"** → **"Application permissions"** 선택
3. 다음 권한을 추가합니다:

```
ChannelMessage.Read.All     채널 메시지 읽기
ChannelMessage.Send         채널 메시지 전송
Team.ReadBasic.All          팀 기본 정보 읽기
Channel.ReadBasic.All       채널 기본 정보 읽기
```

### 2.2 선택 권한 (파일 전송, 사용자 정보)

```
Files.Read.All              파일 읽기
Files.ReadWrite.All         파일 읽기/쓰기
User.Read.All               사용자 정보 읽기
ChatMessage.Read            채팅 메시지 읽기
ChatMessage.Send            채팅 메시지 전송
```

### 2.3 관리자 동의

**"Grant admin consent for [조직명]"** 클릭하여 관리자 동의를 부여합니다.

---

## 3. Bot Service 생성

### 3.1 Azure Bot 리소스 생성

1. Azure Portal에서 **"Azure Bot"** 검색 → **"+ Create"**
2. 다음 정보 입력:
   - **Bot handle**: 고유한 이름 (예: `vms-channel-bridge-bot`)
   - **Subscription**: Azure 구독 선택
   - **Resource group**: 기존 그룹 또는 새로 생성
   - **Pricing tier**: `F0 (Free)` 또는 필요에 따라 선택
   - **Microsoft App ID**:
     - Type of App: `Multi Tenant`
     - Creation type: `Use existing app registration`
     - App ID: 위에서 생성한 Application (client) ID
3. **"Review + create"** → **"Create"**

### 3.2 Messaging Endpoint 설정

1. Bot 리소스에서 **"Configuration"** 클릭
2. **"Messaging endpoint"** 설정:
   ```
   https://{your-domain}/api/teams/webhook
   ```
   VMS Channel Bridge의 Teams Webhook 엔드포인트를 지정합니다.

### 3.3 Teams 채널 활성화

1. Bot 리소스에서 **"Channels"** 클릭
2. **"Microsoft Teams"** 아이콘 클릭
3. **"Microsoft Teams Commercial"** 선택
4. 약관 동의 후 **"Apply"**

---

## 4. Teams에 Bot 설치

### 방법 1: Developer Portal 사용 (권장)

1. [Teams Developer Portal](https://dev.teams.microsoft.com/) 접속
2. **"Apps"** → **"+ New app"**
3. 기본 정보 입력:
   - **App name**: `VMS Channel Bridge`
   - **App ID**: Azure AD App의 Application (client) ID
4. **"App features"** → **"Bot"** → Bot ID 입력
5. Scope: **Team**, **Personal**, **Group chat** 선택
6. **"Publish"** → **"Publish to your org"** 또는 직접 설치

### 방법 2: 팀에 직접 추가

1. Teams에서 원하는 팀/채널로 이동
2. 채널 이름 옆의 **"..."** → **"Manage channel"**
3. Bot 앱 검색하여 추가

---

## 5. 채널 ID 확인

### 방법 1: Graph Explorer 사용

1. [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) 접속
2. 로그인 후 다음 쿼리 실행:

```
GET https://graph.microsoft.com/v1.0/me/joinedTeams
```

3. 팀 ID 확인 후 채널 목록 조회:

```
GET https://graph.microsoft.com/v1.0/teams/{team-id}/channels
```

4. 채널 ID 복사 (형식: `19:xxxx@thread.tacv2`)

### 방법 2: VMS Channel Bridge API 사용

Provider 계정이 등록된 후:

```bash
curl http://localhost:8000/api/bridge/channels/msteams \
  -H "Authorization: Bearer <token>"
```

Teams에 연결된 모든 팀과 채널 목록이 반환됩니다.

### 방법 3: Teams 링크에서 추출

1. Teams에서 채널 우클릭 → **"Get link to channel"**
2. URL에서 채널 ID 추출:
   ```
   https://teams.microsoft.com/l/channel/19%3axxxxxxxxxx%40thread.tacv2/...
   ```
3. URL 디코딩: `19:xxxx@thread.tacv2`

---

## 6. 환경 변수 설정

`.env` 파일에 다음 값을 입력합니다:

```bash
TEAMS_TENANT_ID=your-tenant-id
TEAMS_APP_ID=your-application-client-id
TEAMS_APP_PASSWORD=your-client-secret-value
```

---

## 7. VMS Channel Bridge에 계정 등록

### Web UI

1. Settings 페이지 → Provider 섹션
2. "+" 버튼 → Teams 선택
3. Tenant ID, App ID, App Password 입력
4. "저장" → "연결 테스트" 클릭

### API

```bash
curl -X POST http://localhost:8000/api/accounts-db \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "msteams",
    "account_name": "my-org",
    "tenant_id": "your-tenant-id",
    "app_id": "your-app-id",
    "app_password": "your-client-secret"
  }'
```

---

## 8. 연결 테스트

```bash
# 서비스 시작
docker compose up -d --build

# Backend 로그에서 Teams 연결 확인
docker logs vms-channel-bridge-backend --tail=50 | grep -i teams

# 채널 목록 조회 테스트
curl http://localhost:8000/api/bridge/channels/msteams \
  -H "Authorization: Bearer <token>"
```

Settings 페이지에서 "연결 테스트" 버튼으로도 확인할 수 있습니다.

---

## Teams 채널 ID 형식

VMS Channel Bridge에서 Teams 채널 ID는 `{teamId}:{channelId}` 형식으로 저장됩니다:

```
예: a1b2c3d4-e5f6-7890-abcd-ef1234567890:19:xxxx@thread.tacv2
```

Route 설정 시 UI의 채널 드롭다운에서 자동으로 이 형식이 사용됩니다.

---

## 문제 해결

### 인증 오류 (401 Unauthorized)

- `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD`, `TEAMS_TENANT_ID`가 정확한지 확인
- Client Secret이 만료되지 않았는지 확인
- Azure AD App에 필요한 API 권한 + 관리자 동의가 부여되었는지 확인

### Bot이 메시지를 수신하지 못함

- Messaging Endpoint가 `https://{domain}/api/teams/webhook`으로 설정되었는지 확인
- Bot이 Teams 팀/채널에 추가되었는지 확인
- Azure Bot의 Channels 설정에서 Teams가 활성화되었는지 확인

### 메시지 전송 실패

- Bot에 `ChannelMessage.Send` 권한이 있는지 확인
- Teams 관리 센터에서 Bot 정책이 허용되었는지 확인
- 채널 ID가 올바른 형식인지 확인

### 파일 첨부 실패

- `Files.Read.All` 및 `Files.ReadWrite.All` 권한 확인
- 관리자 동의가 부여되었는지 확인
- 인라인 이미지는 `hostedContents`를 통해 전송됩니다

---

## 관련 문서

- [Slack 설정 가이드](slack-setup) — Slack App 연동
- [관리자 가이드](admin-guide) — 시스템 관리
- [트러블슈팅](troubleshooting) — 문제 해결
- [Microsoft Teams Bot 개발 문서](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots)
- [Azure Bot Service 문서](https://learn.microsoft.com/en-us/azure/bot-service/)
- [Microsoft Graph API 문서](https://learn.microsoft.com/en-us/graph/overview)

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0
