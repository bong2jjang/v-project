# 크로스 플랫폼 멘션 설계

> **상태**: 설계 검토 중  
> **작성일**: 2026-04-16  
> **관련 코드**: `adapters/slack_provider.py`, `adapters/teams_provider.py`, `utils/message_formatter.py`, `schemas/common_message.py`

---

## 1. 현재 상태 분석

### 1.1 멘션이 처리되는 방식

| 구간 | 현재 동작 | 문제 |
|------|-----------|------|
| Slack → CommonMessage | `<@U123>` 형태로 `text`에 그대로 포함 | 파싱만 되고 변환 안 됨 |
| CommonMessage → Teams | `convert_slack_to_teams_markdown()` 후 HTML 변환 | `<@U123>`가 의미 없는 텍스트로 노출 |
| Teams → CommonMessage | `activity.text`에 `<at>이름</at>` HTML 포함 | 파싱 없이 raw text 전달 |
| CommonMessage → Slack | `convert_teams_to_slack_markdown()` | `<at>` 태그가 깨진 텍스트로 노출 |
| 삭제 알림 정리 | `_clean_slack_mrkdwn()`에서 `<@U123>` 정규식 제거 | 멘션 정보 완전 손실 |

### 1.2 기존 인프라

- **Slack `_user_name_cache`**: `Dict[str, str]` — `user_id → display_name` (Provider 인스턴스 로컬)
- **Teams `_user_display_name_cache`**: `dict[str, str]` — `user_id → displayName` (모듈 글로벌)
- **`convert_slack_mentions_to_text()`**: `message_formatter.py`에 존재하지만 미사용
- **`CommonMessage.User`**: `id`, `username`, `display_name`, `platform` — 멘션 엔티티 필드 없음

---

## 2. 핵심 과제

### 2.1 사용자 ID 매핑 테이블

**문제**: Slack의 `U0ABC123`과 Teams의 `29:1a2b3c...`는 완전히 다른 ID 체계. 같은 사람인지 판단할 근거가 필요하다.

#### 매핑 키 후보 비교

| 매핑 키 | Slack API | Teams Graph API | 정확도 | 한계 |
|---------|-----------|-----------------|--------|------|
| **이메일** | `users.list` → `profile.email` | `/teams/{id}/members` → `email` | 높음 | 외부 게스트는 이메일 다를 수 있음, Slack 무료 플랜은 email 미제공 |
| **표시 이름** | `real_name` | `displayName` | 낮음 | 동명이인, 표기 불일치 (홍길동 vs Gil-dong Hong) |
| **수동 매핑** | Admin이 직접 연결 | — | 100% | 운영 부담, 인원 변동 시 관리 필요 |

#### 결론: 이메일 기반 자동 매핑 + 수동 보정

이메일이 가장 현실적인 자동 매핑 키. 단, 매핑 실패 케이스를 위해 Admin이 수동으로 매핑을 추가/수정할 수 있는 UI도 함께 제공한다.

### 2.2 매핑 테이블 구성 원리

#### 질문: "상대 플랫폼 인원을 미리 가져와서 구성하는 것인가?"

**그렇다. 양쪽 플랫폼의 사용자 목록을 주기적으로 동기화하여 매핑 테이블을 빌드한다.**

```
┌──────────────┐                              ┌──────────────┐
│  Slack API   │  users.list (profile.email)   │  Teams API   │
│  U0ABC123    │──────────────┐  ┌─────────────│  29:1a2b...  │
│  hong@co.kr  │              ▼  ▼             │  hong@co.kr  │
└──────────────┘     ┌──────────────────┐      └──────────────┘
                     │  user_mapping    │
                     │                  │
                     │  email (PK)      │
                     │  slack_user_id   │
                     │  slack_name      │
                     │  teams_user_id   │
                     │  teams_name      │
                     │  is_manual       │
                     │  synced_at       │
                     └──────────────────┘
```

