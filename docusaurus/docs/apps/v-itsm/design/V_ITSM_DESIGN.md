---
title: v-itsm 설계 문서
description: 업무 루프 관리 시스템 — 접수(VOC) → 분석(사업) → 실행(제품) → 검증(운영) → 답변(고객) 전주기 워크플로우
---

# v-itsm — 업무 루프 관리 시스템 설계

**상태**: Draft v0.2
**작성일**: 2026-04-21 (v0.2: 2026-04-21 고객/제품/계약/SLA티어/ACL 확장)
**작성자**: v-project 팀
**영향 범위**: 새 앱 추가 (`apps/v-itsm`), 공통 알림·AI 채팅 자산 재사용

---

## 1. 목적 & 배경

### 1.1 문제 정의

고객 요구(VOC), 내부 개선 과제, 장애/이슈 등은 접수 채널(Slack/Teams/이메일/전화)과 담당 조직(사업·제품·운영·고객 대응)이 분산되어 있어 **"누가 · 언제 · 어디까지 처리했는지"가 실시간으로 공유되지 않는 문제**가 반복된다. 엑셀·티켓 도구·채팅 로그에 흩어진 상태는 다음을 유발한다.

- **SLA 위반**: 접수 후 초기 응답·해결이 지연되는 티켓을 사전에 감지하지 못함
- **재발성 이슈**: 과거 해결 사례·근본 원인이 축적되지 않아 동일 문제가 반복
- **단절된 피드백 루프**: 고객 답변 이후 "무엇이 얼마나 개선되었는지"를 측정하지 못함

### 1.2 목표

**ITSM(IT Service Management) / ITIL 표준 프로세스**에 기반하여 업무 전주기를 **5단계 루프**로 정의하고, 각 단계의 상태·담당자·SLA·산출물을 하나의 시스템에서 추적한다.

```
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 접수   │ → │ 분석   │ → │ 실행   │ → │ 검증   │ → │ 답변   │
│ (VOC)  │   │ (사업) │   │ (제품) │   │ (운영) │   │ (고객) │
└────────┘   └────────┘   └────────┘   └────────┘   └────────┘
     ↑                                                     │
     └───────────────── 피드백 루프 ───────────────────────┘
```

- **접수 (VOC Intake)**: 다채널 접수를 Ticket ID로 정규화, L1 자동 분류·우선순위 산정
- **분석 (사업)**: 요구 명세화, 영향 범위·ROI 판단, 실행 범위 합의
- **실행 (제품)**: 개발·설정·변경 수행, 변경 기록(Change Log)
- **검증 (운영)**: 릴리스·배포 후 운영 관점 검증, 회귀 확인
- **답변 (고객)**: 고객 응답 + 만족도 수집, 재오픈(re-open) 여부 확인

### 1.3 참조 상용 서비스

| 서비스 | 참고 포인트 | 차별화 |
|---|---|---|
| **ServiceNow** | ITSM 표준 프로세스, SLA 엔진, CMDB | 경량·한국어 특화, 업무 루프 5단계 명시화 |
| **Jira Service Management** | 요청·사고·변경 분리, 큐 기반 배정 | Kanban + AI 채팅으로 담당자 UX 간소화 |
| **Zendesk** | 옴니채널 접수, 매크로 응답 | 내부 협업(분석·실행·검증) 단계를 1급 개념으로 격상 |
| **Freshservice** | SLA 경고·에스컬레이션, KPI 대시보드 | v-channel-bridge 기반 Slack/Teams 양방향 알림 |

### 1.4 기대 효과

- **가시성**: 모든 티켓이 Kanban 보드에서 단계·담당자·SLA 상태를 실시간 노출
- **책임성**: 각 단계 종료 시점에 산출물·의사결정을 Ticket에 귀속시켜 기록
- **학습성**: 해결된 티켓이 Knowledge Base로 축적, AI가 유사 티켓 검색·답변 초안 제공
- **자동화**: 접수·분류·담당자 추천·SLA 경고·답변 초안 작성에 v-ui-builder LLM 파이프라인 재사용

---

## 2. 범위

### 2.1 MVP (Phase 1)

- ✅ Ticket CRUD + 5단계 상태 머신 (Kanban 보드)
- ✅ 다채널 접수: Slack/Teams/이메일 → v-channel-bridge 어댑터로 통합 수신
- ✅ SLA 타이머: Response Time, Resolution Time 관리 + 80%/100% 에스컬레이션
- ✅ AI 채팅(v-ui-builder ChatPane 재사용): 분류 제안, 답변 초안, 유사 티켓 검색
- ✅ 내부 알림: **Slack + Teams** (v-channel-bridge BasePlatformProvider 재사용)
- ✅ KPI 대시보드: SLA 준수율, MTTR, Re-open Rate, 부서별 처리량

### 2.2 제외 (Phase 2+)

- ❌ CMDB(구성 관리 DB) — v-platform의 자산 관리와 통합 필요, 별도 설계
- ❌ 변경 승인 워크플로우(CAB) — 결재 모듈 도입 이후
- ❌ 라이선스·자산 관리(ITAM) — 본 앱 범위 외 (계약 정보는 v0.2 에 기본형 도입)
- ❌ 외부 고객 포털(CSM) — v-platform-portal 연계 검토 후 Phase 3

### 2.3 성공 지표

| 지표 | 목표 (6개월) |
|---|---|
| Critical 티켓 SLA 준수율 | ≥ 95% |
| 평균 해결 시간(MTTR) | 업종 평균 대비 30% 단축 |
| Re-open Rate | ≤ 5% |
| AI 답변 초안 채택률 | ≥ 40% |

---

## 3. 아키텍처

### 3.1 전체 구성

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      v-itsm Frontend (React 18 + Vite, :5182)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Kanban Board │  │ Ticket Detail│  │ SLA Monitor  │  │ KPI Dashboard│  │
│  │ (5 stages)   │  │ + ChatPane   │  │              │  │ (Recharts)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP + SSE
┌────────────────────────────────▼─────────────────────────────────────────┐
│                 v-itsm Backend (FastAPI, :8005)                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────┐ │
│  │ Ticket API │ │ Loop FSM   │ │ SLA Engine │ │ AI Assist  │ │ KPI Svc │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └─────────┘ │
└──────┬───────────────┬──────────────────┬────────────────┬───────────────┘
       │               │                  │                │
       ▼               ▼                  ▼                ▼
