---
slug: v-itsm-loop-transition-editing
title: v-itsm — Loop 전이 이력 편집·삭제·복원·리비전 도입
authors: [bong78]
tags: [v-itsm, loop, transition, revision, drawer, v-platform-core]
date: 2026-04-22
---

# v-itsm — Loop 전이 이력 편집·삭제·복원·리비전 도입

v-itsm 의 5단계 업무 루프 전이 기록을 **사후 편집·삭제·복원** 가능하도록 확장하고, 모든 변경을 append-only 리비전 체인으로 추적한다. 부가로 `@v-platform/core` 에 **Drawer** 컴포넌트를 신규 승격했다.

<!-- truncate -->

## 배경

Phase 1 에서 구현된 `itsm_loop_transition` 은 FSM 상 단방향 append-only 로그였다. 실사용에서 다음 요구가 나왔다:

- **오타 수정**: 전이 시 남긴 처리 내용/메모를 나중에 고칠 수 있어야 함
- **오탈자/잘못된 전이 회수**: 소프트 삭제(취소선 표시) 후 복원 가능해야 함
- **이력 추적**: 언제 누가 무엇을 바꿨는지 감사 가능해야 함
- **되돌리기(revert)**: 특정 리비전으로 스냅샷 복귀

기존 로그 구조를 파괴하지 않으면서 위 네 가지를 만족해야 했다.

## 핵심 설계 결정

| 주제 | 결정 | 근거 |
|---|---|---|
| 이력 저장 방식 | **append-only 리비전 체인** (`itsm_loop_transition_revision`) | 편집 자체를 지우지 않아야 감사/컴플라이언스 만족 |
| 소프트 삭제 | `deleted_at` / `deleted_by` 만 채움, 본체는 유지 | 복원 시 본체 교체 없이 NULL 복귀로 즉시 회복 |
| 권한 | **본인만 편집/삭제/복원** + SYSTEM_ADMIN 우회 | 감독자 역할(Phase 2 로 이관)은 현 단계 범위 밖 |
| 편집 창 | **무제한 기본값** (`ITSM_TRANSITION_EDIT_WINDOW_MINUTES=0`) | 초안에선 1440 분이었으나 운영 요구로 제한 해제, 필요 시 환경변수로 부여 |
| Diff 표시 | **스냅샷 전체 Markdown 뷰** | 단계별 처리 내용은 문단형이라 토큰 단위 diff 효용 낮음 |
| UI 컨테이너 | **Drawer(우측 슬라이드)** | Modal 보다 긴 폼 편집에 적합, `@v-platform/core` 로 승격해 타 앱도 재사용 |
| revert 동작 | 대상 리비전의 snapshot 으로 덮고 **revert 리비전 1건 추가** | 시점 이동이 아닌 "그 시점 내용으로 새 편집" 모델 |

## 구현 개요

### 스키마 (마이그레이션 a010)

`itsm_loop_transition` 에 6 컬럼 추가:

```sql
deleted_at        TIMESTAMPTZ NULL,
deleted_by        INTEGER     NULL REFERENCES users(id),
last_edited_at    TIMESTAMPTZ NULL,
last_edited_by    INTEGER     NULL REFERENCES users(id),
edit_count        INTEGER     NOT NULL DEFAULT 0,
head_revision_id  VARCHAR(26) NULL
```

신규 테이블 `itsm_loop_transition_revision`:

```sql
id                  VARCHAR(26)  PK,
transition_id       VARCHAR(26)  FK  REFERENCES itsm_loop_transition(id),
revision_no         INTEGER      NOT NULL,
change_type         VARCHAR(16)  NOT NULL,   -- create|edit|delete|restore|revert
snapshot_note       TEXT         NULL,
snapshot_artifacts  JSONB        NULL,
changed_by          INTEGER      NULL REFERENCES users(id),
changed_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
reason              TEXT         NULL,
parent_revision_id  VARCHAR(26)  NULL,
UNIQUE (transition_id, revision_no)
```

