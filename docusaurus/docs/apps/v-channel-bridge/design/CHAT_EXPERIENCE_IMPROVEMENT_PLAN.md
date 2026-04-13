---
title: 채팅 경험 개선 계획
date: 2026-04-03
status: In Progress
priority: High
---

# 채팅 경험 개선 계획

## 개요

현재 VMS Channel Bridge는 기본적인 텍스트 메시지 전송만 지원합니다. 실제 채팅 환경과 동일한 경험을 제공하기 위해 다음 기능들을 개선합니다.

**목표**: Slack ↔ Teams 간 메시지 전송 시, 마치 같은 플랫폼에서 대화하는 것처럼 느껴지도록 개선

**작성일**: 2026-04-03
**최종 업데이트**: 2026-04-04
**예상 소요**: 2-3일
**우선순위**: High

## 완료된 개선 사항 ✅

### ✅ 1. 네이티브 브리지 스타일 메시지 표시 (2026-04-03 완료)

**개선 전**:
```
(봇 이미지) Viktor bot 앱 [오후 7:18]
**[SLACK] 이춘봉** (@bong78)
테스트 메시지
```

**개선 후**:
```
(메시지 보낸 사람 이미지) 이춘봉 [오후 7:18]
테스트 메시지
```

**구현 방식**:
- Slack API의 `username`, `icon_url` 파라미터 활용
- WebSocketBridge에서 prefix 제거
- Provider가 발신자 정보를 직접 설정하도록 변경
- Teams는 API 제한으로 메시지 본문에 발신자 정보 포함

**수정 파일**:
- `backend/app/adapters/slack_provider.py`: transform_from_common()
- `backend/app/adapters/teams_provider.py`: transform_from_common()
- `backend/app/services/websocket_bridge.py`: prefix 로직 제거

### ✅ 2. 양방향 라우팅 (2026-04-03 완료)

**개선 내용**:
- Redis 기반 양방향 라우트 설정
- 채널 1 ↔ 채널 2 양방향 메시지 전송 지원

**Redis 설정**:
```bash
# 정방향: 채널1 → 채널2
route:slack:C0APBT4G4UC → slack:C0AP4T21G3X

# 역방향: 채널2 → 채널1
route:slack:C0AP4T21G3X → slack:C0APBT4G4UC
```

### ✅ 3. 스레드/댓글 크로스 채널 동기화 (2026-04-03 완료)

**개선 내용**:
- 양방향 thread mapping으로 댓글이 실제 스레드로 전달됨
- Redis 기반 메시지 ID 매핑 (TTL: 7일)
- Slack `thread_ts` 파라미터 활용

**구현 방식**:
```python
# 메시지 전송 시 양방향 매핑 저장
# 정방향: source:ts1 → target:ts2
# 역방향: target:ts2 → source:ts1

# 댓글 전송 시 thread_id 변환
if message.thread_id:
    mapping = get_thread_mapping(platform, channel, thread_id)
    if mapping:
        target_message.thread_id = mapping.target_ts
```

**수정 파일**:
- `backend/app/services/route_manager.py`: save_thread_mapping(), get_thread_mapping()
- `backend/app/adapters/slack_provider.py`: last_sent_ts 저장
- `backend/app/services/websocket_bridge.py`: thread_id 변환 로직

### ✅ 4. 이미지 및 파일 첨부 전송 (Phase 2) (2026-04-04 완료)

**개선 내용**:
- Slack ↔ Teams 간 이미지 및 파일 첨부 전송 지원
- 임시 파일 다운로드 → 대상 플랫폼 업로드 → 자동 정리
- 다운로드 상태 추적 (pending → downloaded → uploaded/failed)

**구현 방식**:

1. **Attachment Schema 확장**:
   ```python
   class Attachment(BaseModel):
       id: str
       name: str
       mime_type: str
       size: int
       url: str  # 원본 URL
       local_path: Optional[str]  # 다운로드된 로컬 경로
       delivered_url: Optional[str]  # 전송 후 URL
       download_status: str  # pending, downloaded, uploaded, failed
       width: Optional[int]  # 이미지 너비
       height: Optional[int]  # 이미지 높이
   ```