#### 동기화 흐름

1. **초기 구성**: Provider가 connect될 때 양쪽 `get_users()` 호출
2. **매칭**: 이메일 기준으로 양쪽 사용자 JOIN → 매핑 레코드 생성
3. **주기적 갱신**: 일정 주기(예: 6시간)로 재동기화 — 신규 입사자/퇴사자 반영
4. **수동 보정**: Admin UI에서 매핑 실패 건을 수동으로 연결하거나 해제

#### 동기화 시점

| 트리거 | 설명 |
|--------|------|
| Provider 연결 시 | `connect()` 후 첫 동기화 실행 |
| 주기적 (6시간) | Background task로 자동 갱신 |
| Admin 수동 트리거 | UI에서 "지금 동기화" 버튼 |
| 사용자 매핑 조회 miss | 캐시에 없으면 on-demand로 단건 조회 시도 |

### 2.3 `@` 멘션 작성 시 상대 플랫폼 사용자를 어떻게 보여줄 것인가

**핵심 인사이트: 브리지가 UI를 제공하지 않는다.**

사용자는 Slack 또는 Teams의 **네이티브 클라이언트**에서 메시지를 작성한다. 브리지는 메시지가 전송된 후 수신하여 변환하는 서버사이드 컴포넌트이므로, **`@` 입력 시 상대 플랫폼 사용자 목록을 팝업으로 보여주는 것은 불가능**하다.

#### 가능한 접근 방식

| 방식 | 설명 | 실현성 |
|------|------|--------|
| **A. 네이티브 멘션 변환** | 자기 플랫폼에서 `@홍길동` 멘션 → 브리지가 매핑 테이블로 상대 플랫폼 멘션 생성 | **높음** (권장) |
| **B. 텍스트 멘션 매칭** | `@홍길동`이라는 텍스트가 포함되면 매핑 테이블에서 display_name으로 검색 | 중간 (모호성 있음) |
| **C. 커맨드 멘션** | `/mention @slack:홍길동` 같은 브릿지 전용 커맨드 | 낮음 (UX 나쁨) |

#### 권장안: A. 네이티브 멘션 변환

사용자는 **자기 플랫폼의 멘션만 사용**한다. 상대 플랫폼 사용자를 직접 멘션할 수 없다.

```
Slack에서 @홍길동 멘션 → <@U0ABC123>
  ↓ transform_to_common()에서 MentionEntity 추출
  ↓ 매핑 테이블: U0ABC123 → Teams 29:1a2b...
  ↓ transform_from_common()에서 Teams <at> 태그 생성
Teams에서 @홍길동 알림 수신
```

**제약**: 홍길동이 Slack에만 있고 Teams에 없으면 → 멘션을 `@홍길동` 평문으로 표시 (알림 없음).

---

## 3. 상세 설계

### 3.1 CommonMessage 스키마 확장

```python
class MentionEntity(BaseModel):
    """멘션 엔티티"""
    user_id: str          # 원본 플랫폼 user ID
    display_name: str     # 표시 이름
    platform: Platform    # 원본 플랫폼
    offset: int           # 텍스트 내 시작 위치
    length: int           # 멘션 텍스트 길이

class CommonMessage(BaseModel):
    # ... 기존 필드 ...
    mentions: List[MentionEntity] = Field(
        default_factory=list,
        description="메시지 내 멘션 엔티티 목록"
    )
```

### 3.2 사용자 매핑 모델

```python
class UserMapping(Base):
    """크로스 플랫폼 사용자 매핑"""
    __tablename__ = "bridge_user_mappings"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=True)

    slack_user_id = Column(String(50), nullable=True, index=True)
    slack_display_name = Column(String(255))

    teams_user_id = Column(String(255), nullable=True, index=True)
    teams_display_name = Column(String(255))

    is_manual = Column(Boolean, default=False)      # 수동 매핑 여부
    synced_at = Column(DateTime(timezone=True))      # 마지막 동기화
    created_at = Column(DateTime(timezone=True))
```

