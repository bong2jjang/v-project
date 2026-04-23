---
title: v-itsm AI 어시스턴트 설계 문서
description: 업무 루프 전 과정에서 자연어로 화면 기능을 조작하는 플로팅 챗봇 + AI 자동 분류·답변 초안·유사 티켓·지식 요약 설계
---

# v-itsm — AI 어시스턴트 설계 (AI Assistant & Natural-Language Agent)

**상태**: Draft v0.2
**작성일**: 2026-04-23 (v0.1 초안) / 2026-04-23 (v0.2 결정 반영)
**작성자**: v-project 팀
**영향 범위**: `apps/v-itsm` + **`platform/v_platform/llm`** (BaseLLMProvider 승격) + `AuditAction` enum 확장. v-ui-builder 의 UI 레이어(ChatPane/Hooks/Gen-UI) 는 **copy-not-import**.
**선행 문서**:
- [V_ITSM_DESIGN.md](./V_ITSM_DESIGN.md) v0.2 §8 (AI 재사용 스코프)
- [V_ITSM_OPERATIONS_CONSOLE_DESIGN.md](./V_ITSM_OPERATIONS_CONSOLE_DESIGN.md) v0.1
- `apps/v-ui-builder/CLAUDE.md` (Provider Pattern, Generative UI, ui_action 프로토콜)

---

## 1. 목적 & 배경

v-itsm 은 접수→분석→실행→검증→답변의 5단계 업무 루프를 반복 수행하는 앱이다. 업무의 대부분은 **정형 데이터(티켓)** 와 **비정형 대화(고객·내부 협업)** 사이를 빠르게 오가는 것이며, 이 사이를 AI 로 좁혀주면 다음 구체적 이득이 생긴다.

1. **접수 속도** — 제목/본문을 읽고 고객/제품/카테고리/우선순위를 사람이 고르지 않아도 AI 가 제안 → 원클릭 수락
2. **응답 품질 편차 최소화** — 신규 담당자도 유사 사례와 답변 초안 제시로 평균 응답 품질 상승
3. **지식의 순환** — 닫힌 티켓에서 자동으로 지식 항목(요약/재발 방지 포인트) 추출
4. **화면 학습 비용 축소** — "고객 ACME 에 대한 이번 주 오픈 티켓 보여줘", "이 티켓 상태를 execute 로 옮겨줘", "이 고객에 대한 SLA 정책 만들어줘" 같은 명령을 **어느 페이지에서든** 자연어로 수행

본 설계는 두 축으로 구성된다.

| 축 | 설명 | 형태 |
|---|---|---|
| **A. Passive AI** | 티켓 단위로 AI 가 제안을 생성·기록하고 담당자가 수락/수정 | 배너·사이드 패널·드로어 |
| **B. Natural-Language Agent** | 화면 어디서든 챗봇을 열어 자연어로 기능 호출 (read-only 우선, 위험 작업은 확인 필수) | 전역 플로팅 챗 패널 |

두 축은 동일한 백엔드 `POST /api/ai/chat` SSE 엔드포인트, 동일한 LLM provider, 동일한 감사·스코프 체계 위에서 동작한다.

### 1.1 설계 원칙

1. **copy-not-import (UI 레이어)** — v-ui-builder 의 `ChatPane.tsx` / `useChatStream.ts` / `useUiAction.ts` / `gen-ui/*` / `ui_tools/registry` 는 **소스 포팅**하여 v-itsm 네임스페이스에 편입한다. 런타임 HTTP/모듈 의존 없음. (v0.2 결정 4·5)
2. **LLM Provider 는 플랫폼 승격** — `BaseLLMProvider` / `OpenAIProvider` / `resolve_provider` 는 `platform/backend/v_platform/llm/` 으로 이전되어 v-itsm 과 v-ui-builder 가 **import** 로 공유한다. 2앱 이상 사용 + 공통 도메인 개념 신호 충족(루트 CLAUDE.md §"플랫폼 승격 판단"). (v0.2 결정 1)
3. **최소한의 플랫폼 변경** — 앱 상태는 `itsm_` 접두사 테이블. 플랫폼 변경은 오직 두 가지: ① `v_platform.llm` 모듈 신설, ② `AuditAction` enum 확장(§10 참조). 그 외 플랫폼 공통 테이블·스키마는 건드리지 않는다.
4. **휴먼-인-더-루프 기본값** — AI 출력은 "제안" 상태로 보존된다. 고객 외부로 나가는 모든 텍스트(Slack/Teams/Email)는 반드시 사람이 승인. 에이전트의 파괴적 작업(상태 전이, 대량 업데이트, 설정 변경)은 **확인 카드**를 거친다.
5. **스코프 준수** — 에이전트는 호출자의 `itsm_scope_grant` 범위 안에서만 데이터를 조회/수정한다. SYSTEM_ADMIN 은 전권.
6. **프롬프트·툴 버저닝** — 모든 시스템 프롬프트와 tool schema 는 `prompt_ref` 값으로 감사 로그에 보존되어 회귀 원인 추적 가능.
7. **외부 LLM 최소 의존** — MVP 는 OpenAI 호환 provider 하나만. 추후 Anthropic / Azure OpenAI / Local 모델을 provider 교체로 확장.

---

## 2. 범위

### 2.1 포함 (MVP — Phase A)

| # | 기능 | 축 | 비고 |
|---|---|---|---|
| F1 | **티켓 자동 분류** | A | 제목+본문 → category_l1/l2 + priority 제안, 접수 직후 배너 |
| F2 | **답변 초안 생성** | A | Answer 단계에서 ChatPane 우측 패널에 고객용 초안 |
| F3 | **유사 티켓 검색** | A | Ticket Detail 사이드바. Phase A 는 LIKE/tsvector 기반, 임베딩은 Phase B |
| F4 | **해결 요약** | A | closed 전이 시 자동 호출, KB 엔트리 후보 생성 |
| F5 | **전역 플로팅 챗 패널** | B | 모든 페이지에서 토글 가능. 페이지 컨텍스트+선택 컨텍스트 자동 주입 |
| F6 | **읽기 전용 툴 카탈로그** | B | `search_tickets`, `get_ticket`, `list_customers`, `get_sla_policy`, `get_audit_log` 등 |
| F7 | **네비게이션 툴** | B | `open_ticket(id)`, `open_kanban(filter)`, `open_drawer(kind, id)` (프런트엔드 브리지) |