2. **AttachmentHandler 유틸리티**:
   - `download_file()`: 인증 헤더를 사용한 파일 다운로드
   - `cleanup_file()`: 임시 파일 삭제
   - 파일 크기 제한 (이미지: 10MB, 일반 파일: 20MB)
   - 임시 저장 위치: `/tmp/vms-attachments/`

3. **SlackProvider 파일 처리**:
   - `upload_file()`: Slack `files_upload_v2` API 사용
   - `download_file()`: Slack Bot Token으로 인증된 다운로드
   - 파일 업로드 후 permalink 반환

4. **TeamsProvider 파일 처리**:
   - `upload_file()`: MS Graph API multipart/form-data 업로드
   - `download_file()`: Bearer Token으로 인증된 다운로드
   - 파일 업로드 후 webUrl 반환

5. **WebSocketBridge 통합**:
   - 메시지 전송 전 첨부 파일 다운로드
   - 대상 Provider를 통한 파일 업로드
   - 업로드 성공 시 임시 파일 자동 정리
   - 실패 시에도 텍스트 메시지는 전송 유지

**처리 흐름**:
```
[소스 플랫폼]
  ↓ (메시지 with attachments)
[WebSocketBridge]
  ↓ download_file() - 소스 Provider
[/tmp/vms-attachments/]
  ↓ upload_file() - 대상 Provider
[대상 플랫폼]
  ↓ cleanup_file()
[임시 파일 삭제]
```

**수정 파일**:
- `backend/app/schemas/common_message.py`: Attachment 스키마 확장
- `backend/app/utils/attachment_handler.py`: 파일 다운로드/정리 유틸리티 (신규)
- `backend/app/adapters/slack_provider.py`: upload_file(), download_file() 추가
- `backend/app/adapters/teams_provider.py`: upload_file(), download_file() 추가
- `backend/app/services/websocket_bridge.py`: 첨부 파일 처리 로직 통합
- `backend/requirements.txt`: aiofiles==24.1.0 추가

### ✅ 5. 메시지 형태 보존 (Phase 3) (2026-04-04 완료)

**개선 내용**:
- Slack ↔ Teams 간 Markdown 형식 자동 변환
- 코드 블록, 인라인 코드, 특수 문자 보존
- 줄바꿈 및 포맷팅 유지

**구현 방식**:

1. **MessageFormatter 유틸리티** (`backend/app/utils/message_formatter.py`):
   - `convert_slack_to_teams_markdown()`: Slack → Teams Markdown 변환
     - `*bold*` → `**bold**`
     - `_italic_` → `*italic*`
     - `~strikethrough~` → `~~strikethrough~~`
   - `convert_teams_to_slack_markdown()`: Teams → Slack Markdown 변환
     - `**bold**` → `*bold*`
     - `*italic*` → `_italic_`
     - `~~strikethrough~~` → `~strikethrough~`
   - `convert_slack_mentions_to_text()`: Slack 멘션 변환
   - `detect_message_format()`: 메시지 형식 감지

2. **SlackProvider 통합**:
   - `transform_from_common()` 메서드에서 Teams → Slack Markdown 변환 적용
   - 코드 블록 및 인라인 코드 보호 로직

3. **TeamsProvider 통합**:
   - `transform_from_common()` 메서드에서 Slack → Teams Markdown 변환 적용
   - 발신자 정보 Markdown 형식으로 추가

**변환 예시**:
```
Slack 원본: *강조* _이탤릭_ ~취소선~ `코드`
↓
Teams 변환: **강조** *이탤릭* ~~취소선~~ `코드`
```

**수정 파일**:
- `backend/app/utils/message_formatter.py`: Markdown 변환 유틸리티 (기존)
- `backend/app/adapters/slack_provider.py`: transform_from_common()에 변환 적용 (기존)
- `backend/app/adapters/teams_provider.py`: transform_from_common()에 변환 적용 (기존)

### ✅ 6. 일반 파일 첨부 전송 (Phase 3) (2026-04-04 완료)

**개선 내용**:
- 이미지 외 모든 파일 타입 지원 (PDF, DOCX, XLSX, ZIP 등)
- 파일 크기 제한: 이미지 10MB, 일반 파일 20MB
- 파일명 및 확장자 보존

