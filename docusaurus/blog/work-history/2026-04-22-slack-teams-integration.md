---
slug: v-itsm-slack-teams-integration
title: v-itsm — Slack/Teams 알림 경로 완성 (embedded provider)
authors: [bong78]
tags: [v-itsm, slack, teams, notification, provider-pattern, decoupling]
date: 2026-04-22
---

# v-itsm — Slack/Teams 알림 경로 완성 (embedded provider)

Phase 1 MVP 의 마지막 미완 항목이었던 **v-itsm Slack/Teams 알림 송신**을 구현했다. 처음에는 v-channel-bridge 로 HTTP 호출하는 간단한 구조로 시작했으나, 진행 중 **"앱 간 런타임 HTTP 의존 회피"** 원칙이 재확인되어 설계를 뒤집고 bridge 의 outbound 코어만 v-itsm 으로 **포팅(embedded provider)** 하는 방향으로 전환했다. 결과: v-channel-bridge 가 내려가도 v-itsm 알림은 독립적으로 동작한다.

<!-- truncate -->

## 배경

v-itsm Phase 1 에서 이미 완성된 것:

- Ticket CRUD, 5단계 Loop FSM, 전이 이력 + 편집/복원(v0.3)
- SLA 타이머(응답/해결) + 80% 경고 / 100% 위반 감지 (APScheduler 1분 주기)
- 고객/제품/계약/SLA 티어/Scope Grant 기반 ACL(v0.2)

미완 항목 — 설계 §7 "알림 전략" 훅은 있었으나 structlog 만 남기고 실제 채널로 전송되지 않음.

## 설계 전환 — HTTP 커플링 → Embedded Provider

### 1차 시도 (되돌려짐): v-itsm → bridge HTTP

처음 30분 남짓은 가장 단순한 경로로 진행했다.

- v-itsm: `notification_service.py` 에서 `httpx.Client(timeout=2.5)` 로 `POST /api/bridge/notify` 호출
- v-channel-bridge: `NotifyRequest` 수신 → 내부 `provider_registry` 로 채널별 송출
- 실패 정책은 fail-open(예외 삼킴 + WARN 로그)

### 사용자 코스 코렉션

> "v-channel-bridge 수정하지 말고. v-channel-bridge의 구현된 내용 중 필요 부분을 v-itsm로 가져와서 독립적인 환경에서도 동작 할 수 있게 해줘. v-channel-bridge 변경부분은 원복 시켜주고..."

이유는 명확하다. **런타임 HTTP 커플링은 장애 전파를 만든다**. 브리지가 재시작/중단되면 ITSM 티켓 접수는 살아있는데 알림만 죽는 상황이 생기고, 두 앱 기동 순서가 DB/Redis 처럼 compose depends_on 으로 강제된다. Phase 1 목표인 "앱 독립 동작" 과 정면으로 충돌한다. 코드 중복은 허용하되 런타임 의존은 불가라는 원칙이 공식화되었다.

### 2차 구현 (채택): Provider Pattern embedded

v-channel-bridge 의 outbound 경로만 **선별 포팅**. inbound(Socket Mode, botbuilder, subscription) 는 ITSM 에 필요 없으므로 전부 제외.

| 요소 | 브리지 원본 | v-itsm 포팅본 | 차이 |
|---|---|---|---|
| `CommonMessage` 스키마 | `app/adapters/common_message.py` | `app/schemas/common_message.py` | command parsing 필드 제외 |
| `BasePlatformProvider` | `app/adapters/base.py` | `app/providers/base.py` | `BaseOutboundProvider` 로 축약 (receive/transform_to_common 제거) |
| Slack Provider | `slack_bolt` + `AsyncWebClient` + SocketMode | `AsyncWebClient` 단독 | Socket Mode 제거, `chat.postMessage` 만 |
| Teams Provider | `aiohttp` + Graph + botbuilder + subscription | `aiohttp` + Graph (+ 선택 webhook) | Activity/Conversation/OneDrive/markdown 변환 제거 |
| Provider Registry | `app/adapters/provider_registry.py` | `app/providers/registry.py` | 인터페이스 동일, env 로더 축소 |

## 구현

### `app/providers/` — 4개 파일