┌────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ v-platform │ │ v-channel-     │ │ v-ui-builder   │ │ PostgreSQL 16  │
│ 인증/RBAC  │ │ bridge         │ │ LLM Provider + │ │ Redis 7        │
│ 감사로그   │ │ Slack/Teams/   │ │ ChatPane SSE   │ │                │
│ 조직도     │ │ Email 알림     │ │ 스트리밍       │ │                │
└────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

### 3.2 핵심 컴포넌트

| 컴포넌트 | 역할 | 구현 전략 |
|---|---|---|
| **Loop FSM** | 5단계 상태 전이 규칙 엔진 | Python dataclass + 허용 전이 맵 |
| **SLA Engine** | Response/Resolution Time 타이머, 80%/100% 경고 | APScheduler + Redis TTL |
| **AI Assist** | 분류 제안, 답변 초안, 유사 티켓 검색 | v-ui-builder `BaseLLMProvider` 재사용 |
| **Notification Hub** | 내부/고객 알림 라우팅 | v-channel-bridge `BasePlatformProvider` 어댑터 재사용 |
| **KPI Service** | 집계·요약 쿼리, 캐시 | PostgreSQL 집계 쿼리 + Redis 캐시 (5분) |

---

## 4. 데이터 모델

> 네이밍: snake_case 테이블명, ULID 기본키, `created_at`/`updated_at` 기본 컬럼. 스키마는 v-platform 기본 스키마와 동일 DB 내 `itsm_` 접두 테이블로 격리.

### 4.1 주요 테이블

```sql
-- 4.1.1 티켓 (루프 단위)
itsm_ticket (
  id                ULID PK,
  ticket_no         VARCHAR UNIQUE,    -- 사람이 읽는 번호: ITSM-2026-000123
  title             VARCHAR(200),
  description       TEXT,
  source_channel    VARCHAR,           -- slack | teams | email | web | phone
  source_ref        VARCHAR,           -- 원본 채널 메시지/메일 ID
  priority          VARCHAR,           -- critical | high | normal | low
  category_l1       VARCHAR,           -- AI 자동 분류 1차
  category_l2       VARCHAR,
  current_stage     VARCHAR,           -- intake | analyze | execute | verify | answer | closed
  service_type      VARCHAR(20) NOT NULL DEFAULT 'internal',  -- v0.2: on_premise | saas | internal | partner
  customer_id       VARCHAR(26) FK,    -- v0.2: itsm_customer(id), NULL = 내부고객
  product_id        VARCHAR(26) FK,    -- v0.2: itsm_product(id)
  contract_id       VARCHAR(26) FK,    -- v0.2: itsm_contract(id)
  requester_id      INT,               -- v-platform users (Integer PK)
  current_owner_id  INT,
  sla_policy_id     VARCHAR(26),
  opened_at         TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  reopened_count    INT DEFAULT 0,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ
);
-- v0.2 인덱스: ix_itsm_ticket_service_type, ix_itsm_ticket_customer, ix_itsm_ticket_product

-- 4.1.2 단계 이력 (루프 투명성) — v0.3: 편집/삭제/복원 + 리비전
itsm_loop_transition (
  id                ULID PK,
  ticket_id         ULID FK,
  from_stage        VARCHAR,
  to_stage          VARCHAR,
  action            VARCHAR,            -- advance | reject | on_hold | rollback | reopen | note
  actor_id          INTEGER FK,         -- v-platform users(id) (작성자/소유자)
  note              TEXT,
  artifacts         JSONB,              -- 단계 산출물 링크/요약
  transitioned_at   TIMESTAMPTZ,
  -- v0.3: 편집·삭제·리비전 메타
  deleted_at        TIMESTAMPTZ NULL,   -- soft-delete 시각
  deleted_by        INTEGER FK NULL,    -- users(id)
  last_edited_at    TIMESTAMPTZ NULL,
  last_edited_by    INTEGER FK NULL,    -- users(id)
  edit_count        INTEGER NOT NULL DEFAULT 0,
  head_revision_id  VARCHAR(26) NULL    -- 현재 head 리비전 참조 (되돌리기 시 사용)
);
-- v0.3 인덱스: ix_itsm_loop_transition_actor(actor_id),
--              ix_itsm_loop_transition_deleted(deleted_at) WHERE deleted_at IS NOT NULL

-- 4.1.2.1 전이 리비전 스냅샷 (v0.3 신규)
-- append-only; 각 편집/삭제/복원/되돌리기는 "직전 상태 스냅샷 + 메타" 한 행을 추가한다.
itsm_loop_transition_revision (
  id                  VARCHAR(26) PK,      -- ULID
  transition_id       VARCHAR(26) FK,      -- itsm_loop_transition(id) CASCADE
  revision_no         INTEGER NOT NULL,    -- 전이별 1부터 단조증가
  change_type         VARCHAR(16) NOT NULL, -- create | edit | delete | restore | revert
  snapshot_note       TEXT NULL,           -- before-image note
  snapshot_artifacts  JSONB NULL,          -- before-image artifacts
  changed_by          INTEGER FK NULL,     -- users(id)
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason              TEXT NULL,           -- "오타 수정" 등 편집 사유
  parent_revision_id  VARCHAR(26) NULL,    -- revert 시 원본 리비전 참조
  UNIQUE (transition_id, revision_no)
);
-- 인덱스: ix_itsm_transition_rev_transition(transition_id, changed_at DESC)

-- 4.1.3 SLA 정책 & 타이머
itsm_sla_policy (
  id                ULID PK,
  name              VARCHAR,
  priority          VARCHAR,
  response_minutes  INT,               -- 접수 → 첫 응답
  resolution_minutes INT,              -- 접수 → 해결(답변)
  business_hours    JSONB,
  active            BOOLEAN
);

itsm_sla_timer (
  id              ULID PK,
  ticket_id       ULID FK,
  kind            VARCHAR,             -- response | resolution
  due_at          TIMESTAMPTZ,
  warning_sent_at TIMESTAMPTZ,         -- 80% 경고
  breached_at     TIMESTAMPTZ,         -- 100% 위반(에스컬레이션)
  satisfied_at    TIMESTAMPTZ
);

-- 4.1.4 배정 / 담당자 변경 이력
itsm_assignment (
  id          ULID PK,
  ticket_id   ULID FK,
  owner_id    ULID,
  role        VARCHAR,                 -- primary | reviewer | watcher
  assigned_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ
);

-- 4.1.5 고객 피드백 (답변 후 재오픈/만족도)
itsm_feedback (
  id            ULID PK,
  ticket_id     ULID FK,
  score         INT,                   -- 1..5
  comment       TEXT,
  reopen        BOOLEAN DEFAULT false,
  submitted_at  TIMESTAMPTZ
);

-- 4.1.6 AI 제안 기록 (분류·초안·유사 티켓)
itsm_ai_suggestion (
  id          ULID PK,
  ticket_id   ULID FK,
  kind        VARCHAR,                 -- classify | draft_reply | similar
  prompt_ref  VARCHAR,
  result      JSONB,
  accepted    BOOLEAN,
  created_at  TIMESTAMPTZ
);

-- 4.1.7 KPI 스냅샷 (일/주 단위 집계)
itsm_kpi_snapshot (
  id            ULID PK,
  period_start  DATE,
  period_end    DATE,
  dept_id       ULID,
  sla_met_ratio NUMERIC(5,2),
  mttr_minutes  INT,
  reopen_ratio  NUMERIC(5,2),
  volume        INT,
  created_at    TIMESTAMPTZ
);

-- ────────── v0.2: 고객/제품/계약/SLA 티어/ACL ──────────

-- 4.1.8 고객사 마스터
itsm_customer (
  id            VARCHAR(26) PK,        -- ULID
  code          VARCHAR(50) UNIQUE,    -- ACME, KT 등
  name          VARCHAR(200),
  service_type  VARCHAR(20) NOT NULL,  -- on_premise | saas | internal | partner
  industry      VARCHAR(100),
  status        VARCHAR(20) DEFAULT 'active',  -- active | inactive
  notes         TEXT,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
);

-- 4.1.9 고객 담당자
itsm_customer_contact (
  id           VARCHAR(26) PK,
  customer_id  VARCHAR(26) FK,         -- itsm_customer(id) CASCADE
  name         VARCHAR(100),
  email        VARCHAR(200),
  phone        VARCHAR(50),
  role_title   VARCHAR(100),
  is_primary   BOOLEAN DEFAULT false,
  notes        TEXT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
);

-- 4.1.10 제품 카탈로그
itsm_product (
  id          VARCHAR(26) PK,
  code        VARCHAR(50) UNIQUE,      -- V-ITSM, V-PORTAL
  name        VARCHAR(200),
  description TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
);

-- 4.1.11 SLA 등급 (계약 연계)
itsm_sla_tier (
  id               VARCHAR(26) PK,
  code             VARCHAR(30) UNIQUE, -- PLATINUM | GOLD | SILVER | BRONZE
  name             VARCHAR(100),
  description      TEXT,
  priority_matrix  JSONB NOT NULL,     -- {"critical":{"response":15,"resolution":240},…}
  business_hours   JSONB,              -- NULL = 24/7
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
);

-- 4.1.12 계약
itsm_contract (
  id           VARCHAR(26) PK,
  contract_no  VARCHAR(50) UNIQUE,
  customer_id  VARCHAR(26) FK,         -- itsm_customer(id)
  name         VARCHAR(200),
  start_date   DATE,
  end_date     DATE,
  sla_tier_id  VARCHAR(26) FK,         -- itsm_sla_tier(id)
  status       VARCHAR(20) DEFAULT 'active',  -- active | expired | terminated
  notes        TEXT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
);

-- 4.1.13 계약-제품 다대다
itsm_contract_product (
  contract_id  VARCHAR(26) FK,         -- CASCADE
  product_id   VARCHAR(26) FK,
  PRIMARY KEY (contract_id, product_id)
);

-- 4.1.14 권한그룹 접근범위 (ACL)
-- (permission_group_id, service_type?, customer_id?, product_id?) 튜플 — NULL = 와일드카드
itsm_scope_grant (
  id                    VARCHAR(26) PK,
  permission_group_id   INTEGER FK,    -- permission_groups(id) CASCADE
  service_type          VARCHAR(20) NULL,
  customer_id           VARCHAR(26) NULL FK,
  product_id            VARCHAR(26) NULL FK,
  scope_level           VARCHAR(10) NOT NULL,  -- read | write
  granted_by            INTEGER FK,    -- users(id)
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  UNIQUE (permission_group_id, service_type, customer_id, product_id)
);
```

