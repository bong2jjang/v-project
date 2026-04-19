# v-ui-builder Dashboard Canvas 설계 문서

**상태**: Confirmed v0.2
**작성일**: 2026-04-19
**v0.2 변경**: §14 열린 질문 4 건 확정 → §14 를 "확정된 결정" 섹션으로 전환. 확정에 따른 스키마/UX/프롬프트 세부 반영.
**작성자**: v-project 팀
**영향 범위**: `apps/v-ui-builder/**` 내부 — 플랫폼/타 앱 영향 없음
**전제 문서**:
- [`V_UI_BUILDER_DESIGN.md`](./V_UI_BUILDER_DESIGN.md) (P1.x 기반)
- [`V_UI_BUILDER_GENERATIVE_UI_DESIGN.md`](./V_UI_BUILDER_GENERATIVE_UI_DESIGN.md) (P2.x — StockCard / WeatherCard / DataTableCard 등이 채팅으로 생성·인터랙션됨)

---

## 1. 목적 & 배경

### 1.1 한 문장 요약
채팅에서 만든 Generative UI 카드를 **드래그앤드롭으로 대시보드 캔버스에 배치**하고, 그 캔버스 위에서 AI 와 **함께 수정·추가**하며 **나만의 데이터 분석 화면**을 키워가는 환경을 제공한다.

### 1.2 왜 필요한가
현재 v-ui-builder 의 두 축은 다음과 같다.

| 축 | 산출물 | 대상 창 | 한계 |
|---|---|---|---|
| Sandpack Builder (P1.x) | React 코드 프로젝트 | Code / Preview Pane | "앱" 단위라 무겁고, 데이터를 직접 꽂기 어려움 |
| Generative UI (P2.x) | 실시간 데이터 카드 (Stock/Weather/Table) | **채팅 버블 안** | 대화가 흐르면 카드가 스크롤 밖으로 사라져 **재사용·비교 불가** |

대시보드 Canvas 는 **세 번째 축**으로서, Gen-UI 카드를 **지속적으로 배치·비교·조합**할 수 있는 영속 공간을 제공한다. 이로써 "한 번 질문 → 한 번 답변" 의 1-shot 흐름을 넘어 **"여러 카드를 나란히 놓고 교차 관찰하는 분석 워크플로우"** 가 가능해진다.

### 1.3 사용자 관점 시나리오
```
# 시나리오 A — 드래그로 수집
User(채팅):  "삼성전자 주가 1개월 차트"
Bot:        [StockCard(005930, 1mo)]  ← 채팅 버블 안
User:       (StockCard 우상단 📌 핀 아이콘을 Dashboard 영역으로 드래그)
Dashboard:  (좌상단에 StockCard 복제본이 고정됨)

User(채팅):  "애플 주가도 비교"
Bot:        [StockCard(AAPL, 1mo)]
User:       (드래그 → Dashboard 오른쪽 열에 배치, 2열 그리드가 됨)

User(채팅):  "서울 날씨 카드도 위에"
Bot:        [WeatherCard(서울)]
User:       (드래그 → 최상단 행으로 배치)

# 시나리오 B — Dashboard 에서 직접 AI 와 편집
User(Dashboard 사이드 채팅, StockCard 선택 상태):
            "이 차트 기간을 1년으로 바꾸고, 아래에 애플 주가 비교도 추가해줘"
Bot:        (선택 위젯에 ui_patch 로 range=1y 적용)
            (새 StockCard(AAPL) 를 선택 위젯 아래 행에 자동 배치)
```

### 1.4 Non-Goals (이번 단계)
- 외부 공유 링크 / 뷰어 전용 모드 (Phase 후속)
- 위젯 간 자동 데이터 조인·계산 (SQL 조회/파생 지표)
- 멀티 사용자 동시 편집 (CRDT/OT)
- 반응형 레이아웃(브레이크포인트별 저장) — 단일 데스크톱 레이아웃부터

---

## 2. 핵심 설계 원칙

