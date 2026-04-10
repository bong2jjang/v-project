# 배포 전 체크리스트 자동 검증

v-project(v-platform + v-channel-bridge) 배포 전 필수 항목들을 자동으로 검증합니다.

## 사용법

```bash
# 전체 배포 체크리스트 검증
/deploy-check

# 특정 카테고리만 검증
/deploy-check env        # 환경 변수만
/deploy-check provider   # Provider만
/deploy-check db         # DB만
```

## 워크플로우

### 1. 환경 변수 검증

```bash
# 필수 환경 변수 확인
required_vars=(
  "SLACK_APP_TOKEN"
  "TEAMS_APP_ID"
  "TEAMS_APP_PASSWORD"
  "TEAMS_TENANT_ID"
  "SECRET_KEY"
  "DATABASE_URL"
  "REDIS_URL"
  "BRIDGE_TYPE"
)

for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" .env; then
    echo "❌ ${var} 미설정"
  else
    echo "✅ ${var} 설정됨"
  fi
done
```

### 2. Provider 설정 검증

```bash
# BRIDGE_TYPE 확인
bridge_type=$(grep BRIDGE_TYPE .env | cut -d'=' -f2)

if [ "$bridge_type" != "native" ]; then
  echo "❌ BRIDGE_TYPE이 'native'가 아닙니다 (현재: $bridge_type)"
  echo "   조치: .env에서 BRIDGE_TYPE=native로 설정"
fi

# Slack Socket Mode 활성화 확인
echo "⚠️  Slack App 설정 확인 필요:"
echo "   https://api.slack.com/apps → Your App → Socket Mode"
echo "   'Enable Socket Mode' 토글이 ON 상태인지 확인"

# Teams API 권한 확인
echo "⚠️  Teams API 권한 확인 필요:"
echo "   https://portal.azure.com → App registrations → Your App → API permissions"
echo "   필수 권한:"
echo "   - ChannelMessage.Read.All"
echo "   - ChannelMessage.Send"
echo "   - Team.ReadBasic.All"
echo "   - Chat.ReadWrite"
```

### 3. 데이터베이스 마이그레이션 확인

```bash
# DB 연결 확인
docker compose -f docker-compose.prod.yml exec postgres psql $DATABASE_URL -c "SELECT 1"

# 마이그레이션 상태 확인
docker compose -f docker-compose.prod.yml exec backend alembic current

# 최신 마이그레이션인지 확인
docker compose -f docker-compose.prod.yml exec backend alembic heads
```

### 4. Redis 라우팅 룰 확인

```bash
# Redis 연결 확인
docker compose -f docker-compose.prod.yml exec redis redis-cli ping

# 라우팅 룰 개수 확인
route_count=$(docker compose -f docker-compose.prod.yml exec redis redis-cli --scan --pattern "route:*" | wc -l)

if [ "$route_count" -eq 0 ]; then
  echo "❌ Redis에 라우팅 룰이 없습니다"
  echo "   조치: 최소 1개 이상의 라우팅 룰 추가 필요"
else
  echo "✅ 라우팅 룰 $route_count개 등록됨"
fi

# 라우팅 룰 목록
docker compose -f docker-compose.prod.yml exec redis redis-cli --scan --pattern "route:*"
```

### 5. 컨테이너 헬스체크

```bash
# 모든 컨테이너 상태 확인
docker compose -f docker-compose.prod.yml ps

# Backend 헬스체크
curl -f http://localhost:8000/api/health || echo "❌ Backend 헬스체크 실패"

# Frontend 헬스체크 (프로덕션)
curl -f http://localhost:80 || echo "❌ Frontend 헬스체크 실패"
```

### 6. 로그 확인

```bash
# Backend 에러 로그 확인 (최근 100줄)
docker compose -f docker-compose.prod.yml logs backend --tail=100 | grep -i "error\|exception\|failed"

# Provider 초기화 로그 확인
docker compose -f docker-compose.prod.yml logs backend | grep -i "provider initialized"
```

### 7. 보안 설정 확인

