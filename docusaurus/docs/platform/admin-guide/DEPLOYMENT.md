---
id: deployment
title: 배포 가이드
sidebar_position: 2
tags: [guide, admin, deployment, docker]
---

# 배포 가이드

## 개요

v-project는 Docker Compose 기반으로 모든 서비스를 관리합니다. 이 문서에서는 환경 변수 설정, Docker Compose 프로필별 실행 방법, 프로덕션 배포 체크리스트, 롤백 절차, 마이그레이션 관리까지 다룹니다.

:::danger 중요
로컬 환경에서 `npm install`이나 `python` 명령을 직접 실행하지 마세요. 로컬 Node.js 버전(v24)과 Docker 내부 버전(v18)이 다르기 때문에 의존성 충돌이 발생합니다. 모든 빌드와 실행은 Docker 컨테이너 안에서 수행해야 합니다.
:::

---

## 서비스 포트 맵

배포 전에 각 서비스가 사용하는 포트를 확인하세요.

| 서비스 | 컨테이너 이름 | 호스트 포트 | 내부 포트 | 프로필 |
|--------|--------------|------------|-----------|--------|
| PostgreSQL | v-project-postgres | 5432 | 5432 | (기본) |
| Redis | v-project-redis | 6379 | 6379 | (기본) |
| MailHog | v-project-mailhog | 1025 (SMTP), 8025 (Web UI) | 1025, 8025 | (기본) |
| v-channel-bridge Backend | v-channel-bridge-backend | 8000 | 8000 | (기본) |
| v-channel-bridge Frontend | v-channel-bridge-frontend | 5173 | 5173 | (기본) |
| v-platform-portal Backend | v-platform-portal-backend | 8080 | 8000 | portal |
| v-platform-portal Frontend | v-platform-portal-frontend | 5180 | 5173 | portal |
| v-platform-template Backend | v-platform-template-backend | 8002 | 8000 | template |
| v-platform-template Frontend | v-platform-template-frontend | 5174 | 5173 | template |
| Docusaurus | v-project-docusaurus | 3000 | 3000 | docs |

---

## 환경 변수 설정

### .env 파일 구성

프로젝트 루트에 `.env` 파일을 만들어 환경 변수를 설정합니다. `.env` 파일이 없으면 `docker-compose.yml`에 정의된 기본값이 사용됩니다.

:::danger 보안 경고
`.env` 파일은 절대 Git에 커밋하지 마세요. `.gitignore`에 이미 포함되어 있지만, 커밋 전에 반드시 확인하세요.
:::

```bash
# ─────────────────────────────────────────
# 데이터베이스
# ─────────────────────────────────────────
DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/v_project
POSTGRES_PASSWORD=vmspassword

# ─────────────────────────────────────────
# Redis (캐시 + 라우팅 룰 저장)
# ─────────────────────────────────────────
REDIS_URL=redis://:redispassword@redis:6379/0
REDIS_PASSWORD=redispassword

# ─────────────────────────────────────────
# 보안
# ─────────────────────────────────────────
SECRET_KEY=여기에-32자-이상-랜덤-문자열-입력
ENCRYPTION_KEY=
ENVIRONMENT=development

# ─────────────────────────────────────────
# 이메일 (개발: MailHog / 프로덕션: 실제 SMTP)
# ─────────────────────────────────────────
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@v-project.local
SMTP_FROM_NAME=v-channel-bridge

# ─────────────────────────────────────────
# 프론트엔드 URL (비밀번호 재설정 링크 등에 사용)
# ─────────────────────────────────────────
FRONTEND_URL=http://127.0.0.1:5173

# ─────────────────────────────────────────
# 호스트 (WSL 환경에서는 127.0.0.1 사용)
# ─────────────────────────────────────────
PUBLIC_HOST=127.0.0.1

# ─────────────────────────────────────────
# CORS 허용 오리진 (쉼표 구분)
# ─────────────────────────────────────────
CORS_ORIGINS=http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5180

# ─────────────────────────────────────────
# Slack Provider (Socket Mode)
# ─────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# ─────────────────────────────────────────
# Teams Provider (Graph API)
# ─────────────────────────────────────────
TEAMS_TENANT_ID=your-azure-tenant-id
TEAMS_APP_ID=your-azure-app-id
TEAMS_APP_PASSWORD=your-azure-client-secret
TEAMS_TEAM_ID=your-team-id

# ─────────────────────────────────────────
# Microsoft OAuth / SSO 콜백
# ─────────────────────────────────────────
MS_OAUTH_REDIRECT_URI=
BACKEND_URL=http://127.0.0.1:8000
BRIDGE_BACKEND_URL=http://127.0.0.1:8000
PORTAL_BACKEND_URL=http://127.0.0.1:8080
TEMPLATE_BACKEND_URL=http://127.0.0.1:8002

# ─────────────────────────────────────────
# 포털 앱 시드 (초기 등록용, 이후 Admin UI에서 관리)
# ─────────────────────────────────────────
# 형식: app_id|name|description|icon|frontend_url|backend_url (쉼표로 구분)
PORTAL_APPS=v-channel-bridge|Channel Bridge|Slack ↔ Teams 메시지 브리지|MessageSquare|http://127.0.0.1:5173|http://v-channel-bridge-backend:8000,v-platform-template|Platform Template|플랫폼 템플릿 앱|LayoutDashboard|http://127.0.0.1:5174|http://v-platform-template-backend:8000
```

