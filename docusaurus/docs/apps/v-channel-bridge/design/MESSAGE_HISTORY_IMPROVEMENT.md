# 메시지 히스토리 페이지 개선 설계

**작성일**: 2026-04-05  
**상태**: 구현 완료  
**범위**: `frontend/src/pages/Messages.tsx`, `frontend/src/components/messages/MessageCard.tsx`

---

## 1. 개선 배경

기존 메시지 히스토리 페이지는 기본적인 목록 + 필터 구조만 있었음.

### 기존 문제점
- 이모지 기반 플랫폼 아이콘 → 크기/위치 불안정
- 사용자 ID(`U012ABCDE`)만 표시, 실명 미사용
- 절대 시간만 표시 → 최근 메시지 체감 어려움
- 긴 메시지가 UI를 깨뜨림 (줄바꿈 없음 처리 미흡)
- 첨부파일 유무만 표시, 상세 없음
- 발신→수신 흐름 직관성 부족
- 로딩 중 레이아웃 점프 (스피너만 표시)
- 현재 페이지 상태 요약 없음 (성공/실패 비율 불명)

---

## 2. 개선 목표

> "히스토리 정보를 쉽고, 의미 있게 추적, 확인 가능하도록"

1. **맥락 파악** — 각 메시지가 어디서 어디로, 누가 보냈는지 한눈에
2. **상태 추적** — 성공/실패/재시도 현황을 숫자로 즉시 확인
3. **빠른 필터링** — 상태별 탭으로 원클릭 필터
4. **로딩 UX** — 스켈레톤으로 레이아웃 점프 없이

---

## 3. 컴포넌트별 변경 사항

### 3.1 MessageCard.tsx — 개선

#### 플랫폼 아이콘 (SVG 뱃지)
- Slack: 보라색 배경에 `S` 텍스트 뱃지
- Teams: 파란색 배경에 `T` 텍스트 뱃지
- 이모지 대신 브랜드 컬러 CSS 뱃지 사용

#### 사용자 표시 개선
- 우선순위: `source.display_name` → `source.user_name` → `source.user` → "Unknown"
- 아바타 이니셜도 display_name 기준

#### 상대 시간
- 60초 이내: "방금 전"
- 1시간 이내: "N분 전"
- 24시간 이내: "N시간 전"
- 7일 이내: "N일 전"
- 이전: 날짜 포맷
- `title` 속성으로 hover 시 정확한 시간 표시

#### 긴 메시지 접기/펼치기
- 200자 초과 시 접기 상태로 시작
- "더 보기" / "접기" 버튼으로 토글

#### 첨부파일 뱃지
- `has_attachment=true` 시 파일 카운트 뱃지 표시
- `📎 N개` 형식

#### 발신→수신 흐름 시각화
- Footer: `[src icon] [src channel]` → `[dst icon] [dst channel]`
- 화살표로 명확한 방향 표시

#### 텍스트 복사 버튼
- 메시지 텍스트 우상단에 복사 버튼
- 복사 성공 시 "✓" 피드백

---

### 3.2 Messages.tsx — 개선

#### 미니 스탯 바
- `getMessageStats` API 병렬 호출
- 표시: 총 N건 / 성공률 N% / 실패 N건 / 첨부 N건
- 날짜 필터 적용 시 해당 기간 기준

#### 상태 탭 필터
```
[전체] [전송완료] [실패] [재시도중] [대기중]
```
- 탭 클릭 시 status 필터 즉시 적용

#### 스켈레톤 로딩
- 로딩 중 카드 형태 플레이스홀더 3개 표시
- 레이아웃 점프 방지

#### perPage 셀렉터
- 25 / 50 / 100 선택 가능
- 변경 시 첫 페이지로 이동

#### 빈 상태 개선
- 검색 조건이 있을 때: "조건에 맞는 메시지가 없습니다"
- 없을 때: "아직 메시지가 없습니다"

---

## 4. 데이터 흐름

```
Messages.tsx 마운트
├─ searchMessages(params)     → messages[], total
└─ getMessageStats(dateRange) → total_messages, success_rate, by_status, with_attachment

상태 탭 클릭
└─ filters.status 업데이트 → searchMessages 재호출

MessageCard 렌더
├─ source.display_name || user_name || user → 사용자명
├─ protocol → 플랫폼 아이콘
└─ text.length > 200 → 접기 UI
```

---

## 5. 타입 업데이트

`Message` 인터페이스에 누락된 백엔드 필드 추가:
```typescript
source: {
  account: string;
  channel: string;
  user?: string;
  user_name?: string;      // 백엔드: source_user_name
  display_name?: string;   // 백엔드: source_user_display_name
};
attachment_details?: AttachmentDetail[];
message_format?: string;
```

---

## 6. 구현 파일 목록

| 파일 | 변경 |
|------|------|
| `frontend/src/lib/api/messages.ts` | Message 타입 필드 추가 |
| `frontend/src/components/messages/MessageCard.tsx` | 전면 개선 |
| `frontend/src/pages/Messages.tsx` | 스탯바, 탭, 스켈레톤, perPage |