### 2.2 포함 (Phase B — 에이전트 확장)

| # | 기능 | 비고 |
|---|---|---|
| F8 | **안전한 변경 툴** | `update_ticket_priority`, `assign_ticket`, `transition_ticket` → 확인 카드 필수 |
| F9 | **임베딩 기반 유사 검색** | pgvector 또는 외부 vector store (결정 §14) |
| F10 | **SLA 정책/티어 CRUD 툴** | 운영 콘솔 API 래핑, SYSTEM_ADMIN 확인 이중 |
| F11 | **템플릿/매크로 호출** | 잦은 답변 패턴 저장·재사용 |

### 2.3 제외 (차기 Phase 이후)

- 외부 인터넷 검색 툴
- 고객에게 **직접 발송**되는 자동 응답 (항상 사람 승인 경유)
- LLM 으로부터의 **데이터 삭제 작업** — MVP 에서는 일체 노출하지 않음
- 멀티모달(첨부 이미지 OCR 등) — 첨부 텍스트 추출은 서버 측에서 별도 단계로 주입

---

## 3. UX 설계

### 3.1 전역 플로팅 챗 패널

- **마운트 위치**: `<PlatformProvider>` 하위, 라우트와 무관하게 최상단에 고정. 로그인된 사용자에게만 표시.
- **토글 UI**:
  - 우하단 FAB 버튼(아이콘 `Bot`). 미사용 시 접힘.
  - 단축키 `Ctrl/Cmd + J` 로 열기/닫기.
  - 드로어 형태로 우측 400~480px 폭, `resize` 가능. 모바일에서는 전체화면.
- **상태 보존**: 패널을 닫아도 **세션 중에는** 대화 컨텍스트 유지. 새로고침 시에만 리셋 (MVP).
- **열린 상태에서의 뱃지**: 활성 페이지의 컨텍스트 칩 — 예) `📍 /tickets?status=open` + `🧷 3 selected`.
- **입력 영역**: 텍스트 + Shift+Enter 줄바꿈, `@` 로 퀵 레퍼런스(@내_티켓, @선택항목, @이_페이지), `/` 로 명령어 팔레트.

### 3.2 페이지 컨텍스트 주입

- 각 페이지가 **라우트 진입 시** `ChatContext` store 에 현재 컨텍스트를 등록:
  ```ts
  registerPageContext({
    page: "tickets.list",
    route: "/tickets",
    filters: { status: "open", assignee_id: me.id },
    selection: [], // 사용자가 체크박스로 선택한 것
  });
  ```
- 챗 패널에서 메시지 전송 시 이 컨텍스트가 system prompt 에 **비동기 스냅샷** 형태로 동봉된다. 챗봇이 "이 페이지" / "선택한 것" 을 물으면 해당 슬롯을 채운다.
- 사용자가 페이지를 이동하면 이전 `page_context` 는 대화 히스토리에 `[context switch]` 마커로 남는다.

### 3.3 선택 컨텍스트

- 리스트/칸반/테이블 페이지에서 행 선택 시 `updateSelection([{kind, id, label}])` 호출.
- Ticket Detail 페이지는 자동으로 해당 티켓 1건을 selection 에 포함.
- 챗봇 입력창 우측에 "선택 3건 포함" 토글 — 끄면 컨텍스트 미주입.

### 3.4 Passive AI (축 A) UX

| 기능 | 진입점 | 인터랙션 |
|---|---|---|
| F1 자동 분류 | Intake 폼 제출 후 | 배너 "AI 제안: 카테고리=네트워크, 우선순위=High · [수락] [수정] [무시]" |
| F2 답변 초안 | Ticket Detail → Answer 탭 | 오른쪽 ChatPane 패널. 초기 질문 자동 생성 "이 티켓에 대한 고객 응답 초안을 만들어줘" |
| F3 유사 티켓 | Ticket Detail 사이드바 | Top 5 카드. "이 사례 열기", "이 해결 방법 요약하기" |
| F4 해결 요약 | closed 전이 시 모달 | "지식 항목 초안이 생성되었습니다. 검토 후 저장하세요." |

### 3.5 Agent 확인 카드 (Phase B)

파괴적/외부 영향 툴을 호출하기 전 Generative UI 카드 형태로 렌더:

```
┌ 작업 확인 ─────────────────────┐
│ 티켓 T-1234 의 우선순위를       │
│ Normal → High 로 변경합니다.   │
│                                │
│ 사유(선택): [ _____________ ]  │
│  [취소]          [실행]        │
└────────────────────────────────┘
```

- 실행 시 `ui_action` 스타일 follow-up 이벤트로 서버가 실제 변경 수행. 감사 로그에 `prompt_ref` + `tool_call_id` + `before/after` 저장.

---

## 4. 아키텍처

### 4.1 하이레벨

