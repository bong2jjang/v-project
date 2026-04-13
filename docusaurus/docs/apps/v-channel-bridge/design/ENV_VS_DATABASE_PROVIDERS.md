---
sidebar_position: 11
title: ".env vs Database: Provider 설정 전략"
description: 환경 변수와 데이터베이스 간 Provider 설정 우선순위 및 통합 전략
---

# .env vs Database: Provider 설정 전략

## 📋 개요

**현재 문제**: `.env` 파일과 Database (Account 테이블) 두 곳에서 Provider 설정을 관리할 수 있어 충돌 가능성 존재

**해결 방안**: DB 우선 전략 + .env 폴백 구조

**작성일**: 2026-04-02
**관련 문서**: `PHASE1_PROVIDER_UI_PLAN.md`

---

## 🔍 현재 구조 분석

### 1. .env 파일 구조

**파일**: `.env`

```bash
# Slack Provider
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Teams Provider
TEAMS_TENANT_ID=your-tenant-id
TEAMS_APP_ID=your-app-id
TEAMS_APP_PASSWORD=your-app-password
TEAMS_TEAM_ID=your-team-id

# Bridge Type
BRIDGE_TYPE=native
```

**용도**:
- Docker 컨테이너 환경 변수로 주입
- 초기 설정 시 간편하게 설정 가능
- 개발/배포 시 필수

### 2. Database 구조

**테이블**: `accounts`

```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    platform VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    is_valid BOOLEAN DEFAULT TRUE,

    -- Slack
    token TEXT,              -- SLACK_BOT_TOKEN에 해당
    app_token TEXT,          -- SLACK_APP_TOKEN에 해당

    -- Teams
    tenant_id VARCHAR(100),  -- TEAMS_TENANT_ID에 해당
    app_id VARCHAR(100),     -- TEAMS_APP_ID에 해당
    app_password TEXT,       -- TEAMS_APP_PASSWORD에 해당

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**용도**:
- UI에서 동적으로 Provider 추가/수정/삭제
- 여러 개의 Provider 관리 가능 (예: slack-main, slack-test)
- 런타임 중 변경 가능 (재시작 불필요)

### 3. 현재 Startup 로직 (`main.py`)

**파일**: `backend/app/main.py` (76-106번 줄)

```python
async def init_bridge() -> WebSocketBridge:
    """Light-Zowe 브리지 초기화"""

    # ... (생략)

    # ❌ 문제: .env만 읽음, DB 무시
    slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
    slack_app_token = os.getenv("SLACK_APP_TOKEN")

    if slack_bot_token and slack_app_token:
        slack_provider = SlackProvider(
            bot_token=slack_bot_token,
            app_token=slack_app_token
        )
        await bridge.add_provider(slack_provider)
        logger.info("Slack Provider registered")

    # Teams도 동일한 방식
    teams_app_id = os.getenv("TEAMS_APP_ID")
    # ...
```

**현재 문제점**:
- ❌ DB의 Account 테이블을 전혀 확인하지 않음
- ❌ UI에서 Provider를 추가해도 재시작 전까지 반영 안 됨
- ❌ .env와 DB가 불일치하면 혼란

---

## 🎯 개선 전략: DB 우선 + .env 폴백

### 우선순위

```
1순위: Database (Account 테이블)
  ↓ (없으면)
2순위: .env 환경 변수
  ↓ (없으면)
3순위: Provider 등록 안 함 (warning 로그)
```

### 설계 원칙

1. **DB가 Source of Truth**
   - UI에서 추가한 Provider는 DB에 저장
   - Startup 시 DB를 먼저 확인

2. **.env는 초기 설정 또는 폴백**
   - DB가 비어있으면 .env 사용
   - 개발 환경에서 빠른 설정용

3. **자동 마이그레이션**
   - .env에 값이 있고 DB가 비어있으면 자동으로 DB에 추가

---

## 🔧 개선된 Startup 로직

### 1. 새로운 init_bridge() 함수

**파일**: `backend/app/main.py` (수정)

```python
from sqlalchemy.orm import Session
from app.db import get_db_session
from app.models import Account