```
apps/v-itsm/backend/app/providers/
├── __init__.py            — provider_registry / init_providers_from_env / shutdown_providers export
├── base.py                — BaseOutboundProvider (ABC, 4 abstract methods)
├── registry.py            — _ProviderRegistry 싱글톤 + env 기반 lifecycle
├── slack_provider.py      — SlackOutboundProvider (AsyncWebClient)
└── teams_provider.py      — TeamsOutboundProvider (Graph app-only + webhook fallback)
```

핵심 설계 포인트:

- **fail-open 전역 일관화**: `connect()` 실패는 `is_connected=False` 로 남겨두고 registry 에는 등록. `send_message` 에서 연결 상태 확인 후 drop → 티켓 저장/전이는 영향 없음
- **Teams webhook-only mode**: Graph 자격증명(tenant/app/password) 없어도 `TEAMS_NOTIFICATION_URL` 만 있으면 Power Automate 경로로 퇴화 동작 — 온프레미스 고객 배포 시 Azure AD App 등록 안 해도 최소 알림 가능
- **Graph 토큰 캐싱**: `_TOKEN_REFRESH_MARGIN = 60` — 만료 60초 전 선제 갱신, 세션은 provider 수명 동안 재사용

### `notification_service.py` — sync 공개 API 유지, 내부만 async dispatch

```python
def send_notification(*, text, channels=None, blocks=None, event=None) -> None:
    targets = channels if channels is not None else _default_channels()
    if not targets:
        return
    _fire_and_forget(_dispatch_all(text, targets, blocks, event))
```

핵심은 `_fire_and_forget`:

```python
def _fire_and_forget(coro) -> None:
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
        return
    except RuntimeError:
        pass
    threading.Thread(target=lambda: asyncio.run(coro), daemon=True).start()
```

- FastAPI 엔드포인트(이미 running loop) → `create_task` 로 fire-and-forget
- APScheduler job(별도 스레드, running loop 없음) → daemon thread 에서 `asyncio.run`
- 호출 측(`ticket_service.update/transition`, `sla_timer._notify_*`) 은 sync 함수 그대로 → **기존 훅 4곳 코드 변경 없음**

### Lifespan 배선

`app/main.py`:

```python
# EventBroadcaster 다음에
await init_providers_from_env()        # SLACK_BOT_TOKEN, TEAMS_* 읽어 registry 채움
sla_timer.start_scheduler()
...
# 종료 시
sla_timer.stop_scheduler()
await shutdown_providers()             # 세션 close, registry clear
```

env 누락은 info 로그만 남기고 무시 — 부분 구성(Slack 만, Teams 만, 혹은 둘 다 없음) 허용.

### docker-compose.yml 정리

- stale `BRIDGE_BACKEND_URL` 제거
- `SLACK_BOT_TOKEN`, `TEAMS_TEAM_ID`, `TEAMS_NOTIFICATION_URL` 은 `apps/v-itsm/.env` 에서 env_file 로 주입
- SSO 용 `TEAMS_TENANT_ID/APP_ID/APP_PASSWORD` 는 루트 `.env` 공용(Graph 자격증명 재사용)

## 채널 포맷

```
ITSM_DEFAULT_NOTIFY_CHANNELS=slack:C0123ABCD,teams:19%3Axxx%40thread.tacv2
```

- `platform:channel_id` 쌍을 콤마로 구분
- `platform` 과 `channel_id` 사이 첫 `:` 만 구분자 — Teams channel_id 내부의 `:` 보존
- 확장 계획(Phase 2): `itsm_notification_channel_mapping` 테이블 → 부서/담당자/우선순위/제품별 라우팅

## 접수(역방향) 경로 — 별도 사이클

Slack/Teams → v-itsm 방향은 **아예 본 사이클에서 제외**. 이유:

- 알림(outbound)은 채널 ID + 텍스트만 필요한 단순 페이로드
- 접수(inbound)는 슬래시 커맨드 파싱, 요청자 매핑(`users.external_ids`), 채널 → 고객/제품 라우팅, 스팸/권한 체크까지 포함 — 설계 분량이 별개
- 접수 경로를 같이 묶으면 본 PR 이 비대해지고, 결국 outbound 가 검증 전에 블로킹됨

다음 사이클 스코프:

1. 슬래시 커맨드 `/ticket <제목> | <본문>` (브리지 `command_processor` 쪽) — ITSM 측은 HTTP intake API 재사용
2. Service-account JWT 기반 브리지 → ITSM 인증 (플랫폼 공용 토큰 발급기 재사용)
3. `source_ref` 에 원본 메시지 ts/id 저장 → UI 역링크