### 환경 변수 상세 설명

#### 데이터베이스 / 인프라

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `DATABASE_URL` | PostgreSQL 접속 URL | `postgresql://vmsuser:vmspassword@postgres:5432/v_project` | O |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 (컨테이너 초기화용) | `vmspassword` | O |
| `REDIS_URL` | Redis 접속 URL (비밀번호 포함) | `redis://:redispassword@redis:6379/0` | O |
| `REDIS_PASSWORD` | Redis 비밀번호 | `redispassword` | O |

#### 보안

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `SECRET_KEY` | JWT 서명 키 (32자 이상) | 개발용 기본값 | O |
| `ENCRYPTION_KEY` | 데이터 암호화 키 | (없음) | - |
| `ENVIRONMENT` | `development` 또는 `production` | `development` | - |

:::warning SECRET_KEY 보안
프로덕션에서는 반드시 강력한 랜덤 값을 사용하세요. `openssl rand -hex 32` 명령으로 생성할 수 있습니다. 개발용 기본값(`v-project-secret-key-change-in-production-12345`)은 프로덕션에서 절대 사용하면 안 됩니다.
:::

#### 이메일

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `SMTP_HOST` | SMTP 서버 호스트 | `mailhog` | O |
| `SMTP_PORT` | SMTP 포트 (1025: MailHog, 587: TLS) | `1025` | O |
| `SMTP_USERNAME` | SMTP 사용자명 | (빈 문자열) | - |
| `SMTP_PASSWORD` | SMTP 비밀번호 | (빈 문자열) | - |
| `SMTP_FROM_EMAIL` | 발신 이메일 주소 | `noreply@v-project.local` | O |
| `SMTP_FROM_NAME` | 발신자 이름 | `v-channel-bridge` | - |

#### 외부 서비스

| 변수 | 설명 | 필수 |
|------|------|------|
| `SLACK_BOT_TOKEN` | Slack Bot Token (`xoxb-...`) | Slack 사용 시 |
| `SLACK_APP_TOKEN` | Slack App Token (`xapp-...`, Socket Mode 필수) | Slack 사용 시 |
| `TEAMS_TENANT_ID` | Azure AD Tenant ID | Teams 사용 시 |
| `TEAMS_APP_ID` | Azure Application ID | Teams/SSO 사용 시 |
| `TEAMS_APP_PASSWORD` | Azure Client Secret | Teams/SSO 사용 시 |
| `TEAMS_TEAM_ID` | 대상 Teams Team ID | Teams 사용 시 |

