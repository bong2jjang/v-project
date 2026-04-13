# Self-Correction Loop 검토 문서

**작성일**: 2026-03-30
**상태**: 검토 완료, 구현 보류
**담당**: VMS Channel Bridge 개발팀

## 개요

Light-Zowe 아키텍처 마이그레이션 과정에서 Skill의 자가 개선 메커니즘인 Self-Correction Loop 도입을 검토했습니다.

## Self-Correction Loop란?

Skill이 실행 → 결과 검증 → 실패 시 자동 수정 → 재실행을 반복하는 자가 개선 메커니즘입니다.

### 기본 워크플로우

```
┌─────────────────────────────────────────┐
│  Skill 실행                              │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  결과 검증 (Success Check)               │
└─────────────┬───────────────────────────┘
              ↓
        [성공?] ─YES→ 완료
              │
              NO
              ↓
┌─────────────────────────────────────────┐
│  에러 분석 (Error Analysis)              │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  자동 수정 (Auto-Correction)             │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  재실행 (최대 N회)                       │
└─────────────┴───────────────────────────┘
              ↓
        루프 반복
```

## Light-Zowe 마이그레이션 맥락

### 자주 발생하는 반복 수정 패턴

#### 1. Provider 개발 - CommonMessage 변환 실패

**문제 예시**:
```python
# 첫 시도: KeyError 발생
def transform_to_common(self, raw_message):
    return CommonMessage(
        message_id=raw_message["id"],  # ❌ KeyError: 'id'
        timestamp=raw_message["timestamp"],
        ...
    )
```

**Self-Correction 적용 시**:
```python
# 자동 수정 1: .get() 메서드 사용
message_id=raw_message.get("id") or raw_message.get("ts"),  # ✓

# 자동 수정 2: 타입 변환 추가
timestamp=datetime.fromisoformat(raw_message["timestamp"]),  # ✓
```

#### 2. 라우팅 룰 - 형식 오류

**문제 예시**:
```bash
# 첫 시도: Slack 채널 형식 오류
add_route_rule "slack" "general" "teams" "General"  # ❌ # 빠짐
```

**Self-Correction 적용 시**:
```bash
# 자동 감지 및 수정
add_route_rule "slack" "#general" "teams" "General"  # ✓
```

#### 3. 테스트 - Mock 데이터 불완전

**문제 예시**:
```python
# 첫 시도: AttributeError 발생
assert common.user.display_name == "Test User"  # ❌
```

**Self-Correction 적용 시**:
```python
# 자동 보완
mock_user = User(
    user_id="U123",
    username="testuser",
    display_name="Test User"  # ✓ 추가
)
```

## 장점 분석

### 1. 개발 효율 향상

**Without Self-Correction**:
```
1. Provider 코드 작성
2. 테스트 실행 → 실패 (KeyError)
3. 사용자가 에러 확인
4. 수동으로 코드 수정
5. 다시 테스트 → 또 실패 (TypeError)
6. 반복...
→ 총 30분 소요
```

**With Self-Correction**:
```
1. Provider 코드 작성
2. Self-Correction Skill 실행
   - 테스트 → 실패 감지 → 분석 → 수정 → 재테스트
   - 3-5회 루프 후 성공 ✓
→ 총 5분 소요 (6배 빠름)
```

### 2. 일관성 유지
- 동일한 패턴의 에러를 동일한 방식으로 수정
- 코딩 규칙 자동 적용
- 베스트 프랙티스 자동 반영

### 3. 학습 효과
- 수정 히스토리를 보고 사용자가 패턴 학습
- 일반적인 실수를 자동으로 방지

## 위험 분석

### 1. 무한 루프 위험 ⚠️

**시나리오**: 잘못된 수정 방향

```python
# 루프 1: KeyError 'id'
message_id = raw_message.get("id")  # None 반환

# 루프 2: message_id가 None → ValidationError
message_id = raw_message.get("message_id")  # 또 None

# 루프 3: 다른 필드 시도
message_id = raw_message.get("ts")  # 또 None

# 루프 4, 5, 6... 무한 반복
```

**완화 방법**:
- 최대 재시도 횟수 제한 (3-5회)
- 동일 에러 연속 3회 발생 시 중단
- 사용자에게 진행 상황 표시

### 2. 잘못된 수정 누적 ⚠️

**시나리오**: 근본 원인을 모르고 임시 방편만 추가

