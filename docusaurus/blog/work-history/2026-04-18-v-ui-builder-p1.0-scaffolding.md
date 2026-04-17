---
slug: v-ui-builder-p1.0-scaffolding
title: v-ui-builder P1.0 — 앱 스캐폴딩
authors: [bong78]
tags: [v-ui-builder, scaffolding, design]
date: 2026-04-18
---

# v-ui-builder P1.0 — 앱 스캐폴딩

Bolt.new 의 대화형 UI 생성 경험을 v-platform 위에서 재현하는 **v-ui-builder** 앱의 최초 스캐폴딩.

<!-- truncate -->

## 목표

- v-platform 위에서 동작하는 네 번째 앱 추가 (기존: bridge / portal / template)
- 대화(LLM) → 코드 생성 → 즉시 미리보기(Sandpack) 파이프라인의 뼈대 배치
- 타 앱/플랫폼에 영향 없이 Docker profile `ui-builder` 로 분리

## 주요 의사결정

| 주제 | 결정 | 근거 |
|---|---|---|
| 샌드박스 | **@codesandbox/sandpack-react** (Apache 2.0) | WebContainer API 는 상업 유료, Nodebox 는 EULA 제약 |
| LLM | **OpenAI (MVP) + Provider Pattern** | `BaseLLMProvider` 추상화로 Gemini/Claude 는 config 만으로 교체 |
| 포트 | Backend `8004`, Frontend `5181` | 기존 앱(8000/8002/8080, 5173/5174/5180) 과 비충돌 |
| DB | 공유 `v_project`, 네임스페이스 `ui_builder_*` | 플랫폼 스키마 미변경, 앱 테이블만 신규 |
| Docker | profile `ui-builder` | 기본 빌드에서 제외, `--profile ui-builder` 로 기동 |

## 추가된 것

### 설계 문서
- `docusaurus/docs/design/V_UI_BUILDER_DESIGN.md` (14섹션): 아키텍처/데이터 모델/API/SSE 이벤트/Provider 인터페이스/샌드박스 전략/로드맵/리스크

### Backend (`apps/v-ui-builder/backend/`)
- `app/main.py` — PlatformApp 진입점 (v-platform-template 패턴 준수)
- `app/llm/base.py` — `BaseLLMProvider` + `LLMChunk(kind, delta, file_path)` 스키마
- `app/llm/registry.py` — Provider 레지스트리 스텁 (P1.1 에서 OpenAI 등록)
- `migrations/a001_create_ui_builder_tables.py` — `ui_builder_projects/messages/artifacts` 3 테이블 (idempotent)
- `Dockerfile`, `requirements.txt` (openai/sse-starlette 는 P1.1 에서 주석 해제)

### Frontend (`apps/v-ui-builder/frontend/`)
- `src/App.tsx` — PlatformProvider + `/builder/:projectId` 라우트
- `src/pages/Dashboard.tsx` — 환영 카드 + "새 프로젝트" 버튼
- `src/pages/Builder.tsx` — 3-pane 그리드 `grid-cols-[360px_1fr_1fr]`
- `src/components/builder/{ChatPane,CodePane,PreviewPane}.tsx` — P1.2 구현 자리표시
- `package.json` — `@codesandbox/sandpack-react`, `@monaco-editor/react`, `eventsource-parser` 추가
- `vite.config.ts` — HMR 5181, proxy → `ui-builder-backend:8000`
- `Dockerfile.dev` — pnpm workspace 필터 `v-ui-builder-frontend...`

### 인프라
- `docker-compose.yml` — `ui-builder-backend` / `ui-builder-frontend` 서비스 + `ui_builder_backend_data` 볼륨
- `apps/v-ui-builder/CLAUDE.md` — 8섹션 앱 스코프 문서 (가드레일·Provider Pattern 규칙)

## 교차 영향 검증

- [x] `platform/**` 미수정
- [x] 타 앱(`v-channel-bridge`, `v-platform-portal`, `v-platform-template`) 미수정
- [x] `docker-compose.yml` 의 타 앱 섹션 미변경 (ui-builder 블록만 추가)
- [x] 플랫폼 테이블 스키마 미변경
- [x] 공용 포트(8000/8002/8080/5173/5174/5180) 미충돌

## 다음 단계 (P1.1)

백엔드 라우터 + OpenAI Provider 실연결:
- `app/api/projects.py` — 프로젝트 CRUD
- `app/api/chat.py` — SSE 스트리밍 엔드포인트
- `app/llm/openai.py` — OpenAIProvider (artifact_start/delta/end 파싱)
- `requirements.txt` 의존성 활성화 + 마이그레이션 startup 훅

## 참고

- 설계 배경: `docusaurus/docs/design/V_UI_BUILDER_DESIGN.md`
- 앱 스코프 가이드: `apps/v-ui-builder/CLAUDE.md`
