# v-itsm 워크스페이스 설계

**버전**: v0.1 (초안)  
**작성일**: 2026-04-23  
**상태**: 검토 전

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
| 플랫폼 연계 | 플랫폼 RBAC의 `department`/`group` 과 연계하여 자동 멤버십 가능 (추후) |

---

## 2. 도메인 모델

### 2.1 워크스페이스

```
Workspace
├── id            ULID PK
├── name          string          표시 이름 (예: "인프라운영팀")
├── slug          string UNIQUE   URL 식별자 (예: "infra-ops")
├── description   string?
├── icon_url      string?
├── settings      JSONB           WS별 SLA/알림 기본값 오버라이드
├── is_default    bool            시스템 기본 WS 여부 (전사 공용)
├── created_by    UUID → users.id
├── created_at    timestamptz
└── archived_at   timestamptz?    소프트 삭제
```

### 2.2 워크스페이스 멤버십

```
WorkspaceMember
├── id             ULID PK
├── workspace_id   ULID → workspaces.id
├── user_id        UUID → users.id
├── role           enum  ws_admin | ws_member | ws_viewer
├── is_default     bool  이 워크스페이스가 해당 유저의 기본 WS
├── joined_at      timestamptz
└── UNIQUE(workspace_id, user_id)
```

**역할 정의**:

| 역할 | 티켓 읽기 | 티켓 쓰기 | 할당 | SLA 설정 | 멤버 관리 |
|---|---|---|---|---|---|
| `ws_viewer` | ✓ | — | — | — | — |
| `ws_member` | ✓ | ✓ | ✓ | — | — |
| `ws_admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| 플랫폼 ITSM 관리자 | 전체 WS | 전체 WS | 전체 WS | 전체 WS | 전체 WS |

### 2.3 기존 엔티티 변경

기존 `itsm_ticket`, `sla_policy`, `sla_tier`, `assignment`, `kpi_snapshot` 등에 `workspace_id` 컬럼 추가:

```sql
-- 예: itsm_ticket
ALTER TABLE itsm_ticket ADD COLUMN workspace_id VARCHAR(26) NOT NULL REFERENCES itsm_workspaces(id);
CREATE INDEX idx_itsm_ticket_workspace ON itsm_ticket(workspace_id);
```

> **격리 전략**: 모든 읽기/쓰기 API는 `workspace_id` 필터를 자동 주입(미들웨어/의존성)하여 교차 접근을 차단한다.

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
Default Workspace 응답
    ↓
/ws/{slug}/dashboard 로 리다이렉트
```

Default WS가 없는 경우 (신규 사용자 등):
- 관리자가 배정할 때까지 "워크스페이스 없음" 안내 화면 표시
- 플랫폼 ITSM 관리자는 즉시 전체 WS 진입 가능

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

전환 시:
1. `POST /api/workspaces/{id}/switch` 호출
2. 응답으로 새 `current_workspace_id` 수신
3. 프론트 상태(Zustand) 갱신 → 모든 API 요청에 자동 반영
4. 현재 URL을 새 WS 경로(`/ws/{new-slug}/dashboard`)로 이동

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

카드 클릭 → 해당 WS 자동 전환 + 대시보드 이동

---

## 4. API 설계

### 4.1 엔드포인트

```
GET  /api/workspaces/me              내 WS 목록 (요약 + KPI)
GET  /api/workspaces/me/default      기본 WS 조회
POST /api/workspaces/{id}/switch     WS 전환 (세션 상태 변경)
GET  /api/workspaces/{id}            WS 상세
GET  /api/workspaces/{id}/members    멤버 목록
POST /api/workspaces/{id}/members    멤버 추가 (ws_admin)
PUT  /api/workspaces/{id}/members/{uid}/role  역할 변경
DELETE /api/workspaces/{id}/members/{uid}     멤버 제거

# 관리자 전용
GET  /api/admin/workspaces           전체 WS 목록
POST /api/admin/workspaces           WS 생성
PUT  /api/admin/workspaces/{id}      WS 수정
DELETE /api/admin/workspaces/{id}    WS 비활성화 (소프트)
```

### 4.2 현재 WS 컨텍스트 주입 방식

백엔드 FastAPI 의존성으로 처리:

```python
# 방안 A: 요청 헤더
X-Workspace-Id: ws_01HXJ...

# 방안 B: URL prefix (채택 권장)
/api/workspaces/{workspace_id}/tickets
```

