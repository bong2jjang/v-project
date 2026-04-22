---
title: v-itsm 운영 콘솔 설계 문서
description: SLA 정책/티어 관리, APScheduler 모니터링, 통합 설정, 전송 로그, 사용자별 알림 선호를 관리하는 운영 콘솔 설계
---

# v-itsm — 운영 콘솔 설계 (Operations Console)

**상태**: Draft v0.1
**작성일**: 2026-04-22
**작성자**: v-project 팀
**영향 범위**: `apps/v-itsm` 단독 (플랫폼 수정 없음)
**선행 문서**: [V_ITSM_DESIGN.md](./V_ITSM_DESIGN.md) v0.2

---

## 1. 목적 & 배경

Phase 1 MVP 로 티켓 CRUD · Loop FSM · SLA 타이머 스캐폴딩 · 내장 Slack/Teams 알림 provider · 고객/제품/계약/SLA티어/ACL(v0.2) 까지 백엔드 기반은 완성되었다. 그러나 **운영 주체(관리자·담당자)가 UI 로 직접 확인·조정할 수 있는 화면**이 비어 있어 다음 작업이 모두 DB/환경변수 직접 편집에 의존한다.

- **SLA 정책·티어 변경** — `itsm_sla_policy`, `itsm_sla_tier` 를 SQL 로 수정해야 함
- **스케줄러 상태 확인** — `sla_timer` / Loop FSM 관련 APScheduler 잡이 돌고 있는지 컨테이너 로그로만 확인
- **Slack/Teams 토큰 교체** — `.env` 파일 수정 + 컨테이너 재기동
- **알림 전송 실패 진단** — 로그에 흔적만 남고 DB 추적 불가, 재발송 수단 없음
- **담당자별 알림 선호** — 모두 동일한 `ITSM_DEFAULT_NOTIFY_CHANNELS` 값으로 강제됨

본 문서는 이 5가지 관리 기능을 **v-itsm 앱 스코프 내부**에서 완결되도록 설계한다. 플랫폼 승격(사용자 테이블 컬럼 추가 등)은 **보류**하고 필요한 모든 상태를 `itsm_*` 네임스페이스로 가둔다. 승격은 차기 앱(v-ui-builder 등)에서 동일 요구가 재등장할 때 재평가한다.

### 1.1 설계 원칙

1. **앱 독립성 유지** — `copy-not-import` 원칙 준수. v-channel-bridge 의 UI/코드는 참고만 하고 v-itsm 내부에 별도 구현.
2. **플랫폼 변경 금지** — `users` 테이블 수정, 플랫폼 마이그레이션 추가 없음. 사용자 식별자 매핑도 앱 내부 테이블로.
3. **안전한 스케줄러 관리** — 임의 잡 등록/삭제는 제공하지 않음(코드 주입·보안 위험). 정의된 잡의 조회·일시정지·즉시실행·간격조정만 허용.
4. **관리 권한 최소화** — 본 문서의 모든 관리 API 는 `User.role == SYSTEM_ADMIN` 전용. ACL 스코프 체계(itsm_scope_grant)는 티켓 데이터에만 적용.
5. **민감정보 암호화** — Slack/Teams 토큰은 플랫폼 `v_platform.utils.encryption` Fernet 싱글턴으로 암호화 저장.

---

## 2. 범위

### 2.1 포함 (MVP)

| # | 기능 | 비고 |
|---|---|---|
| F1 | **SLA 정책/티어/알림정책 관리 UI** | 기존 `itsm_sla_policy`, `itsm_sla_tier` CRUD + 신규 `itsm_sla_notification_policy` |
| F2 | **스케줄러 모니터링 UI** | 잡 목록 조회, 일시정지/재개, 즉시 실행, 스캔 간격 조정 |
| F3 | **Slack/Teams 통합 설정 UI** | 단일 로우 `itsm_integration_settings` 로 토큰/팀ID/웹훅 관리 + 연결 테스트 버튼 |
| F4 | **알림 전송 로그 UI** | `itsm_notification_log` 페이징·필터·재시도, CSV/JSON 내보내기 |
| F5 | **사용자별 알림 선호 UI** | `itsm_user_notification_pref` 단일 테이블에 식별자 매핑 + 채널 선호 결합 |

### 2.2 제외 (차기 Phase)

- ❌ Slack/Teams 멀티 계정(Account 모델) — 단일 워크스페이스만 지원
- ❌ OAuth Install Flow (`/slack/install` 등) — 토큰은 관리자가 직접 붙여넣기
- ❌ 임의 APScheduler 잡 등록/삭제 — 정의된 잡만 조작
- ❌ 플랫폼 승격(users 테이블 컬럼 추가) — 보류, 기준은 §10
- ❌ 제3자 채널(Webex/Discord/SMS) — 현재 provider 범위 외
- ❌ 알림 템플릿 편집기 — 현재 코드 하드코딩 유지

### 2.3 성공 지표

| 지표 | 목표 |
|---|---|
| SLA 정책 변경 소요 시간 | 관리자 UI 로 **1분 이내** (기존: DB 직접 편집) |
| 전송 실패 재시도 성공률 | ≥ 90% (재시도 UI 경유) |
| 담당자별 알림 채널 설정률 | ≥ 80% (6개월) |
| 토큰 교체 시 컨테이너 재기동 | **불필요** (hot-reload) |

