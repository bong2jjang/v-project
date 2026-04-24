# v-itsm 워크스페이스 설계

**버전**: v0.7 (URL 평탄화 — 전역 WS 컨텍스트 UX 전환)
**작성일**: 2026-04-23 (초안 v0.1) · **갱신**: 2026-04-24 (v0.7)
**상태**: W6/W8 완료 — W9 착수(프론트 URL 평탄화 + 전역 WS 컨텍스트). 백엔드 `/api/ws/{workspace_id}/*` 계약은 불변

> **v0.7 변경 요약**: "페이지마다 WS 를 다시 고르는" UX 에서 "한 번 고른 WS 가 전 페이지에 적용되는 전역 컨텍스트" UX 로 전환. 프론트 URL 에서 `:wid` 제거(`/ws/:wid/kanban` → `/kanban`), store 의 `currentWorkspaceId` 를 유일한 진실의 원천으로 삼는다. 백엔드 URL 은 그대로.

---

## 1. 개요 및 배경

### 1.1 도입 목적

v-itsm은 현재 단일 조직(전사) 단위로 모든 티켓과 SLA를 공유한다. 조직이 성장하거나 복수의 팀·사업부가 독립적인 업무 프로세스를 필요로 하는 경우, **데이터 격리 없이는 다음 문제가 발생**한다.

- 팀 A의 Kanban과 SLA 정책이 팀 B에 노출됨
- KPI 대시보드가 전사 혼합 수치를 보여줌
- 담당자 할당 가능 인원 범위가 전사로 열림

**워크스페이스**(Workspace)는 이 격리 단위다. 티켓·SLA·Kanban·KPI·담당자가 모두 워크스페이스 경계 안에서 동작한다.

### 1.2 핵심 원칙

| 원칙 | 내용 |
|---|---|
| 기본 격리 | 워크스페이스 간 티켓·설정은 기본적으로 비노출 |
| Default 워크스페이스 | 모든 사용자는 하나의 Default WS를 가지며, 로그인 시 자동 진입 |
| 권한 기반 전환 | 멤버로 등록된 WS만 전환 가능 |
| 플랫폼 연계 | 플랫폼 RBAC의 `department`/`group` 과 연계하여 자동 멤버십 가능 (추후 §7 D4) |

### 1.3 스코프 판단 — v-itsm 앱 내부에서 시작하는 이유

루트 CLAUDE.md 의 "플랫폼 승격 판단" 체크 결과, **이번 v0.1/v0.2 범위는 v-itsm 앱 스코프(`itsm_workspaces` / `itsm_workspace_members`)로 진행**한다.

- **승격 신호 일부 해당**: 다른 앱(v-channel-bridge 라우팅 룰, v-platform-portal 앱별 접근 범위)도 유사 격리가 필요해질 가능성.
- **지금 승격하지 않는 이유**: (1) ITSM 외 앱의 요구사항이 구체화되지 않음 (2) 플랫폼 `department`/`group` 과 책임 경계가 현 시점 모호함.
- **승격 재검토 트리거**: 두 번째 앱이 워크스페이스 격리를 요구하는 시점, 또는 ITSM 워크스페이스가 `department` 와 1:1 로 굳는 시점.
- **설계 제약**: 도메인 모델은 ITSM 특화 컬럼 없이 순수하게 유지. ITSM 전용은 `settings JSONB` 로 분리 → 향후 플랫폼 승격 시 이관 비용 최소화.

---

## 2. 도메인 모델

### 2.1 워크스페이스

```
Workspace  (itsm_workspaces)
├── id            VARCHAR(26) ULID PK
├── name          string          표시 이름 (예: "인프라운영팀")
├── slug          string UNIQUE   사람이 읽는 식별자 (표시용, 변경 허용)
├── description   string?
├── icon_url      string?
├── settings      JSONB           WS별 SLA/알림 기본값 오버라이드 (ITSM 특화)
├── is_default    bool            시스템 기본 WS 여부 (전사 공용)
├── created_by    UUID → users.id
├── created_at    timestamptz
└── archived_at   timestamptz?    소프트 삭제
```