> **권장**: URL prefix 방식. RESTful하고 감사로그 추적이 명확하다. 프론트는 Zustand에 `currentWorkspaceId`를 유지하고 axios 인터셉터로 prefix를 자동 삽입한다.

---

## 5. 프론트엔드 설계

### 5.1 상태 구조 (Zustand)

```typescript
interface WorkspaceStore {
  currentWorkspace: Workspace | null;
  myWorkspaces: WorkspaceSummary[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshMyWorkspaces: () => Promise<void>;
}
```

### 5.2 라우팅 구조

```
/workspaces                         내 WS 목록
/ws/:slug/dashboard                 WS 대시보드
/ws/:slug/tickets                   티켓 목록
/ws/:slug/tickets/:id               티켓 상세
/ws/:slug/kanban                    Kanban 보드
/ws/:slug/kpi                       KPI 대시보드
/ws/:slug/settings                  WS 설정 (ws_admin)
/ws/:slug/settings/members          멤버 관리
/ws/:slug/settings/sla              SLA 정책 관리
```

### 5.3 가드 처리

```typescript
// WS 라우트 가드
// 1. 로그인 여부 확인
// 2. currentWorkspace 없으면 /workspaces 또는 default WS로 이동
// 3. slug 기반 WS 접근 권한 없으면 403 화면
```

---

## 6. 마이그레이션 전략

기존 데이터를 **"Default" 워크스페이스**로 일괄 이관:

```sql
-- 1. Default WS 생성
INSERT INTO itsm_workspaces (id, name, slug, is_default, ...)
VALUES ('ws_DEFAULT', '전사 공통', 'default', true, ...);

-- 2. 기존 티켓 전체를 Default WS로 귀속
UPDATE itsm_ticket SET workspace_id = 'ws_DEFAULT';

-- 3. 기존 사용자 전체를 Default WS 멤버로 등록
INSERT INTO itsm_workspace_members (workspace_id, user_id, role, is_default)
SELECT 'ws_DEFAULT', id, 'ws_member', true FROM users;
```

마이그레이션 후:
- 기존 URL은 Default WS로 리다이렉트 처리
- 관리자가 이후 신규 WS 생성 + 티켓/멤버 이관

---

## 7. 미결 결정 사항

| # | 질문 | 옵션 | 권장 |
|---|---|---|---|
| D1 | WS 컨텍스트 전달 방식 | URL prefix vs 헤더 | URL prefix |
| D2 | 기본 WS 설정 주체 | 사용자 직접 vs 관리자 배정 | 관리자 배정 + 사용자 변경 가능 |
| D3 | WS 간 티켓 이관 가능 여부 | 허용 vs 금지 | ws_admin + 플랫폼 관리자만 허용 |
| D4 | 플랫폼 `department` 연계 자동 멤버십 | 즉시 vs 추후 | **추후** (v0.2 이후) |
| D5 | WS 생성 권한 | 플랫폼 관리자만 vs ws_admin도 가능 | 플랫폼 ITSM 관리자만 |
| D6 | WS 삭제 시 티켓 처리 | 소프트 삭제 + 이관 필수 vs 아카이빙 | 이관 필수 후 소프트 삭제 |

---

## 8. 구현 범위 (v0.1 목표)

| 단계 | 내용 | 비고 |
|---|---|---|
| **A0** | DB 마이그레이션 (workspaces, workspace_members, 기존 테이블 workspace_id 추가) | 선행 필수 |
| **A1** | 백엔드 API (WS CRUD, 멤버 관리, 전환 엔드포인트) | A0 이후 |
| **A2** | WS 컨텍스트 미들웨어 (모든 티켓 API 자동 필터) | A1 병행 |
| **A3** | 프론트 WS Switcher 컴포넌트 + Zustand 스토어 | A1 완료 후 |
| **A4** | 프론트 WS 목록 화면 + 라우팅 구조 전환 | A3 병행 |
| **A5** | WS 설정 화면 (멤버 관리, SLA 오버라이드) | A4 이후 |

---

## 9. 관련 문서

- `V_ITSM_DESIGN.md` — v-itsm 전체 아키텍처
- `V_ITSM_OPERATIONS_CONSOLE_DESIGN.md` — 운영 콘솔 설계
- `LOOP_TRANSITION_EDITING_DESIGN.md` — Loop FSM 전환 규칙
- `platform/CLAUDE.md` — 플랫폼 RBAC/조직도 연계 기준