```python
# 원래 문제: Slack API 응답 형식이 바뀜
# 하지만 Self-Correction은 계속 try-except만 추가

try:
    message_id = raw_message["id"]
except KeyError:
    try:
        message_id = raw_message["ts"]
    except KeyError:
        try:
            message_id = raw_message["message_id"]
        except KeyError:
            # ... 10개 중첩된 try-except (코드 악취)
```

**완화 방법**:
- 근본 원인 분석 단계 추가
- 수정 품질 검증 (코드 복잡도 체크)
- 사용자에게 근본 원인 리포트 제공

### 3. 디버깅 어려움 ⚠️

- 자동 수정된 코드가 많아지면 추적 어려움
- "왜 이렇게 수정되었는지" 이해하기 힘듦

**완화 방법**:
- 모든 수정 히스토리 로그 저장
- 수정 이유 상세 기록
- Git commit에 Self-Correction 태그 추가

### 4. 테스트 신뢰성 저하 ⚠️

- Self-Correction이 테스트를 우회하는 코드를 생성할 수 있음
- 실제 문제를 감추는 Band-aid Fix

**완화 방법**:
- 테스트 우회 감지 및 금지
- 수정 후 전체 테스트 스위트 재실행
- 코드 리뷰 단계 추가

## 권장 접근: Hybrid Self-Correction

완전 자동화보다는 **사용자 승인 기반 Self-Correction**을 권장합니다.

### 제안 워크플로우

```
┌─────────────────────────────────────────┐
│  Skill 실행                              │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  결과 검증                               │
└─────────────┬───────────────────────────┘
              ↓
        [성공?] ─YES→ 완료
              │
              NO
              ↓
┌─────────────────────────────────────────┐
│  에러 분석 및 수정안 생성                │
│  (3가지 수정안 제시)                     │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  사용자 승인 요청 ← NEW!                 │
│  "수정안 1 적용? (Y/n/skip)"             │
└─────────────┬───────────────────────────┘
              ↓
        [승인?] ─YES→ 수정 적용 → 재실행
              │
              NO → 다음 수정안 or 중단
```

### 3가지 모드

| 모드 | 설명 | 사용 시점 |
|------|------|-----------|
| **Interactive** | 매 수정마다 사용자 승인 요청 | 개발 중 (권장) |
| **Automatic** | 자동 수정 (로그만 출력) | CI/CD 파이프라인 |
| **Off** | Self-Correction 비활성화 | 프로덕션 |

## VMS Channel Bridge 프로젝트 적용 계획

### Phase 1: 단일 Skill 시범 적용

**대상**: `validate-common-schema` skill

**이유**:
- Provider 개발에서 가장 반복적인 시행착오 발생
- 명확한 에러 패턴 (KeyError, TypeError, ValidationError)
- 수정 로직이 비교적 단순

**구현 범위**:
```markdown
---
name: validate-common-schema-with-correction
description: Self-Correction Loop 포함 스키마 검증
max_iterations: 5
approval_mode: interactive
---

# 에러 패턴별 수정안

## KeyError
- 수정안 1: .get() + 기본값
- 수정안 2: 대체 필드 fallback
- 수정안 3: UUID 자동 생성

## TypeError
- 수정안 1: 타입 변환 (datetime.fromisoformat)
- 수정안 2: 조건부 변환 (isinstance 체크)
- 수정안 3: Pydantic validator 추가

## ValidationError
- 수정안 1: Optional 타입으로 변경
- 수정안 2: 기본값 추가
- 수정안 3: Custom validator 추가
```

**사용 예시**:
```bash
# Week 2: Slack Provider 개발 중
/test-provider slack

→ validate-common-schema skill 실행
→ KeyError 감지
→ 3가지 수정안 제시
→ 사용자 선택 (1)
→ 수정 적용 및 재테스트
→ TypeError 감지
→ 3가지 수정안 제시
→ 사용자 선택 (1)
→ 수정 적용 및 재테스트
→ 성공 ✓
```

### Phase 2: 효과 측정 (1주일)

**측정 지표**:
- 평균 수정 시간 단축률
- 자동 수정 성공률
- 사용자 만족도
- 잘못된 수정 발생 빈도

**중단 조건**:
- 자동 수정 성공률 < 60%
- 잘못된 수정 발생 빈도 > 30%
- 사용자가 대부분 skip 선택

### Phase 3: 확장 (Phase 2 성공 시)

**추가 대상**:
1. `add-route-rule` - 형식 오류 자동 수정
2. `scaffold-provider` - TODO 구현 자동 추가
3. `backup-config` - 권한 오류 자동 수정

### Phase 4: 자동화 모드 (선택사항)

