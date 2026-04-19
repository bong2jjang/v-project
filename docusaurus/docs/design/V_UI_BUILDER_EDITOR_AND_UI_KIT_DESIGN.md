# v-ui-builder 에디터/UI 킷 전략 & Generative UI 로드맵 (방안 C)

**상태**: Draft v0.1
**작성일**: 2026-04-19
**작성자**: v-project 팀
**영향 범위**: `apps/v-ui-builder/**` — 플랫폼/타 앱 영향 최소 (플랫폼 UI Kit 은 건드리지 않음)
**전제 문서**:
- [`V_UI_BUILDER_DESIGN.md`](./V_UI_BUILDER_DESIGN.md) — P1.x 베이스
- [`V_UI_BUILDER_GENERATIVE_UI_DESIGN.md`](./V_UI_BUILDER_GENERATIVE_UI_DESIGN.md) — Generative UI 방안 A/B/C 비교

---

## 0. 요약 (TL;DR)

| 주제 | 결론 | 한 줄 이유 |
|---|---|---|
| **Monaco 심화 도입** | ✅ **권장** (P2 범위 내 확장) | 이미 설치·동작 중. "IDE 다움" 확보 비용이 가장 낮은 투자 |
| **Shadcn 전면 도입** (플랫폼 전역) | ❌ **비권장** | 플랫폼 UI Kit(25개) 와 중복·분열, 모든 앱 번들 팽창 |
| **Shadcn 앱 로컬 도입** (v-ui-builder 내부 UX 전용) | 🔶 **조건부 권장** | Builder/Chat 같은 "IDE UX" 에만 좁게 채택, 플랫폼 페이지는 그대로 |
| **Shadcn 을 Sandpack 미리보기 런타임에 주입** | ✅ **권장** (최고 ROI) | LLM 이 생성하는 코드의 "디자인 시스템" 으로 — Bolt/v0 수준의 결과물 품질 |
| **Generative UI (방안 C)** | ✅ **채택** | 현 스택에 정합한 B 단독으로 P2.x 완성, A 는 트리거 조건 발생 시만 |

**핵심 메시지**: Monaco 는 "에디터 경험" 축, Shadcn 은 **두 개의 다른 축에 각기 다른 규모로** 붙이는 것이 맞다 — (1) v-ui-builder **자기 UI** 는 기존 플랫폼 Kit 고수, (2) **Sandpack 안(= LLM 산출물)** 에는 Shadcn 을 주입해 생성 결과의 시각 품질을 올린다.

---

## 1. 배경

### 1.1 현재 상태 (실측)
- `apps/v-ui-builder/frontend/package.json` — `@monaco-editor/react ^4.6.0` **설치 및 사용 중**, `@codesandbox/sandpack-react ^2.19.8` 사용.
- `platform/frontend/v-platform-core/src/components/ui/` — Alert/Badge/Button/Card/DateRangePicker/DepartmentTreePicker/Divider/EmptyState/InfoBox/InfoTooltip/Input/Modal/MultiSelect/PlatformIcon/RestartConfirmDialog/Select/SimpleMarkdown/Skeleton/Spinner/Table/Tabs/Textarea/Toggle/Tooltip **25개 자체 컴포넌트**로 구성된 Tailwind + lucide 기반 Kit.
- Radix / class-variance-authority / shadcn 관련 의존성은 **전 리포에 없음** (`grep` 결과 0 파일).

### 1.2 제기된 질문
> "v-ui-builder 에 Monaco Editor, Shadcn 의 도입을 검토 중인데 어떤 것 같아? 향후 방향을 함께 검토해서 새로운 문서로 작성해줘. 방안 C (Generative UI 하이브리드) 가 좋아 보이니 그 방향으로 위 내용 포함해서 검토해줘."

본 문서는 **(A) Monaco 의 현재 상태 점검 + 심화 투자**, **(B) Shadcn 도입의 3가지 스코프 분리**, **(C) Generative UI 방안 C 로드맵을 반영한 통합 실행 계획** 을 한 장에 묶는다.

---

## 2. Monaco Editor — 이미 도입됨, 다음은 "심화"