1. **위젯은 Gen-UI 카드의 "스냅샷 + 라이브 props"** — 드래그 시점의 props 를 복제하되, 동일한 `tool` 과 `call_id` 계보를 유지해 이후에도 `invoke_action` 으로 갱신 가능.
2. **Dashboard 는 Project 의 하위 엔티티이며 프로젝트당 1 개로 제한(v0.2 확정)** — 기존 `ui_builder_projects` 아래 `ui_builder_dashboards` 를 두되 `UNIQUE(project_id)`. 프로젝트 생성 시 기본 대시보드 1 개 자동 생성. 멀티 대시보드 지원은 후속 Phase.
3. **레이아웃은 서버에 JSON 으로 영속** — 클라이언트 상태만으로 흩어지지 않도록, 배치/크기/순서 변경 즉시 debounce 저장.
4. **두 종류의 AI 채팅을 구분**
   - **Project Chat** (기존 ChatPane) — Gen-UI 카드 "생성"
   - **Dashboard Chat** (신규) — 대시보드 "구성·수정"
     대시보드 컨텍스트(layout + 선택 위젯 props)를 시스템 프롬프트에 주입하고, `dashboard.*` 계열 tool 을 노출.
5. **위젯 재생성(re-invoke) 은 `invoke_action` 을 경유** — 복제된 위젯도 원본 tool 의 서버 로직으로만 갱신 (프론트에서 props 를 손으로 조작하지 않음).

---

## 3. 용어 정리

| 용어 | 정의 |
|---|---|
| **Dashboard** | 한 Project 에 소속된 영속 캔버스. `name`, `layout`, `items` 를 가짐. 프로젝트당 N 개 가능. |
| **Widget** | Dashboard 에 배치된 하나의 Gen-UI 카드 인스턴스. `tool` + `component` + `props` + `grid_pos` + `source_call_id`(원본 채팅 call) |
| **Pin** | 채팅의 Gen-UI 카드를 Dashboard 로 복제하는 동작 |
| **Widget Selection** | Dashboard 에서 AI 가 대상으로 삼을 위젯을 하이라이트 선택한 상태 |
| **Dashboard Chat** | 대시보드 컨텍스트를 시스템 프롬프트에 포함한 별도 채팅 스트림 |

---

## 4. 아키텍처

### 4.1 전체 레이아웃 (UI)
기존 3-pane 에 **탭 전환**을 도입한다.

```
┌─────────────────────── v-ui-builder /builder/:projectId ────────────────────────┐
│  [Chat] [Dashboard]  ← Preview Pane 상단 탭                                     │
│  ┌─────────────┬───────────────┬──────────────────────────────────────────────┐ │
│  │ ChatPane    │ CodePane      │ (Chat 탭)  PreviewPane (Sandpack)           │ │
│  │ (Project)   │ (Monaco)      │ (Dashboard 탭) DashboardCanvas              │ │
│  │             │               │   ┌────────────────┐  ┌────────────────┐    │ │
│  │             │               │   │ StockCard 005  │  │ StockCard AAPL │    │ │
│  │             │               │   └────────────────┘  └────────────────┘    │ │
│  │             │               │   ┌────────────────────────────────────┐    │ │
│  │             │               │   │ DataTableCard                       │    │ │
│  │             │               │   └────────────────────────────────────┘    │ │
│  │             │               │   ─ DashboardChat (아래 접이식 바) ─      │ │
│  │             │               │                                              │ │
│  └─────────────┴───────────────┴──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Chat 탭**: 기존 ChatPane + PreviewPane(Sandpack) — 현 동작 유지.
- **Dashboard 탭**: PreviewPane 영역을 DashboardCanvas 로 교체. 좌측 ChatPane 은 그대로 남지만, DashboardCanvas 하단의 **Dashboard Chat 바** 가 위젯 편집 채팅을 전담.

### 4.2 데이터 흐름

#### 4.2.1 Pin (카드 → 대시보드)
```
ChatPane.UiCallCard
   │ 📌 드래그 시작 (HTML5 DnD: e.dataTransfer.setData)
   │    payload = { call_id, tool, component, props, source_message_id }
   ▼
