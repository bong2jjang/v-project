# v-ui-builder 수동 위젯(Manual Widgets) 설계 문서

**상태**: Draft v0.1
**작성일**: 2026-04-19
**작성자**: v-project 팀
**영향 범위**: `apps/v-ui-builder/**` 내부 — 플랫폼/타 앱 영향 없음
**전제 문서**:
- [`V_UI_BUILDER_DESIGN.md`](./V_UI_BUILDER_DESIGN.md)
- [`V_UI_BUILDER_GENERATIVE_UI_DESIGN.md`](./V_UI_BUILDER_GENERATIVE_UI_DESIGN.md) — Gen-UI 카드 (Stock/Weather/DataTable)
- [`V_UI_BUILDER_DASHBOARD_CANVAS_DESIGN.md`](./V_UI_BUILDER_DASHBOARD_CANVAS_DESIGN.md) — 드래그 기반 대시보드 캔버스 v0.2

---

## 1. 목적 & 배경

### 1.1 한 문장 요약
AI 대화 없이도 **사용자가 직접 컴포넌트를 골라** 대시보드 캔버스에 추가·편집할 수 있도록 "수동 위젯 카탈로그"와 "속성 편집 패널"을 도입하여, 타이틀·설명·KPI·차트·필터 등 **데이터 분석 화면 구성에 필요한 정적 요소**를 빠르게 배치할 수 있게 한다.

### 1.2 왜 필요한가
| 현 상태 (P2.3) | 한계 |
|---|---|
| 대시보드 위젯은 **채팅(AI)** 또는 **📌 드래그**로만 추가 가능 | 타이틀·섹션 헤더 같은 "데이터 없는 장식/설명" 요소를 AI에 부탁하는 것은 과잉 |
| `ui_tools/*` 는 모두 **외부 데이터/동적 props** 전제 (weather/stock/data_table) | 사용자가 자기 손으로 채워 넣는 정적 텍스트/메트릭/차트 없음 |
| 속성(props) 수정도 AI 경유 — "제목을 매출 현황으로 바꿔줘" 같은 사소한 작업도 토큰 소비 | 속도·정확성·비용 모두 비효율 |

데이터 분석 대시보드의 70 % 이상은 사실 **"미리 정의된 블록을 고르고 값을 채우는"** 작업이다. AI 는 "이 표의 7월 피크 원인을 찾아줘" 같은 **질문**에 집중하고, 반복 배치 작업은 수동 UI 로 처리하는 편이 낫다.

### 1.3 사용자 관점 시나리오
```
# 시나리오 A — 타이틀/섹션으로 틀 잡기
User: (좌측 "컴포넌트 팔레트" → "타이틀" 더블클릭)
Canvas: [Title: "Untitled"] 이 (0,0,12,1) 에 추가됨
User: (타이틀 클릭 → 우측 속성 패널 → text="매출 현황", level="h1")

User: (팔레트 → "KPI 카드" 드래그 → Canvas 빈 영역 드롭)
Canvas: [KpiCard(label="매출", value=0, delta=0%)]
User: (속성 패널에서 value=128000000, delta=+12.3%, trend="up")

# 시나리오 B — Gen-UI 카드와 섞기
User: (채팅으로 StockCard(005930) 생성 → 📌 드래그 → Canvas)
User: (팔레트 → "설명 텍스트" 추가 → "이 차트는 최근 1개월 종가입니다" 입력)
→ 정적 Title + 정적 Description + 동적 StockCard 가 한 보드 위에 공존

# 시나리오 C — AI 와 수동 혼합 편집
User: (Canvas 에서 KpiCard 선택 → 채팅 "이 숫자를 지난달 대비 색상 강조해줘")
Bot: dashboard_update_widget(widget_id, action="highlight", args={delta_color: "green"})
```

### 1.4 Non-Goals (이번 단계)
- 사용자가 **새 커스텀 위젯 타입을 직접 정의**(No-code builder of builders) — 후속 단계
- 위젯 간 데이터 바인딩(한 필터가 여러 차트 필터링) — Phase 2+
- 템플릿/테마 갤러리(사전 정의된 대시보드 레이아웃) — 별도 설계
- 실시간 외부 데이터 연결(DB/API 소스) — `data_table` 처럼 UiTool 로 별도 제공

---