**인덱스**: `slack_user_id`, `teams_user_id` 각각 인덱스 → 메시지 수신 시 O(1) 조회.

### 3.3 멘션 변환 파이프라인

#### Slack → Teams

```
원본 텍스트: "안녕 <@U0ABC123> 회의 참석해주세요"
                          │
  ┌───────────────────────┘
  │  1) 정규식으로 <@U...> 파싱
  │  2) MentionEntity 생성 (user_id=U0ABC123)
  │  3) 텍스트를 "@홍길동"으로 치환
  ▼
CommonMessage.text = "안녕 @홍길동 회의 참석해주세요"
CommonMessage.mentions = [MentionEntity(user_id="U0ABC123", display_name="홍길동", ...)]
                          │
  ┌───────────────────────┘
  │  4) 매핑 테이블: U0ABC123 → teams_user_id = "29:1a2b..."
  │  5) Teams HTML: <at id="0">홍길동</at>
  │  6) entities 배열에 mention 객체 추가
  ▼
Teams API body:
{
  "body": {
    "contentType": "html",
    "content": "안녕 <at id=\"0\">홍길동</at> 회의 참석해주세요"
  },
  "mentions": [{
    "id": 0,
    "mentionText": "홍길동",
    "mentioned": {
      "user": { "id": "29:1a2b...", "displayName": "홍길동" }
    }
  }]
}
```

#### Teams → Slack

```
원본 텍스트: "<at>홍길동</at> 확인 부탁드립니다"
Activity.entities: [{ type: "mention", mentioned: { id: "29:1a2b...", name: "홍길동" } }]
                          │
  ┌───────────────────────┘
  │  1) <at>...</at> 태그 파싱 + entities에서 user ID 매칭
  │  2) MentionEntity 생성 (user_id="29:1a2b...", display_name="홍길동")
  │  3) 텍스트를 "@홍길동"으로 정규화
  ▼
CommonMessage.text = "@홍길동 확인 부탁드립니다"
CommonMessage.mentions = [MentionEntity(user_id="29:1a2b...", ...)]
                          │
  ┌───────────────────────┘
  │  4) 매핑 테이블: 29:1a2b... → slack_user_id = "U0ABC123"
  │  5) Slack mrkdwn: <@U0ABC123>
  ▼
Slack 메시지: "<@U0ABC123> 확인 부탁드립니다"
→ Slack 클라이언트에서 "@홍길동" 으로 렌더링 + 알림 발생
```

### 3.4 기존 멘션 기능과의 충돌 분석

#### 특수 멘션 처리

| 멘션 | Slack 형식 | Teams 형식 | 변환 전략 |
|------|-----------|-----------|-----------|
| `@channel` / `@here` | `<!channel>` / `<!here>` | 해당 없음 | **변환하지 않음** — `@channel`/`@here` 평문 표시 |
| `@everyone` | `<!everyone>` | `<at>Everyone</at>` | 양방향 변환 가능하나, **무분별한 알림 방지를 위해 평문 처리 권장** |
| `@봇 이름` | `<@BOT_ID>` | 봇 Activity | **변환 제외** — 봇 멘션은 브리지 대상이 아님 |
| `#채널 멘션` | `<#C123\|channel>` | 해당 없음 | `#channel` 평문 표시 |

#### 자기 플랫폼 멘션 (충돌 없음)

Slack에서 `@홍길동`을 멘션하면:
- **Slack 내부**: 정상 동작 (네이티브 멘션, 알림 발생)
- **Teams 전달**: 매핑 성공 시 Teams에서도 멘션 알림 발생, 실패 시 평문 `@홍길동`

→ **기존 플랫폼의 멘션 동작에는 영향 없음.** 브리지는 전달 과정에서만 변환.

#### 매핑 실패 시 Fallback

