---
id: deployment
title: VMS Channel Bridge 배포 가이드
sidebar_position: 2
tags: [guide, admin]
---

# VMS Channel Bridge 배포 가이드

**버전**: 3.1.0
**최종 업데이트**: 2026-04-10

---

## 시스템 요구사항

### 최소 사양

- **CPU**: 2 코어
- **RAM**: 4GB
- **디스크**: 20GB
- **OS**: Linux (Ubuntu 20.04+ 권장), macOS, Windows 10+

### 권장 사양 (프로덕션)

- **CPU**: 4 코어
- **RAM**: 8GB
- **디스크**: 50GB (SSD 권장)
- **네트워크**: 고정 IP 또는 도메인

### 필수 소프트웨어

- Docker 24.0+
- Docker Compose 2.20+
- Git 2.30+

---

## 설치 준비

### 1. Docker 설치

#### Ubuntu/Debian

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

#### macOS

```bash
brew install docker docker-compose
open /Applications/Docker.app
```

#### Windows

1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop) 다운로드 및 설치
2. WSL 2 활성화
3. Docker Desktop 실행

### 2. 저장소 클론

```bash
git clone https://github.com/bong2jjang/vms-channel-bridge.git
cd vms-channel-bridge
```

### 3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일 편집:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token

# Microsoft Teams
TEAMS_TENANT_ID=your-tenant-id
TEAMS_APP_ID=your-app-id
TEAMS_APP_PASSWORD=your-app-password

# Database
POSTGRES_PASSWORD=secure_password_here
POSTGRES_USER=vmsuser
DATABASE_URL=postgresql://vmsuser:secure_password_here@postgres:5432/vms_channel_bridge

# Redis
REDIS_PASSWORD=secure_redis_password
REDIS_URL=redis://:secure_redis_password@redis:6379/0

# JWT
SECRET_KEY=generate_random_secret_key_here

# Bridge
BRIDGE_TYPE=native

# Frontend
FRONTEND_URL=http://localhost:5173

# SMTP (비밀번호 재설정용)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM_EMAIL=noreply@vms.local

# SSO - Microsoft Entra ID (선택)
SSO_MICROSOFT_ENABLED=false
SSO_MICROSOFT_TENANT_ID=your-tenant-id
SSO_MICROSOFT_CLIENT_ID=your-client-id
SSO_MICROSOFT_CLIENT_SECRET=your-client-secret

# SSO - Generic OIDC (선택)
SSO_OIDC_ENABLED=false
SSO_OIDC_ISSUER_URL=https://your-idp.example.com
SSO_OIDC_CLIENT_ID=your-client-id
SSO_OIDC_CLIENT_SECRET=your-client-secret
```

**보안 키 생성:**

```bash
openssl rand -hex 32    # SECRET_KEY
openssl rand -base64 32  # 패스워드
```

---

## 개발 환경 배포

### 서비스 시작

```bash
# 모든 서비스 시작 (개발 모드)
docker compose up -d --build

# 로그 확인
docker compose logs -f
```

### 서비스 접근

| 서비스 | URL | 비고 |
|--------|-----|------|
| Frontend UI | http://localhost:5173 | React 관리 화면 |
| Backend API | http://localhost:8000 | FastAPI |
| API Docs | http://localhost:8000/docs | Swagger UI |
| PostgreSQL | localhost:5432 | vmsuser / vmspassword |
| Redis | localhost:6379 | |
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | |
| MailHog | http://localhost:8025 | 개발용 메일 |

### 디버깅

```bash
# debugpy 활성화 (VS Code Remote Debug)
# docker-compose.yml에서 debugpy 포트(5678) 활성화 후:
docker compose up -d --build backend
# VS Code에서 localhost:5678로 attach
```

---

## 프로덕션 환경 배포

### 1. 프로덕션 빌드 및 실행

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. 초기 설정

```bash
# 관리자 계정 생성
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "SecurePassword123!",
    "role": "admin"
  }'
