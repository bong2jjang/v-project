---
id: admin-guide
title: VMS Chat Ops 관리자 가이드
sidebar_position: 1
tags: [guide, admin]
---

# VMS Chat Ops 관리자 가이드

**버전**: 3.1.0
**최종 업데이트**: 2026-04-10

---

## 소개

이 가이드는 VMS Chat Ops 시스템의 관리자를 위한 문서입니다. Provider 계정 관리, 사용자 관리, 백업, 보안, 모니터링 등 시스템 운영에 필요한 전반적인 내용을 다룹니다.

---

## 초기 설정

### 1. 관리자 계정 생성

시스템 최초 설치 후 관리자 계정을 생성합니다.

**방법 1: Web UI 사용**

1. 브라우저에서 `http://<서버IP>:5173/register` 접속
2. 다음 정보 입력:
   - Username: admin
   - Email: admin@yourdomain.com
   - Password: (강력한 패스워드)
3. "회원가입" 클릭

**방법 2: API 직접 호출**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "SecurePassword123!",
    "role": "SYSTEM_ADMIN"
  }'
```

### 2. Provider 계정 등록

Slack과 Teams Provider 계정을 등록합니다.

#### Web UI를 통한 등록

1. 관리자로 로그인
2. Settings 페이지로 이동
3. Provider 섹션에서 "+" 버튼 클릭
4. Provider 정보 입력:
   - **Slack**: Bot Token, App Token (Socket Mode용)
   - **Teams**: Tenant ID, App ID, App Password
5. "저장" 클릭
6. "연결 테스트" 버튼으로 연결 확인

#### API를 통한 등록

```bash
# Slack 계정 등록
curl -X POST http://localhost:8000/api/accounts-db \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "slack",
    "account_name": "my-workspace",
    "bot_token": "xoxb-...",
    "app_token": "xapp-..."
  }'

# Teams 계정 등록
curl -X POST http://localhost:8000/api/accounts-db \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "msteams",
    "account_name": "my-org",
    "tenant_id": "your-tenant-id",
    "app_id": "your-app-id",
    "app_password": "your-client-secret"
  }'
```

### 3. 환경 변수 설정

`.env` 파일에 다음 값을 설정합니다:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-app-token    # Socket Mode 필수

# Microsoft Teams
TEAMS_TENANT_ID=your-tenant-id
TEAMS_APP_ID=your-app-id
TEAMS_APP_PASSWORD=your-client-secret

# Database
DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/vms_chat_ops

# Redis
REDIS_URL=redis://:redispassword@redis:6379/0

# JWT
SECRET_KEY=your-secret-key-32chars-min

# Bridge
BRIDGE_TYPE=native

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

### 4. 서비스 시작

```bash
docker compose up -d --build
```

---

## 사용자 관리

### 사용자 역할

| 역할 | 설명 | 주요 권한 |
|------|------|----------|
| **SYSTEM_ADMIN** | 시스템 관리자 | 모든 권한 (시스템 설정, 사용자 관리, Provider 관리, RBAC 권한 관리, 조직 관리, 메뉴 관리) |
| **ORG_ADMIN** | 조직 관리자 | 소속 조직 사용자 관리, Provider 조회, Route 관리, 메시지 조회 |
| **USER** | 일반 사용자 | 대시보드 조회, 메시지 검색, 통계 조회, 본인 프로필 관리 |

> **참고**: 역할 외에도 **권한 그룹**과 **개인별 권한 오버라이드**를 통해 세밀한 접근 제어가 가능합니다. 유효 권한 = MAX(그룹 권한, 개인 오버라이드).

### 사용자 생성

**Web UI:**

1. 관리자로 로그인
2. 사이드바에서 "Users" 클릭
3. "새 사용자 추가" 버튼 클릭
4. 사용자 정보 입력 후 저장

**API:**

```bash
curl -X POST http://localhost:8000/api/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "password123",
    "role": "USER"
  }'
```

### 사용자 수정 / 비활성화 / 삭제

```bash
# 사용자 수정
curl -X PUT http://localhost:8000/api/users/2 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "newemail@example.com", "role": "SYSTEM_ADMIN"}'

# 비활성화
curl -X PUT http://localhost:8000/api/users/2 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# 삭제
curl -X DELETE http://localhost:8000/api/users/2 \
  -H "Authorization: Bearer <admin-token>"