```
매핑 테이블에 없는 사용자 멘션
  → <@U_UNKNOWN> (Slack 원본)
  → 매핑 조회 실패
  → Slack display_name 캐시에서 이름 조회
  → Teams에 "@홍길동" 평문 텍스트로 전달 (알림 없음, 이름은 보존)
```

### 3.5 동기화 서비스 설계

```python
class UserMappingService:
    """크로스 플랫폼 사용자 매핑 동기화 서비스"""

    async def sync_all(self) -> SyncResult:
        """양쪽 플랫폼 사용자 전체 동기화"""
        # 1. Slack users.list → email 포함 프로필 조회
        # 2. Teams /teams/{id}/members → email 포함 멤버 조회
        # 3. 이메일 기준 매칭 → user_mapping 테이블 UPSERT
        # 4. 매칭 안 된 사용자는 한쪽만 채워서 저장 (수동 매핑 대기)

    async def lookup(self, platform: str, user_id: str) -> Optional[UserMapping]:
        """메시지 처리 시 매핑 조회 (캐시 우선)"""
        # Redis 캐시 → DB fallback → None

    async def manual_link(self, slack_id: str, teams_id: str) -> UserMapping:
        """Admin이 수동으로 매핑 연결"""

    async def manual_unlink(self, mapping_id: int):
        """매핑 해제"""
```

#### 캐싱 전략

```
Redis 캐시 (TTL 1시간):
  user_map:slack:{slack_user_id} → teams_user_id
  user_map:teams:{teams_user_id} → slack_user_id

DB (원본):
  bridge_user_mappings 테이블

조회 흐름:
  Redis hit → 즉시 반환
  Redis miss → DB 조회 → Redis에 캐시 → 반환
  DB miss → None (매핑 실패 → 평문 fallback)
```

---

## 4. 구현 범위와 단계

### Phase 1: 매핑 인프라 (기반)

- [ ] `UserMapping` 모델 + 마이그레이션
- [ ] `UserMappingService` — 동기화, 조회, 캐시
- [ ] Slack `get_users()` email 필드 추가 수집
- [ ] Provider connect 시 초기 동기화 트리거
- [ ] Admin API — 매핑 목록 조회, 수동 연결/해제, 동기화 트리거

### Phase 2: 멘션 변환 파이프라인 (핵심)

- [ ] `CommonMessage`에 `mentions: List[MentionEntity]` 필드 추가
- [ ] Slack `transform_to_common()` — `<@U123>` 파싱 → MentionEntity 추출 + 텍스트 치환
- [ ] Teams `transform_to_common()` — `<at>` 태그 + entities 파싱 → MentionEntity 추출
- [ ] Slack `transform_from_common()` — MentionEntity → `<@U123>` 생성
- [ ] Teams `transform_from_common()` — MentionEntity → `<at>` HTML + mentions 배열 생성
- [ ] `_clean_slack_mrkdwn()` — 멘션 제거 대신 평문 이름으로 치환

### Phase 3: Admin UI (관리)

- [ ] 사용자 매핑 관리 페이지 — 매핑 목록, 상태(자동/수동), 동기화 버튼
- [ ] 매핑되지 않은 사용자 필터 — 수동 연결 UI
- [ ] 동기화 이력/로그

---

## 5. 리스크와 제약

### 5.1 API 제한

| 플랫폼 | API | Rate Limit | 영향 |
|--------|-----|-----------|------|
| Slack | `users.list` | Tier 2 (20/min) | 대규모 워크스페이스(1000+)에서 페이지네이션 필요 |
| Slack | `users.info` | Tier 4 (100+/min) | on-demand 조회는 충분 |
| Teams | `/teams/{id}/members` | 제한 완화됨 | 일반적 사용에서 문제 없음 |
| Teams | Graph API 전체 | 분당 ~60,000 req | 충분 |

### 5.2 이메일 매핑 한계

