---
title: Light-Zowe 마이그레이션 Week 1-3 완료
date: 2026-03-31
authors: [vms-team]
tags: [migration, light-zowe, slack, teams, week1, week2, week3]
---

# Light-Zowe 아키텍처 마이그레이션 Week 1-3 완료 보고

## 📋 개요

Matterbridge 의존성 제거를 위한 **Light-Zowe 아키텍처 마이그레이션** 작업의 **Week 1-3**이 완료되었습니다.

- **작업 기간**: 2026-03-31
- **완료 주차**: Week 1, Week 2, Week 3
- **다음 단계**: Week 4 (배포 준비 및 문서화)

---

## ✅ Week 1: 기반 설계 및 Core 구축 (완료)

### Common Message Schema (VMS-Message-Schema)

Zowe Chat의 Common Schema 개념을 VMS Chat Ops에 적용한 통합 메시지 스키마를 구현했습니다.

**구현 파일**: `backend/app/schemas/common_message.py`

#### 주요 컴포넌트

1. **CommonMessage**: 통합 메시지 스키마
   - 메시지 메타데이터 (message_id, timestamp, type, platform)
   - 발신자/채널 정보 (user, channel)
   - 메시지 내용 (text, attachments, reactions)
   - 스레드/답글 (thread_id, parent_id)
   - 라우팅 정보 (target_channels)
   - 커맨드 정보 (command, command_args)

2. **User, Channel, Attachment**: 표준 스키마
3. **MessageType, Platform**: Enum 정의
4. **메서드**: `is_command()`, `parse_command()`

#### 테스트

```python
# tests/schemas/test_common_message.py
- 텍스트 메시지 생성 테스트
- 첨부파일 메시지 테스트
- 커맨드 감지 및 파싱 테스트
- 스레드 메시지 테스트
- Slack/Teams 변환 테스트 케이스 (가상)
```

### Provider Pattern 인터페이스

**구현 파일**: `backend/app/adapters/base.py`

Zowe Chat의 Provider Pattern을 구현한 추상 인터페이스입니다.

#### BasePlatformProvider 메서드

- `connect()`: 플랫폼 연결
- `disconnect()`: 연결 해제
- `send_message()`: Common Schema → 플랫폼 메시지 전송
- `receive_messages()`: 플랫폼 메시지 → Common Schema 수신
- `get_channels()`: 채널 목록 조회
- `get_users()`: 사용자 목록 조회
- `transform_to_common()`: 플랫폼 → Common Schema 변환
- `transform_from_common()`: Common Schema → 플랫폼 변환

### Core Engine 구현

#### 1. WebSocketBridge (비동기 메시지 라우팅 엔진)

**구현 파일**: `backend/app/services/websocket_bridge.py`

- Provider 통합 관리
- 메시지 라우팅 (route_manager 기반)
- Command Processor 연동
- 비동기 메시지 수신 태스크 관리

#### 2. RouteManager (Redis 기반 동적 라우팅)

**구현 파일**: `backend/app/services/route_manager.py`

- **재시작 불필요**: Redis 기반 동적 라우팅 룰 관리
- `add_route()`: 라우팅 룰 추가
- `remove_route()`: 라우팅 룰 제거
- `get_targets()`: 타겟 채널 조회
- `get_all_routes()`: 모든 라우팅 룰 조회
- `clear_routes()`: 라우팅 룰 삭제

#### 3. CommandProcessor (커맨드 해석 및 실행)

**구현 파일**: `backend/app/services/command_processor.py`

- `/vms <action>`: VMS 시스템 제어 (status, info, restart)
- `/bridge <action>`: 브리지 제어 (list, status)
- `/route <action>`: 라우팅 룰 관리 (list, add, remove)
- `/help`: 도움말
- `/status`: 간단한 상태 조회

### Week 1 커밋

```bash
git commit 486cb15
feat(migration): Week 1 - Light-Zowe 기반 구조 구축 완료
```

---

## ✅ Week 2: Slack Provider 구현 (완료)

### Slack Provider (Socket Mode)

**구현 파일**: `backend/app/adapters/slack_provider.py`

Slack의 **Socket Mode**를 사용하여 방화벽 인바운드 설정 없이 실시간 메시지 수신이 가능합니다.

#### 주요 기능

1. **Socket Mode 연결**
   - `slack_bolt.async_app.AsyncApp`
   - `slack_bolt.adapter.socket_mode.AsyncSocketModeHandler`
   - 비동기 메시지 큐 기반 처리

2. **메시지 변환**
   - Slack 이벤트 → Common Schema
   - Common Schema → Slack 메시지
   - 첨부파일 지원 (files)
   - 스레드 지원 (thread_ts)
   - 리액션 지원 (reactions)

3. **이벤트 핸들러**
   - `@app.event("message")`: 메시지 수신
   - `@app.event("file_shared")`: 파일 공유

4. **API 호출**
   - `conversations_list`: 채널 목록 조회
   - `users_list`: 사용자 목록 조회
   - `chat_postMessage`: 메시지 전송

#### Slack Block Kit 지원

```python
# 이미지 블록
{
    "type": "image",
    "image_url": att.url,
    "alt_text": att.name
}

# 파일 정보 블록
{
    "type": "section",
    "text": {
        "type": "mrkdwn",
        "text": f"📎 *{att.name}*\n<{att.url}|다운로드>"
    }
}
```

### 의존성 추가

**파일**: `backend/requirements.txt`

```
slack-bolt==1.18.1  # Slack Socket Mode
slack-sdk==3.27.1   # Slack Web API
botbuilder-core==4.16.0  # Microsoft Teams Bot Framework (준비)
```

### 테스트

**파일**: `backend/tests/adapters/test_slack_provider.py`