### 4.2 상태 머신 (Loop FSM)

```
intake ──────► analyze ──────► execute ──────► verify ──────► answer ──────► closed
  ▲              │                │                │              │
  │              ▼                ▼                ▼              ▼
  └────────── reject         on_hold           rollback       reopen (from feedback)
```

- **허용 전이**는 단일 테이블(또는 Python `TRANSITIONS: dict`)로 선언적으로 관리
- 모든 전이는 `itsm_loop_transition`에 기록(누가·언제·이유·산출물)
- `reopen`: 고객 피드백 `reopen=true` 수신 시 `answer → analyze`로 재진입, `reopened_count++`

### 4.3 스코프 기반 접근제어 (ACL, v0.2)

v-itsm 은 **플랫폼 PermissionGroup(정수 PK)** 을 FK 로 재사용하고, 새 역할 체계를 도입하지 않는다. 모든 접근 판정은 `itsm_scope_grant` 한 테이블로 수렴한다.

#### 4.3.1 평가 규칙

1. 요청자의 `User.role == SYSTEM_ADMIN` → **전권**, 스코프 체크 생략.
2. 그 외: 사용자의 `UserGroupMembership` → 속한 권한그룹들의 `itsm_scope_grant` 로우 **union** 을 사용자 스코프로 계산.
3. 티켓 접근 판정: 티켓의 `(service_type, customer_id, product_id)` 가 union 중 **한 행이라도** 매칭되면 허용 (NULL = 와일드카드).
4. `scope_level`: `read` = 조회 가능, `write` = 조회·생성·수정·전이 가능.
5. **접수 시 검증**: intake 의 `(service_type, customer_id, product_id)` 에 대해 요청자가 `write` 스코프를 가져야 함.

#### 4.3.2 쿼리 주입 (post-filter 금지)

