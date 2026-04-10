# GitHub Issue 분석 및 해결

GitHub Issue를 분석하고, 유효성을 검증하며, 구현 계획을 제안합니다.

## 사용법

```bash
/gh_issue_solve <issue_number>
```

## 워크플로우

### 1. Issue 정보 가져오기

`gh api`로 제목, 설명, 라벨, 담당자, 댓글, 연관 PR 조회

### 2. Issue 유형 판별

- **유효한 버그**: 재현 가능한 문제
- **유효한 기능 요청**: 잘 정의된 개선
- **불명확/유효하지 않음**: 추가 정보 필요
- **이미 해결됨**: 기존 PR이 있음

### 3. 코드베이스 분석

- 관련 코드 찾기 (backend: `app/api/`, `app/services/`, `app/models/` / frontend: `src/pages/`, `src/components/`)
- 인증 관련이면 `app/api/auth.py`, `store/auth.ts` 확인
- 디자인 관련이면 `src/components/ui/`, `src/index.css` 확인
- 기존 테스트 확인

### 4. 구현 제안

```markdown
## Issue 분석: #<number> - [제목]

**유형**: 버그 | 기능 요청
**영향 영역**: Backend API / Frontend UI / Docker / 인증 / 디자인 시스템

### 요약
[간결한 설명]

### 구현 제안
**수정할 파일**: [파일 목록 + 변경 내용]
**접근 방법**: [단계별]
**테스트 전략**: [검증 방법]

### 다음 단계
[Todo 목록]
```

## 참고사항

- 코드를 먼저 읽은 후 제안
- `.claude/coding_conventions.md` 규칙 준수
- 백엔드 변경 시 Ruff 포맷팅 필수
- 프론트엔드 변경 시 디자인 시스템 토큰 사용