**CI/CD 통합**:
```yaml
# .github/workflows/provider-test.yml
- name: Test Provider with Self-Correction
  run: |
    pytest --self-correct=automatic \
           --max-iterations=3 \
           backend/tests/providers/
```

## 구현 예시

### validate-common-schema 스킬에 Self-Correction 추가

```markdown
---
name: validate-common-schema
description: CommonMessage 스키마 검증 (Self-Correction 포함)
max_iterations: 5
approval_mode: interactive
correction_log: logs/self_correction.log
---

# Self-Correction 워크플로우

## 1. 초기 검증
pytest backend/tests/providers/test_slack_provider_schema.py -v

## 2. 실패 감지 시
if test_failed:
    error_type = parse_error_type(pytest_output)
    error_context = extract_error_context(pytest_output)

## 3. 수정안 생성
corrections = []

if error_type == "KeyError":
    corrections = [
        {
            "id": 1,
            "description": "Use .get() method with default value",
            "code": "message_id = raw_message.get('id', f'msg-{uuid.uuid4()}')",
            "risk": "low",
            "reason": "Safely handles missing keys"
        },
        {
            "id": 2,
            "description": "Add fallback to alternative field",
            "code": "message_id = raw_message.get('id') or raw_message.get('ts')",
            "risk": "medium",
            "reason": "May still fail if both fields missing"
        },
        {
            "id": 3,
            "description": "Add explicit error handling",
            "code": "try: ... except KeyError: ...",
            "risk": "low",
            "reason": "Most explicit but verbose"
        }
    ]

## 4. 사용자 승인 (interactive 모드)
echo "❌ ${error_type}: ${error_message}"
echo ""
echo "Suggested corrections:"
for correction in corrections:
    echo "  ${correction.id}. ${correction.description}"
    echo "     Risk: ${correction.risk}"
    echo "     Reason: ${correction.reason}"
echo ""
read -p "Apply correction (1-3/skip/abort): " choice

## 5. 수정 적용
if choice in [1,2,3]:
    apply_correction(corrections[choice-1])
    log_correction(corrections[choice-1])

## 6. 재검증
pytest backend/tests/providers/test_slack_provider_schema.py -v

## 7. 반복
iteration++
if iteration < max_iterations and not success:
    goto step 2

## 중단 조건
- ✅ 테스트 통과
- ❌ 최대 재시도 횟수 도달 (5회)
- ❌ 사용자가 'abort' 선택
- ❌ 동일한 에러가 3회 연속 발생 (무한 루프 감지)
```

### 수정 로그 형식

```json
{
  "timestamp": "2026-03-30T10:30:00Z",
  "skill": "validate-common-schema",
  "iteration": 1,
  "error": {
    "type": "KeyError",
    "message": "'id'",
    "file": "backend/app/adapters/slack_provider.py",
    "line": 127
  },
  "correction": {
    "id": 1,
    "description": "Use .get() method with default value",
    "code_before": "message_id = raw_message['id']",
    "code_after": "message_id = raw_message.get('id', f'msg-{uuid.uuid4()}')",
    "approved_by": "user",
    "result": "success"
  },
  "test_result": {
    "passed": 12,
    "failed": 0,
    "duration": "2.3s"
  }
}
```

## 결론

### 권장 사항

✅ **도입 권장**:
- `validate-common-schema` skill에만 제한적 적용
- Interactive 모드로 시작
- 1주일 시범 운영 후 평가

⚠️ **주의 사항**:
- 최대 재시도 3-5회 제한
- 상세한 수정 로그 기록
- 무한 루프 감지 메커니즘 필수

❌ **도입 보류**:
- 모든 Skills에 일괄 적용
- Fully-automatic 모드 (당분간)
- 무제한 재시도

### 다음 단계

1. **Phase 1 구현** (Week 1 완료 후)
   - `validate-common-schema` skill에 Self-Correction 추가
   - Interactive 모드로 시작
   - 상세한 로그 수집

2. **Phase 2 평가** (1주일 후)
   - 효과 측정
   - 사용자 피드백 수집
   - 계속 진행 여부 결정

3. **Phase 3 확장** (Phase 2 성공 시)
   - 다른 Skills로 확장
   - Automatic 모드 추가 검토

## 참고 자료

- Light-Zowe 마이그레이션 계획: `docs/developer-guide/ZOWE_CHAT_MIGRATION_PLAN.md`
- Provider Pattern: `.claude/coding_conventions.md`
- Skills 목록: `.claude/skills/`
- Commands 목록: `.claude/commands/`

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 담당자 |
|------|------|-----------|--------|
| 2026-03-30 | 1.0 | 초기 작성 | VMS Channel Bridge 팀 |
