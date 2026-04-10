---
id: testing-guide
title: VMS Chat Ops 테스트 가이드
sidebar_position: 2
tags: [guide, developer]
---

# VMS Chat Ops 테스트 가이드

VMS Chat Ops Light-Zowe 아키텍처의 테스트 전략, 실행 방법, 검증 체크리스트를 안내합니다.

---

## 테스트 스택

| 영역 | 도구 | 비고 |
|------|------|------|
| Backend 단위 테스트 | pytest | Docker 컨테이너에서 실행 |
| Backend 커버리지 | pytest-cov | 목표: 80% 이상 |
| Frontend 단위 테스트 | vitest | Vite 네이티브 테스트 러너 |
| API 수동 테스트 | Swagger UI | http://localhost:8000/docs |
| E2E 테스트 | curl / Postman | API 엔드포인트 검증 |

---

## Backend 테스트

### 테스트 실행

```bash
# 전체 테스트
docker exec vms-chatops-backend python -m pytest tests/ -v

# 특정 디렉토리
docker exec vms-chatops-backend python -m pytest tests/adapters/ -v
docker exec vms-chatops-backend python -m pytest tests/services/ -v

# 특정 파일
docker exec vms-chatops-backend python -m pytest tests/adapters/test_slack_provider.py -v

# 커버리지 포함
docker exec vms-chatops-backend python -m pytest tests/ -v --cov=app --cov-report=term

# HTML 커버리지 리포트
docker exec vms-chatops-backend python -m pytest tests/ --cov=app --cov-report=html
```

### 테스트 구조

```
backend/tests/
├── adapters/
│   ├── test_slack_provider.py    # Slack Provider 단위 테스트
│   └── test_teams_provider.py    # Teams Provider 단위 테스트
├── services/
│   ├── test_route_manager.py     # Route Manager 테스트
│   ├── test_websocket_bridge.py  # WebSocket Bridge 테스트
│   └── test_message_queue.py     # MessageQueue 테스트
└── conftest.py                   # 공통 fixture
```

### 테스트 대상별 검증 항목

#### Provider 테스트

- `connect()` / `disconnect()` 생명주기
- `transform_to_common()` — 플랫폼 메시지 → CommonMessage 변환
- `send_message()` — CommonMessage → 플랫폼 API 호출
- `get_channels()` — 채널 목록 조회
- 에러 처리 (인증 실패, 네트워크 오류, API 제한)

#### Route Manager 테스트

- `add_route()` — 단방향/양방향 Route 추가
- `remove_route()` — Route 삭제 및 역방향 키 정리
- `get_targets()` — 대상 채널 조회
- `get_all_routes()` — 전체 Route 목록 (양방향 중복 제거)
- Redis 키 구조 검증

#### WebSocket Bridge 테스트

- 메시지 라우팅: 소스 → Route Manager → 대상 Provider
- 파일 첨부 처리
- 에러 시 메시지 상태 업데이트

---

## Frontend 테스트

### 테스트 실행

```bash
# Docker 컨테이너에서 실행
docker exec vms-chatops-frontend npx vitest --run

# 감시 모드 (개발 시)
docker exec -it vms-chatops-frontend npx vitest
```

### 테스트 도구

- **vitest**: Vite 네이티브 테스트 러너
- **@testing-library/react**: React 컴포넌트 테스트
- **msw** (선택): API 모킹

---

## API 통합 테스트

### 헬스체크

```bash
# 기본 헬스체크
curl http://localhost:8000/api/health

# 상세 헬스체크 (DB, Redis, Provider 상태)
curl http://localhost:8000/api/health/detailed \
  -H "Authorization: Bearer <token>"
```

### 인증 테스트

```bash
# 회원가입
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "Test1234!"}'

# 로그인
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "Test1234!"}'
```

### Provider 계정 테스트

```bash
# Slack 계정 등록
curl -X POST http://localhost:8000/api/accounts-db \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "slack",
    "account_name": "test-workspace",
    "bot_token": "xoxb-...",
    "app_token": "xapp-..."
  }'

# 연결 테스트
curl -X POST http://localhost:8000/api/accounts-db/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"platform": "slack", "account_name": "test-workspace"}'
```

### Route 관리 테스트

