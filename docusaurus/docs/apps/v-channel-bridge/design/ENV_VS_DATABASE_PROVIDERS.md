---
title: Provider 설정 전략 -- 환경 변수 vs 데이터베이스
sidebar_position: 9
---

# Provider 설정 전략 -- 환경 변수 vs 데이터베이스

v-channel-bridge에서 Slack/Teams Provider의 인증 정보를 어디에 저장하고, 어떻게 로드하는지를 설명합니다. `.env` 환경 변수와 데이터베이스(Account 테이블)의 역할, 현재 적용된 하이브리드 전략, 시나리오별 동작, 보안 처리 방식을 다룹니다.

---

## 두 가지 저장소의 역할

### 환경 변수 (.env)

프로젝트 루트의 `.env` 파일에 Provider 인증 정보를 설정합니다.

```bash
# Slack Provider
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Teams Provider
TEAMS_TENANT_ID=your-tenant-id
TEAMS_APP_ID=your-app-id
TEAMS_APP_PASSWORD=your-app-password

# 브리지 타입
BRIDGE_TYPE=native
```

**특징**: Docker 컨테이너 환경 변수로 주입됩니다. 파일을 수정하면 서비스 재시작이 필요합니다. 각 플랫폼당 하나의 계정만 설정할 수 있습니다.

### 데이터베이스 (Account 테이블)

`accounts` 테이블(`apps/v-channel-bridge/backend/app/models/account.py`)에 Provider 인증 정보를 저장합니다.

**특징**: 관리자 UI의 Integrations 페이지에서 동적으로 추가/수정/삭제할 수 있습니다. 서비스 재시작 없이 런타임 중 변경이 반영됩니다. 플랫폼당 여러 계정을 등록할 수 있습니다 (예: `slack-main`, `slack-test`).

### 비교

| 항목 | 환경 변수 (.env) | 데이터베이스 (Account) |
|------|-----------------|---------------------|
| 설정 방법 | 파일 직접 편집 | 관리자 UI 또는 API |
| 반영 시점 | 서비스 재시작 필요 | 즉시 반영 (재시작 불필요) |
| 계정 수 | 플랫폼당 1개 | 플랫폼당 여러 개 |
| 보안 | 평문 저장, `.gitignore`로 관리 | 암호화 저장 |
| 적합한 환경 | 초기 설정, 개발 환경 | 운영 환경, 다중 계정 |

---

## 현재 전략: DB 우선 + .env 폴백

v-channel-bridge는 서비스 시작 시 다음 우선순위로 Provider를 초기화합니다.

```
1순위: 데이터베이스 (Account 테이블)
   |
   v (Account가 없으면)
2순위: .env 환경 변수 -> 자동으로 DB에 마이그레이션
   |
   v (환경 변수도 없으면)
3순위: Provider 미등록 (경고 로그 출력)
```

이 로직은 `apps/v-channel-bridge/backend/app/main.py`의 `init_bridge()` 함수에 구현되어 있습니다.

### 초기화 흐름

1. `init_bridge()`가 데이터베이스에서 `enabled=True`이고 `is_valid=True`인 Account를 조회합니다.
2. Account가 존재하면 해당 정보로 Provider를 생성하고 등록합니다.
3. Account가 하나도 없으면 `migrate_env_to_db()`를 호출합니다.
4. `migrate_env_to_db()`는 `.env`에 설정된 토큰을 읽어 `slack-default`, `teams-default` 이름으로 Account 레코드를 생성합니다.
5. 마이그레이션 후 새로 생성된 Account로 Provider를 등록합니다.

이 전략의 핵심 원칙은 다음과 같습니다.

- **데이터베이스가 진실의 원천(Source of Truth)입니다.** DB에 Account가 있으면 `.env`는 무시합니다.
- **.env는 초기 설정 또는 폴백용입니다.** DB가 비어있을 때만 `.env`를 참조하며, 참조 즉시 DB로 마이그레이션합니다.
- **자동 마이그레이션으로 기존 설정을 보존합니다.** `.env`만 사용하던 환경에서 업그레이드해도 별도 작업 없이 정상 작동합니다.

---

## 시나리오별 동작

### 시나리오 1: 초기 설치 (DB 비어있음, .env 설정됨)

**상황**: `.env`에 `SLACK_BOT_TOKEN`과 `SLACK_APP_TOKEN`이 설정되어 있고, 데이터베이스에는 Account가 없습니다.

**동작 순서**:

1. `init_bridge()` 실행
2. DB 조회 -- 결과 없음
3. `migrate_env_to_db()` 호출
4. `.env`의 Slack 토큰으로 `slack-default` Account 생성
5. `.env`의 Teams 자격증명으로 `teams-default` Account 생성
6. DB에 저장 (암호화 적용)
7. 생성된 Account로 Provider 등록

**결과**: Provider가 정상 작동하며, 다음 재시작부터는 DB에서 직접 로드합니다. `.env`를 다시 참조하지 않습니다.

### 시나리오 2: 관리자 UI에서 Provider 추가

**상황**: 관리자가 Integrations 페이지에서 새 Slack 계정 `slack-production`을 추가합니다.

**동작 순서**:

1. 프론트엔드에서 `POST /api/accounts` API 호출
2. DB에 `slack-production` Account 저장 (인증 정보 암호화)
3. `provider_sync.py`의 `sync_provider_for_platform()`이 호출됨
4. 기존 Slack Provider 제거 -> 새 Account 기반으로 Provider 재생성
5. 서비스 재시작 없이 즉시 반영

**결과**: 새 Provider가 즉시 활성화됩니다. `provider_sync.py`(`apps/v-channel-bridge/backend/app/services/provider_sync.py`)가 Account 변경 시 Provider를 자동 동기화합니다.

### 시나리오 3: .env와 DB 모두 설정됨

**상황**: `.env`에 `SLACK_BOT_TOKEN=xoxb-env-token`이 있고, DB에 `slack-main` Account (token=`xoxb-db-token`)가 있습니다.

**동작**: DB에 Account가 존재하므로 DB 값(`xoxb-db-token`)을 사용합니다. `.env`의 `xoxb-env-token`은 무시됩니다.

### 시나리오 4: DB에서 Provider 비활성화

**상황**: 관리자가 UI에서 `slack-default` Account의 `enabled`를 `false`로 변경합니다.

**동작**: 다음 서비스 시작 시 해당 Account는 `enabled == True` 조건에 해당하지 않으므로 Provider가 등록되지 않습니다. `provider_sync.py`를 통해 런타임 중에도 즉시 제거됩니다.

### 시나리오 5: 모든 설정이 없는 경우

**상황**: DB에 Account가 없고, `.env`에도 토큰이 설정되어 있지 않습니다.

**동작**: 경고 로그를 출력하고, Provider 없이 서비스가 시작됩니다. 메시지 브리지 기능은 작동하지 않지만, 관리자 UI에서 Account를 추가하면 즉시 활성화됩니다.

---

## Account 모델 구조

`Account` 모델(`apps/v-channel-bridge/backend/app/models/account.py`)의 주요 필드입니다.

### 공통 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `Integer` | 기본키 |
| `name` | `String(100)` | 계정 이름 (고유, 예: `slack-default`) |
| `platform` | `String(50)` | 플랫폼 (`slack` 또는 `msteams`) |
| `enabled` | `Boolean` | 활성화 여부 (기본값: `True`) |
| `is_valid` | `Boolean` | 유효성 (기본값: `True`) |
| `created_by` | `String` | 생성자 |
| `updated_by` | `String` | 수정자 |

### Slack 전용 필드

| 필드 | 설명 | 대응 환경 변수 |
|------|------|--------------|
| `token` | Bot Token (`xoxb-` 접두사) | `SLACK_BOT_TOKEN` |
| `app_token` | App-Level Token (`xapp-` 접두사) | `SLACK_APP_TOKEN` |

### Teams 전용 필드

| 필드 | 설명 | 대응 환경 변수 |
|------|------|--------------|
| `tenant_id` | Azure Tenant ID | `TEAMS_TENANT_ID` |
| `app_id` | Azure Application ID | `TEAMS_APP_ID` |
| `app_password` | Azure Client Secret | `TEAMS_APP_PASSWORD` |
| `team_id` | Teams 팀 ID | `TEAMS_TEAM_ID` |
| `webhook_url` | Bot Framework Webhook URL | -- |
| `ms_refresh_token` | Microsoft OAuth Refresh Token | -- |

### 데이터 무결성

Account 모델에는 `CheckConstraint`가 설정되어 있습니다.

- Slack 계정은 `token` 필드가 필수입니다.
- Teams 계정은 `tenant_id`와 `app_id` 필드가 필수입니다.

필수 필드가 누락된 상태로 Account를 생성하면 데이터베이스 레벨에서 오류가 발생합니다.

---

## 인증 정보 암호화

DB에 저장되는 모든 민감 필드는 암호화됩니다. `apps/v-channel-bridge/backend/app/utils/encryption.py`의 `encrypt()`와 `decrypt()` 함수를 사용합니다.

### 암호화 대상 필드