async def init_bridge() -> WebSocketBridge:
    """
    Light-Zowe 브리지 초기화 (DB 우선 전략)

    1. DB에서 Account 조회
    2. 없으면 .env에서 조회 → DB에 자동 추가
    3. Provider 등록
    """
    try:
        # Redis 연결
        redis_url = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")
        redis_client = await aioredis.from_url(redis_url, decode_responses=True)

        # Route Manager 생성
        route_manager = RouteManager(redis_client)

        # WebSocket Bridge 생성
        bridge = WebSocketBridge(route_manager)

        # Provider 등록 (DB 우선 전략)
        bridge_type = os.getenv("BRIDGE_TYPE", "native")

        if bridge_type == "native":
            logger.info("Initializing Light-Zowe providers")

            # DB 세션 생성
            db: Session = next(get_db_session())

            try:
                # 1. DB에서 활성화된 Account 조회
                accounts = db.query(Account).filter(
                    Account.enabled == True,
                    Account.is_valid == True
                ).all()

                if not accounts:
                    logger.info("No accounts in DB, checking .env for migration")
                    # 2. DB가 비어있으면 .env → DB 자동 마이그레이션
                    accounts = await migrate_env_to_db(db)

                # 3. DB의 Account로 Provider 등록
                for account in accounts:
                    if account.platform == "slack":
                        if account.token and account.app_token:
                            slack_provider = SlackProvider(
                                bot_token=account.token,
                                app_token=account.app_token
                            )
                            await bridge.add_provider(slack_provider)
                            logger.info(f"Slack Provider registered: {account.name}")
                        else:
                            logger.warning(f"Slack account {account.name} missing tokens")

                    elif account.platform == "msteams":
                        if account.tenant_id and account.app_id and account.app_password:
                            teams_provider = TeamsProvider(
                                app_id=account.app_id,
                                app_password=account.app_password,
                                tenant_id=account.tenant_id,
                                team_id=account.team_id
                            )
                            await bridge.add_provider(teams_provider)
                            logger.info(f"Teams Provider registered: {account.name}")
                        else:
                            logger.warning(f"Teams account {account.name} missing credentials")

            finally:
                db.close()

        # 브리지 싱글톤 설정
        set_bridge(bridge)

        logger.info("Light-Zowe bridge initialized successfully")

        return bridge

    except Exception as e:
        logger.error("Failed to initialize Light-Zowe bridge", error=str(e))
        raise


async def migrate_env_to_db(db: Session) -> list[Account]:
    """
    .env 환경 변수를 DB로 자동 마이그레이션

    Args:
        db: SQLAlchemy 세션

    Returns:
        생성된 Account 리스트
    """
    accounts = []

    # Slack 마이그레이션
    slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
    slack_app_token = os.getenv("SLACK_APP_TOKEN")

    if slack_bot_token and slack_app_token:
        logger.info("Migrating Slack credentials from .env to DB")

        slack_account = Account(
            name="slack-default",
            platform="slack",
            enabled=True,
            token=slack_bot_token,
            app_token=slack_app_token,
            is_valid=True
        )
        db.add(slack_account)
        accounts.append(slack_account)

        logger.info("Slack account migrated to DB: slack-default")

    # Teams 마이그레이션
    teams_app_id = os.getenv("TEAMS_APP_ID")
    teams_app_password = os.getenv("TEAMS_APP_PASSWORD")
    teams_tenant_id = os.getenv("TEAMS_TENANT_ID")
    teams_team_id = os.getenv("TEAMS_TEAM_ID")

    if teams_app_id and teams_app_password and teams_tenant_id:
        logger.info("Migrating Teams credentials from .env to DB")

        teams_account = Account(
            name="teams-default",
            platform="msteams",
            enabled=True,
            tenant_id=teams_tenant_id,
            app_id=teams_app_id,
            app_password=teams_app_password,
            team_id=teams_team_id,
            is_valid=True
        )
        db.add(teams_account)
        accounts.append(teams_account)

        logger.info("Teams account migrated to DB: teams-default")

    # DB 커밋
    if accounts:
        db.commit()
        logger.info(f"Migrated {len(accounts)} accounts from .env to DB")

    return accounts