```bash
# Route 추가
curl -X POST http://localhost:8000/api/bridge/routes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "slack",
    "source_channel": "C1234567890",
    "target_platform": "msteams",
    "target_channel": "teamId:channelId",
    "is_bidirectional": true,
    "mode": "sender_info"
  }'

# Route 목록 조회
curl http://localhost:8000/api/bridge/routes \
  -H "Authorization: Bearer <token>"

# 채널 목록 조회
curl http://localhost:8000/api/bridge/channels/slack \
  -H "Authorization: Bearer <token>"
```

### 메시지 조회 테스트

```bash
# 메시지 목록
curl "http://localhost:8000/api/messages?page=1&per_page=20" \
  -H "Authorization: Bearer <token>"

# 메시지 검색
curl "http://localhost:8000/api/messages?search=hello&platform=slack" \
  -H "Authorization: Bearer <token>"
```

---

## Docker 서비스 검증

### 전체 서비스 상태 확인

```bash
# 컨테이너 상태
docker compose ps

# 리소스 사용량
docker stats --no-stream
```

### 개별 서비스 검증

```bash
# PostgreSQL 연결
docker exec vms-chatops-postgres psql -U vmsuser -d vms_chat_ops \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Redis 연결
docker exec vms-chatops-redis redis-cli PING

# Redis Route 키 확인
docker exec vms-chatops-redis redis-cli KEYS "route:*"

# Backend 로그에서 에러 확인
docker logs vms-chatops-backend --tail=100 | grep -i error
```

---

## 메시지 브리지 E2E 테스트

Provider 연결이 완료된 상태에서 실제 메시지 브리지를 테스트합니다.

### 사전 조건

1. Slack Provider 계정이 등록되고 연결된 상태
2. Teams Provider 계정이 등록되고 연결된 상태
3. Route가 설정된 상태

### 테스트 절차

1. **Slack → Teams**: Slack 채널에 메시지 전송 → Teams 채널에 도착 확인
2. **Teams → Slack**: Teams 채널에 메시지 전송 → Slack 채널에 도착 확인
3. **파일 전송**: Slack에서 이미지 업로드 → Teams에서 수신 확인
4. **메시지 저장**: Messages 페이지에서 전송된 메시지 확인

### 로그 확인

```bash
# 메시지 라우팅 로그
docker logs vms-chatops-backend --tail=200 | grep -i "route\|message\|bridge"

# Slack 연결 상태
docker logs vms-chatops-backend --tail=50 | grep -i slack

# Teams 연결 상태
docker logs vms-chatops-backend --tail=50 | grep -i teams
```

---

## 린트 검증

코드 제출 전 반드시 린트를 통과시킵니다.

### Backend

```bash
cd backend && python -m ruff check --fix . && python -m ruff format .
```

### Frontend

```bash
cd frontend && npm run lint:fix && npm run format
```

---

## 테스트 체크리스트

### 기능 테스트

- [ ] 로그인/회원가입 동작
- [ ] Dashboard 로드 및 상태 표시
- [ ] Provider 계정 등록/수정/삭제
- [ ] Provider 연결 테스트 버튼 동작
- [ ] Route 추가/수정/삭제
- [ ] 채널 드롭다운 목록 로드
- [ ] Messages 페이지 메시지 목록 및 검색
- [ ] Audit Logs 페이지 조회 및 필터링
- [ ] WebSocket 실시간 업데이트

### 인프라 테스트

- [ ] Docker Compose 전체 스택 실행
- [ ] 모든 컨테이너 정상 상태 (`docker compose ps`)
- [ ] Backend API 헬스체크 응답
- [ ] PostgreSQL 연결 정상
- [ ] Redis 연결 정상
- [ ] Frontend 페이지 로드 정상

### 보안 테스트

- [ ] 인증 없이 보호된 API 접근 시 401 응답
- [ ] 일반 사용자가 관리자 API 접근 시 403 응답
- [ ] JWT 토큰 만료 후 갱신 동작

---

## 관련 문서

- [개발 가이드](development) — 개발 환경 설정
- [아키텍처](architecture) — 시스템 구조
- [API 문서](../api/api) — REST API 레퍼런스
- [트러블슈팅](../admin-guide/troubleshooting) — 문제 해결

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0
