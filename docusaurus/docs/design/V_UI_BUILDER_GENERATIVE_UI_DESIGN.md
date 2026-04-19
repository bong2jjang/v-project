# v-ui-builder Generative UI 설계 문서

**상태**: Draft v0.1
**작성일**: 2026-04-19
**작성자**: v-project 팀
**영향 범위**: `apps/v-ui-builder/**` 내부 — 플랫폼/타 앱 영향 없음
**전제 문서**: [`V_UI_BUILDER_DESIGN.md`](./V_UI_BUILDER_DESIGN.md) (P1.x 기반 위에 쌓는 기능)

---

## 1. 목적 & 배경

### 1.1 만들려는 것
현재 v-ui-builder 는 **"LLM 이 코드를 텍스트로 생성 → Sandpack 이 iframe 에서 번들 → 미리보기"** 흐름이다.
본 기능은 이와 **별도의 축**으로, LLM 이 **텍스트 대신 실시간 데이터가 바인딩된 컴포넌트를 직접 렌더링해 반환**하는 경험을 추가한다.

- 예: "삼성전자 주가 보여줘" → 텍스트 답변이 아니라 **실시간 `StockChart` 컴포넌트**가 채팅에 삽입.
- 예: "오늘 서울 날씨" → **`WeatherCard`** 컴포넌트가 실시간 API 결과와 함께 스트리밍되어 표시.

참조 원형: **Vercel AI SDK `streamUI`** (RSC 기반, 서버 액션에서 React 컴포넌트를 반환하고 RSC 페이로드로 스트리밍).

### 1.2 왜 필요한가
- Sandpack 축은 "사용자가 **개발 중인** 앱 미리보기" — Builder 의 캔버스 대상.
- Generative UI 축은 "사용자의 **질문에 대한 답변** 자체가 UI" — Chat 대상.
- 두 축은 상호 보완적이다: 텍스트보다 **구조화된 결과**가 의미 있는 질문(시세/날씨/일정/차트 등)에 즉시 답할 수 있고, 필요 시 해당 컴포넌트를 **Sandpack 프로젝트로 고정(pin)** 해 재사용할 수 있다.

### 1.3 사용자 관점 시나리오
```
User:  "애플과 삼성전자 주가 비교 차트 보여줘"
Bot:   [StockComparisonChart aapl=... ssel=... range=1M]   ← 실시간 데이터 렌더
User:  (차트에서 기간 1년 선택)
Bot:   (동일 컴포넌트가 서버 Action 경유로 리프레시)
User:  "이 차트를 내 프로젝트 대시보드에 넣어줘"
Bot:   → Sandpack 프로젝트 `src/dashboard/StockCard.tsx` 로 스냅샷 저장
```

---

## 2. Vercel AI SDK `streamUI` 원형 분석

### 2.1 핵심 개념 (공식 문서 기반)
`streamUI` 는 **Next.js App Router + React Server Components (RSC)** 환경에서만 동작하는 API 이며, 다음 구성을 가진다.

| 요소 | 역할 |
|---|---|
| **Server Action** (`'use server'`) | 클라이언트가 호출하는 엔드포인트. 내부에서 `streamUI({...})` 호출 |
| **`streamUI({ tools })`** | LLM 의 tool-call 결정에 따라 지정된 tool 의 `generate` 함수를 실행. 반환값은 **React 컴포넌트(JSX)** |
| **`tool.generate`** | Generator 함수. `yield <Loading/>` 으로 로딩 UI 를 먼저 흘리고, 데이터가 준비되면 최종 컴포넌트를 `return` |
| **`useUIState` / `useActions`** | 클라이언트 훅. 반환된 RSC 페이로드를 React 트리에 마운트하고 상태로 관리 |
| **RSC 페이로드** | Server 에서 직렬화된 React 트리. Client 는 `.flight` 스트림을 파싱해 렌더 |