## 2. 핵심 설계 원칙

1. **UiTool 인터페이스 재사용** — 수동 위젯도 기존 `BaseUiTool` 을 상속해 `render()` 가 고정 props 로 `UiChunk(component, props)` 를 한 번 내보내도록 구현한다. 덕분에 `UIBuilderDashboardWidget` 저장 경로·재렌더링·invoke_action 경로를 그대로 재사용한다.
2. **정적 ≠ 비어 있음** — 수동 위젯도 props 가 있다. AI 가 나중에 `dashboard_update_widget(action=set_props)` 으로 수정할 수 있어야 한다. 즉 "AI 편집 가능한 정적 블록".
3. **`source` 필드로 출처 명시** — 위젯이 `manual` / `chat` / `pin-drag` 중 어디서 왔는지 기록해 감사·필터링·스타일 힌트에 활용.
4. **팔레트는 플랫 JSON 스펙** — 새 위젯 추가 시 Python 클래스 하나 + 카탈로그 한 줄로 끝나야 한다. 프론트/백 양쪽 하드코딩 금지.
5. **속성 편집 패널은 JSON Schema 자동 생성** — `Params.model_json_schema()` 를 그대로 받아 React Hook Form 으로 렌더. 입력 컴포넌트 매핑만 관리.
6. **대화 경로와 완전 대등** — AI 가 하는 모든 조작(add/update/remove/reflow)을 사용자도 UI 로 수행 가능. 그 반대도 성립.

---

## 3. 데이터 분석 위젯 카탈로그

사용자가 "데이터 분석에 필요한 요소를 커버"할 수 있도록, 위젯을 6 개 카테고리로 정리한다. ✅ 는 **P3.0 MVP 우선 구현**, 🟡 는 **P3.1 확장**, ⬜ 는 **향후 검토**.

### 3.1 A. 레이아웃 & 텍스트 (정적 블록)

| ID | 표시명 | 용도 | 주 props | 우선순위 |
|---|---|---|---|---|
| `title_block` | 타이틀 | 섹션 제목 | `text`, `level (h1~h4)`, `align` | ✅ |
| `section_header` | 섹션 헤더 | 구분선 + 아이콘 + 액션 | `text`, `icon`, `action_label`, `action_href` | ✅ |
| `description_text` | 설명 | 리치 텍스트 / 마크다운 | `markdown`, `max_lines` | ✅ |
| `divider` | 구분선 | 수평선 | `style (solid|dashed)`, `thickness` | ✅ |
| `spacer` | 스페이서 | 빈 여백 | `height` | 🟡 |
| `callout_box` | 강조 박스 | 주의/정보/성공 박스 | `variant (info|warning|success|error)`, `title`, `body` | ✅ |
| `image_block` | 이미지 | 로고/일러스트 | `src`, `alt`, `fit (cover|contain)`, `radius` | 🟡 |
| `icon_badge` | 아이콘 배지 | 색상 원형 배지 | `icon`, `color`, `label` | ⬜ |
| `link_button` | 링크 버튼 | 외부 이동 CTA | `label`, `href`, `variant`, `icon` | 🟡 |

### 3.2 B. KPI & 요약 지표

| ID | 표시명 | 용도 | 주 props | 우선순위 |
|---|---|---|---|---|
| `kpi_card` | KPI 카드 | 큰 숫자 + 변화율 + 추세 | `label`, `value`, `unit`, `delta`, `delta_type (pct|abs)`, `trend (up|down|flat)`, `icon`, `sparkline[]` | ✅ |
| `stat_grid` | 스탯 그리드 | 2~4개 미니 스탯 | `items[{label,value,delta}]`, `columns` | ✅ |
| `score_card` | 스코어카드 | 점수 + 게이지 (0~100) | `label`, `score`, `max`, `threshold_good`, `threshold_warn` | 🟡 |
| `progress_bar` | 진행률 | 목표 대비 달성 | `label`, `current`, `target`, `unit`, `color` | ✅ |
| `gauge` | 게이지 | 반원 게이지 | `value`, `min`, `max`, `segments[]` | 🟡 |
| `compare_stat` | 비교 스탯 | A/B 두 값 차이 강조 | `left{label,value}`, `right{label,value}`, `diff_highlight` | ⬜ |

### 3.3 C. 차트

