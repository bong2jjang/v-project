---
title: Token Optimization Setup - Claude Code 효율성 개선
date: 2026-04-02
authors: [vms-team]
tags: [optimization, claude-code, configuration, agent]
---

# Token Optimization Setup

Claude Code 세션의 토큰 사용을 **20-35% 절약**하기 위한 최적화 전략을 `.claude/` 설정에 적용했습니다.

<!--truncate-->

## 🎯 목표

- **토큰 절약**: 20-35% 사용량 감소
- **작업 효율**: 역할별 모델 분리로 속도 향상
- **비용 최적화**: Haiku 모델 활용으로 비용 절감

## 📋 적용된 설정

### 1. search-optimizer Agent (Haiku)

**파일**: `.claude/agents/search-optimizer.md`

**목적**: 빠른 검색 및 분석 작업을 Haiku 모델로 처리

**전문 분야**:
- 파일 검색 (Glob)
- 코드 검색 (Grep)
- 로그 분석
- 빠른 파일 읽기

**사용 예시**:
```
"backend에서 SlackProvider 사용하는 파일 찾아줘"
"로그에서 에러 패턴 검색해줘"
"Provider 관련 파일 목록 보여줘"
```

**예상 토큰 절약**: 30%

### 2. Token Optimization Workflow

**파일**: `.claude/token-optimization-workflow.md`

**내용**:
- 역할별 모델 선택 가이드
- Agent 활용 방법
- 파일 읽기 최적화 패턴
- 세션 관리 전략
- 실전 워크플로우 시나리오

**핵심 전략**:

| 모델 | 비용 | 속도 | 사용 비중 |
|------|------|------|----------|
| Haiku | 낮음 | 빠름 | 30% |
| Sonnet | 중간 | 중간 | 60% |
| Opus | 높음 | 느림 | 10% |

### 3. Token Tips Command

**파일**: `.claude/commands/token_tips.md`

**용도**: 현재 세션의 토큰 사용 현황 분석 및 최적화 제안

**사용 방법**:
```bash
/token-tips
```

**출력 정보**:
- 현재 토큰 사용량 및 비율
- 최근 작업 패턴 분석
- Agent 활용 제안
- 파일 읽기 최적화 기회
- 세션 분리 필요 여부

### 4. CLAUDE.md 업데이트

**추가된 섹션**:
- "토큰 최적화 전략" (역할별 Agent 활용 표)
- "토큰 최적화 작업" (실전 사용 예시)

## 🔧 파일 읽기 최적화 패턴

### ❌ 비효율적
```python
Read("main.py")  # 전체 408줄 반복 읽기
Read("main.py")  # 또 전체 읽기
```

### ✅ 효율적
```python
Grep("def init_bridge", path="main.py", -n=True)  # 위치 파악: 123번 줄
Read("main.py", offset=120, limit=50)              # 필요한 부분만
```

**예상 토큰 절약**: 10-15%

## 📊 예상 효과

### 시나리오 1: 파일 찾고 수정
```
1. [Haiku] search-optimizer - 파일 검색 (5k 토큰)
2. [Sonnet] 메인 세션 - 코드 수정 (10k 토큰)
Total: 15k (기존 대비 30% 절약)
```

### 시나리오 2: Docker 문제 해결
```
1. [Sonnet] docker-expert - 진단 (8k 토큰)
2. [Sonnet] 메인 세션 - 수정 (7k 토큰)
Total: 15k (기존 대비 20% 절약)
```

### 시나리오 3: 코드베이스 탐색
```
1. [Haiku] search-optimizer - 파일 목록 (3k 토큰)
2. [Sonnet] Explore - 아키텍처 분석 (12k 토큰)
3. [Sonnet] 메인 세션 - 구현 (15k 토큰)
Total: 30k (기존 대비 35% 절약)
```

## 🎓 사용 가이드

### 언제 search-optimizer를 사용할까?

✅ **사용하기 좋은 경우**:
- "XXX 파일 찾아줘"
- "로그에서 에러 검색"
- "함수 위치 찾기"
- "설정 파일 읽어줘"
- "패턴 매칭"

❌ **사용하지 말아야 할 경우**:
- 코드 수정 필요
- 복잡한 디버깅
- 아키텍처 설계
- 여러 파일 동시 수정

### 세션 관리 체크리스트

- [ ] 토큰 사용 75% 미만인가?
- [ ] 이전 컨텍스트가 필요한가?
- [ ] 새 Phase/기능을 시작하는가?
- [ ] 작업 요약을 남겼는가?

## 📈 현재 세션 상태

**시작 시점**: 2026-04-02
**현재 사용량**: 52.7k / 200k (26.4%)
**상태**: ✅ 여유 충분

## 📁 생성된 파일

```
.claude/
├── agents/
│   └── search-optimizer.md          # 🆕 Haiku 검색 전문가
├── commands/
│   └── token_tips.md                # 🆕 토큰 사용 현황 확인
└── token-optimization-workflow.md   # 🆕 워크플로우 가이드

CLAUDE.md                            # ✏️ 업데이트 (토큰 최적화 섹션 추가)

docusaurus/blog/work-history/
└── 2026-04-02-token-optimization-setup.md  # 🆕 이 문서
```

## 🔗 참고 문서

- **전략 문서**: `docusaurus/docs/design/CLAUDE_CODE_TOKEN_OPTIMIZATION.md`
- **워크플로우**: `.claude/token-optimization-workflow.md`
- **프로젝트 설정**: `CLAUDE.md`

## 다음 단계

1. **실전 테스트**: search-optimizer 사용해보기
2. **효과 측정**: 토큰 사용량 모니터링
3. **패턴 개선**: 사용 경험 기반 최적화

---

**작성자**: VMS Chat Ops Team
**관련 작업**: Phase 1 - Provider Settings UI 완료 후 토큰 최적화 적용