### 2.2 왜 RSC 가 필수인가
- Server 에서 렌더한 React 트리를 **네트워크 경계 너머로 직렬화**해 전달해야 한다.
- 이 직렬화 포맷(RSC payload / Flight)은 Next.js/Turbopack 전용 빌드 파이프라인이 생성한 **클라이언트 컴포넌트 레퍼런스 맵**이 필요하다.
- "`<ClientComp />` 라는 문자열은 Client 의 어느 번들 chunk 에 있는 어느 함수인가" 를 해석하는 런타임이 React Server 런타임 + Next.js 의 조합이다.

### 2.3 장점 (원형이 매력적인 이유)
- 서버가 **직접 민감 데이터에 접근**해 렌더할 수 있다(키/토큰이 클라이언트로 내려가지 않음).
- 로딩·에러 UI 를 `yield` 로 자연스럽게 스트리밍.
- 한 번의 Server Action 호출로 **"LLM 추론 + Tool 실행 + UI 렌더"** 가 원자적으로 묶인다.

---

## 3. 스택 갭 분석

| 항목 | Vercel AI SDK `streamUI` 원형 | v-ui-builder 현 스택 |
|---|---|---|
| 프레임워크 | **Next.js App Router** (필수) | **Vite + React SPA** |
| 서버 런타임 | Node.js + React Server runtime | **Python FastAPI** |
| 전송 포맷 | RSC Flight payload (바이너리 직렬화) | SSE (text/event-stream, JSON) |
| 번들 | Next.js/Turbopack 의 RSC 빌드 | Vite(ESM, 브라우저 전용) |
| 상태 훅 | `useUIState`, `useActions` (RSC 전용) | Zustand + TanStack Query |

**결론**: `streamUI` / `useActions` / RSC 직렬화를 **그대로 도입하는 것은 불가능**하다. 다만, 이 API 가 해결하는 **의도**(= "서버에서 결정·실행한 결과로 클라이언트 UI 를 스트리밍 구성")는 **우리 SSE 스택 위에서 근사 구현이 가능**하다.

---

## 4. 접근 방안 비교

### 방안 A — Next.js 서브앱 신설 (`apps/v-generative-ui/`)
- **개요**: RSC 런타임을 얻기 위해 Next.js 전용 앱을 별도로 만든다.
- 장점: `streamUI` 를 **원형 그대로** 사용 가능.
- 단점:
  - 새 앱 1개 추가 = Docker 서비스 +2(백·프론트 통합), 포트, compose 프로필, 인증 릴레이 재구성.
  - 플랫폼 공통 UI Kit(Tailwind 토큰·Layout) 과 Next.js 간 Router/Provider 중복.
  - v-ui-builder 의 기존 Chat 경험과 **이음새 발생**(컴포넌트 교차 사용 어려움).
  - 단일 기능(Generative 답변)을 위해 신규 앱을 만들기엔 오버엔지니어링.

### 방안 B — 커스텀 Tool-Call 프로토콜 + 클라이언트 컴포넌트 레지스트리
- **개요**: 서버에서는 LLM 의 **tool call** 만 실행해 JSON props 를 만들고, 클라이언트가 **화이트리스트된 React 컴포넌트**를 lazy import 해 렌더.
- 장점:
  - 현재 스택(FastAPI + SSE + Vite) 에 **완전히 정합**.
  - 재사용 가능: 동일한 컴포넌트를 **Sandpack 프로젝트에도 import 가능**한 형태로 배포(같은 npm 패키지 또는 런타임 ESM).
  - RSC 런타임/Next.js 빌드 불필요.
- 단점:
  - "Server 에서 실제 렌더" 가 아니라 "Server 가 지시 + Client 가 렌더" — 서버 렌더 UI(문서/PDF 생성 등) 가 나중에 필요하면 추가 레이어가 든다.
  - 클라이언트가 컴포넌트를 해석하므로 **컴포넌트 코드 자체는 번들에 포함**되어야 한다(= 코드 비노출 불가).

### 방안 C — 하이브리드 (권장)
- **베이스는 방안 B** — 빠르고 스택 정합.
- **탈출 해치로 방안 A** — 정말 서버 렌더가 필요한 tool(예: "LLM 이 만든 React 코드를 이미지로 렌더해서 OG 썸네일 생성") 이 나올 때만 Next.js 서브 서비스를 **마이크로서비스**로 붙인다.
- 당장의 로드맵에서는 **B 단독**으로 P2.x 를 완성하고, A 는 **필요 시점에만** 검토한다.