```bash
# SECRET_KEY 강도 확인 (최소 32자)
secret_key=$(grep SECRET_KEY .env | cut -d'=' -f2)
if [ ${#secret_key} -lt 32 ]; then
  echo "❌ SECRET_KEY가 너무 짧습니다 (현재: ${#secret_key}자, 최소: 32자)"
else
  echo "✅ SECRET_KEY 강도 충분 (${#secret_key}자)"
fi

# .env 파일 권한 확인
env_perms=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null)
if [ "$env_perms" != "600" ]; then
  echo "⚠️  .env 파일 권한이 안전하지 않습니다 (현재: $env_perms, 권장: 600)"
  echo "   조치: chmod 600 .env"
else
  echo "✅ .env 파일 권한 안전 (600)"
fi

# CORS 설정 확인 (프로덕션)
if grep -q "CORS_ORIGINS=\*" .env; then
  echo "⚠️  CORS가 모든 출처를 허용합니다 (*)"
  echo "   조치: 프로덕션 도메인만 허용하도록 변경"
else
  echo "✅ CORS 설정 안전"
fi
```

### 8. 백업 확인

```bash
# DB 백업 존재 여부 확인
if [ -d "backups/database" ] && [ "$(ls -A backups/database)" ]; then
  latest_backup=$(ls -t backups/database/*.sql | head -1)
  echo "✅ 최신 DB 백업: $latest_backup"
else
  echo "⚠️  DB 백업이 없습니다"
  echo "   조치: 배포 전 백업 생성 권장"
fi

# 설정 파일 백업 확인
if [ -f "backups/.env.backup" ]; then
  echo "✅ 환경 변수 백업 존재"
else
  echo "⚠️  환경 변수 백업이 없습니다"
  echo "   조치: cp .env backups/.env.backup"
fi
```

### 9. 리소스 제한 확인

```bash
# docker-compose.prod.yml에서 리소스 제한 확인
if grep -q "deploy:" docker-compose.prod.yml && grep -q "resources:" docker-compose.prod.yml; then
  echo "✅ 컨테이너 리소스 제한 설정됨"
else
  echo "⚠️  컨테이너 리소스 제한 미설정"
  echo "   조치: docker-compose.prod.yml에 deploy.resources 추가 권장"
fi
```

## 출력 형식

```
## 배포 전 체크리스트

### 1. 환경 변수 ✅
✅ SLACK_APP_TOKEN 설정됨
✅ TEAMS_APP_ID 설정됨
✅ TEAMS_APP_PASSWORD 설정됨
✅ TEAMS_TENANT_ID 설정됨
✅ SECRET_KEY 설정됨
✅ DATABASE_URL 설정됨
✅ REDIS_URL 설정됨
✅ BRIDGE_TYPE=native

### 2. Provider 설정 ⚠️
⚠️  Slack Socket Mode 수동 확인 필요
    https://api.slack.com/apps → Your App → Socket Mode
⚠️  Teams API 권한 수동 확인 필요
    https://portal.azure.com → App registrations

### 3. 데이터베이스 ✅
✅ DB 연결 정상
✅ 마이그레이션 최신 상태 (rev: abc123)

### 4. Redis 라우팅 ✅
✅ Redis 연결 정상 (PONG)
✅ 라우팅 룰 3개 등록됨
  - route:slack:#general → teams:General
  - route:slack:#dev → teams:Development
  - route:teams:General → slack:#general

### 5. 컨테이너 헬스체크 ✅
✅ Backend (8000): 정상
✅ Frontend (80): 정상
✅ Postgres: 정상
✅ Redis: 정상

### 6. 로그 확인 ✅
✅ 에러 로그 없음
✅ SlackProvider initialized
✅ TeamsProvider initialized

### 7. 보안 설정 ⚠️
✅ SECRET_KEY 강도 충분 (64자)
⚠️  .env 파일 권한 안전하지 않음 (644 → 600 권장)
✅ CORS 설정 안전 (특정 도메인만 허용)

### 8. 백업 ✅
✅ 최신 DB 백업: backups/database/2024-01-15_10-30-00.sql
✅ 환경 변수 백업 존재

### 9. 리소스 제한 ✅
✅ 컨테이너 리소스 제한 설정됨

---

## 요약
✅ 통과: 7개
⚠️  경고: 3개
❌ 실패: 0개

### 권장 조치사항
1. .env 파일 권한 변경: chmod 600 .env
2. Slack Socket Mode 수동 확인 (웹 콘솔)
3. Teams API 권한 수동 확인 (Azure Portal)

### 배포 준비 상태
⚠️  경고 항목 해결 후 배포 진행 가능
```

## 치명적 오류 예시