- Slack → Common Schema 변환 테스트
- Common Schema → Slack 변환 테스트
- 첨부파일 변환 테스트
- 스레드 메시지 테스트
- Provider 설정 테스트 (민감 정보 마스킹)

### Week 2 커밋

```bash
git commit a06a00e
feat(migration): Week 2 - Slack Provider Socket Mode 구현
```

---

## ✅ Week 3: Teams Provider 및 통합 테스트 (완료)

### Teams Provider (Graph API)

**구현 파일**: `backend/app/adapters/teams_provider.py`

Microsoft **Graph API**와 **Bot Framework**를 사용하여 Teams 메시지를 처리합니다.

#### 주요 기능

1. **OAuth 2.0 Client Credentials Flow**
   - 액세스 토큰 획득: `https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token`
   - Scope: `https://graph.microsoft.com/.default`

2. **Graph API 호출**
   - 메시지 전송: `POST /teams/{teamId}/channels/{channelId}/messages`
   - 채널 목록: `GET /teams/{teamId}/channels`
   - 사용자 목록: `GET /teams/{teamId}/members`

3. **메시지 변환**
   - Teams Activity → Common Schema
   - Common Schema → Teams 메시지
   - 첨부파일 지원 (Teams Attachments)

4. **Bot Framework Adapter**
   - `BotFrameworkAdapter`: Activity 처리
   - `handle_activity()`: Webhook에서 호출

#### aiohttp 기반 비동기 HTTP

```python
async with self.session.post(url, json=teams_msg, headers=headers) as resp:
    if resp.status in [200, 201]:
        return True
```

### 통합 테스트

**파일**: `backend/tests/integration/test_bridge_integration.py`

#### 테스트 시나리오

1. **Slack → Teams 메시지 브리지 플로우**
   - Slack 메시지 생성
   - 라우팅 룰 조회
   - Teams Provider로 전송
   - 검증: `teams_provider.send_message.assert_called_once()`

2. **Teams → Slack 메시지 브리지 플로우**
   - Teams 메시지 생성
   - 라우팅 룰 조회
   - Slack Provider로 전송
   - 검증: `slack_provider.send_message.assert_called_once()`

3. **브리지 상태 조회**
   - Provider 등록 확인
   - 상태 정보 검증

4. **메시지 변환 통합**
   - Slack → Common → Teams 변환
   - Teams → Common → Slack 변환

### Week 3 커밋

```bash
git commit 6e8c27f
feat(migration): Week 3 - Teams Provider 및 통합 테스트 완료
```

---

## 📊 전체 통계

### 구현 파일

| 카테고리 | 파일 수 | 라인 수 (추정) |
|----------|---------|----------------|
| Common Schema | 1 | ~180 |
| Provider Interface | 1 | ~210 |
| Providers (Slack, Teams) | 2 | ~1,100 |
| Core Engine | 3 | ~800 |
| 테스트 | 5 | ~900 |
| **합계** | **12** | **~3,190** |

### Git 커밋

- **Week 1**: 486cb15 (8 files changed, 1839 insertions)
- **Week 2**: a06a00e (5 files changed, 606 insertions)
- **Week 3**: 6e8c27f (5 files changed, 977 insertions)
- **합계**: **18 files changed, 3,422 insertions**

---

## 🎯 마이그레이션 계획 진행률

### 완료된 작업 ✅

- [x] **Week 1**: Common Schema, Provider Pattern, Core Engine
- [x] **Week 2**: Slack Provider (Socket Mode)
- [x] **Week 3**: Teams Provider (Graph API) + 통합 테스트

### 다음 단계 📋

**Week 4: 배포 준비 및 문서화**

1. **Docker 최적화**
   - Multi-stage build
   - docker-compose.yml 업데이트
   - Matterbridge 서비스 제거

2. **Frontend API 연결**
   - `src/lib/api/bridge.ts` 업데이트
   - Provider 관리 UI
   - 라우팅 룰 관리 UI

3. **프로덕션 준비**
   - 로깅 및 모니터링 (Structlog)
   - 에러 핸들링 강화
   - Rate Limiting
   - 보안 점검 (JWT, HTTPS)

4. **문서 업데이트**
   - README.md (자체 브리지 아키텍처)
   - ARCHITECTURE.md (Provider Pattern, Common Schema)
   - API.md (`/api/bridge/*` 엔드포인트)

---

## 🏆 성과

### 기술적 성과

1. **Zowe Chat 개념 적용**
   - Common Message Schema ✅
   - Provider Pattern ✅
   - Command Processor ✅

2. **Matterbridge 탈피**
   - 자체 메시지 브리지 구현 ✅
   - 동적 라우팅 (Redis) ✅
   - Provider 플러그인 아키텍처 ✅

3. **확장성 확보**
   - 새 플랫폼 추가: Provider 구현만으로 가능 ✅
   - 재시작 없이 라우팅 룰 변경 ✅

### 코드 품질

- **린팅**: ruff check --fix 통과 ✅
- **포맷팅**: ruff format 적용 ✅
- **테스트**: 단위 테스트 + 통합 테스트 ✅
- **타입 힌트**: Python 3.9+ 빌트인 제네릭 사용 ✅

---

## 🔗 참고 문서

- **마이그레이션 계획**: `docusaurus/docs/developer-guide/ZOWE_CHAT_MIGRATION_PLAN.md`
- **코딩 컨벤션**: `.claude/coding_conventions.md`
- **개발 워크플로우**: `.claude/dev_workflow.md`
- **Zowe Chat 아키텍처**: https://docs.zowe.org/stable/getting-started/zowe-architecture/

---

**작성자**: VMS Chat Ops Team
**작성일**: 2026-03-31
**다음 업데이트**: Week 4 완료 후