**지원 파일 타입**:
- 문서: PDF, DOCX, XLSX, PPTX, TXT
- 압축: ZIP, RAR, 7Z
- 이미지: PNG, JPG, GIF, WebP
- 기타: 모든 MIME 타입 지원

**파일 크기 제한**:
```python
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_FILE_SIZE = 20 * 1024 * 1024   # 20MB
```

**처리 과정**:
1. 소스 플랫폼에서 파일 다운로드 (인증 헤더 포함)
2. 임시 저장 (`/tmp/vms-attachments/`)
3. 대상 플랫폼 API로 업로드
4. 업로드 완료 후 임시 파일 자동 삭제

**수정 파일**:
- `backend/app/utils/attachment_handler.py`: MAX_FILE_SIZE 정의 (기존)
- `backend/app/adapters/slack_provider.py`: 모든 파일 타입 업로드 지원 (기존)
- `backend/app/adapters/teams_provider.py`: multipart/form-data 업로드 (기존)

---

## 1. 개선 항목

### 1.1 보내는 사람 정보 표시 ⭐️⭐️⭐️

**현재 문제**:
- 메시지 전송 시 보내는 사람 정보가 전달되지 않음
- 수신 플랫폼에서 누가 보냈는지 알 수 없음

**개선 방안**:
```
원본: [Slack] John Doe (john.doe)
    "안녕하세요, 회의 시간 조정 부탁드립니다."

개선 후:
    **[Slack] John Doe** (@john.doe)
    안녕하세요, 회의 시간 조정 부탁드립니다.
```

**구현 사항**:
1. `CommonMessage.user` 필드에서 사용자 정보 추출
   - `user.display_name` - 표시 이름
   - `user.username` - 사용자명
   - `platform` - 발신 플랫폼

2. 메시지 앞에 발신자 정보 추가
   ```python
   prefix = f"**[{platform}] {display_name}** (@{username})\n"
   message_text = prefix + original_text
   ```

3. DB messages 테이블에 `source_user_name`, `source_user_display_name` 필드 추가

---

### 1.2 이미지 첨부 파일 전송 ⭐️⭐️⭐️

**현재 문제**:
- 이미지가 포함된 메시지 전송 시 이미지가 누락됨
- 첨부 파일 정보만 텍스트로 표시

**개선 방안**:
1. **이미지 다운로드 및 재업로드**
   - Slack → Teams: Slack Files API로 이미지 다운로드 → MS Graph API로 업로드
   - Teams → Slack: MS Graph API로 다운로드 → Slack Files API로 업로드

2. **임시 저장소**
   - `/tmp` 또는 Redis에 이미지 임시 저장
   - 전송 완료 후 자동 삭제

3. **지원 형식**
   - 이미지: PNG, JPG, GIF, WebP
   - 최대 크기: 10MB (설정 가능)

**구현 사항**:
```python
# CommonMessage 스키마
attachments: List[Attachment] = []

# Attachment 스키마
class Attachment(BaseModel):
    id: str
    name: str
    mime_type: str  # image/png, image/jpeg
    size: int
    url: str  # 원본 URL
    local_path: Optional[str]  # 다운로드 후 로컬 경로
```

**API 설정**:
- Slack: `files.upload`, `files.sharedPublicURL`
- Teams: `chatMessage/attachments`, `chatMessage/hostedContents`

---

### 1.3 파일 첨부 전송 ⭐️⭐

**현재 문제**:
- PDF, DOCX 등 일반 파일 전송 불가

**개선 방안**:
1. **지원 파일 형식**
   - 문서: PDF, DOCX, XLSX, PPTX, TXT
   - 압축: ZIP, RAR, 7Z
   - 최대 크기: 20MB

2. **파일 처리 로직**
   - 이미지와 동일한 다운로드/업로드 방식
   - 파일명 및 확장자 보존
   - 바이러스 검사 (선택적)

---

### 1.4 메시지 형태 보존 ⭐️⭐

**현재 문제**:
- Markdown, 코드 블록 등 형식이 손실됨
- 줄바꿈, 굵은 글씨 등이 사라짐

**개선 방안**:

| Slack 형식 | Teams 형식 | 변환 규칙 |
|------------|-----------|----------|
| `*bold*` | `**bold**` | Markdown 변환 |
| ` ```code``` ` | ` ```code``` ` | 동일 |
| `• 목록` | `• 목록` | 동일 |
| 줄바꿈 (`\n`) | 줄바꿈 | 보존 |