---

## 3. 아키텍처

### 3.1 구성

```
┌───────────────────────────────────────────────────────────────────────┐
│ v-itsm Frontend (:5182)                                               │
│                                                                       │
│ Admin/                                Settings/                       │
│  ├── SchedulerMonitor.tsx  (F2)        └── MyNotifications.tsx (F5)   │
│  ├── SLAPolicies.tsx       (F1)                                       │
│  ├── SLATiers.tsx          (F1)      Operations/                      │
│  ├── SLANotifyPolicies.tsx (F1)        └── NotificationLogs.tsx (F4)  │
│  └── Integrations.tsx      (F3)                                       │
└───────────────────────────┬───────────────────────────────────────────┘
                            │ TanStack Query
┌───────────────────────────▼───────────────────────────────────────────┐
│ v-itsm Backend (:8005, FastAPI)                                       │
│                                                                       │
│  app/api/                                                             │
│   ├── admin/                                                          │
│   │   ├── sla_policies.py          (SLAPolicy CRUD)                   │
│   │   ├── sla_tiers.py             (SLATier CRUD)                     │
│   │   ├── sla_notify_policies.py   (SLANotificationPolicy CRUD)       │
│   │   ├── scheduler.py             (jobs list/pause/resume/trigger)   │
│   │   └── integrations.py          (integration_settings + test)      │
│   ├── notifications/                                                  │
│   │   └── logs.py                  (notification_log list/retry)      │
│   └── me/                                                             │
│       └── notification_prefs.py    (get/put own prefs)                │
│                                                                       │
│  app/services/                                                        │
│   ├── scheduler_registry.py        (정의된 잡 레지스트리, 런타임 제어) │
│   ├── integration_settings.py      (암호화 저장·로드)                 │
│   ├── notification_log.py          (기록·재시도)                      │
│   ├── sla_policy_admin.py          (CRUD + 타이머 재계산 트리거)      │
│   └── user_notification_pref.py    (선호·식별자 조회)                 │
│                                                                       │
│  app/models/                                                          │
│   ├── notification_log.py          (itsm_notification_log)            │
│   ├── integration_settings.py      (itsm_integration_settings)        │
│   ├── sla_notification_policy.py   (itsm_sla_notification_policy)     │
│   └── user_notification_pref.py    (itsm_user_notification_pref)      │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 런타임 데이터 흐름

**토큰 로드 경로 (기동 후)**
1. `app/main.py startup` → `integration_settings.load_or_default()` 실행
2. `itsm_integration_settings` 단일 로우 조회 → Fernet 복호화 → 프로세스 메모리 캐시
3. 관리자가 UI 에서 토큰 갱신 → API 가 Fernet 암호화 후 UPDATE + `_reload_cache()` 호출
4. provider 인스턴스(`slack_provider`, `teams_provider`)는 **요청 시점**에 캐시를 읽어 사용 (컨테이너 재기동 불필요)

**알림 전송 + 로그 기록**
1. `notification_service.send(event_type, ticket_id, recipients)` 호출
2. 수신자별(담당자 user_id) `user_notification_pref` 조회 → 채널/식별자 결정
3. provider 호출 전 `itsm_notification_log` 로우 생성 (status=`pending`)
4. provider 응답 → `status` 를 `sent`/`failed` 로 UPDATE, `delivered_at` / `error_message` 기록
5. 실패 시 UI 의 "재시도" 버튼 → 동일 로우 `retry_count++` 후 재전송

**SLA 정책 변경 반영**
1. 관리자가 SLA 티어 matrix 수정 → `sla_policy_admin.update_tier()`
2. 옵션 체크박스 "활성 티켓 재계산" on → `sla_timer._resolve_policy()` 재실행해 **미위반** 타이머만 `due_at` 갱신. 위반 이력은 보존.

### 3.3 스케줄러 레지스트리

기존 `sla_timer.py` 는 단일 전역 `AsyncIOScheduler(jobstores=memory)` 에 `itsm_sla_scan` 하나만 등록한다. 본 설계에서 **잡을 새로 만들지 않고** 기존 잡의 메타데이터를 UI 로 노출하기 위해 경량 레지스트리를 추가한다.

```python
# app/services/scheduler_registry.py
SCHEDULER_JOBS: dict[str, JobSpec] = {
    "itsm_sla_scan": JobSpec(
        id="itsm_sla_scan",
        label="SLA 스캔",
        description="경고/위반 임계치 도달 타이머 처리",
        default_interval_seconds=60,
        min_interval_seconds=10,
        max_interval_seconds=600,
        trigger_fn=lambda: sla_timer.scan_due_timers(...),
    ),
    # 향후 추가될 잡도 여기에 선언(예: notification_retry_sweep)
}
```

- **조회**: scheduler 인스턴스에 등록된 실제 Job 과 SCHEDULER_JOBS 를 merge 하여 `next_run_time`, `paused` 상태 노출
- **일시정지/재개**: `scheduler.pause_job(id)` / `resume_job(id)`
- **즉시 실행**: `scheduler.modify_job(id, next_run_time=datetime.utcnow())`
- **간격 조정**: `scheduler.reschedule_job(id, trigger=IntervalTrigger(seconds=N))` — `min/max` 범위 clamp
- **재기동 지속성 없음** — memory jobstore 유지(복잡도 회피). 간격 변경은 `itsm_scheduler_override` 작은 테이블에 저장하고 startup 시 재적용. (§4.8)

---

## 4. 데이터 모델 (신규·수정)

모든 테이블은 `itsm_` 접두사 준수. 플랫폼 테이블 수정 없음.

### 4.1 `itsm_notification_log`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | VARCHAR(26) PK | ULID |
| ticket_id | VARCHAR(26) FK NULL | `itsm_ticket(id)` SET NULL. 티켓 무관 알림(관리자 공지 등) 지원 |
| event_type | VARCHAR(40) NOT NULL | `ticket.assigned`, `sla.warning`, `sla.breached`, `loop.transition`, `comment.added` 등 |
| channel | VARCHAR(20) NOT NULL | `slack` / `teams` / `email` / `webhook` |
| target_user_id | INTEGER FK NULL | `users(id)` SET NULL (수신자) |
| target_address | VARCHAR(300) NOT NULL | 실제 수신 식별자 (slack_user_id, teams channel id, email 주소 등) |
| payload | JSONB NOT NULL | provider 에 전달한 원본 페이로드 (비밀정보 제외) |
| status | VARCHAR(20) NOT NULL DEFAULT 'pending' | `pending` / `sent` / `failed` / `retrying` |
| error_message | TEXT | 실패 시 provider 에러 메시지 |
| retry_count | INTEGER NOT NULL DEFAULT 0 | |
| last_retry_at | TIMESTAMPTZ | |
| delivered_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**인덱스**
- `ix_inlog_ticket` (ticket_id)
- `ix_inlog_event` (event_type)
- `ix_inlog_status_created` (status, created_at DESC) — 실패 최근순 조회
- `ix_inlog_target_user` (target_user_id)
- `ix_inlog_created_desc` (created_at DESC)

### 4.2 `itsm_integration_settings`

단일 로우 테이블(싱글턴). `id=1` 고정.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INTEGER PK | 항상 1 (CHECK 제약) |
| slack_bot_token_enc | TEXT | Fernet 암호문 |
| slack_app_token_enc | TEXT | Socket Mode (옵션) |
| slack_signing_secret_enc | TEXT | |
| slack_default_channel | VARCHAR(200) | `#v-itsm-alerts` |
| teams_tenant_id | VARCHAR(100) | |
| teams_app_id | VARCHAR(100) | |
| teams_app_password_enc | TEXT | |
| teams_team_id | VARCHAR(100) | |
| teams_webhook_url_enc | TEXT | Power Automate fallback |
| teams_default_channel_id | VARCHAR(200) | |
| email_smtp_host | VARCHAR(200) | |
| email_smtp_port | INTEGER | |
| email_from | VARCHAR(300) | |
| email_smtp_user_enc | TEXT | |
| email_smtp_password_enc | TEXT | |
| slack_last_test_at | TIMESTAMPTZ | |
| slack_last_test_ok | BOOLEAN | |
| slack_last_test_message | TEXT | |
| teams_last_test_at | TIMESTAMPTZ | |
| teams_last_test_ok | BOOLEAN | |
| teams_last_test_message | TEXT | |
| email_last_test_at | TIMESTAMPTZ | |
| email_last_test_ok | BOOLEAN | |
| email_last_test_message | TEXT | |
| updated_by | INTEGER FK users(id) SET NULL | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**암호화 패턴** — v-channel-bridge `Account` 모델의 property 접근자 방식을 **포팅**한다 (copy-not-import).

