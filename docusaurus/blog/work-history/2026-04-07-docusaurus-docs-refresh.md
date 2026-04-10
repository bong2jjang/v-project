---
title: "Docusaurus 문서 전면 최신화"
date: 2026-04-07
authors: [claude-code]
tags: [docs, docusaurus, refresh]
---

# Docusaurus 문서 전면 최신화 작업계획

## 배경

`docusaurus/docs/` 하위 34개 .md 파일을 검토한 결과, 상당수가 **Matterbridge 기반 구 아키텍처**로 작성되어 있어 현재 **Light-Zowe Provider Pattern 아키텍처**와 불일치합니다. 문서 신뢰성 확보를 위해 전면 최신화를 진행합니다.

## 현황 분석

### 전면 재작성 필요 (11개)

| 문서 | 사유 |
|------|------|
| `intro.md` | 디렉토리 구조·링크 모두 구 구조 참조, Matterbridge 언급 |
| `user-guide/USER_GUIDE.md` | Matterbridge 제어 UI 기반, v0.4.0 |
| `api/API.md` | Matterbridge API 엔드포인트, 현재 16개 라우터 미반영 |
| `developer-guide/ARCHITECTURE.md` | Matterbridge 아키텍처 다이어그램 |
| `admin-guide/ADMIN_GUIDE.md` | 관리 절차 전면 변경 |
| `admin-guide/DEPLOYMENT.md` | Docker Compose 구성 변경 |
| `admin-guide/TROUBLESHOOTING.md` | Matterbridge 문제해결 참조 |
| `admin-guide/SLACK_SETUP.md` | "Matterbridge와 Slack 연동" |
| `admin-guide/TEAMS_SETUP.md` | "Matterbridge와 Teams 연동" |
| `developer-guide/DEVELOPMENT.md` | 기술 스택·워크플로우 변경 |
| `developer-guide/TESTING_GUIDE.md` | 테스트 구조 변경 |

### 부분 업데이트 필요 (3개)

| 문서 | 사유 |
|------|------|
| `developer-guide/EXECUTION_PLAN.md` | 완료 항목 체크 업데이트 |
| `admin-guide/MONITORING_SETUP.md` | Prometheus/Grafana/Loki 현재 구성 반영 |
| `developer-guide/MIGRATION_PLAN.md` | 마이그레이션 완료 상태 반영 |

### 스킵 (최신 상태, 20개)

| 카테고리 | 문서 |
|----------|------|
| design/ | ADVANCED_MESSAGE_FEATURES, AUDIT_LOG_UX_IMPROVEMENT, CHAT_EXPERIENCE_IMPROVEMENT_PLAN, CHAT_SUPPORT, CLAUDE_CODE_TOKEN_OPTIMIZATION, ENV_VS_DATABASE_PROVIDERS, MESSAGE_HISTORY_IMPROVEMENT, MESSAGE_LATENCY_OPTIMIZATION, MONITORING_IMPROVEMENT, PHASE1_PROVIDER_UI_PLAN, PLATFORM_FEATURE_PERMISSIONS_PLAN, REMAINING_TASKS_ROADMAP, SELF_CORRECTION_LOOP_REVIEW, STATISTICS_DASHBOARD_IMPROVEMENT, TEAMS_DELEGATED_AUTH |
| developer-guide/ | DESIGN_SYSTEM, PAGE_LAYOUT_GUIDE, ZOWE_CHAT_MIGRATION_PLAN |
| admin-guide/ | EMAIL_SETUP, SSL_TLS_SETUP |

## 작업 순서

1. **작업계획 문서 작성** (본 문서)
2. **핵심 문서 재작성** — intro.md → ARCHITECTURE → API → USER_GUIDE
3. **관리자 가이드 재작성** — ADMIN_GUIDE → DEPLOYMENT → TROUBLESHOOTING → SLACK_SETUP → TEAMS_SETUP
4. **개발자 가이드 재작성** — DEVELOPMENT → TESTING_GUIDE
5. **부분 업데이트** — EXECUTION_PLAN, MONITORING_SETUP, MIGRATION_PLAN
6. **Docusaurus 빌드 테스트** — 깨진 링크·에러 확인

## 작성 원칙

- **Light-Zowe 아키텍처 기준**: Provider Pattern, CommonMessage, Route Manager, WebSocket Bridge
- **현재 코드베이스 기반**: 실제 파일 경로, API 엔드포인트, Docker Compose 구성 반영
- **Matterbridge 참조 완전 제거**: 구 아키텍처 설명은 마이그레이션 문서에만 유지
- **한국어 문서**: 기존 한국어 스타일 유지
- **Docusaurus frontmatter 유지**: id, title, sidebar_position, tags

## 변경 영향도

- 총 14개 문서 수정 (11개 전면 재작성 + 3개 부분 업데이트)
- 20개 문서 스킵 (최신 상태)
- Docusaurus 사이드바 구조 변경 없음 (카테고리 유지)