DashboardCanvas (drop zone)
   │ onDrop → POST /api/ui-builder/dashboards/:id/widgets
   │   body: { tool, component, props, source_call_id, source_message_id, grid_pos }
   ▼
Server: INSERT ui_builder_dashboard_widgets
   │ (WebSocket or SSE) broadcast dashboard.widget_added
   ▼
Client: 낙관적 추가 → 서버 응답으로 확정
```

#### 4.2.2 Widget 갱신 (Range 변경 등)
기존 `/api/ui-action` 을 재사용한다. 차이점은 **대상이 메시지가 아닌 위젯**이라는 것.

```
Widget.onAction("setRange", {range:"1y"})
   ▼
POST /api/ui-action
   body: { target:"widget", dashboard_id, widget_id, call_id, action, args }
   ▼
Server: StockUiTool.invoke_action → ui_patch SSE
   ▼
Client: applyUiPatchToWidget(widgetId, patch) + 서버는 widget.props 업데이트 후 persist
```

#### 4.2.3 Dashboard Chat 편집
```
DashboardChatBar (선택 위젯 W1)
   │ prompt: "이 차트 아래에 애플 주가 비교 추가"
   ▼
POST /api/ui-builder/dashboards/:id/chat/stream
   body: { prompt, selected_widget_ids:["W1"] }
   system prompt 에 layout JSON + 선택 위젯 props 주입
   도구 노출: dashboard.add_widget, dashboard.update_widget,
             dashboard.remove_widget, dashboard.reflow + 기존 ui tool 들
   ▼
Server: LLM 이 tool-call → 각 tool 은 DB 트랜잭션 + SSE 이벤트 방출
   events: dashboard.widget_added / widget_updated / widget_removed / layout_changed
   ▼
Client: 이벤트별로 store 에 머지 → 캔버스 리렌더
```

### 4.3 레이아웃 엔진 — react-grid-layout 선정

후보 비교:

| 라이브러리 | 장점 | 단점 | 결정 |
|---|---|---|---|
| **react-grid-layout** (MIT) | 스냅 그리드 / 드래그·리사이즈·재배치 표준. Bolt·Grafana·Retool 류와 유사 UX. | 절대 위치 자유 배치 미지원 (grid only) | ✅ **채택** |
| dnd-kit + 수동 flex | 자유도 최고 | 그리드·리사이즈·충돌 처리 전부 수제작 | ❌ 공수 과다 |
| Muuri | 애니메이션 부드러움 | 타입·리액트 통합 약함 | ❌ |
| Pragmatic DnD (Atlassian) | 성능·접근성 우수 | 그리드 레이아웃 로직 없음 | ❌ |

**이유**: 분석용 대시보드의 디폴트 기대치는 "그리드에 스냅, 드래그로 재배치, 모서리로 리사이즈" 이고 `react-grid-layout` 이 이 상을 직접 준다. 자유 배치 필요성은 MVP 범위에 없다.

---

## 5. 데이터 모델

### 5.1 새 테이블

```sql
-- a004_create_ui_builder_dashboards.sql
CREATE TABLE ui_builder_dashboards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL DEFAULT 'Dashboard',
  description      TEXT,
  layout_cols      INTEGER NOT NULL DEFAULT 12,   -- grid columns
  row_height_px    INTEGER NOT NULL DEFAULT 64,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ui_builder_dashboards_project UNIQUE (project_id)  -- v0.2: 프로젝트당 1 개
);

CREATE TABLE ui_builder_dashboard_widgets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id       UUID NOT NULL REFERENCES ui_builder_dashboards(id) ON DELETE CASCADE,
  tool               VARCHAR(64)  NOT NULL,      -- e.g. "stock", "weather"
  component          VARCHAR(64)  NOT NULL,      -- e.g. "StockCard"
  props              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  call_id            VARCHAR(128) NOT NULL,      -- 위젯 고유. invoke_action 시 키로 사용
  source_call_id     VARCHAR(128),               -- 원본 채팅 call (추적/디버깅용)
  source_message_id  UUID REFERENCES ui_builder_messages(id) ON DELETE SET NULL,
  grid_x             INTEGER NOT NULL DEFAULT 0,
  grid_y             INTEGER NOT NULL DEFAULT 0,
  grid_w             INTEGER NOT NULL DEFAULT 4,
  grid_h             INTEGER NOT NULL DEFAULT 4,
  z_index            INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ui_builder_dashboard_widgets_dashboard
  ON ui_builder_dashboard_widgets(dashboard_id);