`revision_no` 는 `coalesce(max(revision_no), 0) + 1` 로 서버 계산. PK 는 ULID.

### API

| 메서드 | 경로 | 동작 |
|---|---|---|
| `PATCH` | `/api/tickets/{tid}/transitions/{id}` | note/artifacts 편집 → `edit` 리비전 |
| `DELETE` | `/api/tickets/{tid}/transitions/{id}` | 소프트 삭제 → `delete` 리비전 |
| `POST` | `/api/tickets/{tid}/transitions/{id}/restore` | 복원 → `restore` 리비전 |
| `GET` | `/api/tickets/{tid}/transitions/{id}/revisions` | 리비전 체인 조회 |
| `POST` | `/api/tickets/{tid}/transitions/{id}/revisions/{no}/revert` | 지정 리비전 스냅샷으로 덮기 → `revert` 리비전 |

모든 변경 API 는 CSRF Double Submit Cookie(`csrf_token` cookie + `X-CSRF-Token` header) 검증을 통과해야 한다. 서버는 목록 응답에 `can_edit` / `can_delete` / `can_restore` 플래그를 실사용자 권한 기준으로 미리 계산해 내려준다.

### 프런트엔드

- `@v-platform/core` 에 `Drawer` 컴포넌트 추가 (side=right, size md/lg/xl/full, 포커스 트랩 포함)
- `TransitionEditDrawer.tsx` — RichEditor(TipTap) 로 note 편집, 사유 입력
- `TransitionRevisionsDialog.tsx` — 리비전을 revision_no DESC 로 나열, 각 리비전에 "되돌리기" 액션
- TanStack Query 캐시 키: `["ticket", id, "transitions", { includeDeleted }]`

## 스모크 검증

단일 전이에 대해 다음 5 단계 리비전 체인을 확인:

| # | 동작 | change_type | edit_count |
|---|---|---|---|
| 1 | 전이 생성 | `create` | 0 |
| 2 | note 편집 | `edit` | 1 |
| 3 | 소프트 삭제 | `delete` | 1 |
| 4 | 복원 | `restore` | 1 |
| 5 | #2 로 되돌리기 | `revert` | 2 |

- 권한 검증: 다른 사용자로 `PATCH` → `403`; SYSTEM_ADMIN → 통과
- 삭제된 전이는 목록 기본 응답에서 숨김, `?include_deleted=true` 로만 노출
- CSRF 토큰 미포함 요청 → `403`

## 플랫폼 승격: Drawer

`Modal` 은 중앙 고정·짧은 폼에 맞지만, 루프 전이 편집처럼 **긴 폼 + 원문 참조** 시나리오엔 우측 슬라이드 Drawer 가 적합했다. 다른 앱(v-platform-portal, v-platform-template)에서도 동일 패턴이 재현될 소지가 커 **`@v-platform/core` 로 승격**했다.

API 골격:

```tsx
<Drawer
  isOpen={open}
  onClose={handleClose}
  title="전이 편집"
  size="lg"            // md|lg|xl|full
  side="right"         // left|right
  hideBackdrop={false} // 편집 중 배경 상호작용 차단
  footer={<DrawerFooter onCancel={handleClose} onConfirm={handleSubmit} loading={submitting} />}
>
  {/* 폼 */}
</Drawer>
```

## 후속 작업

- **Phase 2**: 감독자(supervisor) 역할로 타인 전이 편집 허용
- **Phase 2**: artifacts 편집 UI (현재 API 는 개방, UI 미제공)
- **Phase 2**: 리비전 간 diff 렌더러 (현재는 전체 스냅샷 Markdown 뷰)

## 참고 문서

- 상세 설계: `docusaurus/docs/apps/v-itsm/design/LOOP_TRANSITION_EDITING_DESIGN.md` (v1.0)
- 앱 개요: `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` §4.1.2, §4.4 (v0.3)
- 마이그레이션: `apps/v-itsm/backend/migrations/a010_loop_transition_revisions.py`