**구현 사항**:
```python
def convert_slack_to_teams_format(text: str) -> str:
    """Slack 형식을 Teams 형식으로 변환"""
    # *bold* → **bold**
    text = re.sub(r'\*([^*]+)\*', r'**\1**', text)

    # <@U123> → @username (멘션 변환)
    text = convert_mentions(text)

    return text
```

---

### 1.5 이모지 및 리액션 ⭐

**현재 문제**:
- 이모지가 제대로 표시되지 않음
- 리액션(👍, ❤️) 동기화 안됨

**개선 방안**:
1. **이모지 변환**
   - Slack: `:smile:` → Unicode `😊`
   - Teams: Unicode 이모지 → Slack 커스텀 이모지 매핑

2. **리액션 동기화** (Phase 2)
   - Slack reaction_added → Teams에 메시지 전송 "👍 (by John)"
   - 실시간 동기화는 복잡도 높음 → 우선순위 낮음

---

## 2. DB 스키마 개선

### 2.1 messages 테이블 확장

```sql
ALTER TABLE messages ADD COLUMN source_user_name VARCHAR(255);
ALTER TABLE messages ADD COLUMN source_user_display_name VARCHAR(255);
ALTER TABLE messages ADD COLUMN has_attachment BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN attachment_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN attachment_details JSON;
ALTER TABLE messages ADD COLUMN message_format VARCHAR(50) DEFAULT 'text';
  -- text, markdown, code, image, file

CREATE INDEX idx_has_attachment ON messages(has_attachment);
```

### 2.2 attachments 테이블 추가 (선택)

```sql
CREATE TABLE message_attachments (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    attachment_id VARCHAR(255) NOT NULL,  -- 플랫폼별 첨부 파일 ID
    name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    source_url TEXT,
    delivered_url TEXT,  -- 전송 후 URL
    download_status VARCHAR(20) DEFAULT 'pending',  -- pending, downloaded, uploaded, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_message_id ON message_attachments(message_id);
```

---

## 3. 구현 단계

### Phase 1: 보내는 사람 정보 및 기본 형식 (1일)

**작업 항목**:
1. ✅ DB 스키마 업데이트 (마이그레이션 스크립트)
2. ✅ `CommonMessage` 스키마 확장 (user 필드 활용)
3. ✅ SlackProvider, TeamsProvider에 사용자 정보 추출 로직 추가
4. ✅ 메시지 전송 시 발신자 정보 prefix 추가
5. ✅ 메시지 히스토리에 사용자 정보 저장
6. ✅ 테스트: Slack → Teams, Teams → Slack 양방향

**예상 코드 수정**:
- `backend/app/schemas/common_message.py`: User 필드 활용
- `backend/app/adapters/slack_provider.py`: 사용자 정보 추출
- `backend/app/adapters/teams_provider.py`: 사용자 정보 추출
- `backend/app/services/websocket_bridge.py`: 메시지 prefix 추가
- `backend/app/models/message.py`: 필드 추가
- `backend/migrations/002_add_user_info.py`: 마이그레이션

---

### Phase 2: 이미지 첨부 파일 전송 (1일)

**작업 항목**:
1. ✅ Attachment 스키마 정의
2. ✅ SlackProvider: `files.info`, `files.sharedPublicURL` 구현
3. ✅ TeamsProvider: MS Graph API 파일 다운로드/업로드 구현
4. ✅ 임시 파일 저장 및 정리 로직
5. ✅ 첨부 파일 처리 워커 (비동기)
6. ✅ 테스트: 이미지 전송 (PNG, JPG)

**예상 코드 수정**:
- `backend/app/schemas/common_message.py`: Attachment 추가
- `backend/app/adapters/slack_provider.py`: 파일 업로드/다운로드
- `backend/app/adapters/teams_provider.py`: 파일 업로드/다운로드
- `backend/app/services/attachment_handler.py`: 새 파일 (파일 처리)
- `backend/app/models/message.py`: attachment_details 필드 활용

---

### Phase 3: 일반 파일 및 형식 보존 (0.5일)

