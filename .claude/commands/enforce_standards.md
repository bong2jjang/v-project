# 코딩 표준 적용

변경된 파일에 대해 코딩 표준 준수 여부를 검사합니다.

## 워크플로우

### Step 1: 사전 준비

**백엔드 (Python 파일 변경 시):**
```bash
cd apps/v-channel-bridge/backend && python -m ruff check --fix . && python -m ruff format .
```

**프론트엔드 (TypeScript 파일 변경 시):**
```bash
cd apps/v-channel-bridge/frontend && npm run lint:fix && npm run format
```

### Step 2: Code Standards Enforcer Agent 실행

`code-standards-enforcer` Agent를 호출하여 검사:

- 현재 브랜치에서 변경된 파일 대상
- `.claude/coding_conventions.md`의 코딩 규칙 준수
- Python: 타입 힌트, import 규칙, 스키마/모델 분리, 인증 패턴
- TypeScript: 타입 정의, 디자인 시스템 토큰 사용, 하드코딩 색상 금지
- 포맷팅/린트 도구 실행 여부

### Step 3: 결과 확인

- 위반 사항 요약 (심각/중요/경미)
- 수정 권장 사항
- 주의가 필요한 파일 목록