목록 API(`GET /api/tickets`)는 계산된 스코프를 **WHERE 절로 변환** 하여 DB 단계에서 필터링한다. 애플리케이션 레벨 post-filter 는 페이지네이션과 합쳤을 때 일관성이 깨지므로 금지.

```sql
-- 예: 사용자가 (service_type=on_premise, customer_id=C1) + (service_type=internal, customer/product=NULL) 두 grant 를 보유
SELECT * FROM itsm_ticket t
WHERE (t.service_type = 'on_premise' AND t.customer_id = 'C1')
   OR (t.service_type = 'internal')
```

권한그룹 수 × grant 수 증가 시에는 `EXISTS (SELECT 1 FROM itsm_scope_grant sg JOIN user_group_membership m ON … WHERE (sg.service_type IS NULL OR sg.service_type = t.service_type) AND …)` 형태로 변환해 인덱스를 활용한다.

#### 4.3.3 특수 케이스

- **내부고객 (`service_type=internal`)**: `customer_id`/`product_id`/`contract_id` NULL 허용. Grant 는 `(service_type='internal', NULL, NULL)` 단일 로우로 부여.
- **권한그룹 미소속 사용자**: 스코프 union 이 공집합 → 목록 빈 응답, 개별 조회 403. 정책: **명시적 거부가 기본**, SYSTEM_ADMIN 이 부여해야 함.
- **`admin` scope_level 미도입**: 시스템관리자 판별은 `User.role` 로 수행하므로 scope 단에서 별도 관리자 레벨은 불필요.

### 4.4 전이 편집 정책 (v0.3)

Loop 전이 이력(`itsm_loop_transition`)은 더 이상 순수 append-only 가 아니라 **작성자 소유 + 리비전 보존 + 복원 가능** 한 편집 객체다. 상세 설계는 `LOOP_TRANSITION_EDITING_DESIGN.md` 참조.

#### 4.4.1 편집 가능 범위

- **편집 가능**: `note`, `artifacts`
- **편집 불가 (영구 불변)**: `from_stage`, `to_stage`, `action`, `actor_id`, `transitioned_at`, `ticket_id`, `id`
- 이유: 스테이지 이동은 FSM 무결성, action/actor 는 감사 무력화 방지.

#### 4.4.2 권한 모델

1. **작성자 본인** (`transition.actor_id == current_user.id`) 은 자신의 전이를 편집/삭제/복원 가능.
2. **SYSTEM_ADMIN** 은 모든 전이에 대해 편집/삭제/복원 가능 + `?include_deleted=true` 로 숨김 이력 조회.
3. 그 외 사용자는 편집 불가 (403). 읽기 접근은 §4.3 스코프 규칙에 따름.
4. **편집 시간 창**: 환경변수 `ITSM_TRANSITION_EDIT_WINDOW_MINUTES` 로 제한(기본 `0` = 무제한, 양수면 해당 분 이내만, 음수면 전면 차단). SYSTEM_ADMIN 은 우회.

#### 4.4.3 리비전 체인

- 전이 생성 시 `revision_no=1, change_type='create', snapshot_*=현재값` 을 자동 기록.
- 편집(`PATCH`) / 삭제(`DELETE`) / 복원(`POST /restore`) / 되돌리기(`POST /revisions/{no}/revert`) 는 각각 **편집 직전 상태의 before-image** 를 새 리비전으로 기록한 뒤 본체를 UPDATE.
- 스모크 검증: 한 전이에 대해 create → edit → delete → restore → revert 5건 리비전이 단조 증가(1→2→3→4→5)로 누적됨을 확인.
- Soft-delete 는 `deleted_at` 만 설정(삭제되지 않음). 복원은 `deleted_at = NULL` 복귀 + 별도 리비전 기록.
- Revert 는 지정한 `revision_no` 의 `snapshot_note/artifacts` 를 본체에 적용하고 `change_type='revert'` 리비전을 `parent_revision_id` 로 원본을 가리킨 채 추가.

#### 4.4.4 API 개요

| 메서드 | 경로 | 설명 |
|---|---|---|
| PATCH | `/api/tickets/{tid}/transitions/{rid}` | note/artifacts 편집 (+ reason) |
| DELETE | `/api/tickets/{tid}/transitions/{rid}` | soft-delete |
| POST | `/api/tickets/{tid}/transitions/{rid}/restore` | 삭제 해제 |
| GET | `/api/tickets/{tid}/transitions/{rid}/revisions` | 리비전 목록 |
| POST | `/api/tickets/{tid}/transitions/{rid}/revisions/{no}/revert` | 해당 리비전으로 복원 |
| GET | `/api/tickets/{tid}/transitions?include_deleted=true` | 숨김 포함 조회 (작성자/SYSTEM_ADMIN) |

응답에는 서버 계산된 UI 플래그(`can_edit`, `can_delete`, `can_restore`)가 포함되어 프런트엔드는 추가 권한 계산 없이 버튼 표시를 결정한다.

#### 4.4.5 CSRF 및 감사

- 모든 쓰기 경로는 v-platform Double Submit Cookie CSRF 미들웨어 하에서 동작. 프런트는 `csrf_token` 쿠키를 `X-CSRF-Token` 헤더로 재전송.
- 감사 이중 기록: 리비전 테이블(로컬) + v-platform `audit_log`(`action=transition.edit|delete|restore|revert`, `entity_type="itsm_loop_transition"`). 로컬은 UI 렌더용, audit 는 통합 감사 조회용.

#### 4.4.6 프런트엔드 구성

- `@v-platform/core` **Drawer** 컴포넌트(신규) 를 채택해 넓은 편집 영역 제공 (size md/lg/xl/full). 기존 Modal 은 유지, Drawer 는 추가 only.
- 전이 이력 카드에 `편집 / 삭제 / 이력 / 복원` 버튼을 서버 플래그 기반으로 노출.
- `TransitionEditDrawer` (Drawer + RichEditor), `TransitionRevisionsDialog` (Modal + MarkdownView) 컴포넌트를 v-itsm 전용으로 구현.

---

## 5. 5단계 루프 상세

### 5.1 접수 (VOC Intake)

**입력 채널**: Slack 멘션/DM, Teams 카드/채널, 이메일(IMAP), 웹 폼, 전화(수기 등록)