#### URL 설정

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PUBLIC_HOST` | 외부 접속 호스트 | `127.0.0.1` |
| `FRONTEND_URL` | 프론트엔드 URL (비밀번호 재설정 링크 등) | `http://127.0.0.1:5173` |
| `BACKEND_URL` | 백엔드 URL (SSO 콜백 등) | `http://127.0.0.1:8000` |
| `CORS_ORIGINS` | CORS 허용 오리진 (쉼표 구분) | 모든 앱 프론트엔드 URL |

:::tip WSL 환경
WSL에서 `localhost`를 사용하면 IPv6 충돌이 발생할 수 있습니다. `PUBLIC_HOST=127.0.0.1`을 설정하여 IPv4를 명시적으로 사용하세요.
:::

---

## Docker Compose 실행

### 프로필 구조

v-project는 Docker Compose 프로필을 사용하여 필요한 서비스만 선택적으로 실행합니다.

| 프로필 | 포함 서비스 | 용도 |
|--------|------------|------|
| (기본) | postgres, redis, mailhog, backend, frontend | v-channel-bridge 개발 |
| `portal` | + portal-backend, portal-frontend | 포털 앱 포함 |
| `template` | + template-backend, template-frontend | 템플릿 앱 포함 |
| `docs` | + docusaurus | 문서 사이트 포함 |

### 기본 실행 (v-channel-bridge만)

```bash
# 전체 빌드 + 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f backend
```

### 포털 포함 실행

```bash
docker compose --profile portal up -d --build
```

### 모든 앱 포함 실행

```bash
docker compose --profile template --profile portal up -d --build
```

### 문서 사이트 포함

```bash
docker compose --profile docs up -d --build
```

### 특정 서비스만 재빌드

소스 코드를 수정한 후 해당 서비스만 빠르게 재빌드할 수 있습니다.

```bash
# 백엔드만 재빌드
docker compose up -d --build v-channel-bridge-backend

# 프론트엔드만 재빌드
docker compose up -d --build v-channel-bridge-frontend

# 포털 백엔드만 재빌드
docker compose --profile portal up -d --build portal-backend
```

### 서비스 중지

```bash
# 모든 서비스 중지
docker compose --profile portal --profile template down

# 볼륨까지 삭제 (데이터 초기화)
docker compose --profile portal --profile template down -v
```

:::warning 볼륨 삭제 주의
`-v` 옵션은 PostgreSQL 데이터, Redis 데이터, pnpm 스토어 등 모든 볼륨을 삭제합니다. 개발 데이터가 모두 사라지므로 주의하세요.
:::

---

## 헬스 체크

### Docker Compose 헬스 체크

`docker-compose.yml`에 각 서비스별 헬스 체크가 설정되어 있습니다.

| 서비스 | 체크 방법 | 간격 | 타임아웃 |
|--------|----------|------|---------|
| PostgreSQL | `pg_isready -U vmsuser -d v_project` | 10s | 5s |
| Redis | `redis-cli --raw incr ping` | 10s | 5s |
| Backend | `curl -f http://127.0.0.1:8000/api/health` | 60s | 10s |
| Docusaurus | `wget -q --spider http://127.0.0.1:3000` | 30s | 10s |

### 애플리케이션 헬스 체크 API

`GET /api/health` 엔드포인트는 등록된 모든 서비스의 상태를 반환합니다.

```bash
curl http://127.0.0.1:8000/api/health
```

응답 예시:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 2.3
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 1.1
    }
  }
}
```

- `status`가 `"healthy"`이면 모든 서비스가 정상입니다.
- 하나라도 비정상이면 `"degraded"`가 반환됩니다.

앱은 `HealthRegistry`를 통해 자체 헬스 체크를 등록할 수 있습니다:

```python
from v_platform.api.health import health_registry

async def check_slack_connection():
    # Slack 연결 상태 확인 로직
    ...

