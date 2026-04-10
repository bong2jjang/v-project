# v-project 개발 워크플로우

## Docker Compose 환경

| 파일 | 용도 | 명령 |
|------|------|------|
| `docker-compose.dev.yml` | 개발 (hot-reload) | `docker compose -f docker-compose.dev.yml up -d --build` |
| `docker-compose.debug.yml` | 디버깅 (debugpy 5678) | `docker compose -f docker-compose.debug.yml up -d --build` |
| `docker-compose.prod.yml` | 배포 (Nginx, 리소스 제한) | `docker compose -f docker-compose.prod.yml up -d --build` |

### 서비스 포트

| 서비스 | 포트 |
|--------|------|
| Backend API | 8000 |
| Frontend UI | 5173 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MailHog Web UI | 8025 |
| debugpy | 5678 (debug 모드만) |

### 로그 확인

```bash
# 전체 로그
docker compose -f docker-compose.dev.yml logs -f

# 특정 서비스
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend

# 서비스 재시작
docker compose -f docker-compose.dev.yml restart backend
```

### 컨테이너 내에서 직접 실행

```bash
# Backend 컨테이너에 접속
docker exec -it v-project-backend bash

# Redis CLI
docker exec -it v-project-redis redis-cli -a redispassword

# PostgreSQL
docker exec -it v-project-postgres psql -U vmsuser v_project
```

---

## Python 백엔드 워크플로우

### 코드 수정 후 필수 단계

```bash
cd backend && python -m ruff check --fix . && python -m ruff format .
```

### 타입 체크

```bash
cd backend && python -m mypy app/
```

### 테스트

```bash
# Docker 컨테이너에서 실행 (권장)
docker exec v-project-backend python -m pytest tests/ -v

# 특정 테스트
docker exec v-project-backend python -m pytest tests/adapters/test_slack_provider.py -v
docker exec v-project-backend python -m pytest tests/services/test_route_manager.py -v

# 커버리지
docker exec v-project-backend python -m pytest tests/ --cov=app --cov-report=html
```

### 디버깅 (VSCode)

1. `docker compose -f docker-compose.debug.yml up -d --build`
2. VSCode에서 "Debug: Backend (Docker Attach)" 실행
3. 백엔드가 debugpy 5678에서 연결 대기 → 자동 연결

---

## TypeScript 프론트엔드 워크플로우

### 검증 순서 (순서대로 실행)

```bash
# 1. 타입 체크
cd frontend && npx tsc --noEmit

# 2. 린트 + 포맷
cd frontend && npm run lint:fix && npm run format

# 3. 테스트
cd frontend && npx vitest --run

# 4. 빌드 확인 (선택적)
cd frontend && npm run build
```

---

## v-channel-bridge 개발 가이드

### Provider 추가 시

새 플랫폼 Provider 추가 절차:

```bash
# 1. Provider 파일 생성
touch backend/app/adapters/new_platform_provider.py

# 2. BasePlatformProvider 상속 구현
#    - connect() / disconnect()
#    - send_message() / receive_messages()
#    - transform_to_common() / transform_from_common()
#    - get_channels() / get_users()

# 3. adapters/__init__.py에 export 추가
# 4. main.py에서 Provider 초기화 로직 추가
# 5. 단위 테스트 작성
touch backend/tests/adapters/test_new_platform_provider.py

# 6. Lint 후 커밋
cd backend && python -m ruff check --fix . && python -m ruff format .
git add backend/app/adapters/ backend/tests/adapters/
git commit -m "feat(adapters): NewPlatform Provider 구현"
```

### Route 관리 (Redis CLI)

```bash
# 라우팅 룰 확인
docker exec v-project-redis redis-cli -a redispassword KEYS "route:*"

# 특정 채널의 라우팅 타겟 조회
docker exec v-project-redis redis-cli -a redispassword SMEMBERS "route:slack:C123456"

# 양방향 라우트 수동 추가 (긴급 시)
docker exec v-project-redis redis-cli -a redispassword \
  SADD "route:slack:C123" "teams:TEAM1:19:xxx@thread.tacv2"
docker exec v-project-redis redis-cli -a redispassword \
  HSET "route:slack:C123:bidirectional" "teams:TEAM1:19:xxx@thread.tacv2" "1"

# 모든 라우팅 룰 초기화 (위험!)
# docker exec v-project-redis redis-cli -a redispassword FLUSHDB
```

### Teams 채널 ID 형식

Teams 채널은 `{teamId}:{channelId}` 형식으로 저장합니다:
- `teamId`: Azure Teams Team ID (GUID 또는 숫자)
- `channelId`: `19:xxxx@thread.tacv2` 형식

예: `19ABCdef:19:xxxx@thread.tacv2`

---

## Teams 봇 개발 설정

실제 Teams 봇 테스트를 위한 Azure 설정:

```bash
# 1. Azure Portal에서 Bot 등록
# https://portal.azure.com → Bot Services → Create

# 2. ngrok으로 로컬 webhook 노출 (개발용)
ngrok http 8000
# Messaging Endpoint: https://{ngrok-url}/api/teams/webhook

# 3. .env 설정
TEAMS_APP_ID=<Azure App ID>
TEAMS_APP_PASSWORD=<Azure Client Secret>
TEAMS_TENANT_ID=<Azure Tenant ID>

# 4. Backend 재시작
docker compose -f docker-compose.dev.yml restart backend

# 5. 로그 확인
docker compose -f docker-compose.dev.yml logs -f backend | grep -i teams
```

---

## Git 워크플로우

### 커밋 메시지 규칙

```
<type>(<scope>): <subject>
```

- **type**: feat, fix, docs, style, refactor, test, chore
- **scope**: backend, frontend, docker, adapters, docs, auth

### 브랜치 전략

- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/<name>`: 기능 개발
- `fix/<name>`: 버그 수정
- `hotfix/<name>`: 긴급 수정

### 기본 작업 흐름

1. 코드 수정
2. Lint/Format 실행
3. 테스트 실행 (`docker exec v-project-backend python -m pytest tests/ -v`)
4. `git add` + `git commit`
5. 사용자에게 완료 보고 (commit hash 포함)
6. **`git push`는 사용자가 명시적으로 요청할 때만**

---

## 배포 워크플로우

### 프로덕션 배포 전 체크리스트

```bash
# 1. 전체 테스트 통과 확인
docker exec v-project-backend python -m pytest tests/ -v

# 2. 환경 변수 검증
/deploy-check

# 3. DB 백업
docker exec v-project-postgres pg_dump -U vmsuser v_project > backup-$(date +%Y%m%d).sql

# 4. 프로덕션 빌드
docker compose -f docker-compose.prod.yml build

# 5. 배포
docker compose -f docker-compose.prod.yml up -d

# 6. Provider 상태 확인
curl http://localhost:8000/api/bridge/status
```

### 긴급 롤백

```bash
# 이전 이미지로 롤백
docker compose -f docker-compose.prod.yml down
git checkout <이전-커밋>
docker compose -f docker-compose.prod.yml up -d --build
```