> **slug vs id**: URL 컨텍스트는 **id** 를 쓰고(§4.2 D1'), slug 는 사이드바·스위처·사람이 공유하는 단축 표기 용도로만 사용한다.

### 2.2 워크스페이스 멤버십

```
WorkspaceMember  (itsm_workspace_members)
├── id             VARCHAR(26) ULID PK
├── workspace_id   VARCHAR(26) → itsm_workspaces.id
├── user_id        UUID → users.id
├── role           enum  ws_admin | ws_member | ws_viewer
├── is_default     bool  이 워크스페이스가 해당 유저의 기본 WS
├── joined_at      timestamptz
├── UNIQUE(workspace_id, user_id)
└── PARTIAL UNIQUE(user_id) WHERE is_default = true   -- 다중 Default 방지
```

**역할 정의**:

| 역할 | 티켓 읽기 | 티켓 쓰기 | 할당 | SLA 설정 | 멤버 관리 |
|---|---|---|---|---|---|
| `ws_viewer` | ✓ | — | — | — | — |
| `ws_member` | ✓ | ✓ | ✓ | — | — |
| `ws_admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| 플랫폼 ITSM 관리자 | 전체 WS | 전체 WS | 전체 WS | 전체 WS | 전체 WS |

### 2.3 영향 테이블 전수 (19개)

v-itsm 기존 SQLAlchemy 모델을 3분류로 정리한다.

**A. WS 경계 안 — `workspace_id NOT NULL` 필수 (15개)**

| 모델 | 테이블 | 비고 |
|---|---|---|
| Ticket | itsm_ticket | 핵심 엔티티 |
| Assignment | itsm_assignment | 티켓 종속 |
| SLAPolicy | itsm_sla_policy | WS별 정책 |
| SLATier | itsm_sla_tier | WS별 등급 |
| SLATimer | itsm_sla_timer | 티켓 종속 |
| SLANotificationPolicy | itsm_sla_notification_policy | WS별 알림 정책 |
| KPISnapshot | itsm_kpi_snapshot | WS 범위 집계 |
| NotificationLog | itsm_notification_log | 티켓/WS 범위 |
| LoopTransition | itsm_loop_transition | WS별 FSM |
| LoopTransitionRevision | itsm_loop_transition_revision | 상동 |
| Customer | itsm_customer | WS 고객 |
| Contract | itsm_contract | WS 계약 |
| Product | itsm_product | WS 제품 |
| Feedback | itsm_feedback | 티켓 종속 |
| AISuggestion | itsm_ai_suggestion | WS 범위 |

**B. WS 경계 안 — 복합키(user+ws) 개인화 (1개)**

| 모델 | 테이블 | 처리 |
|---|---|---|
| UserNotificationPref | itsm_user_notification_pref | `(user_id, workspace_id)` UNIQUE 로 WS별 선호 분리 |

**C. WS 경계 안 — 타당성 확인 필요(결정 권장: WS별) (3개)**

| 모델 | 테이블 | 권장 | 사유 |
|---|---|---|---|
| IntegrationSettings | itsm_integration_settings | WS별 | 팀마다 Slack 채널/Teams 팀 다름 |
| SchedulerOverride | itsm_scheduler_override | WS별 | 운영 스케줄이 팀별 상이 |
| ScopeGrant | itsm_scope_grant | WS별 (잠정) | 개념 중복 가능성 — §11 Q2 확인 후 확정 |

### 2.4 인덱스 & 제약

공통 복합 인덱스 (전 19개 대상):

- `(workspace_id, created_at DESC)` — 목록/페이지네이션
- `(workspace_id, status)` — Kanban/필터 (Ticket, Assignment)
- `(workspace_id, customer_id)` — Ticket 관계 조회

FK 정책: **`ON DELETE RESTRICT`** — WS 삭제 전 이관 필수(D6).

---

## 3. 사용자 경험 (UX 흐름)

### 3.1 로그인 → 워크스페이스 자동 진입

```
로그인 성공
    ↓
JWT 발급 (workspace_id 없이)
    ↓
프론트 → GET /api/workspaces/me/default
    ↓
Default Workspace 응답 → store.currentWorkspaceId 설정
    ↓
/kanban 으로 리다이렉트 (현재 WS 컨텍스트로 보드 렌더)
```

- **전역 컨텍스트 모델 (v0.7)**: 로그인 직후 `store.loadDefault()` 로 WS 를 선정한 뒤, 사용자는 WS 를 다시 고르지 않고 바로 업무 화면(`/kanban`)으로 들어간다. 모든 WS 스코프 페이지(`/kanban`, `/tickets`, `/sla`, `/kpi`, `/settings`, `/members` 등)는 URL 에 `:wid` 를 포함하지 않고, store 의 `currentWorkspaceId` 를 읽어 동작한다.
- Default WS가 없는 경우 (신규 사용자 등):
  - 관리자가 배정할 때까지 "워크스페이스 없음" 안내 화면 표시
  - 플랫폼 ITSM 관리자는 즉시 전체 WS 진입 가능 (SYSTEM_ADMIN 은 전체 비아카이빙 WS 를 `/workspaces` 에서 선택)

### 3.2 워크스페이스 전환

헤더 우측에 **WS 선택기** 컴포넌트 상시 노출:

```
[ 🏢 인프라운영팀 ▾ ]
 ──────────────────
 ● 인프라운영팀  (현재)
   개발플랫폼팀
   고객지원팀
 ──────────────────
   모든 워크스페이스 보기 →
```

전환 시 (v0.7 — **현재 페이지 유지**):
1. `POST /api/workspaces/{id}/switch` 호출 (서버 측 감사로그 `workspace_switched`)
2. 응답으로 새 `current_workspace_id` 수신
3. 프론트 store(Zustand) 의 `currentWorkspaceId` 갱신 → axios 인터셉터가 `/api/ws/{new-id}` prefix 자동 반영
4. **URL 네비게이션 없음**. 현재 페이지(`/kanban`, `/tickets/:id` 등) 를 그대로 두고, 데이터 훅들이 새 WS 기준으로 자동 재조회
5. 열려 있던 WebSocket/구독 해제 후 새 WS 컨텍스트로 재구독

> 과거 v0.6 까지는 4단계에서 `/ws/{new-id}/dashboard` 로 강제 네비게이트했다. v0.7 은 "WS 는 전역 컨텍스트" 철학을 따라 페이지 이동을 제거한다 — 사용자가 티켓 상세를 보던 중 WS 를 바꾸면 같은 경로(`/tickets/:id`) 에서 새 WS 의 동일 리소스로 넘어가는 것이 아니라, `/tickets/:id` 가 새 WS 에서 유효하지 않으면 빈 상태/404 를 보여주고 사용자가 선택하도록 한다. 목록 화면(`/tickets`, `/kanban`)은 자동 재조회로 끝난다.

### 3.3 워크스페이스 목록 화면 (`/workspaces`)

내가 접근 가능한 워크스페이스 전체를 카드 그리드로 표시:

```
┌─────────────────────────────────────────────────┐
│  내 워크스페이스                         [+ 요청] │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ 🏢 인프라운영 │  │ 💻 개발플랫폼 │              │
│  │ 티켓 42건    │  │ 티켓 18건    │              │
│  │ SLA 94%      │  │ SLA 88%      │              │
│  │ ws_admin     │  │ ws_member    │              │
│  │ [진입하기]   │  │ [진입하기]   │              │
│  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────┘
```

카드 클릭 → 해당 WS 자동 전환 + 대시보드 이동.

### 3.4 엣지 케이스

| 케이스 | 처리 |
|---|---|
| Default WS 없는 신규 사용자 | "워크스페이스 없음" 화면 + 관리자 연락 안내 |
| 현재 WS 에서 멤버 자격 박탈 | 다음 요청 403 → 프론트 interceptor 가 `/workspaces` 이동, 토스트 "접근 권한이 취소되었습니다" |
| 플랫폼 ITSM 관리자 "전체 WS" 모드 | 스위처에 `모든 워크스페이스 보기` 옵션, `/admin/global-kpi` 전역 집계 라우트, 백엔드 `?ws=all`(관리자 검증) |
| SYSTEM_ADMIN 의 WS 목록 조회 (버그 수정, v0.6) | `GET /api/workspaces/me` 는 SYSTEM_ADMIN 에게 **항상 전체 비아카이빙 WS 목록**을 반환한다. 멤버십이 있는 WS 는 실제 role/is_default 를 반영하고, 멤버가 아닌 WS 는 가상 role=`ws_admin`, is_default=false 로 채운다. 프론트 `WorkspaceGate` 가드(v0.7)가 `currentWorkspaceId` 존재만 확인하므로 전 WS 에서 통과 |
| WS 아카이빙 | D6: 이관 필수 후 `archived_at` set. 스위처 숨김, 관리자 콘솔만 노출 |
| 레거시 URL (`/ws/:wid/tickets/123` 또는 `/tickets/123` 백엔드 prefix 없는 경우) | 프론트: `/ws/:wid/*` 진입 시 `store.switchWorkspace(wid)` 후 평탄 경로로 replace. 백엔드 레거시 미들웨어는 기존대로 `Ticket.workspace_id` 조회 후 `/api/ws/{wid}/tickets/123` 로 307 |
| 다중 Default WS | DB 부분 유니크 인덱스 `WHERE is_default = true` 로 강제 |
| WS 전환 중 웹소켓/구독 | 기존 구독 해제 → 새 WS 컨텍스트로 재구독 |

### 3.5 전역(Cross-Workspace) 업무 통합 관리 (v0.6 신설)

WS 격리가 기본이지만, 실무에서는 **"내가 담당하는 모든 업무를 한 화면에서"** 보기가 필요하다. 두 가지 전역 뷰를 추가한다. 두 뷰 모두 WS 경계 "위"에 떠 있는 화면이며, **데이터 접근은 기존 `access_control.UserScope` 메커니즘을 그대로 재사용**한다 (SYSTEM_ADMIN 은 `is_admin=True` 로 투명 통과, 일반 사용자는 ScopeGrant OR 절이 자동 주입됨).

#### 3.5.1 내 업무 통합 관리 (`/my-work`) — 전원 대상

- **목적**: 전체 WS 범위에서 현재 로그인 사용자에게 **할당된** 티켓을 한 곳에서 조회·처리.
- **필터 기준**: `current_owner_id = me` (할당자 기준). 보조 뷰로 `assignee in (my past assignments)` 제공 가능(v0.8 검토).
- **스코프 적용**: `apply_scope_to_query(stmt, my_scope, READ)` — SYSTEM_ADMIN 이면 전역, 아니면 내 ScopeGrant 범위 내에서만 조회.
- **WS 표시**: 각 행에 `workspace_id`·`workspace_name` 뱃지 노출. 행 클릭 → `store.switchWorkspace(ticket.workspace_id)` 후 평탄 경로 `/tickets/:id` 로 이동 (v0.7).
- **대상 사용자**: 모든 로그인 사용자(자기 업무 보기).

#### 3.5.2 팀 관리자/시스템 관리자 업무 통합 관리 (`/admin/all-work`)

- **목적**: 전체 WS 범위에서 **내가 관리하는 제품**에 접수된 모든 티켓을 조회·처리.
- **필터 기준**: 내 ScopeGrant 의 (customer_id, product_id) OR 절 기반. SYSTEM_ADMIN 은 전 티켓.
- **스코프 적용**: `apply_scope_to_query(stmt, my_scope, READ)` — 관리자가 아닌 일반 멤버가 접근해도 **본인의 ScopeGrant 만큼** 보여지므로 의미상 "팀 관리 범위 뷰" 가 됨.
- **WS 표시**: `/my-work` 와 동일.
- **대상 사용자**: 플랫폼 SYSTEM_ADMIN + 실무적으로는 ScopeGrant 가 있는 관리자급 사용자.

#### 3.5.3 `/my-work` vs `/admin/all-work` 의 차이 요약

| 항목 | `/my-work` | `/admin/all-work` |
|---|---|---|
| 필터 | `owner_id = me` (+ 내 scope) | (내 scope) — owner 무관 |
| 대상 | 전원 (본인 업무) | SYSTEM_ADMIN + ScopeGrant 보유자 |
| 기본 정렬 | SLA 임박 → 최신 | 단계별 · 최신 |
| 사이드바 노출 | 전원 | 관리자급(역할 기반 가드) |

두 페이지는 **같은 API 스키마(`TicketListResponse`) + 같은 행 컴포넌트**를 공유하고, 엔드포인트와 기본 필터만 다르다(중복 코드 최소화).

---

## 4. API 설계

### 4.1 WS 관리 엔드포인트

```
GET  /api/workspaces/me              내 WS 목록 (요약 + KPI)
GET  /api/workspaces/me/default      기본 WS 조회
POST /api/workspaces/{id}/switch     WS 전환 (감사로그 기록)
GET  /api/workspaces/{id}            WS 상세
GET  /api/workspaces/{id}/members    멤버 목록
POST /api/workspaces/{id}/members    멤버 추가 (ws_admin)
PUT  /api/workspaces/{id}/members/{uid}/role  역할 변경
DELETE /api/workspaces/{id}/members/{uid}     멤버 제거

# 관리자 전용
GET  /api/admin/workspaces           전체 WS 목록
POST /api/admin/workspaces           WS 생성 (플랫폼 ITSM 관리자 only)
PUT  /api/admin/workspaces/{id}      WS 수정
DELETE /api/admin/workspaces/{id}    WS 아카이빙 (이관 확인 후)
GET  /api/admin/global-kpi           전역 KPI (ws=all)

# 전역 업무 통합 뷰 (v0.6 신설 — WS prefix 없음)
GET  /api/my-work/tickets            전 WS 내 할당 티켓 (owner_id=me, scope 적용)
GET  /api/admin/all-work/tickets     전 WS 스코프 내 티켓 (SYSTEM_ADMIN 전체, 그 외 내 ScopeGrant 범위)
```

**공통 쿼리 파라미터** (`/api/my-work/tickets`, `/api/admin/all-work/tickets`):

- `page`, `page_size` — 페이지네이션
- `stage` — Loop 단계 필터 (intake/analyze/execute/verify/answer/closed)
- `service_type`, `customer_id`, `product_id` — 범위 축소 필터
- `workspace_id` — 선택 WS 로 축소 (지정 시 단일 WS 뷰로 전환). 지정 없으면 전 WS 집계

응답은 기존 `TicketListResponse` 와 동일. 단 v0.6 부터 `TicketOut` 에 **`workspace_id`, `workspace_name`** 를 포함한다 (cross-WS 화면에서 구분 표시용).

### 4.2 WS 컨텍스트 주입 방식 (확정: 백엔드 URL prefix + id, 프론트 URL 평탄)

**백엔드 (불변)**:

```
/api/ws/{workspace_id}/tickets       # ← 그대로 유지
```

- **D1 확정**: 백엔드 URL prefix 방식 — RESTful, 감사로그 추적 명확
- **D1' 확정**: **id** 사용(slug 아님) — slug 변경 시 URL 안정성, 감사로그에 불변 식별자 기록
- 백엔드 FastAPI 의존성 `get_current_workspace(workspace_id: str, user=Depends(get_current_user))` 가 URL 파라미터에서 WS 추출 + 멤버십 검증

**프론트 (v0.7 — URL 평탄화)**:

- 프론트 URL 은 `:wid` 를 포함하지 않는다. 예: `/kanban`, `/tickets/:id`, `/settings/members`
- Zustand `currentWorkspaceId` 가 유일한 진실의 원천
- axios 인터셉터가 요청 시점의 `currentWorkspaceId` 를 읽어 `/api/tickets` → `/api/ws/{id}/tickets` 로 rewrite (WS 비의존 경로는 WS_EXEMPT 화이트리스트로 제외: `/api/workspaces`, `/api/admin`, `/api/my-work`, `/api/auth`, `/api/users`, `/api/permissions`, `/api/audit`, `/api/health`, `/api/notifications`, `/api/uploads`, `/api/monitoring`, `/api/system-settings`, `/api/menus`, `/api/organizations`, `/api/oauth`, `/api/sso`)
- 즉, **프론트 URL 과 백엔드 URL 은 독립**. 프론트는 "지금 어느 화면을 보고 있는가", 백엔드는 "어느 WS 리소스를 다루는가" 를 표현한다

### 4.3 라우터 변환 매트릭스 (현 16개 전수)

| 라우터 파일 | 현 경로 | 이관 후 | WS 필터 주입 |
|---|---|---|---|
| tickets | `/api/tickets` | `/api/ws/{wid}/tickets` | ✓ |
| kpi | `/api/kpi` | `/api/ws/{wid}/kpi` | ✓ |
| sla_policies | `/api/sla-policies` | `/api/ws/{wid}/sla-policies` | ✓ |
| sla_tiers | `/api/sla-tiers` | `/api/ws/{wid}/sla-tiers` | ✓ |
| sla_timers | `/api/sla-timers` | `/api/ws/{wid}/sla-timers` | ✓ |
| sla_notification_policies | `/api/sla-notification-policies` | `/api/ws/{wid}/sla-notification-policies` | ✓ |
| customers | `/api/customers` | `/api/ws/{wid}/customers` | ✓ |
| contracts | `/api/contracts` | `/api/ws/{wid}/contracts` | ✓ |
| products | `/api/products` | `/api/ws/{wid}/products` | ✓ |
| transitions | `/api/transitions` | `/api/ws/{wid}/transitions` | ✓ |
| notification_logs | `/api/notification-logs` | `/api/ws/{wid}/notification-logs` | ✓ |
| scheduler | `/api/scheduler` | `/api/ws/{wid}/scheduler` | ✓ |
| scope_grants | `/api/scope-grants` | `/api/ws/{wid}/scope-grants` | ✓ (Q2 후 확정) |
| integrations | `/api/integrations` | `/api/ws/{wid}/integrations` | ✓ |
| me_notification_pref | `/api/me/notification-pref` | `/api/ws/{wid}/me/notification-pref` | ✓ (user+ws 복합) |
| ai (AI 어시스턴트 이후) | `/api/ai/*` | `/api/ws/{wid}/ai/*` | ✓ |

**전역(WS prefix 없음)**:
- `/api/workspaces/*` — WS 자체 관리
- `/api/admin/*` — 플랫폼 관리자 전용
- `/api/auth/*` — 플랫폼 공용 인증

---

## 5. 프론트엔드 설계

### 5.1 상태 구조 (Zustand)

```typescript
interface WorkspaceStore {
  currentWorkspaceId: string | null;
  currentWorkspace: Workspace | null;
  myWorkspaces: WorkspaceSummary[];
  isLoading: boolean;
  initialized: boolean;                          // 부트스트랩 완료 여부 (가드용)
  loadDefault: () => Promise<void>;              // 부트스트랩 시 호출
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshMyWorkspaces: () => Promise<void>;
  clear: () => void;                             // 로그아웃 시
}
```

axios 인터셉터: `currentWorkspaceId` 가 있고 요청 URL 이 `/api/ws/` 로 시작하지 않으면서 WS_EXEMPT 목록(§4.2 참조) 에도 속하지 않는 경우, 자동으로 `/api/ws/{id}` prefix 삽입. 인터셉터는 URL 의 `:wid` 를 **읽지 않는다** — store 의 내부 변수 `_currentWorkspaceId` 만 참조한다.

### 5.2 라우팅 구조 (v0.7 — 평탄 URL)

```
# 전역 진입점 / WS 선택
/workspaces                         내 WS 목록 + 전환 (SYSTEM_ADMIN 은 전체)

# WS 스코프 페이지 — URL 에 :wid 없음. store.currentWorkspaceId 에 의존
/kanban                             Kanban 보드 (기본 진입점)
/tickets                            티켓 목록
/tickets/new                        티켓 생성
/tickets/:id                        티켓 상세
/sla                                SLA 모니터
/kpi                                KPI 대시보드
/settings                           WS 일반 설정 (ws_admin)
/members                            멤버 관리

# WS 어드민 (WS 스코프, 플랫 경로) — URL 에 :wid 없음
/admin/customers                    고객
/admin/products                     제품
/admin/contracts                    계약
/admin/sla-tiers                    SLA 등급
/admin/sla-policies                 SLA 정책
/admin/sla-notification-policies    SLA 알림 정책
/admin/scheduler                    스케줄러
/admin/scope-grants                 범위 부여
/admin/integrations                 외부 연동
/admin/notification-logs            알림 로그

# 전역 (WS 비의존)
/me/notification-pref               내 알림 선호 (백엔드는 default WS 로 자동 해석)
/my-work                            전 WS 내 할당 티켓 (전원)
/admin/all-work                     전 WS 스코프 내 티켓 (관리자 뷰)
/admin/global-kpi                   전역 KPI (플랫폼 ITSM 관리자)
/help                               도움말
/profile, /users, /audit-logs, ...  플랫폼 공통

# 레거시 호환 (북마크 보존용)
/ws/:wid/*                          → store.switchWorkspace(wid) 후 평탄 경로로 replace
/kanban, /tickets, ...              (이미 평탄이면 그대로)
```

### 5.3 가드 처리 (v0.7)

```typescript
// <WorkspaceGate>: WS 스코프 라우트의 공통 가드
// 1. 로그인 여부 확인                                 (미로그인 → /login)
// 2. store.initialized === false 면 로딩 스피너
// 3. store.currentWorkspaceId 없으면 → /workspaces (사용자가 선택하도록)
// 4. 라우트별 role 요구(예: /settings → ws_admin) 는 페이지 내부에서 확인

// <LegacyWsRedirect path="/kanban">: /ws/:wid/* 경로 호환용
// 1. useParams<{wid}>() 로 :wid 추출
// 2. store.switchWorkspace(wid) 호출 (멤버 아니면 404 라우트로)
// 3. <Navigate to="/kanban" replace />
```

**핵심 변화**: URL 의 `:wid` 와 store 를 동기화할 필요가 없다. URL 은 "어느 화면" 만, store 는 "어느 WS" 만 표현하므로 충돌 지점이 없다.

### 5.4 페이지 경로 이관 매트릭스 (v0.7 최종)

| v-itsm 기존 (v0.6) | v0.7 경로 | 비고 |
|---|---|---|
| `/` | `/workspaces` 로 리다이렉트 | 기본 진입점 |
| `/ws/:wid` (index) | `/kanban` 으로 리다이렉트 | 기본 화면 |
| `/ws/:wid/kanban` | `/kanban` | |
| `/ws/:wid/tickets` | `/tickets` | |
| `/ws/:wid/tickets/new` | `/tickets/new` | |
| `/ws/:wid/tickets/:id` | `/tickets/:id` | |
| `/ws/:wid/sla` | `/sla` | |
| `/ws/:wid/kpi` | `/kpi` | |
| `/ws/:wid/settings` | `/settings` | |
| `/ws/:wid/members` | `/members` | |
| `/ws/:wid/admin/customers` | `/admin/customers` | |
| `/ws/:wid/admin/products` | `/admin/products` | |
| `/ws/:wid/admin/contracts` | `/admin/contracts` | |
| `/ws/:wid/admin/sla-tiers` | `/admin/sla-tiers` | |
| `/ws/:wid/admin/sla-policies` | `/admin/sla-policies` | |
| `/ws/:wid/admin/sla-notification-policies` | `/admin/sla-notification-policies` | |
| `/ws/:wid/admin/scheduler` | `/admin/scheduler` | |
| `/ws/:wid/admin/scope-grants` | `/admin/scope-grants` | |
| `/ws/:wid/admin/integrations` | `/admin/integrations` | |
| `/ws/:wid/admin/notification-logs` | `/admin/notification-logs` | |
| `/me/notification-pref` | `/me/notification-pref` | 전역 — 변경 없음 |
| `/my-work` | `/my-work` | 전역 — 변경 없음 |
| `/admin/all-work` | `/admin/all-work` | 전역 — 변경 없음 |

**레거시 호환**: `/ws/:wid/*` 경로가 들어오면 `store.switchWorkspace(wid)` 실행 후 대응 평탄 경로로 `Navigate replace`. 최소 2 릴리즈 유지 후 제거.

### 5.5 v0.7 URL 평탄화 결정 (Decision Record)

**결정**: 프론트 URL 에서 워크스페이스 식별자(`:wid`) 를 제거한다.

**배경**: v0.6 까지 URL `:wid` 를 컨텍스트 식별자로 사용하다 보니, 사용자가 페이지를 이동할 때마다 "어느 WS 의 무슨 페이지" 를 동시에 결정해야 했다. 특히 페이지 진입마다 WS 를 다시 고른다는 인상을 주어 UX 가 복잡했다.

**사용자 요구 (2026-04-24)**:
> "각 페이지 단위로 워크스페이스를 선택해서 들어 가는 방식이 아니고 워크스페이를 선택하면 전체 업무를 선택한 워크스페이스 기준으로 할 수 있고 해야함. 필요시 다른 워크스페이스로 전환하면 전환된 워크스페이스로 업무하는 시나리오."

**결정 요지**:
- 프론트 URL 은 **화면만** 표현 (`/kanban`, `/tickets/:id` 등)
- WS 는 **store 의 전역 상태** — 스위처 조작 시 현재 페이지 유지
- 백엔드 `/api/ws/{workspace_id}/*` 는 불변 — 인터셉터가 store → URL prefix 변환

**고려한 대안**:
- (A) **URL 평탄화** — 채택. WS 가 진짜 전역 컨텍스트가 됨. 단점: 북마크 공유 시 WS 정보 손실 → 레거시 redirect 로 완화
- (B) **URL `:wid` 유지, 전환 시 현재 path 를 새 `:wid` 에 붙여 redirect** — 거절. URL 이 여전히 WS 와 결합되어 "페이지당 WS 를 고르는" 인식이 남음, redirect 체인이 UX 를 늘어지게 함

**영향 범위 (W9)**:
- 프론트: `App.tsx` 라우팅 재편, `WorkspaceRoute` → `WorkspaceGate` 교체, `WorkspaceSwitcher` 에서 `navigate` 제거, `WorkspacesList`/`MyWork`/`AllWork` 의 행 클릭 핸들러에서 `switchWorkspace` 선행 후 평탄 경로로 이동, `WsSettings`/`WsMembers` 의 `useParams` 제거
- 백엔드: 변경 없음 (설계 의도 — 백엔드 계약은 불변)

**되돌림 가능성**: 백엔드가 바뀌지 않으므로 추후 필요 시 프론트 라우팅만 다시 교체하면 복귀 가능.

---

## 6. 마이그레이션 전략

### 6.1 단계적 NOT NULL 승격 (3단계)

기존 데이터를 **"Default" 워크스페이스** 로 일괄 이관하되, 서비스 중단을 최소화하기 위해 3개 마이그레이션으로 분할한다.

**1단계 `aNNN_workspaces`** — 테이블 신설

```sql
CREATE TABLE itsm_workspaces (...);
CREATE TABLE itsm_workspace_members (...);

INSERT INTO itsm_workspaces (id, name, slug, is_default, created_at)
VALUES ('ws_01HDEFAULT00000000000000', '전사 공통', 'default', true, now());
```

**2단계 `aNNN+1_add_workspace_id`** — 19개 테이블 컬럼 추가 + 백필 (여전히 NULLABLE)

```sql
ALTER TABLE itsm_ticket
  ADD COLUMN workspace_id VARCHAR(26) NULL
  REFERENCES itsm_workspaces(id);

UPDATE itsm_ticket SET workspace_id = 'ws_01HDEFAULT00000000000000'
  WHERE workspace_id IS NULL;
-- 19개 테이블 반복

INSERT INTO itsm_workspace_members (id, workspace_id, user_id, role, is_default, joined_at)
SELECT ulid(), 'ws_01HDEFAULT00000000000000', id, 'ws_member', true, now() FROM users;
```

대형 테이블(`itsm_ticket`, `itsm_notification_log`)은 배치 UPDATE(예: 10K 단위) 권장.

**3단계 `aNNN+2_workspace_id_notnull`** — 제약/인덱스/FK RESTRICT

```sql
ALTER TABLE itsm_ticket
  ALTER COLUMN workspace_id SET NOT NULL,
  DROP CONSTRAINT itsm_ticket_workspace_id_fkey,
  ADD CONSTRAINT itsm_ticket_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES itsm_workspaces(id) ON DELETE RESTRICT;

CREATE INDEX idx_itsm_ticket_ws_created ON itsm_ticket(workspace_id, created_at DESC);
CREATE INDEX idx_itsm_ticket_ws_status  ON itsm_ticket(workspace_id, status);
-- 19개 테이블별 필요 인덱스 반복
```

### 6.2 롤백 절차

| 단계 | 롤백 방법 |
|---|---|
| 3단계 | `ALTER ... DROP NOT NULL`, FK 재생성(`NO ACTION`), 인덱스 DROP |
| 2단계 | 19개 테이블 `workspace_id` 컬럼 DROP (데이터 폐기 전제 — 서비스 중단 창 필요) |
| 1단계 | `itsm_workspace_members`, `itsm_workspaces` DROP |

각 마이그레이션 파일에 `downgrade()` 구현 필수. 3단계 롤백은 서비스 계속 가능, 2단계 롤백은 서비스 중단 필요.

### 6.3 AI 어시스턴트 작업과의 순서 (확정)

**결정**: 워크스페이스 먼저 진행 (옵션 2 채택).

- **a014** `a014_workspaces.py` — `itsm_workspaces`, `itsm_workspace_members` 신설 + Default WS seed
- **a015** `a015_add_workspace_id.py` — 19개 테이블 `workspace_id NULL` + 백필 + 전 유저 Default 멤버 seed
- **a016** `a016_workspace_id_notnull.py` — NOT NULL 승격 + 인덱스 + FK RESTRICT
- **a017+** AI 어시스턴트 채팅 테이블 (`itsm_ai_chat_session`, `itsm_ai_chat_message`) — 워크스페이스 완료 후 `workspace_id NOT NULL` 로 처음부터 설계 가능.

### 6.4 호환 기간 레거시 경로

v0.2~v0.3 동안 구 URL 유지 + 307 리다이렉트:

- **백엔드 미들웨어** (`middleware/legacy_redirect.py`): `/api/tickets/{id}` → `Ticket.workspace_id` 조회 + 권한 검증 → `/api/ws/{wid}/tickets/{id}` 307
- **프론트 라우터**: 구 경로 마운트 유지 후 `useEffect` 로 `/ws/:wid/...` 로 네비게이트
- 최소 2 릴리즈 후 레거시 경로 제거

---

## 7. 결정 이력

| # | 주제 | 확정 | 사유 |
|---|---|---|---|
| DA | 스코프 | v-itsm 앱 내부 시작 (§1.3) | 다른 앱 요구 미확정, 책임 경계 모호 |
| DB | WS 경계 테이블 범위 | 19개 모두 WS 경계 안 (§2.3 A+B+C) | |
| D9 | AI vs WS 작업 순서 | **워크스페이스 먼저** (a014~a016), AI는 a017+ | 제품 우선순위 결정 |
| D10 | ScopeGrant 처리 | **별도 개념 유지**, workspace_id 추가로 WS 경계 안 편입 | WS 하위에 permission_group별 접근 범위 관리 |
| D1 | WS 컨텍스트 전달 | URL prefix | RESTful, 감사 명확 |
| D1' | URL slug vs id | **id** (`/ws/{workspace_id}/...`) | slug 변경 시 안정성, 감사 추적 |
| D2 | Default WS 설정 주체 | 관리자 배정 + 사용자 변경 가능 | 온보딩 속도 + 자유도 |
| D3 | WS 간 티켓 이관 | ws_admin + 플랫폼 ITSM 관리자 | 경계 유지 + 운영 필요 |
| D4 | department 자동 멤버십 | **v0.3+ 로 연기** | 복잡도 억제 |
| D5 | WS 생성 권한 | 플랫폼 ITSM 관리자 only | 남발 방지, slug 일관성 |
| D6 | WS 삭제 처리 | 이관 필수 후 소프트 삭제 (`archived_at`) | 데이터 손실 방지 |

---

## 8. 구현 범위 — Phase W

| 단계 | 내용 | 산출물 | DoD |
|---|---|---|---|
| **W0** | 본 문서 v0.2 승인 + §11 Q1/Q2 확정 + 마이그레이션 번호 확보 | 본 문서 | 번호 충돌 없음, 승인 완료 |
| **W1** | 마이그레이션 1단계: `itsm_workspaces`, `itsm_workspace_members` 신설 + Default WS seed | `aNNN_workspaces.py` | Default WS 생성, 스모크 쿼리 통과 |
| **W2** | 마이그레이션 2단계: 19개 테이블 `workspace_id NULL` + 백필 + 전 유저 Default 멤버 seed | `aNNN+1_add_workspace_id.py` | 전체 행 채움, 전 유저 멤버 등록 |
| **W3** | 마이그레이션 3단계: NOT NULL + 인덱스 + FK RESTRICT | `aNNN+2_workspace_id_notnull.py` | 제약 on, EXPLAIN 으로 인덱스 사용 확인 |
| **W4** | 백엔드 의존성 `get_current_workspace` + 16개 라우터 WS 필터 주입 | `app/deps/workspace.py`, `api/*` patch | 크로스 WS 접근 403, 격리 테스트 통과 |
| **W5** ✅ | 백엔드 WS CRUD/멤버/스위치 API + 레거시 307 미들웨어 | `api/workspaces.py`, `api/admin/workspaces.py`, `middleware/legacy_redirect.py`, `schemas/workspace.py`, `services/workspace_service.py` | §4.1 전 엔드포인트 구현 완료. 감사로그 AuditAction 확장은 플랫폼 변경 — 사용자 승인 후 별도 진행(TODO) |
| **W6** ✅ | 프론트 WS 스토어 + axios 인터셉터 + 19개 페이지 경로 이관 + Switcher | `stores/workspace.ts`(initialized 플래그), `lib/api/client.ts`(WS prefix 인터셉터), `lib/api/workspaces.ts`, `App.tsx`(라우팅 전면 재편), `components/workspace/WorkspaceSwitcher.tsx`, `components/workspace/WorkspaceLayout.tsx`, `components/workspace/WorkspaceRoute.tsx`, `pages/WorkspacesList.tsx`, `pages/ws/WsSettings.tsx`, `pages/ws/WsMembers.tsx` | 전 페이지 `/ws/:wid/...` 동작, 레거시 경로 리다이렉트, `initialized` 플래그로 초기 로딩 구분 |
| **W7** | 프론트 WS 목록/설정(general/members)/전역 KPI 화면 | `pages/workspaces/`, `pages/ws-settings/*`, `pages/admin/GlobalKpi.tsx` | 신규 페이지 4종 동작, 권한 가드 적용 |
| **W8** | SYSTEM_ADMIN `list_my_workspaces` 버그 수정 + 전역 업무 통합 관리 페이지 (`/my-work`, `/admin/all-work`) | 백엔드: `api/workspaces.py` 수정, 신규 `api/my_work.py`, `api/admin/all_work.py`, `services/ticket_service.list_tickets_cross_workspace`, `TicketOut` 에 `workspace_id/workspace_name` 추가. 프론트: `pages/MyWork.tsx`, `pages/admin/AllWork.tsx`, 라우트 등록(`/my-work`, `/admin/all-work`), 사이드바 메뉴 추가(역할 가드), `lib/api/my_work.ts` / `lib/api/admin_all_work.ts` | SYSTEM_ADMIN 이 모든 WS 진입 가능, `/my-work` 에서 내 할당 티켓 전 WS 합산 조회, `/admin/all-work` 에서 ScopeGrant/admin 범위 티켓 조회 |

**PR 단위 권장**: (W1+W2+W3) 1 PR, W4 1 PR, W5 1 PR, W6 1 PR(최대), W7 1 PR, W8 1 PR — 총 6 PR.

**플랫폼 영향 지점 (W5)**: `v_platform.utils.audit_logger` 의 `AuditAction` enum 확장은 플랫폼 변경 → 본 변경 착수 전 사용자 승인 필요(루트 CLAUDE.md "플랫폼 수정은 사용자 승인 필요" 규약).

---

## 9. 테스트 & QA

### 9.1 격리 검증 시나리오

1. WS-A 멤버가 WS-B 티켓 id 로 `GET` → 403
2. WS-A 멤버가 WS-B 티켓 id 로 `PUT` → 403
3. WS-A Kanban 에 WS-B 티켓이 섞여 표시되지 않음
4. WS-A 의 KPI 합산에 WS-B 데이터 미포함
5. 플랫폼 ITSM 관리자는 `/admin/global-kpi` 에서 전역 집계 가능
6. WS 전환 직후 다른 API 응답이 새 WS 데이터만 포함
7. 레거시 `/api/tickets/123` 접근 시 티켓 소속 WS 로 307 (권한 있을 때만, 없으면 403)
8. 멤버 박탈 후 다음 요청 403 → 프론트 `/workspaces` 이동

### 9.2 회귀 범위 (기존 기능 보호)

- Kanban 드래그앤드롭 + Undo (최근 커밋 55167af, eccd2fe)
- SLA 알림 로거 키 `notify_event` (3fa61fb)
- ITSM 메뉴 그룹 (마이그레이션 a013)
- SLA 관리 페이지 Drawer 전환 (55167af)

### 9.3 감사로그 포인트

플랫폼 `AuditAction` enum 확장 (W5 선행):

- `workspace_created`, `workspace_archived`, `workspace_updated`
- `workspace_member_added`, `workspace_member_removed`, `workspace_member_role_changed`
- `workspace_switched` (유저가 WS 전환)
- `ticket_cross_workspace_moved` (D3 허용된 이관)

---

## 10. 리스크 & 완화

| # | 리스크 | 완화 |
|---|---|---|
| R1 | AI 어시스턴트와 마이그레이션 번호 충돌 | §6.3 옵션 확정 후 진행. 두 PR 동시 open 금지(직렬화) |
| R2 | 대형 테이블 `NOT NULL` 승격 중 락 | 2단계에서 배치 백필(10K 단위) + EXPLAIN 확인, 3단계는 짧은 창 |
| R3 | JWT 에 workspace_id 없어 초기 요청 실패 | 프론트 부트스트랩 시 `/api/workspaces/me/default` 선조회, 완료 전 요청 pending |
| R4 | 플랫폼 관리자 전역 KPI 요구 | `/admin/global-kpi` + 백엔드 `?ws=all`(관리자 역할 검증) |
| R5 | 북마크/외부 링크 깨짐 | §6.4 레거시 307 최소 2 릴리즈 유지 |
| R6 | 플랫폼 승격 시 이관 비용 | §1.3 원칙 — 도메인 모델 ITSM 특화 없이 순수 유지 |
| R7 | ScopeGrant 의미 중복 | §11 Q2 확인 — 실 사용 패턴 보고 병합/유지 결정 |
| R8 | IntegrationSettings 토큰 스코프 변경 | WS별 분리 시 기존 토큰 Default WS 로 이관, 재연동 가이드 배포 |

---

## 11. 남은 결정

Q1, Q2 모두 확정 완료 (§7 D9/D10). W0 체크 통과 → W1 부터 착수 가능.

---

## 12. 관련 문서

- `V_ITSM_DESIGN.md` — v-itsm 전체 아키텍처
- `V_ITSM_OPERATIONS_CONSOLE_DESIGN.md` — 운영 콘솔 설계
- `V_ITSM_AI_ASSISTANT_DESIGN.md` — AI 어시스턴트 (마이그레이션 번호 a014 선점)
- `LOOP_TRANSITION_EDITING_DESIGN.md` — Loop FSM 전환 규칙
- `platform/CLAUDE.md` — 플랫폼 RBAC/조직도 연계 기준
- 메모리 `project_v_itsm_ai_assistant_handoff` — a014/p035 예약 현황

---

**문서 버전**: v0.6 (SYSTEM_ADMIN 접근 버그 수정 + 전역 업무 통합 관리 페이지)
**최종 업데이트**: 2026-04-24
