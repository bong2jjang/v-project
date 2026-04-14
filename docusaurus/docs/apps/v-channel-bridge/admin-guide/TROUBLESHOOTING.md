---
title: v-channel-bridge 트러블슈팅
sidebar_position: 9
---

# v-channel-bridge 트러블슈팅

운영 중 자주 발생하는 문제의 증상, 점검 방법, 해결 순서를 정리합니다. 모든 항목은 "증상 > 점검 명령 > 해결" 3단 구조로 구성되어 있습니다.

---

## 1. Slack Socket Mode 연결 실패

### 증상

백엔드 로그에 다음과 유사한 메시지가 반복됩니다.

```
ERROR: Failed to connect provider    platform=slack
WARNING: Failed to process account slack-default: ...
```

또는 서비스가 시작되지만 Slack 메시지가 수신되지 않습니다.

### 점검 명령

```bash
# 백엔드 로그 확인
docker logs v-channel-bridge-backend --tail=100 | grep -i "slack\|socket"

# .env 파일에서 토큰 형식 확인
grep "SLACK_" .env
```

### 해결

1. **App-Level Token 확인**: `SLACK_APP_TOKEN`이 `xapp-`로 시작하는지 확인합니다. Bot Token(`xoxb-`)과 혼동하지 않도록 합니다.
2. **Socket Mode 활성화 확인**: Slack API 포털 > 앱 설정 > Socket Mode가 ON인지 확인합니다.
3. **`connections:write` scope 확인**: App-Level Token 생성 시 이 scope가 포함되어야 합니다.
4. **네트워크 확인**: Docker 컨테이너에서 Slack 서버(`wss://wss-primary.slack.com`)로 WebSocket 연결이 가능한지 확인합니다. 프록시 환경이라면 `HTTPS_PROXY` 환경 변수를 설정합니다.
5. 토큰을 변경한 후에는 서비스를 재시작합니다.

```bash
docker compose up -d --build v-channel-bridge-backend
```

---

## 2. Teams Webhook 401 Unauthorized

### 증상

Teams에서 메시지를 보내도 v-channel-bridge에 도달하지 않고, Azure Bot Service 로그 또는 백엔드 로그에 401 오류가 기록됩니다.

```
ERROR: Teams webhook authentication failed
```

### 점검 명령

```bash
# 백엔드 로그에서 Teams 관련 오류 확인
docker logs v-channel-bridge-backend --tail=100 | grep -i "teams\|401\|auth"

# .env에서 Teams 자격증명 확인
grep "TEAMS_" .env
```

### 해결

1. **AppId/AppPassword 확인**: `.env`의 `TEAMS_APP_ID`와 `TEAMS_APP_PASSWORD`가 Azure Portal의 App Registration에 등록된 값과 일치하는지 확인합니다.
2. **Client Secret 만료**: Azure Portal > App Registration > Certificates & secrets에서 Secret의 만료일을 확인합니다. 만료된 경우 새 Secret을 생성하고 `.env`를 갱신합니다.
3. **Messaging Endpoint URL 확인**: Azure Bot > Configuration의 Messaging endpoint가 `https://{your-domain}/api/teams/webhook`으로 정확히 설정되어 있는지 확인합니다.
4. **HTTPS 필수**: Bot Framework는 HTTPS만 지원합니다. 로컬 테스트 시 ngrok 등 터널링 도구를 사용하세요.
5. **Admin Consent 확인**: Azure Portal > App Registration > API permissions에서 모든 권한의 Status가 "Granted"인지 확인합니다.

---

## 3. 메시지 라우팅 누락

### 증상

Slack/Teams에서 메시지를 보냈지만 상대 플랫폼에 전달되지 않습니다. 백엔드 로그에 다음과 같은 메시지가 나타납니다.

```
INFO: No routing targets found    platform=slack  channel=C123456
```

### 점검 명령

```bash
# Redis에서 라우트 키 직접 확인
docker exec -it redis redis-cli

# Redis CLI 내부에서:
# 모든 route 키 목록 조회
KEYS route:*

# 특정 채널의 타겟 목록 조회
SMEMBERS route:slack:C123456

# 타겟 채널 이름 확인
HGETALL route:slack:C123456:names

# 활성 상태 확인
HGETALL route:slack:C123456:enabled
```

### 해결

1. **라우트 미등록**: `SMEMBERS route:{platform}:{channel_id}` 결과가 비어 있으면 라우트가 등록되지 않은 것입니다. 관리자 UI의 **Channels** 페이지에서 라우트를 등록합니다.
2. **라우트 비활성**: `HGETALL route:{platform}:{channel_id}:enabled`에서 값이 `"0"`이면 비활성 상태입니다. UI에서 토글하거나 다음 명령으로 활성화합니다.
   ```
   HSET route:slack:C123456:enabled teams:T789 1
   ```
3. **채널 ID 불일치**: Slack 채널 ID는 `C`로 시작하는 영숫자입니다. Teams 채널 ID는 `{teamId}:{channelId}` 형식입니다. 라우트 등록 시 정확한 ID를 사용했는지 확인합니다.
4. **봇 미초대**: Slack 채널에 봇이 초대되지 않으면 메시지 이벤트를 수신할 수 없습니다. `/invite @봇이름` 명령으로 초대합니다.

---

## 4. CommonMessage 변환 에러

### 증상