```

### 비밀번호 재설정

사용자가 비밀번호를 분실한 경우:

1. 로그인 페이지에서 "비밀번호 찾기" 클릭
2. 이메일 입력 → 재설정 링크 발송 (SMTP 설정 필요)
3. 이메일의 링크로 새 비밀번호 설정

관리자가 직접 재설정:

```bash
curl -X PUT http://localhost:8000/api/users/2/reset-password \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "NewSecurePassword123!"}'
```

---

## SSO 관리

VMS Chat Ops는 **Microsoft Entra ID**와 **Generic OIDC** SSO 인증을 지원합니다.

### SSO 활성화

Settings 페이지의 SSO 탭에서 설정하거나, `.env`에서 직접 구성합니다.

**Microsoft Entra ID:**

1. Azure Portal → App Registrations → 새 앱 등록
2. Redirect URI: `http://<서버>/api/auth/sso/microsoft/callback`
3. Client Secret 생성
4. `.env`에 Tenant ID, Client ID, Client Secret 입력
5. `SSO_MICROSOFT_ENABLED=true` 설정

**Generic OIDC:**

1. IdP에서 OIDC 클라이언트 등록
2. Redirect URI: `http://<서버>/api/auth/sso/oidc/callback`
3. `.env`에 Issuer URL, Client ID, Client Secret 입력
4. `SSO_OIDC_ENABLED=true` 설정

### SSO 사용자 동작

- SSO로 최초 로그인 시 자동으로 사용자 계정이 생성됩니다 (기본 역할: `USER`)
- 기존 로컬 계정과 이메일이 동일하면 **하이브리드 인증** (로컬 + SSO 모두 사용 가능)으로 전환됩니다
- 관리자는 Users 페이지에서 SSO 사용자의 인증 방식 (`local`, `sso`, `hybrid`)을 확인할 수 있습니다

### SSO Provider 상태 확인

```bash
curl http://localhost:8000/api/auth/sso/providers \
  -H "Authorization: Bearer <admin-token>"
```

---

## 권한 관리 (RBAC)

### 권한 그룹

권한 그룹은 여러 권한을 묶어서 사용자에게 일괄 할당합니다.

**Web UI:**

1. Settings → Permissions 탭으로 이동
2. "새 권한 그룹" 클릭
3. 그룹 이름과 설명 입력
4. 부여할 권한 선택
5. 기본 할당 역할 설정 (선택: 해당 역할의 새 사용자에게 자동 부여)

**API:**

```bash
# 권한 그룹 생성
curl -X POST http://localhost:8000/api/permission-groups \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Route Manager",
    "description": "Route 관리 권한",
    "permissions": ["routes.create", "routes.update", "routes.delete"],
    "default_role": "ORG_ADMIN"
  }'

# 권한 그룹 목록 조회
curl http://localhost:8000/api/permission-groups \
  -H "Authorization: Bearer <admin-token>"
```

### 개인별 권한 오버라이드

특정 사용자에게 역할/그룹과 무관하게 개별 권한을 부여하거나 제한할 수 있습니다.

```bash
# 사용자 권한 조회
curl http://localhost:8000/api/permissions/users/3 \
  -H "Authorization: Bearer <admin-token>"

# 사용자 권한 업데이트
curl -X PUT http://localhost:8000/api/permissions/users/3 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": ["messages.export", "routes.view"]
  }'
```

### 유효 권한 계산

사용자의 유효 권한은 다음 순서로 결정됩니다:

1. **기본 역할 권한** (SYSTEM_ADMIN / ORG_ADMIN / USER)
2. **+ 권한 그룹** (소속 그룹의 권한 합산)
3. **+ 개인 오버라이드** (개인 설정이 최우선)

최종 권한 = MAX(역할 기본, 그룹 부여, 개인 오버라이드)

---

## 조직 관리

조직(회사/부서) 구조를 정의하고 사용자를 소속시킬 수 있습니다.

**Web UI:**

1. Settings → Organizations 탭으로 이동
2. 회사 생성 → 부서 추가
3. Users 페이지에서 사용자에게 조직 할당

**API:**

```bash
# 회사 생성
curl -X POST http://localhost:8000/api/organizations/companies \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "VMS Corp", "description": "본사"}'

# 부서 생성
curl -X POST http://localhost:8000/api/organizations/departments \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "개발팀", "company_id": 1}'
```

---

## 커스텀 메뉴 관리

사이드바 메뉴에 외부 링크, iframe 페이지, 메뉴 그룹을 추가할 수 있습니다.

**Web UI:**

1. Settings → Menus 탭으로 이동
2. "새 메뉴 추가" 클릭
3. 메뉴 유형 선택:
   - **외부 링크** (`custom_link`): 새 탭에서 URL 열기
   - **iframe 페이지** (`custom_iframe`): 앱 내에서 외부 페이지 표시
   - **메뉴 그룹** (`menu_group`): 하위 메뉴를 묶는 그룹
4. 접근 권한 설정 (역할별)
5. 표시 순서 조정 (드래그 & 드롭 또는 API)

**API:**