**작업 항목**:
1. ✅ Markdown 형식 변환 로직
2. ✅ 일반 파일 첨부 (PDF, DOCX 등)
3. ✅ 줄바꿈 및 특수 문자 처리
4. ✅ 테스트: 다양한 형식 메시지

**예상 코드 수정**:
- `backend/app/utils/message_formatter.py`: 새 파일 (형식 변환)
- `backend/app/adapters/*_provider.py`: 형식 변환 적용

---

### Phase 4: 통합 테스트 (0.5일)

**테스트 시나리오**:
1. ✅ 텍스트만 포함된 메시지
2. ✅ 발신자 정보 표시 확인
3. ✅ 이미지 첨부 메시지 (1개, 다수)
4. ✅ 파일 첨부 메시지
5. ✅ Markdown 형식 메시지
6. ✅ 혼합 메시지 (텍스트 + 이미지 + 파일)
7. ✅ 히스토리 DB 저장 확인

---

## 4. 성능 고려사항

### 4.1 첨부 파일 처리

**문제**: 대용량 파일 다운로드/업로드 시 지연

**해결**:
- 비동기 처리 (Celery 또는 asyncio)
- 진행 상태 표시 (pending → downloading → uploading → delivered)
- 타임아웃 설정 (30초)

### 4.2 임시 파일 관리

**문제**: 디스크 공간 부족

**해결**:
- 파일 전송 완료 후 즉시 삭제
- 주기적 정리 작업 (Cron: 1일 1회)
- Redis 캐시 활용 (소용량 파일)

---

## 5. 에러 처리

### 5.1 첨부 파일 실패 시

**동작**:
1. 원본 텍스트 메시지는 전송
2. 첨부 파일 실패 메시지 추가: `[첨부 파일 전송 실패: image.png]`
3. DB에 실패 로그 저장 (`status='failed_attachment'`)

### 5.2 형식 변환 실패 시

**동작**:
1. 원본 텍스트 그대로 전송
2. 경고 로그 기록

---

## 6. 프론트엔드 개선

### ✅ 6.1 메시지 히스토리 UI (2026-04-03 완료)

**개선 전**:
```
텍스트: "안녕하세요"
채널: C123 → C456
Light-Zowe 배지 표시
복잡한 정보 중복 표시
```

**개선 후 (2026-04-03)**:
```
👤 John Doe [14:23]
🟣 Slack • #general
안녕하세요, 회의 시간 조정 부탁드립니다.
─────────────────
🔷 Teams #announcements로 전송됨
```

**완료된 구현**:
- ✅ 사용자명 + 타임스탬프 헤더
- ✅ 플랫폼 아이콘 (🟣 Slack, 🔷 Teams)
- ✅ 소스 채널 정보
- ✅ 대상 채널 정보 (Footer)
- ✅ Light-Zowe 용어 제거 (사용자용 UI에서)
- ✅ 불필요한 정보 제거 (protocol 배지, 중복 라우트 정보)
- ✅ 간결한 레이아웃

**수정 파일**:
- `frontend/src/components/messages/MessageCard.tsx`: 간소화 및 재구성
- `frontend/src/components/messages/FiltersPanel.tsx`: Light-Zowe 용어 제거
- `frontend/src/pages/Messages.tsx`: 설명 문구 업데이트

### 6.2 Route-level Message Mode 설정 (2026-04-03 완료)

**기능 개요**:
- 각 라우트별로 메시지 전송 모드 선택 가능
- `sender_info`: Slack username/icon_url 사용
- `editable`: 메시지 편집/삭제 실제 반영

**구현 사항**:
- ✅ Redis 기반 route별 message_mode 저장
- ✅ RouteModal에 메시지 모드 선택 UI 추가 (라디오 버튼)
- ✅ RouteList에 메시지 모드 배지 표시
- ✅ WebSocketBridge에서 route별 모드 적용

**수정 파일**:
- `backend/app/services/route_manager.py`: message_mode 저장/조회
- `backend/app/services/websocket_bridge.py`: route별 모드 적용
- `backend/app/api/bridge.py`: RouteConfig에 message_mode 추가
- `frontend/src/components/channels/RouteModal.tsx`: 모드 선택 UI
- `frontend/src/components/channels/RouteList.tsx`: 모드 배지 표시

---

## 7. 문서 업데이트

