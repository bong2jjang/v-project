# VMS Chat Ops - Slack & Teams 메시지 브리지

**Light-Zowe 아키텍처** 기반으로 Slack과 Microsoft Teams 간 실시간 메시지를 양방향으로 브리징하는 서비스입니다.

## 주요 기능

### 메시지 브리지
- **양방향/단방향 라우팅**: Route 1개로 양방향 또는 단방향 설정
- **파일 첨부 지원**: 이미지 및 파일 포함 메시지 전달
- **발신자 정보 표시**: 각 플랫폼에서 원본 발신자 이름 표시
- **메시지 모드 선택**: 발신자 정보 모드 / 편집 가능 모드

### 플랫폼 지원
- **Slack**: Socket Mode (폴링 없음, 실시간)
- **Teams**: MS Graph API + Bot Framework Webhook

### 웹 관리 UI
- **Route 관리**: 채널 간 라우팅 룰 추가/수정/삭제
- **실시간 모니터링**: 메시지 통계 및 시스템 상태
- **계정 관리**: 플랫폼 인증 정보 관리
- **다크모드**: CSS 변수 기반 테마 지원

### 인증 및 보안
- **JWT 인증**: 토큰 기반 인증 시스템
- **역할 기반 접근 제어**: 관리자(admin) / 일반 사용자(user)
- **감사 로그**: 주요 작업 자동 기록

---

## 시스템 요구사항

- Docker 20.10 이상
- Docker Compose 2.0 이상
- Slack 워크스페이스 관리자 권한
- Microsoft Azure 계정 (Teams Bot 등록용)

---

## 프로젝트 구조

```
vms-chat-ops/
├── backend/                    # Python + FastAPI
│   ├── app/
│   │   ├── adapters/          # Provider Pattern (Slack, Teams)
│   │   ├── api/               # REST API 엔드포인트
│   │   ├── schemas/           # CommonMessage 스키마
│   │   ├── services/          # Route Manager, WebSocket Bridge
│   │   └── main.py
│   └── tests/                 # 단위 테스트
├── frontend/                   # React + TypeScript
│   └── src/
│       ├── components/        # UI 컴포넌트
│       ├── pages/             # 8개 페이지
│       └── store/             # Zustand 상태 관리
├── docusaurus/                 # 문서 사이트
├── docker-compose.dev.yml      # 개발 환경
├── docker-compose.prod.yml     # 프로덕션
├── docker-compose.debug.yml    # 디버깅
└── .env.example                # 환경 변수 템플릿
```

---

## 빠른 시작

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 다음 정보를 입력합니다:

```bash
# Slack 설정 (Socket Mode 필수)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token

# Teams 설정 (Azure Bot 등록 필요)
TEAMS_TENANT_ID=your-azure-tenant-id
TEAMS_APP_ID=your-azure-app-id
TEAMS_APP_PASSWORD=your-azure-client-secret

# 보안
SECRET_KEY=your-strong-random-secret-key-32chars-min

# 브리지 타입 (Light-Zowe 자체 구현 사용)
BRIDGE_TYPE=native
```

### 2. Slack App 설정