```bash
# 메뉴 아이템 생성
curl -X POST http://localhost:8000/api/menus \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Grafana Dashboard",
    "type": "custom_iframe",
    "url": "http://localhost:3000",
    "icon": "BarChart3",
    "section": "custom",
    "required_role": "ORG_ADMIN"
  }'

# 메뉴 순서 변경
curl -X PUT http://localhost:8000/api/menus/reorder \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"item_ids": [1, 3, 2, 4]}'
```

> **참고**: 사이드바 메뉴는 서버에서 사용자 역할에 따라 필터링되어 전달됩니다. 권한이 없는 메뉴는 자동으로 숨겨집니다.

---

## Route 관리

Route는 Slack과 Teams 채널 간 메시지 라우팅 규칙입니다. Web UI 또는 API로 관리합니다.

### Route 추가

**Web UI:**

1. Routes 페이지로 이동
2. "+ Add Route" 클릭
3. 소스/대상 플랫폼 및 채널 선택
4. 옵션 설정 (양방향, 모드)
5. "Create" 클릭

Route는 **즉시 적용**됩니다 (서비스 재시작 불필요).

**API:**

```bash
curl -X POST http://localhost:8000/api/bridge/routes \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "slack",
    "source_channel": "C1234567890",
    "target_platform": "msteams",
    "target_channel": "teamId:channelId",
    "is_bidirectional": true,
    "mode": "sender_info"
  }'
```

### Route 삭제

```bash
curl -X DELETE http://localhost:8000/api/bridge/routes \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "slack",
    "source_channel": "C1234567890",
    "target_platform": "msteams",
    "target_channel": "teamId:channelId"
  }'
```

### Redis 라우팅 구조

Route는 Redis에 저장됩니다:

```
route:{platform}:{channel_id}               → SET (대상 채널 집합)
route:{platform}:{channel_id}:names         → HASH (채널 이름)
route:{platform}:{channel_id}:modes         → HASH (전송 모드)
route:{platform}:{channel_id}:bidirectional → HASH (양방향 여부)
```

양방향 Route는 역방향 키도 자동 생성됩니다.

---

## 모니터링 및 로그

### 시스템 상태 확인

**Web UI:**

- Dashboard에서 브리지 상태, Provider 연결 상태 확인
- 상단 바의 시스템 상태 아이콘 클릭 → 서비스별 헬스 상세 정보

**API:**

```bash
# 헬스체크
curl http://localhost:8000/api/health

# 상세 헬스체크 (DB, Redis, Provider 상태)
curl http://localhost:8000/api/health/detailed \
  -H "Authorization: Bearer <token>"
```

### Docker 로그 확인

```bash
# 모든 서비스 로그
docker compose logs -f

# Backend 로그
docker logs vms-chatops-backend -f --tail=100

# 에러 로그만 필터링
docker compose logs | grep ERROR
```

### Prometheus + Grafana

Prometheus 메트릭 엔드포인트:

```bash
curl http://localhost:8000/api/metrics
```

Grafana 대시보드: `http://localhost:3000` (기본 계정: admin / admin)

Loki를 통한 로그 수집 및 분석도 지원됩니다. 자세한 내용은 [모니터링 설정 가이드](monitoring-setup)를 참조하세요.

### 감사 로그

모든 관리 작업이 감사 로그에 기록됩니다.

**기록되는 작업:**

- Route 추가/삭제/수정
- Provider 계정 변경
- 사용자 관리 (생성, 삭제, 역할 변경)
- 시스템 설정 변경
- 로그인/로그아웃 (SSO 포함)
- 권한 그룹/개인 권한 변경
- 조직(회사/부서) 변경
- 커스텀 메뉴 변경
- OAuth 토큰 관리

**Web UI:** Audit Logs 페이지에서 조회 (필터: 사용자별, 작업별, 리소스별, 기간별)

**API:**

```bash
curl "http://localhost:8000/api/audit-logs?action=update&from_date=2026-01-01" \
  -H "Authorization: Bearer <admin-token>"
```

---

## 백업 및 복원

### 데이터베이스 백업

```bash
# PostgreSQL 백업
docker exec vms-chatops-postgres pg_dump \
  -U vmsuser \
  -d vms_chat_ops \
  -F c \
  -f /backups/backup_$(date +%Y%m%d_%H%M%S).dump
```

### 자동 백업 스크립트

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL 백업
docker exec vms-chatops-postgres pg_dump \
  -U vmsuser \
  -d vms_chat_ops \
  -F c \
  -f /backups/postgres_$TIMESTAMP.dump

# Redis 백업
docker exec vms-chatops-redis redis-cli --rdb /data/dump_$TIMESTAMP.rdb

# 환경 변수 백업
cp .env $BACKUP_DIR/env_$TIMESTAMP.env