메시지 이벤트는 수신되지만 `transform_to_common()` 단계에서 오류가 발생합니다.

```
ERROR: Error handling Slack message    error=...
```

### 점검 명령

```bash
# 상세 로그 레벨로 변경 후 재시작
# docker-compose.yml에서 LOG_LEVEL=DEBUG 설정
docker compose up -d --build v-channel-bridge-backend

# 변환 오류 로그 확인
docker logs v-channel-bridge-backend --tail=200 | grep -i "error.*transform\|error.*common"
```

### 해결

1. **메시지 서브타입 확인**: `SlackProvider`는 `message_changed`, `message_deleted`, `file_share`, `thread_broadcast` 외의 서브타입을 무시합니다(`apps/v-channel-bridge/backend/app/adapters/slack_provider.py`). 예상치 못한 서브타입이라면 해당 이벤트는 정상적으로 필터링된 것입니다.
2. **필수 필드 누락**: `CommonMessage` 스키마(`apps/v-channel-bridge/backend/app/schemas/common_message.py`)의 필수 필드(`message_id`, `timestamp`, `type`, `platform`, `user`, `channel`)가 원본 이벤트에서 추출되지 못한 경우입니다. 로그에서 `raw_message`를 확인하세요.
3. **사용자 정보 조회 실패**: Slack `users_info` API 호출 실패 시 display_name이 빈 값일 수 있습니다. 이 경우 기본값(user_id)이 사용됩니다.

---

## 5. 양방향 라우트 중복 표시

### 증상

관리자 UI의 Channels 페이지에서 동일한 라우트가 2건으로 표시됩니다 (예: Slack > Teams 1건, Teams > Slack 1건).

### 점검 명령

```bash
# Redis에서 양방향 플래그 확인
docker exec -it redis redis-cli

HGETALL route:slack:C123:bidirectional
HGETALL route:teams:T456:bidirectional
```

### 해결

정상적인 양방향 라우트라면 `get_all_routes()` 함수가 `frozenset` 쌍으로 중복을 제거합니다(`apps/v-channel-bridge/backend/app/services/route_manager.py`). 중복이 표시된다면 다음 상황을 확인합니다.

1. **bidirectional 플래그 불일치**: 정방향은 `"1"`이지만 역방향의 bidirectional 플래그가 누락된 경우입니다. 수동으로 설정합니다.
   ```
   HSET route:teams:T456:bidirectional slack:C123 1
   ```
2. **라우트 재등록**: 문제가 지속되면 해당 라우트를 삭제하고 관리자 UI에서 다시 등록합니다.

---

## 6. 첨부 파일 전달 누락

### 증상

Slack에서 파일을 공유했지만 Teams 측에 파일이 전달되지 않습니다. 텍스트 메시지만 전달됩니다.

### 점검 명령

```bash
# 첨부 파일 관련 로그 확인
docker logs v-channel-bridge-backend --tail=200 | grep -i "attachment\|download\|upload\|file"

# 임시 파일 디렉토리 확인 (Docker 컨테이너 내부)
docker exec v-channel-bridge-backend ls -la /tmp/vms-attachments/
```

### 해결

1. **파일 크기 제한**: 이미지는 10MB, 일반 파일은 20MB가 상한입니다(`apps/v-channel-bridge/backend/app/utils/attachment_handler.py`의 `MAX_IMAGE_SIZE`, `MAX_FILE_SIZE`). 초과하면 다운로드가 건너뛰어집니다.
2. **Slack 파일 접근 권한**: `files:read` scope가 없으면 파일 URL에 접근할 수 없습니다. OAuth & Permissions에서 scope를 확인하고 봇을 재설치합니다.
3. **MIME 타입 미지원**: 지원되는 MIME 타입은 `SUPPORTED_IMAGE_TYPES`(png, jpeg, gif, webp)와 `SUPPORTED_FILE_TYPES`(pdf, docx, xlsx, zip, txt)입니다. 로그에서 해당 파일의 MIME 타입을 확인합니다.
4. **임시 디렉토리 권한**: Docker 컨테이너 내부의 `/tmp/vms-attachments/` 디렉토리에 쓰기 권한이 있는지 확인합니다.
5. **다운로드 실패**: Slack API에서 파일 다운로드가 실패하면 `download_status`가 `"failed"`로 기록됩니다. 로그에서 HTTP 상태 코드를 확인합니다.

---

## 공통 진단 명령 모음

```bash
# 전체 서비스 상태 확인
docker compose ps

# 브리지 상태 API 확인
curl -s http://127.0.0.1:8000/api/bridge/status | python -m json.tool

# Provider 목록 확인
curl -s http://127.0.0.1:8000/api/bridge/providers -H "Authorization: Bearer {token}" | python -m json.tool

# 헬스 체크
curl -s http://127.0.0.1:8000/api/health | python -m json.tool

# Redis 라우트 전체 조회 (API)
curl -s http://127.0.0.1:8000/api/bridge/routes -H "Authorization: Bearer {token}" | python -m json.tool

# Redis 직접 접근
docker exec -it redis redis-cli
> KEYS route:*
> SMEMBERS route:slack:C123456
```

---

## 관련 문서

- [Slack 설정 가이드](./SLACK_SETUP.md)
- [Teams 설정 가이드](./TEAMS_SETUP.md)

---

**최종 업데이트**: 2026-04-13