```python
# app/models/integration_settings.py
class IntegrationSettings(Base):
    __tablename__ = "itsm_integration_settings"
    id = Column(Integer, primary_key=True, default=1)
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_integration_settings_singleton"),
    )
    slack_bot_token_enc = Column(Text, nullable=True)
    ...

    @property
    def slack_bot_token(self) -> str | None:
        from v_platform.utils.encryption import decrypt
        return decrypt(self.slack_bot_token_enc) if self.slack_bot_token_enc else None

    @slack_bot_token.setter
    def slack_bot_token(self, value: str | None) -> None:
        from v_platform.utils.encryption import encrypt
        self.slack_bot_token_enc = encrypt(value) if value else None
```

### 4.3 `itsm_sla_notification_policy`

현재 SLA 타이머는 `warning_sent_at` / `breached_at` 만 찍고 알림을 누구에게 보낼지 코드에 없다. 본 테이블로 그 정책을 표현.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | VARCHAR(26) PK | |
| name | VARCHAR(100) NOT NULL | "기본 SLA 알림" |
| trigger_event | VARCHAR(20) NOT NULL | `warning_80`, `breached_100`, `unassigned_timeout` |
| applies_priority | VARCHAR(20) NULL | NULL = 전체 (critical/high/normal/low) |
| applies_service_type | VARCHAR(20) NULL | NULL = 전체 |
| notify_channels | JSONB NOT NULL | `["slack","teams","email"]` |
| notify_assignee | BOOLEAN DEFAULT true | |
| notify_assignee_manager | BOOLEAN DEFAULT false | 부서 관리자에게 cc |
| notify_custom_user_ids | JSONB | `[12, 34]` — 추가 수신 |
| notify_custom_addresses | JSONB | `[{"channel":"slack","target":"#itsm-escalation"}]` |
| template_key | VARCHAR(50) | 코드의 템플릿 키 (현재 하드코딩 유지) |
| active | BOOLEAN DEFAULT true | |
| created_at / updated_at | TIMESTAMPTZ | |

