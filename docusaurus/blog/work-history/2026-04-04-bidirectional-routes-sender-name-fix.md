---
title: 양방향 라우팅 및 파일 전송 발신자 표시 기능 구현
date: 2026-04-04
authors: [vms-team]
tags: [backend, frontend, routes, slack, file-transfer, bidirectional]
---

# 양방향 라우팅 및 파일 전송 발신자 표시 기능 구현

## 작업 개요

**작업 날짜**: 2026-04-04
**커밋 해시**: `b297f283`
**작업 시간**: 약 3시간

이번 작업에서는 두 가지 주요 기능을 구현했습니다:

1. **파일 전송 시 발신자 이름 표시 문제 해결**
2. **양방향 라우팅 기능 구현 (Bidirectional Routes)**

<!-- truncate -->

## 1. 파일 전송 발신자 이름 표시 문제 해결

### 문제 상황

Slack에서 파일/이미지를 전송할 때 발신자 이름(예: "Vitor")이 표시되지 않는 문제가 발생했습니다.

### 원인 분석

- `files_upload_v2` API 호출 시 `initial_comment` 파라미터로 텍스트를 전송
- 파일 업로드 후 `return True`로 early return 발생
- `chat_postMessage`가 호출되지 않아 `message_mode` 기반 username/icon 설정이 적용되지 않음

### 해결 방법

**파일**: `backend/app/adapters/slack_provider.py` (lines 503-568)

```python
# 변경 전: initial_comment로 텍스트 전송
file_url = await self.upload_file(
    file_path=attachment.local_path,
    channel_id=message.channel.id,
    filename=attachment.name,
    initial_comment=message.text,  # ❌ 문제
    thread_ts=message.thread_id,
)
return True  # ❌ early return

# 변경 후: initial_comment 제거 + 항상 chat_postMessage 호출
file_url = await self.upload_file(
    file_path=attachment.local_path,
    channel_id=message.channel.id,
    filename=attachment.name,
    initial_comment=None,  # ✅ 제거
    thread_ts=message.thread_id,
)

# ✅ 항상 chat_postMessage로 텍스트 전송
if message.text or message.attachments:
    slack_msg = self.transform_from_common(message)
    result = await self.app.client.chat_postMessage(**slack_msg)
    # ... username/icon 설정 적용됨
```

### 추가 수정: Bot 메시지 중복 전송 방지

양방향 라우트에서 봇이 업로드한 파일이 역방향으로 다시 전송되는 문제도 함께 해결했습니다.

**파일**: `backend/app/adapters/slack_provider.py`

1. **Bot User ID 추적** (lines 335-348):
```python
# connect() 메서드에서 auth.test 호출
try:
    auth_result = await self.app.client.auth_test()
    if auth_result.get("ok"):
        self.bot_user_id = auth_result.get("user_id")
        logger.info("Slack bot authenticated", bot_user_id=self.bot_user_id)
except Exception as e:
    logger.warning("Failed to get bot user ID", error=str(e))
```

2. **메시지 필터 강화** (lines 78-86):
```python
# 기존: bot_id만 체크
if event.get("bot_id"):
    return

# 개선: bot_id + user == bot_user_id 체크
if event.get("bot_id") or event.get("user") == self.bot_user_id:
    logger.debug("Ignoring bot message", ...)
    return
```

## 2. 양방향 라우팅 기능 구현

### 기능 설명

기존에는 Route를 추가할 때 양방향 통신을 위해 두 개의 Route를 수동으로 생성해야 했습니다:
- Route 1: Slack → Teams
- Route 2: Teams → Slack (수동 추가 필요)

이제는 **한 번의 Route 추가로 양방향 통신이 자동 설정**됩니다.

### 백엔드 구현

#### 2.1 RouteManager 수정

**파일**: `backend/app/services/route_manager.py` (lines 89-208)

```python
async def add_route(
    self,
    source_platform: str,
    source_channel: str,
    target_platform: str,
    target_channel: str,
    target_channel_name: Optional[str] = None,
    source_channel_name: Optional[str] = None,
    message_mode: Optional[str] = "sender_info",
    is_bidirectional: bool = True,  # ✅ 새로운 파라미터 (기본값: True)
) -> bool:
    """라우팅 룰 추가 (양방향 지원)"""

    # 1. Forward route 저장
    key = self._make_route_key(source_platform, source_channel)
    value = self._make_target_value(target_platform, target_channel)
    await self.redis.sadd(key, value)

    # 2. Bidirectional 플래그 저장
    bidirectional_key = f"{key}:bidirectional"
    await self.redis.hset(bidirectional_key, value, "1" if is_bidirectional else "0")

    # 3. 양방향이면 자동으로 역방향 라우트 생성
    if is_bidirectional:
        reverse_key = self._make_route_key(target_platform, target_channel)
        reverse_value = self._make_target_value(source_platform, source_channel)
        await self.redis.sadd(reverse_key, reverse_value)

        # 역방향 라우트도 동일한 설정 적용
        # - 채널 이름
        # - 메시지 모드
        # - Bidirectional 플래그
        # ... (코드 생략)
```