-- v0.2 확정: 채팅 scope 분리
ALTER TABLE ui_builder_messages
  ADD COLUMN scope VARCHAR(16) NOT NULL DEFAULT 'project';
-- 허용 값: 'project' | 'dashboard'
-- dashboard scope 행은 dashboard_id 를 참조 컬럼으로 같이 둔다.
ALTER TABLE ui_builder_messages
  ADD COLUMN dashboard_id UUID
  REFERENCES ui_builder_dashboards(id) ON DELETE CASCADE;
CREATE INDEX idx_ui_builder_messages_dashboard
  ON ui_builder_messages(dashboard_id, created_at)
  WHERE dashboard_id IS NOT NULL;
```

### 5.2 설계 결정 로그
- **layout 을 `dashboards.layout JSONB` 한 컬럼이 아닌 `widgets` 테이블의 `grid_*` 컬럼으로 분리**: 개별 위젯 이동만으로 락 경합 / 큰 JSON diff 없이 UPDATE. 또한 AI tool(`dashboard.update_widget`) 이 단일 위젯만 건드리기 편함.
- **`call_id` 를 위젯에도 두는 이유**: 기존 `/api/ui-action` 경로가 `call_id` 기반으로 서버 tool 로직을 분기한다. 위젯은 원본과 다른 ID 를 가져야 (같은 StockCard 두 번 Pin 해도 각자 갱신 가능) 하므로 신규 발급.
- **`source_call_id` / `source_message_id` 보존**: 사용자가 "이 카드는 어떤 질문에서 왔지?" 를 추적 가능. Dashboard 에서 원본 메시지로 역점프 UX 가능.

### 5.3 Project 테이블 변경 여부
불필요. Dashboard 는 `project_id` FK 로만 연결. `ui_builder_projects` 무변경.

---

## 6. API 설계

### 6.1 신규 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| `POST`   | `/api/ui-builder/projects/:projectId/dashboards` | 대시보드 생성 |
| `GET`    | `/api/ui-builder/projects/:projectId/dashboards` | 프로젝트의 대시보드 목록 |
| `GET`    | `/api/ui-builder/dashboards/:id` | 위젯 포함 전체 조회 |
| `PATCH`  | `/api/ui-builder/dashboards/:id` | 이름/설명/그리드 옵션 변경 |
| `DELETE` | `/api/ui-builder/dashboards/:id` | 삭제 |
| `POST`   | `/api/ui-builder/dashboards/:id/widgets` | 위젯 추가 (Pin 또는 AI) |
| `PATCH`  | `/api/ui-builder/dashboards/:id/widgets/:widgetId` | 위치/크기/props 부분 수정 |
| `PATCH`  | `/api/ui-builder/dashboards/:id/widgets:bulk-layout` | 드래그 후 여러 위젯 좌표 일괄 저장 |
| `DELETE` | `/api/ui-builder/dashboards/:id/widgets/:widgetId` | 위젯 제거 |
| `POST`   | `/api/ui-builder/dashboards/:id/chat/stream` | Dashboard 컨텍스트 채팅 SSE |

### 6.2 기존 엔드포인트 확장
`POST /api/ui-action` 요청 바디에 선택적 타겟 필드를 추가한다 (하위 호환).

```jsonc
// 채팅 카드(기존)
{ "message_id": "...", "call_id": "...", "action": "setRange", "args": {...} }

// 위젯(신규)
{ "target": "widget",
  "dashboard_id": "...", "widget_id": "...",
  "call_id": "...",        // 위젯의 고유 call_id
  "action": "setRange", "args": {...} }