**인덱스**: `ix_snp_trigger_active(trigger_event, active)`

### 4.4 `itsm_user_notification_pref`

**플랫폼 승격 보류로 식별자 매핑도 이 테이블에 수용**한다. 향후 승격 시에는 매핑 컬럼만 플랫폼 `users` 로 이관하고 여기는 선호 컬럼만 남기면 된다 (§10 승격 기준).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | VARCHAR(26) PK | |
| user_id | INTEGER FK users(id) CASCADE UNIQUE | 1 user = 1 row |
| slack_user_id | VARCHAR(50) NULL | `U0XXXXXX` — 담당자 DM 수신용 |
| teams_user_id | VARCHAR(100) NULL | Graph 사용자 id 또는 AAD object id |
| teams_channel_override | VARCHAR(200) NULL | 특정 채널로 받고 싶을 때 |
| email_override | VARCHAR(300) NULL | NULL = `users.email` 사용 |
| channels | JSONB NOT NULL DEFAULT '["email"]' | `["slack","email"]` 등. 빈 배열 = 알림 수신 거부 |
| event_overrides | JSONB | `{"sla.breached": ["slack","email"], "comment.added": []}` — 이벤트별 예외 |
| enabled | BOOLEAN DEFAULT true | 전체 OFF 토글 |
| quiet_hours | JSONB NULL | `{"start":"22:00","end":"08:00","tz":"Asia/Seoul"}` — 긴급도 normal 이하 억제 |
| created_at / updated_at | TIMESTAMPTZ | |

**조회 폴백 순서** (notification_service 내부):
1. `itsm_user_notification_pref` 존재 + `enabled=true` → 해당 row 사용
2. 없음/disabled → `ITSM_DEFAULT_NOTIFY_CHANNELS` 환경변수 (email 만 기본값)
3. slack/teams 채널이 목록에 있으나 식별자 NULL → 해당 채널 skip + notification_log 에 `status=failed`, `error=missing_identity` 기록

### 4.5 `itsm_scheduler_override`

스케줄러 간격을 UI 로 바꿨을 때 컨테이너 재기동 후에도 유지하기 위한 작은 테이블. (memory jobstore 유지하되 override 만 별도 보존)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| job_id | VARCHAR(50) PK | `itsm_sla_scan` 등 |
| interval_seconds | INTEGER NOT NULL | |
| paused | BOOLEAN NOT NULL DEFAULT false | |
| updated_by | INTEGER FK users(id) SET NULL | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

startup lifespan 에서 `SCHEDULER_JOBS` 등록 직후 이 테이블을 읽어 `scheduler.reschedule_job()` / `pause_job()` 적용.

### 4.6 기존 테이블 수정 없음

- `itsm_ticket` — 변경 없음
- `itsm_sla_policy` — 변경 없음 (CRUD UI 만 추가)
- `itsm_sla_tier` — 변경 없음 (CRUD UI 만 추가)
- 플랫폼 테이블 — 변경 없음 (원칙)

---

## 5. 백엔드 API

모든 `/api/admin/*` 경로는 `User.role == SYSTEM_ADMIN` 필수. `/api/me/*` 는 로그인 사용자 본인.

### 5.1 SLA 정책/티어/알림정책 (F1)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/sla-policies` | SLAPolicy 목록 (기존 `itsm_sla_policy` 모델) |
| POST | `/api/admin/sla-policies` | 신규 |
| PUT | `/api/admin/sla-policies/{id}` | 수정 (`recalc_active=true` 쿼리로 활성 티켓 재계산) |
| DELETE | `/api/admin/sla-policies/{id}` | 삭제 |
| GET | `/api/admin/sla-tiers` | SLATier 목록 |
| POST/PUT/DELETE | `/api/admin/sla-tiers[/ {id}]` | |
| GET | `/api/admin/sla-notification-policies` | SLANotificationPolicy 목록 |
| POST/PUT/DELETE | `/api/admin/sla-notification-policies[/{id}]` | |

**SLAPolicy 재계산 로직**
```python
if recalc_active:
    stmt = select(Ticket).where(
        Ticket.stage != LoopStage.CLOSED,
        Ticket.priority == policy.priority,
        Ticket.category == policy.category,  # NULL 매칭 포함
    )
    for ticket in session.scalars(stmt):
        sla_timer.recompute_for_ticket(ticket, overwrite_unbreached=True)
```