| ID | 표시명 | 용도 | 주 props | 우선순위 |
|---|---|---|---|---|
| `line_chart` | 라인 차트 | 시계열 추세 | `title`, `series[{name, data[{x,y}]}]`, `x_label`, `y_label`, `show_legend` | ✅ |
| `bar_chart` | 바 차트(세로) | 범주형 비교 | `title`, `categories[]`, `series[]`, `stacked` | ✅ |
| `horizontal_bar_chart` | 가로 바 | 랭킹 Top N | `title`, `items[{label,value}]`, `sort`, `top_n` | ✅ |
| `area_chart` | 에어리어 | 누적 추세 | `title`, `series[]`, `stacked`, `smooth` | 🟡 |
| `pie_chart` | 파이 차트 | 구성비 | `title`, `items[{label,value,color}]` | ✅ |
| `donut_chart` | 도넛 차트 | 중앙 강조 구성비 | `items[]`, `center_label`, `center_value` | ✅ |
| `scatter_plot` | 스캐터 | 분포/상관 | `title`, `points[{x,y,label}]`, `x_label`, `y_label` | 🟡 |
| `heatmap` | 히트맵 | 2D 밀도 | `title`, `matrix[][]`, `x_labels[]`, `y_labels[]`, `color_scale` | 🟡 |
| `combo_chart` | 콤보(선+바) | 두 축 혼합 | `categories[]`, `bar_series[]`, `line_series[]`, `y_axis_right` | 🟡 |
| `treemap` | 트리맵 | 계층 비율 | `title`, `nodes[{label,value,children[]}]` | ⬜ |
| `funnel_chart` | 퍼널 | 단계별 이탈 | `title`, `stages[{label,value}]` | ⬜ |
| `sparkline_row` | 스파크라인 행 | 미니 추세 목록 | `items[{label,value,series[]}]` | 🟡 |

차트 구현은 **Recharts** 사용(루트 CLAUDE.md 공통 스택).

### 3.4 D. 테이블

| ID | 표시명 | 용도 | 주 props | 우선순위 |
|---|---|---|---|---|
| `data_table` | 데이터 테이블 | 기존 UiTool 확장 (정적 values 허용) | `title`, `columns[]`, `rows[]`, `sortable`, `page_size` | ✅ |
| `pivot_table` | 피벗 테이블 | 다차원 집계 | `rows[]`, `columns[]`, `values[]`, `aggregate (sum|avg|count)` | ⬜ |
| `comparison_table` | 비교 표 | 열별 색상·아이콘 | `columns[]`, `rows[]`, `highlight_rules[]` | 🟡 |

`data_table` 는 **기존 UiTool 을 그대로 쓰되 수동 모드에서는 `rows` 를 사용자가 직접 입력**(작은 JSON 에디터)할 수 있도록 속성 편집 패널 쪽에서만 처리한다.

### 3.5 E. 필터 & 제어 (Phase 2 에서 데이터 바인딩과 함께 의미를 가짐)

| ID | 표시명 | 용도 | 주 props | 우선순위 |
|---|---|---|---|---|
| `date_range_filter` | 날짜 범위 | 기간 필터 | `start`, `end`, `presets[]` | 🟡 |
| `select_filter` | 드롭다운 필터 | 단일 선택 | `label`, `options[]`, `value` | 🟡 |
| `multi_select_filter` | 멀티 셀렉트 | 다중 선택 | `label`, `options[]`, `values[]` | 🟡 |
| `search_box` | 검색 | 텍스트 필터 | `label`, `placeholder`, `value` | 🟡 |
| `segmented_control` | 세그먼트 탭 | 뷰 전환 | `options[]`, `value` | ⬜ |
| `toggle_switch` | 토글 | on/off | `label`, `value` | ⬜ |

**주의**: P3.0 MVP 에서 이들은 "**표시만 되고 실제 데이터에 연결되지 않음**" 상태. 실제 바인딩은 별도 설계(위젯 간 파라미터 채널)에서 다룸.

### 3.6 F. 상태 & 부가

| ID | 표시명 | 우선순위 |
|---|---|---|
| `alert_banner` | 정보/경보 배너 (전체 너비) | ✅ |
| `empty_state` | 빈 상태 안내 (일러스트 + 설명) | 🟡 |
| `tag_cloud` | 태그 클라우드 | ⬜ |
| `timeline` | 이벤트 타임라인 | 🟡 |
| `geomap` | 지도(Leaflet) | ⬜ (별도 라이선스 검토) |