**채택**: **방안 C (현 단계 = B 단독 구현)**.

---

## 5. 제안 아키텍처 (방안 B)

### 5.1 전체 구조
```
┌────────────────────── 브라우저 (ChatPane) ──────────────────────┐
│                                                                  │
│  MessageBubble ─ content(text) 스트리밍                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GenUiRenderer (신규)                                      │  │
│  │   ├─ component registry (name → React.lazy)              │  │
│  │   ├─ props(JSON) 받아 <Suspense> 마운트                   │  │
│  │   └─ client action: (actionName, args) → POST /ui-action │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │ SSE                                    │
└─────────────────────────┼────────────────────────────────────────┘
                          ▼
┌──────────────── v-ui-builder Backend (FastAPI) ─────────────────┐
│                                                                   │
│  /api/chat (SSE) ─ 기존 + 신규 이벤트 타입                       │
│                                                                   │
│  ┌─ ChatService ────────────────────────────────────────────┐   │
│  │   ├─ Provider.stream(..., tools=registry.tools)          │   │
│  │   ├─ LLM tool_call 수신 시:                              │   │
│  │   │    tool = tool_registry.get(name)                    │   │
│  │   │    async for chunk in tool.render(args, ctx):        │   │
│  │   │       send SSE: ui_loading / ui_component / ui_error │   │
│  │   └─ 종료 시 done 이벤트                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  tool_registry: name → ToolDef                                    │
│   ├─ render_weather   (서버: 날씨 API fetch → props)             │
│   ├─ render_stock     (서버: 시세 API fetch → props)             │
│   └─ render_table     (서버: SQL 조회 → rows → props)            │
│                                                                   │
│  /api/ui-action (POST): 클라 컴포넌트에서 쏘는 후속 액션          │
│   (기간 변경, 리프레시 등) — tool.invoke_action(name, args)       │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 서버: Tool Registry
```python
# apps/v-ui-builder/backend/app/genui/base.py
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

class UiChunk(BaseModel):
    kind: Literal["loading", "component", "patch", "error"]
    component: str | None = None        # "StockChart"
    props: dict[str, Any] | None = None # 화이트리스트된 직렬화 가능 JSON
    patch: dict[str, Any] | None = None # 부분 갱신 (스트리밍)
    message: str | None = None

class BaseUiTool(ABC):
    name: str
    description: str
    schema: dict[str, Any]  # OpenAI tool schema

    @abstractmethod
    async def render(self, args: dict, ctx: ToolContext) -> AsyncIterator[UiChunk]:
        ...

    async def invoke_action(self, action: str, args: dict, ctx: ToolContext) -> UiChunk:
        """클라이언트 후속 상호작용 처리 (기본: NotImplementedError)."""
        raise NotImplementedError
```

```python
# apps/v-ui-builder/backend/app/genui/registry.py
_tools: dict[str, BaseUiTool] = {}

def register(tool: BaseUiTool) -> None:
    _tools[tool.name] = tool

def all_schemas() -> list[dict]:
    return [t.schema for t in _tools.values()]

def get(name: str) -> BaseUiTool | None:
    return _tools.get(name)
```

Provider 는 기존 `BaseLLMProvider.stream()` 시그니처에 **`tools`** 파라미터를 추가하고, 응답에서 `tool_call` 청크를 별도 `LLMChunk(kind="tool_call", ...)` 로 흘린다. `ChatService` 가 이를 받아 `tool.render()` 로 분기한다.

### 5.3 SSE 이벤트 확장
기존 이벤트(`content`, `artifact_start/delta/end`, `snapshot_created`, `done`, `error`) 에 **신규 이벤트** 추가:

```
event: ui_loading
data: {"call_id":"c_01","component":"StockChart"}

event: ui_component
data: {"call_id":"c_01","component":"StockChart","props":{"symbols":["AAPL","005930.KS"],"range":"1M","series":[...]}}

event: ui_patch
data: {"call_id":"c_01","patch":{"series":[...]}}  # 부분 갱신 (옵션)