- `token` (Slack Bot Token)
- `app_token` (Slack App-Level Token)
- `tenant_id` (Azure Tenant ID)
- `app_id` (Azure Application ID)
- `app_password` (Azure Client Secret)
- `team_id` (Teams Team ID)
- `webhook_url` (Webhook URL)
- `ms_refresh_token` (Microsoft OAuth Refresh Token)

### 접근 방식

Account 모델은 각 암호화 필드에 대해 `_decrypted` 프로퍼티 쌍을 제공합니다. 예를 들어, `token` 컬럼에는 암호화된 값이 저장되고, `token_decrypted` 프로퍼티로 복호화된 값을 읽을 수 있습니다.

```python
# DB에는 암호화된 값이 저장됨
account.token  # -> "gAAAAABf..."  (암호화된 문자열)

# 복호화된 값 접근
account.token_decrypted  # -> "xoxb-actual-token"
```

`is_encrypted()` 메서드는 값이 이미 암호화되었는지 확인합니다. 이전 버전에서 평문으로 저장된 기존 데이터와의 호환성을 위해, 평문과 암호문을 구분하여 처리합니다.

### API 응답 시 마스킹

관리자 UI에 Account 정보를 표시할 때, 토큰 값은 마스킹 처리됩니다 (예: `xoxb-****...****1234`). 전체 토큰 값은 API 응답에 포함되지 않습니다.

---

## Provider 자동 동기화

Account가 변경되면 서비스를 재시작하지 않아도 Provider가 자동으로 동기화됩니다. `provider_sync.py`(`apps/v-channel-bridge/backend/app/services/provider_sync.py`)가 이 기능을 담당합니다.

### 동기화 흐름

`sync_provider_for_platform()` 함수는 다음 단계를 수행합니다.

1. 해당 플랫폼의 기존 Provider를 브리지에서 제거합니다.
2. DB에서 해당 플랫폼의 `enabled=True`, `is_valid=True`인 Account를 조회합니다.
3. Account가 존재하면 `build_provider_from_account()`로 새 Provider를 생성합니다.
4. 새 Provider를 브리지에 등록합니다.

### 동기화 결과

| 반환값 | 의미 |
|-------|------|
| `"added"` | 기존 Provider 없이 새로 추가됨 |
| `"removed"` | 기존 Provider가 제거됨 (새 Account 없음) |
| `"replaced"` | 기존 Provider를 새 Provider로 교체함 |
| `"noop"` | 변경 사항 없음 |

### 동기화 트리거

Account CRUD API에서 다음 작업 시 자동으로 동기화가 트리거됩니다.

- Account 생성 (POST)
- Account 수정 (PUT)
- Account 삭제 (DELETE)
- Account 활성화/비활성화 토글

---

## 환경별 권장 설정

### 개발 환경

`.env` 파일로 빠르게 설정하는 것을 권장합니다.

```bash
# .env 파일에 토큰 설정
SLACK_BOT_TOKEN=xoxb-dev-token
SLACK_APP_TOKEN=xapp-dev-token
TEAMS_TENANT_ID=dev-tenant-id
TEAMS_APP_ID=dev-app-id
TEAMS_APP_PASSWORD=dev-secret
```

서비스를 처음 시작하면 자동으로 DB에 마이그레이션됩니다. 이후에는 관리자 UI에서 수정할 수 있습니다.

### 운영 환경

관리자 UI(Integrations 페이지)에서 Account를 직접 관리하는 것을 권장합니다.

1. 초기 설치 시 `.env`로 시작합니다.
2. 자동 마이그레이션이 완료되면 관리자 UI에서 Account를 확인합니다.
3. 이후 Account 추가/수정/삭제는 모두 관리자 UI에서 수행합니다.
4. 필요하다면 `.env`에서 토큰 관련 변수를 제거합니다 (DB에 이미 저장되었으므로).

운영 환경에서 DB를 사용하면 다음 이점이 있습니다.

- 서비스 재시작 없이 계정 정보를 변경할 수 있습니다.
- 여러 Slack 워크스페이스나 Teams 테넌트를 동시에 관리할 수 있습니다.
- 인증 정보가 암호화되어 저장됩니다.
- 계정별 활성화/비활성화를 독립적으로 제어할 수 있습니다.

---

## 관련 문서

- [양방향 브리지 설계](./CHAT_SUPPORT.md)
- [고급 메시지 기능 설계](./ADVANCED_MESSAGE_FEATURES.md)
- [Slack 설정 가이드](../admin-guide/SLACK_SETUP.md)
- [Teams 설정 가이드](../admin-guide/TEAMS_SETUP.md)

---

**최종 업데이트**: 2026-04-13