### 2.1 현재 구현 수준 (`CodePane.tsx` 기준)
- 싱글 에디터(활성 파일 1개), TS/JS 진단 꺼둠(Sandpack 이 실제 컴파일 담당), 테마 연동(vs-dark / light), `readOnly` 동안 스트리밍 보호.
- **없는 것**: 파일 탭, 에디터 멀티 뷰, Diff 뷰, Find/Replace, 커맨드 팔레트, 고정된 type 로딩(React/Node types), Format-on-save, LSP.

### 2.2 권장 확장 (비용 대비 효과 순)

| 순위 | 확장 | 예상 비용 | 기대 효과 |
|---|---|---|---|
| 1 | **파일 탭 + 다중 모델(`monaco.editor.createModel`)** | 0.5일 | 여러 파일 빠른 전환 — IDE 체감 대폭 상승 |
| 2 | **React/Shadcn types 사전 로딩** (`addExtraLib`) | 0.5일 | 자동완성·호버 힌트가 실제 API 반영 |
| 3 | **Diff Editor** (LLM 이 수정한 파일 변경점 시각화) | 1일 | Bolt.new/Cursor 풍 UX, 롤백 UX 의 기반 |
| 4 | **Format-on-save (Prettier via Web Worker)** | 0.5일 | 붙여넣은 LLM 코드 포매팅 일관화 |
| 5 | **Command Palette / Keybindings 확장** | 0.5일 | VS Code 유저 친화 |
| 6 | Monaco **LSP 브릿지**(tsserver in-browser) | 3~5일 (연구성) | 실제 타입 오류 — 단, 무거움·유지보수 부담 ↑ |

- 순위 1~4 는 **P2 범위 내에서 함께 처리** 권장. 5~6 은 필요 드러나면 별도 이슈.
- 순위 2 가 **Shadcn 도입(§3) 과 직접 연결**된다 — Sandpack 런타임에 Shadcn 이 있으면 Monaco 에도 그 타입을 태워야 자동완성이 의미 있다.

### 2.3 리스크
- Monaco 초기 번들 크기(워커 포함 ~1MB+). **이미 감수 중**. Diff Editor·LSP 등을 더하면 + 수 백 KB.
- 대응: `vite-plugin-monaco-editor` 가 worker 를 별도 chunk 로 분리. `React.lazy` + Builder 라우트 진입 시 로드(이미 구조적으로 분리 가능).

---

## 3. Shadcn — "도입"은 **어디에** 인가를 먼저 결정

Shadcn/ui 는 **패키지가 아니라 레시피 집합** 이다: `components.json` + CLI 가 Radix + Tailwind + CVA 기반 컴포넌트를 **소스 코드로 프로젝트에 복사**해 넣는다. "의존성 추가" 와 "코드 소유권 증여" 의 중간 모델.

이 특성 때문에 "도입 = Yes/No" 가 아니라 **"어느 스코프에 도입?"** 이 올바른 질문이다.

### 3.1 스코프 세 가지
| 스코프 | 뜻 | 권장 |
|---|---|---|
| **S1. 플랫폼 전역** (`@v-platform/core/components/ui` 를 Shadcn 으로 교체/혼용) | 모든 앱이 Shadcn 기반 UI 로 전환 | ❌ **비권장** |
| **S2. v-ui-builder 앱 로컬** (앱의 `Chat/Canvas/Builder` 전용 UX 에만) | 앱 내부에 `src/components/shadcn/*` 만들어 좁게 사용 | 🔶 **조건부 권장** |
| **S3. Sandpack 미리보기 안** (LLM 이 생성하는 코드의 런타임 디자인 시스템) | Sandpack 의 `files` / `customSetup.dependencies` 에 Shadcn 컴포넌트를 **미리 주입** | ✅ **강력 권장** |