event: ui_error
data: {"call_id":"c_01","message":"Quote provider unavailable"}
```

`call_id` 는 한 assistant 메시지 안의 여러 tool-call 을 구분한다. 메시지 DB 저장 시 `ui_calls` 를 부가 컬럼(JSONB)으로 기록한다.

### 5.4 클라이언트: 컴포넌트 레지스트리
```tsx
// apps/v-ui-builder/frontend/src/components/genui/registry.ts
import { lazy } from "react";

export const GEN_UI_COMPONENTS = {
  StockChart: lazy(() => import("./StockChart")),
  WeatherCard: lazy(() => import("./WeatherCard")),
  DataTable: lazy(() => import("./DataTable")),
} as const;

export type GenUiComponentName = keyof typeof GEN_UI_COMPONENTS;
```

`GenUiRenderer` 는 `useChatStream` 에서 내려오는 `ui_component` payload 로 `name` 을 조회해 `<Suspense fallback={<Skeleton/>}>` 로 마운트하고, 컴포넌트가 노출한 `onAction(actionName, args)` 콜백은 `POST /api/ui-action` 으로 전송 → SSE 로 갱신 스트림을 다시 수신.

### 5.5 `useChatStream` 확장
```ts
case "ui_loading":    store.upsertUiCall(id, { state: "loading", component }); break;
case "ui_component":  store.upsertUiCall(id, { state: "ready", component, props }); break;
case "ui_patch":      store.patchUiCall(id, patch); break;
case "ui_error":      store.upsertUiCall(id, { state: "error", message }); break;
```

store 는 `messageId → callId → UiCallState` 2단 맵으로 관리. `MessageBubble` 은 해당 메시지의 ui calls 를 `GenUiRenderer` 로 넘겨 렌더.

---

## 6. 데이터 모델 변경

기존 `ui_builder_messages` 에 **`ui_calls JSONB`** 컬럼 추가 (nullable). 스키마:
```json
{
  "calls": [
    {
      "call_id": "c_01",
      "component": "StockChart",
      "props": { ... },
      "state": "ready",
      "tool": "render_stock",
      "args": { "symbols": ["AAPL"] }
    }
  ]
}
```
- 추가 테이블 없이 메시지에 같이 영속화해 **대화 재현** 시 컴포넌트가 그대로 재마운트되도록 한다.
- 마이그레이션: `a00X_add_ui_calls_to_messages.py` (신규, 멱등 `ADD COLUMN IF NOT EXISTS`).

---

## 7. API 설계

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/chat` | (기존) SSE — `tools` 내부 주입, 위 §5.3 이벤트 추가 발행 |
| POST | `/api/ui-action` | Generative UI 컴포넌트의 후속 액션 라우팅 |
| GET | `/api/genui/tools` | 등록된 tool 메타(name/description/schema) 목록 — 관리 UI 용 |

**`POST /api/ui-action` 요청**:
```json
{
  "project_id": "...",
  "message_id": "...",
  "call_id": "c_01",
  "action": "setRange",
  "args": { "range": "1Y" }
}
```
응답: `text/event-stream` (동일 `ui_*` 이벤트 재사용) — 컴포넌트 리프레시 스트리밍.

---

## 8. 보안 / 신뢰 경계

| 리스크 | 완화 |
|---|---|
| 임의 컴포넌트명 주입(`"__proto__"` 등)으로 코드 실행 | `GEN_UI_COMPONENTS` 의 키 화이트리스트 검증, 미존재 시 에러 컴포넌트 |
| props 에 `__html`/함수 직렬화로 XSS | JSON 직렬 가능한 원시값만 허용, 컴포넌트가 내부에서 `dangerouslySetInnerHTML` 쓰지 않도록 ESLint 규칙 |
| Tool 이 임의 API/DB 접근 | Tool 은 DI 받은 `ToolContext` (현재 사용자·프로젝트·권한)만 사용. 외부 호출은 allowlist + timeout + 결과 크기 제한 |
| LLM 이 tool 남발해 비용 폭증 | 요청당 tool-call 최대 개수(예: 3), 동일 tool 재호출 디바운스, `/api/ui-action` rate-limit (slowapi) |
| 민감 데이터가 props 로 브라우저 노출 | Tool 이 응답 시 **minimum projection** 원칙 — 렌더에 필요한 필드만 반환 |

