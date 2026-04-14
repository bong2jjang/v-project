---
title: Microsoft Teams Bot 설정 가이드
sidebar_position: 5
---

# Microsoft Teams Bot 설정 가이드

Azure Portal에서 Bot을 등록하고, v-channel-bridge가 Microsoft Graph API와 Bot Framework를 통해 Teams 메시지를 수신/발송할 수 있도록 설정하는 방법을 안내합니다.

---

## 전체 흐름 요약

1. Azure Portal에서 Bot 등록 (Azure Bot Service)
2. API 권한 설정
3. Messaging Endpoint 구성
4. TenantId, AppId, AppPassword 발급
5. `.env` 파일에 반영
6. Teams 팀에 봇 추가
7. 관리자 UI에서 라우트 등록

---

## 사전 요구사항

- Microsoft Azure 계정
- Azure Portal 접근 권한
- Microsoft Teams 관리자 권한 (또는 봇 설치 권한)
- 외부에서 접근 가능한 도메인 (Messaging Endpoint용)

---

## 1. Azure Portal에서 Bot 등록

1. [Azure Portal](https://portal.azure.com)에 로그인합니다.
2. **Azure Bot** 리소스를 검색하고 **Create**를 클릭합니다.
3. 기본 설정을 입력합니다.
   - **Bot handle**: `v-channel-bridge` (고유 이름)
   - **Subscription**: 사용할 Azure 구독
   - **Resource group**: 기존 그룹 선택 또는 새로 생성
   - **Type of App**: **Multi Tenant** 선택
4. **Create**를 클릭하고 배포가 완료될 때까지 기다립니다.

---

## 2. App Registration 확인 및 Client Secret 발급

Bot 등록 시 자동으로 App Registration이 생성됩니다.

1. Azure Portal > **Azure Active Directory** > **App registrations**으로 이동합니다.
2. 위에서 생성된 앱을 찾아 클릭합니다.
3. **Overview** 페이지에서 다음 값을 복사합니다.
   - **Application (client) ID** --> 이후 `TEAMS_APP_ID`
   - **Directory (tenant) ID** --> 이후 `TEAMS_TENANT_ID`
4. **Certificates & secrets** > **Client secrets** > **New client secret**를 클릭합니다.
5. 설명을 입력하고 만료 기간을 선택한 후 **Add**를 클릭합니다.
6. 생성된 **Value**를 즉시 복사합니다 --> 이후 `TEAMS_APP_PASSWORD`

> Client Secret은 생성 직후에만 값을 확인할 수 있습니다. 이 시점에서 반드시 복사해 두세요.

---

## 3. API 권한 설정

1. App Registration > **API permissions** > **Add a permission**을 클릭합니다.
2. **Microsoft Graph** > **Application permissions**를 선택합니다.
3. 다음 권한을 추가합니다.

| 권한 | 설명 |
|------|------|
| `ChannelMessage.Read.All` | Teams 채널 메시지 읽기 |
| `ChannelMessage.Send` | Teams 채널에 메시지 전송 |
| `Team.ReadBasic.All` | 팀 기본 정보 읽기 |

4. **Grant admin consent** 버튼을 클릭하여 관리자 동의를 부여합니다.

Status 열에 모든 권한이 "Granted"로 표시되어야 합니다.

---

## 4. Messaging Endpoint 구성

1. Azure Portal에서 생성한 **Azure Bot** 리소스로 이동합니다.
2. **Configuration**을 클릭합니다.
3. **Messaging endpoint**에 다음 URL을 입력합니다.

```
https://{your-domain}/api/teams/webhook
```

이 URL은 `apps/v-channel-bridge/backend/app/api/teams_webhook.py`에 정의된 엔드포인트입니다. Bot Framework가 Teams Activity를 이 엔드포인트로 POST 하면, `TeamsProvider`의 `BotFrameworkAdapter`가 JWT 인증을 수행하고 메시지를 처리합니다.

4. **Microsoft Teams** 채널을 활성화합니다.
   - **Channels** 메뉴에서 **Microsoft Teams**를 클릭하고 활성화합니다.

---

## 5. 환경 변수 설정

프로젝트 루트의 `.env` 파일에 다음 값을 추가합니다.

```bash
TEAMS_TENANT_ID=your-azure-tenant-id
TEAMS_APP_ID=your-azure-app-id
TEAMS_APP_PASSWORD=your-client-secret-value
```

v-channel-bridge는 시작 시 `.env`의 값을 DB(`accounts` 테이블)로 자동 마이그레이션합니다. `apps/v-channel-bridge/backend/app/main.py`의 `migrate_env_to_db()` 함수가 이 작업을 수행합니다.

### 선택 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `TEAMS_NOTIFICATION_URL` | Graph API Change Notifications 수신 URL | `{BACKEND_URL}/api/teams/notifications` |
| `BRIDGE_TYPE` | 브리지 타입 | `native` |

---

## 6. Teams 팀에 봇 추가

1. Microsoft Teams 클라이언트를 엽니다.
2. **Apps** > **Manage your apps**으로 이동합니다.
3. **Upload a custom app**을 클릭합니다 (관리자 권한 필요).
4. Bot의 App ID를 사용하여 앱을 팀에 추가합니다.

또는 Teams Admin Center에서 조직 전체에 배포할 수 있습니다.

---

## 7. 채널 ID 포맷 주의사항

Teams 채널 ID는 v-channel-bridge 내부에서 `{teamId}:{channelId}` 형식으로 저장됩니다.

예시:
```
19:abc123def456@thread.tacv2
```

위 값이 팀 ID `team-uuid-1234`에 속한 경우, Redis에는 다음과 같이 저장됩니다.

```
route:teams:team-uuid-1234:19:abc123def456@thread.tacv2
```

`apps/v-channel-bridge/backend/app/adapters/teams_provider.py`의 `_parse_channel_ref()` 함수가 이 형식을 파싱합니다. 라우트를 API로 직접 등록할 때는 이 형식을 정확히 맞춰야 합니다.

---

## 서비스 시작 및 연결 확인

```bash
# v-channel-bridge 전체 시작
docker compose up -d --build

# 백엔드 로그에서 Teams 연결 확인
docker logs v-channel-bridge-backend --tail=50 | grep -i teams
```

정상 연결 시 다음과 같은 로그가 출력됩니다.

```
INFO: Teams Provider registered: teams-default
INFO: v-channel-bridge started
```

---

## 라우트 등록

Teams 봇이 정상 등록되면 관리자 UI에서 라우트를 등록합니다.

1. 브라우저에서 `http://127.0.0.1:5173`에 접속합니다.
2. **Channels** 페이지에서 **라우트 추가**를 클릭합니다.
3. 소스(Slack)/타겟(Teams) 또는 소스(Teams)/타겟(Slack) 조합을 선택합니다.
4. Teams 채널은 드롭다운에서 팀과 채널을 선택할 수 있습니다.
5. 메시지 모드와 양방향 여부를 설정한 후 **저장**합니다.

---

## 자주 묻는 질문

### Messaging Endpoint를 로컬에서 테스트하려면

로컬 개발 환경에서는 외부 도메인이 없으므로 ngrok 같은 터널링 도구를 사용합니다.

```bash
ngrok http 8000
```

생성된 HTTPS URL을 Azure Bot의 Messaging endpoint에 설정합니다.

### Client Secret이 만료되었을 때

Azure Portal > App Registration > **Certificates & secrets**에서 새 Secret을 생성하고, `.env`의 `TEAMS_APP_PASSWORD`를 갱신한 뒤 서비스를 재시작합니다. 또는 관리자 UI의 **Integrations** 페이지에서 계정 정보를 수정할 수 있습니다.

### Graph API 권한이 Granted 되지 않습니다

Azure AD 글로벌 관리자 권한이 필요합니다. IT 관리자에게 **Grant admin consent** 승인을 요청하세요.

---

## 관련 문서

- [Slack 설정 가이드](./SLACK_SETUP.md)
- [트러블슈팅](./TROUBLESHOOTING.md)

---

**최종 업데이트**: 2026-04-13