### 3.7 P3.0 MVP 확정 목록 (✅ 항목만)

**14 개** — 레이아웃 4, KPI 3, 차트 5, 테이블 1, 부가 1:
`title_block`, `section_header`, `description_text`, `divider`,
`callout_box`,
`kpi_card`, `stat_grid`, `progress_bar`,
`line_chart`, `bar_chart`, `horizontal_bar_chart`, `pie_chart`, `donut_chart`,
`data_table`,
`alert_banner`

이 14 개로 **"타이틀 + 설명 + 핵심 KPI 3~4개 + 추세 차트 + 랭킹 차트 + 비율 차트 + 상세 표 + 경보 배너"** 로 구성되는 **전형적인 비즈니스 데이터 분석 대시보드**를 구성 가능하다.

### 3.8 커버리지 체크 — 데이터 분석 사용자 여정

| 분석 단계 | 필요한 위젯 | MVP 커버? |
|---|---|---|
| "한눈에 숫자 보기" | KPI 카드, 스탯 그리드, 진행률 | ✅ |
| "추세 확인" | 라인, 에어리어, 스파크라인 | ✅ (라인) · 🟡 에어리어·스파크 |
| "비교/랭킹" | 바, 가로바, 비교 표 | ✅ |
| "구성비" | 파이, 도넛, 트리맵 | ✅ (파이·도넛) |
| "분포/상관" | 스캐터, 히트맵, 히스토그램 | ⬜ → 🟡 단계에 |
| "세부 데이터" | 데이터 테이블, 피벗 | ✅ (테이블) |
| "필터링/상호작용" | 날짜/드롭다운/검색 | 🟡 (표시만) |
| "설명/맥락" | 타이틀, 섹션, 설명, 콜아웃 | ✅ |
| "경보/가이드" | 알림 배너, 엠프티 상태 | ✅ |

→ **MVP 는 분석 여정의 정량 70%** 를 수동 만으로 커버하며, 심층 분석(분포·상관·피벗)은 AI 채팅 또는 Phase 2 확장으로 보완한다.

---

## 4. 아키텍처

### 4.1 전체 구도
```
┌─────────────────────────────────────────────────────────────────┐
│ GenUIBuilder Page                                              │
│                                                                │
│ ┌──────────┐  ┌─────────────────────────┐  ┌───────────────┐ │
│ │ Widget   │  │ DashboardCanvas         │  │ Inspector     │ │
│ │ Palette  │  │ (react-grid-layout)     │  │ (속성 편집)   │ │
│ │ (★ 신규) │→│                         │  │ (★ 신규)      │ │
│ │          │  │  widgets[] 렌더링        │← │               │ │
│ └──────────┘  └─────────────────────────┘  └───────────────┘ │
│                                      ↑                        │
│                   ┌──────────────────┴──────────────┐          │
│                   │ ChatPane (scope=dashboard) 기존  │          │
│                   └─────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 백엔드 레이어

```
app/ui_tools/
├── base.py              # 기존 BaseUiTool
├── registry.py          # 기존
├── static/              # ★ 신규 디렉터리 — 수동 위젯 모음
│   ├── __init__.py
│   ├── layout.py        # TitleBlock, SectionHeader, Description, Divider, CalloutBox
│   ├── kpi.py           # KpiCard, StatGrid, ProgressBar
│   ├── charts.py        # LineChart, BarChart, ... (Recharts 직렬화 props)
│   ├── feedback.py      # AlertBanner
│   └── catalog.py       # ★ PaletteCatalog — 팔레트 응답 빌더
├── dashboard_ops.py     # 기존 add/update/remove/reflow (그대로)
```

각 static 위젯은 `BaseUiTool` 을 상속하되 `render()` 가 **고정 1 chunk**만 yield:

```python
class TitleBlockParams(BaseModel):
    text: str = "Untitled"
    level: Literal["h1", "h2", "h3", "h4"] = "h2"
    align: Literal["left", "center"] = "left"