**자동 처리**:
1. v-channel-bridge 어댑터가 수신 이벤트를 **CommonMessage**로 정규화
2. `POST /api/tickets/intake` — Ticket 생성, `ticket_no` 발급
3. AI 분류기(`BaseLLMProvider`)가 `category_l1` + `priority` 제안
4. SLA Policy 매칭 → `itsm_sla_timer` 2건 생성(response/resolution)
5. 담당자 추천(조직도 + 과거 유사 티켓 해결자)

**산출물**: `Ticket` (stage=intake), AI 분류 제안, SLA 타이머

### 5.2 분석 (사업)

**담당**: 사업/기획, 필요 시 제품 PO 합류
**과업**: 요구 명세화, 비즈니스 영향(매출·리스크)·공수 산정, 실행 여부 의사결정
**전이**: `analyze → execute`(승인) / `analyze → closed`(반려, 사유 필수)
**산출물**: 요구사항 메모, ROI 근거, 실행 범위 스펙

### 5.3 실행 (제품)

**담당**: 제품/개발팀
**과업**: 개발·설정 변경·배포 준비
**연계**: Git 연동(선택) — 커밋/PR 링크를 `artifacts`에 첨부
**전이**: `execute → verify`(완료) / `execute → analyze`(스펙 재검토 필요)

### 5.4 검증 (운영)

**담당**: 운영/QA
**과업**: 스테이징 검증, 회귀 확인, 모니터링 대시보드 확인
**전이**: `verify → answer`(합격) / `verify → execute`(회귀/결함 발견, rollback)

### 5.5 답변 (고객)

**담당**: 고객 대응(또는 최초 접수자)
**과업**: AI 초안 → 담당자 검수 → 고객 회신(접수 채널과 동일)
**피드백**: 답변 후 만족도 요청(Slack/Teams 카드 또는 이메일 링크)
**전이**: `answer → closed`(정상) / `answer → analyze`(재오픈)

---

## 6. SLA & 에스컬레이션

### 6.1 2단 구조 (v0.2)

v-itsm 의 SLA 는 **계약 수준의 티어** + **카테고리 예외 정책** 2 단으로 결정한다.

| 단계 | 테이블 | 역할 |
|---|---|---|
| ① 티어 (기본) | `itsm_sla_tier` | 계약(`itsm_contract.sla_tier_id`) 에 연결되는 등급. `priority_matrix` JSONB 로 priority별 response/resolution 분을 선언 |
| ② 정책 (예외) | `itsm_sla_policy` | 특정 (priority, category) 조합에 대한 오버라이드. 티어 값을 덮어씀 |
| ③ 코드 하드코딩 | `sla_timer._DEFAULT_POLICY_MINUTES` | 최종 fallback. 계약·정책 모두 없을 때 |

#### 6.1.1 타이머 산출 순서

접수 시 `sla_timer.create_timers()` 는 다음 우선순위로 response/resolution 분을 결정한다:

```
1. ticket.contract → sla_tier.priority_matrix[priority]       ← 계약 기반 티어 (1차)
2. itsm_sla_policy (priority, category) 매칭 active 로우       ← 카테고리 예외 (오버라이드)
3. _DEFAULT_POLICY_MINUTES[priority]                          ← 코드 fallback
```

#### 6.1.2 티어 예시

| Tier | Critical | High | Normal | Low |
|---|---|---|---|---|
| **PLATINUM** | 15분 / 4시간 | 30분 / 8시간 | 2시간 / 1 영업일 | 4시간 / 3 영업일 |
| **GOLD** | 30분 / 4시간 | 1시간 / 1 영업일 | 4시간 / 3 영업일 | 1 영업일 / 5 영업일 |
| **SILVER** | 1시간 / 8시간 | 2시간 / 1 영업일 | 4시간 / 3 영업일 | 1 영업일 / 5 영업일 |
| **BRONZE** | 2시간 / 1 영업일 | 4시간 / 2 영업일 | 8시간 / 5 영업일 | 2 영업일 / 10 영업일 |

> 실제 수치는 시드 스크립트(`a004`)에서 관리. 고객별 커스텀 티어는 `itsm_sla_tier` 로우 추가로 대응 (enum 아님).

### 6.2 에스컬레이션 규칙

- **80% 경과**: 담당자 + 팀 리드에게 Slack/Teams 경고
- **100% 초과**: 부서장 + Critical의 경우 CTO 채널로 에스컬레이션, `itsm_sla_timer.breached_at` 기록
- **영업시간/공휴일** 고려: 티어의 `business_hours` JSON (NULL = 24/7) 반영. Phase 1 MVP 는 24/7 계산, 영업시간 엔진은 Phase 3

### 6.3 구현

- **스케줄러**: APScheduler가 1분 주기로 타이머 테이블을 스캔
- **캐싱**: 임박 티켓(due_at - now < 30분)만 Redis ZSET에 저장하여 부하 최소화
- **멱등성**: 경고/에스컬레이션 발송은 `warning_sent_at`/`breached_at` 컬럼으로 중복 방지

---

## 7. 알림 전략

### 7.1 채널

| 용도 | 채널 | 구현 |
|---|---|---|
| 내부 담당자 알림 | **Slack + Teams** | v-itsm 내장 `BaseOutboundProvider` (Slack/Teams) |
| 고객 회신 | 접수 채널과 동일(Slack/Teams/Email) | 동일 — Phase 2 접수 경로와 함께 확장 |
| SLA 경고/에스컬레이션 | Slack + Teams (DM/채널) | 동일 |
| 일일 요약 | Email | v-platform MailHog/실제 SMTP |

> **주의**: PDF 원본 제안서에는 "Slack/Jandi"가 언급되었으나, Slack/Teams 어댑터 자산이 이미 v-channel-bridge 에 존재하므로 **Jandi 대신 Teams를 채택**한다. 다만 v0.5 이후 v-itsm 은 브리지의 HTTP 어댑터에 의존하지 않고 **provider 코드를 앱 내부로 포팅(embedded)** 하여 독립적으로 기동한다 (§7.3 참조).

### 7.2 이벤트 → 알림 매핑

| 이벤트 | 수신자 | 채널 |
|---|---|---|
| 티켓 접수 | 자동 배정 담당자 | Slack/Teams DM |
| 단계 전이 | 이전/다음 담당자 | Slack/Teams DM |
| SLA 80% | 담당자 + 팀 리드 | Slack/Teams 채널 + DM |
| SLA 100% | 부서장 (+ CTO — Critical) | Slack/Teams 에스컬레이션 채널 |
| 재오픈 | 최근 담당자 + 사업 분석자 | Slack/Teams DM |