```

서버는 `target` 에 따라 영속화 위치(메시지의 `ui_calls[x].props` vs 위젯의 `props`)만 분기하고, tool 로직(`invoke_action`) 은 공통 재사용.

### 6.3 Dashboard Chat 의 tool 인터페이스
대시보드 채팅 전용으로 노출되는 LLM tool 세트.

```python
# app/ui_tools/dashboard_ops.py (신규)
class AddWidgetTool(BaseUiTool):
    """tool.generate 에 해당. 내부적으로 기존 ui tool 을 호출해 props 를 준비하고
    widgets row 를 삽입 + SSE: dashboard.widget_added"""

class UpdateWidgetTool(BaseUiTool):
    """선택 위젯의 props 를 invoke_action 으로 갱신 + grid_* 변경 가능"""

class RemoveWidgetTool(BaseUiTool): ...
class ReflowTool(BaseUiTool):
    """레이아웃 전체를 보기 좋게 재배치(예: 2열, 3행)"""
```

이 tool 들은 **Project Chat 에는 노출하지 않는다**. 생성(질문→카드)과 편집(대시보드 구성)의 관심사를 분리해 LLM 혼란을 줄인다.

---

## 7. 프런트엔드 설계

### 7.1 라우팅 / 페이지 구조
- `/builder/:projectId` — 기존. 상단 **Chat / Dashboard 탭**을 `<Tabs>` 로 토글.
- v0.2: 프로젝트당 대시보드 1 개. URL 쿼리 없이 `GET /projects/:projectId/dashboard` (또는 `/dashboards/default?project_id=...`) 로 단일 대시보드를 항상 보장.

### 7.2 컴포넌트 트리 (신규)
```
components/builder/dashboard/
├── DashboardCanvas.tsx          # react-grid-layout 래퍼, drop zone
├── DashboardWidget.tsx          # 단일 위젯(카드 래퍼) + 헤더(이동/삭제/갱신)
├── DashboardChatBar.tsx         # 하단 슬라이드업 채팅 바
└── PinDragSource.tsx            # ChatPane UiCallCard 에 붙일 드래그 핸들
```

> v0.2: 프로젝트당 대시보드 1 개 제약으로 `DashboardSelector` 는 제거. 프로젝트 로드 시 서버가 기본 대시보드를 자동 보장하므로 프런트는 단일 `dashboardId` 만 다룬다.

### 7.3 드래그 프로토콜
```ts
// 드래그 소스(PinDragSource) 가 설정
e.dataTransfer.setData(
  "application/x-v-ui-builder-pin",
  JSON.stringify({
    call_id, tool, component, props,
    source_message_id,
  }),
);
e.dataTransfer.effectAllowed = "copy";

// DashboardCanvas.onDrop
const raw = e.dataTransfer.getData("application/x-v-ui-builder-pin");
if (!raw) return;  // 외부 드래그(이미지 등) 무시
const pin = JSON.parse(raw);
// 마우스 좌표 → 그리드 좌표 변환 후 POST /widgets
```

타 앱/페이지의 드래그와 충돌하지 않도록 **커스텀 MIME 타입**(`application/x-v-ui-builder-pin`) 사용.

### 7.4 상태(Store) 확장
`store/builder.ts` 는 현재 Project 단위 상태만 보유. 대시보드 상태는 **별도 store 파일**로 분리해 부하를 격리.

```ts
// store/dashboard.ts (신규)
interface DashboardState {
  dashboardId: string | null;
  widgets: Widget[];
  selectedWidgetIds: string[];
  isDraggingPin: boolean;