class TitleBlockTool(BaseUiTool):
    name = "title_block"
    description = "섹션 제목을 표시하는 정적 타이틀 블록"
    Params = TitleBlockParams
    category = "layout"          # ← 신규 클래스 속성
    icon = "Heading"             # ← 팔레트 썸네일용
    default_grid = {"w": 12, "h": 1}

    def summarize_props(self, props): return f"[title] {props.get('text','')[:40]}"

    async def render(self, args, ctx):
        params = self.Params.model_validate(args)
        yield UiChunk(
            kind="component", call_id=ctx.call_id,
            component="TitleBlock", props=params.model_dump(),
        )
```

### 4.3 팔레트 카탈로그 API

**신규 엔드포인트**:
```
GET /api/ui-builder/widgets/catalog
→ 응답:
[
  {
    "tool": "title_block",
    "category": "layout",
    "label": "타이틀",
    "description": "섹션 제목 블록",
    "icon": "Heading",
    "default_grid": {"w": 12, "h": 1},
    "default_args": {"text": "Untitled", "level": "h2"},
    "schema": { ...model_json_schema()... }   // 속성 편집 패널용
  },
  ...
]
```
`PaletteCatalog.build()` 가 registry 를 순회하며 `category != None` 인 도구만 추려 반환. `weather/stock/data_table` 처럼 AI 전용으로 남길 도구는 `category = None` 으로 설정해 팔레트에서 숨김(단, 수동 추가 허용 시 `category="data"` 로 공개).

### 4.4 수동 위젯 생성 — 기존 dashboard_add_widget 재사용

기존 `dashboard_add_widget(tool, args, grid)` op 를 그대로 사용한다. 단 **HTTP 엔드포인트**를 추가해 SSE 대신 일반 REST 로 호출 가능하게 한다:

```
POST /api/ui-builder/projects/{id}/dashboard/widgets
body: { tool, args, grid?, source: "manual" }
→ 201 { widget: WidgetRead }
```

내부적으로:
1. `ui_tool_registry.get(tool).render()` 한 번 실행 → props 확정
2. `DashboardService.create_widget(tool, component, props, grid, source="manual")` 호출
3. WebSocket 으로 `dashboard_widget_added` 브로드캐스트 (동일 채팅 경로와 통합)

### 4.5 속성 편집 — dashboard_update_widget 재사용 + HTTP 래퍼

```
PATCH /api/ui-builder/projects/{id}/dashboard/widgets/{widget_id}
body: { action: "set_props", args: {...partial props...} }
→ 200 { widget: WidgetRead }
```

내부적으로 `dashboard_update_widget` 을 호출(기존 logic: props 병합 + invoke_action 라우팅).

### 4.6 프론트엔드 신규 컴포넌트

```
components/builder/dashboard/
├── DashboardCanvas.tsx            # 기존
├── ReflowToolbar.tsx              # 기존
├── WidgetPalette.tsx              # ★ 좌측 팔레트 (카탈로그 기반 그리드)
├── WidgetPaletteItem.tsx          # ★ 드래그 가능한 카드
├── Inspector.tsx                  # ★ 우측 속성 편집 패널 (JSON Schema → 폼)
├── inspector/
│   ├── SchemaForm.tsx             # 재귀 렌더러
│   ├── fields/
│   │   ├── TextField.tsx
│   │   ├── NumberField.tsx
│   │   ├── SelectField.tsx
│   │   ├── BooleanField.tsx
│   │   ├── ColorField.tsx
│   │   ├── IconField.tsx          # Lucide 아이콘 검색
│   │   ├── ArrayField.tsx         # series/rows 편집
│   │   ├── MarkdownField.tsx
│   │   └── JsonField.tsx          # fallback (rows 대량 입력용)
│   └── fieldResolver.ts           # schema.type+format → Field 매핑
└── widgets/                       # ★ 정적 위젯 React 구현체
    ├── TitleBlock.tsx
    ├── SectionHeader.tsx
    ├── DescriptionText.tsx
    ├── Divider.tsx
    ├── CalloutBox.tsx
    ├── KpiCard.tsx
    ├── StatGrid.tsx
    ├── ProgressBar.tsx
    ├── LineChart.tsx              # Recharts 래퍼
    ├── BarChart.tsx
    ├── HorizontalBarChart.tsx
    ├── PieChart.tsx
    ├── DonutChart.tsx
    ├── DataTableManual.tsx        # 기존 DataTableCard 확장 또는 재사용
    └── AlertBanner.tsx