### 3.2 S1 (플랫폼 전역) — 왜 비권장인가
- 플랫폼 UI Kit(25개)과 **기능 중복**. 두 시스템을 혼용하면 디자인 토큰 분열·번들 중복·스토리북/감사·접근성 정책 재작성 필요.
- 플랫폼 스코프 변경은 `platform/CLAUDE.md` 에서 **모든 앱 영향** 으로 분류돼 "사용자 승인 필요" 항목(또는 breaking change) 에 해당.
- 플랫폼은 자체 토큰 시스템(`bg-surface-card`, `text-content-primary` 등) 으로 다크/라이트·밀도가 일관. 이 자산을 버리는 이득이 안 보인다.

### 3.3 S2 (앱 로컬) — 조건부 권장
가치 있는 케이스:
- Builder 의 **IDE UX 위젯** (Command Palette, Context Menu, HoverCard, Dialog, Sheet) — 플랫폼 Kit 에 **없거나 경량화된** 컴포넌트가 많다.
- Radix 의 a11y (focus trap, roving tabindex) 이 필요한 채팅/에디터 인터랙션.

조건:
- 새 코드는 **`apps/v-ui-builder/frontend/src/components/ui-shadcn/`** 에만 둔다(네임 충돌 방지, Grep 으로 스코프 식별 가능).
- 기존 플랫폼 페이지(Users/Settings/AuditLogs) 는 **절대 건드리지 않는다**.
- Tailwind 설정은 플랫폼 토큰을 **선행(preset)** 으로 두고, Shadcn 의 `--background`/`--foreground` CSS 변수는 **앱 로컬 토큰 매핑** 으로만 연결(디자인 이중화 방지).

### 3.4 S3 (Sandpack 안) — 최고 ROI
**왜 핵심인가**: v-ui-builder 의 아웃풋은 **LLM 이 생성한 React 코드** 다. 이 코드가 "빈 React + 일반 HTML" 로 나오면 Bolt.new / v0 / Claude Artifacts 수준의 결과물에 미치지 못한다. Shadcn 은 그 LLM 들에게 **사실상 표준 디자인 시스템** 이다.

구현:
1. `apps/v-ui-builder/frontend/src/sandpack/preset/` 하위에 Shadcn 기본 컴포넌트 일부(Button, Card, Input, Dialog, Badge 등 ~15개) 을 **소스 파일로** 관리.
2. `SandpackProvider` 의 `files` 에 `preset/*` 을 **virtual 파일로 동봉** 또는 `customSetup.dependencies` 에 `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge` 를 올림.
3. LLM 시스템 프롬프트에 **"Use components from `@/components/ui/*` which are shadcn-based"** 명시 — LLM 이 매번 버튼을 처음부터 만드는 대신 `import { Button } from "@/components/ui/button"` 을 쓰게 한다.
4. Monaco 에 위 Shadcn 의 `.d.ts` 를 `addExtraLib` 로 주입 → 에디터 자동완성/호버 힌트도 맞아떨어짐(§2.2 순위 2 와 직결).

### 3.5 Shadcn 관련 리스크
- **CLI 모델** — 프로젝트 내 복사본이므로 업스트림 개선을 수동으로 따라잡아야 함. 15개 내외로 선별 후 고정.
- **번들 팽창** (S3) — Sandpack iframe 안에서만 번들링되므로 앱 본체 번들과 **완전히 격리**. 영향 없음.
- **Tailwind config 중복** (S2·S3) — `content` glob 을 명확히 분리. S2 의 shadcn 파일은 앱 tailwind.config 에, S3 의 preset 은 Sandpack 내 tailwind.config 에 포함.

---

## 4. Generative UI — 방안 C 로드맵 (확정)

[`V_UI_BUILDER_GENERATIVE_UI_DESIGN.md`](./V_UI_BUILDER_GENERATIVE_UI_DESIGN.md) §4 에서 제시한 방안 C 를 본 문서에서 **실행 트랙** 으로 확정한다.

### 4.1 재확인
- **베이스 = 방안 B**: FastAPI tool-call + SSE `ui_*` 이벤트 + 클라이언트 컴포넌트 화이트리스트(`GEN_UI_COMPONENTS`, `React.lazy`).
- **탈출 해치 = 방안 A (Next.js 사이드카)**: §4.3 의 트리거 조건 충족 시에만.