### 5.2 스케줄러 모니터 (F2)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/scheduler/jobs` | 등록된 잡 목록 + 상태 |
| POST | `/api/admin/scheduler/jobs/{job_id}/pause` | |
| POST | `/api/admin/scheduler/jobs/{job_id}/resume` | |
| POST | `/api/admin/scheduler/jobs/{job_id}/trigger` | 즉시 1회 실행 |
| PUT | `/api/admin/scheduler/jobs/{job_id}/interval` | `{"seconds": 60}` 본문 |

**응답 예시**
```json
{
  "jobs": [
    {
      "id": "itsm_sla_scan",
      "label": "SLA 스캔",
      "next_run_at": "2026-04-22T10:15:00Z",
      "interval_seconds": 60,
      "paused": false,
      "last_run_at": "2026-04-22T10:14:00Z",
      "last_run_ok": true,
      "last_run_duration_ms": 142
    }
  ]
}
```

`last_run_*` 은 `scheduler_registry` 내부의 in-memory ring buffer(잡당 최근 1건)만 유지. DB 테이블로는 이전하지 않음(복잡도 회피).

### 5.3 통합 설정 (F3)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/integrations` | 설정 조회. **토큰은 마스킹**(`****XXXX`) |
| PUT | `/api/admin/integrations` | 전체 upsert. 빈 문자열 = 변경 없음, `null` = 삭제 |
| POST | `/api/admin/integrations/test/slack` | `{"channel":"#v-itsm-alerts","text":"테스트"}` |
| POST | `/api/admin/integrations/test/teams` | |
| POST | `/api/admin/integrations/test/email` | `{"to":"admin@..."}` |

**테스트 동작**
- 저장된 최신 값으로 실제 provider 1회 호출
- 결과를 `integration_settings.{channel}_last_test_*` 컬럼에 UPDATE
- 응답에 `{ok, message, timestamp}` 반환

### 5.4 알림 전송 로그 (F4)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/notifications/logs` | 페이지·필터·정렬 |
| GET | `/api/notifications/logs/{id}` | 상세 (payload 포함) |
| POST | `/api/notifications/logs/{id}/retry` | 재전송 |
| GET | `/api/notifications/logs/export` | CSV/JSON (`format=csv|json`) |

**필터 파라미터**: `page`, `per_page` (기본 50, max 200), `event_type`, `channel`, `status`, `ticket_id`, `target_user_id`, `from_date`, `to_date`, `q` (error_message LIKE).

**권한**: 시스템관리자는 전체, 일반 사용자는 **본인이 target 인 로그**만 조회 가능 (티켓 접근 ACL 과 별개).

**재시도 로직**
```python
log = session.get(NotificationLog, id)
log.status = "retrying"; log.retry_count += 1; log.last_retry_at = now()
session.commit()
try:
    provider.send(channel=log.channel, target=log.target_address, payload=log.payload)
    log.status = "sent"; log.delivered_at = now(); log.error_message = None
except Exception as e:
    log.status = "failed"; log.error_message = str(e)[:500]
finally:
    session.commit()
```

### 5.5 내 알림 선호 (F5)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/me/notification-preferences` | 없으면 기본값 생성 후 반환 |
| PUT | `/api/me/notification-preferences` | 부분 업데이트 |
| POST | `/api/me/notification-preferences/test` | `{"channel":"slack"}` 본인 DM 테스트 |

**관리자용**:
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/users/{user_id}/notification-preferences` | 특정 사용자 조회 |
| PUT | `/api/admin/users/{user_id}/notification-preferences` | 관리자가 대리 설정 |

---

## 6. 프론트엔드

모든 페이지는 v-channel-bridge `Messages.tsx`/`Integrations.tsx` 를 **참고**하되 v-itsm 내부에 별도 작성 (copy-not-import).

### 6.1 라우트 구조

```
App.tsx
├── /dashboard                           (기존)
├── /tickets                             (기존)
├── /admin
│   ├── /admin/scheduler                 SchedulerMonitor.tsx      (F2)
│   ├── /admin/sla-policies              SLAPolicies.tsx           (F1)
│   ├── /admin/sla-tiers                 SLATiers.tsx              (F1)
│   ├── /admin/sla-notification-policies SLANotifyPolicies.tsx     (F1)
│   └── /admin/integrations              Integrations.tsx          (F3)
├── /operations
│   └── /operations/notifications        NotificationLogs.tsx      (F4)
└── /settings
    └── /settings/my-notifications       MyNotifications.tsx       (F5)