```

`GenUiRenderer.tsx` 의 component 레지스트리(`WeatherCard/StockCard/DataTableCard` → React 컴포넌트)를 확장해 위 14 개를 모두 등록한다.

### 4.7 GenUIBuilder 페이지 레이아웃 변경

```
[Palette 220px] [Canvas flex-1] [Inspector 320px] [ChatPane 420px (기존)]
```

사용자가 공간을 줄이고 싶을 때:
- Palette: 접기 버튼 (32px 아이콘 레일만 남김)
- Inspector: 위젯 선택 없으면 자동 숨김 (flex:0)
- ChatPane: 기존 드래그 리사이즈 유지

모바일: Palette/Inspector 는 **모달/바텀 시트**로 전환.

---

## 5. 데이터 모델 변경

### 5.1 `UIBuilderDashboardWidget` — 필드 추가

| 컬럼 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `source` | `VARCHAR(16)` | `'chat'` | `chat` \| `pin-drag` \| `manual` |
| `category` | `VARCHAR(32)` nullable | — | 팔레트에서 추가 시 카테고리 사본(필터/정렬 캐시) |

마이그레이션: `a00N_dashboard_widget_source.py`
- 기존 행은 `source='chat'` 로 백필.

### 5.2 WidgetRead / WidgetCreate 스키마

```python
class WidgetRead(BaseModel):
    ...
    source: Literal["chat", "pin-drag", "manual"] = "chat"
    category: str | None = None

class WidgetManualCreate(BaseModel):
    tool: str
    args: dict[str, Any] = {}
    grid: GridPos | None = None
