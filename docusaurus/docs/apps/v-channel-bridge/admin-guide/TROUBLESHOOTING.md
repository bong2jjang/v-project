---
id: troubleshooting
title: VMS Channel Bridge 트러블슈팅 가이드
sidebar_position: 9
tags: [guide, admin]
---

# VMS Channel Bridge 트러블슈팅 가이드

이 문서는 VMS Channel Bridge Light-Zowe 아키텍처에서 발생할 수 있는 일반적인 문제와 해결 방법을 안내합니다.

---

## 서비스 시작 문제

### Docker 연결 실패

**증상:**

```
Error: Docker or Docker Compose not found
Cannot connect to the Docker daemon
```

**해결 방법:**

```bash
# Docker 설치 확인
docker --version
docker compose version

# Docker 서비스 상태 (Linux)
sudo systemctl status docker
sudo systemctl start docker

# Docker 권한 추가 (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

Windows의 경우 Docker Desktop이 실행 중인지 확인합니다.

### Backend 시작 실패

**증상:**

- Backend 컨테이너가 반복 재시작
- `docker compose ps`에서 backend가 "Restarting" 상태

**확인 사항:**

```bash
# 로그 확인
docker logs vms-channel-bridge-backend --tail=100

# 일반적인 원인:
# 1. PostgreSQL 연결 실패 → postgres 컨테이너 상태 확인
# 2. Redis 연결 실패 → redis 컨테이너 상태 확인
# 3. .env 설정 오류 → DATABASE_URL, REDIS_URL 확인
```

**해결 방법:**

```bash
# 의존 서비스 먼저 확인
docker compose ps postgres redis

# 전체 재빌드
docker compose down
docker compose up -d --build
```

### Provider 연결 실패

**증상:**

- Dashboard에서 Provider 상태가 "Disconnected"
- Backend 로그에 Slack/Teams 연결 오류

**Slack Provider:**

```bash
# Slack API 연결 테스트
curl -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
  https://slack.com/api/auth.test

# 확인 사항:
# - Bot Token (xoxb-)이 유효한지
# - App Token (xapp-)이 유효한지 (Socket Mode 필수)
# - Bot이 채널에 초대되었는지
```

**Teams Provider:**

```bash
# 확인 사항:
# - Tenant ID, App ID, App Password가 정확한지
# - Client Secret이 만료되지 않았는지
# - Azure AD App에 필요한 API 권한이 부여되었는지
# - Teams 채널에서 Bot이 활성화되었는지
```

**Settings 페이지에서 "연결 테스트" 버튼으로 검증할 수 있습니다.**

---

## 메시지 전달 문제

### 메시지가 전송되지 않음

**체크리스트:**

1. Dashboard에서 브리지 상태가 "Connected"인가?
2. Routes 페이지에서 해당 Route가 활성화 상태인가?
3. Slack Bot이 소스 채널에 초대되었나?
4. Teams Bot이 대상 채널에 추가되었나?

**진단:**

```bash
# Backend 로그에서 메시지 라우팅 확인
docker logs vms-channel-bridge-backend --tail=200 | grep -i "route\|message\|error"

# Redis에서 Route 확인
docker exec vms-channel-bridge-redis redis-cli KEYS "route:*"

# Messages 페이지에서 실패 메시지의 에러 메시지 확인
```

**일반적인 원인:**

- Slack/Teams 토큰 만료
- 잘못된 채널 ID
- 네트워크 연결 문제
- Route 미설정 또는 비활성화

### 파일/이미지가 전달되지 않음

**Slack → Teams:**

- Slack Bot에 `files:read` 권한이 있는지 확인
- Teams App에 `ChannelMessage.Send` 권한이 있는지 확인
- Backend 로그에서 파일 다운로드/업로드 에러 확인

**Teams → Slack:**

- Teams App에 `Files.Read.All` 권한이 있는지 확인
- Slack Bot에 `files:write` 권한이 있는지 확인
- 파일 크기 제한 확인

### 메시지 지연

**진단:**

```bash
# 리소스 사용량 확인
docker stats --no-stream

# Redis 상태 확인
docker exec vms-channel-bridge-redis redis-cli INFO server

# PostgreSQL 연결 수 확인
docker exec vms-channel-bridge-postgres psql -U vmsuser -d vms_channel_bridge \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