# 7일 이전 백업 삭제
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
```

**Cron 설정:**

```bash
# 매일 오전 2시 백업
0 2 * * * /path/to/backup.sh >> /var/log/vms-backup.log 2>&1
```

### 복원

```bash
# PostgreSQL 복원
docker exec -i vms-chatops-postgres pg_restore \
  -U vmsuser \
  -d vms_chat_ops \
  -c \
  /backups/postgres_20260401_020000.dump

# Redis 복원
docker cp backups/dump_20260401_020000.rdb vms-chatops-redis:/data/dump.rdb
docker restart vms-chatops-redis

# 환경 변수 복원
cp backups/env_20260401_020000.env .env
docker compose up -d --build
```

---

## 보안 관리

### JWT 토큰 관리

- **Access Token**: 기본 24시간 만료
- **Refresh Token**: 장기 세션 유지
- 다중 디바이스 로그인 지원, 개별 세션 해제 가능

`.env`에서 만료 시간 설정:

```bash
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24시간
```

### 방화벽 설정

프로덕션 환경에서는 필요한 포트만 개방합니다:

| 포트 | 서비스 | 외부 노출 |
|------|--------|----------|
| 80/443 | Nginx (리버스 프록시) | O |
| 8000 | Backend API | X (내부) |
| 5173 | Frontend | X (내부) |
| 5432 | PostgreSQL | X (내부) |
| 6379 | Redis | X (내부) |

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 보안 권장 사항

1. **환경 변수 보호**: `.env` 파일을 Git에 커밋하지 마세요
2. **강력한 패스워드**: 모든 서비스에 강력한 패스워드 사용
3. **SSL/TLS**: 프로덕션 환경에서 HTTPS 필수 ([SSL/TLS 설정](ssl-tls-setup) 참조)
4. **정기 업데이트**: Docker 이미지 및 시스템 패키지 업데이트
5. **최소 권한 원칙**: RBAC 역할과 권한 그룹을 활용하여 필요한 최소한의 권한만 부여
6. **감사 로그 검토**: 정기적으로 감사 로그 확인
7. **SSO 활용**: 가능한 경우 SSO 인증을 활성화하여 중앙 집중식 인증 관리

---

## 서비스 관리

### Docker Compose 서비스

| 서비스 | 컨테이너명 | 포트 | 역할 |
|--------|-----------|------|------|
| backend | vms-chatops-backend | 8000 | FastAPI + Provider 연결 |
| frontend | vms-chatops-frontend | 5173 | React 관리 UI |
| postgres | vms-chatops-postgres | 5432 | PostgreSQL 16 |
| redis | vms-chatops-redis | 6379 | Redis 7 (라우팅 + 캐시) |
| prometheus | prometheus | 9090 | 메트릭 수집 |
| grafana | grafana | 3000 | 모니터링 대시보드 |
| loki | loki | 3100 | 로그 수집 |
| promtail | promtail | — | 로그 수집 에이전트 |
| mailhog | mailhog | 8025 | 개발용 메일 서버 |

### 서비스 제어

```bash
# 전체 시작
docker compose up -d

# 전체 중지
docker compose down

# 특정 서비스 재시작
docker compose restart backend

# 백엔드만 재빌드
docker compose up -d --build backend

# 서비스 상태 확인
docker compose ps

# 리소스 사용량 확인
docker stats
```

### 업데이트

```bash
# 코드 업데이트
git pull origin main

# 이미지 재빌드 및 재시작
docker compose up -d --build

# 또는 개별 서비스만
docker compose up -d --no-deps --build backend
docker compose up -d --no-deps --build frontend
```

---

## 모범 사례

1. **정기 백업**: 매일 자동 백업, 월 1회 복원 테스트
2. **모니터링**: Grafana 대시보드 정기 확인, 에러 로그 일일 검토
3. **보안**: 강력한 패스워드, SSL/TLS 적용, 정기적 패스워드 변경
4. **업데이트**: 월 1회 Docker 이미지 업데이트, 분기별 시스템 패키지 업데이트
5. **문서화**: 설정 변경 사항 기록, 운영 절차서 유지

---

## 관련 문서

- [사용자 가이드](../user-guide/user-guide) — 기본 사용법
- [배포 가이드](deployment) — 설치 및 운영
- [Slack 설정](slack-setup) — Slack App 연동
- [Teams 설정](teams-setup) — Azure Bot 연동
- [모니터링 설정](monitoring-setup) — Prometheus / Grafana / Loki
- [트러블슈팅](troubleshooting) — 문제 해결
- [API 문서](../api/api) — REST API 레퍼런스

---

**최종 업데이트**: 2026-04-10
**문서 버전**: 3.1