  setDashboard: (d: DashboardDetail) => void;
  addWidgetOptimistic: (w: Widget) => void;
  updateWidgetLayout: (id: string, pos: GridPos) => void;
  applyPatchToWidget: (id: string, kind: UiEventKind, payload: UiEventPayload) => void;
  removeWidget: (id: string) => void;
  select: (ids: string[]) => void;
}
```

`applyPatchToWidget` 은 `reduceUiEvent` 를 **그대로 공유**(현재 `store/builder.ts` 에서 위젯용으로 export 해 재사용). `invoke_action` 의 Generative UI 리듀서를 위젯 컬렉션에도 바로 재사용하는 게 핵심.

### 7.5 Dashboard Chat 훅
`useDashboardChat({ dashboardId, selectedWidgetIds })` — `useChatStream` 을 복제하되 엔드포인트와 이벤트 종류만 차이:
- 추가 이벤트: `dashboard.widget_added` / `widget_updated` / `widget_removed` / `layout_changed`
- 기존 `ui_loading` / `ui_patch` / `ui_error` / `message` / `done` 동일

---

## 8. AI 협업 모델 상세

### 8.1 시스템 프롬프트 구성 (Dashboard Chat)
```
You are helping the user curate a data dashboard.
Current dashboard: "{name}" ({widgets.length} widgets, {cols}-col grid).
Layout JSON:
<<<
[{"id":"W1","tool":"stock","component":"StockCard",
  "props_summary":"005930 1mo current=169.06",
  "grid":{"x":0,"y":0,"w":6,"h":4}}, ...]
>>>
Selected widgets: [{"id":"W1","props": {"symbol":"005930","range":"1mo"}}]