---

## 9. 제안 컴포넌트 카탈로그 (MVP)

| 컴포넌트 | Tool | 데이터 소스 | 상호작용 |
|---|---|---|---|
| `WeatherCard` | `render_weather` | 외부 기상 API (allowlist) | 위치 변경 |
| `StockChart` | `render_stock` | 주가 API (allowlist) | 기간(1D/1M/1Y) 변경, 심볼 추가 |
| `DataTable` | `render_table` | **현재 프로젝트 내부 DB 쿼리 결과** (rows JSON) | 정렬/페이지 |
| `KpiCard` | `render_kpi` | 숫자/증감률 정적 | 없음 |

- 최소 카탈로그로 출시하고 tool 을 **앱 개발자가 추가 등록**할 수 있는 훅을 남긴다(예: `apps/v-ui-builder/backend/app/genui/__init__.py` 가 `app.genui.tools` 모듈들을 모듈 스캔으로 자동 register).

---

## 10. 프론트 구조 변경

```
apps/v-ui-builder/frontend/src/
├── components/
│   ├── builder/ChatPane.tsx           # MessageBubble → GenUiSlot 추가
│   └── genui/
│       ├── registry.ts                # lazy-import 맵
│       ├── GenUiRenderer.tsx          # call 배열 → <Suspense>+컴포넌트 마운트
│       ├── StockChart.tsx             # recharts 재사용
│       ├── WeatherCard.tsx
│       └── DataTable.tsx
├── hooks/useChatStream.ts             # ui_* 이벤트 분기 추가
└── store/builder.ts                   # uiCalls 맵 추가 액션
```

`MessageBubble` 은 `content` 뒤에 `message.ui_calls` 가 있으면 `<GenUiRenderer calls={...} />` 를 함께 렌더. 스트리밍 중에는 `store.uiCalls[messageId]` 를 참조.

---

## 11. Phase 별 구현 계획

| Phase | 기간(추정) | 산출물 |
|---|---|---|
| **P2.0 — 프로토콜 뼈대** | 1.5일 | `BaseUiTool`, `tool_registry`, `ui_*` SSE 이벤트 추가, `ui_calls` 컬럼 마이그레이션, store 확장 |
| **P2.1 — 클라 렌더러** | 1일 | `GenUiRenderer`, `GEN_UI_COMPONENTS` 3개 스텁(Weather/Stock/Table), `MessageBubble` 통합 |
| **P2.2 — Tool 구현** | 2일 | Weather/Stock tool 실제 데이터 소스 연결(allowlist), `DataTable` tool(프로젝트 RO 쿼리) |
| **P2.3 — 후속 액션** | 1일 | `/api/ui-action` 엔드포인트, `invoke_action` 흐름, 컴포넌트 디바운스 |
| **P2.4 — 설정·보안** | 1일 | 관리자 화면에서 tool on/off 및 API key, rate limit, 감사 로그 항목 추가 |
| **P2.5 — Pin to Sandpack** | 1일 | Generative 컴포넌트를 현재 Sandpack 프로젝트의 파일로 스냅샷 저장(생성 코드 변환기) |
| **P2.6 — 베타 출시** | 0.5일 | 내부 사용자 5명, 감사 로그/비용 모니터링 대시보드 |

총 8일 추정. **P2.0–P2.2 만으로도 End-to-End 시연 가능.**

---