### 7.3 알림 전송 경로 (v0.5 — embedded provider, 구현 완료)

**설계 원칙 전환** (v0.4 → v0.5): 앱 간 런타임 HTTP 의존을 제거한다. v-channel-bridge 가 정지해도 v-itsm 알림은 독립적으로 동작해야 한다. 코드 중복은 감수하고, bridge 에서 **outbound 경로만** 골라서 v-itsm 내부로 포팅했다. bridge 자체는 수정하지 않는다.

**흐름**: `v-itsm (hook)` → `notification_service._dispatch_all()` → `provider_registry` → `SlackOutboundProvider.send_message()` / `TeamsOutboundProvider.send_message()` → Slack Web API / MS Graph (or Power Automate webhook fallback)

**v-itsm 측 구성**:

```
apps/v-itsm/backend/app/
├── schemas/common_message.py         ← bridge schemas/common_message.py 에서 포팅
└── providers/
    ├── base.py                       ← BaseOutboundProvider 추상 (connect/send_message/transform_from_common)
    ├── registry.py                   ← _ProviderRegistry 싱글톤 + init_providers_from_env()
    ├── slack_provider.py             ← slack_sdk AsyncWebClient (outbound chat_postMessage 만)
    └── teams_provider.py             ← aiohttp + Graph OAuth client_credentials + Power Automate webhook 대체 경로
```

**포팅 매트릭스**:

| 원본 (v-channel-bridge) | v-itsm 포팅 | 비고 |
|---|---|---|
| `providers/base.py::BasePlatformProvider` | `providers/base.py::BaseOutboundProvider` | 수신/대화 관리 메서드 삭제, outbound 전용으로 축약 |
| `providers/slack_provider.py` | `providers/slack_provider.py` | slack_bolt/SocketMode 제거, `AsyncWebClient.chat_postMessage` 만 유지 |
| `providers/teams_provider.py` | `providers/teams_provider.py` | Graph OAuth + webhook fallback 은 그대로. Activity Feed subscription 삭제 |
| `schemas/common_message.py` | `schemas/common_message.py` | enum(Platform/MessageType/ChannelType), User, Channel, CommonMessage 그대로 |

**서비스 배선**: `app/services/notification_service.py`
- 공개 API 는 **sync** — `send_notification/notify_assignment/notify_transition/notify_sla_warning/notify_sla_breach`. 호출부(ticket_service, sla_timer) 기존 코드 변경 없음.
- 내부적으로 `_fire_and_forget()` 가 FastAPI async 컨텍스트면 `asyncio.get_running_loop().create_task()`, APScheduler sync job 이면 `threading.Thread(target=asyncio.run, daemon=True)` 로 비동기 전송을 스케줄.
- 실패는 **fail-open** — `try/except Exception` 으로 삼켜서 structlog WARN 만 남긴다. 티켓 트랜잭션/커밋에 영향 없음 (훅은 post-commit).

**Provider 라이프사이클**: `app/main.py` lifespan
- 시동: `await init_providers_from_env()` — `SLACK_BOT_TOKEN`/`TEAMS_TENANT_ID/APP_ID/APP_PASSWORD/TEAM_ID`/`TEAMS_NOTIFICATION_URL` 을 읽어 각 provider 인스턴스를 `connect()` 후 레지스트리 등록. env 누락은 fail-open (info 로그만, 해당 채널은 silently skip).
- 종료: `await shutdown_providers()` — 각 provider `disconnect()` 호출 (Graph 토큰 세션 정리, Slack client 종료).

**훅 지점 (3개, 변경 없음)**:
- `ticket_service.update()` — `current_owner_id` 변경 시 `notify_assignment()`
- `ticket_service.transition()` — Loop FSM 전이 후 `notify_transition()`
- `sla_timer._notify_warning()` / `_notify_breach()` — SLA 80%/100% 감지 시

**채널 해상**: `ITSM_DEFAULT_NOTIFY_CHANNELS` 환경변수 — comma-separated `platform:channel_id` 형식 (예: `slack:C0123,teams:19:xxx@thread.tacv2`). 장기적으로는 부서/담당자별 설정 테이블로 이관 (Phase 2).

**환경변수 분리**:

| 위치 | 변수 | 용도 |
|---|---|---|
| 루트 `.env` | `TEAMS_TENANT_ID`, `TEAMS_APP_ID`, `TEAMS_APP_PASSWORD` | SSO 와 공용 Graph 자격증명 |
| `apps/v-itsm/.env` | `SLACK_BOT_TOKEN` | Slack Bot OAuth (xoxb-…) |
| `apps/v-itsm/.env` | `TEAMS_TEAM_ID` | Graph 발송 대상 팀 ID |
| `apps/v-itsm/.env` | `TEAMS_NOTIFICATION_URL` | Power Automate webhook (Graph 미승인 환경용 fallback) |
| `apps/v-itsm/.env` | `ITSM_DEFAULT_NOTIFY_CHANNELS` | 기본 채널 리스트 |

docker-compose 에서 `apps/v-itsm/.env` 는 `env_file: - apps/v-itsm/.env` 로 주입. 루트 `.env` 는 compose `${VAR}` 치환 + 공용 변수 전용.

**v-channel-bridge 측 변경 없음**: `POST /api/bridge/notify` 엔드포인트는 **도입되지 않았다**. bridge 코드는 v0.4 초안에서 제안된 변경을 원복한 상태로 유지된다.

### 7.4 접수 경로 (Slack/Teams → v-itsm) — 설계 스텁 (Phase 1 후반)

**목표**: 사용자가 Slack/Teams 에서 자연어 혹은 슬래시 커맨드로 요청을 올리면, 브리지가 v-itsm 접수 API 를 호출해 티켓을 자동 생성.

**후보 안 A — 슬래시 커맨드 `/ticket`** (우선 채택):
- 사용자가 `/ticket <제목> | <본문>` 형식 입력 → 브리지 `command_processor` 가 수신 → `POST /api/tickets/intake` 호출.
- 본문 첨부(파일·링크)는 `source_ref` 에 원본 메시지 ts/id 저장 → v-itsm 에서 역링크 생성.
- 요청자(user) 매핑: Slack user_id/Teams aad_id ↔ `users.external_ids` (플랫폼 공용 매핑 테이블. 없으면 요청자 미기록 + `notes` 에 원본 표시).