**Redis 데이터 구조**:
```
route:slack:C123
  → msteams:19:abc@thread.tacv2
route:slack:C123:bidirectional
  → {msteams:19:abc@thread.tacv2: "1"}
route:slack:C123:modes
  → {msteams:19:abc@thread.tacv2: "sender_info"}
route:slack:C123:names
  → {msteams:19:abc@thread.tacv2: "General"}
route:slack:C123:source_name
  → "general"

# 역방향 라우트 자동 생성
route:msteams:19:abc@thread.tacv2
  → slack:C123
route:msteams:19:abc@thread.tacv2:bidirectional
  → {slack:C123: "1"}
# ... (역방향 메타데이터도 동일하게 저장)
```

#### 2.2 get_all_routes() API 수정

**파일**: `backend/app/services/route_manager.py` (lines 385-446)

```python
async def get_all_routes(self) -> List[Dict[str, Any]]:
    """모든 라우팅 룰 조회 (bidirectional 플래그 포함)"""

    # 1. 메타데이터 키 제외
    keys.extend([
        k for k in batch
        if not k.endswith(":names")
        and not k.endswith(":source_name")
        and not k.endswith(":modes")
        and not k.endswith(":bidirectional")  # ✅ 추가
    ])

    # 2. Bidirectional 플래그 조회
    bidirectional_key = f"{key}:bidirectional"
    bidirectional_dict = await self.redis.hgetall(bidirectional_key)

    # 3. 타겟별 bidirectional 플래그 매핑
    for t in targets:
        target_value = self._make_target_value(t.platform.value, t.id)
        is_bidirectional = bidirectional_dict.get(target_value, "1") == "1"

        target_list.append({
            "platform": t.platform.value,
            "channel_id": t.id,
            "channel_name": t.name,
            "message_mode": message_mode,
            "is_bidirectional": is_bidirectional,  # ✅ 추가
        })
```

#### 2.3 Bridge API 수정

**파일**: `backend/app/api/bridge.py`

```python
# RouteConfig 모델에 필드 추가
class RouteConfig(BaseModel):
    source_platform: str
    source_channel: str
    target_platform: str
    target_channel: str
    target_channel_name: Optional[str] = None
    source_channel_name: Optional[str] = None
    message_mode: Optional[str] = "sender_info"
    is_bidirectional: bool = True  # ✅ 추가 (기본값: True)

# add_route 엔드포인트에서 파라미터 전달
@router.post("/routes")
async def add_route(route: RouteConfig):
    await bridge.route_manager.add_route(
        source_platform=route.source_platform,
        source_channel=route.source_channel,
        target_platform=route.target_platform,
        target_channel=route.target_channel,
        target_channel_name=route.target_channel_name,
        source_channel_name=route.source_channel_name,
        message_mode=route.message_mode,
        is_bidirectional=route.is_bidirectional,  # ✅ 추가
    )
```

### 프론트엔드 구현

#### 2.4 RouteModal UI 추가

**파일**: `frontend/src/components/channels/RouteModal.tsx`

**1. 폼 상태에 필드 추가**:
```typescript
const [formData, setFormData] = useState<RouteCreateRequest>({
  source_platform: "",
  source_channel: "",
  target_platform: "",
  target_channel: "",
  target_channel_name: "",
  source_channel_name: "",
  message_mode: "sender_info",
  is_bidirectional: true,  // ✅ 기본값: true
});
```

**2. UI 섹션 추가** (lines 495-535):
```tsx
{/* 라우팅 방향 섹션 */}
<div className="space-y-4 p-4 bg-surface-elevated rounded-md border-2 border-transparent hover:border-brand-200 transition-colors">
  <div className="flex items-center gap-2">
    <svg className="w-6 h-6 text-brand-600" {...}>
      {/* Double arrow icon */}
    </svg>
    <h3 className="text-heading-sm text-content-primary font-semibold">
      라우팅 방향
    </h3>
    <span className="text-xs text-content-tertiary">(선택사항)</span>
  </div>

  <label className="flex items-start gap-3 cursor-pointer group">
    <input
      type="checkbox"
      checked={formData.is_bidirectional}
      onChange={(e) => setFormData({ ...formData, is_bidirectional: e.target.checked })}
      className="mt-1 w-4 h-4 text-brand-600 border-border-subtle rounded focus:ring-brand-500"
    />
    <div className="flex-1">
      <div className="text-sm font-medium text-content-primary group-hover:text-brand-600">
        양방향 라우팅 (권장)
      </div>
      <div className="text-xs text-content-secondary mt-1">
        체크하면 채널 1 ↔ 채널 2 양방향으로 자동 동기화됩니다.
        체크 해제 시 채널 1 → 채널 2 단방향으로만 전송됩니다.
      </div>
    </div>
  </label>
</div>
```