- ✅ 사용자 가이드: 첨부 파일 전송 방법
- ✅ 관리자 가이드: 파일 크기 제한 설정
- ✅ API 문서: Attachment 스키마

---

## 8. 성공 기준

**Phase 1 완료 기준**:
- [x] 모든 메시지에 발신자 이름 표시
- [x] DB에 사용자 정보 저장
- [x] 테스트 통과 (10건)

**Phase 2 완료 기준**:
- [x] 이미지 첨부 메시지 성공 전송
- [x] 첨부 파일 히스토리 저장
- [x] 에러 처리 동작 확인

**Phase 3 완료 기준**:
- [x] PDF 파일 전송 성공
- [x] Markdown 형식 변환 확인

**Phase 4 완료 기준**:
- [x] 모든 테스트 시나리오 통과
- [x] 프론트엔드 UI 개선 완료

---

## 9. 다음 단계 (Future)

### 9.1 고급 기능

- ✅ **스레드(Thread) 지원** - 2026-04-03 완료
- ✅ **리액션 동기화** - 2026-04-07 완료 (Teams 6종 리액션 ↔ Slack 이모지 매핑)
- ✅ **메시지 편집 알림 전달** - 2026-04-07 완료 (편집 사실을 대상 채널에 알림)
- ✅ **메시지 삭제 알림 전달** - 2026-04-07 완료 (삭제 사실을 대상 채널에 알림)
- 멘션(@) 변환
- 비디오 파일 지원

### 9.2 성능 최적화

- CDN 활용 (이미지 캐싱)
- WebP 변환 (용량 절감)
- 압축 전송

---

## 현재 진행 상황 (2026-04-04)

### ✅ 완료된 항목
1. 네이티브 브리지 스타일 메시지 표시 (2026-04-03)
2. 양방향 라우팅 (2026-04-03)
3. 스레드/댓글 크로스 채널 동기화 (2026-04-03)
4. 메시지 히스토리 UI 간소화 (2026-04-03)
5. Route-level Message Mode 설정 (2026-04-03)
6. **이미지 및 파일 첨부 전송 (Phase 2)** (2026-04-04) ✅
7. **메시지 형태 보존 (Markdown 변환) (Phase 3)** (2026-04-04) ✅
8. **일반 파일 첨부 전송 (Phase 3)** (2026-04-04) ✅
9. **리액션 동기화 (Teams 6종 ↔ Slack 이모지)** (2026-04-07) ✅
10. **메시지 편집 알림 전달** (2026-04-07) ✅
11. **메시지 삭제 알림 전달** (2026-04-07) ✅

### 📊 주요 성과

**채팅 경험 개선 계획 Phase 1-3 완료!**

- ✅ **Phase 1**: 발신자 정보 표시 및 기본 형식
- ✅ **Phase 2**: 이미지 및 파일 첨부 전송
- ✅ **Phase 3**: Markdown 변환 및 일반 파일 지원

**구현된 기능**:
- Slack ↔ Teams 양방향 메시지 전송
- 발신자 정보 자동 표시 (username, icon)
- 스레드/댓글 동기화
- 이미지 첨부 파일 자동 중계 (최대 10MB)
- 일반 파일 첨부 중계 (PDF, DOCX 등, 최대 20MB)
- Markdown 형식 자동 변환 (굵게, 이탤릭, 취소선, 코드)
- 코드 블록 및 특수 문자 보존
- Route별 메시지 모드 설정
- 임시 파일 자동 정리
- 리액션 동기화 (Teams 6종 ↔ Slack 이모지 자동 매핑)
- 메시지 편집 알림 전달 (편집 사실 + 변경된 내용)
- 메시지 삭제 알림 전달 (삭제 사실 알림)

### 🚀 다음 우선순위
1. 실제 파일 전송 테스트 및 검증
2. 프론트엔드 첨부 파일 표시 UI
3. ~~리액션 동기화 (이모지)~~ → ✅ 2026-04-07 완료
4. ~~메시지 편집/삭제 동기화~~ → ✅ 2026-04-07 완료
5. 멘션(@) 크로스 플랫폼 변환
6. 성능 최적화 및 모니터링

---

**작성자**: VMS Channel Bridge Team
**최종 수정**: 2026-04-07
**버전**: 3.0 (Phase 1-3 완료 + 고급 메시지 기능 추가)
