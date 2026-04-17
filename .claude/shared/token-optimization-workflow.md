# Token Optimization Workflow

**버전**: 1.0
**최종 업데이트**: 2026-04-02
**참고 문서**: `docusaurus/docs/design/CLAUDE_CODE_TOKEN_OPTIMIZATION.md`

## 목표

Claude Code 세션에서 **20-35% 토큰 절약**을 목표로 합니다.

## 핵심 전략

### 1. 역할별 모델 선택

| 모델 | 비용 | 속도 | 사용 시기 | 비중 |
|------|------|------|----------|------|
| **Haiku** | 낮음 | 빠름 | 파일 검색, 로그 분석, 키워드 찾기 | 30% |
| **Sonnet** | 중간 | 중간 | 일반 개발, 코드 작성, 디버깅 | 60% |
| **Opus** | 높음 | 느림 | 복잡한 아키텍처, 전체 설계 | 10% |

### 2. Agent 활용 가이드

#### search-optimizer (Haiku)
**언제 사용**:
- "어디에 XXX 함수가 있지?"
- "로그에서 에러 찾아줘"
- "Provider 파일들 목록 보여줘"
- "설정 파일 읽어줘"

**호출 방법**:
```
Task tool → subagent_type="search-optimizer"
```

**예시**:
```
Task(
  subagent_type="search-optimizer",
  description="Find SlackProvider usage",
  prompt="Grep으로 'SlackProvider' 키워드를 찾고, 사용되는 파일 목록과 각 파일의 주요 라인을 리포트해줘."
)
```

#### docker-expert (Sonnet)
**언제 사용**:
- Docker 서비스 상태 확인
- 컨테이너 디버깅
- 설정 문제 진단

**호출 방법**:
```
Task tool → subagent_type="docker-expert"
```

#### Explore (Sonnet)
**언제 사용**:
- 코드베이스 구조 파악
- "어떻게 작동하지?" 질문
- 여러 파일에 걸친 흐름 이해

**호출 방법**:
```
Task tool → subagent_type="Explore" → thoroughness="quick|medium|very thorough"
```

### 3. 파일 읽기 최적화

#### ❌ 비효율적 패턴
```python
# 같은 파일 반복 읽기
Read("apps/v-channel-bridge/backend/app/main.py")  # 전체 408줄
# ... 작업 ...
Read("apps/v-channel-bridge/backend/app/main.py")  # 또 전체 읽기

# 불필요하게 큰 파일 전체 읽기
Read("apps/v-channel-bridge/backend/app/services/websocket_bridge.py")  # 500줄+
```

#### ✅ 효율적 패턴
```python
# 1. Grep으로 위치 먼저 찾기
Grep("def init_bridge", path="apps/v-channel-bridge/backend/app/main.py", output_mode="content", -n=True)
# 결과: 123번 줄에 있음

# 2. 해당 부분만 읽기
Read("apps/v-channel-bridge/backend/app/main.py", offset=120, limit=50)

# 3. 여러 파일 병렬 읽기
Read("apps/v-channel-bridge/backend/app/api/bridge.py")
Read("apps/v-channel-bridge/backend/app/services/websocket_bridge.py", offset=100, limit=80)
```

### 4. 세션 관리 전략

#### 언제 새 세션 시작?
- **토큰 사용 > 150k/200k** (75% 초과)
- **컨텍스트가 이전 작업과 무관**
- **새로운 Phase/기능 시작**

#### 세션 종료 전
```markdown
## 작업 요약
- 완료: Provider UI 구현 (backend + frontend)
- 변경 파일: [목록]
- 다음 작업: Phase 2 - Gateway 관리 UI

## 주요 코드 위치
- Provider API: apps/v-channel-bridge/backend/app/api/accounts_crud.py
- Provider Store: apps/v-channel-bridge/frontend/src/store/providers.ts
- Provider UI: apps/v-channel-bridge/frontend/src/components/providers/
```

### 5. 커맨드 활용

#### /migration-status
**용도**: 마이그레이션 진행 상황 확인
**모델**: Haiku (읽기 전용)
**토큰**: ~5k

#### /docker-troubleshoot
**용도**: Docker 문제 진단
**모델**: Sonnet (진단 필요)
**토큰**: ~10k

#### /enforce-standards
**용도**: 코딩 표준 검사
**모델**: Sonnet (판단 필요)
**토큰**: ~15k

## 실전 워크플로우

### 시나리오 1: 파일 찾고 수정하기

```
1. [Haiku Agent] search-optimizer
   - "backend에서 SlackProvider 사용하는 파일 찾아줘"
   - 결과: 3개 파일 발견

2. [Sonnet - 메인 세션]
   - Read("파일1", offset=X, limit=Y)  # 필요한 부분만
   - Edit(...) 수정 작업

3. [Haiku Agent] search-optimizer (선택적)
   - "수정 후 다른 파일에 영향 있는지 검색"
```

**예상 토큰 절약**: 30%

### 시나리오 2: Docker 문제 해결

```
1. [Sonnet Agent] docker-expert
   - "서비스 상태 확인하고 에러 진단해줘"
   - 결과: Backend 503 에러, 원인은 DB 연결

2. [Sonnet - 메인 세션]
   - Read(".env")  # 설정 확인
   - Edit("apps/v-channel-bridge/backend/app/main.py")  # 수정
```

**예상 토큰 절약**: 20%

### 시나리오 3: 코드베이스 탐색

```
1. [Haiku Agent] search-optimizer
   - "Provider 관련 파일들 목록과 각 파일의 주요 클래스/함수 리포트"

2. [Sonnet Agent] Explore (thoroughness="medium")
   - "Provider Pattern이 어떻게 구현되어 있는지 설명해줘"

3. [Sonnet - 메인 세션]
   - 탐색 결과 기반으로 코드 수정
```

**예상 토큰 절약**: 35%

## 체크리스트

### 작업 시작 전
- [ ] 이 작업은 Agent로 분리할 수 있는가?
- [ ] 파일 전체를 읽어야 하는가? (offset/limit 가능?)
- [ ] Grep으로 위치 먼저 찾을 수 있는가?

### Agent 선택
- [ ] 단순 검색/분석 → **search-optimizer (Haiku)**
- [ ] Docker 문제 → **docker-expert (Sonnet)**
- [ ] 코드 탐색 → **Explore (Sonnet)**
- [ ] 일반 개발 → **메인 세션 (Sonnet)**
- [ ] 복잡한 설계 → **메인 세션 + Opus (필요시)**

### 세션 관리
- [ ] 토큰 사용 75% 미만인가?
- [ ] 이전 컨텍스트가 필요한가?
- [ ] 작업 요약을 남겼는가?

## 측정 지표

**목표 토큰 사용량** (200k 기준):
- Phase 1 완료: ~120k (60%)
- Phase 2-3 완료: 새 세션 시작
- 전체 마이그레이션: 4-5 세션 예상

**현재 세션** (2026-04-02):
- 사용: 44k/200k (22%)
- 상태: ✅ 여유 충분

**기대 효과**:
- Agent 활용: 20-30% 절약
- 파일 읽기 최적화: 10-15% 절약
- 세션 분리: 컨텍스트 명확성 향상

---

**참고**: 이 문서는 `CLAUDE_CODE_TOKEN_OPTIMIZATION.md`의 실전 적용 가이드입니다.
