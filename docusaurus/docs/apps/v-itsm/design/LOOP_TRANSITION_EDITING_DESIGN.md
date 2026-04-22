---
title: Loop 전이 이력 편집·복원 + Drawer UX 고도화 설계
sidebar_position: 20
---

# Loop 전이 이력 편집·복원 + Drawer UX 고도화 설계

- **문서 버전**: v1.0 (확정 · Phase A~D 구현 완료 반영)
- **작성일**: 2026-04-22
- **관련 앱**: v-itsm
- **관련 문서**:
  - `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` (§4.1.2 LoopTransition, §4.2 FSM, §4.3 ACL, §4.4 전이 편집 정책)
  - 루트 `CLAUDE.md` — "플랫폼 승격 판단" 원칙
  - 기선행 작업: `NOTE` 액션(자기-전이) 기반 "처리 내용" 기능 (커밋/세션 #71)
  - 작업 이력: `docusaurus/blog/work-history/2026-04-22-loop-transition-editing.md`

---

## 1. 배경과 목표

### 1.1 배경

현재 Loop 전이 이력(`itsm_loop_transition`)은 **append-only 로그**이며, 사용자 상호작용은 중앙 정렬 `Modal(size=xl)` 을 통한 단일 입력 창으로 처리된다. NOTE 자기-전이 도입으로 단계별 **처리 내용(work-log)** 작성이 가능해졌지만 실무 운영에 다음 3가지 한계가 있다:

1. **모달이 작음** — Markdown 본문에 표·목록·코드블록·스크린샷을 첨부하면 `max-w-4xl`/`max-h-[90vh]` 로는 작업 시야가 좁음. 좌측 티켓 컨텍스트(제목/우선순위/SLA 남은 시간)가 가려져 참조하며 작성할 수 없음.
2. **오타/실수 수정 수단 없음** — 작성자가 자기 글을 교정하려면 같은 단계에서 새 NOTE 를 한 건 더 달아야 하고, 원본은 영구 보존됨. 실무에선 "오타로 남긴 잘못된 처리 내용"이 티켓 종료 후에도 감사 로그처럼 영구히 노출됨.
3. **실수한 전이/반려/보류 취소 불가** — 잘못된 advance/reject 전이는 반대 방향 액션으로만 복구 가능하고, 원본 기록은 잔재함.

### 1.2 목표

- **G1. Drawer (우측 도킹/슬라이드) UX** — 티켓 상세 페이지 유지하며 우측에서 밀려 들어오는 넓은 편집 영역. 기본 50%, 확장 시 75%, 최대화 시 전체. ESC/배경 클릭/닫기 버튼 모두 지원.
- **G2. 작성자 본인 편집** — 본인이 작성한 전이 이력(`note` 포함, `action` 변경 불가)의 본문/artifacts 만 편집 가능. 편집 시점에 이전 스냅샷을 리비전으로 저장.
- **G3. 작성자 본인 삭제(soft-delete)** — 본인 소유 이력 숨김 처리. 시스템 관리자는 전체 이력 접근 시 숨김 이력도 옵션으로 조회 가능.
- **G4. 리비전 조회 + 복원** — 각 전이 이력의 수정 히스토리 열람, 특정 리비전으로 되돌리기, 삭제 취소. 복원은 새 리비전으로 기록되어 연속성 유지.
- **G5. 감사 일관성** — 모든 편집/삭제/복원은 v-platform `audit_log` 에 기록 + itsm 로컬 리비전 테이블에 본문 스냅샷 보존.

### 1.3 비목표 (본 설계에서 다루지 않음)

- 다중 사용자 동시 편집(Conflict resolution, OT/CRDT) — 단일 사용자 선착순 기준
- 타 사용자 수정 권한 위임 / role=approver 승인 워크플로우
- 전이 순서 자체의 재배열(FSM 무결성 위반)
- 파일 첨부(ArtifactStore) — `artifacts` JSONB 에 URL 참조만 허용, 실제 업로드는 별도 설계

---

## 2. 현황 분석

### 2.1 데이터 모델

```python
# apps/v-itsm/backend/app/models/loop.py
class LoopTransition(Base):
    __tablename__ = "itsm_loop_transition"
    id              = Column(String(26), primary_key=True)   # ULID
    ticket_id       = Column(String(26), FK("itsm_ticket.id", ondelete="CASCADE"))
    from_stage      = Column(String(20), nullable=True)
    to_stage        = Column(String(20), nullable=False)
    action          = Column(String(20), nullable=False)     # advance/reject/on_hold/...
    actor_id        = Column(Integer, FK("users.id"))        # 작성자 = 기준 소유자
    note            = Column(Text, nullable=True)
    artifacts       = Column(JSONB, nullable=True)
    transitioned_at = Column(DateTime(timezone=True))
```

**누락 속성**: `deleted_at`, `deleted_by`, `last_edited_at`, `last_edited_by`, `edit_count`, `revision_id(head)`

### 2.2 Modal 컴포넌트

`platform/frontend/v-platform-core/src/components/ui/Modal.tsx` — 중앙 정렬, 4단 사이즈(`sm/md/lg/xl` → `max-w-md/lg/2xl/4xl`), ESC/배경 클릭 닫기, body scroll lock. Drawer/SlideOver 컴포넌트는 플랫폼에 존재하지 않음.

### 2.3 ACL/권한

- `User.role == SYSTEM_ADMIN` → 전 권한
- 그 외: `itsm_scope_grant` union (service_type × customer_id × product_id × scope_level)
- 현재 전이 생성(`POST /tickets/{id}/transition`)은 `check_ticket_access(ticket, ScopeLevel.WRITE)` 로만 검증. **작성자 본인 여부 개념은 없음**.

### 2.4 API

| 메서드 | 경로 | 현재 동작 |
|---|---|---|
| POST | `/api/tickets/{id}/transition` | 신규 전이 생성 |
| GET | `/api/tickets/{id}/transitions` | 전이 이력 조회 (append-only 전체) |
| GET | `/api/tickets/{id}/allowed-actions` | FSM 허용 액션 목록 |

---

## 3. 핵심 설계 결정

### D1. Drawer 컴포넌트는 platform/core 로 승격

**이유** (CLAUDE.md "플랫폼 승격 판단" 신호 #2, #3, #6):
- v-ui-builder / v-platform-portal / v-channel-bridge 에서도 "큰 편집 창이 필요한 폼"이 반복 등장할 것 (현재 Modal 로 우회 중)
- UI Kit 누락 — 범용 컴포넌트
- 지금 앱에만 넣으면 추후 중복 확산

**위치**: `platform/frontend/v-platform-core/src/components/ui/Drawer.tsx` + `index.ts` export.

**Props 설계** (Modal 과 패턴 통일):

```typescript
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "left";               // 기본 right
  size?: "md" | "lg" | "xl" | "full";    // 기본 lg (50%), xl(75%), full(100%)
  resizable?: boolean;                   // drag-handle 로 좌측 경계 드래그 (Phase 2)
  closeOnBackdrop?: boolean;             // 기본 true
  hideBackdrop?: boolean;                // 도킹 모드 — 본문 클릭 가능
  ariaLabel?: string;
}
```

**Size 매핑 (Tailwind)**:
- `md` → `w-full sm:w-[30rem]` (480px)
- `lg` → `w-full md:w-[50vw] lg:w-[48rem]` (50% or 768px)
- `xl` → `w-full lg:w-[75vw]`
- `full` → `w-full`

**도킹 모드 (`hideBackdrop=true`)**: 배경 어둡게 처리 안 하고 본문과 공존. 티켓 상세 페이지는 `ml-auto` 레이아웃으로 좌측 컨텐츠가 드로어만큼 양보되도록 재배치. 기본값은 backdrop 모드(기존 Modal UX).

**애니메이션**: `transition-transform duration-normal ease-out`, `translate-x-full` ↔ `translate-x-0`.

**포커스 트랩 / 스크롤 락**: Modal 과 동일하게 `document.body.style.overflow` 제어, 최초 포커스는 첫 번째 focusable. Esc 종료 동일.

**Backward compatibility**: 기존 Modal 은 그대로 유지. 티켓 Detail 에서만 Drawer 로 교체.

### D2. 편집 가능 범위 제한

- **편집 가능 필드**: `note`, `artifacts`
- **편집 불가 필드**: `from_stage`, `to_stage`, `action`, `actor_id`, `transitioned_at`, `ticket_id`, `id`
- **이유**: 스테이지 이동은 FSM 무결성이 최우선. action 위조는 감사 로그를 무력화함.

### D3. 리비전 테이블 (full snapshot)

별도 테이블 `itsm_loop_transition_revision` 에 "변경 전" 본문의 전체 스냅샷을 저장. 복원 시 이 스냅샷을 역적용.

- Append-only (PostgreSQL ROW-level)
- 삭제 시에도 "직전 상태 스냅샷 + 삭제 메타" 를 리비전으로 남김
- 복원 시 새 리비전을 또 생성 (이력 단절 없음)

### D4. 작성자 본인 + 시스템 관리자 + 관리 스코프

- **기본 규칙**: `actor_id == current_user.id` 이면 편집/삭제 가능
- **SYSTEM_ADMIN**: 모든 이력 편집/삭제/복원 + 조회 시 숨김 포함
- **관리 승격(선택)**: PermissionGroup 레벨 `scope_level="admin"` 또는 별도 `manage_transitions` 플래그를 추가하는 대신, **Phase 1 은 작성자+SYSTEM_ADMIN 만 허용**. Phase 2 에서 커스텀 role 도입 검토.

### D5. 편집 시간 창 (정책 Config)

- 환경변수 `ITSM_TRANSITION_EDIT_WINDOW_MINUTES` (**기본 `0` = 무제한**, 확정값)
- 값이 양수면 해당 분까지만 편집 허용, `0` 은 무제한, 음수면 편집 전면 차단(감사 엄격 모드)
- 편집/삭제/복원 모두 이 창을 검사. SYSTEM_ADMIN 만 우회.
- **이유**: 초안(v0.1)은 24h(1440) 제안이었으나, 실무에서 "오래된 티켓 이력에 오타를 발견 시 수정 요청"이 빈번하고, 작성자 본인만 편집 가능(D4)으로 이미 위변조 위험이 통제되어 있다. 엄격 감사 모드가 필요한 운영 환경에서는 환경변수로 즉시 제한 가능.

### D6. 삭제는 Soft-delete (deleted_at NOT NULL)

- 기본 목록 API 는 `deleted_at IS NULL` 만 반환
- `?include_deleted=true` 옵션은 SYSTEM_ADMIN 또는 작성자 본인에게만 허용
- Hard delete 는 제공하지 않음 (감사 트레일 보호)

### D7. 감사 로그 이중 기록

1. **itsm 로컬**: `itsm_loop_transition_revision` 에 스냅샷
2. **v-platform `audit_log`**: `action=transition.edit|delete|restore`, `entity_type="itsm_loop_transition"`, `entity_id=transition_id`, `actor_id`, `metadata={ticket_id, revision_id, before_hash, after_hash}`

로컬은 UI 즉시 렌더용, 플랫폼 audit 는 통합 감사 조회용.

---

## 4. 데이터 모델 확장

### 4.1 `itsm_loop_transition` 컬럼 추가 (ALTER)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `deleted_at` | TIMESTAMPTZ NULL | soft-delete 시각 |
| `deleted_by` | INTEGER FK users.id NULL | 삭제자 |
| `last_edited_at` | TIMESTAMPTZ NULL | 최종 수정 시각 |
| `last_edited_by` | INTEGER FK users.id NULL | 최종 수정자 |
| `edit_count` | INTEGER NOT NULL DEFAULT 0 | 편집 누적 횟수 |
| `head_revision_id` | VARCHAR(26) NULL | 현재 head 스냅샷 참조 (이전 상태로 되돌릴 때 사용) |

인덱스: `ix_itsm_loop_transition_actor (actor_id)`, `ix_itsm_loop_transition_deleted (deleted_at) WHERE deleted_at IS NOT NULL`.

### 4.2 `itsm_loop_transition_revision` 신규 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(26) PK | ULID |
| `transition_id` | VARCHAR(26) FK ON DELETE CASCADE | 대상 전이 이력 |
| `revision_no` | INTEGER NOT NULL | 1부터 시작, 전이별 단조증가 |
| `change_type` | VARCHAR(16) NOT NULL | `create` / `edit` / `delete` / `restore` |
| `snapshot_note` | TEXT NULL | 변경 직전의 note (create 시 현재값) |
| `snapshot_artifacts` | JSONB NULL | 변경 직전의 artifacts |
| `changed_by` | INTEGER FK users.id | 편집/삭제자 |
| `changed_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `reason` | TEXT NULL | 선택 사유 ("오타 수정" 등) |
| `parent_revision_id` | VARCHAR(26) NULL | 복원 시 "어떤 리비전으로 되돌렸는지" 참조 |

- UNIQUE `(transition_id, revision_no)`
- INDEX `(transition_id, changed_at DESC)`
- **초기 리비전 정책**: 전이 생성 시 `revision_no=1, change_type="create", snapshot_*=현재값` 을 자동 저장. 이후 변경은 "편집 직전의 값" 을 snapshot 으로 저장(before-image).

### 4.3 마이그레이션 `a010_transition_edit_restore.py`

```python
SQL = [
    # ALTER — 멱등
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id)",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS last_edited_by INTEGER REFERENCES users(id)",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE itsm_loop_transition ADD COLUMN IF NOT EXISTS head_revision_id VARCHAR(26)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_loop_transition_actor ON itsm_loop_transition(actor_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_loop_transition_deleted ON itsm_loop_transition(deleted_at) WHERE deleted_at IS NOT NULL",

    # 리비전 테이블
    """
    CREATE TABLE IF NOT EXISTS itsm_loop_transition_revision (
        id                 VARCHAR(26) PRIMARY KEY,
        transition_id      VARCHAR(26) NOT NULL REFERENCES itsm_loop_transition(id) ON DELETE CASCADE,
        revision_no        INTEGER     NOT NULL,
        change_type        VARCHAR(16) NOT NULL,
        snapshot_note      TEXT,
        snapshot_artifacts JSONB,
        changed_by         INTEGER REFERENCES users(id),
        changed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        reason             TEXT,
        parent_revision_id VARCHAR(26),
        UNIQUE (transition_id, revision_no)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_transition_rev_transition ON itsm_loop_transition_revision(transition_id, changed_at DESC)",

    # 기존 이력에 대한 백필: revision_no=1 / change_type='create' / snapshot_* = 현재값
    """
    INSERT INTO itsm_loop_transition_revision
        (id, transition_id, revision_no, change_type, snapshot_note, snapshot_artifacts, changed_by, changed_at)
    SELECT
        gen_random_uuid()::text,  -- ULID 호환 26자 아님. 아래 ULID 함수 대체 필요
        t.id, 1, 'create', t.note, t.artifacts, t.actor_id, t.transitioned_at
    FROM itsm_loop_transition t
    WHERE NOT EXISTS (SELECT 1 FROM itsm_loop_transition_revision r WHERE r.transition_id = t.id)
    """,
]
```

> **구현 주의**: ULID 는 Python 레이어에서 생성해야 하므로 백필은 SQL 하나가 아닌 **마이그레이션 파이썬 코드에서 루프 + 개별 INSERT** 로 구현. 또는 PG 확장 `pgcrypto` 의 `gen_random_uuid()::varchar` 을 25자 트림 + 접두사 "B" 로 26자 맞추는 것은 **금지**(ULID 포맷 규칙 위반). 결정: **파이썬 루프**.

### 4.4 ORM 변경

- `LoopTransition` 모델에 6개 컬럼 추가
- 신규 모델 `LoopTransitionRevision` (`app/models/loop_revision.py`)
- `app/models/__init__.py` re-export

---

## 5. API 설계

### 5.1 기존 API 변경

#### `GET /api/tickets/{id}/transitions`

Query params 추가:
- `include_deleted: bool = false` — SYSTEM_ADMIN 또는 작성자(자신 것 한정)만 허용
- `with_latest_revision: bool = false` — 응답에 각 이력의 head 리비전 요약 포함

응답 (`LoopTransitionOut` 확장):
```json
{
  "id": "...", "ticket_id": "...", "from_stage": "analyze", "to_stage": "analyze",
  "action": "note", "note": "...", "artifacts": null,
  "actor_id": 12, "actor_name": "홍길동",
  "transitioned_at": "...",
  "deleted_at": null, "deleted_by": null,
  "last_edited_at": "2026-04-22T06:50:00Z", "last_edited_by": 12,
  "edit_count": 2,
  "can_edit": true, "can_delete": true, "can_restore": false
}
```

`can_edit/can_delete/can_restore` 는 백엔드에서 현재 사용자 기준으로 계산.

### 5.2 신규 API

| 메서드 | 경로 | 용도 |
|---|---|---|
| PATCH | `/api/tickets/{tid}/transitions/{rid}` | 본문·artifacts 편집 |
| DELETE | `/api/tickets/{tid}/transitions/{rid}` | soft-delete |
| POST | `/api/tickets/{tid}/transitions/{rid}/restore` | soft-delete 해제 (작성자/admin) |
| GET | `/api/tickets/{tid}/transitions/{rid}/revisions` | 리비전 목록 |
| POST | `/api/tickets/{tid}/transitions/{rid}/revisions/{rev}/revert` | 특정 리비전으로 본문 복원 (새 리비전 기록) |

#### PATCH payload

```json
{ "note": "string|null", "artifacts": {}, "reason": "오타 수정" }
```

#### DELETE response

```json
{ "id": "...", "deleted_at": "...", "revision_no": 3 }
```

#### Revert response

```json
{ "id": "...", "edit_count": 4, "revision_no": 5, "note": "되돌린 본문" }
```

### 5.3 권한 가드 (`access_control` 확장)

```python
def check_transition_edit_access(
    user: User,
    transition: LoopTransition,
    *,
    now: datetime,
    edit_window_minutes: int,
) -> None:
    if user.role == UserRole.SYSTEM_ADMIN:
        return
    if transition.actor_id != user.id:
        raise HTTPException(403, "작성자만 수정 가능")
    if transition.deleted_at is not None:
        raise HTTPException(409, "삭제된 이력은 복원 후 수정")
    if edit_window_minutes > 0:
        age = (now - transition.transitioned_at).total_seconds() / 60
        if age > edit_window_minutes:
            raise HTTPException(423, f"수정 가능 시간({edit_window_minutes}분) 초과")
    if edit_window_minutes < 0:
        raise HTTPException(423, "편집 전면 차단 모드")
```

삭제/복원/리버트도 동일 가드 재사용.

### 5.4 트랜잭션 순서 (편집)

1. BEGIN
2. `SELECT ... FOR UPDATE` 대상 전이 로우
3. 권한/시간창 검사
4. 리비전 행 INSERT (before-image = 현재 `note`/`artifacts`)
5. 전이 행 UPDATE (`note`, `artifacts`, `last_edited_*`, `edit_count += 1`, `head_revision_id = 새 revision id`)
6. v-platform `audit_log` write (별도 서비스 함수)
7. COMMIT

삭제/복원/리버트도 동일 패턴. **6번 실패 시 5번 롤백** — 감사 무결성 우선.

---

## 6. Frontend 설계

### 6.1 Drawer 컴포넌트 (platform/core 신규)

- 파일: `platform/frontend/v-platform-core/src/components/ui/Drawer.tsx`
- Public export: `src/components/ui/index.ts` 에 `export * from './Drawer'`
- Tailwind 클래스만 사용, 외부 애니메이션 라이브러리 미추가
- Storybook/테스트는 기존 Modal 과 동일 수준으로 (Phase 2 에서 보강)

### 6.2 티켓 Detail.tsx 리팩토링

- 기존 `<Modal>` → `<Drawer side="right" size="lg">` 교체
- 상단 버튼 그룹에 사이즈 토글(`lg↔xl↔full`) + 최소화(아이콘) 추가
- Drawer 열린 상태에서 티켓 상단 헤더(ticket_no/title/SLA)는 고정되어 좌측 1/2 에서 계속 스크롤/조회 가능
- 모바일(`< md`): `size="full"` 강제

### 6.3 전이 이력 카드 UI 확장

각 전이 카드에 액션 버튼:
- `편집` (연필 아이콘) — `can_edit=true` 일 때만
- `삭제` (휴지통) — `can_delete=true`
- `이력` (시계) — 모든 사용자 (본인/관리자 편집 여부와 무관하게 리비전 조회는 작성자+관리자)
- `복원` (되돌리기) — `can_restore=true` (soft-deleted 항목)

**soft-deleted 카드** — 흐린 배경 + "삭제됨 · 복원" 링크 + 본문은 숨김 처리. SYSTEM_ADMIN 은 본문 보기 토글.

### 6.4 리비전 조회 UI

- Drawer 안 서브 Drawer 대신 **Dialog(Modal)** 사용 (중첩 Drawer 회피)
- 리비전 목록: `revision_no · change_type · changed_by · changed_at · reason`
- 각 행 "미리보기" (본문 diff 렌더) 와 "이 버전으로 복원" 버튼

**Diff 렌더**: `diff-match-patch` 또는 `diff` npm 패키지. 초기엔 텍스트 diff만 (markdown 렌더 전 비교).

### 6.5 TanStack Query 캐시 키

- `["ticket", id, "transitions", { includeDeleted }]`
- 편집/삭제/복원 mutation 성공 → 위 쿼리 + `["ticket", id]` invalidate
- 리비전 목록: `["ticket", id, "transitions", rid, "revisions"]`

### 6.6 Optimistic update

- 편집: 편집 모달 저장 시 낙관적 패치 → 실패 시 롤백 + 토스트
- 삭제: soft-delete 즉시 반영, 실패 시 원복
- 복원: 동일 패턴

---

## 7. 단계별 작업 계획

### Phase A — Platform Drawer 컴포넌트 (사용자 사전 승인 필요)

**이유**: platform public API 추가는 CLAUDE.md "사용자 승인 필요" 항목.

1. `platform/frontend/v-platform-core/src/components/ui/Drawer.tsx` 작성
2. `src/components/ui/index.ts` export 추가
3. `@v-platform/core` 빌드 (`npm run build`)
4. 앱 프론트엔드 재빌드 (`docker compose build itsm-frontend`)
5. 로그인→임의 티켓 상세에서 Drawer 가 기존 Modal 과 공존해도 문제없는지 스모크

### Phase B — 백엔드 데이터 모델 + API

1. 마이그레이션 `a010_transition_edit_restore.py`
   - ALTER 6개 컬럼, 인덱스 2개
   - `itsm_loop_transition_revision` CREATE
   - 기존 전이 이력에 revision_no=1 백필 (파이썬 루프)
2. ORM — `LoopTransition` 필드 추가 + `LoopTransitionRevision` 신규 모델
3. `app/services/transition_service.py` (신규) — edit / delete / restore / revert / list_revisions / _record_revision
4. `access_control.check_transition_edit_access` 추가
5. `app/schemas/transition.py` — 입력/출력 스키마
6. `app/api/transitions.py` (신규 라우터) — 5개 엔드포인트
7. `tickets.py` — `/transitions` GET 응답에 soft-delete/권한 플래그 확장
8. `main.py` 라우터 등록

### Phase C — 프런트엔드 UI

1. `apps/v-itsm/frontend/src/lib/api/tickets.ts` — 신규 5개 API 래퍼
2. `apps/v-itsm/frontend/src/lib/api/itsmTypes.ts` — 타입 확장 (+ revision 타입)
3. `pages/tickets/Detail.tsx`
   - Modal → Drawer 교체
   - 이력 카드에 편집/삭제/복원/이력 버튼 + Deleted 상태 UI
4. 신규 컴포넌트
   - `components/tickets/TransitionEditDrawer.tsx` (편집용)
   - `components/tickets/TransitionRevisionsDialog.tsx`
5. TanStack Query 훅 (`useEditTransition`, `useDeleteTransition`, `useRestoreTransition`, `useRevertTransition`, `useTransitionRevisions`)
6. Diff 렌더 — `diff` npm 추가 (경량, MIT)

### Phase D — 검증

1. 마이그레이션 멱등성: 두 번 실행 → 변화 없음
2. 기존 전이 데이터 백필 확인 (`SELECT count(*) FROM itsm_loop_transition_revision` ≥ 기존 이력 수)
3. 컨테이너 재기동 후 헬스
4. 수동 smoke:
   - note 등록 → 편집 → 본문 변경 반영, edit_count=1
   - 다시 편집 → edit_count=2, 리비전 3건(create/edit/edit)
   - 삭제 → deleted_at 설정, 목록에서 숨김
   - 복원 → 원복
   - 시간창 초과(환경변수 1분으로 설정) → 423 반환
   - 타 사용자 편집 시도 → 403
   - SYSTEM_ADMIN 로그인 시 `include_deleted=true` 동작
   - 리비전 목록 조회 및 특정 리비전 복원 → 새 revision 추가됨
5. v-platform audit_log 에 `action=transition.edit` 등 기록 확인
6. Drawer 사이즈 토글/ESC/배경클릭/포커스 트랩 정상

### Phase E — 문서·정리 ✅ (완료, 2026-04-22)

1. ✅ 본 설계 문서 v1.0 (확정) 으로 승격 — 미결 질문 Q1~Q5 결론 반영, D5 편집 시간창 기본값 `0` (무제한) 확정
2. ✅ `V_ITSM_DESIGN.md` §4.1.2 에 6개 컬럼 + `itsm_loop_transition_revision` 테이블 추가, §4.4 "전이 편집 정책" 신설, §14 v0.3 변경 이력 추가
3. ✅ 작업 이력 블로그: `docusaurus/blog/work-history/2026-04-22-loop-transition-editing.md`

---

## 8. 리스크 & 대안

| # | 리스크 | 완화 |
|---|---|---|
| R1 | Drawer 승격이 다른 앱에 영향 | Modal 은 그대로 유지, Drawer 는 **추가 only**. 앱은 자발적 채택. |
| R2 | 리비전 테이블 크기 증가 | 리비전은 append-only · 단순 스냅샷. Phase 2 에서 90일 후 압축(snapshot dedup + zstd) 고려. |
| R3 | 편집 시간 창이 실무와 안 맞음 | 환경변수로 조정 가능. 운영 피드백 후 기본값 재조정. |
| R4 | 동시 편집 충돌 | `SELECT ... FOR UPDATE` + `If-Match: last_edited_at` 헤더로 409 반환. Phase 1 은 last-write-wins + 토스트 경고. |
| R5 | 복원 시 현재 값과 동일 | 리비전 no-op 저장 금지 체크(hash 비교). |
| R6 | "처리 내용" 외 advance/reject 편집이 감사 측면 위험 | 편집 범위를 `note/artifacts` 로만 한정(§3 D2). `action`/`to_stage` 는 영구 불변. |
| R7 | SYSTEM_ADMIN 남용 | audit_log 에 admin override 플래그(`metadata.admin_override=true`) 기록, 별도 대시보드에서 조회 |
| R8 | 기존 티켓 이력 대량 백필 성능 | 트랜잭션 단위로 1000건씩 커밋. 마이그레이션 로그로 진행률 표시 |

---

## 9. 확정 사항 (v1.0 결정)

> 초안(v0.1)의 미결 질문 Q1~Q5 에 대한 구현 시점 확정 결론.

1. **Q1. Drawer 승격 → ✅ 승인**. `platform/frontend/v-platform-core/src/components/ui/Drawer.tsx` 신규 + `index.ts` export. Modal 은 그대로 유지(추가 only). v-itsm 티켓 Detail 이 첫 소비자.
2. **Q2. 편집 시간 창 기본값 → 0 (무제한)**. 초안은 24h(1440)였으나 작성자 본인 한정(D4) + audit 이중 기록(D7) 으로 위변조 리스크가 통제되어, 기본은 열어두고 엄격 모드가 필요한 운영은 환경변수로 제한한다. `.env.example` 에 `ITSM_TRANSITION_EDIT_WINDOW_MINUTES=0` 기본.
3. **Q3. '감독자 역할' 편집 권한 → Phase 2 로 이월**. 현재 구현은 `작성자 본인 + SYSTEM_ADMIN` 두 경로만 허용. 필요 시 `manage_transitions` 플래그 또는 `scope_level="admin"` 도입은 별도 RFC.
4. **Q4. 리비전 diff 렌더 → Phase 1 은 diff 생략, 전체 스냅샷 본문 표시**. `TransitionRevisionsDialog` 는 각 리비전의 `snapshot_note` 를 `MarkdownView` 로 렌더하고 "되돌리기" 버튼만 제공. diff 라이브러리 추가는 Phase 2.
5. **Q5. `artifacts` 편집 UI → API 만 열고 UI 는 Phase 2**. 현 `TransitionEditDrawer` 는 `note` 편집 + `reason` 사유만 노출. `artifacts` 는 `PATCH /transitions/{id}` payload 에 포함 가능하나 UI 폼은 Phase 2.

### 9.1 추가 확정 사항 (구현 중 결정)

- **CSRF 보호**: PATCH/DELETE/POST 전이 API 는 v-platform Double Submit Cookie CSRF 미들웨어 하에서 동작. 프론트는 `csrf_token` 쿠키를 `X-CSRF-Token` 헤더로 재전송(`apiClient` 인터셉터 기본 처리).
- **Restore 는 리비전 기록**: Soft-delete 해제 시에도 `change_type='restore'` 리비전을 남긴다(Phase D 스모크로 검증 완료 — 5회 리비전 체인 create→edit→delete→restore→revert).
- **Revert 동작**: `revision_no` 를 지정해 되돌리면 해당 스냅샷의 `note`/`artifacts` 로 UPDATE + 새 리비전 `change_type='revert'` 생성. `parent_revision_id` 에 원본 리비전 참조.
- **UI 플래그 서버 계산**: `can_edit / can_delete / can_restore` 는 백엔드가 현재 사용자(actor vs SYSTEM_ADMIN) + `deleted_at` 기준으로 계산해 응답에 포함.
- **Drawer `hideBackdrop` 기본 false**: 초기 구현은 배경 모달과 동일 UX 로 시작. 도킹 모드는 후속 피드백 후 결정.

---

## 10. 영향받는 파일 (요약)

### 신규

```
platform/frontend/v-platform-core/src/components/ui/Drawer.tsx
apps/v-itsm/backend/migrations/a010_transition_edit_restore.py
apps/v-itsm/backend/app/models/loop_revision.py
apps/v-itsm/backend/app/services/transition_service.py
apps/v-itsm/backend/app/schemas/transition.py
apps/v-itsm/backend/app/api/transitions.py
apps/v-itsm/frontend/src/components/tickets/TransitionEditDrawer.tsx
apps/v-itsm/frontend/src/components/tickets/TransitionRevisionsDialog.tsx
docusaurus/blog/work-history/2026-04-22-itsm-transition-editing.md
```

### 수정

```
platform/frontend/v-platform-core/src/components/ui/index.ts      # Drawer export
apps/v-itsm/backend/app/models/loop.py                             # +6 컬럼
apps/v-itsm/backend/app/models/__init__.py                         # re-export
apps/v-itsm/backend/app/services/access_control.py                 # +check_transition_edit_access
apps/v-itsm/backend/app/services/ticket_service.py                 # transition() 에 revision create 삽입
apps/v-itsm/backend/app/api/tickets.py                             # GET transitions 응답 확장
apps/v-itsm/backend/app/main.py                                    # 라우터 등록
apps/v-itsm/frontend/src/pages/tickets/Detail.tsx                  # Modal→Drawer 교체, 편집/삭제/이력 버튼
apps/v-itsm/frontend/src/lib/api/tickets.ts                        # 5개 신규 API
apps/v-itsm/frontend/src/lib/api/itsmTypes.ts                      # 타입 확장
docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md                # §4.1.2 필드·§4.4 편집 정책
```

### 환경

```
apps/v-itsm/.env.example                                           # ITSM_TRANSITION_EDIT_WINDOW_MINUTES=0  (기본 무제한)
```

---

## 11. 결정 요약 (이 문서가 전달하는 한 줄)

> "Loop 전이 이력은 더 이상 append-only 가 아닌, **작성자 소유 + 리비전 보존 + 복원 가능**한 편집 객체로 격상한다. UX 는 platform 공통 Drawer 로 넓은 작업 공간을 제공한다. 모든 변경은 리비전+audit_log 로 이중 감사되어 무결성을 유지한다."