```
## 배포 전 체크리스트

### 1. 환경 변수 ❌
❌ SLACK_APP_TOKEN 미설정
✅ TEAMS_APP_ID 설정됨
❌ SECRET_KEY 미설정
✅ BRIDGE_TYPE=native

### 4. Redis 라우팅 ❌
✅ Redis 연결 정상
❌ 라우팅 룰 0개 - 최소 1개 이상 필요

---

## 요약
✅ 통과: 5개
⚠️  경고: 2개
❌ 실패: 2개

### 치명적 오류
다음 항목들을 반드시 해결해야 배포 가능합니다:
1. SLACK_APP_TOKEN 환경 변수 설정
2. SECRET_KEY 환경 변수 설정
3. Redis 라우팅 룰 최소 1개 추가

### 배포 준비 상태
❌ 치명적 오류 해결 후 재검증 필요
```

## 자동 수정 스크립트

### 환경 변수 템플릿 생성

```bash
# .env 템플릿 생성
cat > .env.template <<EOF
# Slack 설정
SLACK_APP_TOKEN=xapp-1-XXXXXXXXX-XXXXXXXXX-XXXXXXXXXXXXX
SLACK_BOT_TOKEN=xoxb-XXXXXXXXXXXX-XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX

# Teams 설정
TEAMS_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TEAMS_APP_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TEAMS_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 애플리케이션 설정
SECRET_KEY=$(openssl rand -hex 32)
BRIDGE_TYPE=native

# 데이터베이스 설정
DATABASE_URL=postgresql://vmsuser:vmspassword@postgres:5432/v_project
POSTGRES_PASSWORD=vmspassword

# Redis 설정
REDIS_URL=redis://:redispassword@redis:6379/0
REDIS_PASSWORD=redispassword

# CORS 설정 (프로덕션 도메인)
CORS_ORIGINS=https://your-domain.com

# 이메일 설정
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM_EMAIL=noreply@your-domain.com
FRONTEND_URL=https://your-domain.com
EOF

echo "✓ .env.template 생성 완료"
echo "  조치: .env.template을 참고하여 .env 파일 작성"
```

### 라우팅 룰 초기화

```bash
# 기본 라우팅 룰 추가
docker compose -f docker-compose.prod.yml exec redis redis-cli SADD "route:slack:#general" "teams:General"
docker compose -f docker-compose.prod.yml exec redis redis-cli SADD "route:teams:General" "slack:#general"

echo "✓ 기본 라우팅 룰 추가 완료"
```

## 배포 후 검증

```bash
# 배포 후 즉시 실행
/provider-health

# 샘플 메시지 전송 테스트
curl -X POST http://localhost:8000/api/messages/test \
  -H "Content-Type: application/json" \
  -d '{
    "source": "slack",
    "channel": "#general",
    "text": "Test message from v-channel-bridge"
  }'

# 5분 후 메시지 전송 통계 확인
curl http://localhost:8000/api/statistics/messages?interval=5m
```

## Rollback 준비

```bash
# 배포 전 현재 상태 스냅샷
cat > backups/pre-deploy-snapshot.txt <<EOF
Date: $(date)
Branch: $(git branch --show-current)
Commit: $(git rev-parse HEAD)
Docker Images:
$(docker images | grep v-project)
Environment:
BRIDGE_TYPE=$(grep BRIDGE_TYPE .env | cut -d'=' -f2)
EOF

echo "✓ 배포 전 스냅샷 생성 완료"
```

## 관련 명령어

- `/provider-health` - Provider 연결 상태 확인
- `/test-provider` - Provider 단위 테스트
- `/migration_status` - 마이그레이션 진행 상황
- `/check_sync_status` - 메시지 브리지 동기화 상태

## 프로덕션 배포 체크리스트 (수동)

### 배포 전
- [ ] .env 파일 모든 필수 변수 설정
- [ ] SECRET_KEY 충분한 강도 (32자 이상)
- [ ] DB 백업 완료
- [ ] 설정 파일 백업 완료
- [ ] `/deploy-check` 통과 (경고 없음)
- [ ] Provider 테스트 통과 (`/test-provider all`)
- [ ] Redis 라우팅 룰 등록

### 배포 중
- [ ] docker-compose.prod.yml 사용
- [ ] 무중단 배포 (blue-green 또는 rolling update)
- [ ] 로그 실시간 모니터링

### 배포 후
- [ ] `/provider-health` 실행 (모든 Provider 연결 확인)
- [ ] 샘플 메시지 전송 테스트
- [ ] 실제 Slack → Teams 메시지 확인
- [ ] 실제 Teams → Slack 메시지 확인
- [ ] 통계 대시보드 확인
- [ ] 에러 로그 모니터링 (1시간)

### Rollback 트리거
- [ ] Provider 연결 실패 5분 이상 지속
- [ ] 메시지 전송 실패율 > 10%
- [ ] 치명적 에러 발생