**후보 안 B — 멘션 기반 자동 접수**:
- 특정 채널에서 봇 멘션 시 본문 전체를 티켓 본문으로 승격. 담당자 자동 배정은 카테고리 분류 AI(§8.2) 이후 도입.
- Phase 1 에서는 스팸·노이즈 위험으로 스코프 아웃, Phase 2 에서 AI 분류와 함께 활성화.

**인증/신뢰 경계**:
- 브리지 → v-itsm 호출은 **service-account JWT**(플랫폼 공용 발급 토큰) 또는 **`ITSM_INTAKE_WEBHOOK_SECRET` HMAC 헤더** 중 택일.
  - JWT 쪽이 기존 `require_permission` 재사용 가능 → 우선 고려.
  - HMAC 은 공용 IdP 없이 구성 가능하지만 v-itsm 이 전용 검증 미들웨어를 추가해야 함.
- CORS/네트워크: 내부 Docker 네트워크 전용, 외부 노출 없음.

**구현 위치(예정)**:
- 브리지: `apps/v-channel-bridge/backend/app/services/command_processor.py` — `/ticket` 핸들러 등록
- 브리지: `apps/v-channel-bridge/backend/app/services/itsm_client.py` (신규) — v-itsm HTTP 호출 래퍼
- v-itsm: 기존 `POST /api/tickets/intake` 재사용. service-account 토큰 검증은 플랫폼 레벨에서 처리(앱 수정 불필요 예상).

**본 설계 범위**: 본 섹션은 Phase 1 후반 착수를 위한 **설계 스텁**. 코드 변경은 다음 사이클에서 별도 PR 로 진행.

---

## 8. AI 통합 (v-ui-builder 재사용)

### 8.1 재사용 범위

- **프론트**: `apps/v-ui-builder/frontend/src/components/builder/ChatPane.tsx` 컴포넌트와 `useChatStream` 훅을 `@v/ui-builder-chat` 형태로 분리하거나 소스 복제 후 v-itsm용 어댑터만 교체
- **백엔드**: `BaseLLMProvider` 추상화 + SSE 스트리밍 엔드포인트 재활용, 프롬프트 템플릿만 ITSM 도메인으로 교체

### 8.2 AI 기능

| 기능 | 입력 | 출력 | 채택 UX |
|---|---|---|---|
| **자동 분류** | 제목 + 본문 + 첨부 요약 | `category_l1/l2` + `priority` 제안 | 접수 직후 배너로 노출, 담당자 원클릭 수락 |
| **유사 티켓 검색** | 본문 임베딩 | 과거 티켓 상위 5건 + 해결 요약 | Ticket Detail 사이드바 |
| **답변 초안** | 티켓 전체 스레드 | 고객 응답 초안(말투·서명 포함) | Answer 단계에서 ChatPane 우측 패널 |
| **해결 요약** | 전체 루프 이력 | Closed 시 Knowledge Base 엔트리 | `closed` 전이 시 자동 생성 |

### 8.3 감사·안전

- 모든 AI 호출은 `itsm_ai_suggestion`에 기록(프롬프트 참조, 결과, 채택 여부)
- PII 필터: 고객 이메일/연락처는 임베딩 전 마스킹
- 초안은 항상 **담당자 검수 후 발송** — 자동 발송 없음

---

## 9. KPI & 대시보드

### 9.1 핵심 KPI

| KPI | 정의 | 갱신 주기 |
|---|---|---|
| **SLA 준수율** | (SLA 만족 티켓 수 / 전체 티켓 수) × 100 | 일 단위 스냅샷 |
| **MTTR** | 평균 해결 시간(분) | 일 단위 |
| **Re-open Rate** | (재오픈 티켓 수 / 종료 티켓 수) × 100 | 주 단위 |
| **부서별 처리량** | 부서별 종료 티켓 수 + 평균 체류 시간 | 주 단위 |
| **AI 채택률** | 채택된 AI 제안 수 / 제안 수 | 주 단위 |

### 9.2 대시보드 구성

- **관제 탭**: Kanban 전체 + SLA 임박/위반 하이라이트
- **경영 탭**: KPI 카드(일/주/월), Recharts 라인/막대 차트
- **부서 탭**: 부서별 처리량·MTTR 비교, 담당자 Top N

---

## 10. Phase별 로드맵

| Phase | 기간(가안) | 산출물 |
|---|---|---|
| **Phase 0** | 1주 | 본 설계 문서, `apps/v-itsm` 스캐폴드(template 복제), Docker profile `itsm` 추가 |
| **Phase 1 (MVP)** | 6주 | Ticket CRUD, 5단계 FSM, Slack/Teams 접수·알림, 기본 SLA 타이머, Kanban, 기본 KPI |
| **Phase 2** | 4주 | AI 분류·답변 초안·유사 티켓 검색, 에스컬레이션 정책 UI, 피드백 수집 |
| **Phase 3** | 4주 | 이메일 접수, 영업시간/공휴일 정책, 부서별 KPI, Knowledge Base 자동화 |
| **Phase 4+** | — | CMDB 연계, 변경 승인(CAB), 고객 포털(v-platform-portal 연계) |

---

## 11. 기술 스택 & 포트 할당

### 11.1 스택

- **Backend**: Python 3.11 / FastAPI / Pydantic v2 / SQLAlchemy 2.x / Alembic / APScheduler / Structlog
- **Frontend**: React 18 / TypeScript 5 / Vite / Tailwind / Zustand / TanStack Query / Recharts / Lucide / Pretendard
- **DB**: PostgreSQL 16 (공용 DB, `itsm_` 접두 테이블로 격리) — `postgresql://vmsuser:vmspassword@postgres:5432/v_project`
- **Cache/Queue**: Redis 7 — `redis://:redispassword@redis:6379/0` (SLA 타이머 ZSET, KPI 캐시)
- **AI**: v-ui-builder `BaseLLMProvider`(OpenAI 기본) 재사용

### 11.2 포트 & Docker profile

| 항목 | 값 |
|---|---|
| Backend 포트 | **8005** |
| Frontend 포트 | **5182** |
| Docker profile | `itsm` |
| 기동 명령 | `docker compose --profile itsm up -d --build` |

