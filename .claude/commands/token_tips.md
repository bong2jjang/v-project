---
description: 현재 세션의 토큰 사용 현황과 최적화 팁 제공
---

# Token Optimization Tips

현재 세션의 토큰 사용 상황을 분석하고, 최적화 방법을 제안합니다.

## 분석 항목

1. **현재 토큰 사용량**
   - 사용: X/200k (Y%)
   - 남은 여유: Z tokens

2. **최근 작업 패턴 분석**
   - 파일 읽기 횟수
   - Agent 사용 비율
   - 반복 작업 감지

3. **최적화 제안**
   - Agent로 분리 가능한 작업
   - 파일 읽기 최적화 기회
   - 세션 분리 필요 여부

## 출력 형식

```markdown
## 📊 현재 세션 토큰 사용

**사용량**: 45,000 / 200,000 (22.5%)
**상태**: ✅ 여유 충분

## 🔍 작업 패턴

- 파일 읽기: 15회 (평균 300줄/회)
- Agent 사용: 2회
- Grep 사용: 5회

## 💡 최적화 제안

### 1. search-optimizer 활용 기회
다음 작업은 Haiku 모델로 처리 가능:
- "로그에서 에러 찾기"
- "Provider 파일 검색"

### 2. 파일 읽기 최적화
반복 읽은 파일:
- `apps/v-channel-bridge/backend/app/main.py` (3회) → offset/limit 활용 권장

### 3. 세션 관리
- 현재 상태: 계속 작업 가능
- 권장 분기점: 150k (75%)
```

## 실행 방법

```bash
/token-tips
```

---

**참고 문서**: `.claude/token-optimization-workflow.md`