- **Slack 무료 플랜**: `profile.email`이 빈 값일 수 있음 → 수동 매핑으로 보완
- **외부 게스트**: 조직 이메일과 게스트 이메일이 다를 수 있음 → 수동 매핑
- **공유 계정 / 서비스 계정**: 이메일이 없거나 매핑 불가 → 제외

### 5.3 Teams 멘션 API 제약

Teams Graph API로 메시지를 보낼 때 `mentions` 배열을 지원하지만, **Bot Framework의 Activity에서만** 완전히 지원된다. Graph API의 `/messages` 엔드포인트로 보내는 경우 멘션이 텍스트로만 표시되고 알림이 발생하지 않을 수 있다.

**확인 필요**: 현재 Teams Provider가 Bot Framework (`turn_context.send_activity`)와 Graph API (`/messages` POST) 중 어느 경로로 메시지를 전송하는지에 따라 멘션 알림 가능 여부가 달라진다.

- **Bot Framework 경로**: `mentions` 엔티티 완전 지원 → 알림 발생
- **Graph API 경로**: `<at>` 태그는 렌더링되지만 알림이 안 될 수 있음

### 5.4 성능 영향

- **매핑 조회**: 메시지당 멘션 수만큼 Redis 조회 추가 — 멘션이 보통 1~3개이므로 무시할 수준
- **동기화**: 6시간 주기 전체 동기화 — 사용자 수 × 2 API 호출, 배경 작업이므로 영향 없음
- **메모리**: 매핑 캐시 — 사용자 500명 기준 ~50KB, 무시 가능

---

## 6. 대안 비교: 구현 안 하는 경우

멘션 변환을 구현하지 않고, 현재 동작을 개선하는 최소 방안:

| 항목 | 현재 | 최소 개선 | 완전 구현 |
|------|------|-----------|-----------|
| `<@U123>` 표시 | 의미 없는 텍스트 노출 | `@홍길동` 평문 표시 (이름만) | `@홍길동` + 상대 플랫폼 알림 |
| `<at>이름</at>` 표시 | HTML 태그 깨져 보임 | `@이름` 평문 표시 | `<@U123>` Slack 멘션 생성 |
| 구현 비용 | 0 | 낮음 (formatter만 수정) | 높음 (모델+서비스+UI) |
| 사용자 경험 | 나쁨 | 보통 (이름 보이나 알림 없음) | 좋음 (알림까지 동작) |

### 최소 개선안 (Phase 0)

Phase 1~3 전에 즉시 적용 가능한 개선:

1. `_clean_slack_mrkdwn()`의 멘션 제거 → `convert_slack_mentions_to_text()` 호출로 변경 (이미 존재하는 함수 활용)
2. Slack `transform_to_common()`에서 `_user_name_cache`를 user_map으로 전달하여 `<@U123>` → `@홍길동` 치환
3. Teams `transform_to_common()`에서 `<at>...</at>` HTML 태그를 `@이름` 평문으로 정규화

→ **알림은 없지만, 최소한 멘션이 읽을 수 있는 이름으로 표시됨.**

---

## 7. 결론

| 결정 사항 | 내용 |
|-----------|------|
| 매핑 키 | 이메일 기반 자동 매핑 + Admin 수동 보정 |
| 동기화 방식 | Provider connect 시 초기 + 6시간 주기 배경 동기화 |
| 멘션 작성 UI | 네이티브 플랫폼 멘션 사용 (브리지 전용 UI 없음) |
| 기존 충돌 | 없음 — 원본 플랫폼 멘션은 그대로 동작, 전달 시에만 변환 |
| 특수 멘션 | `@channel`, `@here`, `@everyone` → 평문 처리 (무분별 알림 방지) |
| 매핑 실패 | `@표시이름` 평문 fallback (알림 없음, 이름은 보존) |
| 권장 순서 | Phase 0 (최소 개선) → Phase 1 (인프라) → Phase 2 (변환) → Phase 3 (UI) |