> 기존 루트 `CLAUDE.md` 포트 테이블에 v-itsm 2행을 추가해야 한다.

### 11.3 스코프 문서

- `apps/v-itsm/CLAUDE.md` — 8-섹션 템플릿(스코프 마커 `<!-- scope: app:v-itsm -->`)으로 작성
- `apps/v-itsm/.env.example` — (Phase 0 단계, 현재 비움)
- 본 설계 문서(`docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md`)

---

## 12. 재사용 자산 매트릭스

| 자산 | 출처 | v-itsm 활용 | 재사용 전략 |
|---|---|---|---|
| **인증/RBAC** | v-platform `platform/auth`, `platform/rbac` | 티켓 조회·배정 권한 | 의존성 주입, 변경 없음 |
| **감사로그** | v-platform `platform/audit` | 모든 전이·배정·AI 수락 감사 | `app_id='v-itsm'` 태깅 |
| **조직도/부서** | v-platform `platform/org` | 담당자 추천, 부서별 KPI | Read-only 조회 |
| **UI Kit** | `platform/ui` (65+ 컴포넌트) | Kanban, Form, Modal, Toast | 동일 디자인 토큰 |
| **Provider Pattern** | v-channel-bridge `BasePlatformProvider` + Slack/Teams 어댑터 | 접수·알림·회신 | **outbound 경로만 v-itsm 내부로 포팅(copy-not-import)** — 런타임 HTTP 의존 제거, bridge 정지와 무관하게 동작 |
| **ChatPane + SSE** | v-ui-builder `components/builder/ChatPane.tsx`, `useChatStream` | AI 분류/초안/유사검색 UI | 공통 패키지 분리 또는 소스 복제 |
| **BaseLLMProvider** | v-ui-builder `backend/llm/base.py` | 프롬프트 템플릿 교체 | 동일 SSE 인터페이스 |
| **Notification/Event Broadcaster** | v-platform `platform/notifications` | 앱 내 실시간 브로드캐스트 | 이벤트 타입 `itsm.*` 추가 |
| **Recharts 차트 패턴** | 각 앱 대시보드 | KPI 카드/차트 | 동일 토큰/커스텀 툴팁 |

> **비개발 원칙**: 플랫폼 공용 자산은 변경하지 않고 **v-itsm 어댑터/라우팅만 신규**한다. 공용 자산 변경이 필요하면 별도 PR로 분리.

---

## 13. 리스크 & 오픈 이슈

| 항목 | 리스크 | 완화책 |
|---|---|---|
| SLA 타이머 정확도 | 영업시간·공휴일 규칙 복잡도 | Phase 1은 24/7 단순 정책, Phase 3에서 정책 엔진 도입 |
| AI 오분류 | 초기 데이터 부족 | 규칙 기반 우선순위 + AI 제안 병행, 학습 데이터 축적 후 비중 확대 |
| ChatPane 공용화 | v-ui-builder와 결합도 | Phase 1은 소스 복제, Phase 2에 `@v/ui-chat` 공용 패키지 추출 검토 |
| 알림 과다 | 담당자 피로 | 사용자별 알림 설정(DM/채널/무음) + 배치 요약 |
| 기존 테이블 충돌 | 공용 DB 내 네이밍 | `itsm_` 접두 고정, 마이그레이션 리뷰 필수 |

---

## 14. 변경 이력

| 날짜 | 버전 | 변경 |
|---|---|---|
| 2026-04-21 | v0.1 | 초안 작성(5단계 루프, 재사용 자산 매트릭스, Phase 로드맵, Slack+Teams 알림 채택 — Jandi 대체) |
| 2026-04-21 | v0.2 | 고객/제품/계약/SLA티어/ACL 확장: §4.1.8~§4.1.14 7개 테이블 추가, `itsm_ticket` 에 `service_type`/`customer_id`/`product_id`/`contract_id` 4 컬럼, §4.3 스코프 기반 ACL 신설, §6 SLA 2단 구조(티어+정책) 개편, §2.2 에서 계약 제외 해제. 증분 마이그레이션 a004 로 구현 |
| 2026-04-22 | v0.3 | Loop 전이 이력 편집·삭제·복원·리비전 도입: `itsm_loop_transition` 에 6 컬럼 추가(`deleted_at`/`deleted_by`/`last_edited_at`/`last_edited_by`/`edit_count`/`head_revision_id`), `itsm_loop_transition_revision` 신규 테이블, §4.4 "전이 편집 정책" 신설. `@v-platform/core` Drawer 컴포넌트 승격(Modal 과 별도). 증분 마이그레이션 a010. 상세 설계: `LOOP_TRANSITION_EDITING_DESIGN.md` v1.0 |
| 2026-04-22 | v0.4 | Slack/Teams 알림 경로 1차 시도 — HTTP 커플링. v-itsm `notification_service` → `POST /api/bridge/notify` → bridge Provider. 사용자 코스 코렉션으로 **전면 원복**: "v-channel-bridge 수정하지 말고, 필요 부분을 v-itsm 로 가져와서 독립 동작하게." bridge 변경분 `git checkout HEAD --` 되돌림. 본 항목은 기록만 유지하고 §7.3 의 "현재 구현"은 v0.5 에서 대체됨. |
| 2026-04-22 | v0.5 | Slack/Teams 알림 경로 재구현 — **embedded provider 패턴**. bridge 의 `BasePlatformProvider`/`SlackProvider`/`TeamsProvider`/`CommonMessage` 에서 **outbound 경로만** `apps/v-itsm/backend/app/providers/` 와 `app/schemas/common_message.py` 로 포팅(slack_bolt/SocketMode·수신 대화 관리 제거). v-itsm lifespan 에서 `init_providers_from_env()` 로 연결, `notification_service` 는 sync 공개 API + `_fire_and_forget` 로 async bridging. 환경변수: `SLACK_BOT_TOKEN`/`TEAMS_TEAM_ID`/`TEAMS_NOTIFICATION_URL`/`ITSM_DEFAULT_NOTIFY_CHANNELS` 은 `apps/v-itsm/.env`, `TEAMS_TENANT_ID/APP_ID/APP_PASSWORD` 는 루트 `.env` 공용. 의존성: `slack-sdk>=3.27.0` 추가. bridge 완전 무변경. §7.1/§7.3/§12 업데이트. |