health_registry.register("slack", check_slack_connection)
```

---

## 마이그레이션 관리

### 마이그레이션 파일 구조

v-project는 자체 마이그레이션 시스템을 사용합니다. 파일 이름의 접두사로 플랫폼과 앱 마이그레이션을 구분합니다.

| 접두사 | 범위 | 위치 |
|--------|------|------|
| `p001` ~ `p026` | 플랫폼 (v-platform) | `platform/backend/v_platform/migrations/` |
| `a001` ~ | 앱별 (v-channel-bridge 등) | `apps/{app}/backend/app/migrations/` |

### 마이그레이션 실행

마이그레이션은 애플리케이션 시작 시 `PlatformApp.init_platform()` 호출로 자동 실행됩니다. 수동으로 실행할 필요는 없습니다.

```python
# 각 앱의 main.py에서
app = PlatformApp(
    title="My App",
    app_id="my-app",
)
# init_platform() 호출 시 마이그레이션이 자동 실행됨
```

### 현재 플랫폼 마이그레이션 목록

| 파일 | 내용 |
|------|------|
| `p001_initial_schema.sql` | 초기 스키마 (users, sessions) |
| `p002_add_role_column.sql` | 역할(role) 컬럼 추가 |
| `p003_create_audit_logs.sql` | 감사 로그 테이블 |
| `p004` ~ `p010` | 메뉴, 권한 그룹, 시스템 설정 등 |
| `p011` ~ `p018` | SSO, 조직도, 알림, 앱 브랜딩 |
| `p019` ~ `p024` | app_id 격리, 알림 개선, 권한 그룹 멤버 |
| `p025`, `p026` | 역할 그룹 분리, 앱 메뉴 키 |

:::note 마이그레이션 순서
플랫폼 마이그레이션(`p` 접두사)이 항상 앱 마이그레이션(`a` 접두사)보다 먼저 실행됩니다. 이는 앱 테이블이 플랫폼 테이블(예: `users`)을 참조할 수 있기 때문입니다.
:::

### 새 마이그레이션 추가

1. 마이그레이션 파일을 해당 디렉토리에 추가합니다
2. 파일명 규칙: `{접두사}{번호}_{설명}.sql` (예: `p027_add_user_preferences.sql`)
3. Docker 서비스를 재시작하면 자동 적용됩니다

```bash
# 마이그레이션 적용을 위한 백엔드 재시작
docker compose restart backend
```

---

## 프로덕션 배포 체크리스트

프로덕션 환경으로 배포하기 전에 아래 항목을 확인하세요.

### 1. 보안 설정

- [ ] `SECRET_KEY`를 강력한 랜덤 값으로 변경 (`openssl rand -hex 32`)
- [ ] `ENCRYPTION_KEY` 설정
- [ ] `ENVIRONMENT=production` 설정
- [ ] PostgreSQL 비밀번호를 강력한 값으로 변경
- [ ] Redis 비밀번호를 강력한 값으로 변경
- [ ] `.env` 파일이 Git에 포함되지 않았는지 확인

### 2. 네트워크 / CORS

- [ ] `PUBLIC_HOST`를 실제 도메인 또는 서버 IP로 변경
- [ ] `FRONTEND_URL`을 실제 프론트엔드 URL로 변경
- [ ] `BACKEND_URL`을 실제 백엔드 URL로 변경
- [ ] `CORS_ORIGINS`에 허용할 오리진만 포함
- [ ] 불필요한 포트 외부 노출 차단 (PostgreSQL 5432, Redis 6379 등)

### 3. 이메일 설정

- [ ] `SMTP_HOST`를 실제 SMTP 서버로 변경 (Gmail, SendGrid, AWS SES 등)
- [ ] `SMTP_PORT`를 587(TLS)로 변경
- [ ] `SMTP_USERNAME`, `SMTP_PASSWORD` 설정
- [ ] `SMTP_FROM_EMAIL`을 실제 발신 주소로 변경
- [ ] MailHog 컨테이너 비활성화 또는 포트 노출 제거

### 4. 외부 서비스

- [ ] Slack Bot Token 설정 (Slack 연동 시)
- [ ] Teams/Azure 자격증명 설정 (Teams 연동 시)
- [ ] SSO 콜백 URL이 프로덕션 도메인을 가리키는지 확인

### 5. 인프라

- [ ] PostgreSQL 볼륨이 호스트에 영구 마운트되는지 확인
- [ ] Redis 데이터 영속성(AOF) 활성화 확인
- [ ] 로그 드라이버 설정 확인 (`json-file`, `max-size: 10m`, `max-file: 3`)
- [ ] 리버스 프록시(nginx 등) 설정 (SSL/TLS 인증서 포함)
- [ ] 백업 전략 수립

### 6. 모니터링

- [ ] `/api/health` 엔드포인트에 대한 외부 모니터링 설정
- [ ] Prometheus + Grafana 구성 (별도 가이드 참조)
- [ ] 로그 수집 설정 (Promtail + Loki)

---

## 프로덕션 Docker Compose 커스터마이징

프로덕션용으로 `docker-compose.prod.yml`을 별도로 만들어 오버라이드하는 것을 권장합니다.

```yaml
# docker-compose.prod.yml
services:
  postgres:
    ports: []  # 외부 포트 노출 제거

  redis:
    ports: []  # 외부 포트 노출 제거

  mailhog:
    profiles:
      - never  # 프로덕션에서는 MailHog 비활성화

  backend:
    restart: always
    environment:
      - ENVIRONMENT=production
    ports:
      - "127.0.0.1:8000:8000"  # 루프백만 허용 (리버스 프록시 뒤에서)

  frontend:
    restart: always
    ports:
      - "127.0.0.1:5173:5173"
