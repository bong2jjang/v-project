# 통계 대시보드 개선 설계

**작성일**: 2026-04-05  
**상태**: 구현 완료  
**담당**: vmsCloudInfra

---

## 1. 개선 배경

기존 통계 페이지(`/statistics`)는 메시지 전송 통계를 표시하지만, 현재 서비스의 실제 운영 관점에서 필요한 정보가 부족했다.

### 기존 한계점

| 항목 | 기존 | 문제점 |
|------|------|--------|
| 요약 카드 | 총 메시지, 활성 채널, 활성 Gateway | 전송 성공/실패 여부 없음 |
| 날짜 필터 | 직접 날짜 입력만 | UX 불편, 빠른 범위 선택 없음 |
| 차트 | 추세, 채널 분포, 시간대 분포 | 플랫폼 방향, 전송 상태 시각화 없음 |
| 전송 상태 | 미표시 | 실패율, 재시도 현황 파악 불가 |
| 플랫폼 정보 | 미표시 | Slack↔Teams 방향별 트래픽 불명 |
| 첨부파일 | 미표시 | 파일 전송 현황 파악 불가 |

---

## 2. 개선 목표

1. **운영 가시성 확보**: 전송 성공률, 실패 현황을 첫 화면에서 즉시 확인
2. **플랫폼 트래픽 분석**: Slack→Teams, Teams→Slack 방향별 메시지량 파악
3. **UX 개선**: 날짜 범위 빠른 선택(프리셋) 제공
4. **차트 다양화**: 전송 상태 분포, 플랫폼 방향 등 새로운 인사이트 시각화

---

## 3. 데이터 모델 현황

### `Message` 테이블 주요 컬럼

```
status          : pending | sent | failed | retrying
source_account  : slack | msteams  (발신 플랫폼)
destination_account: slack | msteams  (수신 플랫폼)
has_attachment  : boolean
attachment_count: int
retry_count     : int
delivered_at    : datetime
gateway         : string (Route 이름)
```

### 기존 `get_stats()` 응답

```json
{
  "total_messages": 1234,
  "by_gateway": { "route-name": 100 },
  "by_channel": { "#general": 50 },
  "by_hour": { "09": 30, "10": 45 },
  "by_day": { "2026-04-01": 100 }
}
```

---

## 4. 백엔드 변경 사항

### 4.1 `message_service.py` — `get_stats()` 확장

기존 5개 필드에 4개 필드 추가:

```python
# 전송 상태별 집계
by_status: { "sent": N, "failed": N, "pending": N, "retrying": N }

# 발신 플랫폼별 집계
by_platform: { "slack": N, "msteams": N }

# 방향별 집계 (발신→수신)
by_direction: { "slack→msteams": N, "msteams→slack": N }

# 첨부파일 포함 메시지 수
with_attachment: int

# 전송 성공률 (sent / (sent + failed) * 100)
success_rate: float  # 0.0 ~ 100.0
```

### 4.2 캐시 TTL

기존 60초 유지. 새 필드도 동일 캐시 키에 포함.

---

## 5. 프론트엔드 변경 사항

### 5.1 날짜 프리셋 (DateRangePresets)

기존 직접 입력 방식에 빠른 선택 버튼 추가:

| 버튼 | 범위 |
|------|------|
| 오늘 | today 00:00 ~ now |
| 최근 7일 | 7일 전 00:00 ~ now |
| 최근 30일 | 30일 전 00:00 ~ now |
| 전체 | 필터 없음 (null) |

### 5.2 요약 카드 재설계

기존 3개 → 4개 (2×2 그리드):

| 카드 | 아이콘 | 설명 |
|------|--------|------|
| 총 메시지 | MessageSquare | 기간 내 전체 메시지 수 |
| **전송 성공률** | CheckCircle | sent/(sent+failed)×100%, 색상 경고 (90% 이하 amber, 80% 이하 red) |
| **실패 메시지** | XCircle | failed + retrying 수, 0이면 green |
| **첨부파일 포함** | Paperclip | has_attachment=true 수 및 비율 |

### 5.3 신규 차트 컴포넌트

#### `DeliveryStatusChart.tsx`

- **차트 타입**: Pie Chart (Recharts)
- **데이터**: `by_status` (sent/failed/pending/retrying)
- **색상**:
  - sent: `#10b981` (green)
  - failed: `#ef4444` (red)
  - retrying: `#f59e0b` (amber)
  - pending: `#6b7280` (gray)
- **레이아웃**: 우측에 범례 + 수치 테이블

#### `PlatformDirectionChart.tsx`

- **차트 타입**: Grouped Bar Chart
- **데이터**: `by_direction` (slack→msteams, msteams→slack)
- **색상**:
  - Slack: `#4A154B` (Slack purple)
  - Teams: `#5059C9` (Teams blue)
- **표시**: 방향별 메시지량 + 비율

### 5.4 레이아웃 구조 변경

```
┌─────────────────────────────────────────────┐
│ ContentHeader (날짜 프리셋 + 새로고침)          │
├─────────────────────────────────────────────┤
│ [날짜 직접 입력 필터]                           │
├──────────┬──────────┬──────────┬────────────┤
│ 총 메시지  │ 성공률   │ 실패     │ 첨부파일    │
├──────────┴──────────┴──────────┴────────────┤
│ [메시지 추세 차트 - full width]                 │
├───────────────────┬─────────────────────────┤
│ 전송 상태 분포     │ 플랫폼/방향 분포           │
│ (Pie Chart)       │ (Bar Chart)              │
├───────────────────┴─────────────────────────┤
│ [시간대별 분포 - full width]                   │
├───────────────────┬─────────────────────────┤
│ 채널별 분포        │ Route별 트래픽 (Top 5)   │
│ (Bar Chart)       │ (Horizontal Bar)         │
└───────────────────┴─────────────────────────┘
```

---

## 6. 구현 파일 목록

### 신규 생성

| 파일 | 역할 |
|------|------|
| `frontend/src/components/statistics/DeliveryStatusChart.tsx` | 전송 상태 Pie 차트 |
| `frontend/src/components/statistics/PlatformDirectionChart.tsx` | 플랫폼 방향 Bar 차트 |

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/services/message_service.py` | `get_stats()`에 by_status, by_platform, by_direction, with_attachment, success_rate 추가 |
| `frontend/src/lib/api/messages.ts` | `MessageStatsResponse` 타입에 새 필드 추가 |
| `frontend/src/components/statistics/index.ts` | 신규 컴포넌트 export 추가 |
| `frontend/src/pages/Statistics.tsx` | 레이아웃 전면 개편, 날짜 프리셋, 새 카드/차트 |

---

## 7. 성공 기준

- 통계 페이지 로드 시 전송 성공률이 첫 화면에 표시됨
- 날짜 프리셋(오늘/7일/30일/전체) 클릭 한 번으로 필터 적용
- Slack→Teams / Teams→Slack 방향별 트래픽이 차트로 확인 가능
- 실패/재시도 메시지가 0이면 green, 있으면 명확한 경고 색상 표시