## 영향받는 파일

**신규**:
- `apps/v-itsm/backend/app/schemas/common_message.py`
- `apps/v-itsm/backend/app/providers/__init__.py`, `base.py`, `registry.py`, `slack_provider.py`, `teams_provider.py`

**수정**:
- `apps/v-itsm/backend/app/services/notification_service.py` — 완전 재작성(httpx 제거, registry 기반 dispatch)
- `apps/v-itsm/backend/app/main.py` — lifespan 에 init/shutdown 배선
- `apps/v-itsm/backend/requirements.txt` — `slack-sdk>=3.27.0` 추가(`aiohttp` 는 기존 포함)
- `docker-compose.yml` — itsm-backend 에서 `BRIDGE_BACKEND_URL` 제거, env 주석 정리

**되돌림**:
- `apps/v-channel-bridge/backend/app/api/bridge.py` — 1차 시도에서 추가했던 `POST /api/bridge/notify` 엔드포인트 원복. 브리지는 본 사이클에서 **한 줄도 변경 없음**

## 환경변수

`apps/v-itsm/.env` (env_file 주입):

| 변수 | 용도 | 누락 시 동작 |
|---|---|---|
| `SLACK_BOT_TOKEN` | Slack `chat.postMessage` 인증 | Slack provider 미등록 |
| `TEAMS_TEAM_ID` | Teams 채널 해석 시 기본 팀 ID | channel_id 가 `teamId:channelId` 포맷이면 불필요 |
| `TEAMS_NOTIFICATION_URL` | Power Automate webhook 폴백 | Graph 자격만 있으면 미사용 |
| `ITSM_DEFAULT_NOTIFY_CHANNELS` | 기본 broadcast 대상 | 알림 전체 스킵(DEBUG 로그만) |

루트 `.env` (공용):
- `TEAMS_TENANT_ID`, `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD` — SSO 와 Teams outbound 양쪽에서 재사용

## 검증

- `docker compose --profile itsm up -d --build itsm-backend` → healthy
- 로그: `Slack provider registered connected=True` / `Teams provider registered connected=True` (또는 env 없을 때 `Slack provider skipped — SLACK_BOT_TOKEN missing`)
- 샘플 티켓 배정 → `notify.dispatched event=ticket.assignment sent=1 total=1` 로그 확인
- `docker compose logs -f bridge-backend` → 본 사이클 동안 변경 없음 확인 (touch 없음)

## 회고

| 항목 | 교훈 |
|---|---|
| 최초 HTTP 커플링 구현 | "가장 단순한 경로" 가 항상 "가장 좋은 경로" 는 아님. 런타임 의존의 장기 비용 > 코드 중복의 유지보수 비용 |
| 선별 포팅 | 브리지의 **inbound** 자산(botbuilder, Socket Mode, 마크다운 변환)은 ITSM 에 불필요 — outbound 만 뽑으니 Slack 110줄 / Teams 200줄 수준으로 축소 |
| sync/async 경계 | `_fire_and_forget` 하나로 FastAPI endpoint + APScheduler job 양쪽 커버 → 호출 측 sync 시그니처 유지 가능. 리팩터링 폭 최소화 |
| fail-open 원칙 | provider 부재·연결 실패·send 예외 모두 WARN 로그 + 티켓 트랜잭션 영향 없음. 테스트/개발 환경에서 Slack 토큰 없이도 티켓 시스템 정상 동작 |

## 이후 이어질 작업

1. **접수 경로 구현 사이클**: `/ticket` 슬래시 커맨드 + service-account JWT
2. **채널 매핑 테이블**: 전역 JSON 변수 → DB 기반 라우팅(`itsm_notification_channel_mapping`)
3. **알림 배치 요약**: 담당자 피로 경감 — 사용자별 설정(DM/채널/무음) + 일일 요약 이메일
4. **알림 헬스 패널**: `/api/health/notify` — 각 provider 의 `is_connected`, 최근 실패율, last_error 노출

## 참조

- 설계 문서: `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` §7 (알림 전략 — embedded provider 로 개정 예정)
- 관련 앱 규칙: `apps/v-itsm/CLAUDE.md` §5 (알림은 embedded provider — bridge HTTP 의존 없음)
- Provider 원형: `apps/v-channel-bridge/backend/app/adapters/` — 포팅 소스, 본 사이클에서 수정 없음