```

실행:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

:::tip 포트 바인딩
프로덕션에서는 `127.0.0.1:포트:포트` 형식으로 바인딩하여, 리버스 프록시(nginx/Caddy)를 통해서만 외부 접근이 가능하도록 합니다. 직접 외부에 포트를 열지 마세요.
:::

---

## 롤백 절차

### 코드 롤백

배포 후 문제가 발생하면 이전 버전의 이미지로 롤백합니다.

```bash
# 1. 현재 상태 확인
docker compose ps

# 2. 문제 서비스의 로그 확인
docker compose logs --tail=100 backend

# 3. 이전 커밋으로 코드 되돌리기
git log --oneline -5
git checkout <이전-커밋-해시>

# 4. 해당 서비스 재빌드
docker compose up -d --build backend

# 5. 헬스 체크 확인
curl http://127.0.0.1:8000/api/health
```

### 데이터베이스 롤백

마이그레이션은 자동 실행되므로, 문제가 있는 마이그레이션을 되돌리려면 수동으로 SQL을 실행해야 합니다.

```bash
# 1. 컨테이너에서 psql 접속
docker exec -it v-project-postgres psql -U vmsuser -d v_project

# 2. 현재 적용된 마이그레이션 확인
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;

# 3. 필요한 롤백 SQL 실행
-- 예: 특정 컬럼 제거
ALTER TABLE users DROP COLUMN IF EXISTS new_column;

# 4. 마이그레이션 기록에서 제거
DELETE FROM schema_migrations WHERE filename = 'p027_add_new_column.sql';
```

:::warning 데이터베이스 롤백 주의
데이터베이스 롤백은 데이터 손실을 유발할 수 있습니다. 반드시 백업을 먼저 수행하고, 팀과 상의한 후 진행하세요.
:::

### 데이터베이스 백업 / 복원

```bash
# 백업
docker exec v-project-postgres pg_dump -U vmsuser v_project > backup_$(date +%Y%m%d_%H%M%S).sql

# 복원
docker exec -i v-project-postgres psql -U vmsuser -d v_project < backup_20260413_120000.sql
```

---

## 시나리오: 스테이징에서 프로덕션으로

이 시나리오는 스테이징 환경에서 테스트를 완료한 후 프로덕션에 처음 배포하는 과정을 설명합니다.

### 1단계: 프로덕션 서버 준비

```bash
# Docker, Docker Compose 설치 확인
docker --version
docker compose version

# 프로젝트 클론
git clone <repository-url> v-project
cd v-project
```

### 2단계: 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env  # 또는 직접 생성

# SECRET_KEY 생성
openssl rand -hex 32
# 출력된 값을 .env의 SECRET_KEY에 입력

# 프로덕션 값으로 수정
vi .env
# DATABASE_URL, REDIS_URL, SMTP 설정, FRONTEND_URL 등 변경
```