```

### 3. 서비스 상태 확인

```bash
# 컨테이너 상태
docker compose ps

# 헬스체크
curl http://localhost:8000/api/health

# 로그 확인
docker compose logs --tail=100 -f
```

### 4. SSL/TLS 설정

프로덕션 환경에서는 HTTPS 적용이 필수입니다. [SSL/TLS 설정 가이드](ssl-tls-setup)를 참조하세요.

---

## Docker Compose 서비스 구조

| 서비스 | 이미지 | 포트 | 역할 |
|--------|--------|------|------|
| backend | Python 3.11 / FastAPI | 8000 | API 서버 + Provider 연결 |
| frontend | Node 18 / Vite | 5173 | React 관리 UI |
| postgres | PostgreSQL 16 | 5432 | 메시지/사용자/설정 DB |
| redis | Redis 7 | 6379 | 라우팅 규칙 + 캐시 |
| prometheus | Prometheus | 9090 | 메트릭 수집 |
| grafana | Grafana | 3000 | 모니터링 대시보드 |
| loki | Loki | 3100 | 로그 수집 |
| promtail | Promtail | — | 로그 수집 에이전트 |
| mailhog | MailHog | 8025 | 개발용 메일 서버 |

모든 서비스는 `vms-channel-bridge-network` Docker 네트워크에서 통신합니다.

---

## 백업 및 복원

### 데이터베이스 백업

```bash
docker exec vms-channel-bridge-postgres pg_dump \
  -U vmsuser -d vms_channel_bridge \
  -F c -f /backups/backup_$(date +%Y%m%d_%H%M%S).dump
```

### 자동 백업

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

docker exec vms-channel-bridge-postgres pg_dump \
  -U vmsuser -d vms_channel_bridge \
  -F c -f /backups/postgres_$TIMESTAMP.dump

docker exec vms-channel-bridge-redis redis-cli --rdb /data/dump_$TIMESTAMP.rdb

cp .env $BACKUP_DIR/env_$TIMESTAMP.env

find $BACKUP_DIR -type f -mtime +7 -delete
echo "Backup completed: $TIMESTAMP"
```

```bash
# Cron: 매일 오전 2시
0 2 * * * /path/to/backup.sh >> /var/log/vms-backup.log 2>&1
```

### 복원

```bash
# PostgreSQL 복원
docker exec -i vms-channel-bridge-postgres pg_restore \
  -U vmsuser -d vms_channel_bridge -c \
  /backups/postgres_20260401_020000.dump

# Redis 복원
docker cp backups/dump.rdb vms-channel-bridge-redis:/data/dump.rdb
docker restart vms-channel-bridge-redis
```

---

## 업데이트

```bash
# 코드 업데이트
git pull origin main

# 전체 재빌드
docker compose up -d --build

# 또는 개별 서비스만
docker compose up -d --no-deps --build backend
docker compose up -d --no-deps --build frontend
```

---

## 보안 권장 사항

1. `.env` 파일을 Git에 커밋하지 마세요
2. 프로덕션에서는 외부에 필요한 포트만 개방 (80, 443)
3. 강력한 패스워드 사용 (DB, Redis, JWT Secret)
4. SSL/TLS 인증서 적용
5. 정기적 백업 수행
6. Docker 이미지 및 시스템 패키지 정기 업데이트

---

## 관련 문서

- [관리자 가이드](admin-guide) — 시스템 관리
- [Slack 설정](slack-setup) — Slack App 연동
- [Teams 설정](teams-setup) — Azure Bot 연동
- [모니터링 설정](monitoring-setup) — Prometheus / Grafana / Loki
- [SSL/TLS 설정](ssl-tls-setup) — 인증서 설정
- [이메일 설정](email-setup) — SMTP 설정
- [트러블슈팅](troubleshooting) — 문제 해결

---

**최종 업데이트**: 2026-04-10
**문서 버전**: 3.1