**3. 동적 안내 메시지** (lines 537-549):
```tsx
{/* Info */}
<div className="p-3 bg-status-info-light border border-status-info-border rounded-md text-sm text-content-primary">
  <strong>Route란?</strong> 두 채널 간 메시지 동기화를 설정합니다.
  {formData.is_bidirectional ? (
    <span>
      {" "}양방향 모드에서는 양쪽 방향으로 자동 동기화되며, 무한 루프는 시스템이 자동으로 방지합니다.
    </span>
  ) : (
    <span>
      {" "}단방향 모드에서는 채널 1에서 채널 2로만 메시지가 전송됩니다.
    </span>
  )}
</div>
```

#### 2.5 RouteList 화살표 표시 개선

**파일**: `frontend/src/components/channels/RouteList.tsx` (lines 181-251)

```tsx
{/* Arrow - 양방향/단방향 조건부 표시 */}
<div className="flex justify-center lg:block">
  {route.targets[0]?.is_bidirectional !== false ? (
    <>
      {/* 양방향 세로 화살표 (모바일) */}
      <svg className="w-6 h-6 lg:hidden text-brand-600 flex-shrink-0"
           title="양방향 라우트">
        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
      {/* 양방향 가로 화살표 (데스크톱) */}
      <svg className="hidden lg:block w-8 h-8 text-brand-600 flex-shrink-0"
           title="양방향 라우트">
        <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    </>
  ) : (
    <>
      {/* 단방향 세로 화살표 (모바일) */}
      <svg className="w-6 h-6 lg:hidden text-brand-600 flex-shrink-0"
           title="단방향 라우트 (채널 1 → 채널 2)">
        <path d="M17 8l4 4m0 0l-4 4m4-4H3" transform="rotate(90 12 12)" />
      </svg>
      {/* 단방향 가로 화살표 (데스크톱) */}
      <svg className="hidden lg:block w-8 h-8 text-brand-600 flex-shrink-0"
           title="단방향 라우트 (채널 1 → 채널 2)">
        <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </>
  )}
</div>
```

**화살표 표시 규칙**:
- `is_bidirectional === true` (또는 undefined): ↔ (double arrow)
- `is_bidirectional === false`: → (single arrow pointing right)
- 모바일: 세로 화살표 (위아래)
- 데스크톱: 가로 화살표 (좌우)

#### 2.6 API 타입 업데이트

**파일**: `frontend/src/lib/api/routes.ts`

```typescript
export interface RouteTarget {
  platform: string;
  channel_id: string;
  channel_name?: string;
  message_mode?: string;
  is_bidirectional?: boolean;  // ✅ 추가
}

export interface RouteCreateRequest {
  source_platform: string;
  source_channel: string;
  target_platform: string;
  target_channel: string;
  target_channel_name?: string;
  source_channel_name?: string;
  message_mode?: string;
  is_bidirectional?: boolean;  // ✅ 추가
}
```

## 변경된 파일 목록

### 백엔드 (3개 파일)
```
backend/app/adapters/slack_provider.py
backend/app/api/bridge.py
backend/app/services/route_manager.py
```

### 프론트엔드 (3개 파일)
```
frontend/src/lib/api/routes.ts
frontend/src/components/channels/RouteModal.tsx
frontend/src/components/channels/RouteList.tsx
```

**통계**:
- 6개 파일 변경
- +209 줄 추가
- -90 줄 삭제

## 재부팅 후 시스템 복구 방법

### 1. Docker 컨테이너 시작

```bash
cd D:\Github\vms-chat-ops

# 모든 컨테이너 시작
docker compose up -d

# 또는 특정 컨테이너만 시작
docker compose up -d backend frontend postgres redis
```

### 2. 서비스 상태 확인

```bash
# 모든 컨테이너 상태 확인
docker compose ps

# 로그 확인
docker compose logs backend --tail 50
docker compose logs frontend --tail 50

# 헬스체크 확인
docker compose ps | grep healthy
```

### 3. 브라우저에서 접속

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 4. 예상되는 정상 상태

**Backend 로그**:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
[info] Light-Zowe bridge started
[info] Bridge started successfully
```

**Frontend 로그**:
```
VITE v5.4.21  ready in 1804 ms
➜  Local:   http://localhost:5173/
➜  Network: http://172.20.0.X:5173/
```

### 5. 프론트엔드 연결 오류 시

만약 프론트엔드가 백엔드에 연결하지 못하는 경우:

```bash
# 프론트엔드 재시작
docker compose restart frontend

