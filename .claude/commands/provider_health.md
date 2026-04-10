# Provider 연결 상태 빠른 확인

Slack/Teams Provider 연결 상태를 빠르게 확인합니다.

v-channel-bridge의 Slack/Teams Provider 연결 상태를 확인합니다.

## 사용법

```bash
/provider-health
```

## 워크플로우

### 1. 환경 변수 확인

```bash
# BRIDGE_TYPE 확인 (native인 경우만 실행)
grep BRIDGE_TYPE .env

# Provider 자격증명 확인
grep -E "SLACK_APP_TOKEN|TEAMS_APP_ID|TEAMS_APP_PASSWORD|TEAMS_TENANT_ID" .env | sed 's/=.*/=***/'
```

### 2. Backend 서비스 상태

```bash
# Backend 컨테이너 상태
docker compose -f docker-compose.dev.yml ps backend

# Backend 프로세스 헬스체크
curl -s http://localhost:8000/api/health
```

### 3. Slack Provider 상태

```bash
# Slack Socket Mode 연결 확인
docker compose -f docker-compose.dev.yml logs backend | grep -i "slack" | tail -20

# 연결 성공 패턴: "Slack Socket Mode connected" 또는 "SlackProvider initialized"
# 연결 실패 패턴: "Slack Socket Mode connection failed" 또는 "Token expired"
```

### 4. Teams Provider 상태

```bash
# Teams Graph API 연결 확인
docker compose -f docker-compose.dev.yml logs backend | grep -i "teams" | tail -20

# 연결 성공 패턴: "Teams Provider connected" 또는 "TeamsProvider initialized"
# 연결 실패 패턴: "Teams authentication failed" 또는 "Invalid credentials"
```

### 5. Redis 동적 라우팅 상태

```bash
# Redis 연결 확인
docker compose -f docker-compose.dev.yml exec redis redis-cli ping

# 라우팅 룰 개수 확인
docker compose -f docker-compose.dev.yml exec redis redis-cli --scan --pattern "route:*" | wc -l
```

## 출력 형식

```
## Provider 연결 상태

### Backend 서비스
✅ 실행 중 (포트 8000)

### Slack Provider (Socket Mode)
✅ 연결됨
- Socket Mode: 정상
- 마지막 heartbeat: 2초 전
- App Token: ✓ 유효

### Teams Provider (Graph API)
✅ 연결됨
- Graph API: 정상
- 마지막 토큰 갱신: 5분 전
- Tenant ID: ✓ 유효

### Redis (Dynamic Routing)
✅ 정상
- 연결: PONG
- 라우팅 룰: 3개 등록

### 요약
모든 Provider가 정상 작동 중입니다. 메시지 브리지 준비 완료.
```

## 연결 실패 예시

```
## Provider 연결 상태

### Backend 서비스
✅ 실행 중 (포트 8000)

### Slack Provider (Socket Mode)
❌ 연결 실패
- 오류: "invalid_auth" - Token expired or revoked
- 조치: .env에서 SLACK_APP_TOKEN 갱신 필요
- 참고: https://api.slack.com/apps → OAuth & Permissions → Bot User OAuth Token

### Teams Provider (Graph API)
✅ 연결됨

### Redis (Dynamic Routing)
⚠️  라우팅 룰 없음
- 연결: 정상
- 라우팅 룰: 0개
- 조치: Redis에 라우팅 룰 추가 필요 (예: route:slack:#general → teams:General)

### 요약
Slack Provider 연결 실패. 위 조치사항을 확인하세요.
```

## 일반적인 문제

### Slack Socket Mode 연결 실패

**원인 1: Token 만료 또는 취소**
```bash
# .env에서 SLACK_APP_TOKEN 확인
grep SLACK_APP_TOKEN .env

# 조치: Slack App 설정에서 새 토큰 발급
# https://api.slack.com/apps → Your App → OAuth & Permissions
```

**원인 2: Socket Mode 미활성화**
```bash
# Slack App 설정 확인
# https://api.slack.com/apps → Your App → Socket Mode
# "Enable Socket Mode" 토글 확인
```

**원인 3: 네트워크/방화벽**
```bash
# Slack WebSocket 연결 테스트
curl -I https://wss-primary.slack.com/

# 응답: HTTP/1.1 426 Upgrade Required (정상)
```

### Teams Provider 인증 실패

**원인 1: 자격증명 오류**
```bash
# .env에서 Teams 자격증명 확인
grep -E "TEAMS_APP_ID|TEAMS_APP_PASSWORD|TEAMS_TENANT_ID" .env

# 조치: Azure Portal에서 확인
# https://portal.azure.com → App registrations → Your App
```

**원인 2: API 권한 부족**
```bash
# Azure Portal에서 API 권한 확인
# 필수 권한:
# - ChannelMessage.Read.All
# - ChannelMessage.Send
# - Team.ReadBasic.All
# - Chat.ReadWrite
```

**원인 3: 토큰 만료**
```bash
# Backend 로그에서 토큰 갱신 확인
docker compose -f docker-compose.dev.yml logs backend | grep -i "token refresh"

# 토큰은 자동 갱신되어야 함
```

### Redis 연결 실패

**원인 1: 컨테이너 중지**
```bash
# Redis 컨테이너 상태 확인
docker compose -f docker-compose.dev.yml ps redis

# 조치: Redis 시작
docker compose -f docker-compose.dev.yml up -d redis
```

**원인 2: 비밀번호 오류**
```bash
# .env에서 REDIS_URL 확인
grep REDIS_URL .env

# 형식: redis://:PASSWORD@redis:6379/0
```

## 문제 해결 팁

### Provider 재연결

```bash
# Backend 재시작 (Provider 재초기화)
docker compose -f docker-compose.dev.yml restart backend

# 로그 실시간 확인
docker compose -f docker-compose.dev.yml logs -f backend
```

### Socket Mode 디버깅

```bash
# Slack Socket Mode 상세 로그
docker compose -f docker-compose.dev.yml logs backend | grep -A 5 "Slack Socket Mode"

# WebSocket 연결 추적
docker compose -f docker-compose.dev.yml logs backend | grep -i "websocket"
```

### 라우팅 룰 추가

```bash
# Redis에 라우팅 룰 추가 (예시)
docker compose -f docker-compose.dev.yml exec redis redis-cli SADD "route:slack:#general" "teams:General"

# 확인
docker compose -f docker-compose.dev.yml exec redis redis-cli SMEMBERS "route:slack:#general"
```

## 관련 명령어

- `/check_sync_status` - 전체 메시지 브리지 상태 (더 상세한 정보)
- `/migration_status` - 시스템 상태 확인
- `/test-provider` - Provider 단위 테스트
- `/deploy-check` - 배포 전 체크리스트