### 4.2 본 문서의 추가 조항 (에디터/UI 킷 통합)
1. **`GEN_UI_COMPONENTS` 의 내부 구현은 Shadcn 기반으로 작성**한다. 이유: (a) 채팅 안 Generative UI(StockChart/WeatherCard/DataTable) 도 Sandpack 안 생성 코드와 **동일한 디자인 언어** 여야 사용자 경험이 일관됨. (b) Pin-to-Sandpack 기능(§6 로드맵) 구현 시, Generative 컴포넌트를 Sandpack 파일로 "그대로" 스냅샷할 수 있음 — 코드 변환 계층이 거의 필요 없다.
2. **Monaco 에는 GEN_UI_COMPONENTS 의 props 타입을 `addExtraLib` 로 주입**한다. LLM 이 Sandpack 코드에서 `<StockChart symbols={...} />` 를 직접 호출해도 타입 힌트가 붙는다.
3. **Tool Registry 의 `UiChunk.props` JSON 스키마** 와 **Shadcn 컴포넌트 props 타입** 을 **단일 소스**(e.g. Zod) 로 유지 — 서버 검증 + 클라 타입 + Monaco 자동완성 3곳에서 일관.

### 4.3 방안 A (Next.js) 의 트리거 조건 — 재명시
다음 중 **하나라도** 성립 시에만 Next.js 사이드카 `apps/v-generative-ui/` 도입을 별도 검토한다.
- 서버에서 완전 렌더한 HTML/PDF/OG 이미지가 요구됨.
- 컴포넌트 소스를 클라이언트에 노출 금지하는 규제 요구.
- 서버 전용 React 렌더 경로가 필요한 서드파티 라이브러리.

현 시점 유스케이스에는 해당 없음 → **B 단독 진행**.

---

## 5. 통합 아키텍처 (에디터 + UI Kit + Generative UI)

