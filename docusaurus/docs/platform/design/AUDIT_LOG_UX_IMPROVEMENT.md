# 감사 로그 페이지 UX 및 성능 개선 설계

**작성일**: 2026-04-06
**상태**: 구현 중

## 1. 현황 분석

### 현재 구현 상태
- 백엔드: 필터링/페이징 API 3개 (목록, 상세, 통계)
- 프론트엔드: `useState` + `useEffect` 기반 단순 테이블 (299줄)
- DB 인덱스: `timestamp`, `action` 단일 인덱스만 존재

### 문제점

| 분류 | 문제 | 영향 |
|------|------|------|
| **성능** | 복합 필터 시 DB 인덱스 미활용 | 대용량 데이터에서 쿼리 성능 저하 |
| **성능** | `query.count()` 전체 스캔 | 매 요청마다 full count 실행 |
| **UX** | 날짜 범위 필터 없음 (백엔드 지원, UI 미노출) | 기간별 조회 불가 |
| **UX** | perPage 고정 50 | 사용자 조절 불가 |
| **UX** | 이메일 필터 디바운스 없음 | 타이핑마다 API 요청 |
| **UX** | 로그 상세 보기 없음 | details, error_message, user_agent 확인 불가 |
| **UX** | 액션명 영문 원문 표시 | 한글화 필요 |
| **UX** | CSV 내보내기 없음 | 감사 기록 외부 보관 불가 |
| **UX** | 필터 상태가 URL에 미반영 | 공유/북마크 불가, 새로고침 시 초기화 |
| **컨벤션** | TanStack Query 미사용 | 프로젝트 표준 위반 (Zustand + TanStack Query) |
| **컨벤션** | `params: any` 타입 사용 | TypeScript any 금지 규칙 위반 |

## 2. 개선 설계

### 2.1 백엔드 — DB 인덱스 최적화

**복합 인덱스 추가** (가장 빈번한 필터 조합):

```python
# audit_log.py 모델에 추가
__table_args__ = (
    Index("ix_audit_logs_status_timestamp", "status", "timestamp"),
    Index("ix_audit_logs_action_timestamp", "action", "timestamp"),
    Index("ix_audit_logs_user_email_timestamp", "user_email", "timestamp"),
    Index("ix_audit_logs_resource_type_timestamp", "resource_type", "timestamp"),
)
```

**이유**: 감사 로그는 항상 `timestamp DESC`로 정렬되므로, 주요 필터 컬럼 + timestamp 복합 인덱스가 covering index 역할.

### 2.2 백엔드 — CSV 내보내기 API

```
GET /api/audit-logs/export/csv?action=...&start_date=...&end_date=...
```

- 기존 필터 파라미터 그대로 사용
- `StreamingResponse`로 메모리 효율적 전송
- 최대 10,000건 제한 (대용량 보호)

### 2.3 프론트엔드 — 전면 개편

#### 필터 섹션 개선
- **날짜 범위**: `DateRangePicker` 컴포넌트 재사용 (오늘/7일/30일/이번달 프리셋)
- **이메일 검색**: 300ms 디바운스 적용
- **액션 필터**: AuditAction enum 전체 한글화 + 카테고리 그룹핑
- **리소스 타입**: Light-Zowe 아키텍처 반영 (bridge, route, channel, config, user)
- **필터 초기화** 버튼 추가

#### 테이블 개선
- **액션명 한글화**: `user.login` → "로그인", `bridge.route.add` → "라우트 추가" 등
- **행 클릭 → 상세 모달**: details JSON, error_message, user_agent 표시
- **perPage 선택**: 20/50/100 옵션
- **페이지 번호 표시**: 1, 2, 3, ..., 끝 형태

#### 추가 기능
- **CSV 내보내기** 버튼 (현재 필터 조건 적용)
- **URL 쿼리 파라미터 동기화**: 필터 상태 → URL, 새로고침/공유 시 복원
- **통계 요약 카드**: 전체/성공/실패 건수 + 활성 필터 표시

## 3. 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/models/audit_log.py` | 복합 인덱스 4개 추가 |
| `backend/app/api/audit_logs.py` | CSV 내보내기 엔드포인트 추가 |
| `frontend/src/lib/api/auditLogs.ts` | CSV 내보내기 함수, 통계 API 함수 추가 |
| `frontend/src/pages/AuditLogs.tsx` | 전면 개편 |

## 4. 비기능 요구사항

- 10만 건 이상 데이터에서도 페이지 전환 < 500ms
- CSV 내보내기 최대 10,000건
- 필터 변경 시 디바운스 300ms (텍스트 입력), 즉시 반영 (셀렉트)
