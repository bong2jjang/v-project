---
id: migration-plan
title: VMS Chat Ops 마이그레이션 계획 (완료)
sidebar_position: 7
tags: [guide, developer]
---

# VMS Chat Ops 마이그레이션 계획

**작성일**: 2026-03-20
**완료일**: 2026-04-05
**상태**: ✅ 완료

---

## 개요

이 문서는 VMS Chat Ops 프로젝트의 Matterbridge 기반 아키텍처에서 **Light-Zowe 아키텍처**로의 마이그레이션 계획 및 완료 기록입니다.

---

## 마이그레이션 목표

1. **Matterbridge 의존성 제거** — 외부 바이너리 의존 없이 자체 구현
2. **Provider Pattern 도입** — Zowe Chat의 설계 철학을 차용한 플랫폼 추상화
3. **CommonMessage Schema** — 플랫폼 간 정규화된 메시지 형식
4. **Redis 기반 동적 라우팅** — TOML 파일 대신 실시간 Route 관리
5. **Docker Compose 통합** — 모든 서비스를 단일 Compose 파일로 관리

---

## 완료된 마이그레이션 항목

### Phase 1: 명칭 변경 및 기반 정리 ✅

- [x] Docker 이미지/컨테이너명 `vms-chatops-*` 접두사로 통일
- [x] Docker 네트워크명 `vms-chat-ops-network` 변경
- [x] `docker-compose.yml` 서비스 구조 정리
- [x] `.env.example` 생성 및 환경 변수 정리
- [x] CLAUDE.md 프로젝트 설정 업데이트

### Phase 2: Matterbridge → Light-Zowe 전환 ✅

- [x] `BasePlatformProvider` 인터페이스 설계
- [x] `SlackProvider` 구현 (Socket Mode)
- [x] `TeamsProvider` 구현 (Graph API + Bot Framework)
- [x] `CommonMessage` Pydantic 스키마 구현
- [x] `RouteManager` Redis 기반 구현
- [x] `WebSocketBridge` 메시지 브로커 구현
- [x] `MessageQueue` 배치 메시지 저장 구현
- [x] `matterbridge.toml` 의존성 완전 제거
- [x] Matterbridge 컨테이너 제거

### Phase 3: Frontend 전환 ✅

- [x] Dashboard: Matterbridge 상태 → Bridge 상태 표시
- [x] Channels → Routes 페이지: TOML Gateway → Redis Route CRUD
- [x] Settings → Provider 계정 관리 UI
- [x] Messages 페이지: 메시지 조회/검색
- [x] 사이드바/네비게이션 업데이트

### Phase 4: 인증 및 관리 ✅

- [x] JWT 인증 시스템
- [x] 사용자 관리 (Admin/User 역할)
- [x] 감사 로그
- [x] 비밀번호 재설정 (SMTP/MailHog)

### Phase 5: 인프라 ✅

- [x] PostgreSQL 16 데이터베이스
- [x] Redis 7 캐시/라우팅
- [x] Prometheus + Grafana + Loki 모니터링
- [x] MailHog 개발용 메일 서버

### Phase 6: 문서 정비 ✅

- [x] Docusaurus 기반 문서 사이트
- [x] 관리자 가이드 업데이트
- [x] 개발자 가이드 업데이트
- [x] API 문서 업데이트

---

## 제거된 컴포넌트

| 컴포넌트 | 상태 | 대체 |
|----------|------|------|
| `matterbridge.toml` | 삭제 | Redis Route Manager |
| Matterbridge 바이너리/컨테이너 | 삭제 | SlackProvider + TeamsProvider |
| `MatterbridgeControlService` | 삭제 | WebSocketBridge |
| `ConfigManager` (TOML) | 삭제 | Redis Route 키 |
| Gateway 개념 | 삭제 | Route 개념으로 대체 |
| SQLite 메시지 로그 | 삭제 | PostgreSQL messages 테이블 |

---

## 현재 아키텍처 (v3.0)

```
┌─────────┐       ┌──────────────────────┐       ┌─────────┐
│  Slack   │◄─────►│  WebSocket Bridge    │◄─────►│  Teams  │
│ Provider │       │  (Message Routing)   │       │ Provider│
│(Socket   │       │                      │       │(Graph   │
│ Mode)    │       │  ┌────────────────┐  │       │ API +   │
└─────────┘       │  │ Route Manager  │  │       │ Bot FW) │
                   │  │ (Redis)        │  │       └─────────┘
                   │  └────────────────┘  │
                   │  ┌────────────────┐  │
                   │  │ MessageQueue   │  │
                   │  │ (PostgreSQL)   │  │
                   │  └────────────────┘  │
                   └──────────────────────┘
```

자세한 아키텍처는 [ARCHITECTURE.md](architecture)를 참조하세요.

---

## 관련 문서

- [아키텍처](architecture) — Light-Zowe 아키텍처 상세
- [실행 계획](execution-plan) — 초기 개발 계획
- [Zowe Chat 마이그레이션](ZOWE_CHAT_MIGRATION_PLAN) — Light-Zowe 설계 배경
- [개발 가이드](development) — 현재 개발 환경

---

**최종 업데이트**: 2026-04-07
**문서 버전**: 3.0
