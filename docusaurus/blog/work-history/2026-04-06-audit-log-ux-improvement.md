---
title: "감사 로그 페이지 UX 및 성능 개선"
date: 2026-04-06
tags: [frontend, backend, audit-log, ux, performance]
---

# 감사 로그 페이지 UX 및 성능 개선

## 작업 개요

감사 로그 페이지를 실제 사용 시나리오를 고려하여 사용성과 성능을 개선합니다.

## 작업 계획

### Phase 1: 백엔드 성능 개선
1. **DB 복합 인덱스 추가**: 주요 필터(status, action, user_email, resource_type) + timestamp 복합 인덱스
2. **CSV 내보내기 API**: `GET /api/audit-logs/export/csv` — StreamingResponse, 최대 10,000건

### Phase 2: 프론트엔드 전면 개편
1. **필터 강화**: DateRangePicker 날짜 범위, 이메일 디바운스, 필터 초기화
2. **테이블 개선**: 액션 한글화, 상세 모달, perPage 선택(20/50/100)
3. **페이지네이션 개선**: 페이지 번호 직접 표시
4. **CSV 내보내기**: 현재 필터 조건 적용 다운로드
5. **URL 동기화**: 필터 상태 ↔ URL 쿼리 파라미터
6. **액션 한글화**: 전체 AuditAction enum 한글 매핑
7. **통계 카드**: 전체/성공/실패 건수 + 활성 필터 수 표시

## 변경 파일

- `backend/app/models/audit_log.py` — 복합 인덱스
- `backend/app/api/audit_logs.py` — CSV 내보내기
- `frontend/src/lib/api/auditLogs.ts` — API 함수 추가
- `frontend/src/pages/AuditLogs.tsx` — 전면 개편

## 설계 문서

- [`AUDIT_LOG_UX_IMPROVEMENT.md`](/docs/design/AUDIT_LOG_UX_IMPROVEMENT)