```

---

## 📊 시나리오별 동작

### Scenario 1: 초기 설치 (DB 비어있음)

**상황**:
- `.env`에 SLACK_BOT_TOKEN, SLACK_APP_TOKEN 설정됨
- DB에 Account 없음

**동작**:
1. `init_bridge()` 실행
2. DB 조회 → 결과 없음
3. `.env` 확인 → 값 존재
4. DB에 `slack-default` Account 자동 생성
5. `SlackProvider` 등록
6. 로그: "Migrated 1 accounts from .env to DB"

**결과**:
- ✅ Slack Provider 작동
- ✅ DB에 Account 저장됨
- ✅ 다음 재시작 시 DB에서 로드

---

### Scenario 2: UI에서 Provider 추가

**상황**:
- 사용자가 Settings > Providers에서 "slack-main" 추가
- Token: `xoxb-new-token`

**동작**:
1. Frontend → POST `/api/accounts-db`
2. DB에 `slack-main` Account 저장
3. ✅ 즉시 반영 (재시작 불필요)
4. 또는 수동으로 브리지 재시작

**결과**:
- ✅ 새 Provider 즉시 사용 가능
- ✅ 재시작 후에도 유지

---

### Scenario 3: .env와 DB 모두 설정됨

**상황**:
- `.env`: SLACK_BOT_TOKEN=`xoxb-env-token`
- DB: `slack-main` (token=`xoxb-db-token`)

**동작**:
1. `init_bridge()` 실행
2. DB 조회 → `slack-main` 발견
3. ✅ DB 우선: `xoxb-db-token` 사용
4. `.env`는 무시

**결과**:
- ✅ DB가 우선순위
- ℹ️ `.env`는 폴백으로만 사용

---

### Scenario 4: DB에서 Provider 삭제

**상황**:
- DB에 `slack-main` 있었음
- 사용자가 UI에서 삭제

**동작**:
1. Frontend → DELETE `/api/accounts-db/{id}`
2. DB에서 Account 삭제
3. 브리지 재시작 시 해당 Provider 미등록

**결과**:
- ✅ Provider 제거됨
- ℹ️ `.env`에 값이 있어도 DB 우선이므로 무시

---

## 🔄 마이그레이션 가이드

### 기존 사용자 (Phase 1 배포 전)

**현재 상태**: `.env`에만 설정

**업그레이드 후**:
1. 서버 시작
2. 자동으로 `.env` → DB 마이그레이션
3. DB에 `slack-default`, `teams-default` 생성
4. 정상 작동

**사용자 액션**:
- 필요 없음 (자동 마이그레이션)
- 원한다면 UI에서 이름 변경 가능

### 새 사용자 (Phase 1 배포 후)

**권장 방법**:
1. Settings > Providers 탭
2. [+ Add Provider] 클릭
3. UI에서 Token 입력
4. 저장

**.env 사용 (선택사항)**:
- 개발 환경에서 빠른 설정용
- 첫 시작 시 자동으로 DB에 추가됨

---

## ⚙️ 설정 우선순위 요약

| 상황 | 사용되는 설정 | 비고 |
|------|--------------|------|
| DB에 Account 있음 | ✅ DB | .env 무시 |
| DB 비어있음, .env 설정됨 | ✅ .env → DB 자동 추가 | 마이그레이션 |
| DB 비어있음, .env도 비어있음 | ❌ Provider 미등록 | Warning 로그 |
| DB에 여러 Account 있음 | ✅ 모두 등록 | 여러 Provider 지원 |
| DB Account disabled | ❌ 해당 Provider 제외 | enabled=false |
| DB Account invalid | ❌ 해당 Provider 제외 | is_valid=false |

---

## 🎯 Best Practices

### 1. 개발 환경

```bash
# .env 파일 사용 (빠른 설정)
SLACK_BOT_TOKEN=xoxb-dev-token
SLACK_APP_TOKEN=xapp-dev-token
```

**장점**:
- 빠르게 설정 가능
- Docker 재시작으로 변경 적용

**단점**:
- 여러 Provider 관리 어려움

---

### 2. 프로덕션 환경

```
UI에서만 Provider 관리 (DB)
```

**장점**:
- 여러 Provider 지원
- 재시작 불필요
- 런타임 중 변경 가능

**권장 절차**:
1. 초기 설치: `.env`로 시작
2. UI에서 Provider 추가
3. `.env`의 Token 제거 (선택)

---

### 3. 보안 고려사항

**민감 정보 관리**:
- ✅ DB에 저장 시 암호화 권장 (TODO: Phase 2)
- ✅ `.env` 파일은 `.gitignore`에 포함
- ✅ Token 마스킹 처리 (UI 표시 시)

**현재 구현**:
- Token은 평문 저장 (DB)
- 마스킹은 API 응답 시 처리 (`AccountResponse.from_orm_with_masking`)

---

## 📝 구현 체크리스트

### Backend 수정

- [ ] `main.py`의 `init_bridge()` 함수 수정 (DB 우선 로직)
- [ ] `migrate_env_to_db()` 함수 추가
- [ ] Account 모델에 `team_id` 필드 추가 (Teams용, 선택사항)
- [ ] Startup 로그 개선 (어디서 로드했는지 명시)

### 테스트

- [ ] DB 비어있을 때 .env 마이그레이션 확인
- [ ] DB에 Account 있을 때 .env 무시 확인
- [ ] 여러 Account 동시 등록 확인
- [ ] disabled/invalid Account 제외 확인

### 문서

- [x] 이 문서 작성
- [ ] README.md 업데이트 (설정 방법)
- [ ] 사용자 가이드 업데이트

---

## 🔗 관련 파일

- `backend/app/main.py` - Startup 로직
- `backend/app/models/account.py` - Account 모델
- `backend/app/api/accounts_crud.py` - Account CRUD API
- `.env` - 환경 변수
- `PHASE1_PROVIDER_UI_PLAN.md` - Provider UI 계획

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-04-02
**작성자**: VMS Channel Bridge Team
**상태**: 🚧 구현 진행 중
