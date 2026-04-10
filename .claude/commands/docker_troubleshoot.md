# Docker 서비스 문제 해결

Docker Compose 서비스 상태를 확인하고 문제를 진단합니다.

## 사용법

```bash
/docker_troubleshoot [service_name]
```

## Docker Compose 파일

| 파일 | 용도 |
|------|------|
| `docker-compose.dev.yml` | 개발 (hot-reload) |
| `docker-compose.debug.yml` | 디버깅 (debugpy 5678) |
| `docker-compose.prod.yml` | 배포 (Nginx, 리소스 제한) |

## 워크플로우

### 1. 서비스 상태 확인

```bash
docker compose -f docker-compose.dev.yml ps
```

### 2. 문제 서비스 진단

```bash
docker compose -f docker-compose.dev.yml logs --tail=50 [service_name]
docker inspect [container_name]
```

### 3. 서비스별 진단 포인트

**matterbridge**: Slack/Teams 토큰, matterbridge.toml 게이트웨이 설정, 채널 ID
**backend**: Python 의존성, 포트 8000 충돌, JWT_SECRET_KEY 설정, DB 연결 (SQLite 파일 경로), CORS
**frontend**: npm 의존성, 포트 5173 충돌, Vite 프록시 → backend:8000

### 4. 해결 방법

```bash
# 서비스 재시작
docker compose -f docker-compose.dev.yml restart [service_name]

# 재빌드
docker compose -f docker-compose.dev.yml up -d --build [service_name]

# 전체 초기화
docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up -d --build
```

## 출력 형식

```
## 서비스 상태
✅ matterbridge: 정상
❌ backend: 중지됨 - [원인]

## 해결 방법
1. [구체적 조치]
```