## 12. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Provider 별 tool-calling 품질 차이(OpenAI 우수, 기타는 형식 준수 실패) | LLM 분기 버그 | Provider 별 `supports_tools` 플래그, 미지원 Provider 는 Generative UI 기능 비활성 UI |
| LLM 이 tool 인자(JSON) 를 schema 에 안 맞게 생성 | 런타임 에러 | 서버에서 pydantic `TypeAdapter.validate_python` 으로 강제 검증, 실패 시 `ui_error` + LLM 재시도 1회 |
| 클라이언트 번들 비대화(컴포넌트 전부 포함) | 초기 로딩 지연 | `React.lazy` + route-level split, `recharts` 는 ChatPane 진입 시점 로드 |
| "Server 에서 렌더" 기대와의 괴리 | 사용자 혼동 | 문서에 **"서버 지시 + 클라 렌더"** 명시, 서버 렌더가 필요한 요구 발생 시 방안 A(Next.js 사이드카) 도입 판단 |
| Generative UI 와 Sandpack 축 UX 충돌 | 채팅 UI 복잡화 | Generative 컴포넌트는 "pin" 하지 않는 한 Sandpack 파일 시스템을 건드리지 않음 — 두 축 분리 |

---

## 13. 타 앱 영향 분석

| 영역 | 영향 | 조치 |
|---|---|---|
| `platform/**` | ❌ 수정 없음 | PlatformApp 로직 그대로 사용 |
| `apps/v-channel-bridge`, `apps/v-platform-portal`, `apps/v-platform-template` | ❌ | 전혀 미접근 |
| `docker-compose.yml` | ❌ | 신규 서비스 없음 (같은 `v-ui-builder-backend` 내부 기능) |
| DB | 🔄 `ui_builder_messages` 에 `ui_calls JSONB` 컬럼 1개 추가 | 신규 마이그레이션 `a00X_add_ui_calls.py` |
| Redis | ❌ | 현재 사용 없음 (추후 `ui_builder:genui:*` 캐시 키만 추가 가능) |
| 포트 | ❌ | 변경 없음 |

**결론**: v-ui-builder 스코프 내부 변경으로 완결. 사용자 승인이 필요한 항목은 **신규 마이그레이션 1건** 뿐.

---

## 14. 대안으로 남기는 옵션 (방안 A — Next.js 사이드카)

다음 조건 중 하나라도 성립하면 재검토한다.

- Generative 답변을 **서버에서 완전히 렌더한 HTML/PDF/이미지** 로 보내야 하는 요구(외부 공유/OG 이미지/프린트).
- 컴포넌트 소스 코드를 **클라이언트 번들에 노출하지 않아야** 하는 규제 요구.
- 서드파티 React 라이브러리의 **서버 전용 렌더 경로**가 필요한 경우.

도입 시 실루엣: `apps/v-generative-ui/` (Next.js 14+ App Router 전용) → 포털 릴레이로 인증 공유 → `/api/ui-action` 만 이쪽으로 프록시. 본 문서에서는 **설계 흔적으로만 남기고 구현하지 않는다.**

---

## 15. 결정 로그

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-04-19 | Generative UI = **방안 B (Tool-Call + Client Registry)** 채택 | 현 스택(FastAPI + Vite + SSE) 과의 정합, 오버엔지니어링 회피 |
| 2026-04-19 | Vercel `streamUI` **직접 도입 불가** 공식화 | RSC/Next.js 런타임 부재 |
| 2026-04-19 | MVP 컴포넌트 = Weather / Stock / DataTable | 데모 효과 + 데이터 소스 난이도 낮음 |
| 2026-04-19 | `ui_calls` 를 `ui_builder_messages` 컬럼으로 영속화 | 대화 재현 시 컴포넌트 재마운트를 위해 메시지와 원자적 저장 |
| 2026-04-19 | Next.js 사이드카(방안 A) 는 **트리거 조건 충족 시**만 도입 | 현 시점 유스케이스로는 비용·복잡도 대비 이득 없음 |

---

## 16. 참고

- Vercel AI SDK — Generative UI / `streamUI`: https://sdk.vercel.ai/docs/ai-sdk-rsc/generative-ui-state
- Vercel AI SDK — `useActions` / `useUIState`: https://sdk.vercel.ai/docs/ai-sdk-rsc/streaming-react-components
- OpenAI Function Calling / Tool Use: https://platform.openai.com/docs/guides/function-calling
- React `lazy` + Suspense: https://react.dev/reference/react/lazy
- 전제 문서: `docusaurus/docs/design/V_UI_BUILDER_DESIGN.md`
