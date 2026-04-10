# 메시지 브리지 동기화 상태 확인

Slack ↔ Teams 메시지 동기화 상태를 확인합니다.

**참고**: v-channel-bridge의 Native Bridge 상태를 확인합니다.

## 사용법

```bash
/check_sync_status
```

## 워크플로우

### 1. 현재 브리지 타입 확인

```bash
# .env 파일에서 BRIDGE_TYPE 확인
grep BRIDGE_TYPE .env

# native (v-channel-bridge)
```

### 2. 서비스 상태 확인

```bash
docker compose -f docker-compose.dev.yml ps backend
docker compose -f docker-compose.dev.yml logs --tail=100 backend | grep -i "provider\|bridge"
```

### 3. Provider 연결 상태 확인

```bash
# Slack Provider 상태
docker compose -f docker-compose.dev.yml logs backend | grep -i "slack"

# Teams Provider 상태
docker compose -f docker-compose.dev.yml logs backend | grep -i "teams"

# Redis 연결 (동적 라우팅)
docker compose -f docker-compose.dev.yml exec redis redis-cli ping
```

### 4. Backend API 상태

```bash
# 헬스체크
curl -s http://localhost:8000/api/health

# 브리지 상태
curl -s http://localhost:8000/api/bridge/status

# 채널 매핑 상태 (인증 필요 시 토큰 포함)
curl -s http://localhost:8000/api/channels
```

### 5. 라우팅 룰 확인

```bash
# Redis에 저장된 라우팅 룰 확인
docker compose -f docker-compose.dev.yml exec redis redis-cli --scan --pattern "route:*"
```

## 출력 형식

```
## 메시지 브리지 동기화 상태 (v-channel-bridge)

### 브리지 타입
Native

### 서비스
- Backend (Providers): ✅ 실행 중 / ❌ 중지됨
- Redis (Routing): ✅ 정상 / ❌ 비정상
- Postgres (State): ✅ 정상 / ❌ 비정상

### Provider 연결 상태
- Slack Provider (Socket Mode): ✅ 연결됨 / ❌ 연결 실패 - [원인]
- Teams Provider (Graph API): ✅ 연결됨 / ❌ 연결 실패 - [원인]

### 동적 라우팅 룰
| 소스 (Platform:Channel) | 타겟 (Platform:Channel) | 상태 |
|------------------------|------------------------|------|
| slack:#general         | teams:General          | ✅   |

### 메시지 처리 통계 (최근 1시간)
- 처리된 메시지: 123개
- 성공: 121개 (98.4%)
- 실패: 2개 (1.6%)
```

## 일반적인 문제
- **"Slack Socket Mode 연결 실패"**: SLACK_APP_TOKEN 확인, Socket Mode 활성화 여부 확인
- **"Teams Provider 인증 실패"**: TEAMS_APP_ID, TEAMS_APP_PASSWORD, TEAMS_TENANT_ID 확인
- **"Redis 연결 실패"**: Redis 컨테이너 상태 확인, REDIS_URL 확인
- **"라우팅 룰 없음"**: Redis에 라우팅 룰 추가 필요

## 문제 해결 팁

### Provider 재연결

```bash
# Backend 재시작
docker compose -f docker-compose.dev.yml restart backend

# 로그 확인
docker compose -f docker-compose.dev.yml logs -f backend
```

### Redis 라우팅 룰 확인

```bash
# 모든 라우팅 룰 확인
docker compose -f docker-compose.dev.yml exec redis redis-cli --scan --pattern "route:*" | xargs -I {} docker compose -f docker-compose.dev.yml exec redis redis-cli SMEMBERS {}
```