You may:
- Add a new widget via add_widget(tool, args)
- Update a selected widget via update_widget(id, action, args)
- Rearrange via update_widget(id, grid={x,y,w,h}) or reflow(strategy)
- Remove via remove_widget(id)
Only act on what the user asked. Prefer small, targeted diffs.
```

### 8.2 props 요약(`props_summary`) 전략
위젯 props 를 그대로 프롬프트에 주면 토큰 폭발(series 배열 등). **서버에서 tool 별 `summarize_props(props) -> str` 를 구현** 해 "005930 1mo current=169.06" 같은 한 줄 요약만 넣는다. 선택된 위젯에 한해서만 전체 props 포함.

### 8.3 안전장치
- AI 가 제안한 widget 추가는 **Toast 로 "실행했습니다 / 되돌리기"** 를 제공해 실수 복구 경로 확보.
- `reflow` 는 **undo 대상 단일 연산**으로 스냅샷: 레이아웃 이전 상태를 클라이언트 undo stack 에 push.

---

## 9. 상호작용 세부 동작

### 9.1 리사이즈 / 드래그 debounced 저장
- onDrag/onResize 중에는 로컬 상태만 갱신.
- `onDragStop` / `onResizeStop` 에서 변경된 위젯들의 `grid_*` 만 골라 한 번에 `:bulk-layout` PATCH.
- 실패 시 이전 값으로 롤백 + 경고 토스트.

### 9.2 위젯 갱신 UX
- 위젯 헤더에 `⟳` (강제 갱신), `✎` (선택해서 AI 에게 질문), `✕` (삭제).
- `⟳` 는 `invoke_action("refresh", {...})` 를 호출 — 모든 ui tool 에 optional `refresh` 표준 액션 추가.
- `✎` 는 해당 위젯을 선택 상태로 만들고 DashboardChatBar 에 포커스.

### 9.3 비어있는 대시보드
Canvas 가 비었을 때는 중앙에 **"채팅에서 카드를 드래그하거나, 하단 채팅에 '애플 주가 카드 추가' 라고 말해보세요"** 안내와 예시 프롬프트 칩(chip) 3~4 개.

### 9.4 모바일/작은 화면
- 1열 스택 강제(`layout_cols=1` 자동).
- 드래그·리사이즈 비활성, 순서 변경만 handle 로 허용.
- 이는 반응형 "저장" 이 아니라 **런타임 표시만 강제** — 저장된 데스크톱 레이아웃은 그대로 유지.

---

## 10. 단계별 로드맵 (Phase 3.x)

| 단계 | 범위 | 수용 기준 |
|---|---|---|
| **P3.0** | DB 마이그레이션(a004), dashboards/widgets 모델·스키마, 프로젝트 기본 대시보드 자동 생성 | `GET /dashboards/:id` 가 빈 캔버스 JSON 반환 |
| **P3.1** | Dashboard 탭 + DashboardCanvas(read-only), 채팅 카드의 📌 Pin 드래그 → POST widgets | Pin 한 StockCard 가 새로고침 후에도 유지 |
| **P3.2** | react-grid-layout 통합, 드래그·리사이즈·`:bulk-layout` | 위젯 배치 변경이 DB 에 영속 |
| **P3.3** | `/api/ui-action?target=widget` 경로로 기존 StockCard Range Pills 가 **위젯에서도** 동작 | 복제된 StockCard 가 원본과 독립적으로 range 전환 |
| **P3.4** | DashboardChatBar + `/dashboards/:id/chat/stream` + `add/update/remove/reflow` tool | "애플 차트 추가" 한 문장으로 위젯 추가 성공 |
| **P3.5** | 위젯 undo/redo, reflow 프리셋, 빈 대시보드 프롬프트 칩 | UX QA 통과 |

> v0.2: 기존 P3.6 "대시보드 다중 관리" 는 프로젝트당 1 개 확정으로 **범위 제외**. 추후 수요 발생 시 Phase 4 로 별도 기획.

우선순위/타임라인은 P2 QA 완료 후 P3.0 부터 순차 진행.

---

## 11. 테스트 전략

### 11.1 Backend
- `test_dashboards_api.py` — 생성/조회/삭제, widgets CRUD, bulk-layout, 권한(타 유저 차단).
- `test_ui_action_widget_target.py` — `target=widget` 분기에서 `invoke_action` → widget.props 업데이트 + SSE 이벤트 확인.
- `test_dashboard_chat_stream.py` — `add_widget` tool 호출 시 DB row 생성 및 `dashboard.widget_added` SSE 방출 검증.

### 11.2 Frontend
- Playwright 시나리오: "카드 Pin → 새로고침 → 보임" / "리사이즈 후 서버 반영" / "위젯 Range 전환".
- Storybook: `DashboardWidget` 의 로딩/에러/정상/선택 상태 스냅샷.

### 11.3 수동 검증 체크리스트
- [ ] 삼성전자 StockCard Pin → DashboardCanvas 에 등장
- [ ] 같은 StockCard 를 두 번 Pin → 서로 다른 call_id 로 독립 동작
- [ ] Range Pill 1Y 클릭 → 위젯 props.range 서버 반영
- [ ] "이 차트 옆에 AAPL 추가" 한 문장으로 AI 가 위젯 추가
- [ ] 위젯 드래그 이동 → 새로고침 후 위치 유지

---

## 12. 위험 & 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 대시보드에 쌓이는 위젯이 많아지면 초기 로드/SSE 부하 증가 | 페이지 지연 | 위젯별 **지연 렌더링**(viewport 밖은 skeleton) + 최대 위젯 상한(e.g. 30) |
| Pin 드래그와 기존 에디터/파일 DnD 가 충돌 | Dashboard 에 코드가 드랍되는 사고 | 커스텀 MIME 타입으로 엄격 필터 + drop zone 하이라이트 명확화 |
| AI 가 대량 widget 을 삽입해 레이아웃 오염 | UX 망가짐 | `add_widget` tool 호출 1 회 = 1 위젯. `reflow` 전에 **확인 토스트**. undo 표준 제공 |
| 공유 컨텍스트(필터 등)가 없어 위젯들이 서로 무관 | 분석 효율 저하 | Phase 후속에서 `dashboard.variables`(예: 공용 symbol/날짜 필터) 도입 계획. MVP 는 독립 운용만 |
| 반응형 레이아웃 요청이 생김 | 재설계 필요 | `layout` 컬럼에 브레이크포인트별 JSON 배열로 확장할 여지를 열어둔다(단일 저장 → 멀티 저장 전환 계획 가능) |

---

## 13. 대안 비교 (설계 검토에서 탈락한 후보)

### 13.1 "채팅 + 고정 핀 영역" (새 페이지 없이 채팅 우측 사이드바)
- **장점**: 페이지 추가 없음, 구현 최소.
- **단점**: 그리드/리사이즈 불가, 분석 대시보드 기대 UX 미달. AI 가 "레이아웃"을 조작할 개념이 약해짐.
- **결과**: **탈락**. 사용자가 원한 "화면(대시보드)" 은 단순 핀보드가 아니라 **2D 캔버스**.

### 13.2 Sandpack 프로젝트에 직접 컴포넌트 주입
- **장점**: 기존 Preview/Code 재활용, 코드 내보내기 자연스러움.
- **단점**: 실데이터 바인딩된 서버 tool 호출을 Sandpack(iframe) 에서 흉내 내려면 대량 shim 필요. Gen-UI 의 `invoke_action` 이 서버와 직결돼야 하는데 Sandpack 샌드박스가 방해.
- **결과**: **탈락**. Sandpack 은 "코드 프로젝트 미리보기" 전용으로 유지하고 대시보드는 **본 앱 라우트 안에서 네이티브 컴포넌트로 렌더**.

### 13.3 Freeform 절대 배치 (Figma 류)
- **장점**: 자유도 극대.
- **단점**: 분석 대시보드는 그리드 스냅이 표준 기대. 절대 좌표 저장은 창 크기 변경에 약함. MVP 과공학.
- **결과**: **탈락**. react-grid-layout 그리드로 출발.

---

## 14. 확정된 결정 (v0.2, 2026-04-19 사용자 확인)

| # | 쟁점 | 결정 | 파급 |
|---|---|---|---|
| 1 | 프로젝트당 대시보드 수 | **1 개로 제한** | `ui_builder_dashboards.project_id` UNIQUE, 프로젝트 생성 시 기본 대시보드 자동 생성. `DashboardSelector` 컴포넌트·P3.6 단계 제거. |
| 2 | Pin 후 원본 카드 처리 | **원본 유지 + 헤더에 "대시보드에 고정됨" 배지** | `UiCallCard` 가 현재 프로젝트 대시보드 위젯 목록(`call_id` 또는 `source_message_id+call_id` 키)과 비교해 배지 표시. Pin 취소 시 배지 사라짐. |
| 3 | Chat 히스토리 스코프 | **프로젝트/대시보드 분리** (`ui_builder_messages.scope` + `dashboard_id`) | 동일 테이블을 쓰되 `scope ∈ {'project','dashboard'}` + `dashboard_id`(nullable) 로 구분. 프롬프트 주입 시 Dashboard Chat 은 `dashboard_id` 대화만 로드. |
| 4 | 권한 | **MVP 는 프로젝트 소유자만 열람/편집** | 기존 Project 권한 체크 그대로 재사용. 공유는 Phase 4 에서 Project 공유 도입과 함께 확장. |

후속 단계(Phase 4 이상)에서 재검토할 항목 — 다중 대시보드, 위젯 단위 공유, 공용 필터(`dashboard.variables`), 반응형 레이아웃 브레이크포인트.

---

## 15. 구현 체크리스트 (P3.0~P3.4 요약)

- [ ] Backend: `a004_create_ui_builder_dashboards.py` + 모델 2 개
- [ ] Backend: dashboards/widgets CRUD 라우터
- [ ] Backend: `/api/ui-action` `target=widget` 분기 + 테스트
- [ ] Backend: `dashboard_ops` tool 세트 + `chat/stream` 엔드포인트
- [ ] Frontend: `store/dashboard.ts` + `useDashboardChat`
- [ ] Frontend: Chat/Dashboard 탭 스위칭 (Preview 영역)
- [ ] Frontend: `DashboardCanvas` + react-grid-layout
- [ ] Frontend: ChatPane UiCallCard 에 PinDragSource 핸들
- [ ] Frontend: DashboardChatBar + 위젯 선택 UI
- [ ] QA: 수동 체크리스트 통과 + Playwright 2 시나리오

---

**문서 버전**: 0.2 (Confirmed, 2026-04-19)
**다음 개정**: P3.0~P3.1 구현 완료 후 v0.3 (실제 API/모델 시그니처 반영)