### 3단계: 서비스 시작

```bash
# 기본 서비스 (v-channel-bridge)
docker compose up -d --build

# 헬스 체크 확인 (PostgreSQL이 준비될 때까지 30초 정도 대기)
curl http://127.0.0.1:8000/api/health
```

### 4단계: 초기 관리자 계정 확인

v-platform은 최초 시작 시 기본 관리자 계정을 자동 생성합니다. 로그에서 확인할 수 있습니다.

```bash
docker compose logs backend | grep -i "admin"
```

:::warning 기본 비밀번호 변경
초기 관리자 계정으로 로그인한 후 반드시 비밀번호를 변경하세요.
:::

### 5단계: 포털 앱 추가 (선택)

```bash
# 포털 프로필 포함하여 재시작
docker compose --profile portal up -d --build

# 포털 헬스 체크
curl http://127.0.0.1:8080/api/health
```

### 6단계: 리버스 프록시 설정

SSL/TLS 인증서와 리버스 프록시 설정은 [SSL/TLS 설정 가이드](./SSL_TLS_SETUP.md)를 참조하세요.

### 7단계: 운영 모니터링 설정

Prometheus, Grafana, Loki 설정은 [모니터링 설정 가이드](./MONITORING_SETUP.md)를 참조하세요.

---

## 트러블슈팅

### 컨테이너가 시작되지 않음

```bash
# 컨테이너 상태 확인
docker compose ps

# 실패한 컨테이너 로그 확인
docker compose logs --tail=50 backend

# 일반적인 원인:
# - PostgreSQL이 아직 준비되지 않음 → depends_on + healthcheck가 처리하지만, 초기 시작 시 시간 소요
# - 포트 충돌 → 다른 프로세스가 같은 포트를 사용 중인지 확인
# - .env 파일 오류 → 환경 변수 형식 확인
```

### PostgreSQL 연결 실패

```bash
# PostgreSQL 컨테이너 상태 확인
docker exec v-project-postgres pg_isready -U vmsuser -d v_project

# 네트워크 확인 (컨테이너 간 통신)
docker exec v-channel-bridge-backend ping -c 2 postgres
```

### Redis 연결 실패

```bash
# Redis 컨테이너에서 직접 확인
docker exec v-project-redis redis-cli -a redispassword ping
# 응답: PONG
```

### 프론트엔드 빌드 실패

```bash
# 프론트엔드 컨테이너 로그 확인
docker compose logs --tail=50 frontend

# node_modules 볼륨 문제 시 볼륨 삭제 후 재빌드
docker compose down
docker volume rm v-project_frontend-pnpm-store
docker compose up -d --build frontend
```

### 마이그레이션 실패

```bash
# 백엔드 로그에서 마이그레이션 관련 오류 확인
docker compose logs backend | grep -i "migration"

# 직접 데이터베이스에서 마이그레이션 상태 확인
docker exec -it v-project-postgres psql -U vmsuser -d v_project \
  -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"
```

### 메모리 부족

각 프론트엔드 컨테이너는 `NODE_OPTIONS=--max-old-space-size=384`로 메모리를 제한하고 있으며, 컨테이너 자체도 512MB로 제한됩니다.

```bash
# 컨테이너별 메모리 사용량 확인
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"
```

모든 서비스를 동시에 실행하면 상당한 메모리가 필요합니다. 개발 시에는 필요한 프로필만 활성화하세요.

---

## 참고 문서

- [관리자 가이드](./ADMIN_GUIDE.md) -- 플랫폼 관리 기능 상세
- [모니터링 설정 가이드](./MONITORING_SETUP.md) -- Prometheus, Grafana, Loki 구성
- [이메일 설정 가이드](./EMAIL_SETUP.md) -- SMTP 및 MailHog 설정
- [SSL/TLS 설정 가이드](./SSL_TLS_SETUP.md) -- 리버스 프록시 및 인증서 설정