```
┌─ Frontend (v-itsm) ───────────────────────────────────────┐
│  <PlatformProvider>                                        │
│   ├─ <Routes …>                                            │
│   └─ <FloatingChatDock>              ← 전역 마운트          │
│        ├─ ChatContextProvider        (page + selection)     │
│        └─ <ChatPane scope="itsm">                          │
│             ├─ useChatStream()       (SSE 수신)             │
│             ├─ useUiAction()         (follow-up 이벤트)     │
│             └─ <MessageList/>  <Composer/>                 │
└────────────────────────────────────────────────────────────┘
           │ SSE (EventSource POST: /api/ai/chat)
           ▼
┌─ Backend (v-itsm FastAPI) ─────────────────────────────────┐
│  /api/ai/chat           (SSE stream)                        │
│    └─ chat_orchestrator                                     │
│         ├─ prompt_builder  (system + page_ctx + selection)  │
│         ├─ BaseLLMProvider (OpenAI stream + tool-calling)   │
│         ├─ tool_registry   (read/action tiers)              │
│         └─ audit_logger    (itsm_ai_suggestion + AuditLog)  │
│                                                              │
│  /api/ai/ui-action      (SSE stream, ui_action follow-up)   │
│    └─ tool_registry.invoke_action(call_id, action, args)    │
│                                                              │
│  /api/ai/suggestions/*  (Passive 제안 CRUD + 수락/거절)     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 핵심 컴포넌트

**Frontend (`apps/v-itsm/frontend/src/ai/`)**
- `ChatContext.tsx` — `page`, `selection`, `history` Zustand store.
- `FloatingChatDock.tsx` — FAB + 드로어, 단축키 바인딩.
- `ChatPane.tsx` — v-ui-builder 에서 포팅. `scope="itsm"`.
- `MarkdownMessage.tsx` — 포팅.
- `GenUiRenderer.tsx` — 확인 카드/유사 티켓 카드 등 렌더.
- `hooks/useChatStream.ts` — 포팅. 엔드포인트만 `/api/ai/chat` 로 변경.
- `hooks/useUiAction.ts` — 포팅. follow-up SSE 처리.
- `tools/clientTools.ts` — 프런트엔드 전용 툴(네비게이션/드로어 오픈) 구현.

**Platform (`platform/backend/v_platform/llm/`)** — v0.2 결정 1: 플랫폼 승격
- `base.py` — `BaseLLMProvider` 추상 (v-ui-builder 에서 승격). `stream(messages, tools) -> AsyncIterator[LLMChunk]` 계약.
- `openai_provider.py` — `AsyncOpenAI` + stream + tool_calls 파싱.
- `registry.py` — `resolve_provider(name: str) -> BaseLLMProvider`.
- v-ui-builder 는 기존 `apps/v-ui-builder/backend/app/llm/` 제거 후 `from v_platform.llm import ...` 로 전환.

**Backend (`apps/v-itsm/backend/app/ai/`)**
- (provider 는 플랫폼에서 import — 앱 내부 provider 디렉터리 없음)
- `tools/base.py` — Tool 추상(`schema`, `invoke(args, ctx)`, 선택적 `invoke_action()` for UI follow-up).
- `tools/catalog.py` — 툴 등록 테이블 (tier: `read` | `action` | `admin`).
- `tools/read_tools.py` — F6 읽기 툴들.
- `tools/nav_tools.py` — F7 (프런트엔드 브리지 — 서버는 "의도만" 반환, 실제 이동은 클라이언트).
- `tools/action_tools.py` — F8 Phase B.
- `prompt_builder.py` — 시스템 프롬프트 + 페이지 컨텍스트 + 선택 컨텍스트 + 사용자 스코프 합성.
- `chat_orchestrator.py` — LLM stream + tool 해결 + SSE 이벤트 방출.
- `suggester.py` — Passive F1~F4 호출 헬퍼 (티켓 서비스에서 사용).

**공통 API (`apps/v-itsm/backend/app/api/ai.py`)**
- `POST /api/ai/chat` — Natural-language agent 채팅.
- `POST /api/ai/ui-action` — 확인 카드의 후속 액션.
- `GET /api/ai/tools` — 현재 사용자가 호출 가능한 툴 카탈로그 + 스키마 (프런트 힌트/디버그).
- `POST /api/ai/suggestions/{ticket_id}/{kind}` — Passive 제안 생성 (동기/비동기 옵션).
- `POST /api/ai/suggestions/{id}/accept` / `/reject` — 수락·거절 기록.

### 4.3 재사용 매트릭스

| v-ui-builder 자산 | v-itsm 에서의 취급 | 비고 |
|---|---|---|
| `components/builder/ChatPane.tsx` | 포팅 → `ai/ChatPane.tsx` | scope 파라미터 제거, scope="itsm" 고정 |
| `components/builder/MarkdownMessage.tsx` | 포팅 | 그대로 |
| `components/builder/gen-ui/*` | **전체 포팅** | `WidgetProposalCard` 포함 전 카드 + `ConfirmationCard` / `SimilarTicketCard` 신규 (v0.2 결정 4 — 풀 Gen-UI 포팅) |
| `hooks/useChatStream.ts` | 포팅 | endpoint 인자화 |
| `hooks/useUiAction.ts` | 포팅 | 그대로 |
| `app/llm/base.py` + `openai_provider.py` | **플랫폼 승격** → `v_platform/llm/` | v-ui-builder 도 전환 대상. 양쪽 앱에서 `from v_platform.llm import ...` 로 공유 (v0.2 결정 1) |
| `app/ui_tools/base.py` + `registry.py` | 포팅 → `app/ai/tools/` | tier 개념 추가 |
| `app/api/ui_action.py` 구조 | 참조 | v-itsm 의 `/api/ai/ui-action` 구현 모델 |

> **왜 copy-not-import (UI) + 플랫폼 승격 (LLM)** 혼합인가:
> - **UI 레이어 (ChatPane / hooks / gen-ui)** 는 각 앱이 자체 스타일·컨텍스트·라우팅과 밀접 → 복제가 드리프트 비용보다 싸다. v-ui-builder 가 꺼져도 v-itsm 동작해야 함(`apps/v-itsm/CLAUDE.md §5`).
> - **LLM Provider** 는 순수 인프라 계약(stream/tool_calls 추상). 두 앱이 동일 API 를 반복 구현할 이유 없음 → 플랫폼 승격. 루트 CLAUDE.md §"플랫폼 승격 판단" 신호 #1(2+ 앱) + #2(공통 도메인) 충족.

---

## 5. 데이터 모델

### 5.1 신규 테이블 (a014 마이그레이션)

#### 5.1.1 `itsm_ai_suggestion` (모델 이미 존재, 마이그레이션만 추가)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(26) PK | ULID |
| `ticket_id` | VARCHAR(26) FK → `itsm_ticket.id` ON DELETE CASCADE | NULL 가능 — 페이지 전역 제안(티켓 무관)은 NULL |
| `kind` | VARCHAR(30) NOT NULL | `classify` \| `draft_reply` \| `similar_tickets` \| `closure_summary` \| `agent_turn` |
| `prompt_ref` | VARCHAR(100) | 프롬프트 버전 태그 (예: `classify.v1`) |
| `result` | JSONB NOT NULL | 제안 본체 + 토큰/모델/지연시간 메타 |
| `accepted` | BOOLEAN NULL | `NULL`=미처리, `true`=수락, `false`=거절 |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

인덱스: `ix_itsm_ai_suggestion_ticket(ticket_id, created_at)`, `ix_itsm_ai_suggestion_kind(kind)`.

#### 5.1.2 `itsm_ai_chat_session`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(26) PK | ULID |
| `user_id` | INTEGER FK → `users.id` ON DELETE CASCADE | |
| `title` | VARCHAR(200) | 첫 메시지 기반 자동 생성 |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

#### 5.1.3 `itsm_ai_chat_message`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | VARCHAR(26) PK | |
| `session_id` | VARCHAR(26) FK → `itsm_ai_chat_session.id` ON DELETE CASCADE | |
| `role` | VARCHAR(20) | `system` \| `user` \| `assistant` \| `tool` |
| `content` | TEXT | |
| `tool_calls` | JSONB NULL | assistant 메시지의 툴 호출 목록 |
| `tool_call_id` | VARCHAR(100) NULL | role=tool 메시지의 링크 |
| `ui_calls` | JSONB NULL | Generative UI 렌더 메타(확인 카드 상태 보존) |
| `prompt_ref` | VARCHAR(100) NULL | |
| `token_usage` | JSONB NULL | `{prompt, completion, total, model, latency_ms}` |
| `page_context` | JSONB NULL | 당시의 page + selection 스냅샷 |
| `created_at` | TIMESTAMPTZ NOT NULL | |

인덱스: `ix_itsm_ai_chat_message_session(session_id, created_at)`.

> **v0.2 결정 3 — Phase A 부터 DB 영속화 기본**: 사용자 첫 메시지 시점에 `itsm_ai_chat_session` 1행 생성, 턴마다 user/assistant/tool 메시지를 즉시 commit. 페이지 새로고침 후 세션 복구도 Phase A 범위에 포함. 감사 요구·디버깅·재현성 확보가 Phase A 가치의 일부로 판단됨. (이전 v0.1 의 "in-memory 잠정" 안은 폐기.)

### 5.2 기존 테이블 활용

- `itsm_ticket.ai_suggestion_id` (이미 v0.2 설계에 포함) — 현재 활성 제안 포인터.
- `audit_log` — 플랫폼 공용. 5.3 참조.

### 5.3 감사 로그 연계

- `AuditAction` enum 에 다음 항목 추가(플랫폼 공통 승급 필요 — §10):
  - `ITSM_AI_SUGGEST` — Passive 제안 생성
  - `ITSM_AI_ACCEPT` / `ITSM_AI_REJECT` — 수락/거절
  - `ITSM_AI_TOOL_INVOKE` — 에이전트가 툴 호출 (tier=read 는 샘플링, action 은 전건)
  - `ITSM_AI_CHAT_TURN` — 사용자 메시지 + assistant 응답 요약(본문은 메시지 테이블에 보존, 감사는 해시/토큰만)

---

## 6. Tool Catalog

툴은 3 tier 로 분리. 사용자의 `itsm_scope_grant` 와 `User.role` 을 근거로 **가용 툴 집합**을 런타임 계산.

### 6.1 `tier=read` (Phase A)

| 이름 | 설명 | 스코프 체크 |
|---|---|---|
| `search_tickets` | 필터(상태/고객/제품/담당자/기간) + 페이지네이션 | scope_grant WHERE 주입 |
| `get_ticket` | 단건 상세 | 티켓 접근 가드 |
| `list_customers` | 고객사 목록 | scope_grant |
| `list_products` | 제품 목록 | 전원 read 허용 |
| `list_contracts` | 계약 목록 | scope_grant |
| `get_sla_policy` / `get_sla_tier` | SLA 설정 조회 | 전원 read |
| `get_loop_history` | Ticket 의 전이 이력 | 티켓 접근 가드 |
| `get_my_kpi` | 호출자 본인 KPI 스냅샷 | self |

### 6.2 `tier=nav` (Phase A — 프런트엔드 실행, 완전 라우팅 제어)

**v0.2 결정 5**: 에이전트가 화면 이동·필터·드로어·포커스를 **프로그래매틱하게** 제어한다. 단순 "여기 링크요"(클릭 유도) 가 아니라 `useNavigate` + 쿼리스트링 mutation + 드로어 API 호출을 직접 트리거.

| 이름 | 설명 | 클라이언트 동작 |
|---|---|---|
| `open_ticket(id, tab?)` | `/tickets/{id}` 로 이동 + 특정 탭 활성 | `navigate(path)` + tab store 갱신 |
| `open_kanban(filter)` | 칸반 페이지로 이동 + 필터 적용 | `navigate("/kanban?" + qs)` |
| `open_list(entity, filter)` | 티켓/고객/제품/계약 목록 + 필터 | 라우트 + 쿼리 파라미터 변경 |
| `update_query(patch)` | 현재 페이지 쿼리 파라미터 일부만 변경 | `setSearchParams` merge |
| `open_drawer(kind, id)` | 페이지 이동 없이 Ticket/Customer 드로어 열기 | DrawerContext `open(kind, id)` |
| `close_drawer()` | 현재 드로어 닫기 | DrawerContext `close()` |
| `focus_field(field)` | 현재 페이지 특정 입력/컬럼에 포커스 | `document.querySelector` + `focus()` |
| `switch_tab(tab)` | 탭 기반 페이지의 탭 전환 | tab store 갱신 |

- 서버는 `ui_component` 이벤트로 `{action: "navigate", path, query}` / `{action: "drawer", kind, id}` / `{action: "focus", selector}` 등 **구조화된 의도**를 반환.
- 클라이언트의 `useUiAction` 핸들러가 React Router `useNavigate`, `useSearchParams`, Zustand drawer store 를 호출해 실제 전이 수행.
- 취소 포인트 없음 — 읽기/포커스 류는 되돌리기 안전. 상태 변경을 수반하는 건 `tier=action` 으로 분리.
- 실패 가드: 존재하지 않는 라우트·id 는 서버에서 사전 검증 후 에러 이벤트로 반환(의도만 반환하지 않음).

### 6.3 `tier=action` (Phase B — 확인 카드 필수)

| 이름 | 설명 | 스코프/권한 |
|---|---|---|
| `update_ticket_priority(id, priority, reason?)` | 우선순위 변경 | write scope |
| `assign_ticket(id, user_id, reason?)` | 담당자 배정 | write scope |
| `transition_ticket(id, to_stage, note?)` | Loop FSM 전이 | write scope + FSM 허용 검사 |
| `create_customer_contact(customer_id, ...)` | 고객 담당자 추가 | write scope on customer |
| `create_knowledge_entry(title, body, tickets[])` | KB 엔트리 생성 | scope or SYSTEM_ADMIN |
| `run_scheduler_job(job_id)` | APScheduler 잡 즉시 실행 | SYSTEM_ADMIN |

### 6.4 Tool 스키마 포맷

```python
class Tool(Protocol):
    name: str
    tier: Literal["read", "nav", "action", "admin"]
    description: str
    parameters: dict  # JSONSchema
    destructive: bool = False  # True 면 항상 confirmation card

    async def invoke(self, args: dict, ctx: ToolContext) -> AsyncIterator[LLMChunk]: ...
    async def invoke_action(self, action: str, args: dict, ctx: ToolContext) -> AsyncIterator[UiChunk]: ...
```

- `ToolContext` = `{ user, db, scope, request_id, session_id }`
- 모든 `tier=action` 툴은 **1차 호출 시 confirmation card 만 반환**하고, 실제 변경은 `/api/ai/ui-action` 의 `invoke_action("confirm", …)` 에서 수행.

---

## 7. Prompt 전략

### 7.1 시스템 프롬프트 구조 (`prompt_builder.build_system`)

```
당신은 v-itsm(업무 루프 관리) 시스템의 에이전트입니다.
- 목표: 사용자가 티켓/고객/SLA/지식을 자연어로 빠르게 조회·수정하도록 돕기.
- 반드시 한국어로 답변합니다.
- 제공된 툴만 사용합니다. 툴 없이 추정/허구 답변 금지.
- 파괴적 변경(우선순위·담당자·전이·생성·삭제)은 반드시 confirmation_card 를 먼저 띄웁니다.
- 사용자의 스코프 범위를 넘는 데이터 요청은 거부하고 그 이유를 설명합니다.
- 고객 외부로 나가는 텍스트는 초안만 제시하고 "사람 검토 후 발송" 을 표기합니다.

사용자 정보:
- 사용자ID: {user.id}, 역할: {user.role}
- 접근 가능 범위: {scope_summary}
- 현재 페이지: {page_context.page} ({page_context.route})
- 필터: {page_context.filters}
- 선택 항목: {page_context.selection}

사용 가능한 툴:
{tool_schemas_compact}

버전: prompt.v1.itsm.agent
```

### 7.2 Passive 호출 템플릿

- `classify.v1` — "다음 티켓 입력을 보고 category_l1, category_l2, priority, 근거를 JSON 으로 반환하세요" (structured output)
- `draft_reply.v1` — "다음 티켓 스레드를 기반으로 고객용 응답 초안을 한국어 존댓말, 3문단 이내로 작성하세요"
- `closure_summary.v1` — "이 티켓의 원인, 해결 방법, 재발 방지 포인트를 500자 이내 요약하세요"
- `similar_tickets.v1` — Phase A 는 LLM 미호출(DB 쿼리만). Phase B 에서 임베딩 + 재랭킹 프롬프트.

### 7.3 프롬프트 버저닝

- `prompt_ref` = `"{kind}.v{major}"`, 마이너 수정은 git commit sha 를 메시지에 주석.
- 모든 제안/에이전트 턴은 `itsm_ai_suggestion.prompt_ref` 및 `itsm_ai_chat_message.prompt_ref` 로 보존.

---

## 8. SSE 프로토콜

v-ui-builder 규약을 포팅하되 v-itsm 전용 이벤트를 추가.

### 8.1 `POST /api/ai/chat` — 이벤트

| event | data | 의미 |
|---|---|---|
| `content` | `{delta: string}` | assistant 스트리밍 텍스트 |
| `tool_call` | `{call_id, name, args}` | LLM 툴 호출 감지 |
| `tool_result` | `{call_id, chunks...}` | 서버 측 툴 실행 결과 스트림 |
| `ui_component` | `{call_id, component, props}` | Generative UI (확인 카드, 유사 티켓 카드 등) |
| `ui_patch` | `{call_id, patch}` | 부분 갱신 |
| `ai_suggestion_created` | `{suggestion_id, kind, ticket_id}` | Passive 제안 DB 기록 완료 |
| `done` | `{session_id, usage}` | 턴 종료 |
| `error` | `{code, message}` | |

### 8.2 `POST /api/ai/ui-action` — 확인 카드 후속

요청 body:
```json
{
  "target": "message",
  "session_id": "...",
  "call_id": "call_123",
  "action": "confirm" | "cancel",
  "args": { "reason": "..." }
}
```

응답은 동일 SSE 이벤트 셋. `tool_result` 에서 실제 변경이 수행되고 `content` 로 사용자 메시지가 이어짐.

### 8.3 Idempotency

- 모든 action 툴 호출은 `(session_id, call_id, action)` 복합키로 `itsm_ai_chat_message.ui_calls` 에 상태 저장. 재전송 시 이미 `executed` 면 서버가 재실행 없이 캐시된 결과만 돌려줌.

---

## 9. 페이지 컨텍스트 스키마

`ChatContext` store 가 유지하는 구조:

```ts
interface PageContext {
  page: string;          // "tickets.list" | "tickets.detail" | "kanban" | ...
  route: string;         // 실제 URL
  filters?: Record<string, unknown>;
  selection?: Array<{ kind: "ticket" | "customer" | "product" | "contract"; id: string; label: string }>;
  view_state?: Record<string, unknown>; // 페이지별 보조 상태(정렬/탭 등)
}
```

- 각 페이지는 `useEffect` 로 진입/언마운트 시 `registerPageContext` / `clearPageContext` 호출.
- `selection` 은 해당 페이지가 관리하는 체크박스/드래그 상태에서 `updateSelection` 으로 동기화.
- 챗 패널 composer 는 사용자가 **"이것 포함"** 토글을 끄면 `selection` 을 빼고 전송.

---

## 10. 보안 / 안전 장치

### 10.1 스코프 강제

- `chat_orchestrator` 는 턴 시작 시 `get_user_scope(db, user)` 로 UserScope 계산.
- 모든 `tier=read` 툴은 `apply_scope_to_query(stmt, scope)` 로 WHERE 주입.
- 범위를 벗어난 `tier=action` 호출은 즉시 `error` 이벤트 + 감사 기록 + assistant 가 거부 메시지 전송.

### 10.2 파괴적 툴의 2단계

1. LLM 이 `tier=action` 툴을 호출 → 서버는 confirmation card 만 ui_component 로 반환 (DB 미변경)
2. 사용자가 card 에서 `[실행]` → `/api/ai/ui-action?action=confirm` → 서버가 실제 변경 + `before/after` 감사 기록

### 10.3 레이트 / 예산

- 사용자당 분당 토큰 / 시간당 호출 수 소프트 리밋 (초기값: 30 requests/min, 200k tokens/hour). 초과 시 assistant 가 안내 메시지.
- LLM provider 호출 실패는 **조용히 실패하지 않음** — 명시적 error 이벤트 + Slack/Teams 운영 채널로 알림 (운영 콘솔 재사용).

### 10.4 PII 마스킹

- Passive `classify`/`draft_reply` 로 프롬프트에 들어가기 전, 전화번호/주민번호/이메일 패턴을 토큰으로 치환(v-itsm 전용 regex 셋). 원문은 DB 에만 존재.
- 로그/`token_usage` JSONB 에는 원문 저장 금지. 본문은 `itsm_ai_chat_message.content` 에만.

### 10.5 프롬프트 인젝션 방어

- 사용자 입력은 **항상 user 메시지**, 외부 문서(티켓 본문, 첨부)는 별도 `tool` 메시지로 분리.
- 툴 결과에 포함된 문자열이 "시스템 프롬프트 재작성" 류 지시일 때 무시하도록 system prompt 에 명시.

---

## 11. 설정 / 환경 변수

기존 `apps/v-itsm/.env` 에 선택 값으로 정의 (§CLAUDE.md §5).

| 변수 | 기본 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `openai` \| `azure_openai` \| `anthropic`(미래) |
| `OPENAI_API_KEY` | — | 필수 (provider=openai) |
| `OPENAI_MODEL` | `gpt-4o-mini` | 기본 모델 |
| `OPENAI_MODEL_CLASSIFY` | `gpt-4o-mini` | 분류 전용 (원가 최적화) |
| `OPENAI_MODEL_DRAFT` | `gpt-4o` | 답변 초안 전용 (품질 우선) |
| `ITSM_AI_ENABLED` | `true` | 전체 킬 스위치 |
| `ITSM_AI_RATE_LIMIT_REQS_PER_MIN` | `30` | |
| `ITSM_AI_RATE_LIMIT_TOKENS_PER_HOUR` | `200000` | |
| `ITSM_AI_PROMPT_PII_MASK` | `true` | 마스킹 토글 |

---

## 12. 플랫폼 승격 판단

| 요소 | 판단 | 근거 |
|---|---|---|
| FloatingChatDock | **v-itsm 내부** (Phase A). 성공적이면 플랫폼 승격 후보. | 다른 앱(portal/bridge)이 동일 필요 확인 전까지 단독 검증 |
| BaseLLMProvider | **v0.2 결정: 승격 확정** → `platform/backend/v_platform/llm/` 이전. v-ui-builder 도 동일 경로 사용 | 2앱 사용 + 공통 인프라 계약 신호 충족 (루트 CLAUDE.md §"플랫폼 승격 판단" #1·#2) |
| AuditAction enum 확장 (ITSM_AI_*) | **플랫폼 변경 필요** | 감사 enum 은 플랫폼 공용 테이블 |
| 감사 기록 구조 | 플랫폼 기존 `AuditLog.details` JSONB 활용, 스키마 변경 없음 | |
| 페이지 컨텍스트 프레임워크 | 성공적이면 `@v-platform/core` hooks 로 승격 후보 (portal 앱도 흡수) | Phase A 에서는 v-itsm 로컬 |

> **v0.2 결정 반영**: BaseLLMProvider 승격은 Phase A 착수의 **선행 단계(A0)** 로 확정. 단, v-ui-builder 의 기존 provider 제거는 런타임 영향이 있는 리팩토링이므로 실제 작업 착수 직전에 1회 사용자 재확인을 거친다. (루트 CLAUDE.md §스코프 작업 원칙 — 플랫폼 변경은 전 앱 영향)

---

## 13. Phase 계획

### Phase A — MVP (Passive + 읽기 전용 에이전트)

| 단계 | 작업 | 결과물 |
|---|---|---|
| A0 | **BaseLLMProvider 플랫폼 승격** (v0.2 결정 1) — `platform/backend/v_platform/llm/{base,openai_provider,registry}.py` 신설 + v-ui-builder 전환(import 경로 교체, `apps/v-ui-builder/backend/app/llm/` 제거) | 플랫폼 공용 LLM 모듈 |
| A1 | 설계 문서 확정(본 v0.2) + v-ui-builder 리팩토링 재확인 사용자 컨펌 | 본 문서 + 착수 승인 |
| A2 | a014 마이그레이션 (itsm_ai_suggestion / chat_session / chat_message) | DB 스키마 |
| A3 | AuditAction enum 확장 (플랫폼 p035 마이그레이션) | 감사 enum |
| A4 | Backend: `v_platform.llm` import + tools(read+nav)/prompt_builder/chat_orchestrator + **세션 영속화 write-path**(턴마다 commit) | `/api/ai/chat` 동작 + DB 영속 |
| A5 | Frontend: ChatContext + FloatingChatDock + ChatPane **전체 Gen-UI 포팅**(WidgetProposalCard 포함) + nav 툴 **완전 라우팅 제어** | 전역 챗 패널 동작 |
| A6 | Passive F1 (자동 분류) — intake 시 suggester 호출 + 배너 | 티켓 접수 시 AI 분류 |
| A7 | Passive F2 (답변 초안) — Answer 탭 ChatPane 사이드 | 초안 생성 |
| A8 | Passive F3 (유사 티켓 — tsvector 버전) | 사이드바 카드 |
| A9 | Passive F4 (해결 요약) — closed 전이 후크 | KB 초안 모달 |
| A10 | 운영 콘솔 연계: Rate limit/kill switch/제안 통계 카드 | 관리자 UI |
| A11 | 수동 smoke + 감사 로그 샘플 검증 + 세션 복구(새로고침) 검증 | 인수 |

### Phase B — 에이전트 확장

| 단계 | 작업 |
|---|---|
| B1 | 임베딩 저장 결정(pgvector 등) + 유사도 재설계 *(v0.2 결정 2 — 추후 판단)* |
| B2 | `tier=action` 툴 세트 + confirmation card UI |
| B3 | SLA/티어/계약 CRUD 툴 + SYSTEM_ADMIN 가드 |
| B4 | 템플릿/매크로 툴 |
| B5 | 사용량 리포트 (KPI 에 AI 채택률·절감시간 추가) |

> **v0.2 변경**: 이전 B5 "대화 세션 영속화" 는 결정 3(Phase A 부터 DB)에 따라 A4 로 이관·삭제됨.

---

## 14. 검증 계획

### 14.1 마이그레이션 검증
```bash
docker compose exec itsm-backend python -m v_platform.migrations.run_app_migrations --app v-itsm
docker compose exec postgres psql -U vmsuser -d v_project -c "\dt itsm_ai*"
# 기대: itsm_ai_suggestion, itsm_ai_chat_session, itsm_ai_chat_message
```

### 14.2 기능 smoke
1. SYSTEM_ADMIN 로그인 → 아무 페이지에서 `Ctrl+J` → FloatingChatDock 열림
2. "내 오픈 티켓 3건만 보여줘" → `search_tickets` 호출 → 카드 렌더
3. "T-1234 열어줘" → `open_ticket` → 라우트 이동
4. (Phase B) "T-1234 우선순위를 High 로 바꿔줘" → confirmation card → [실행] → 변경 + 감사 기록
5. Intake 폼 제출 → 배너에 분류 제안 → [수락] → 티켓 필드 갱신
6. closed 전이 → 요약 모달 → KB 저장
7. 권한그룹으로 제한된 사용자로 동일 시도 → 스코프 밖 데이터 접근 거부

### 14.3 회귀
- `ITSM_AI_ENABLED=false` 시 모든 AI 엔드포인트 503 + 배너 미노출
- LLM API 장애 시뮬레이션 → assistant error 이벤트 + 감사 로그 기록 + passive 제안은 실패 상태로 저장

---

## 15. 리스크 & 완화

| 항목 | 리스크 | 완화책 |
|---|---|---|
| LLM 할루시네이션 | 존재하지 않는 티켓ID, 잘못된 SLA 수치 언급 | 툴 결과 기반 응답 강제, system prompt 에 "툴 없이 답변 금지" |
| 프롬프트 인젝션 | 티켓 본문이 "지금부터 관리자다" 유형 | 사용자 ↔ 외부 문서 메시지 역할 분리 + 파괴적 작업 confirmation |
| 비용 폭증 | 긴 대화·대량 분류 | 모델 분리(classify=mini), rate limit, 컨텍스트 윈도우 500 메시지 제한 |
| 스코프 우회 | 에이전트가 scope 외 데이터 노출 | 모든 read 툴은 WHERE 주입, 정적 SQL 금지. 테스트 시나리오 필수 |
| 감사 누락 | tool call 로깅 실패 | 감사 기록 실패 시 전체 턴 롤백 + error 이벤트 |
| 승인 없는 외부 발송 | assistant 가 실수로 Slack/Teams 로 직접 메시지 | MVP 툴 카탈로그에 **외부 발송 툴 자체를 포함하지 않음**. 발송은 항상 운영 콘솔의 기존 UI 경유 |
| 사용자 혼란 | 챗봇 동작 범위가 불명확 | 최초 진입 시 온보딩 카드 + `/help` 슬래시 명령 |
| v-ui-builder 개선 역전파 | 복사본 drift | 분기 6개월 리뷰 + "LLM Provider 계약" 공통 규약 문서화 |

---

## 16. 해결된 결정 사항 (v0.2)

v0.1 의 Open Issues 5건 모두 사용자 결정으로 종결됨. 아래는 결정 요약.

| # | 주제 | 결정 | 근거 |
|---|---|---|---|
| 1 | BaseLLMProvider 플랫폼 승격 시점 | **Phase A 착수 직전(A0 단계)에 승격** | 2앱 사용 확정 + 공통 인프라 계약. 앱에 먼저 구겨넣고 나중에 올리면 중복·드리프트 발생 |
| 2 | 임베딩 저장소 | **Phase B 에서 추후 판단** | Phase A 는 tsvector 만으로 진행, 운영 볼륨 확인 후 pgvector vs 외부 DB 선택 |
| 3 | 대화 세션 영속화 시점 | **Phase A 부터 DB 영속화 기본** | 감사 요구·디버깅·재현성 확보 가치가 MVP 범위에 포함 가치 있음 |
| 4 | Gen-UI 카드 범위 | **풀 Gen-UI 포팅** (WidgetProposalCard 포함 v-ui-builder 전체 카드 셋 + ITSM 전용 ConfirmationCard/SimilarTicketCard) | 이미 동작 검증된 자산 활용, 카드 기반 클릭-투-액션 UX 는 ITSM 루프에서 즉시 가치 |
| 5 | 프런트엔드 네비게이션 툴 범위 | **완전 라우팅 제어** (8 툴 — open_ticket/open_list/update_query/open_drawer/close_drawer/switch_tab/scroll_to/focus_field) | 자연어 명령의 핵심 가치가 "어디서든 화면 조작" 이므로 제안 링크 수준은 UX 약화 |

> 상세 영향: §1.1(원칙), §4.3(재사용 매트릭스), §5.1.3(세션 영속화), §6.2(tier=nav), §13(Phase 계획), §17(파일 목록) 참조.

---

## 17. 영향받는 주요 파일

### Platform (v0.2 — A0 선행 작업)
```
platform/backend/v_platform/
  llm/                              (신규 — BaseLLMProvider 승격)
    __init__.py
    base.py                         (v-ui-builder 에서 이동)
    openai_provider.py              (v-ui-builder 에서 이동)
    registry.py                     (resolve_provider)
  utils/audit_logger.py             (AuditAction enum 확장)
  migrations/
    p035_audit_action_itsm_ai.py    (신규 — enum 승급)
```

### v-ui-builder (v0.2 — A0 연동 전환)
```
apps/v-ui-builder/backend/app/
  llm/                              (제거 — v_platform.llm 로 이동)
  *                                 (import 경로 교체: from app.llm ... → from v_platform.llm ...)
```

### v-itsm Backend
```
apps/v-itsm/backend/app/
  ai/
    __init__.py (신규)
    tools/
      __init__.py
      base.py          (tier 필드 추가)
      registry.py
      read_tools.py
      nav_tools.py     (8 툴 — 완전 라우팅 제어)
      action_tools.py  (Phase B 스텁)
    prompt_builder.py
    chat_orchestrator.py              (v_platform.llm import)
    suggester.py                      (v_platform.llm import)
  api/
    ai.py             (신규 라우터 — SSE /api/ai/chat)
    tickets.py        (intake 후크에 suggester.classify 추가)
  services/
    ticket_service.py (closed 전이 후크에 suggester.closure_summary 추가)
  models/
    ai.py             (AISuggestion + ChatSession + ChatMessage — Phase A 부터 영속)
    __init__.py       (re-export 갱신)
migrations/
  a014_ai_chat_tables.py (신규)
```

### Frontend
```
apps/v-itsm/frontend/src/
  ai/
    FloatingChatDock.tsx
    ChatContext.tsx        (Zustand)
    ChatPane.tsx           (포팅)
    MarkdownMessage.tsx    (포팅)
    GenUiRenderer.tsx      (전체 포팅 — v-ui-builder gen-ui/* 전 카드 셋)
    gen-ui/                (포팅 — WidgetProposalCard 포함 v-ui-builder 전 카드)
    cards/
      ConfirmationCard.tsx      (신규 — ITSM 파괴적 작업 2단계 확인)
      SimilarTicketCard.tsx     (신규 — ITSM 전용)
      SuggestionBanner.tsx      (신규 — ITSM 전용)
    hooks/
      useChatStream.ts     (포팅)
      useUiAction.ts       (포팅)
      usePageContext.ts
    tools/
      clientTools.ts       (nav 8 툴 — navigate/setSearchParams/DrawerContext/focus 완전 라우팅 제어)
  pages/
    Intake.tsx             (분류 배너 마운트)
    TicketDetail.tsx       (유사 티켓 사이드바 + Answer 탭 ChatPane)
    Dashboard.tsx          (FloatingChatDock 전역 마운트는 App.tsx)
  App.tsx                  (FloatingChatDock 전역 마운트)
```

### Docs
```
docusaurus/docs/apps/v-itsm/design/V_ITSM_AI_ASSISTANT_DESIGN.md (이 문서)
docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md            (§8 링크 추가)
```

---

## 18. 변경 이력

- **v0.1 (2026-04-23)**: 초안. Passive AI 4 기능 + Natural-Language Agent 통합. Phase A MVP 범위 확정.
- **v0.2 (2026-04-23)**: 5대 결정 반영.
  - (1) BaseLLMProvider **플랫폼 승격 확정** — `platform/backend/v_platform/llm/` 신설, v-ui-builder 전환 포함. Phase A0 단계 신설.
  - (2) 임베딩 저장소 — Phase B 에서 추후 판단 (변경 없음, 명시화).
  - (3) 대화 세션 영속화 — **Phase A 부터 DB 기본**. §5.1.3 개정, 이전 Phase B 의 B5 삭제.
  - (4) Gen-UI 카드 — **풀 포팅** (v-ui-builder `gen-ui/*` 전체 + ITSM 전용 카드). §4.3 재사용 매트릭스·§17 파일 목록 개정.
  - (5) 네비게이션 툴 — **완전 라우팅 제어** (8 툴). §6.2 확장 — client action 컬럼 추가.
  - §12 플랫폼 승격 판단·§13 Phase 계획·§16(Open Issues → 해결된 결정 사항) 업데이트.