# 또는 재빌드
docker compose up -d --build frontend

# 상태 확인 (10초 후)
sleep 10 && docker compose logs frontend --tail 20
```

## 테스트 체크리스트

재부팅 후 다음 항목들을 테스트하세요:

### ✅ 기본 기능
- [ ] 프론트엔드 접속 (http://localhost:5173)
- [ ] 로그인 가능 여부
- [ ] Dashboard 페이지 로드
- [ ] Route 페이지 접속

### ✅ 양방향 라우팅
- [ ] "Route 추가" 버튼 클릭
- [ ] "라우팅 방향" 섹션 표시 확인
- [ ] "양방향 라우팅" 체크박스 기본 체크 상태 확인
- [ ] 체크박스 토글 시 안내 메시지 변경 확인
- [ ] 양방향 Route 추가 후 목록에서 ↔ 아이콘 확인
- [ ] 단방향 Route 추가 후 목록에서 → 아이콘 확인

### ✅ 파일 전송
- [ ] Slack에서 이미지 전송
- [ ] 발신자 이름(예: "Vitor") 정상 표시 확인
- [ ] 양방향 라우트에서 메시지 중복 전송 없는지 확인
- [ ] 파일 + 텍스트 동시 전송 시 정상 표시 확인

## Git 상태

### 커밋 정보
```bash
# 현재 커밋
git log -1 --oneline
# b297f28 feat(routes): Add bidirectional routing support with sender name fix

# 변경 사항 확인
git diff HEAD~1 --stat
```

### 미푸시 커밋
현재 로컬에는 15개의 커밋이 있으며, 아직 원격 저장소에 푸시되지 않았습니다:

```bash
git log origin/main..HEAD --oneline
# 15 commits ahead of origin/main
```

**재부팅 후 푸시 필요**:
```bash
git push origin main
```

## 다음 작업 예정

1. **실제 파일 전송 테스트**
   - Slack ↔ Teams 파일 전송
   - 발신자 이름 표시 검증
   - 양방향 라우트 메시지 중복 방지 검증

2. **단방향 라우트 테스트**
   - 체크박스 해제 후 Route 추가
   - 단방향 메시지 전송 확인
   - 역방향 메시지가 전송되지 않는지 확인

3. **UI 개선**
   - RouteList에서 양방향/단방향 뱃지 추가 (선택사항)
   - Route 수정 모달에서 bidirectional 옵션 표시

4. **문서화**
   - 사용자 가이드 업데이트 (양방향 라우팅 설명)
   - API 문서 업데이트

## 트러블슈팅

### 문제 1: 프론트엔드가 열리지 않음

**증상**: `ERR_CONNECTION_RESET` 또는 `ERR_CONNECTION_REFUSED`

**해결**:
```bash
# 1. 컨테이너 재시작
docker compose restart frontend

# 2. 여전히 문제 시 재빌드
docker compose stop frontend
docker compose rm -f frontend
docker compose up -d --build frontend

# 3. 10초 후 로그 확인
sleep 10 && docker compose logs frontend --tail 30
```

### 문제 2: Backend 연결 오류

**증상**: `http proxy error: /api/bridge/status`

**해결**:
```bash
# 1. 백엔드 상태 확인
docker compose ps backend

# 2. 백엔드 로그 확인
docker compose logs backend --tail 50

# 3. 백엔드 재시작
docker compose restart backend
```

### 문제 3: Redis 연결 오류

**증상**: `Error connecting to Redis`

**해결**:
```bash
# Redis 컨테이너 상태 확인
docker compose ps redis

# Redis 재시작
docker compose restart redis

# 백엔드도 함께 재시작
docker compose restart backend
```

## 참고 사항

### Docker 네트워크
- Network: `vms-chat-ops_network`
- Backend IP: 일반적으로 `172.20.0.5`
- Frontend IP: 일반적으로 `172.20.0.6`

### 환경 변수
`.env` 파일에서 다음 변수들이 설정되어 있어야 합니다:
- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`

### Redis 키 구조 (참고)
```
route:{platform}:{channel_id}              # Set: 타겟 목록
route:{platform}:{channel_id}:names        # Hash: 타겟 채널 이름
route:{platform}:{channel_id}:source_name  # String: 소스 채널 이름
route:{platform}:{channel_id}:modes        # Hash: 메시지 모드
route:{platform}:{channel_id}:bidirectional # Hash: 양방향 플래그 (NEW)
```

---

**작업자**: Claude Code
**날짜**: 2026-04-04
**버전**: VMS Chat Ops v1.0
**커밋**: b297f283