1. [Slack API](https://api.slack.com/apps) → 새 App 생성
2. **Socket Mode** 활성화 (App-Level Token 생성 → `SLACK_APP_TOKEN`)
3. Bot Token Scopes 추가: `channels:history`, `chat:write`, `files:read`, `files:write`, `users:read`
4. Bot User OAuth Token 복사 → `SLACK_BOT_TOKEN`
5. 사용할 채널에 Bot 초대

### 3. Teams Bot 설정

1. [Azure Portal](https://portal.azure.com) → App registrations → 새 앱 등록
2. Client secret 생성 → `TEAMS_APP_PASSWORD`
3. Azure Bot Services → 새 Bot 등록
4. Messaging endpoint: `https://{your-domain}/api/teams/webhook`
5. Microsoft Teams 채널 활성화

> **개발 환경에서 Teams 테스트**: ngrok 등으로 로컬 8000 포트를 외부에 노출하세요.

### 4. 서비스 실행

```bash
# 개발 환경 (hot-reload)
docker compose -f docker-compose.dev.yml up -d --build

# 로그 확인
docker compose -f docker-compose.dev.yml logs -f backend
```

### 5. 웹 UI 접속

| URL | 설명 |
|-----|------|
| http://localhost:5173 | 관리 대시보드 |
| http://localhost:8000/docs | Backend API 문서 (Swagger) |
| http://localhost:8025 | MailHog (개발용 메일) |

---

## Route 설정

서비스 실행 후 웹 UI에서 Route를 추가합니다:

1. 좌측 메뉴 → **Channels** → **Route 추가**
2. 채널 1 (소스), 채널 2 (타겟) 선택
3. **라우팅 방향**: 양방향 / 단방향 선택
4. **메시지 모드**: 발신자 정보 / 편집 가능 선택
5. 저장

Teams 채널 ID 형식: `{teamId}:{channelId}` (예: `TEAM123:19:abc@thread.tacv2`)

---

## 운영 가이드

### 서비스 상태 확인

```bash
# 컨테이너 상태
docker compose -f docker-compose.dev.yml ps

# Backend 헬스체크
curl http://localhost:8000/api/health

# Provider 연결 상태
curl http://localhost:8000/api/bridge/status
```

### 로그 확인

```bash
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend
```

### Redis 라우팅 룰 확인

```bash
docker exec vms-chatops-redis redis-cli -a redispassword KEYS "route:*"
```

### DB 백업

```bash
docker exec vms-chatops-postgres pg_dump -U vmsuser vms_chat_ops > backup-$(date +%Y%m%d).sql
```

---

## 보안 고려사항

- `.env` 파일은 절대 Git에 커밋하지 마세요
- `SECRET_KEY`는 최소 32자 이상의 랜덤 값 사용
- 프로덕션에서는 HTTPS 사용
- Azure Client Secret은 주기적으로 갱신

---

## 문제 해결

### 메시지가 전달되지 않음

```bash
# 1. Provider 상태 확인
curl http://localhost:8000/api/bridge/status

# 2. Route 설정 확인 (Redis)
docker exec vms-chatops-redis redis-cli -a redispassword KEYS "route:*"

# 3. 백엔드 로그 확인
docker compose -f docker-compose.dev.yml logs -f backend | grep -i "error\|failed"
```

### Slack Bot이 응답하지 않음

- Slack App에서 **Socket Mode**가 활성화되어 있는지 확인
- `SLACK_APP_TOKEN`이 App-Level Token (`xapp-` 시작)인지 확인
- Bot이 해당 채널에 초대되어 있는지 확인

### Teams Webhook 오류

- Azure Bot의 Messaging Endpoint URL이 정확한지 확인
- `TEAMS_APP_ID` / `TEAMS_APP_PASSWORD`가 올바른지 확인
- Azure App의 API 권한 (`ChannelMessage.Send` 등) 부여 여부 확인

---

## 버전 히스토리

### v2.0.0 (2026-04-05)
- Light-Zowe 아키텍처 완성 (자체 Provider 기반 브리지)
- Slack Provider: Socket Mode, 양방향 라우팅, 발신자 이름 수정
- Teams Provider: MS Graph API, Bot Framework Webhook, 파일 업로드
- Route Manager: 양방향/단방향 라우팅, Redis 기반 동적 관리
- Frontend: Route 관리 UI (양방향 배지, 메시지 모드 배지)

### v1.1.0 (2026-03-22)
- JWT 인증 시스템
- 사용자 관리 및 역할 기반 접근 제어
- 감사 로그 시스템

### v1.0.0 (2026-03-20)
- 초기 릴리스 (Matterbridge 기반)

---

## 참고 자료

- [Slack API 문서](https://api.slack.com/)
- [Microsoft Teams 개발 문서](https://learn.microsoft.com/en-us/microsoftteams/platform/)
- [Azure Bot Service 문서](https://learn.microsoft.com/en-us/azure/bot-service/)
- [프로젝트 설계 문서](docusaurus/docs/)