```

`/admin/*` 진입 가드: `useAuthStore` 의 `role === 'SYSTEM_ADMIN'` 아니면 403 페이지. 메뉴 자체는 `app_menu_keys` 로 v-itsm `.env` 에 의해 토글.

### 6.2 페이지별 UX

**SchedulerMonitor.tsx** — 카드 리스트
- 각 잡: 이름, 설명, 다음 실행 시각(상대/절대 토글), 간격(슬라이더, min~max), "일시정지/재개", "즉시실행", "간격저장" 버튼
- 최근 실행 결과 배지(green/red + duration_ms)

**SLAPolicies.tsx / SLATiers.tsx / SLANotifyPolicies.tsx** — 공통 Table + Drawer 편집 패턴
- Table: 이름, 적용조건, 시간(matrix 요약), 활성 토글
- Drawer: 전체 편집. JSON 편집은 [Monaco editor](https://microsoft.github.io/monaco-editor/) 대신 **필드별 UI**(우선순위별 입력행) 우선. matrix 만 fallback JSON 편집 허용.
- SLAPolicy 편집 저장 시 "현재 영향받는 활성 티켓 N건" 배너 + 체크박스 "재계산 실행"

**Integrations.tsx** — Slack/Teams/Email 탭
- 각 탭: 폼 + "연결 테스트" 버튼 + 최근 테스트 결과 배지
- 토큰은 `****` 마스킹. "변경" 클릭해야 평문 입력 활성화
- Save 성공 시 Toast + provider cache 리로드 서버 응답 표시

**NotificationLogs.tsx** — 브릿지 `Messages.tsx` 패턴 준용
- 상단: status/channel/event_type/date-range 필터, 검색창
- Table: 시각, 이벤트, 채널, 수신자, 상태(배지), 재시도횟수, 액션
- 행 클릭 → Drawer: payload JSON pretty, error_message, 관련 티켓 링크, 재시도 버튼
- 우상단: "내보내기 CSV/JSON", 페이지 크기 선택

**MyNotifications.tsx**
- 상단: 마스터 토글(enabled), quiet hours 편집
- Slack 식별자: `slack_user_id` 직접 입력 필드 + **"Slack에서 내 ID 찾기"** 헬프 링크(Slack 프로필 URL 설명)
- Teams 식별자: `teams_user_id` 필드 + 동일 헬프
- 채널 체크박스(email/slack/teams)
- 이벤트별 오버라이드 테이블(선택): 이벤트 × 채널 매트릭스. 기본 채널 따르기/사용 안함/개별 지정
- "테스트 알림 발송" 버튼(채널별)

### 6.3 상태 관리 & 훅

- **TanStack Query**: 모든 조회/뮤테이션. `queryKey` 는 `['admin','sla-policies']`, `['admin','scheduler','jobs']` 등 계층화.
- **Zustand**: 사용하지 않음(본 기능은 서버상태 중심).
- **API 클라이언트**: `app/api/adminSla.ts`, `adminScheduler.ts`, `adminIntegrations.ts`, `notificationLogs.ts`, `myNotifications.ts` — 각 파일 작고 단일 책임.

---

## 7. 마이그레이션

### 7.1 `a005_operations_console.py` (신규)

멱등. 이전 마이그레이션(a001~a004) 수정 없음.

```python
def migrate(engine):
    with engine.begin() as conn:
        # 4.1 itsm_notification_log
        conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS itsm_notification_log (
                id VARCHAR(26) PRIMARY KEY,
                ticket_id VARCHAR(26) REFERENCES itsm_ticket(id) ON DELETE SET NULL,
                event_type VARCHAR(40) NOT NULL,
                channel VARCHAR(20) NOT NULL,
                target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                target_address VARCHAR(300) NOT NULL,
                payload JSONB NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                error_message TEXT,
                retry_count INTEGER NOT NULL DEFAULT 0,
                last_retry_at TIMESTAMPTZ,
                delivered_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        for name, cols in [
            ("ix_inlog_ticket", "ticket_id"),
            ("ix_inlog_event", "event_type"),
            ("ix_inlog_status_created", "status, created_at DESC"),
            ("ix_inlog_target_user", "target_user_id"),
            ("ix_inlog_created_desc", "created_at DESC"),
        ]:
            conn.exec_driver_sql(
                f"CREATE INDEX IF NOT EXISTS {name} ON itsm_notification_log ({cols})"
            )

        # 4.2 itsm_integration_settings (singleton)
        conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS itsm_integration_settings (
                id INTEGER PRIMARY KEY,
                slack_bot_token_enc TEXT,
                slack_app_token_enc TEXT,
                slack_signing_secret_enc TEXT,
                slack_default_channel VARCHAR(200),
                teams_tenant_id VARCHAR(100),
                teams_app_id VARCHAR(100),
                teams_app_password_enc TEXT,
                teams_team_id VARCHAR(100),
                teams_webhook_url_enc TEXT,
                teams_default_channel_id VARCHAR(200),
                email_smtp_host VARCHAR(200),
                email_smtp_port INTEGER,
                email_from VARCHAR(300),
                email_smtp_user_enc TEXT,
                email_smtp_password_enc TEXT,
                slack_last_test_at TIMESTAMPTZ,
                slack_last_test_ok BOOLEAN,
                slack_last_test_message TEXT,
                teams_last_test_at TIMESTAMPTZ,
                teams_last_test_ok BOOLEAN,
                teams_last_test_message TEXT,
                email_last_test_at TIMESTAMPTZ,
                email_last_test_ok BOOLEAN,
                email_last_test_message TEXT,
                updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT ck_integration_settings_singleton CHECK (id = 1)
            )
        """)
        conn.exec_driver_sql("""
            INSERT INTO itsm_integration_settings (id) VALUES (1)
            ON CONFLICT (id) DO NOTHING
        """)

        # 4.3 itsm_sla_notification_policy
        conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS itsm_sla_notification_policy (
                id VARCHAR(26) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                trigger_event VARCHAR(20) NOT NULL,
                applies_priority VARCHAR(20),
                applies_service_type VARCHAR(20),
                notify_channels JSONB NOT NULL,
                notify_assignee BOOLEAN NOT NULL DEFAULT true,
                notify_assignee_manager BOOLEAN NOT NULL DEFAULT false,
                notify_custom_user_ids JSONB,
                notify_custom_addresses JSONB,
                template_key VARCHAR(50),
                active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_snp_trigger_active "
            "ON itsm_sla_notification_policy (trigger_event, active)"
        )
        # 기본 시드: 경고/위반 각 1건
        _seed_default_notification_policies(conn)

        # 4.4 itsm_user_notification_pref
        conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS itsm_user_notification_pref (
                id VARCHAR(26) PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                slack_user_id VARCHAR(50),
                teams_user_id VARCHAR(100),
                teams_channel_override VARCHAR(200),
                email_override VARCHAR(300),
                channels JSONB NOT NULL DEFAULT '["email"]'::jsonb,
                event_overrides JSONB,
                enabled BOOLEAN NOT NULL DEFAULT true,
                quiet_hours JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)

        # 4.5 itsm_scheduler_override
        conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS itsm_scheduler_override (
                job_id VARCHAR(50) PRIMARY KEY,
                interval_seconds INTEGER NOT NULL,
                paused BOOLEAN NOT NULL DEFAULT false,
                updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
```

### 7.2 실행 순서

```bash
docker compose exec itsm-backend python -m v_platform.migrations.run_app_migrations --app v-itsm
```

- 실행 로그에 `a005_operations_console` 출력 확인
- `\dt itsm_*` 로 5개 신규 테이블 추가 확인: notification_log, integration_settings, sla_notification_policy, user_notification_pref, scheduler_override
- 기존 테이블 변경 없음 재확인

### 7.3 롤백 정책

Phase 1 운영 데이터가 많지 않으므로 **forward-only**. 만약 긴급 롤백 필요 시 DROP TABLE 5개 + `ALTER TABLE itsm_ticket` 없으므로 `itsm_ticket` 복구 불필요. 롤백 수동 스크립트는 작성 보류.

---

## 8. 작업 분해 (Phase 별)

| Step | 설명 | 산출 |
|---|---|---|
| 1 | 본 설계 문서 리뷰·승인 | v0.1 merge |
| 2 | `a005_operations_console.py` 작성 + 로컬 마이그레이션 검증 | DB 스키마 |
| 3 | 모델 5종 작성 (`models/*`), `__init__.py` export | SQLAlchemy |
| 4 | `integration_settings.py` 서비스 + provider cache reload 배선 | Slack/Teams provider 가 캐시 참조 |
| 5 | `notification_log.py` 서비스 + `notification_service` 패치 (send 시 로그 기록) | 로그 기록 |
| 6 | `scheduler_registry.py` + `sla_timer` 리팩토링(레지스트리 등록 방식으로) | 스케줄러 제어 |
| 7 | `user_notification_pref.py` 서비스 + `notification_service.resolve_recipients()` 경로 | 선호 반영 |
| 8 | `sla_policy_admin.py` + 재계산 로직 | SLA UI backend |
| 9 | API 라우터 7개 작성 + main.py 배선 | OpenAPI |
| 10 | 프런트엔드 페이지 7개 + 라우트 + 메뉴 | UI |
| 11 | docker compose rebuild + smoke 테스트 | 통합 검증 |
| 12 | KPI 대시보드 보강(전송 성공률 카드 추가) | 대시보드 연계 |

Phase 1 (이번 작업): Step 2~11.
Phase 2 (차기): Step 12, OAuth install flow, 멀티 계정 지원, 템플릿 편집기, 플랫폼 승격 재평가.

---

## 9. 검증 계획

### 9.1 마이그레이션

```bash
docker compose exec postgres psql -U vmsuser -d v_project -c "\dt itsm_*" | tee /tmp/tables.txt
grep -c -E "itsm_notification_log|itsm_integration_settings|itsm_sla_notification_policy|itsm_user_notification_pref|itsm_scheduler_override" /tmp/tables.txt
# 기대: 5
docker compose exec postgres psql -U vmsuser -d v_project -c "SELECT count(*) FROM itsm_integration_settings"
# 기대: 1 (singleton 로우)
docker compose exec postgres psql -U vmsuser -d v_project -c "SELECT count(*) FROM itsm_sla_notification_policy"
# 기대: 2 이상 (기본 시드)
```

### 9.2 기능 smoke (http://127.0.0.1:5182)

1. SYSTEM_ADMIN 로그인 → `/admin/integrations` → Slack 탭에 토큰 입력 → Save → "연결 테스트" → 성공 배지
2. `/admin/sla-tiers` → GOLD matrix critical 를 15분/240분으로 수정 → "활성 티켓 재계산" 체크 → Save
3. `/admin/scheduler` → `itsm_sla_scan` 간격 60→30s → Save → 컨테이너 재기동 후에도 30s 유지(`itsm_scheduler_override` 적용) 확인
4. 임의 티켓에서 stage transition → 알림 발송 → `/operations/notifications` 에 로그 행 표시
5. 강제 실패 유도(Slack 토큰 만료) → 실패 로그 → "재시도" → 토큰 갱신 후 재시도 → 성공
6. 일반 사용자(담당자) 로그인 → `/settings/my-notifications` → slack_user_id 입력 + Slack 채널 체크 → "테스트" → DM 수신
7. 일반 사용자 → `/operations/notifications` → **본인이 수신자인 로그만** 노출 확인 (타 사용자 로그 403)

### 9.3 회귀 체크

- 기존 티켓 CRUD/Loop FSM/SLA 타이머 스캔 동작 유지
- `ITSM_DEFAULT_NOTIFY_CHANNELS` 환경변수 설정 사용자 → pref 없을 때 폴백 동작
- Fernet 키(`ENCRYPTION_KEY`) 재기동 후에도 토큰 복호화 정상

---

## 10. 플랫폼 승격 재평가 기준 (보류 항목)

현재는 `slack_user_id`/`teams_user_id` 매핑과 알림 선호를 v-itsm 로컬에 둔다. 아래 **2가지 이상** 충족 시 플랫폼 승격(사용자 테이블 컬럼 추가 또는 별도 `platform_user_notification_preference` 테이블) 재검토:

1. v-itsm 외 다른 앱(v-ui-builder, v-platform-portal, v-channel-bridge) 중 **한 곳이라도** 동일한 식별자 매핑을 필요로 함
2. 같은 사용자가 2개 이상의 앱에서 **동일한** Slack/Teams ID 를 재입력해야 하는 상황 발생
3. 플랫폼 차원의 "알림 구독 센터" 요구가 들어옴(공지사항·보안알림 등을 앱 구분 없이 사용자 선호대로 보내야 할 때)
4. Fernet/암호화 정책을 앱 간 통일해야 하는 보안 요구

승격 시 마이그레이션 경로:
- 플랫폼에 `p{NNN}_user_chat_identity.py` 추가 → `users.slack_user_id`, `users.teams_user_id` 컬럼 add (nullable)
- `itsm_user_notification_pref` 의 identity 컬럼을 `users` 로 복사(멱등 `UPDATE`) → 해당 컬럼 drop
- v-itsm 서비스가 `users.slack_user_id` 를 읽도록 수정

승격 보류 동안 유지 비용: 테이블 1개·컬럼 2~3개의 중복. 리스크 낮음.

---

## 11. 리스크 & 미해결 항목

| 항목 | 리스크 | 완화 |
|---|---|---|
| Fernet 키 분실/변경 | 토큰 복호화 실패 → 알림 전면 중단 | `ENCRYPTION_KEY` 백업 문서화, `integration_settings` 재입력 UI 는 이미 제공 |
| Payload 저장 비대화 | `itsm_notification_log.payload` 누적으로 DB 팽창 | 30일 이상 `status=sent` 로그 야간 배치 삭제(Phase 2), 민감필드 마스킹 |
| 스케줄러 interval 극단값 | 관리자가 `1` 초로 낮춰 DB 부하 | `SCHEDULER_JOBS[].min_interval_seconds` 로 서버측 clamp |
| SLA 재계산 대량 UPDATE | 활성 티켓 많을 시 blocking | 재계산을 백그라운드 태스크(`asyncio.create_task`)로 분리 + 진행률 Polling |
| Slack rate limit | 재시도 러쉬로 429 발생 | retry 시 `429` 응답 시 `Retry-After` 존중, exponential backoff |
| 사용자가 slack_user_id 오입력 | provider 실패 로그만 쌓임 | 저장 시 형식 검증(`U[A-Z0-9]{6,}`), "테스트" 버튼으로 사전 확인 유도 |
| 이벤트 오버라이드 복잡성 | 사용자가 실수로 중요 이벤트 전부 disable | `sla.breached` 같은 critical 이벤트는 UI 에서 "완전 disable 불가" 경고 표시 |

---

## 12. 관련 문서

- [V_ITSM_DESIGN.md](./V_ITSM_DESIGN.md) — 본 앱의 상위 설계 (§7.3 알림 경로)
- [MULTI_APP_DATA_ISOLATION.md](../../../platform/design/MULTI_APP_DATA_ISOLATION.md) — `itsm_` 접두사 규칙
- [NOTIFICATION_AND_MESSAGING_SYSTEM.md](../../../platform/design/NOTIFICATION_AND_MESSAGING_SYSTEM.md) — 플랫폼 내장 알림(공지형)과의 차이
- `apps/v-channel-bridge/backend/app/models/account.py` — 암호화 property 패턴 원본
- `apps/v-channel-bridge/backend/app/models/message.py` — 로그 테이블 컬럼 레퍼런스
- `apps/v-channel-bridge/frontend/src/pages/Messages.tsx` — NotificationLogs UI 참고
- `apps/v-channel-bridge/frontend/src/pages/Integrations.tsx` — Integrations UI 참고

---

## 13. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.1 | 2026-04-22 | 초안 — 플랫폼 승격 보류, 4번 요구사항을 `itsm_user_notification_pref` 로 앱 내부화. 포함 5기능(F1~F5), 신규 테이블 5종, API 7계열, 프론트 페이지 7종. |