**해결 방법:**

- MessageQueue 배치 크기 및 flush 간격 확인 (기본: 50개 / 5초)
- Redis 메모리 확인 및 정리
- PostgreSQL 인덱스 재구성

---

## 데이터베이스 문제

### PostgreSQL 연결 실패

```bash
# 컨테이너 상태 확인
docker logs vms-channel-bridge-postgres --tail=50

# 연결 테스트
docker exec vms-channel-bridge-backend python -c "
from app.db.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT 1'))
    print('DB OK:', result.fetchone())
"
```

### 디스크 공간 부족

```bash
# 디스크 사용량 확인
df -h

# Docker 디스크 정리
docker system prune -a --volumes

# 오래된 메시지 삭제
docker exec vms-channel-bridge-postgres psql -U vmsuser -d vms_channel_bridge \
  -c "DELETE FROM messages WHERE created_at < NOW() - INTERVAL '90 days';"
```

### 성능 저하

```bash
# PostgreSQL 성능 확인
docker exec vms-channel-bridge-postgres psql -U vmsuser -d vms_channel_bridge \
  -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Redis 메모리 확인
docker exec vms-channel-bridge-redis redis-cli INFO memory

# 인덱스 재구성
docker exec vms-channel-bridge-postgres psql -U vmsuser -d vms_channel_bridge \
  -c "REINDEX DATABASE vms_channel_bridge;"
```

---

## 네트워크 문제

### WebSocket 연결 실패

**증상:**

- 실시간 업데이트가 작동하지 않음
- 브라우저 콘솔에 `WebSocket connection failed` 에러

**해결 방법:**

```bash
# Backend WebSocket 엔드포인트 테스트
# 브라우저 콘솔에서:
# const ws = new WebSocket('ws://localhost:8000/api/ws');
# ws.onopen = () => console.log('Connected');

# CORS 설정 확인 (backend/app/main.py)
# Frontend URL이 allow_origins에 포함되어 있는지 확인

# Nginx 리버스 프록시 사용 시 WebSocket 설정
# location /api/ws {
#     proxy_pass http://backend:8000;
#     proxy_http_version 1.1;
#     proxy_set_header Upgrade $http_upgrade;
#     proxy_set_header Connection "upgrade";
# }
```

### 컨테이너 간 통신 실패

```bash
# Docker 네트워크 확인
docker network ls
docker network inspect vms-channel-bridge_vms-channel-bridge-network

# 네트워크 재생성
docker compose down
docker network prune
docker compose up -d
```

### 외부 API 연결 실패

```bash
# Slack API 테스트
curl https://slack.com/api/api.test

# Microsoft Graph API 테스트
curl https://graph.microsoft.com/v1.0/

# 프록시 환경인 경우 docker-compose.yml에 추가:
# environment:
#   - HTTP_PROXY=http://proxy.example.com:8080
#   - HTTPS_PROXY=http://proxy.example.com:8080
```

---

## 포트 충돌

**증상:**

```
port already in use
```

**확인 및 해결:**

```bash
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :5173

# Linux/macOS
sudo lsof -i :8000
sudo lsof -i :5173
```

`docker-compose.yml`에서 포트를 변경할 수 있습니다:

```yaml
services:
  backend:
    ports:
      - "8001:8000"  # 호스트:컨테이너
  frontend:
    ports:
      - "5174:5173"
```

---

## 로그 수집 방법

문제 해결을 위해 다음 정보를 수집하세요:

```bash
# 1. 시스템 정보
docker --version
docker compose version

# 2. 컨테이너 상태
docker compose ps > docker-status.txt

# 3. Backend 로그
docker logs vms-channel-bridge-backend --tail=500 > backend-logs.txt

# 4. 전체 서비스 로그
docker compose logs --tail=200 > all-logs.txt

# 5. 헬스체크
curl http://localhost:8000/api/health > health-check.json
curl http://localhost:8000/api/health/detailed \
  -H "Authorization: Bearer <token>" >> health-check.json
```

---

## 관련 문서

- [관리자 가이드](admin-guide) — 시스템 관리
- [배포 가이드](deployment) — 설치 및 운영
- [모니터링 설정](monitoring-setup) — Prometheus / Grafana / Loki
- [API 문서](../api/api) — REST API 레퍼런스

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0
