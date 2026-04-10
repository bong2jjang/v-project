# v-project — v-platform + v-channel-bridge

**v-platform**(재사용 가능한 플랫폼 프레임워크) + **v-channel-bridge**(Slack ↔ Teams 메시지 브리지 앱) 구조의 시스템입니다.

## 아키텍처

| 레이어 | 이름 | 역할 |
|--------|------|------|
| **플랫폼** | v-platform | 인증, SSO, RBAC, 사용자 관리, 조직도, 감사로그, UI Kit |
| **앱** | v-channel-bridge | Slack/Teams 메시지 브리지, 채널 라우팅, 프로바이더 어댑터 |

## 주요 기능

### 메시지 브리지 (v-channel-bridge)
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

### 인증 및 보안 (v-platform)
- **JWT 인증**: 토큰 기반 인증 시스템
- **역할 기반 접근 제어**: RBAC + 메뉴 기반 권한
- **감사 로그**: 주요 작업 자동 기록
- **SSO**: Microsoft OAuth 등 SSO 지원

---

## 시스템 요구사항

- Docker 20.10 이상
- Docker Compose 2.0 이상
- Slack 워크스페이스 관리자 권한
- Microsoft Azure 계정 (Teams Bot 등록용)

---

## 프로젝트 구조

```
v-project/
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
├── docker-compose.yml          # 기본 환경
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

# 브리지 타입
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
docker compose up -d --build

# 로그 확인
docker compose logs -f backend
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
docker compose ps

# Backend 헬스체크
curl http://localhost:8000/api/health

# Provider 연결 상태
curl http://localhost:8000/api/bridge/status
```

### Redis 라우팅 룰 확인

```bash
docker exec v-project-redis redis-cli -a redispassword KEYS "route:*"
```

### DB 백업

```bash
docker exec v-project-postgres pg_dump -U vmsuser v_project > backup-$(date +%Y%m%d).sql
```

---

## 보안 고려사항

- `.env` 파일은 절대 Git에 커밋하지 마세요
- `SECRET_KEY`는 최소 32자 이상의 랜덤 값 사용
- 프로덕션에서는 HTTPS 사용
- Azure Client Secret은 주기적으로 갱신

---

## 참고 자료

- [Slack API 문서](https://api.slack.com/)
- [Microsoft Teams 개발 문서](https://learn.microsoft.com/en-us/microsoftteams/platform/)
- [Azure Bot Service 문서](https://learn.microsoft.com/en-us/azure/bot-service/)
- [프로젝트 설계 문서](docusaurus/docs/)