```

---

## 6. API 설계 정리

| 메서드 | 경로 | 용도 | 신규 |
|---|---|---|---|
| GET | `/api/ui-builder/widgets/catalog` | 팔레트 카탈로그 (전 프로젝트 공용) | ✅ |
| GET | `/api/ui-builder/projects/{id}/dashboard/widgets` | 현재 위젯 목록 | 기존 |
| POST | `/api/ui-builder/projects/{id}/dashboard/widgets` | **수동 추가** | ✅ |
| PATCH | `/api/ui-builder/projects/{id}/dashboard/widgets/{wid}` | **props / grid 편집** | ✅ |
| DELETE | `/api/ui-builder/projects/{id}/dashboard/widgets/{wid}` | 삭제 | 기존 |
| POST | `/api/ui-builder/projects/{id}/dashboard/layout/bulk` | 드래그/리사이즈 저장 | 기존 |
| POST | `/api/ui-builder/projects/{id}/dashboard/chat` | AI 채팅 (SSE) | 기존 |

수동 경로와 AI 경로 모두 **동일 WebSocket 브로드캐스트**(`dashboard_widget_*`)를 내보내어 다른 탭·사용자에서 동일하게 반영된다.

---

## 7. UX 상세

### 7.1 Widget Palette (좌측)
- 검색창(상단) + 카테고리 탭(레이아웃/KPI/차트/테이블/필터/상태)
- 각 아이템: 아이콘 + 한글 라벨 + 1줄 설명
- **인터랙션**: (a) 더블클릭 → 캔버스 첫 빈 위치에 `default_args` 로 추가, (b) 드래그 → 드롭 위치에 추가
- 🟡 접기/펼치기 토글 (32px 레일 ↔ 220px)

### 7.2 Inspector (우측, 위젯 선택 시)
- 상단 탭: `속성` / `위치` / `고급(JSON)`
- **속성** 탭: `schema` 기반 폼, 값 변경 시 300ms 디바운스로 `PATCH /widgets/{wid}` 호출
- **위치** 탭: x/y/w/h 정수 입력(슬라이더 + 넘버 필드)
- **고급** 탭: raw JSON 편집(전문가용), 저장 버튼
- 하단: "AI 로 수정 요청" 버튼 → ChatPane 에 `@선택_위젯` 컨텍스트 프리픽스 주입

### 7.3 Canvas 선택 / 포커스
- 위젯 클릭 → 테두리 하이라이트 + Inspector 열림
- `Esc` 로 선택 해제
- 다중 선택(Ctrl+Click) → 일괄 삭제 / 정렬 (P3.1)

### 7.4 기본 그리드 배치 규칙
- 팔레트에서 추가 시 `default_grid` 사용, y 는 현재 최대 y + 1
- `title_block` 은 항상 `w=12, h=1`
- `kpi_card` 는 `w=3, h=2` (한 줄에 4개)
- 차트/테이블은 `w=6, h=4`

---

## 8. Phase 계획

### P3.0 — MVP 수동 위젯 (이 문서 범위)
1. 백엔드: `ui_tools/static/*` + 14 개 위젯 + `/widgets/catalog` + POST/PATCH 엔드포인트
2. 프론트: WidgetPalette + Inspector(SchemaForm + 기본 Field) + 14 개 React 위젯
3. 마이그레이션 `a00N_dashboard_widget_source.py`
4. 통합 테스트: "AI 로 추가한 위젯을 Inspector 로 수정 가능" · "수동 추가한 위젯을 AI 가 update 가능"

### P3.1 — 확장 위젯 & UX 보강
- 🟡 위젯 추가: 스페이서, 이미지, 링크버튼, 스코어카드, 게이지, 에어리어, 스캐터, 히트맵, 콤보, 스파크라인 행, 비교 표, 4 가지 필터, 엠프티 상태, 타임라인
- 다중 선택 · 복제 · 정렬 정렬 · Undo/Redo 스택 확장
- 팔레트 즐겨찾기 / 최근 사용

### P3.2 — 데이터 바인딩(필터↔차트)
- Phase 2 설계로 이관. 필터 위젯 값이 특정 위젯의 props 에 `{{filter.date_range}}` 식으로 주입되는 채널.

---

## 9. 교차 영향 사전 체크리스트

- [x] 변경이 `ui_builder_*` 테이블 범위 내인가 → `UIBuilderDashboardWidget` 컬럼 2개 추가(앱 전용)
- [x] 포트 8004 / 5181 외 영향 없음
- [x] 플랫폼 스키마(users/permissions 등) 불변
- [x] PlatformApp 공용 인증/RBAC 흐름 유지
- [x] LLM Provider 인터페이스 변경 없음(수동 경로는 LLM 호출 없음)
- [x] 공용 `@v-platform/core` 변경 없음 — 모든 신규 컴포넌트는 앱 프론트 안에 둔다
- [ ] 마이그레이션 `a00N` 네이밍 확정 필요(현재 a001 존재, 이후 번호 할당)
- [ ] Recharts 의존성 추가 시 `apps/v-ui-builder/frontend/package.json` 만 수정(공용 패키지 무관)

---

## 10. 열린 질문 (v0.1 시점)

1. **데이터 테이블 rows 대량 입력 UX** — 빈 테이블에 50 행을 수동으로 넣기엔 Inspector 폼이 비효율. CSV 붙여넣기 탭을 Inspector 고급 탭에 둘지?
2. **필터 위젯 시각적 일관성** — 대시보드 전체에서 단 하나의 날짜 범위가 유효(싱글톤)한지, 필터별 독립 스코프인지 (P3.2 에서 결정).
3. **팔레트 다국어** — 현재 한국어 라벨 하드코딩 예정. i18n 키 분리는 v-platform 패턴을 따를지 별도.
4. **수동 ↔ AI 편집 충돌** — AI 가 `set_props` 중 사용자가 Inspector 로 편집한 경우 last-write-wins + 토스트 알림으로 처리(동시편집 락은 비채택).
5. **복잡 차트의 data 입력** — 라인/바 차트 series 를 Inspector 에서 직접 치기 부담스러움. "샘플 데이터 자동 채우기" 버튼으로 데모 데이터셋 1~3종 제공할지?

---

## 11. 관련 문서

- [`V_UI_BUILDER_DASHBOARD_CANVAS_DESIGN.md`](./V_UI_BUILDER_DASHBOARD_CANVAS_DESIGN.md) — 드래그·채팅 기반 캔버스 기본 설계
- [`V_UI_BUILDER_GENERATIVE_UI_DESIGN.md`](./V_UI_BUILDER_GENERATIVE_UI_DESIGN.md) — UiTool / dashboard_ops 인터페이스
- [`V_UI_BUILDER_DESIGN.md`](./V_UI_BUILDER_DESIGN.md) — 앱 전체 개요

---

**문서 버전**: 0.1 (Draft)
**최종 업데이트**: 2026-04-19