```
┌──────────────────────── v-ui-builder Frontend ──────────────────────────┐
│                                                                         │
│  ChatPane (Generative UI 메시지 렌더)                                   │
│   ├─ MessageBubble                                                       │
│   └─ GenUiRenderer ── GEN_UI_COMPONENTS (shadcn-based, React.lazy)      │
│                                                                         │
│  CanvasPane                                                              │
│   ├─ CodePane — Monaco                                                   │
│   │    ├─ 다중 모델 + 탭 (P2 확장)                                       │
│   │    ├─ Diff Editor (P2 확장)                                          │
│   │    └─ addExtraLib: React/Shadcn/GEN_UI props                        │
│   └─ PreviewPane — Sandpack                                              │
│         ├─ customSetup.dependencies: radix, cva, clsx, tailwind-merge   │
│         ├─ virtual files: /components/ui/* (shadcn preset)              │
│         └─ iframe 내부만 bundle — 앱 본체와 격리                          │
└─────────────────────────────────────────────────────────────────────────┘
                   │ SSE: content / artifact_* / ui_* / snapshot
                   ▼
┌──────────────────────── v-ui-builder Backend ───────────────────────────┐
│  ChatService → Provider.stream(tools=registry.tools)                    │
│    ├─ tool_call 청크 감지 → tool_registry.get(name).render(args, ctx)   │
│    └─ UiChunk (loading / component / patch / error) → SSE 변환           │
│                                                                         │
│  tool_registry: Weather / Stock / DataTable / ...                       │
│    - schema(Zod) 단일 소스 → 서버 검증 + 클라 타입 + Monaco addExtraLib  │
│                                                                         │
│  /api/ui-action → tool.invoke_action(...)                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 통합 로드맵 (P2.x 재배치)

| Phase | 기간 | 주제 | 산출물 |
|---|---|---|---|
| **P2.0 — 프로토콜 뼈대** | 1.5일 | Generative UI 서버/SSE | `BaseUiTool`, `tool_registry`, `ui_*` 이벤트, `ui_calls JSONB` 마이그레이션 |
| **P2.1 — Monaco 심화 (1차)** | 1일 | 에디터 | 다중 모델 + 파일 탭, Find/Replace, 테마 통합 정리 |
| **P2.2 — Sandpack Shadcn Preset** | 1.5일 | S3 도입 | `sandpack/preset/` 에 shadcn 15개, `customSetup.dependencies`, LLM 시스템 프롬프트 반영 |
| **P2.3 — GEN_UI 컴포넌트 (shadcn 기반)** | 1.5일 | 클라 렌더러 | `GenUiRenderer`, Weather/Stock/DataTable 3종 (Shadcn Card/Table 사용) |
| **P2.4 — Tool 구현 + `/api/ui-action`** | 2일 | 서버 | Weather/Stock/Table 실제 데이터 연결, 후속 액션 라우팅 |
| **P2.5 — Monaco 심화 (2차)** | 1.5일 | 에디터 | `addExtraLib` (React + Shadcn + GEN_UI 타입), Diff Editor |
| **P2.6 — 앱 로컬 shadcn(S2) 선별 도입** | 1일 | 앱 UX | Command Palette / Sheet / HoverCard 3종 내부화, 플랫폼 페이지 미접근 확인 |
| **P2.7 — Pin to Sandpack** | 1일 | 교차 | Generative 컴포넌트 → Sandpack 파일로 스냅샷 (동일 shadcn 기반이라 변환 최소) |
| **P2.8 — 보안/비용 가드 + 베타** | 1일 | 운영 | rate limit, 감사 로그, 비용 대시보드, 내부 5명 베타 |

총 **12일 추정**. P2.0 → P2.2 → P2.3 만으로 **"채팅에 shadcn 카드 스트리밍 + Sandpack 에서 같은 디자인 시스템으로 연속 편집"** 데모 가능.

---

## 7. 위험 & 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Shadcn + 플랫폼 Kit **디자인 이중화** | UI 불일치 | S1 금지 규약. S2·S3 는 **플랫폼 토큰을 CSS 변수로 매핑**해 색/폰트/밀도 일치 |
| Shadcn preset 번들이 Sandpack 로딩을 **무겁게** 함 | 첫 프리뷰 지연 | 필수 15개만 유지, `customSetup.dependencies` 로 CDN(esm.sh) 활용 검토 |
| Monaco `addExtraLib` **타입 파일 드리프트** | 자동완성 오류 | 빌드 타임에 `generateTypes.ts` 로 GEN_UI props 를 `.d.ts` 로 자동 생성 (Zod → .d.ts) |
| Generative UI tool 이 LLM 호출을 **중첩 폭주** | 비용·지연 | 메시지당 tool-call ≤ 3, 동일 tool 디바운스, `/api/ui-action` rate limit |
| Shadcn 업스트림 변경 **수동 따라잡기** 비용 | 유지보수 | preset 을 15개로 제한, 분기당 1회 동기화 의례화 |
| Next.js 사이드카 수요가 **조기 발생** | 방향 전환 | §4.3 트리거 명시. 조기 발생 시 방안 A 문서 re-open |

---

## 8. 타 앱/플랫폼 영향 분석

| 영역 | 영향 | 비고 |
|---|---|---|
| `platform/**` | ❌ **수정 없음** | 플랫폼 UI Kit 그대로 유지 (S1 배제) |
| `apps/v-channel-bridge`, `v-platform-portal`, `v-platform-template` | ❌ | 전혀 미접근 |
| `docker-compose.yml` | ❌ | 신규 서비스 없음 |
| DB | 🔄 `ui_builder_messages.ui_calls JSONB` 1 컬럼 추가 | 사용자 승인 필요 (마이그레이션 1건) |
| 번들 | 앱 본체 번들 ↑ (Monaco 확장, shadcn S2 만큼) | Sandpack preset(S3) 은 iframe 격리로 무영향 |

---

## 9. **내 의견** (의사결정용)

> 정리: **"Monaco 는 이미 쓰고 있으니 더 깊이 쓰자. Shadcn 은 플랫폼 전역이 아니라 Sandpack 안(S3)에 먼저, 그 다음 앱 로컬(S2)에 선별적으로."** 그 위에 **Generative UI 방안 C** 를 얹는 것이 우리 스택·조직에 가장 정합한 그림이라고 봅니다.

**왜 이 조합을 고르는가**:

1. **Sandpack 안(S3)의 Shadcn 이 "결과물 품질"의 가장 큰 레버다.** v-ui-builder 의 성패는 "LLM 이 만든 UI 가 얼마나 그럴듯한가" 로 판가름난다. Bolt.new·v0·Claude Artifacts 의 좋은 결과물 대부분이 Shadcn 스타일. **아무것도 바꾸지 않으면 이 격차는 사라지지 않는다.** 이 하나만 도입해도 사용자 체감 품질이 가장 많이 오른다.
2. **Monaco 심화는 "개발자 신뢰"의 레버다.** IDE 같아 보이는가는 탭·Diff·자동완성에서 결정된다. 이미 의존성이 있고, 번들/워커 인프라가 깔려 있으므로 **한계비용이 낮다.** S3 와 직렬로 처리하면 "에디터에서 Shadcn 자동완성 → Sandpack 에서 같은 Shadcn 렌더" 가 맞물려 체감 품질이 배수로 오른다.
3. **플랫폼 전역(S1) 전환은 *지금* 할 이유가 약하다.** 플랫폼 Kit 25개가 이미 다크/라이트·접근성·토큰·감사 UI 와 맞물려 정착돼 있다. Shadcn 으로 갈아엎는 이득이 **명확하지 않고**, 루트 `CLAUDE.md` 의 "앱 스코프에서 먼저 시도" 원칙과도 맞지 않는다.
4. **앱 로컬(S2)은 "기능이 부족할 때만" 들이자.** Command Palette / Sheet / HoverCard 처럼 플랫폼에 없고 Builder 에 필요한 3~5개부터 작게. 그 이상은 점진적으로.
5. **Generative UI 는 방안 C (= B 단독 실행 + A 는 트리거 조건부)** 가 옳다. 현 스택에서 `streamUI` 를 그대로 쓰려면 Next.js 서브앱이 필요한데, 지금 유스케이스로는 오버엔지니어링이다. **Tool-call + Client Registry** 는 우리 SSE 스택과 완전히 정합하고, 위의 S3·Monaco·Pin-to-Sandpack 과 자연스럽게 맞물린다.

**명시적으로 반대하는 것**:
- "Shadcn 전면 도입으로 플랫폼 UI Kit 교체" — 이득 대비 비용이 과도하며 **모든 앱을 건드리는 breaking change** 라 본 앱 스코프를 넘는다.
- "Generative UI 를 위해 Next.js 서브앱을 지금 신설" — §4.3 트리거 조건이 아직 없음.

**예상되는 불확실성**:
- Shadcn preset 을 Sandpack 의 `customSetup.dependencies` + virtual files 중 **어느 조합으로 얹을지** 는 실측 후 결정(번들 사이즈/로딩 지연 측정).
- GEN_UI props 의 **단일 소스(Zod) → .d.ts 생성 파이프라인** 은 빌드 타임 훅을 새로 만들어야 하는 소규모 투자(반나절).

**다음 결정이 필요한 것**:
- [ ] S3 Shadcn preset 초기 15개 선정 (Button/Card/Input/Label/Textarea/Badge/Dialog/Sheet/Tabs/Select/Separator/Skeleton/Toast/Tooltip/DropdownMenu 제안).
- [ ] S2 로 앱에 들여올 우선순위 3개 (Command / HoverCard / ContextMenu 제안).
- [ ] `ui_builder_messages.ui_calls JSONB` 마이그레이션 승인.

위 세 건에 대한 가부만 확인되면 P2.0 착수 가능합니다.

---

## 10. 참고

- 전제 문서: `V_UI_BUILDER_DESIGN.md`, `V_UI_BUILDER_GENERATIVE_UI_DESIGN.md`
- Monaco Editor: https://microsoft.github.io/monaco-editor/
- Shadcn/ui (복사 기반 UI 라이브러리): https://ui.shadcn.com/
- Radix UI Primitives: https://www.radix-ui.com/primitives
- Sandpack 고급 구성: https://sandpack.codesandbox.io/docs/advanced-usage/custom-setup
- Vercel v0 · Bolt.new · Claude Artifacts (디자인 시스템 관찰 근거)
